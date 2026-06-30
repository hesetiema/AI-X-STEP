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
  | { type: 'CAPTURE_CLICK_RUNTIME' } // content -> background: 消费最近一次点击的运行时捕获（调用栈+作用域变量）
  | { type: 'TAB_SWITCHED'; tabId: number } // background -> side panel: 用户切换了 tab
  | { type: 'PERF_UPDATE'; tabId: number; perf: PagePerfSummary } // content -> side panel: 页面性能摘要更新
  | { type: 'DIAGNOSE_PAGE_LOAD'; tabId: number } // side panel -> background: 触发按需页面加载诊断
  | { type: 'FETCH_AUTO_OBSERVE' } // background -> content: 获取自动观察缓冲区快照
  | { type: 'FETCH_INIT_WINDOW' } // background -> content: 获取初始化窗口数据
  | { type: 'INIT_WINDOW_RESULT'; tabId: number; window: import('./init-perf').InitWindow | null }; // content -> background: 返回初始化窗口

export interface SessionStats {
  total: number;
  interaction: number;
  network: number;
  error: number;
  bridge: number;
  performance: number;
  startedAt?: number;
}

export interface PagePerfSummary {
  pageReadyMs: number;
  lcpMs?: number;
  fcpMs?: number;
  ttfbMs?: number;
  cls?: number;
  isSlow: boolean;
  observations: string[];
}

export interface UploadResult {
  success: boolean;
  taskId?: string;
  error?: string;
}
