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
