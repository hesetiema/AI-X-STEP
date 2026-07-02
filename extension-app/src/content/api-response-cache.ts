// content/api-response-cache.ts
// 缓存 API 原始响应体，供 Pipeline Runner 提取字段值。
// NetworkObserver 写入，PipelineRunner 读取。

interface CacheEntry {
  url: string;
  urlPattern: string;
  method: string;
  responseBody: unknown;
  timestamp: number;
}

const MAX_CACHE_SIZE = 50;

class ApiResponseCache {
  private entries: CacheEntry[] = [];

  set(method: string, url: string, urlPattern: string, responseBody: unknown): void {
    if (this.entries.length >= MAX_CACHE_SIZE) {
      this.entries.shift();
    }
    this.entries.push({
      url,
      urlPattern,
      method: method.toUpperCase(),
      responseBody,
      timestamp: Date.now(),
    });
  }

  /** Find the most recent matching entry by method and urlPattern regex match */
  find(method: string, urlPattern: string): CacheEntry | null {
    const upperMethod = method.toUpperCase();
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const entry = this.entries[i];
      if (entry.method !== upperMethod) continue;
      try {
        if (new RegExp(entry.urlPattern).test(urlPattern)) return entry;
      } catch {
        if (entry.urlPattern === urlPattern) return entry;
      }
    }
    return null;
  }

  /** Match by actual URL (used when pipeline source specifies a urlPattern to match against stored URLs) */
  findBySource(method: string, sourceUrlPattern: string): CacheEntry | null {
    const upperMethod = method.toUpperCase();
    const regex = safeRegex(sourceUrlPattern);
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const entry = this.entries[i];
      if (entry.method !== upperMethod) continue;
      try {
        if (regex.test(entry.url)) return entry;
      } catch {
        // skip
      }
    }
    return null;
  }

  clear(): void {
    this.entries = [];
  }
}

function safeRegex(pattern: string): RegExp {
  try {
    return new RegExp(pattern, 'i');
  } catch {
    // Escape regex special chars for literal match
    return new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  }
}

/** Extract value from nested object using dot-notation path */
export function extractFieldPath(obj: unknown, fieldPath: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined;
  const parts = fieldPath.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export const apiResponseCache = new ApiResponseCache();
