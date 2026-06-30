# 页面初始化接口性能排查 + 诊断流程完善 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 extension-app 中实现功能A（页面初始化接口性能排查，Phase 1+2）和功能B（手动录制诊断流程完善），使 SidePanel 能自动检测页面初始化慢并提示一键诊断。

**Architecture:** 新建 `init-window-tracker` 模块管理初始化窗口，复用 NetworkInsight 管线统一接口业务语义；新建 `perf-bridge` 打通 PerformanceEvent → PagePerfSummary → PERF_UPDATE 死链；让 NetworkInsight 写入 autoObserve buffer 供一键诊断消费；修改各 observer 在 isActive guard 之前通知 init-window-tracker。

**Tech Stack:** TypeScript 5.5, React 18, Chrome Extension MV3, CRXJS/Vite, Zustand. 无测试框架——验证用 `npx tsc --noEmit`。

**Verification command:** `npx tsc --noEmit` (in extension-app/)

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/shared/types/init-perf.ts` | Create | InitWindow, InitPerfObservation, CriticalModuleState, InitSymptomRecord types |
| `src/shared/types/probe-event.ts` | Modify | Widen `perfType` to union; add `initWindowId` |
| `src/shared/types/runtime-message.ts` | Modify | Add `FETCH_INIT_WINDOW` / `INIT_WINDOW_RESULT` messages |
| `src/shared/types/index.ts` | Modify | Re-export init-perf types |
| `src/shared/constants/config.ts` | Modify | Add init-window thresholds |
| `src/shared/constants/event-types.ts` | Modify | Add `init_observation` to EVIDENCE_TYPE_MAP |
| `src/content/perf-bridge.ts` | Create | PerformanceEvent → PagePerfSummary → PERF_UPDATE |
| `src/content/init-window-tracker.ts` | Create | Init window lifecycle + observation generation |
| `src/content/performance-observer.ts` | Modify | Notify perf-bridge + init-window-tracker on first-screen-ready |
| `src/content/network/network-observer.ts` | Modify | Notify init-window-tracker + write autoObserve before isActive guard |
| `src/content/route-observer.ts` | Modify | Notify init-window-tracker before isActive guard |
| `src/content/bridge-listener.ts` | Modify | Notify init-window-tracker before isActive guard |
| `src/content/ui-symptom-detector.ts` | Modify | Notify init-window-tracker before isActive guard |
| `src/content/recorder.ts` | Modify | Expose `getInitWindow()` / `setInitWindowTracker()` |
| `src/content/index.ts` | Modify | Instantiate + wire init-window-tracker; handle FETCH_INIT_WINDOW |
| `src/background/index.ts` | Modify | DIAGNOSE_PAGE_LOAD fetches init observations |
| `src/background/session-mapper.ts` | Modify | `mapInitObservationsToEvidence()` |
| `src/sidepanel/components/PagePerfIndicator.tsx` | Modify | Enhance UI: diagnosing/done states |
| `src/page-bridge/index.ts` | Modify | Add `emitInitStarted` / `emitInitCompleted` / `emitModuleLoading` / `emitModuleRendered` |
| `src/sidepanel/components/StatusBar.tsx` | Delete | Dead code |
| `src/sidepanel/components/ContextSummary.tsx` | Delete | Dead code |

---

## Task 1: Init-perf types + config thresholds

**Files:**
- Create: `src/shared/types/init-perf.ts`
- Modify: `src/shared/types/index.ts`
- Modify: `src/shared/constants/config.ts`

- [ ] **Step 1: Create `src/shared/types/init-perf.ts`**

```ts
// shared/types/init-perf.ts
// 初始化接口性能诊断的类型定义

import type { NetworkInsight } from './network';
import type { PagePerfSummary } from './runtime-message';

export type InitWindowTrigger = 'bridge' | 'route_enter' | 'navigation';
export type InitWindowEndReason =
  | 'bridge_init_completed'
  | 'critical_modules_rendered'
  | 'first_screen_ready'
  | 'timeout';

export type InitPerfObservation =
  | {
      type: 'init_window_started';
      page: string;
      timestamp: number;
      trigger: InitWindowTrigger;
    }
  | {
      type: 'init_window_completed';
      page: string;
      startedAt: number;
      completedAt: number;
      durationMs: number;
      endReason: InitWindowEndReason;
    }
  | {
      type: 'critical_request_slow';
      requestId: string;
      module?: string;
      actionLabel: string;
      urlPattern: string;
      durationMs: number;
      threshold: number;
    }
  | {
      type: 'critical_request_failed';
      requestId: string;
      module?: string;
      actionLabel: string;
      status?: number;
      errorMessage?: string;
    }
  | {
      type: 'init_serial_dependency_detected';
      chainRequestIds: string[];
      chainActionLabels: string[];
      totalDurationMs: number;
      sumDurationMs: number;
    }
  | {
      type: 'frontend_settle_gap_large';
      gapMs: number;
      module?: string;
      lastCriticalRequestEndAt: number;
      firstCriticalModuleRenderedAt?: number;
      finalCriticalModuleRenderedAt?: number;
    }
  | {
      type: 'critical_module_not_rendered_after_request';
      module: string;
      requestId: string;
      requestEndedAt: number;
      observedAt: number;
      delayMs: number;
    }
  | {
      type: 'loading_too_long';
      module?: string;
      durationMs: number;
      threshold: number;
    }
  | {
      type: 'duplicate_request_in_init';
      urlPattern: string;
      requestIds: string[];
      count: number;
      windowMs: number;
    }
  | {
      type: 'init_symptom';
      symptom: 'empty_state' | 'error_toast' | 'blank_screen' | 'skeleton_too_long';
      module?: string;
      timestamp: number;
      detail?: string;
    };

export interface WindowedNetworkInsight {
  insight: NetworkInsight;
  sequenceInWindow: number;
  offsetFromWindowStartMs: number;
  isCritical: boolean;
}

export interface CriticalModuleState {
  module: string;
  isCritical: boolean;
  loadingStartedAt?: number;
  renderedAt?: number;
  itemCount?: number;
  associatedRequestIds: string[];
}

export interface InitSymptomRecord {
  symptom: 'empty_state' | 'error_toast' | 'blank_screen' | 'skeleton_too_long';
  module?: string;
  timestamp: number;
  detail?: string;
}

export interface InitWindow {
  windowId: string;
  page: string;
  route?: string;
  startedAt: number;
  completedAt?: number;
  endReason?: InitWindowEndReason;
  trigger: InitWindowTrigger;
  networkInsights: WindowedNetworkInsight[];
  criticalModules: CriticalModuleState[];
  symptoms: InitSymptomRecord[];
  observations: InitPerfObservation[];
  pagePerf?: PagePerfSummary;
}
```

- [ ] **Step 2: Modify `src/shared/types/index.ts` — add re-export**

Add this line at the end of the file:

```ts
export * from './init-perf';
```

- [ ] **Step 3: Modify `src/shared/constants/config.ts` — add init-window thresholds**

Replace the `RECORDER_CONFIG` object (lines 6-19) with:

```ts
export const RECORDER_CONFIG = {
  MAX_EVENTS: 500,
  MAX_TEXT_LENGTH: 100,
  MAX_ERROR_STACK_LENGTH: 500,
  LONG_LOADING_THRESHOLD_MS: 5000,
  FIRST_SCREEN_API_TIMEOUT_MS: 10000,
  SLOW_LCP_THRESHOLD_MS: 2500,
  SLOW_FCP_THRESHOLD_MS: 1800,
  SLOW_TTFB_THRESHOLD_MS: 800,
  HIGH_CLS_THRESHOLD: 0.1,
  LONG_API_DURATION_MS: 500,
  FIRST_SCREEN_STABLE_GAP_MS: 200,
  MAX_FIRST_SCREEN_APIS: 30,
  // 初始化窗口
  INIT_WINDOW_MAX_MS: 15_000,
  INIT_WINDOW_DEBOUNCE_MS: 100,
  SLOW_REQUEST_MS: 2_000,
  TIMEOUT_REQUEST_MS: 10_000,
  FRONTEND_SETTLE_GAP_MS: 1_500,
  DUPLICATE_REQUEST_WINDOW_MS: 2_000,
  DUPLICATE_REQUEST_COUNT: 3,
} as const;
```

- [ ] **Step 4: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no errors — new file is standalone, re-export is valid)

- [ ] **Step 5: Commit**

```bash
git add src/shared/types/init-perf.ts src/shared/types/index.ts src/shared/constants/config.ts
git commit -m "feat(types): add init-perf types and config thresholds"
```

---

## Task 2: Extend probe-event perfType + runtime messages

**Files:**
- Modify: `src/shared/types/probe-event.ts:112-129`
- Modify: `src/shared/types/runtime-message.ts:4-25`
- Modify: `src/shared/constants/event-types.ts:11-18`

- [ ] **Step 1: Modify `src/shared/types/probe-event.ts` — widen perfType**

Replace the `PerformanceEvent` interface (lines 112-129) with:

```ts
export interface PerformanceEvent extends BaseProbeEvent {
  kind: 'performance';
  perfType:
    | 'first_screen_complete'
    | 'init_window_started'
    | 'init_window_completed';
  pageUrl: string;
  timing: {
    fcp?: number;
    lcp?: number;
    ttfb?: number;
    cls?: number;
    domContentLoaded?: number;
    loadComplete?: number;
    firstScreenReadyMs?: number;
    lastApiEndMs?: number;
    observations?: string[];
  };
  firstScreenApis?: FirstScreenApiSummary[];
  navigationalType?: 'navigate' | 'reload' | 'back_forward' | 'prerender';
  initWindowId?: string;
}
```

- [ ] **Step 2: Modify `src/shared/types/runtime-message.ts` — add messages**

Add two new union members before the `FETCH_AUTO_OBSERVE` line. Replace lines 24-25:

```ts
  | { type: 'DIAGNOSE_PAGE_LOAD'; tabId: number } // side panel -> background: 触发按需页面加载诊断
  | { type: 'FETCH_AUTO_OBSERVE' }; // background -> content: 获取自动观察缓冲区快照
```

with:

```ts
  | { type: 'DIAGNOSE_PAGE_LOAD'; tabId: number } // side panel -> background: 触发按需页面加载诊断
  | { type: 'FETCH_AUTO_OBSERVE' } // background -> content: 获取自动观察缓冲区快照
  | { type: 'FETCH_INIT_WINDOW' } // background -> content: 获取初始化窗口数据
  | { type: 'INIT_WINDOW_RESULT'; tabId: number; window: import('./init-perf').InitWindow | null }; // content -> background: 返回初始化窗口
```

- [ ] **Step 3: Modify `src/shared/constants/event-types.ts` — add init_observation**

Replace the `EVIDENCE_TYPE_MAP` object (lines 11-18) with:

```ts
export const EVIDENCE_TYPE_MAP = {
  ui: 'ui_event',
  ui_state: 'ui_state',
  network: 'network_event',
  error: 'frontend_error',
  bridge: 'bridge_event',
  observation: 'observation',
  performance: 'performance_event',
  init_observation: 'init_observation',
} as const;
```

- [ ] **Step 4: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/types/probe-event.ts src/shared/types/runtime-message.ts src/shared/constants/event-types.ts
git commit -m "feat(types): widen perfType union, add FETCH_INIT_WINDOW message, init_observation evidence type"
```

---

## Task 3: perf-bridge — fix PERF_UPDATE dead chain

**Files:**
- Create: `src/content/perf-bridge.ts`

- [ ] **Step 1: Create `src/content/perf-bridge.ts`**

```ts
// content/perf-bridge.ts
// 桥接 PerformanceEvent → PagePerfSummary → PERF_UPDATE 消息
// 修复 PagePerfIndicator 永远停在 "Measuring page load..." 的死链

import type { PerformanceEvent, PagePerfSummary } from '@/shared/types';
import { RECORDER_CONFIG } from '@/shared/constants';

export function buildPagePerfSummary(event: PerformanceEvent): PagePerfSummary {
  const t = event.timing;
  const observations = t.observations ?? [];
  const isSlow =
    (t.lcp != null && t.lcp > RECORDER_CONFIG.SLOW_LCP_THRESHOLD_MS) ||
    (t.fcp != null && t.fcp > RECORDER_CONFIG.SLOW_FCP_THRESHOLD_MS) ||
    (t.ttfb != null && t.ttfb > RECORDER_CONFIG.SLOW_TTFB_THRESHOLD_MS) ||
    (t.cls != null && t.cls > RECORDER_CONFIG.HIGH_CLS_THRESHOLD) ||
    observations.includes('slow_api');

  return {
    pageReadyMs: t.firstScreenReadyMs ?? 0,
    lcpMs: t.lcp,
    fcpMs: t.fcp,
    ttfbMs: t.ttfb,
    cls: t.cls,
    isSlow,
    observations,
  };
}

export function notifyPerfUpdate(summary: PagePerfSummary, tabId: number): void {
  chrome.runtime.sendMessage({
    type: 'PERF_UPDATE',
    tabId,
    perf: summary,
  }).catch(() => {
    // background may not be ready; silent fail
  });
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/content/perf-bridge.ts
git commit -m "feat(content): add perf-bridge to fix PERF_UPDATE dead chain"
```

---

## Task 4: Wire perf-bridge into performance-observer

**Files:**
- Modify: `src/content/performance-observer.ts:7-9,195-253`

- [ ] **Step 1: Add imports + onFirstScreenReady callback**

At the top of `src/content/performance-observer.ts`, add import after line 9 (`import { RECORDER_CONFIG } from '@/shared/constants';`):

```ts
import { buildPagePerfSummary, notifyPerfUpdate } from './perf-bridge';
```

Add a callback property and constructor parameter. Replace line 35-57:

```ts
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
    private readonly onFirstScreenReady?: (event: PerformanceEvent, summary: import('@/shared/types').PagePerfSummary) => void,
  ) {}
```

- [ ] **Step 2: Call perf-bridge + callback in emitFirstScreenComplete**

Replace the end of `emitFirstScreenComplete()` (lines 251-253, the `// 始终通过 auto-observe 写入` block) with:

```ts
    // 始终通过 auto-observe 写入，不依赖 manual recording
    this.recorder.appendAutoObserve(event);

    // 通知 perf-bridge 发送 PERF_UPDATE（修复死链）
    const perfEvent: PerformanceEvent = {
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

    // 发送 PERF_UPDATE 到 background → sidepanel
    const tabId = this.recorder['lastTabId'] ?? this.recorder['autoTabId'] ?? 0;
    notifyPerfUpdate(summary, tabId);
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/content/performance-observer.ts
git commit -m "feat(content): wire perf-bridge + onFirstScreenReady callback into performance-observer"
```

---

## Task 5: init-window-tracker module (core)

**Files:**
- Create: `src/content/init-window-tracker.ts`

- [ ] **Step 1: Create `src/content/init-window-tracker.ts`**

```ts
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
  CriticalModuleState,
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

  onBridgeInitCompleted(module: string): void {
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

    // 检查是否所有关键模块都已渲染
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
        isCritical: false, // Phase 2: 由 bridge 关联标记
      };
      this.currentWindow.networkInsights.push(windowed);
    }
  }

  onSymptom(symptom: InitSymptomRecord['symptom'], module?: string, detail?: string): void {
    if (this.state !== 'open' || !this.currentWindow) return;
    this.currentWindow.symptoms.push({ symptom, module, timestamp: Date.now(), detail });
  }

  onFirstScreenReady(event: PerformanceEvent, summary: PagePerfSummary): void {
    if (this.state !== 'open' || !this.currentWindow) return;
    this.currentWindow.pagePerf = summary;
    // 如果 bridge 未发 init_completed，用 first-screen-ready 兜底关闭
    if (this.currentWindow.endReason === undefined) {
      this.closeWindow('first_screen_ready');
    }
  }

  // ---- 窗口管理 ----

  private openWindow(page: string, route: string | undefined, trigger: InitWindowTrigger): void {
    // 去抖：100ms 内多次触发只开一次
    if (this.debounceHandle !== null) {
      clearTimeout(this.debounceHandle);
    }
    this.debounceHandle = setTimeout(() => {
      // 如果已有窗口打开，先关闭旧的
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

      // 超时兜底
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

    // 生成 observations
    this.currentWindow.observations = this.generateObservations();

    // 写入 autoObserve buffer（供一键诊断消费）
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

    // window_started
    obs.push({
      type: 'init_window_started',
      page: w.page,
      timestamp: w.startedAt,
      trigger: w.trigger,
    });

    // window_completed
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

    // R3: serial dependency detection
    this.detectSerialDependency(w, obs);

    // R5: frontend settle gap
    this.detectFrontendSettleGap(w, obs);

    // R7: duplicate requests
    this.detectDuplicateRequests(w, obs);

    // symptoms
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
    // 按开始时间排序（用 offset 近似）
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
      // 如果当前请求开始时间接近前序请求结束时间，视为串行
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
      // 串行总时长接近窗口时长的 70% 才报告
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
        observationType: 'module_loading_too_long', // 复用 observation kind 作为载体
        detail: { initObservation: o },
      });
    }
  }

  getCurrentWindow(): InitWindow | null {
    return this.currentWindow;
  }

  getLastClosedWindow(): InitWindow | null {
    // 返回最近关闭的窗口（用于 DIAGNOSE_PAGE_LOAD 获取数据）
    // 由于 closeWindow 会清空 currentWindow，这里返回 null；
    // 实际数据已通过 flushObservationsToRecorder 写入 autoObserve buffer。
    // background 的 DIAGNOSE_PAGE_LOAD 走 FETCH_AUTO_OBSERVE 即可获取。
    return null;
  }
}

// 单例
let instance: InitWindowTracker | null = null;

export function getInitWindowTracker(): InitWindowTracker | null {
  return instance;
}

export function setInitWindowTracker(tracker: InitWindowTracker): void {
  instance = tracker;
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/content/init-window-tracker.ts
git commit -m "feat(content): add init-window-tracker module for init performance diagnosis"
```

---

## Task 6: Wire init-window-tracker into observers (route, bridge, network, symptom)

**Files:**
- Modify: `src/content/route-observer.ts:50-63`
- Modify: `src/content/bridge-listener.ts:7-40`
- Modify: `src/content/network/network-observer.ts:98-145`
- Modify: `src/content/ui-symptom-detector.ts:66-113`

- [ ] **Step 1: Modify `src/content/route-observer.ts` — notify init-window-tracker before isActive guard**

Add import after line 4 (`import type { UiEvent } from '@/shared/types';`):

```ts
import { getInitWindowTracker } from './init-window-tracker';
```

Replace the `emitRouteChange` method (lines 50-63) with:

```ts
  private emitRouteChange(): void {
    const route = location.pathname + location.search;
    if (route === this.lastRoute) return;
    this.lastRoute = route;

    // 通知 init-window-tracker（始终触发，不依赖录制状态）
    const tracker = getInitWindowTracker();
    if (tracker) {
      tracker.onRouteEnter(route, location.href);
    }

    if (!this.recorder.isActive) return;

    const event: Omit<UiEvent, 'eventId' | 'occurredAt' | 'tabId'> = {
      kind: 'ui',
      eventType: 'route_change',
      route,
    };
    this.recorder.append(event);
  }
```

- [ ] **Step 2: Modify `src/content/bridge-listener.ts` — notify init-window-tracker before isActive guard**

Add import after line 4 (`import { BRIDGE_CONTEXT_KEY, BRIDGE_EVENT_NAMES } from '@/shared/constants';`):

```ts
import { getInitWindowTracker } from './init-window-tracker';
```

Replace the `interactionHandler` and `stateHandler` setup (lines 22-39) with:

```ts
    // 监听自定义事件
    this.interactionHandler = (e: CustomEvent) => {
      const detail = e.detail as Record<string, unknown> | undefined;
      // 通知 init-window-tracker（始终触发）
      const tracker = getInitWindowTracker();
      if (tracker && detail) {
        const stateType = detail.stateType as string | undefined;
        if (stateType === 'init_started') {
          tracker.onBridgeInitStarted(detail.module as string, location.href);
        } else if (stateType === 'init_completed') {
          tracker.onBridgeInitCompleted(detail.module as string);
        } else if (stateType === 'loading') {
          tracker.onBridgeModuleLoading(detail.module as string, detail.isCritical === true);
        } else if (stateType === 'rendered') {
          tracker.onBridgeModuleRendered(
            detail.module as string,
            detail.isCritical === true,
            detail.itemCount as number | undefined,
          );
        }
      }
      if (!this.recorder.isActive) return;
      this.emitBridge('interaction', {
        businessAction: detail?.businessAction as string | undefined,
        module: detail?.module as string | undefined,
        detail,
      });
    };
    this.stateHandler = (e: CustomEvent) => {
      const detail = e.detail as Record<string, unknown> | undefined;
      if (!this.recorder.isActive) return;
      this.emitBridge('state', {
        stateType: detail?.stateType as string | undefined,
        module: detail?.module as string | undefined,
        detail,
      });
    };
    window.addEventListener(BRIDGE_EVENT_NAMES.INTERACTION, this.interactionHandler as EventListener);
    window.addEventListener(BRIDGE_EVENT_NAMES.STATE, this.stateHandler as EventListener);
```

Note: init_started/init_completed/loading/rendered are dispatched as `diagnosis:interaction` events (same channel), with `stateType` field distinguishing them. This matches the bridge-listener's existing `interactionHandler`.

Wait — looking again at page-bridge: `emitDiagnosisInteraction` dispatches `diagnosis:interaction`, `emitDiagnosisState` dispatches `diagnosis:state`. The existing `interactionHandler` reads `businessAction`/`module`/`detail`. The `stateHandler` reads `stateType`/`module`.

The init events should go through the **state** channel since they carry `stateType`. Let me re-examine. The page-bridge `emitDiagnosisState(detail)` dispatches `diagnosis:state` with `detail`. The `stateHandler` reads `detail.stateType` and `detail.module`.

So init events should use `emitDiagnosisState` with `stateType: 'init_started'` etc. But the interactionHandler currently handles `diagnosis:interaction` which reads `businessAction`.

Let me fix: the init notification should go in `stateHandler`, not `interactionHandler`. Let me re-do step 2:

- [ ] **Step 2 (revised): Modify `src/content/bridge-listener.ts` — notify init-window-tracker in stateHandler before isActive guard**

Replace lines 22-39 with:

```ts
    // 监听自定义事件
    this.interactionHandler = (e: CustomEvent) => {
      const detail = e.detail as Record<string, unknown> | undefined;
      if (!this.recorder.isActive) return;
      this.emitBridge('interaction', {
        businessAction: detail?.businessAction as string | undefined,
        module: detail?.module as string | undefined,
        detail,
      });
    };
    this.stateHandler = (e: CustomEvent) => {
      const detail = e.detail as Record<string, unknown> | undefined;
      // 通知 init-window-tracker（始终触发，不依赖录制状态）
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
      if (!this.recorder.isActive) return;
      this.emitBridge('state', {
        stateType: detail?.stateType as string | undefined,
        module: detail?.module as string | undefined,
        detail,
      });
    };
    window.addEventListener(BRIDGE_EVENT_NAMES.INTERACTION, this.interactionHandler as EventListener);
    window.addEventListener(BRIDGE_EVENT_NAMES.STATE, this.stateHandler as EventListener);
```

- [ ] **Step 3: Modify `src/content/network/network-observer.ts` — notify init-window-tracker + write autoObserve before isActive guard**

Add import after line 22 (`const MESSAGE_SOURCE = 'tracelens-main-world';`):

```ts
import { getInitWindowTracker } from '../init-window-tracker';
```

Replace `processMainWorldEvent` (lines 98-145) with:

```ts
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

    // 写入 autoObserve buffer（始终写入，供一键诊断消费）
    const autoEvent: Omit<NetworkEvent, 'eventId' | 'occurredAt' | 'tabId'> = {
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
    this.recorder.appendAutoObserve(autoEvent);

    // 写入手动 buffer（仅在录制时）
    if (!this.recorder.isActive) return;
    this.recorder.append(autoEvent);
  }
```

- [ ] **Step 4: Modify `src/content/ui-symptom-detector.ts` — notify init-window-tracker before isActive guard**

Add import after line 7 (`import { RECORDER_CONFIG } from '@/shared/constants';`):

```ts
import { getInitWindowTracker } from './init-window-tracker';
```

In `startMutationObserver()` (line 67), replace:

```ts
      if (!this.recorder.isActive) return;
```

with:

```ts
      // init-window-tracker 始终接收症状（不依赖录制状态）
      // 但 DOM 扫描仅在录制时做 recorder.append
```

Then in `inspectNewNode` calls, add tracker notification. Replace `checkEmptyState` (lines 87-97) with:

```ts
  private checkEmptyState(el: HTMLElement): void {
    const text = el.textContent ?? '';
    for (const pattern of EMPTY_STATE_PATTERNS) {
      if (pattern.test(text)) {
        const tracker = getInitWindowTracker();
        if (tracker) tracker.onSymptom('empty_state', undefined, text.slice(0, 100));
        if (!this.recorder.isActive) return;
        this.emitObservation('module_empty_after_success', {
          detail: { text: text.slice(0, 100), selector: getSelector(el) },
        });
        return;
      }
    }
  }
```

Replace `checkErrorToast` (lines 99-113) with:

```ts
  private checkErrorToast(el: HTMLElement): void {
    const text = el.textContent ?? '';
    for (const pattern of ERROR_TOAST_PATTERNS) {
      if (pattern.test(text)) {
        const tracker = getInitWindowTracker();
        if (tracker) tracker.onSymptom('error_toast', undefined, text.slice(0, 100));
        if (!this.recorder.isActive) return;
        this.emitUiState('error_toast', {
          message: text.slice(0, 100),
          severity: 'error',
        });
        this.emitObservation('request_failed_without_feedback', {
          detail: { text: text.slice(0, 100), selector: getSelector(el) },
        });
        return;
      }
    }
  }
```

In `checkLongLoadingTimeout` (line 139-147), replace the emit block with:

```ts
      if (now - p.startedAt >= RECORDER_CONFIG.LONG_LOADING_THRESHOLD_MS) {
        const tracker = getInitWindowTracker();
        if (tracker) tracker.onSymptom('skeleton_too_long', p.selector, undefined);
        if (this.recorder.isActive) {
          this.emitObservation('module_loading_too_long', {
            module: p.selector,
            detail: {
              selector: p.selector,
              durationMs: now - p.startedAt,
            },
          });
        }
        return false; // 只报告一次
      }
```

Also in `startMutationObserver`, the MutationObserver callback (lines 66-75) — change the guard so tracker still gets notified but recorder.append is guarded:

Replace lines 66-75 with:

```ts
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement) {
            this.inspectNewNode(node);
          }
        }
      }
    });
```

(Remove the `if (!this.recorder.isActive) return;` — the individual methods now guard internally.)

- [ ] **Step 5: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/content/route-observer.ts src/content/bridge-listener.ts src/content/network/network-observer.ts src/content/ui-symptom-detector.ts
git commit -m "feat(content): wire init-window-tracker into route/bridge/network/symptom observers"
```

---

## Task 7: Wire init-window-tracker + perf-bridge into content/index.ts

**Files:**
- Modify: `src/content/index.ts:4-22,103-111,161-165`

- [ ] **Step 1: Add imports + instantiate init-window-tracker**

After line 12 (`import { readPageContext } from './page-context-reader';`), add:

```ts
import { InitWindowTracker, setInitWindowTracker } from './init-window-tracker';
```

After line 22 (`const perfObserver = new PerfObserver(recorder);`), add:

```ts
const initWindowTracker = new InitWindowTracker({
  recorder,
});
setInitWindowTracker(initWindowTracker);
```

Note: the perfObserver constructor currently takes only `(recorder)`. We need to pass the `onFirstScreenReady` callback. But perfObserver is created before initWindowTracker. Reorder: create initWindowTracker first, then pass callback to perfObserver.

Replace lines 16-22 with:

```ts
const domObserver = new DomObserver(recorder);
const errorObserver = new ErrorObserver(recorder);
const routeObserver = new RouteObserver(recorder);
const networkObserver = new NetworkObserver(recorder);
const bridgeListener = new BridgeListener(recorder);
const symptomDetector = new UiSymptomDetector(recorder);
const initWindowTracker = new InitWindowTracker({
  recorder,
});
setInitWindowTracker(initWindowTracker);
const perfObserver = new PerfObserver(recorder, (event, summary) => {
  initWindowTracker.onFirstScreenReady(event, summary);
});
```

- [ ] **Step 2: Start/stop init-window-tracker in startAllObservers**

Replace `startAllObservers` (lines 103-111) with:

```ts
function startAllObservers(): void {
  domObserver.start();
  errorObserver.start();
  routeObserver.start();
  networkObserver.start();
  bridgeListener.start();
  symptomDetector.start();
  perfObserver.start();
  initWindowTracker.start();
}
```

Add stop in `stopRecording` (after line 45, before `const session = recorder.stop();`):

```ts
  initWindowTracker.stop();
```

- [ ] **Step 3: Handle FETCH_INIT_WINDOW message**

In `handleContentMessage` switch (after `FETCH_AUTO_OBSERVE` case, line 161-162), add:

```ts
    case 'FETCH_INIT_WINDOW': {
      const window = initWindowTracker.getCurrentWindow();
      return { ok: true, window };
    }
```

- [ ] **Step 4: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/content/index.ts
git commit -m "feat(content): wire init-window-tracker + perf-bridge callback into content entry"
```

---

## Task 8: Enhance DIAGNOSE_PAGE_LOAD in background

**Files:**
- Modify: `src/background/index.ts:152-199`

- [ ] **Step 1: Modify DIAGNOSE_PAGE_LOAD handler to fetch init observations**

Replace the `DIAGNOSE_PAGE_LOAD` case (lines 152-199) with:

```ts
    case 'DIAGNOSE_PAGE_LOAD': {
      const tabId = await resolveActiveTabId(message.tabId);
      // 请求 content script 提供 autoObserve 缓冲区 + 初始化窗口数据
      try {
        const [autoRes, initRes] = await Promise.all([
          chrome.tabs.sendMessage(tabId, { type: 'FETCH_AUTO_OBSERVE' }),
          chrome.tabs.sendMessage(tabId, { type: 'FETCH_INIT_WINDOW' }).catch(() => null),
        ]);

        if (!autoRes || !autoRes.ok || !autoRes.events) {
          return { ok: false, error: 'no auto-observe events' };
        }

        const events = autoRes.events as Array<Record<string, unknown>>;
        const tabInfo = await chrome.tabs.get(tabId);
        const title = tabInfo.title ?? 'Unknown';
        const url = tabInfo.url ?? '';

        // 从 auto-observe 事件中提取 init observations（observation kind 带 initObservation detail）
        const initObservations: Array<Record<string, unknown>> = [];
        for (const e of events) {
          if (e.kind === 'observation' && e.detail && typeof e.detail === 'object') {
            const detail = e.detail as Record<string, unknown>;
            if (detail.initObservation) {
              initObservations.push(detail.initObservation as Record<string, unknown>);
            }
          }
        }

        // 合并 initRes 窗口数据（如果 content 返回了）
        const initWindow = initRes?.window as Record<string, unknown> | null;

        const evidence = events.map((e) => ({
          id: e.eventId ?? crypto.randomUUID(),
          type: e.kind === 'performance'
            ? 'performance_event'
            : e.kind === 'network'
            ? 'network_event'
            : e.kind === 'observation' && (e.detail as Record<string, unknown>)?.initObservation
            ? 'init_observation'
            : EVIDENCE_TYPE_MAP[e.kind as keyof typeof EVIDENCE_TYPE_MAP] ?? 'ui_event',
          label:
            e.kind === 'performance'
              ? `performance:${(e as Record<string, unknown>).perfType ?? 'first_screen_complete'}`
              : e.kind === 'network'
              ? `${(e as Record<string, unknown>).method ?? 'GET'} ${(e as Record<string, unknown>).url ?? ''}`
              : e.kind === 'observation' && (e.detail as Record<string, unknown>)?.initObservation
              ? `init_observation:${((e.detail as Record<string, unknown>).initObservation as Record<string, unknown>).type ?? 'unknown'}`
              : `${e.kind ?? 'unknown'}`,
          value: e.kind === 'observation' && (e.detail as Record<string, unknown>)?.initObservation
            ? (e.detail as Record<string, unknown>).initObservation as Record<string, unknown>
            : e as Record<string, unknown>,
          source: 'auto-observe',
          timestamp: e.occurredAt ? new Date(e.occurredAt as number).toISOString() : new Date().toISOString(),
        }));

        const symptoms = initObservations
          .filter((o) => o.type === 'init_symptom')
          .map((o) => `${o.symptom}${o.module ? `(${o.module})` : ''}`);

        const dto = {
          appId: 'diagnosis-extension',
          pageUrl: url,
          title: initWindow
            ? `页面初始化性能排查 - ${initWindow.page ?? url}`
            : title,
          description: initWindow
            ? `初始化耗时 ${initWindow.completedAt && initWindow.startedAt ? Number(initWindow.completedAt) - Number(initWindow.startedAt) : '?'}ms，结束原因：${initWindow.endReason ?? 'unknown'}`
            : undefined,
          evidence,
          symptoms: symptoms.length > 0 ? symptoms : undefined,
        };

        const task = await createDiagnosis(dto as unknown as import('@/shared/types').CreateDiagnosisDto);

        // 打开工作台查看结果
        await chrome.tabs.create({
          url: chrome.runtime.getURL('src/workbench/index.html') + `?taskId=${task.taskId}`,
        });

        return { ok: true, taskId: task.taskId };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
```

- [ ] **Step 2: Add EVIDENCE_TYPE_MAP import**

Add to the imports at top of `src/background/index.ts` (after line 8, `import { createDiagnosis } from '@/shared/api';`):

```ts
import { EVIDENCE_TYPE_MAP } from '@/shared/constants';
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/background/index.ts
git commit -m "feat(background): enhance DIAGNOSE_PAGE_LOAD to carry init observations"
```

---

## Task 9: Enhance PagePerfIndicator UI

**Files:**
- Modify: `src/sidepanel/components/PagePerfIndicator.tsx:36-42,44-115`

- [ ] **Step 1: Add diagnosing/done states + enhance prompt text**

Replace the `handleDiagnose` function (lines 36-42) with:

```ts
  const handleDiagnose = async () => {
    try {
      setPagePerf((prev) => prev ? { ...prev, __diagnosing: true } : prev);
      const res = await chrome.runtime.sendMessage({ type: 'DIAGNOSE_PAGE_LOAD' });
      if (res && res.ok && res.taskId) {
        setPagePerf((prev) => prev ? { ...prev, __diagnosing: false, __taskId: res.taskId } : prev);
      } else {
        setPagePerf((prev) => prev ? { ...prev, __diagnosing: false } : prev);
        console.error('[TraceLens] diagnosePageLoad failed:', res?.error);
      }
    } catch (err) {
      setPagePerf((prev) => prev ? { ...prev, __diagnosing: false } : prev);
      console.error('[TraceLens] diagnosePageLoad error', err);
    }
  };
```

Wait — `PagePerfSummary` doesn't have `__diagnosing`/`__taskId` fields. This approach won't typecheck. Instead, use local component state.

Replace the entire component (lines 13-138) with:

```tsx
const PagePerfIndicator: React.FC = () => {
  const pagePerf = useSidePanelStore((s) => s.pagePerf);
  const setPagePerf = useSidePanelStore((s) => s.setPagePerf);
  const status = useSidePanelStore((s) => s.status);
  const [diagState, setDiagState] = React.useState<'idle' | 'diagnosing' | 'done' | 'error'>('idle');
  const [taskId, setTaskId] = React.useState<string | null>(null);

  // 监听来自 content script 的性能更新消息
  useEffect(() => {
    const listener = (message: RuntimeMessage) => {
      if (message.type === 'PERF_UPDATE') {
        setPagePerf(message.perf);
        setDiagState('idle');
        setTaskId(null);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [setPagePerf]);

  // Tab 切换时重置
  useEffect(() => {
    if (status === 'idle') {
      setPagePerf(null);
      setDiagState('idle');
      setTaskId(null);
    }
  }, [status, setPagePerf]);

  const handleDiagnose = async () => {
    setDiagState('diagnosing');
    try {
      const res = await chrome.runtime.sendMessage({ type: 'DIAGNOSE_PAGE_LOAD' });
      if (res && res.ok && res.taskId) {
        setTaskId(res.taskId);
        setDiagState('done');
      } else {
        setDiagState('error');
        console.error('[TraceLens] diagnosePageLoad failed:', res?.error);
      }
    } catch (err) {
      setDiagState('error');
      console.error('[TraceLens] diagnosePageLoad error', err);
    }
  };

  const isSlow = pagePerf?.isSlow ?? false;
  const readyText = pagePerf
    ? `Page ready ${formatPageReady(pagePerf.pageReadyMs)}${isSlow ? ' (slow)' : ''}`
    : 'Measuring page load...';

  const bgColor = !pagePerf
    ? COLORS.surface
    : isSlow
    ? COLORS.warningBg
    : COLORS.successBg;
  const borderColor = !pagePerf
    ? COLORS.border
    : isSlow
    ? COLORS.warning
    : COLORS.success;
  const textColor = !pagePerf
    ? COLORS.textSecondary
    : isSlow
    ? COLORS.warning
    : COLORS.success;

  return (
    <div
      style={{
        padding: SPACING.md,
        borderRadius: 8,
        border: `1px solid ${borderColor}`,
        background: bgColor,
        display: 'flex',
        flexDirection: 'column',
        gap: SPACING.sm,
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
        <span style={{ fontSize: 14 }}>
          {!pagePerf ? '⏳' : isSlow ? '🐢' : '⚡'}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: textColor }}>
            {readyText}
          </div>
          {pagePerf && (
            <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 2 }}>
              LCP {pagePerf.lcpMs != null ? `${Math.round(pagePerf.lcpMs)}ms` : '—'}
              {' · '} FCP {pagePerf.fcpMs != null ? `${Math.round(pagePerf.fcpMs)}ms` : '—'}
              {' · '} TTFB {pagePerf.ttfbMs != null ? `${Math.round(pagePerf.ttfbMs)}ms` : '—'}
              {' · '} CLS {pagePerf.cls != null ? pagePerf.cls.toFixed(3) : '—'}
            </div>
          )}
        </div>

        {/* Diagnose button — visible when slow + not yet diagnosing */}
        {pagePerf && isSlow && diagState === 'idle' && (
          <button
            onClick={handleDiagnose}
            style={{
              padding: '4px 10px',
              fontSize: 12,
              fontWeight: 600,
              color: '#fff',
              background: COLORS.warning,
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            一键排查
          </button>
        )}

        {/* Diagnosing spinner */}
        {diagState === 'diagnosing' && (
          <span style={{ fontSize: 12, color: COLORS.textSecondary }}>诊断中...</span>
        )}

        {/* Done — open workbench link */}
        {diagState === 'done' && taskId && (
          <button
            onClick={() => chrome.tabs.create({
              url: chrome.runtime.getURL('src/workbench/index.html') + `?taskId=${taskId}`,
            })}
            style={{
              padding: '4px 10px',
              fontSize: 12,
              fontWeight: 600,
              color: '#fff',
              background: COLORS.success,
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            打开工作台
          </button>
        )}

        {/* Error retry */}
        {diagState === 'error' && (
          <button
            onClick={handleDiagnose}
            style={{
              padding: '4px 10px',
              fontSize: 12,
              fontWeight: 600,
              color: '#fff',
              background: COLORS.warning,
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            重试
          </button>
        )}
      </div>

      {/* Slow prompt */}
      {pagePerf && isSlow && diagState === 'idle' && (
        <div style={{ fontSize: 11, color: COLORS.warning }}>
          ⚠ 页面初始化偏慢，可能存在接口性能问题，点击「一键排查」诊断
        </div>
      )}

      {/* Observations */}
      {pagePerf && pagePerf.observations.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {pagePerf.observations.map((o) => (
            <span
              key={o}
              style={{
                fontSize: 10,
                padding: '1px 6px',
                borderRadius: 4,
                background: isSlow ? '#fef3c7' : '#d1fae5',
                color: isSlow ? '#92400e' : '#065f46',
              }}
            >
              {o}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/sidepanel/components/PagePerfIndicator.tsx
git commit -m "feat(sidepanel): enhance PagePerfIndicator with diagnosing/done/error states"
```

---

## Task 10: page-bridge init helper methods

**Files:**
- Modify: `src/page-bridge/index.ts:47-53`

- [ ] **Step 1: Add init helper functions**

After `emitDiagnosisState` (line 53), add:

```ts
export function emitInitStarted(module: string): void {
  window.dispatchEvent(new CustomEvent(EVENT_STATE, {
    detail: { module, stateType: 'init_started' },
  }));
}

export function emitInitCompleted(module: string): void {
  window.dispatchEvent(new CustomEvent(EVENT_STATE, {
    detail: { module, stateType: 'init_completed' },
  }));
}

export function emitModuleLoading(module: string, opts?: { isCritical?: boolean }): void {
  window.dispatchEvent(new CustomEvent(EVENT_STATE, {
    detail: { module, stateType: 'loading', isCritical: opts?.isCritical ?? false },
  }));
}

export function emitModuleRendered(module: string, opts?: { isCritical?: boolean; itemCount?: number }): void {
  window.dispatchEvent(new CustomEvent(EVENT_STATE, {
    detail: {
      module,
      stateType: 'rendered',
      isCritical: opts?.isCritical ?? false,
      itemCount: opts?.itemCount,
    },
  }));
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/page-bridge/index.ts
git commit -m "feat(page-bridge): add init/module lifecycle helper functions"
```

---

## Task 11: Delete dead code (StatusBar + ContextSummary)

**Files:**
- Delete: `src/sidepanel/components/StatusBar.tsx`
- Delete: `src/sidepanel/components/ContextSummary.tsx`

- [ ] **Step 1: Verify these files are not imported anywhere**

Run: `grep -r "StatusBar\|ContextSummary" src/ --include="*.ts" --include="*.tsx"`

Expected: No imports found (only the files themselves).

- [ ] **Step 2: Delete the files**

```bash
rm src/sidepanel/components/StatusBar.tsx src/sidepanel/components/ContextSummary.tsx
```

- [ ] **Step 3: Verify typecheck + build**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add -A src/sidepanel/components/
git commit -m "chore(sidepanel): remove dead code StatusBar and ContextSummary"
```

---

## Task 12: Full build verification

- [ ] **Step 1: Run full typecheck**

Run: `npx tsc --noEmit`
Expected: PASS with zero errors

- [ ] **Step 2: Run full build**

Run: `pnpm build`
Expected: Build succeeds, `dist/` updated

- [ ] **Step 3: Commit any remaining changes**

```bash
git add -A
git commit -m "build: verify full typecheck and build pass"
```

---

## Self-Review Notes

**Spec coverage:**
- §2.1 init-window-tracker → Task 5 ✓
- §2.2 PERF_UPDATE dead chain → Task 3+4 ✓
- §2.3 NetworkInsight into autoObserve → Task 6 (network-observer) ✓
- §2.4 SidePanel interaction → Task 9 ✓
- §2.5 page-bridge extension → Task 10 ✓
- §2.6 config thresholds → Task 1 ✓
- §3 Functional B fixes → Task 3+4 (PERF_UPDATE), Task 11 (dead code) ✓
- §4 Types → Task 1+2 ✓
- §7 Backend (标注 only, not implemented) → DIAGNOSE_PAGE_LOAD carries init observations in Task 8 ✓

**Placeholder scan:** No TBD/TODO found. All code blocks are complete.

**Type consistency:** `InitWindowTracker` constructor takes `{recorder}`, `onFirstScreenReady` callback signature matches `PerformanceObserver_` constructor param. `PagePerfSummary` fields match existing `runtime-message.ts`. `EVIDENCE_TYPE_MAP` keys match `ProbeEvent['kind']`.
