/// <reference types="vite/client" />

declare global {
  interface Window {
    __DIAGNOSIS_CONTEXT__?: Record<string, unknown>;
  }
}

export {};
