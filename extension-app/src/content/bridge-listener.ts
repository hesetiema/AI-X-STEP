// content/bridge-listener.ts
// 页面轻桥接监听器 —— 监听 window.__DIAGNOSIS_CONTEXT__ 和自定义事件

import { BRIDGE_CONTEXT_KEY, BRIDGE_EVENT_NAMES } from '@/shared/constants';
import type { Recorder } from './recorder';
import { getInitWindowTracker } from './init-window-tracker';

export class BridgeListener {
  private contextHandler: (() => void) | null = null;
  private interactionHandler: ((e: CustomEvent) => void) | null = null;
  private stateHandler: ((e: CustomEvent) => void) | null = null;
  private lastContext: Record<string, unknown> | null = null;

  constructor(private readonly recorder: Recorder) {}

  start(): void {
    if (this.contextHandler) return;

    // 监听 __DIAGNOSIS_CONTEXT__ 变化
    this.observeContext();

    // 监听自定义事件
    this.interactionHandler = (e: CustomEvent) => {
      const detail = e.detail as Record<string, unknown> | undefined;
      this.emitBridge('interaction', {
        businessAction: detail?.businessAction as string | undefined,
        module: detail?.module as string | undefined,
        detail,
      });
    };
    this.stateHandler = (e: CustomEvent) => {
      const detail = e.detail as Record<string, unknown> | undefined;
      const tracker = getInitWindowTracker();
      if (tracker && detail) {
        const stateType = detail.stateType as string | undefined;
        const module = detail.module as string | undefined;
        if (stateType === 'init_started' && module) {
          tracker.onBridgeInitStarted(module, location.href);
        } else if (stateType === 'init_completed' && module) {
          tracker.onBridgeInitCompleted(module);
        } else if (stateType === 'loading' && module) {
          tracker.onBridgeModuleLoading(module, detail.isCritical === true);
        } else if (stateType === 'rendered' && module) {
          tracker.onBridgeModuleRendered(
            module,
            detail.isCritical === true,
            detail.itemCount as number | undefined,
          );
        }
      }
      this.emitBridge('state', {
        stateType: detail?.stateType as string | undefined,
        module: detail?.module as string | undefined,
        detail,
      });
    };
    window.addEventListener(BRIDGE_EVENT_NAMES.INTERACTION, this.interactionHandler as EventListener);
    window.addEventListener(BRIDGE_EVENT_NAMES.STATE, this.stateHandler as EventListener);
  }

  stop(): void {
    if (this.contextHandler) {
      this.contextHandler();
      this.contextHandler = null;
    }
    if (this.interactionHandler) {
      window.removeEventListener(BRIDGE_EVENT_NAMES.INTERACTION, this.interactionHandler as EventListener);
      this.interactionHandler = null;
    }
    if (this.stateHandler) {
      window.removeEventListener(BRIDGE_EVENT_NAMES.STATE, this.stateHandler as EventListener);
      this.stateHandler = null;
    }
  }

  private observeContext(): void {
    let lastJson = '';
    this.contextHandler = () => {
      const ctx = window[BRIDGE_CONTEXT_KEY];
      const json = ctx ? JSON.stringify(ctx) : '';
      if (json === lastJson) return;
      lastJson = json;
      this.lastContext = ctx ? { ...ctx } : null;
      this.emitBridge('context', { detail: this.lastContext ?? undefined });
    };
    this.contextHandler();
  }

  private emitBridge(
    bridgeType: 'context' | 'interaction' | 'state',
    extra: { detail?: Record<string, unknown>; businessAction?: string; module?: string; stateType?: string },
  ): void {
    if (!this.recorder.isActive) return;
    this.recorder.append({
      kind: 'bridge',
      bridgeType,
      ...extra,
    });
  }
}
