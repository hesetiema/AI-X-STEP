// content/network/network-normalizer.ts
// 迁移自文档 95 —— method→actionKind / status→statusCategory / urlPattern→resourceName

import type {
  ActionKind,
  NormalizedNetworkEvent,
  SanitizedNetworkEvent,
  StatusCategory,
} from '@/shared/types';

function methodToActionKind(method: string): ActionKind {
  switch (method.toUpperCase()) {
    case 'GET': {
      return 'query';
    }
    case 'POST':
      return 'create';
    case 'PUT':
    case 'PATCH':
      return 'update';
    case 'DELETE':
      return 'delete';
    default:
      return 'custom';
  }
}

function statusToCategory(status?: number, errorMessage?: string): StatusCategory {
  if (errorMessage && typeof status !== 'number') return 'failed';
  if (typeof status !== 'number') return 'unknown';
  if (status === 0 || status === 408 || status === 504) return 'timeout';
  if (status >= 500 || status === 0) return 'failed';
  if (status >= 400) return 'failed';
  if (status >= 200 && status < 300) return 'success';
  if (status >= 300 && status < 400) return 'success';
  return 'unknown';
}

function extractResourceName(urlPattern: string): string | undefined {
  const parts = urlPattern.split('/').filter(Boolean);
  if (parts.length === 0) return undefined;

  const apiIndex = parts.findIndex((p) => p.toLowerCase() === 'api');
  const tail = apiIndex >= 0 ? parts.slice(apiIndex + 1) : parts;
  if (tail.length === 0) return undefined;

  const meaningful = tail.filter((p) => !['{id}', 'list', 'items', 'query', 'search'].includes(p));
  const candidate = meaningful[meaningful.length - 1] ?? tail[tail.length - 1];
  return candidate.replace(/[^a-zA-Z0-9_-]/g, '');
}

export function normalizeNetworkEvent(
  sanitized: SanitizedNetworkEvent,
): NormalizedNetworkEvent {
  return {
    ...sanitized,
    actionKind: methodToActionKind(sanitized.method),
    statusCategory: statusToCategory(sanitized.status, sanitized.errorMessage),
    resourceName: extractResourceName(sanitized.urlPattern),
  };
}
