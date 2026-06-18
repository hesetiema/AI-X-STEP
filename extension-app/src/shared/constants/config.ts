// shared/constants/config.ts

export const BACKEND_ENDPOINT = 'http://localhost:4220/api/v1/diagnosis';
export const BACKEND_BASE = 'http://localhost:4220';

export const RECORDER_CONFIG = {
  MAX_EVENTS: 500,
  MAX_TEXT_LENGTH: 100,
  MAX_ERROR_STACK_LENGTH: 500,
  LONG_LOADING_THRESHOLD_MS: 5000,
} as const;

// 便捷单值导出
export const { LONG_LOADING_THRESHOLD_MS } = RECORDER_CONFIG;
