// network.ts
// 网络监听 + 业务摘要转换模块的类型定义
// 直接迁移自文档 94 的 types.ts 骨架

export type NetworkSource = 'fetch' | 'xhr';
export type NetworkPhase = 'request' | 'response' | 'error';

export type ActionKind =
  | 'query'
  | 'detail'
  | 'create'
  | 'update'
  | 'delete'
  | 'custom';

export type StatusCategory = 'success' | 'failed' | 'timeout' | 'unknown';

export type InsightResultCategory =
  | 'success'
  | 'empty'
  | 'failed'
  | 'timeout'
  | 'invalid_data'
  | 'unknown';

export type InsightConfidence = 'high' | 'medium' | 'low';

export interface RawNetworkEvent {
  source: NetworkSource;
  phase: NetworkPhase;
  requestId: string;
  traceId?: string;
  method: string;
  url: string;
  status?: number;
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  requestHeaders?: Record<string, string>;
  requestBody?: unknown;
  responseHeaders?: Record<string, string>;
  responseBody?: unknown;
  errorMessage?: string;
}

export interface RequestSummary {
  queryKeys?: string[];
  bodyKeys?: string[];
  bodySize?: number;
}

export interface ResponseSummary {
  success?: boolean;
  code?: string | number;
  message?: string;
  isEmpty?: boolean;
  listCount?: number;
  total?: number;
  hasDataField?: boolean;
  hasListField?: boolean;
  hasErrorField?: boolean;
}

export interface SanitizedNetworkEvent {
  requestId: string;
  traceId?: string;
  method: string;
  url: string;
  urlPattern: string;
  status?: number;
  durationMs?: number;
  requestSummary?: RequestSummary;
  responseSummary?: ResponseSummary;
  errorMessage?: string;
}

export interface NormalizedNetworkEvent {
  requestId: string;
  traceId?: string;
  method: string;
  url: string;
  urlPattern: string;
  resourceName?: string;
  actionKind: ActionKind;
  statusCategory: StatusCategory;
  status?: number;
  durationMs?: number;
  requestSummary?: RequestSummary;
  responseSummary?: ResponseSummary;
  errorMessage?: string;
}

export interface PageContextHint {
  appId?: string;
  module?: string;
  route?: string;
}

export interface LatestInteractionHint {
  businessAction?: string;
  targetId?: string;
  targetName?: string;
}

export interface LatestModuleStateHint {
  module?: string;
  stateType?: string;
}

export interface InsightBuildContext {
  event: NormalizedNetworkEvent;
  pageContext?: PageContextHint;
  latestInteraction?: LatestInteractionHint;
  latestModuleState?: LatestModuleStateHint;
}

export interface ApiBusinessMapping {
  id: string;
  match: {
    method?: string;
    urlPattern?: string;
    pathRegex?: RegExp;
  };
  actionKey: string;
  actionLabel: string;
  module?: string;
  resource?: string;
  buildRequestText?: (ctx: InsightBuildContext) => string;
  buildResponseText?: (ctx: InsightBuildContext) => string;
  buildHints?: (ctx: InsightBuildContext) => string[];
}

export interface NetworkInsight {
  requestId: string;
  actionKey?: string;
  actionLabel: string;
  module?: string;
  resource?: string;
  confidence: InsightConfidence;
  resultCategory: InsightResultCategory;
  requestText: string;
  responseText?: string;
  debugHints?: string[];
  rawRef: {
    method: string;
    urlPattern: string;
    status?: number;
    durationMs?: number;
  };
}
