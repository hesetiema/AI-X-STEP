// diagnosis-session.ts
// 诊断会话核心类型 —— 对应文档 85/87 的 DiagnosisSession 模型

import type { ProbeEvent } from './probe-event';

export type SessionStatus =
  | 'idle'
  | 'recording'
  | 'stopped'
  | 'uploading'
  | 'uploaded'
  | 'failed';

export interface PageContext {
  url: string;
  route?: string;
  title?: string;
  appId?: string;
  module?: string;
  tenantId?: string;
  releaseVersion?: string;
}

export interface UserHint {
  summary?: string;
  expected?: string;
  actual?: string;
}

export interface DiagnosisSession {
  sessionId: string;
  tabId: number;
  status: SessionStatus;
  startedAt: string;
  endedAt?: string;
  pageContext: PageContext;
  events: ProbeEvent[];
  userHint?: UserHint;
  attachments?: SessionAttachment[];
}

export interface SessionAttachment {
  attachmentType: 'screenshot';
  storageKey: string;
  contentType?: string;
  sizeBytes?: number;
}
