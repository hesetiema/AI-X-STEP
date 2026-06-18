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
  | { type: 'UPLOAD_RESULT'; tabId: number; result: UploadResult };

export interface SessionStats {
  total: number;
  interaction: number;
  network: number;
  error: number;
  bridge: number;
  startedAt?: number;
}

export interface UploadResult {
  success: boolean;
  taskId?: string;
  error?: string;
}
