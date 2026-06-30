// shared/constants/event-types.ts

export const BRIDGE_EVENT_NAMES = {
  INTERACTION: 'diagnosis:interaction',
  STATE: 'diagnosis:state',
} as const;

export const BRIDGE_CONTEXT_KEY = '__DIAGNOSIS_CONTEXT__';

// 用于与 traceLens-server 的 EvidenceItem.type 对齐
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
