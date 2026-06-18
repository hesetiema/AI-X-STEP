// background/index.ts
// Service Worker 入口 —— 接收 popup 消息，调度 session-manager

import { sessionManager } from './session-manager';
import { tabRegistry } from './tab-registry';
import type { RuntimeMessage, UploadResult } from '@/shared/types';

// 处理来自 popup / sidepanel / content script 的消息
chrome.runtime.onMessage.addListener(
  (message: RuntimeMessage, sender, sendResponse) => {
    handleMessage(message, sender)
      .then((result) => sendResponse(result))
      .catch((err) => {
        const errMsg = err instanceof Error ? err.message : String(err);
        sendResponse({ ok: false, error: errMsg });
      });
    return true; // 异步响应
  },
);

async function handleMessage(message: RuntimeMessage, sender: chrome.runtime.MessageSender): Promise<unknown> {
  switch (message.type) {
    case 'GET_TAB_ID': {
      // content script 启动时请求自身 tabId（用于持久化 session 的 storage key）
      const tabId = sender.tab?.id;
      if (typeof tabId !== 'number') return { ok: false, error: 'no tab id' };
      return { ok: true, tabId };
    }
    case 'START_RECORDING': {
      const tabId = await resolveActiveTabId(message.tabId);
      await sessionManager.startRecording(tabId);
      return { ok: true, meta: tabRegistry.get(tabId) };
    }
    case 'STOP_RECORDING': {
      const tabId = await resolveActiveTabId(message.tabId);
      await sessionManager.stopRecording(tabId);
      return { ok: true, meta: tabRegistry.get(tabId) };
    }
    case 'UPLOAD_SESSION': {
      const tabId = await resolveActiveTabId(message.tabId);
      await sessionManager.stopRecording(tabId);
      const result: UploadResult = await sessionManager.collectAndUpload(tabId);
      return { ok: true, result, meta: tabRegistry.get(tabId) };
    }
    case 'GET_SESSION_STATUS': {
      const tabId = await resolveActiveTabId(message.tabId);
      const stats = await sessionManager.getStats(tabId);
      if (stats) tabRegistry.setStats(tabId, stats);
      return { ok: true, meta: tabRegistry.get(tabId) };
    }
    case 'GET_SESSION_STATS': {
      const tabId = await resolveActiveTabId(message.tabId);
      const stats = await sessionManager.getStats(tabId);
      return { ok: true, stats };
    }
    case 'FETCH_EVENTS': {
      // 转发给 content script，返回最新事件快照
      const tabId = await resolveActiveTabId(message.tabId);
      try {
        const response = await chrome.tabs.sendMessage(tabId, { type: 'FETCH_EVENTS' });
        return response ?? { ok: false, error: 'no response from content script' };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
    case 'RESUME_RECORDING': {
      const tabId = await resolveActiveTabId(message.tabId);
      await sessionManager.resumeRecording(tabId);
      return { ok: true, meta: tabRegistry.get(tabId) };
    }
    case 'INJECT_NETWORK_HOOK': {
      // content script 请求 background 在页面主世界注入网络 hook
      const tabId = await resolveActiveTabId(message.tabId);
      console.log('[TraceLens] injecting network hook into tab', tabId, 'main world');
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          world: 'MAIN',
          func: mainWorldNetworkHook,
        });
        console.log('[TraceLens] network hook injected successfully into tab', tabId);
        return { ok: true };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error('[TraceLens] network hook injection failed for tab', tabId, ':', errMsg);
        return { ok: false, error: errMsg };
      }
    }
    default:
      return { ok: false, error: 'unknown message type' };
  }
}

async function resolveActiveTabId(hint?: number): Promise<number> {
  if (typeof hint === 'number' && hint > 0) return hint;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('no active tab');
  return tab.id;
}

// 启用 sidePanel —— 点击插件图标切换侧边栏打开/关闭
chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch(() => undefined);
  }
});

console.log('[TraceLens] background service worker started');

// chrome.storage.session 默认仅扩展上下文（background/popup/sidepanel）可访问，
// content script 读不到。开启 TRUSTED_AND_UNTRUSTED_CONTEXTS 让 content script
// 也能直接读写 session storage（跨页持久化录制事件流依赖此能力）。
// setAccessLevel 是幂等的，SW 每次启动调用一次即可。
chrome.storage.session
  .setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' })
  .then(() => console.log('[TraceLens] storage.session access level opened for content scripts'))
  .catch((err) => console.warn('[TraceLens] setAccessLevel failed:', err));

/**
 * 注入到页面主世界的网络 hook 函数。
 * 通过 chrome.scripting.executeScript({ world: 'MAIN' }) 调用，
 * 绕过 CSP 对内联 <script> 的限制。
 *
 * hook fetch + XHR，通过 window.postMessage 将事件发回 content script。
 * 此函数会被 Chrome 序列化后在页面上下文执行，不能引用闭包变量。
 */
function mainWorldNetworkHook(): void {
  const HOOK_FLAG = '__TRACELENS_NET_HOOKED__';
  if ((window as unknown as Record<string, unknown>)[HOOK_FLAG]) {
    console.log('[TraceLens/MainWorld] hook already installed, skip');
    return;
  }
  (window as unknown as Record<string, unknown>)[HOOK_FLAG] = true;
  console.log('[TraceLens/MainWorld] installing network hooks (fetch + XHR)');

  const SOURCE = 'tracelens-main-world';
  const originalFetch = window.fetch.bind(window);
  const OrigXHR = window.XMLHttpRequest;
  const origOpen = OrigXHR.prototype.open;
  const origSend = OrigXHR.prototype.send;

  function genId(): string {
    return 'req_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function safeJson(text: string): unknown {
    try { return JSON.parse(text); } catch { return text; }
  }

  function postToContent(data: Record<string, unknown>): void {
    window.postMessage({ source: SOURCE, payload: data }, '*');
  }

  // ---- hook fetch ----
  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string' ? input : (input instanceof URL ? input.href : input.url);
    const method = ((init && init.method) || 'GET').toUpperCase();
    const requestId = genId();
    const startedAt = Date.now();
    console.log('[TraceLens/MainWorld] fetch intercepted:', method, url);

    let requestBody: unknown = null;
    if (init && init.body) {
      requestBody = typeof init.body === 'string' ? safeJson(init.body) : null;
    }

    try {
      const response = await originalFetch(input as RequestInfo, init);
      const endedAt = Date.now();
      const clone = response.clone();
      let responseBody: unknown;
      try {
        const text = await clone.text();
        responseBody = safeJson(text);
      } catch { responseBody = undefined; }
      postToContent({
        source: SOURCE, requestId, phase: 'response',
        method, url, status: response.status,
        startedAt, endedAt, durationMs: endedAt - startedAt,
        requestBody, responseBody,
      });
      return response;
    } catch (err) {
      const endAt = Date.now();
      postToContent({
        source: SOURCE, requestId, phase: 'error',
        method, url,
        startedAt, endedAt: endAt, durationMs: endAt - startedAt,
        requestBody,
        errorMessage: (err && (err as Error).message) ? (err as Error).message : String(err),
      });
      throw err;
    }
  };

  // ---- hook XHR ----
  OrigXHR.prototype.open = function (this: XMLHttpRequest, method: string, url: string | URL): void {
    (this as unknown as { __tl_meta?: { requestId: string; method: string; url: string; startedAt: number } }).__tl_meta = {
      requestId: genId(),
      method: (method || 'GET').toUpperCase(),
      url: String(url),
      startedAt: Date.now(),
    };
    return origOpen.apply(this, arguments as unknown as Parameters<typeof origOpen>);
  };

  OrigXHR.prototype.send = function (this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null): void {
    const meta = (this as unknown as { __tl_meta?: { requestId: string; method: string; url: string; startedAt: number; requestBody?: unknown } }).__tl_meta;
    if (!meta) return origSend.apply(this, arguments as unknown as Parameters<typeof origSend>);

    meta.requestBody = (typeof body === 'string') ? safeJson(body) : null;
    const self = this;

    this.addEventListener('loadend', function () {
      const endedAt = Date.now();
      let responseBody: unknown;
      try { responseBody = safeJson(self.responseText); } catch { responseBody = undefined; }
      postToContent({
        source: SOURCE, requestId: meta.requestId,
        phase: self.status === 0 ? 'error' : 'response',
        method: meta.method, url: meta.url, status: self.status || undefined,
        startedAt: meta.startedAt, endedAt, durationMs: endedAt - meta.startedAt,
        requestBody: meta.requestBody, responseBody,
        errorMessage: self.status === 0 ? 'network error' : undefined,
      });
    });

    return origSend.apply(this, arguments as unknown as [Document | XMLHttpRequestBodyInit | null]);
  };
}
