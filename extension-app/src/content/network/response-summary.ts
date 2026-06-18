// content/network/response-summary.ts
// 迁移自文档 94 —— 从响应中提取轻量摘要

import type { ResponseSummary } from '@/shared/types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getListCount(data: unknown): number | undefined {
  if (Array.isArray(data)) return data.length;
  if (!isRecord(data)) return undefined;

  const candidates = ['items', 'list', 'rows', 'records'];
  for (const key of candidates) {
    const value = data[key];
    if (Array.isArray(value)) return value.length;
  }
  return undefined;
}

function getTotal(data: unknown): number | undefined {
  if (!isRecord(data)) return undefined;
  const candidates = ['total', 'count'];
  for (const key of candidates) {
    const value = data[key];
    if (typeof value === 'number') return value;
  }
  return undefined;
}

export function buildResponseSummary(body: unknown, status?: number): ResponseSummary {
  const summary: ResponseSummary = {};

  if (typeof status === 'number') {
    summary.success = status >= 200 && status < 300;
  }

  if (Array.isArray(body)) {
    summary.listCount = body.length;
    summary.isEmpty = body.length === 0;
    summary.hasListField = true;
    return summary;
  }

  if (!isRecord(body)) return summary;

  summary.hasDataField = 'data' in body;
  summary.hasErrorField = 'error' in body || 'errors' in body;

  if ('code' in body) {
    const code = body.code;
    if (typeof code === 'string' || typeof code === 'number') {
      summary.code = code;
    }
  }

  if ('message' in body && typeof body.message === 'string') {
    summary.message = body.message;
  }

  if ('success' in body && typeof body.success === 'boolean') {
    summary.success = body.success;
  }

  const directListCount = getListCount(body);
  const directTotal = getTotal(body);

  if (typeof directListCount === 'number') {
    summary.listCount = directListCount;
    summary.hasListField = true;
  }
  if (typeof directTotal === 'number') {
    summary.total = directTotal;
  }

  const data = body.data;
  if (typeof summary.listCount !== 'number' && data !== undefined) {
    const nestedListCount = getListCount(data);
    if (typeof nestedListCount === 'number') {
      summary.listCount = nestedListCount;
      summary.hasListField = true;
    }
  }
  if (typeof summary.total !== 'number' && data !== undefined) {
    const nestedTotal = getTotal(data);
    if (typeof nestedTotal === 'number') {
      summary.total = nestedTotal;
    }
  }

  if (typeof summary.listCount === 'number') {
    summary.isEmpty = summary.listCount === 0;
  }

  return summary;
}
