// content/init-window-tracker.ts
// 初始化窗口跟踪器 —— 管理页面初始化窗口生命周期，收集窗口内 NetworkInsight、
// 关键模块状态、页面症状，生成 InitPerfObservation[]。
//
// 职责边界：
//   负责：窗口开启/关闭、observation 生成、写入 autoObserve buffer
//   不负责：网络事件采集（network-observer）、CWV 采集（performance-observer）、归因结论（后端）

import type {
  InitWindow,
  InitPerfObservation,
  InitWindowTrigger,
  InitWindowEndReason,
  WindowedNetworkInsight,
  InitSymptomRecord,
  NetworkInsight,
  PerformanceEvent,
  PagePerfSummary,
} from '@/shared/types';
import { RECORDER_CONFIG } from '@/shared/constants';
import type { Recorder } from './recorder';

type WindowState = 'idle' | 'open' | 'closed';

interface InitWindowTrackerOptions {
  recorder: Recorder;
  onFirstScreenReady?: (event: PerformanceEvent, summary: PagePerfSummary) => void;
}

export class InitWindowTracker {
  private state: WindowState = 'idle';
  private currentWindow: InitWindow | null = null;
  private sequenceCounter = 0;
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  private debounceHandle: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly options: InitWindowTrackerOptions) {}

  start(): void {
    // 开始监听；窗口由 route_enter / bridge init_started / navigation 触发开启
  }

  stop(): void {
    this.closeWindow('timeout');
    if (this.debounceHandle !== null) {
      clearTimeout(this.debounceHandle);
      this.debounceHandle = null;
    }
  }

  // ---- 窗口触发 ----

  onRouteEnter(route: string, page: string): void {
    this.openWindow(page, route, 'route_enter');
  }

  onNavigationStart(page: string): void {
    this.openWindow(page, undefined, 'navigation');
  }

  onBridgeInitStarted(module: string, page: string): void {
    this.openWindow(page, module, 'bridge');
  }

  onBridgeInitCompleted(_module: string): void {
    if (this.state !== 'open') return;
    this.closeWindow('bridge_init_completed');
  }

  onBridgeModuleLoading(module: string, isCritical: boolean): void {
    if (this.state !== 'open' || !this.currentWindow) return;
    const existing = this.currentWindow.criticalModules.find((m) => m.module === module);
    if (existing) {
      if (existing.loadingStartedAt === undefined) existing.loadingStartedAt = Date.now();
      if (isCritical) existing.isCritical = true;
    } else {
      this.currentWindow.criticalModules.push({
        module,
        isCritical,
        loadingStartedAt: Date.now(),
        associatedRequestIds: [],
      });
    }
  }

  onBridgeModuleRendered(module: string, isCritical: boolean, itemCount?: number): void {
    if (this.state !== 'open' || !this.currentWindow) return;
    let mod = this.currentWindow.criticalModules.find((m) => m.module === module);
    if (!mod) {
      mod = { module, isCritical, associatedRequestIds: [] };
      this.currentWindow.criticalModules.push(mod);
    }
    mod.renderedAt = Date.now();
    mod.itemCount = itemCount;
    if (isCritical) mod.isCritical = true;

    this.checkCriticalModulesRendered();
  }

  // ---- 数据源订阅 ----

  onNetworkInsight(insight: NetworkInsight): void {
    if (this.state !== 'open' || !this.currentWindow) return;
    if (!this.currentWindow.completedAt) {
      const windowed: WindowedNetworkInsight = {
        insight,
        sequenceInWindow: this.sequenceCounter++,
        offsetFromWindowStartMs: Date.now() - this.currentWindow.startedAt,
        isCritical: false,
      };
      this.currentWindow.networkInsights.push(windowed);
    }
  }

  onSymptom(symptom: InitSymptomRecord['symptom'], module?: string, detail?: string): void {
    if (this.state !== 'open' || !this.currentWindow) return;
    this.currentWindow.symptoms.push({ symptom, module, timestamp: Date.now(), detail });
  }

  onFirstScreenReady(_event: PerformanceEvent, summary: PagePerfSummary): void {
    if (this.state !== 'open' || !this.currentWindow) return;
    this.currentWindow.pagePerf = summary;
    if (this.currentWindow.endReason === undefined) {
      this.closeWindow('first_screen_ready');
    }
  }

  // ---- 窗口管理 ----

  private openWindow(page: string, route: string | undefined, trigger: InitWindowTrigger): void {
    if (this.debounceHandle !== null) {
      clearTimeout(this.debounceHandle);
    }
    this.debounceHandle = setTimeout(() => {
      if (this.state === 'open') {
        this.closeWindow('timeout');
      }
      this.sequenceCounter = 0;
      this.currentWindow = {
        windowId: `init-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        page,
        route,
        startedAt: Date.now(),
        trigger,
        networkInsights: [],
        criticalModules: [],
        symptoms: [],
        observations: [],
      };
      this.state = 'open';

      this.timeoutHandle = setTimeout(() => {
        if (this.state === 'open') {
          this.closeWindow('timeout');
        }
      }, RECORDER_CONFIG.INIT_WINDOW_MAX_MS);

      this.debounceHandle = null;
    }, RECORDER_CONFIG.INIT_WINDOW_DEBOUNCE_MS);
  }

  private closeWindow(endReason: InitWindowEndReason): void {
    if (this.state !== 'open' || !this.currentWindow) return;

    if (this.timeoutHandle !== null) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }

    this.currentWindow.completedAt = Date.now();
    this.currentWindow.endReason = endReason;
    this.state = 'closed';

    this.currentWindow.observations = this.generateObservations();
    this.flushObservationsToRecorder();

    this.currentWindow = null;
    this.state = 'idle';
  }

  private checkCriticalModulesRendered(): void {
    if (this.state !== 'open' || !this.currentWindow) return;
    const criticalMods = this.currentWindow.criticalModules.filter((m) => m.isCritical);
    if (criticalMods.length === 0) return;
    if (criticalMods.every((m) => m.renderedAt !== undefined)) {
      this.closeWindow('critical_modules_rendered');
    }
  }

  // ---- Observation 生成 ----

  private generateObservations(): InitPerfObservation[] {
    if (!this.currentWindow) return [];
    const obs: InitPerfObservation[] = [];
    const w = this.currentWindow;

    obs.push({
      type: 'init_window_started',
      page: w.page,
      timestamp: w.startedAt,
      trigger: w.trigger,
    });

    obs.push({
      type: 'init_window_completed',
      page: w.page,
      startedAt: w.startedAt,
      completedAt: w.completedAt!,
      durationMs: w.completedAt! - w.startedAt,
      endReason: w.endReason!,
    });

    // R1/R2: slow requests
    for (const wn of w.networkInsights) {
      const dur = wn.insight.rawRef.durationMs ?? 0;
      if (dur >= RECORDER_CONFIG.TIMEOUT_REQUEST_MS) {
        obs.push({
          type: 'critical_request_slow',
          requestId: wn.insight.requestId,
          module: wn.insight.module,
          actionLabel: wn.insight.actionLabel,
          urlPattern: wn.insight.rawRef.urlPattern,
          durationMs: dur,
          threshold: RECORDER_CONFIG.TIMEOUT_REQUEST_MS,
        });
      } else if (dur >= RECORDER_CONFIG.SLOW_REQUEST_MS) {
        obs.push({
          type: 'critical_request_slow',
          requestId: wn.insight.requestId,
          module: wn.insight.module,
          actionLabel: wn.insight.actionLabel,
          urlPattern: wn.insight.rawRef.urlPattern,
          durationMs: dur,
          threshold: RECORDER_CONFIG.SLOW_REQUEST_MS,
        });
      }
    }

    // R6: failed requests
    for (const wn of w.networkInsights) {
      if (wn.insight.resultCategory === 'failed' || wn.insight.resultCategory === 'timeout') {
        obs.push({
          type: 'critical_request_failed',
          requestId: wn.insight.requestId,
          module: wn.insight.module,
          actionLabel: wn.insight.actionLabel,
          status: wn.insight.rawRef.status,
          errorMessage: wn.insight.responseText,
        });
      }
    }

    this.detectSerialDependency(w, obs);
    this.detectFrontendSettleGap(w, obs);
    this.detectDuplicateRequests(w, obs);

    for (const s of w.symptoms) {
      obs.push({
        type: 'init_symptom',
        symptom: s.symptom,
        module: s.module,
        timestamp: s.timestamp,
        detail: s.detail,
      });
    }

    return obs;
  }

  private detectSerialDependency(w: InitWindow, obs: InitPerfObservation[]): void {
    if (w.networkInsights.length < 2) return;
    const sorted = [...w.networkInsights].sort(
      (a, b) => a.offsetFromWindowStartMs - b.offsetFromWindowStartMs,
    );
    const chain: typeof sorted = [];
    for (const wn of sorted) {
      if (chain.length === 0) {
        chain.push(wn);
        continue;
      }
      const prev = chain[chain.length - 1];
      const prevDur = prev.insight.rawRef.durationMs ?? 0;
      if (wn.offsetFromWindowStartMs >= prev.offsetFromWindowStartMs + prevDur * 0.8) {
        chain.push(wn);
      }
    }
    if (chain.length >= 2) {
      const totalDuration = w.completedAt! - w.startedAt;
      const sumDuration = chain.reduce(
        (sum, wn) => sum + (wn.insight.rawRef.durationMs ?? 0),
        0,
      );
      if (sumDuration >= totalDuration * 0.7) {
        obs.push({
          type: 'init_serial_dependency_detected',
          chainRequestIds: chain.map((wn) => wn.insight.requestId),
          chainActionLabels: chain.map((wn) => wn.insight.actionLabel),
          totalDurationMs: totalDuration,
          sumDurationMs: sumDuration,
        });
      }
    }
  }

  private detectFrontendSettleGap(w: InitWindow, obs: InitPerfObservation[]): void {
    const criticalRendered = w.criticalModules.filter(
      (m) => m.isCritical && m.renderedAt !== undefined,
    );
    if (criticalRendered.length === 0 || w.networkInsights.length === 0) return;

    const lastCriticalRequestEnd = Math.max(
      ...w.networkInsights.map(
        (wn) => wn.offsetFromWindowStartMs + (wn.insight.rawRef.durationMs ?? 0),
      ),
    );
    const lastCriticalRequestAbs = w.startedAt + lastCriticalRequestEnd;
    const firstRendered = Math.min(...criticalRendered.map((m) => m.renderedAt!));
    const finalRendered = Math.max(...criticalRendered.map((m) => m.renderedAt!));
    const gap = finalRendered - lastCriticalRequestAbs;

    if (gap >= RECORDER_CONFIG.FRONTEND_SETTLE_GAP_MS) {
      obs.push({
        type: 'frontend_settle_gap_large',
        gapMs: gap,
        lastCriticalRequestEndAt: lastCriticalRequestAbs,
        firstCriticalModuleRenderedAt: firstRendered,
        finalCriticalModuleRenderedAt: finalRendered,
      });
    }
  }

  private detectDuplicateRequests(w: InitWindow, obs: InitPerfObservation[]): void {
    const byPattern = new Map<string, { ids: string[]; times: number[] }>();
    for (const wn of w.networkInsights) {
      const pattern = wn.insight.rawRef.urlPattern;
      const entry = byPattern.get(pattern) ?? { ids: [], times: [] };
      entry.ids.push(wn.insight.requestId);
      entry.times.push(wn.offsetFromWindowStartMs);
      byPattern.set(pattern, entry);
    }
    for (const [pattern, entry] of byPattern) {
      if (entry.ids.length >= RECORDER_CONFIG.DUPLICATE_REQUEST_COUNT) {
        const span = Math.max(...entry.times) - Math.min(...entry.times);
        if (span <= RECORDER_CONFIG.DUPLICATE_REQUEST_WINDOW_MS * entry.ids.length) {
          obs.push({
            type: 'duplicate_request_in_init',
            urlPattern: pattern,
            requestIds: entry.ids,
            count: entry.ids.length,
            windowMs: span,
          });
        }
      }
    }
  }

  // ---- 输出 ----

  private flushObservationsToRecorder(): void {
    if (!this.currentWindow) return;
    for (const o of this.currentWindow.observations) {
      this.options.recorder.appendAutoObserve({
        kind: 'observation',
        observationType: 'module_loading_too_long',
        detail: { initObservation: o },
      });
    }
  }

  getCurrentWindow(): InitWindow | null {
    return this.currentWindow;
  }
}

let instance: InitWindowTracker | null = null;

export function getInitWindowTracker(): InitWindowTracker | null {
  return instance;
}

export function setInitWindowTracker(tracker: InitWindowTracker): void {
  instance = tracker;
}
