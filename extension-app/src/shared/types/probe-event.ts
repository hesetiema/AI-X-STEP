// probe-event.ts
// 统一事件模型 —— 插件观测事件与页面桥接事件的公共基类

export type ProbeEvent =
  | UiEvent
  | UiStateEvent
  | NetworkEvent
  | ErrorEvent
  | BridgeEvent
  | ObservationEvent;

export interface BaseProbeEvent {
  eventId: string;
  occurredAt: number; // unix ms
  tabId: number;
}

export interface UiEvent extends BaseProbeEvent {
  kind: 'ui';
  eventType: 'click' | 'submit' | 'change' | 'route_change';
  targetId?: string;
  targetName?: string;
  domPath?: string;
  textSummary?: string;
  route?: string;
}

export interface UiStateEvent extends BaseProbeEvent {
  kind: 'ui_state';
  stateType:
    | 'loading'
    | 'loading_end'
    | 'toast'
    | 'error_toast'
    | 'empty_state'
    | 'retry_loop'
    | 'disabled';
  targetId?: string;
  message?: string;
  severity?: 'info' | 'warning' | 'error';
  visible?: boolean;
}

export interface NetworkEvent extends BaseProbeEvent {
  kind: 'network';
  requestId: string;
  phase: 'request' | 'response' | 'error';
  method: string;
  url: string;
  status?: number;
  durationMs?: number;
  errorMessage?: string;
  insight?: {
    actionLabel?: string;
    resultCategory?: string;
    requestText?: string;
    responseText?: string;
    module?: string;
  };
}

export interface ErrorEvent extends BaseProbeEvent {
  kind: 'error';
  errorType: 'js' | 'promise' | 'resource';
  message: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  stack?: string;
}

export interface BridgeEvent extends BaseProbeEvent {
  kind: 'bridge';
  bridgeType: 'context' | 'interaction' | 'state';
  businessAction?: string;
  module?: string;
  stateType?: string;
  detail?: Record<string, unknown>;
}

export interface ObservationEvent extends BaseProbeEvent {
  kind: 'observation';
  observationType:
    | 'module_loading_too_long'
    | 'module_empty_after_success'
    | 'module_hidden'
    | 'request_failed_without_feedback'
    | 'ui_response_mismatch';
  module?: string;
  detail?: Record<string, unknown>;
}
