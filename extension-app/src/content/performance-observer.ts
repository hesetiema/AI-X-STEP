// content/performance-observer.ts
// 页面加载性能采集 —— 基于 PerformanceObserver 自动捕获 Core Web Vitals + 首屏 API，
// 通过 MutationObserver 稳定间隙检测判定"首屏就绪"，发 PerformanceEvent 到 Recorder。
//
// 与 manual recording 解耦：始终通过 Recorder.appendAutoObserve() 写入，不依赖 isActive。

import type { PerformanceEvent, FirstScreenApiSummary } from '@/shared/types';
import type { Recorder } from './recorder';
import { RECORDER_CONFIG } from '@/shared/constants';
import { buildPagePerfSummary, notifyPerfUpdate } from './perf-bridge';
import type { PerformanceEvent as PerfEventType, PagePerfSummary } from '@/shared/types';

const MESSAGE_SOURCE = 'tracelens-main-world';

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
  errorMessage?: string;
}

interface TrackedApi {
  url: string;
  method: string;
  startedAt: number;       // 绝对 unix ms
  durationMs: number;
  status?: number;
  phaseDerived: FirstScreenApiSummary['phaseDerived'];
}

export class PerformanceObserver_ {
  private observer: globalThis.PerformanceObserver | null = null;
  private readonly startedAt = Date.now();

  private lcpValue = 0;
  private fcpValue = 0;
  private ttfbValue = 0;
  private clsValue = 0;
  private domContentLoaded = 0;
  private loadComplete = 0;
  private navigationalType: PerformanceEvent['navigationalType'] = 'navigate';

  private trackedApis: TrackedApi[] = [];
  private apiTrackingTimer: ReturnType<typeof setTimeout> | null = null;
  private firstScreenEmitted = false;

  private mutationObserver: MutationObserver | null = null;
  private lastMutationTime = 0;
  private stableCheckTimer: ReturnType<typeof setTimeout> | null = null;

  private messageHandler: ((e: MessageEvent) => void) | null = null;

  constructor(
    private readonly recorder: Recorder,
    private readonly onFirstScreenReady?: (event: PerfEventType, summary: PagePerfSummary) => void,
  ) {}

  /** 路由变化时重置指标，重新采集新页面的性能数据 */
  onRouteChange(): void {
    if (!this.firstScreenEmitted) return;
    this.resetMetrics();
    this.startStableGapDetection();
    this.scheduleFallbackEmit();
  }

  private resetMetrics(): void {
    this.firstScreenEmitted = false;
    this.lcpValue = 0;
    this.fcpValue = 0;
    this.ttfbValue = 0;
    this.clsValue = 0;
    this.domContentLoaded = 0;
    this.loadComplete = 0;
    this.trackedApis = [];
    this.lastMutationTime = Date.now();
    this.captureNavigationTiming();
  }

  start(): void {
    if (this.observer) return;
    this.firstScreenEmitted = false;

    this.captureNavigationTiming();

    try {
      this.observer = new globalThis.PerformanceObserver((list) => {
        for (const entry of list.getEntries()) this.handleTimingEntry(entry);
      });
      this.observer.observe({ type: 'paint', buffered: true });
      this.observer.observe({ type: 'largest-contentful-paint', buffered: true });
      try {
        this.observer.observe({ type: 'layout-shift', buffered: true });
      } catch { /* not all browsers support layout-shift in PerformanceObserver */ }
    } catch {
      console.warn('[TraceLens] PerformanceObserver not supported');
    }

    this.installApiListener();
    this.startStableGapDetection();
    this.scheduleFallbackEmit();
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    if (this.apiTrackingTimer !== null) { clearTimeout(this.apiTrackingTimer); this.apiTrackingTimer = null; }
    if (this.stableCheckTimer !== null) { clearTimeout(this.stableCheckTimer); this.stableCheckTimer = null; }
    this.mutationObserver?.disconnect();
    this.mutationObserver = null;
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler);
      this.messageHandler = null;
    }
  }

  private captureNavigationTiming(): void {
    const entry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (!entry) return;

    this.ttfbValue = entry.responseStart - entry.requestStart;
    this.domContentLoaded = entry.domContentLoadedEventEnd;
    this.loadComplete = entry.loadEventEnd;

    switch (entry.type) {
      case 'reload': this.navigationalType = 'reload'; break;
      case 'back_forward': this.navigationalType = 'back_forward'; break;
      case 'prerender': this.navigationalType = 'prerender'; break;
      default: this.navigationalType = 'navigate';
    }
  }

  private handleTimingEntry(entry: PerformanceEntry): void {
    switch (entry.entryType) {
      case 'paint': {
        if (entry.name === 'first-contentful-paint') {
          this.fcpValue = entry.startTime;
        }
        break;
      }
      case 'largest-contentful-paint': {
        this.lcpValue = entry.startTime;
        break;
      }
      case 'layout-shift': {
        const ls = entry as unknown as { hadRecentInput?: boolean; value: number };
        if (ls.hadRecentInput !== true) {
          this.clsValue += ls.value;
        }
        break;
      }
    }
  }

  private installApiListener(): void {
    this.messageHandler = (e: MessageEvent) => {
      const data = e.data as { source?: string; payload?: MainWorldNetworkEvent } | null;
      if (!data || data.source !== MESSAGE_SOURCE) return;
      if (!data.payload) return;
      this.processApiEvent(data.payload);
    };
    window.addEventListener('message', this.messageHandler);
  }

  private processApiEvent(evt: MainWorldNetworkEvent): void {
    if (this.firstScreenEmitted) return;
    if (evt.phase === 'response' || evt.phase === 'error') {
      if (this.trackedApis.length >= RECORDER_CONFIG.MAX_FIRST_SCREEN_APIS) return;

      const phaseDerived: FirstScreenApiSummary['phaseDerived'] =
        evt.phase === 'error' ? 'error'
        : evt.status != null && evt.status >= 500 ? 'timeout'
        : evt.durationMs != null && evt.durationMs > RECORDER_CONFIG.LONG_API_DURATION_MS ? 'slow'
        : 'normal';

      this.trackedApis.push({
        url: evt.url,
        method: evt.method,
        startedAt: evt.startedAt,
        durationMs: evt.durationMs ?? 0,
        status: evt.status,
        phaseDerived,
      });
    }
  }

  private startStableGapDetection(): void {
    this.mutationObserver = new MutationObserver(() => {
      this.lastMutationTime = Date.now();
    });
    if (document.body) {
      this.mutationObserver.observe(document.body, { childList: true, subtree: true });
    }
    this.scheduleStableCheck();
  }

  private scheduleStableCheck(): void {
    const elapsed = Date.now() - this.startedAt;
    const gap = RECORDER_CONFIG.FIRST_SCREEN_STABLE_GAP_MS;
    this.stableCheckTimer = setTimeout(() => {
      const sinceLastMutation = Date.now() - this.lastMutationTime;
      if ((this.lastMutationTime === 0 && elapsed >= gap) || sinceLastMutation >= gap) {
        this.emitFirstScreenComplete();
      } else {
        this.scheduleStableCheck();
      }
    }, gap);
  }

  private scheduleFallbackEmit(): void {
    this.apiTrackingTimer = setTimeout(() => {
      this.emitFirstScreenComplete();
    }, RECORDER_CONFIG.FIRST_SCREEN_API_TIMEOUT_MS);
  }

  private emitFirstScreenComplete(): void {
    if (this.firstScreenEmitted) return;
    this.firstScreenEmitted = true;

    if (this.apiTrackingTimer !== null) { clearTimeout(this.apiTrackingTimer); this.apiTrackingTimer = null; }
    if (this.stableCheckTimer !== null) { clearTimeout(this.stableCheckTimer); this.stableCheckTimer = null; }

    const maxApiEndTime = this.trackedApis.reduce(
      (max, a) => Math.max(max, a.startedAt + a.durationMs),
      0,
    );
    const lastApiEndMs = this.trackedApis.length > 0
      ? maxApiEndTime - (this.startedAt - performance.timeOrigin)
      : undefined;
    const firstScreenReadyMs = Math.max(
      this.lcpValue,
      maxApiEndTime - (this.startedAt - performance.timeOrigin),
      this.domContentLoaded,
    );

    const observations: string[] = [];
    if (this.lcpValue >= RECORDER_CONFIG.SLOW_LCP_THRESHOLD_MS) observations.push('slow_lcp');
    if (this.fcpValue >= RECORDER_CONFIG.SLOW_FCP_THRESHOLD_MS) observations.push('slow_fcp');
    if (this.ttfbValue >= RECORDER_CONFIG.SLOW_TTFB_THRESHOLD_MS) observations.push('slow_ttfb');
    if (this.clsValue >= RECORDER_CONFIG.HIGH_CLS_THRESHOLD) observations.push('high_cls');
    if (this.trackedApis.some((a) => a.phaseDerived === 'slow')) observations.push('slow_api');

    const apis: FirstScreenApiSummary[] = this.trackedApis.map((a) => ({
      url: a.url,
      method: a.method,
      status: a.status,
      startedAt: a.startedAt - this.startedAt,
      durationMs: a.durationMs,
      phaseDerived: a.phaseDerived,
      isBlocking: (a.startedAt + a.durationMs) >= firstScreenReadyMs,
    }));

    const event: Omit<PerformanceEvent, 'eventId' | 'occurredAt' | 'tabId'> = {
      kind: 'performance',
      perfType: 'first_screen_complete',
      pageUrl: location.href,
      timing: {
        fcp: this.fcpValue || undefined,
        lcp: this.lcpValue || undefined,
        ttfb: this.ttfbValue || undefined,
        cls: this.clsValue || undefined,
        domContentLoaded: this.domContentLoaded || undefined,
        loadComplete: this.loadComplete || undefined,
        firstScreenReadyMs: firstScreenReadyMs || undefined,
        lastApiEndMs: lastApiEndMs,
        observations: observations.length > 0 ? observations : undefined,
      },
      firstScreenApis: apis.length > 0 ? apis : undefined,
      navigationalType: this.navigationalType,
    };

    // 始终通过 auto-observe 写入，不依赖 manual recording
    this.recorder.appendAutoObserve(event);

    // 构造完整 PerformanceEvent（补齐 BaseProbeEvent 字段）供 perf-bridge 使用
    const perfEvent: PerfEventType = {
      ...event,
      eventId: '',
      occurredAt: Date.now(),
      tabId: 0,
    };
    const summary = buildPagePerfSummary(perfEvent);

    // 通知 init-window-tracker（窗口结束兜底信号）
    if (this.onFirstScreenReady) {
      this.onFirstScreenReady(perfEvent, summary);
    }

    // 发送 PERF_UPDATE 到 background → sidepanel（修复死链）
    const tabId = this.recorder['lastTabId'] ?? this.recorder['autoTabId'] ?? 0;
    notifyPerfUpdate(summary, tabId);
  }
}
