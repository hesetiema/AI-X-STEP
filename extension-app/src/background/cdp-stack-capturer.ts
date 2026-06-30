// background/cdp-stack-capturer.ts
// 通过 chrome.debugger API (CDP) 捕获点击时刻的 JS 调用栈和变量上下文
//
// 为什么不用 DOMDebugger.setEventListenerBreakpoint：
//   chrome.debugger 只暴露 CDP 子集，DOMDebugger 域被 Chrome 安全策略排除，
//   无法通过扩展 API 在事件监听器上设断点。
//
// 替代方案：主世界注入 click 包装器。
//   类似 network hook（background/index.ts 的 mainWorldNetworkHook），
//   在 attach 时通过 Runtime.evaluate 注入代码，拦截 EventTarget.addEventListener
//   对 'click' 的调用，在原始 handler 执行前捕获 Error().stack。
//   栈数据暂存 window.__tracelens_click_stack__，consumeCapture() 时读取消费。

export interface CdpStackFrame {
  functionName: string;
  url: string;
  lineNumber: number;
  columnNumber: number;
}

export interface CdpScopeVariable {
  name: string;
  type: string;
  valueSummary: string;
}

export interface CdpCaptureResult {
  frames: CdpStackFrame[];
  scopeVariables: CdpScopeVariable[];
}

const MAX_FRAMES = 10;
const CONSUME_TIMEOUT_MS = 500;
const STACK_KEY = '__tracelens_click_stack__';
const STACK_TIME_KEY = '__tracelens_click_stack_time__';
const INJECTED_FLAG = '__tracelens_click_wrapper_injected__';

// 注入主世界的 click 包装器代码
// 通过 Runtime.evaluate 执行，需要是纯函数字符串（无闭包依赖）
function clickWrapperCode(): void {
  const w = window as unknown as Record<string, unknown>;
  if (w.__tracelens_click_wrapper_injected__) return;
  w.__tracelens_click_wrapper_injected__ = true;

  const origAdd = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void {
    if (type === 'click' && typeof listener === 'function') {
      const original = listener;
      const wrapped = function (this: EventTarget, ev: Event) {
        const e = new Error();
        const stack = e.stack || '';
        // 只保留页面相关的帧，过滤扩展和浏览器内部帧
        const lines = stack.split('\n').filter(
          (l) => !l.includes('chrome-extension://') && !l.includes('extension://'),
        );
        (window as unknown as Record<string, unknown>).__tracelens_click_stack__ = lines.slice(0, 12);
        (window as unknown as Record<string, unknown>).__tracelens_click_stack_time__ = Date.now();
        return (original as EventListener).call(this, ev);
      };
      origAdd.call(this, type, wrapped, options);
    } else {
      origAdd.call(this, type, listener, options);
    }
  };
}

type CaptureResolver = (capture: CdpCaptureResult | null) => void;

export class DeepDiagnosisManager {
  private attachedTabs = new Map<number, boolean>();
  private captureResolvers = new Map<number, CaptureResolver>();
  private pendingCaptures = new Map<number, CdpCaptureResult>();
  private detachListeners: Array<(tabId: number) => void> = [];
  private eventListenerRegistered = false;
  private detachListenerRegistered = false;
  private static readonly PROTOCOL_VERSION = '1.3';

  async attach(tabId: number): Promise<void> {
    if (this.attachedTabs.has(tabId)) return;

    try {
      await chrome.debugger.attach({ tabId }, DeepDiagnosisManager.PROTOCOL_VERSION);
      await chrome.debugger.sendCommand({ tabId }, 'Runtime.enable');

      // 注入主世界 click 包装器，捕获每次点击的调用栈
      await chrome.debugger.sendCommand(
        { tabId },
        'Runtime.evaluate',
        {
          expression: `(${clickWrapperCode.toString()})()`,
          // 不需要 returnByValue，仅副作用
        },
      );

      this.attachedTabs.set(tabId, true);

      if (!this.eventListenerRegistered) {
        chrome.debugger.onEvent.addListener(this.handleDebuggerEvent);
        this.eventListenerRegistered = true;
      }
      if (!this.detachListenerRegistered) {
        chrome.debugger.onDetach.addListener(this.handleDetach);
        this.detachListenerRegistered = true;
      }

      console.log('[TraceLens/CDP] attached to tab', tabId, '(click wrapper injected)');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[TraceLens/CDP] attach failed for tab', tabId, ':', msg);
      try {
        await chrome.debugger.detach({ tabId });
      } catch {
        // ignore
      }
      throw err;
    }
  }

  async detach(tabId: number): Promise<void> {
    if (!this.attachedTabs.has(tabId)) return;

    try {
      // 移除注入的包装器（恢复原生 addEventListener）
      await chrome.debugger.sendCommand(
        { tabId },
        'Runtime.evaluate',
        {
          expression: `
            delete window.${STACK_KEY};
            delete window.${STACK_TIME_KEY};
            delete window.${INJECTED_FLAG};
          `,
        },
      );
    } catch {
      // ignore
    }

    try {
      await chrome.debugger.detach({ tabId });
    } catch {
      // already detached
    }

    this.cleanupTab(tabId);
    console.log('[TraceLens/CDP] detached from tab', tabId);
  }

  isAttached(tabId: number): boolean {
    return this.attachedTabs.has(tabId);
  }

  /**
   * 消费最近一次点击的调用栈数据。
   * 从主世界的 window.__tracelens_click_stack__ 读取并清除。
   * 如果栈捕获尚未就绪，最多等待 500ms。
   */
  async consumeCapture(tabId: number): Promise<CdpCaptureResult | null> {
    // 先尝试读取已有捕获
    try {
      const readResult = await chrome.debugger.sendCommand(
        { tabId },
        'Runtime.evaluate',
        {
          expression: `
            (() => {
              const stack = window.${STACK_KEY};
              const time = window.${STACK_TIME_KEY};
              if (!stack || !time) return null;
              // 消费后立即清除，避免下次读到旧数据
              delete window.${STACK_KEY};
              delete window.${STACK_TIME_KEY};
              return { stack, time };
            })()
          `,
          returnByValue: true,
        },
      ) as { result?: { value?: { stack?: string[]; time?: number } | null } } | undefined;

      const value = readResult?.result?.value;
      if (value?.stack && Array.isArray(value.stack) && value.stack.length > 0) {
        return { frames: this.parseStackLines(value.stack), scopeVariables: [] };
      }
    } catch {
      // CDP 不可用
    }

    // 等待新的捕获
    return new Promise<CdpCaptureResult | null>((resolve) => {
      let resolved = false;

      const timer = setTimeout(() => {
        if (resolved) return;
        resolved = true;
        this.captureResolvers.delete(tabId);
        // 超时：最后试一次 Runtime.evaluate('new Error().stack') 作为兜底
        this.fallbackStack(tabId).then(resolve);
      }, CONSUME_TIMEOUT_MS);

      this.captureResolvers.set(tabId, (capture) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        resolve(capture);
      });
    });
  }

  // ===== 内部 =====

  private handleDebuggerEvent = (
    _source: chrome.debugger.Debuggee,
    _method: string,
    _params?: object,
  ): void => {
    // 当前不用 DOMDebugger 断点，此 listener 预留给未来扩展
  };

  private async fallbackStack(tabId: number): Promise<CdpCaptureResult | null> {
    try {
      const result = await chrome.debugger.sendCommand(
        { tabId },
        'Runtime.evaluate',
        {
          expression: '(() => { const e = new Error(); return e.stack || ""; })()',
          returnByValue: true,
        },
      ) as { result?: { value?: string } } | undefined;

      const stack: string | undefined = result?.result?.value;
      if (!stack) return null;

      const lines = stack.split('\n');
      return { frames: this.parseStackLines(lines), scopeVariables: [] };
    } catch {
      return null;
    }
  }

  private parseStackLines(lines: string[]): CdpStackFrame[] {
    const frames: CdpStackFrame[] = [];
    const re = /^\s*at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?$/;

    for (let i = 0; i < lines.length && frames.length < MAX_FRAMES; i++) {
      const m = lines[i].match(re);
      if (!m) continue;

      const [, funcName = '(anonymous)', url, line, col] = m;
      const lineNum = parseInt(line, 10);
      const colNum = parseInt(col, 10);
      if (isNaN(lineNum) || isNaN(colNum)) continue;

      if (
        url.startsWith('chrome-extension://') ||
        url.startsWith('extension://')
      ) continue;

      frames.push({
        functionName: funcName,
        url,
        lineNumber: lineNum,
        columnNumber: colNum,
      });
    }

    return frames;
  }

  private handleDetach = (
    source: chrome.debugger.Debuggee,
    _reason: string,
  ): void => {
    const tabId = source.tabId;
    if (typeof tabId !== 'number') return;
    this.cleanupTab(tabId);
    console.log('[TraceLens/CDP] detached from tab', tabId);
  };

  private cleanupTab(tabId: number): void {
    this.attachedTabs.delete(tabId);
    this.pendingCaptures.delete(tabId);
    const resolver = this.captureResolvers.get(tabId);
    if (resolver) {
      this.captureResolvers.delete(tabId);
      resolver(null);
    }
    this.emitDetach(tabId);
  }

  onDetach(listener: (tabId: number) => void): () => void {
    this.detachListeners.push(listener);
    return () => {
      this.detachListeners = this.detachListeners.filter((l) => l !== listener);
    };
  }

  private emitDetach(tabId: number): void {
    for (const l of this.detachListeners) {
      l(tabId);
    }
  }

  destroy(): void {
    if (this.eventListenerRegistered) {
      chrome.debugger.onEvent.removeListener(this.handleDebuggerEvent);
      this.eventListenerRegistered = false;
    }
    if (this.detachListenerRegistered) {
      chrome.debugger.onDetach.removeListener(this.handleDetach);
      this.detachListenerRegistered = false;
    }
    for (const tabId of this.attachedTabs.keys()) {
      chrome.debugger.detach({ tabId }).catch(() => {});
    }
    this.attachedTabs.clear();
    this.pendingCaptures.clear();
    for (const resolver of this.captureResolvers.values()) {
      resolver(null);
    }
    this.captureResolvers.clear();
  }
}

export const deepDiagnosis = new DeepDiagnosisManager();
