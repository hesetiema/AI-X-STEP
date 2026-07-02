// background/slow-api-monitor.ts
// 慢接口监控 —— 基于 chrome.webRequest API 捕获慢响应和 pending 请求
//
// 优势（相比 main world hook）：
// - 浏览器级拦截，捕获所有请求（含 iframe、worker）
// - 不被页面脚本干扰
// - 不需要 content script 参与
// - 无 debugger infobar

import { RECORDER_CONFIG } from '@/shared/constants';
import type { SlowApiInfo } from '@/shared/types';

interface InFlightRequest {
  requestId: string;
  url: string;
  method: string;
  startedAt: number;
  notifiedPending: boolean;
}

class SlowApiMonitor {
  private monitoring = false;
  private targetTabId: number | null = null;
  private inFlight = new Map<string, InFlightRequest>();
  private pendingTimer: ReturnType<typeof setInterval> | null = null;

  private onBeforeRequest = (
    details: chrome.webRequest.WebRequestBodyDetails,
  ): void => {
    if (!this.monitoring) return;
    if (this.targetTabId !== null && details.tabId !== this.targetTabId) return;
    if (details.method === 'OPTIONS') return;
    if (details.url.includes('/sse/')) return;

    this.inFlight.set(details.requestId, {
      requestId: details.requestId,
      url: details.url,
      method: details.method,
      startedAt: details.timeStamp,
      notifiedPending: false,
    });
  };

  private onCompleted = (
    details: chrome.webRequest.WebResponseCacheDetails & {
      statusCode: number;
    },
  ): void => {
    if (!this.monitoring) return;
    if (this.targetTabId !== null && details.tabId !== this.targetTabId) return;

    const req = this.inFlight.get(details.requestId);
    if (!req) return;
    this.inFlight.delete(details.requestId);

    const durationMs = details.timeStamp - req.startedAt;
    if (durationMs < RECORDER_CONFIG.SLOW_API_THRESHOLD_MS) return;

    const isServerError = details.statusCode >= 500;
    const isTimeout = details.statusCode === 0 || details.statusCode === 408 || details.statusCode === 504;

    this.notify({
      requestId: req.requestId,
      url: req.url,
      method: req.method,
      durationMs,
      status: details.statusCode,
      phase: isTimeout ? 'timeout' : isServerError ? 'error' : 'slow',
      startedAt: req.startedAt,
    });
  };

  private onErrorOccurred = (
    details: chrome.webRequest.WebResponseErrorDetails,
  ): void => {
    if (!this.monitoring) return;
    if (this.targetTabId !== null && details.tabId !== this.targetTabId) return;

    const req = this.inFlight.get(details.requestId);
    if (!req) return;
    this.inFlight.delete(details.requestId);

    const durationMs = details.timeStamp - req.startedAt;
    this.notify({
      requestId: req.requestId,
      url: req.url,
      method: req.method,
      durationMs,
      phase: 'error',
      startedAt: req.startedAt,
    });
  };

  private checkPending = (): void => {
    if (!this.monitoring) return;
    const now = Date.now();

    for (const req of this.inFlight.values()) {
      if (req.notifiedPending) continue;
      const elapsed = now - req.startedAt;
      if (elapsed >= RECORDER_CONFIG.PENDING_API_THRESHOLD_MS) {
        req.notifiedPending = true;
        this.notify({
          requestId: req.requestId,
          url: req.url,
          method: req.method,
          durationMs: elapsed,
          phase: 'pending',
          startedAt: req.startedAt,
        });
      }
    }
  };

  private notify(api: SlowApiInfo): void {
    chrome.runtime
      .sendMessage({ type: 'SLOW_API_UPDATE', tabId: this.targetTabId ?? 0, api })
      .catch(() => {});
  }

  start(tabId: number): void {
    if (this.monitoring) this.stop();
    this.monitoring = true;
    this.targetTabId = tabId;
    this.inFlight.clear();

    chrome.webRequest.onBeforeRequest.addListener(this.onBeforeRequest, {
      tabId,
      urls: ['<all_urls>'],
      types: ['xmlhttprequest'],
    });
    chrome.webRequest.onCompleted.addListener(this.onCompleted, {
      tabId,
      urls: ['<all_urls>'],
      types: ['xmlhttprequest'],
    });
    chrome.webRequest.onErrorOccurred.addListener(this.onErrorOccurred, {
      tabId,
      urls: ['<all_urls>'],
      types: ['xmlhttprequest'],
    });

    this.pendingTimer = setInterval(
      this.checkPending,
      RECORDER_CONFIG.PENDING_CHECK_INTERVAL_MS,
    );
  }

  stop(): void {
    if (!this.monitoring) return;
    this.monitoring = false;

    chrome.webRequest.onBeforeRequest.removeListener(this.onBeforeRequest);
    chrome.webRequest.onCompleted.removeListener(this.onCompleted);
    chrome.webRequest.onErrorOccurred.removeListener(this.onErrorOccurred);

    if (this.pendingTimer !== null) {
      clearInterval(this.pendingTimer);
      this.pendingTimer = null;
    }
    this.inFlight.clear();
    this.targetTabId = null;
  }

  isMonitoring(): boolean {
    return this.monitoring;
  }
}

export const slowApiMonitor = new SlowApiMonitor();
