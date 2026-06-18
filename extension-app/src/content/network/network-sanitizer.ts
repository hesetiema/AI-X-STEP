// content/network/network-sanitizer.ts
// 迁移自文档 95 —— URL 脱敏 / query 过滤 / 敏感字段屏蔽 / body 摘要

import type {
  RawNetworkEvent,
  RequestSummary,
  ResponseSummary,
  SanitizedNetworkEvent,
} from '@/shared/types';
import { isSensitiveKey } from '@/shared/utils';
import { buildResponseSummary } from './response-summary';

const MAX_BODY_KEYS = 10;

function buildUrlPattern(url: string): string {
  try {
    const u = new URL(url, location.origin);
    const pathParts = u.pathname.split('/').map((part) => {
      if (/^\d+$/.test(part)) return '{id}';
      if (/^[0-9a-f]{8,}$/i.test(part)) return '{id}';
      return part;
    });
    return pathParts.join('/');
  } catch {
    return url.split('?')[0];
  }
}

function sanitizeQueryKeys(search: string): string[] {
  if (!search) return [];
  const params = new URLSearchParams(search);
  const keys: string[] = [];
  for (const key of params.keys()) {
    if (!isSensitiveKey(key)) keys.push(key);
  }
  return keys.slice(0, MAX_BODY_KEYS);
}

function extractBodyKeys(body: unknown): string[] {
  if (!body || typeof body !== 'object') return [];
  const source =
    typeof (body as { body?: unknown }).body === 'string'
      ? safeJsonParse((body as { body: string }).body)
      : body;
  if (!source || typeof source !== 'object') return [];
  return Object.keys(source as Record<string, unknown>)
    .filter((k) => !isSensitiveKey(k))
    .slice(0, MAX_BODY_KEYS);
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function estimateBodySize(body: unknown): number | undefined {
  if (!body) return undefined;
  if (typeof body === 'string') return body.length;
  try {
    return JSON.stringify(body).length;
  } catch {
    return undefined;
  }
}

export interface SanitizeOptions {
  dropHeaders?: boolean;
}

export function sanitizeNetworkEvent(
  raw: RawNetworkEvent,
  _options: SanitizeOptions = {},
): SanitizedNetworkEvent {
  let urlObj: URL | null = null;
  try {
    urlObj = new URL(raw.url, location.origin);
  } catch {
    urlObj = null;
  }

  const urlPattern = buildUrlPattern(raw.url);
  const queryKeys = urlObj ? sanitizeQueryKeys(urlObj.search) : [];

  const requestBody = raw.requestBody;
  const bodyKeys = extractBodyKeys(requestBody);

  const requestSummary: RequestSummary | undefined =
    queryKeys.length > 0 || bodyKeys.length > 0
      ? {
          queryKeys: queryKeys.length > 0 ? queryKeys : undefined,
          bodyKeys: bodyKeys.length > 0 ? bodyKeys : undefined,
          bodySize: estimateBodySize(requestBody),
        }
      : undefined;

  let responseSummary: ResponseSummary | undefined;
  if (raw.phase === 'response' || raw.phase === 'error') {
    responseSummary = buildResponseSummary(raw.responseBody, raw.status);
  }

  return {
    requestId: raw.requestId,
    traceId: raw.traceId,
    method: raw.method,
    url: urlObj ? `${urlObj.origin}${urlObj.pathname}` : raw.url.split('?')[0],
    urlPattern,
    status: raw.status,
    durationMs: raw.durationMs,
    requestSummary,
    responseSummary,
    errorMessage: raw.errorMessage,
  };
}
