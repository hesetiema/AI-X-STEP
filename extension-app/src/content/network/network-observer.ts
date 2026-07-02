// content/network/network-observer.ts
// 网络监听 —— 通过 background 在页面主世界（Main World）注入 hook 函数，
// hook fetch/XHR，再通过 postMessage 将事件传回 content script（隔离世界）。
//
// 背景：content script 运行在隔离世界，直接 hook window.fetch 拦截不到
// 页面真实请求。注入主世界需要用 chrome.scripting.executeScript({world:'MAIN'})，
// 该 API 只能在 background 调用，因此 content script 请求 background 注入。
// 不能用内联 <script> 标签，会被页面 CSP 拦截。

import type {
  RawNetworkEvent,
  NetworkInsight,
  InsightBuildContext,
  NetworkEvent,
} from '@/shared/types';
import type { Recorder } from '../recorder';
import { sanitizeNetworkEvent } from './network-sanitizer';
import { normalizeNetworkEvent } from './network-normalizer';
import { InMemoryMappingRegistry } from './mapping-registry';
import { defaultMappings } from './default-mappings';
import { DefaultNetworkInsightTransformer } from './network-insight-transformer';
import { apiResponseCache } from '../api-response-cache';

const MESSAGE_SOURCE = 'tracelens-main-world';

import { getInitWindowTracker } from '../init-window-tracker';

interface MainWorldNetworkEvent {
  source: string;
  requestId: string;
  phase: 'request' | 'response' | 'error';
  method: string;
  url: string;
  status?: number;
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  requestBody?: unknown;
  responseBody?: unknown;
  errorMessage?: string;
}

export class NetworkObserver {
  private hookRequested = false;
  private messageHandler: ((e: MessageEvent) => void) | null = null;
  private readonly registry = new InMemoryMappingRegistry();
  private readonly transformer = new DefaultNetworkInsightTransformer(this.registry);

  constructor(private readonly recorder: Recorder) {
    this.registry.register(defaultMappings);
  }

  start(): void {
    if (this.messageHandler) return;
    this.requestMainWorldInjection();
    this.installMessageListener();
  }

  stop(): void {
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler);
      this.messageHandler = null;
    }
    // 主世界 hook 在页面刷新后自动清除，这里只停止 content script 侧监听
  }

  /**
   * 请求 background 通过 chrome.scripting.executeScript({ world: 'MAIN' })
   * 在页面主世界注入网络 hook。这绕过了 CSP 对内联 <script> 的限制。
   */
  private requestMainWorldInjection(): void {
    if (this.hookRequested) return;
    this.hookRequested = true;
    console.log('[TraceLens] requesting main world network hook injection');
    chrome.runtime.sendMessage({ type: 'INJECT_NETWORK_HOOK' })
      .then((res) => {
        if (res && res.ok) {
          console.log('[TraceLens] hook injection succeeded');
        } else {
          console.warn('[TraceLens] hook injection returned error:', res?.error ?? 'unknown');
        }
      })
      .catch((err) => console.error('[TraceLens] hook injection failed:', err));
  }

  private installMessageListener(): void {
    this.messageHandler = (e: MessageEvent) => {
      // 注意：不能检查 e.source !== window。content script 运行在 isolated world，
      // 而 main world hook 通过 window.postMessage 发回事件，两个 world 的 window 引用不同。
      // 只需通过 MESSAGE_SOURCE string guard 过滤即可。
      const data = e.data as { source?: string; payload?: MainWorldNetworkEvent } | null;
      if (!data || data.source !== MESSAGE_SOURCE) return;
      if (!data.payload) return;
      console.log('[TraceLens] received network event from main world:', data.payload.method, data.payload.url, data.payload.phase);
      this.processMainWorldEvent(data.payload);
    };
    window.addEventListener('message', this.messageHandler);
    console.log('[TraceLens] message listener installed for network events');
  }

  private processMainWorldEvent(evt: MainWorldNetworkEvent): void {
    const raw: RawNetworkEvent = {
      source: 'fetch',
      phase: evt.phase,
      requestId: evt.requestId,
      method: evt.method,
      url: evt.url,
      status: evt.status,
      startedAt: evt.startedAt,
      endedAt: evt.endedAt,
      durationMs: evt.durationMs,
      requestBody: evt.requestBody,
      responseBody: evt.responseBody,
      errorMessage: evt.errorMessage,
    };

    const sanitized = sanitizeNetworkEvent(raw);
    const normalized = normalizeNetworkEvent(sanitized);

    // Populate API response cache for Pipeline runner field extraction
    if ((raw.phase === 'response' || raw.phase === 'error') && raw.responseBody !== undefined) {
      apiResponseCache.set(raw.method, raw.url, sanitized.urlPattern, raw.responseBody);
    }

    let insight: NetworkInsight | undefined;
    if (raw.phase !== 'request') {
      const ctx: InsightBuildContext = { event: normalized };
      insight = this.transformer.transform(ctx);
    }

    // 通知 init-window-tracker（始终触发，不依赖录制状态）
    if (insight) {
      const tracker = getInitWindowTracker();
      if (tracker) tracker.onNetworkInsight(insight);
    }

    // 构建网络事件（供 autoObserve + 手动 buffer 共用）
    const event: Omit<NetworkEvent, 'eventId' | 'occurredAt' | 'tabId'> = {
      kind: 'network',
      requestId: normalized.requestId,
      phase: raw.phase,
      method: normalized.method,
      url: normalized.url,
      status: normalized.status,
      durationMs: normalized.durationMs,
      errorMessage: normalized.errorMessage,
      insight: insight
        ? {
            actionLabel: insight.actionLabel,
            resultCategory: insight.resultCategory,
            requestText: insight.requestText,
            responseText: insight.responseText,
            module: insight.module,
          }
        : undefined,
    };

    // 写入 autoObserve buffer（始终写入，供一键诊断消费）
    this.recorder.appendAutoObserve(event);

    // 写入手动 buffer（仅在录制时）
    if (!this.recorder.isActive) return;
    this.recorder.append(event);
  }
}
