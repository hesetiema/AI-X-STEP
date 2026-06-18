下面直接给你 **`network-normalizer.ts` + `network-sanitizer.ts` 骨架**。  
我会顺手补一个很小的 `url-utils` 风格辅助实现，避免这两个文件太空。

尽量保持：

- 能直接接到你前面的 `types.ts`
- 先满足 MVP
- 后续方便继续扩展

---

# 1. `network-sanitizer.ts`

职责：

- 脱敏 URL
- 提取 query keys
- 提取 body keys
- 只保留轻量 response summary
- 过滤敏感字段
- 输出 `SanitizedNetworkEvent`

```ts
// network-sanitizer.ts

import type {
  RawNetworkEvent,
  RequestSummary,
  ResponseSummary,
  SanitizedNetworkEvent,
} from './types';
import { buildResponseSummary } from './response-summary';

export interface NetworkSanitizerOptions {
  allowedQueryKeys?: string[];
  maskedQueryKeys?: string[];
  maskedBodyKeys?: string[];
  maskedResponseKeys?: string[];
  maxBodyKeyCount?: number;
  maxUrlLength?: number;
}

const DEFAULT_MASKED_KEYS = [
  'token',
  'authorization',
  'password',
  'passwd',
  'mobile',
  'phone',
  'idCard',
  '身份证',
  'cookie',
  'secret',
];

const DEFAULT_OPTIONS: Required<NetworkSanitizerOptions> = {
  allowedQueryKeys: [],
  maskedQueryKeys: DEFAULT_MASKED_KEYS,
  maskedBodyKeys: DEFAULT_MASKED_KEYS,
  maskedResponseKeys: DEFAULT_MASKED_KEYS,
  maxBodyKeyCount: 20,
  maxUrlLength: 500,
};

export interface NetworkSanitizer {
  sanitize(event: RawNetworkEvent): SanitizedNetworkEvent;
}

export class DefaultNetworkSanitizer implements NetworkSanitizer {
  private readonly options: Required<NetworkSanitizerOptions>;

  constructor(options?: NetworkSanitizerOptions) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };
  }

  sanitize(event: RawNetworkEvent): SanitizedNetworkEvent {
    const method = event.method.toUpperCase();
    const safeUrl = this.normalizeUrl(event.url);
    const urlPattern = this.toUrlPattern(safeUrl);

    const requestSummary = this.buildRequestSummary(
      safeUrl,
      event.requestBody,
    );

    const responseSummary = this.buildSafeResponseSummary(
      event.responseBody,
      event.status,
    );

    return {
      requestId: event.requestId,
      traceId: event.traceId,
      method,
      url: safeUrl,
      urlPattern,
      status: event.status,
      durationMs: event.durationMs,
      requestSummary,
      responseSummary,
      errorMessage: this.sanitizeErrorMessage(event.errorMessage),
    };
  }

  private normalizeUrl(url: string): string {
    const trimmed = url.slice(0, this.options.maxUrlLength);

    try {
      const parsed = new URL(trimmed, 'http://localhost');
      const sanitizedParams = new URLSearchParams();

      for (const [key, value] of parsed.searchParams.entries()) {
        if (
          this.options.allowedQueryKeys.length > 0
          && !this.options.allowedQueryKeys.includes(key)
        ) {
          continue;
        }

        if (this.isMaskedKey(key, this.options.maskedQueryKeys)) {
          sanitizedParams.set(key, '***');
        } else {
          sanitizedParams.set(key, this.truncateValue(value));
        }
      }

      const queryString = sanitizedParams.toString();
      return `${parsed.pathname}${queryString ? `?${queryString}` : ''}`;
    } catch {
      return trimmed;
    }
  }

  private toUrlPattern(url: string): string {
    const path = url.split('?')[0] || '/';

    return path
      .split('/')
      .map((segment) => {
        if (!segment) return '';
        if (/^\d+$/.test(segment)) return ':id';
        if (/^[0-9a-f]{8,}$/i.test(segment)) return ':id';
        return segment;
      })
      .join('/');
  }

  private buildRequestSummary(url: string, body: unknown): RequestSummary {
    const queryKeys = this.extractQueryKeys(url);
    const bodyKeys = this.extractBodyKeys(body).slice(
      0,
      this.options.maxBodyKeyCount,
    );

    return {
      queryKeys: queryKeys.length > 0 ? queryKeys : undefined,
      bodyKeys: bodyKeys.length > 0 ? bodyKeys : undefined,
      bodySize: this.estimateBodySize(body),
    };
  }

  private buildSafeResponseSummary(
    responseBody: unknown,
    status?: number,
  ): ResponseSummary | undefined {
    const summary = buildResponseSummary(
      this.maskSensitiveObject(responseBody, this.options.maskedResponseKeys),
      status,
    );

    return Object.keys(summary).length > 0 ? summary : undefined;
  }

  private extractQueryKeys(url: string): string[] {
    try {
      const parsed = new URL(url, 'http://localhost');
      const keys = Array.from(parsed.searchParams.keys());

      if (this.options.allowedQueryKeys.length === 0) {
        return keys.filter((key) => !this.isMaskedKey(key, this.options.maskedQueryKeys));
      }

      return keys.filter((key) => this.options.allowedQueryKeys.includes(key));
    } catch {
      return [];
    }
  }

  private extractBodyKeys(body: unknown): string[] {
    if (!this.isRecord(body)) {
      return [];
    }

    return Object.keys(body).filter(
      (key) => !this.isMaskedKey(key, this.options.maskedBodyKeys),
    );
  }

  private estimateBodySize(body: unknown): number | undefined {
    if (body == null) {
      return undefined;
    }

    try {
      return JSON.stringify(body).length;
    } catch {
      return undefined;
    }
  }

  private sanitizeErrorMessage(message?: string): string | undefined {
    if (!message) {
      return undefined;
    }

    return this.truncateValue(message, 200);
  }

  private truncateValue(value: string, maxLength = 100): string {
    if (value.length <= maxLength) {
      return value;
    }

    return `${value.slice(0, maxLength)}...`;
  }

  private isMaskedKey(key: string, maskedKeys: string[]): boolean {
    return maskedKeys.some(
      (maskedKey) => maskedKey.toLowerCase() === key.toLowerCase(),
    );
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private maskSensitiveObject(
    value: unknown,
    maskedKeys: string[],
  ): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.maskSensitiveObject(item, maskedKeys));
    }

    if (!this.isRecord(value)) {
      return value;
    }

    const result: Record<string, unknown> = {};

    for (const [key, fieldValue] of Object.entries(value)) {
      if (this.isMaskedKey(key, maskedKeys)) {
        result[key] = '***';
      } else if (this.isRecord(fieldValue) || Array.isArray(fieldValue)) {
        result[key] = this.maskSensitiveObject(fieldValue, maskedKeys);
      } else {
        result[key] = fieldValue;
      }
    }

    return result;
  }
}
```

---

# 2. `network-normalizer.ts`

职责：

- 把 `SanitizedNetworkEvent` 统一成 `NormalizedNetworkEvent`
- 规范 method / actionKind / statusCategory
- 提取 `resourceName`
- 给后续 `insight transformer` 提供稳定输入

```ts
// network-normalizer.ts

import type {
  ActionKind,
  NormalizedNetworkEvent,
  SanitizedNetworkEvent,
  StatusCategory,
} from './types';

export interface NetworkNormalizer {
  normalize(event: SanitizedNetworkEvent): NormalizedNetworkEvent;
}

export class DefaultNetworkNormalizer implements NetworkNormalizer {
  normalize(event: SanitizedNetworkEvent): NormalizedNetworkEvent {
    const method = event.method.toUpperCase();
    const actionKind = this.resolveActionKind(method, event.urlPattern);
    const statusCategory = this.resolveStatusCategory(
      event.status,
      event.errorMessage,
    );
    const resourceName = this.resolveResourceName(event.urlPattern);

    return {
      requestId: event.requestId,
      traceId: event.traceId,
      method,
      url: event.url,
      urlPattern: event.urlPattern,
      resourceName,
      actionKind,
      statusCategory,
      status: event.status,
      durationMs: event.durationMs,
      requestSummary: event.requestSummary,
      responseSummary: event.responseSummary,
      errorMessage: event.errorMessage,
    };
  }

  private resolveActionKind(
    method: string,
    urlPattern: string,
  ): ActionKind {
    if (method === 'GET') {
      if (this.looksLikeDetail(urlPattern)) {
        return 'detail';
      }

      return 'query';
    }

    if (method === 'POST') {
      return 'create';
    }

    if (method === 'PUT' || method === 'PATCH') {
      return 'update';
    }

    if (method === 'DELETE') {
      return 'delete';
    }

    return 'custom';
  }

  private resolveStatusCategory(
    status?: number,
    errorMessage?: string,
  ): StatusCategory {
    if (errorMessage && /timeout|timed out/i.test(errorMessage)) {
      return 'timeout';
    }

    if (typeof status === 'number') {
      if (status >= 200 && status < 300) {
        return 'success';
      }

      if (status >= 400) {
        return 'failed';
      }
    }

    if (errorMessage) {
      return 'failed';
    }

    return 'unknown';
  }

  private resolveResourceName(urlPattern: string): string | undefined {
    const segments = urlPattern
      .split('?')[0]
      .split('/')
      .filter(Boolean)
      .filter((segment) => segment !== 'api' && !segment.startsWith(':'));

    if (segments.length === 0) {
      return undefined;
    }

    const lastSegment = segments[segments.length - 1];

    if (
      ['list', 'detail', 'query', 'search', 'items'].includes(
        lastSegment.toLowerCase(),
      )
      && segments.length >= 2
    ) {
      return segments[segments.length - 2];
    }

    return lastSegment;
  }

  private looksLikeDetail(urlPattern: string): boolean {
    const segments = urlPattern.split('/').filter(Boolean);
    return segments.some((segment) => segment.startsWith(':'));
  }
}
```

---

# 3. 典型串联用法

这里给你一个从 raw -> sanitized -> normalized 的最小调用示例。

```ts
import type { RawNetworkEvent } from './types';
import { DefaultNetworkSanitizer } from './network-sanitizer';
import { DefaultNetworkNormalizer } from './network-normalizer';

const sanitizer = new DefaultNetworkSanitizer({
  allowedQueryKeys: ['page', 'pageSize', 'status', 'keyword'],
});

const normalizer = new DefaultNetworkNormalizer();

const rawEvent: RawNetworkEvent = {
  source: 'fetch',
  phase: 'response',
  requestId: 'req-001',
  method: 'get',
  url: '/api/orders/list?page=1&pageSize=20&token=secret-token',
  status: 200,
  startedAt: Date.now() - 320,
  endedAt: Date.now(),
  durationMs: 320,
  requestBody: undefined,
  responseBody: {
    code: 0,
    message: 'ok',
    data: {
      total: 0,
      list: [],
    },
  },
};

const sanitized = sanitizer.sanitize(rawEvent);
const normalized = normalizer.normalize(sanitized);

console.log('sanitized', sanitized);
console.log('normalized', normalized);
```

---

# 4. 这两个文件目前已经覆盖的能力

这版骨架已经能做：

## `network-sanitizer.ts`
- method 标准化
- URL query 过滤
- token/password 等字段屏蔽
- body keys 提取
- response summary 轻量生成
- error message 裁剪

## `network-normalizer.ts`
- GET/POST/PUT/PATCH/DELETE -> actionKind
- status/error -> statusCategory
- 从 `urlPattern` 粗提取 `resourceName`
- 给 insight transformer 提供稳定输入

---

# 5. 你后面很可能会继续补的点

我顺手把下一步扩展位也标出来：

---

## 5.1 `network-sanitizer.ts` 后续可补
- header 白名单
- request body 白名单提取
- response body 更严格 schema 摘要
- query 参数 alias 映射
- 敏感字段路径级 masking（不仅 key 名）

---

## 5.2 `network-normalizer.ts` 后续可补
- 更稳的 REST path pattern 识别
- GraphQL 请求分类
- RPC 风格 path 映射
- 结合 bridge context 修正 actionKind/resourceName
- duration 阈值分层（normal/slow/very-slow）

---

# 6. 和你前一版模块的连接方式

你前面已经有：

- `response-summary.ts`
- `mapping-registry.ts`
- `network-insight-transformer.ts`

现在链路就可以串起来：

```ts
RawNetworkEvent
  -> DefaultNetworkSanitizer.sanitize()
  -> SanitizedNetworkEvent
  -> DefaultNetworkNormalizer.normalize()
  -> NormalizedNetworkEvent
  -> DefaultNetworkInsightTransformer.transform()
  -> NetworkInsight
```

这个已经是一条完整的 MVP 主链了。

---

如果你愿意，我下一条可以继续直接给你：

1. **`network-timeline-builder.ts` 骨架**
2. **这 7 个文件的一组 Jest 单测骨架**