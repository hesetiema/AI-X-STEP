// runtime-message.ts
// 插件内部消息协议：popup <-> background <-> content

export type RuntimeMessage =
  | { type: 'START_RECORDING'; tabId: number }
  | { type: 'STOP_RECORDING'; tabId: number }
  | { type: 'UPLOAD_SESSION'; tabId: number }
  | { type: 'GET_SESSION_STATUS'; tabId: number }
  | { type: 'GET_SESSION_STATS'; tabId: number }
  | { type: 'FETCH_SESSION'; tabId: number }
  | { type: 'FETCH_EVENTS'; tabId: number }
  | { type: 'INJECT_NETWORK_HOOK'; tabId: number }
  | { type: 'RESUME_RECORDING'; tabId: number }
  | { type: 'GET_TAB_ID' }
  | { type: 'SESSION_UPDATED'; tabId: number; status: import('./diagnosis-session').SessionStatus }
  | { type: 'EVENT_APPENDED'; tabId: number; stats: SessionStats }
  | { type: 'UPLOAD_RESULT'; tabId: number; result: UploadResult }
  | { type: 'SET_USER_HINT'; tabId: number; userHint: { summary: string; expected: string; actual: string } }
  | { type: 'ENABLE_DEEP_DIAGNOSIS'; tabId: number }
  | { type: 'DISABLE_DEEP_DIAGNOSIS'; tabId: number }
  | { type: 'CAPTURE_CLICK_RUNTIME' }
  | { type: 'TAB_SWITCHED'; tabId: number }
  | { type: 'PERF_UPDATE'; tabId: number; perf: PagePerfSummary }
  | { type: 'DIAGNOSE_PAGE_LOAD'; tabId: number }
  | { type: 'FETCH_AUTO_OBSERVE' }
  | { type: 'FETCH_INIT_WINDOW' }
  | { type: 'INIT_WINDOW_RESULT'; tabId: number; window: import('./init-perf').InitWindow | null }
  // 慢接口监控
  | { type: 'START_MONITORING'; tabId: number }
  | { type: 'STOP_MONITORING'; tabId: number }
  | { type: 'SLOW_API_UPDATE'; tabId: number; api: SlowApiInfo };

export interface SessionStats {
  total: number;
  interaction: number;
  network: number;
  error: number;
  bridge: number;
  performance: number;
  startedAt?: number;
}

export interface SlowApiInfo {
  requestId: string;
  url: string;
  method: string;
  durationMs: number;
  status?: number;
  phase: 'slow' | 'error' | 'timeout' | 'pending';
}

export interface PagePerfSummary {
  pageReadyMs: number;
  lcpMs?: number;
  fcpMs?: number;
  ttfbMs?: number;
  cls?: number;
  isSlow: boolean;
  observations: string[];
  slowApis?: SlowApiInfo[];
}

export interface UploadResult {
  success: boolean;
  taskId?: string;
  error?: string;
}
