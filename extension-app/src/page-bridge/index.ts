// page-bridge/index.ts
// 独立轻量桥接 helper —— framework-agnostic，可被业务页面直接引入
//
// 使用方式：
//   import { setDiagnosisContext, emitDiagnosisInteraction, emitDiagnosisState } from 'page-bridge';
//   setDiagnosisContext({ appId: 'my-app', module: 'order-list' });
//   emitDiagnosisInteraction({ businessAction: 'submit-order' });
//   emitDiagnosisState({ module: 'order-list', stateType: 'loading' });

export interface DiagnosisContextValue {
  appId?: string;
  module?: string;
  tenantId?: string;
  releaseVersion?: string;
  [key: string]: unknown;
}

export interface InteractionDetail {
  businessAction?: string;
  targetId?: string;
  targetName?: string;
  module?: string;
  [key: string]: unknown;
}

export interface StateDetail {
  module?: string;
  stateType?: string;
  [key: string]: unknown;
}

const CONTEXT_KEY = '__DIAGNOSIS_CONTEXT__';
const EVENT_INTERACTION = 'diagnosis:interaction';
const EVENT_STATE = 'diagnosis:state';

export function setDiagnosisContext(ctx: DiagnosisContextValue): void {
  const w = window as unknown as Record<string, unknown>;
  w[CONTEXT_KEY] = { ...ctx };
}

export function updateDiagnosisContext(patch: Partial<DiagnosisContextValue>): void {
  const w = window as unknown as Record<string, unknown>;
  const existing = (w[CONTEXT_KEY] as DiagnosisContextValue) ?? {};
  w[CONTEXT_KEY] = { ...existing, ...patch };
}

export function emitDiagnosisInteraction(detail: InteractionDetail = {}): void {
  window.dispatchEvent(new CustomEvent(EVENT_INTERACTION, { detail }));
}

export function emitDiagnosisState(detail: StateDetail = {}): void {
  window.dispatchEvent(new CustomEvent(EVENT_STATE, { detail }));
}

export function clearDiagnosisContext(): void {
  const w = window as unknown as Record<string, unknown>;
  delete w[CONTEXT_KEY];
}

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
