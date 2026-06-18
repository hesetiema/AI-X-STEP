下面直接给你一版可落地的 **TypeScript 代码骨架草案**。  
我按你前面收口的方案拆成 5 个文件：

- `types.ts`
- `mapping-registry.ts`
- `default-mappings.ts`
- `response-summary.ts`
- `network-insight-transformer.ts`

风格上我会偏 **可直接拷进项目再继续补实现**，而不是纯概念示例。

---

# 1. `types.ts`

```ts
// types.ts

export type NetworkSource = 'fetch' | 'xhr';
export type NetworkPhase = 'request' | 'response' | 'error';

export type ActionKind =
  | 'query'
  | 'detail'
  | 'create'
  | 'update'
  | 'delete'
  | 'custom';

export type StatusCategory =
  | 'success'
  | 'failed'
  | 'timeout'
  | 'unknown';

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

export interface PageContext {
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
  pageContext?: PageContext;
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
```

---

# 2. `mapping-registry.ts`

```ts
// mapping-registry.ts

import type { ApiBusinessMapping, InsightBuildContext } from './types';

export interface MappingRegistry {
  register(mappings: ApiBusinessMapping[]): void;
  getAll(): ApiBusinessMapping[];
  match(ctx: InsightBuildContext): ApiBusinessMapping | undefined;
}

export class InMemoryMappingRegistry implements MappingRegistry {
  private mappings: ApiBusinessMapping[] = [];

  register(mappings: ApiBusinessMapping[]): void {
    this.mappings.push(...mappings);
  }

  getAll(): ApiBusinessMapping[] {
    return [...this.mappings];
  }

  match(ctx: InsightBuildContext): ApiBusinessMapping | undefined {
    const { event } = ctx;

    return this.mappings.find((mapping) => {
      const methodMatched = !mapping.match.method
        || mapping.match.method.toUpperCase() === event.method.toUpperCase();

      if (!methodMatched) {
        return false;
      }

      const urlPatternMatched = !mapping.match.urlPattern
        || mapping.match.urlPattern === event.urlPattern;

      if (!urlPatternMatched) {
        return false;
      }

      const pathRegexMatched = !mapping.match.pathRegex
        || mapping.match.pathRegex.test(event.urlPattern);

      if (!pathRegexMatched) {
        return false;
      }

      return true;
    });
  }
}
```

---

# 3. `default-mappings.ts`

```ts
// default-mappings.ts

import type { ApiBusinessMapping, InsightBuildContext } from './types';

function defaultListRequestText(ctx: InsightBuildContext): string {
  const queryKeys = ctx.event.requestSummary?.queryKeys ?? [];
  if (queryKeys.length > 0) {
    return `查询列表（筛选条件: ${queryKeys.join(', ')}）`;
  }
  return '查询列表';
}

function defaultListResponseText(ctx: InsightBuildContext): string {
  const summary = ctx.event.responseSummary;

  if (ctx.event.statusCategory === 'timeout') {
    return '请求超时';
  }

  if (ctx.event.statusCategory === 'failed') {
    return summary?.message
      ? `接口失败：${summary.message}`
      : '接口请求失败';
  }

  if (summary?.listCount === 0 || summary?.isEmpty) {
    return '接口成功返回，但结果为空';
  }

  if (typeof summary?.listCount === 'number') {
    return `接口成功返回 ${summary.listCount} 条记录`;
  }

  return '接口请求成功';
}

function defaultListHints(ctx: InsightBuildContext): string[] {
  const summary = ctx.event.responseSummary;
  const hints: string[] = [];

  if (summary?.listCount === 0 || summary?.isEmpty) {
    hints.push('请确认筛选条件是否过严');
    hints.push('页面可能展示为空列表或空态');
  }

  if (ctx.event.statusCategory === 'timeout') {
    hints.push('请检查网络耗时或接口性能');
  }

  if (ctx.event.statusCategory === 'failed') {
    hints.push('请检查接口错误响应与前端兜底提示');
  }

  return hints;
}

export const defaultMappings: ApiBusinessMapping[] = [
  {
    id: 'default-query-list',
    match: {
      method: 'GET',
      pathRegex: /\/(list|items|query|search)(\/)?$/i,
    },
    actionKey: 'queryList',
    actionLabel: '查询列表',
    buildRequestText: defaultListRequestText,
    buildResponseText: defaultListResponseText,
    buildHints: defaultListHints,
  },
  {
    id: 'default-query-detail',
    match: {
      method: 'GET',
      pathRegex: /\/[^/]+\/[^/]+$/i,
    },
    actionKey: 'queryDetail',
    actionLabel: '查询详情',
    buildRequestText: () => '查询详情',
    buildResponseText: (ctx) => {
      if (ctx.event.statusCategory === 'timeout') return '详情请求超时';
      if (ctx.event.statusCategory === 'failed') return '详情请求失败';
      return '详情请求成功';
    },
  },
  {
    id: 'default-create',
    match: {
      method: 'POST',
      pathRegex: /\/api\/.+/i,
    },
    actionKey: 'createResource',
    actionLabel: '提交创建',
    buildRequestText: () => '提交创建请求',
    buildResponseText: (ctx) => {
      if (ctx.event.statusCategory === 'timeout') return '创建请求超时';
      if (ctx.event.statusCategory === 'failed') return '创建请求失败';
      return '创建请求成功';
    },
  },
  {
    id: 'default-update',
    match: {
      method: 'PUT',
      pathRegex: /\/api\/.+/i,
    },
    actionKey: 'updateResource',
    actionLabel: '提交更新',
    buildRequestText: () => '提交更新请求',
    buildResponseText: (ctx) => {
      if (ctx.event.statusCategory === 'timeout') return '更新请求超时';
      if (ctx.event.statusCategory === 'failed') return '更新请求失败';
      return '更新请求成功';
    },
  },
  {
    id: 'default-patch',
    match: {
      method: 'PATCH',
      pathRegex: /\/api\/.+/i,
    },
    actionKey: 'patchResource',
    actionLabel: '局部更新',
    buildRequestText: () => '提交局部更新请求',
    buildResponseText: (ctx) => {
      if (ctx.event.statusCategory === 'timeout') return '局部更新请求超时';
      if (ctx.event.statusCategory === 'failed') return '局部更新请求失败';
      return '局部更新请求成功';
    },
  },
  {
    id: 'default-delete',
    match: {
      method: 'DELETE',
      pathRegex: /\/api\/.+/i,
    },
    actionKey: 'deleteResource',
    actionLabel: '删除数据',
    buildRequestText: () => '提交删除请求',
    buildResponseText: (ctx) => {
      if (ctx.event.statusCategory === 'timeout') return '删除请求超时';
      if (ctx.event.statusCategory === 'failed') return '删除请求失败';
      return '删除请求成功';
    },
  },
];
```

---

# 4. `response-summary.ts`

```ts
// response-summary.ts

import type { ResponseSummary } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getListCount(data: unknown): number | undefined {
  if (Array.isArray(data)) {
    return data.length;
  }

  if (!isRecord(data)) {
    return undefined;
  }

  const candidates = ['items', 'list', 'rows', 'records'];

  for (const key of candidates) {
    const value = data[key];
    if (Array.isArray(value)) {
      return value.length;
    }
  }

  return undefined;
}

function getTotal(data: unknown): number | undefined {
  if (!isRecord(data)) {
    return undefined;
  }

  const candidates = ['total', 'count'];

  for (const key of candidates) {
    const value = data[key];
    if (typeof value === 'number') {
      return value;
    }
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

  if (!isRecord(body)) {
    return summary;
  }

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
```

---

# 5. `network-insight-transformer.ts`

```ts
// network-insight-transformer.ts

import type {
  ApiBusinessMapping,
  InsightBuildContext,
  InsightConfidence,
  InsightResultCategory,
  NetworkInsight,
} from './types';
import type { MappingRegistry } from './mapping-registry';

export interface NetworkInsightTransformer {
  transform(ctx: InsightBuildContext): NetworkInsight;
}

export class DefaultNetworkInsightTransformer implements NetworkInsightTransformer {
  constructor(private readonly mappingRegistry: MappingRegistry) {}

  transform(ctx: InsightBuildContext): NetworkInsight {
    const mapping = this.mappingRegistry.match(ctx);

    const actionKey = mapping?.actionKey;
    const actionLabel = this.resolveActionLabel(ctx, mapping);
    const module = this.resolveModule(ctx, mapping);
    const resource = this.resolveResource(ctx, mapping);
    const confidence = this.resolveConfidence(ctx, mapping);
    const resultCategory = this.resolveResultCategory(ctx);
    const requestText = this.resolveRequestText(ctx, mapping, actionLabel);
    const responseText = this.resolveResponseText(ctx, mapping, resultCategory);
    const debugHints = this.resolveDebugHints(ctx, mapping, resultCategory);

    return {
      requestId: ctx.event.requestId,
      actionKey,
      actionLabel,
      module,
      resource,
      confidence,
      resultCategory,
      requestText,
      responseText,
      debugHints,
      rawRef: {
        method: ctx.event.method,
        urlPattern: ctx.event.urlPattern,
        status: ctx.event.status,
        durationMs: ctx.event.durationMs,
      },
    };
  }

  private resolveActionLabel(
    ctx: InsightBuildContext,
    mapping?: ApiBusinessMapping,
  ): string {
    if (mapping?.actionLabel) {
      return mapping.actionLabel;
    }

    const latestAction = ctx.latestInteraction?.businessAction;
    if (latestAction) {
      return latestAction;
    }

    switch (ctx.event.actionKind) {
      case 'query':
        return '查询数据';
      case 'detail':
        return '查询详情';
      case 'create':
        return '提交创建';
      case 'update':
        return '提交更新';
      case 'delete':
        return '删除数据';
      default:
        return '请求数据';
    }
  }

  private resolveModule(
    ctx: InsightBuildContext,
    mapping?: ApiBusinessMapping,
  ): string | undefined {
    return (
      ctx.latestModuleState?.module
      || ctx.pageContext?.module
      || mapping?.module
    );
  }

  private resolveResource(
    ctx: InsightBuildContext,
    mapping?: ApiBusinessMapping,
  ): string | undefined {
    return mapping?.resource || ctx.event.resourceName;
  }

  private resolveConfidence(
    ctx: InsightBuildContext,
    mapping?: ApiBusinessMapping,
  ): InsightConfidence {
    if (mapping) {
      return 'high';
    }

    if (ctx.latestInteraction?.businessAction || ctx.pageContext?.module) {
      return 'medium';
    }

    return 'low';
    }

  private resolveResultCategory(
    ctx: InsightBuildContext,
  ): InsightResultCategory {
    const { event } = ctx;
    const summary = event.responseSummary;

    if (event.statusCategory === 'timeout') {
      return 'timeout';
    }

    if (event.statusCategory === 'failed') {
      return 'failed';
    }

    if (summary?.isEmpty || summary?.listCount === 0) {
      return 'empty';
    }

    if (
      event.statusCategory === 'success'
      && event.actionKind === 'query'
      && summary?.hasDataField
      && summary?.hasListField === false
    ) {
      return 'invalid_data';
    }

    if (event.statusCategory === 'success') {
      return 'success';
    }

    return 'unknown';
  }

  private resolveRequestText(
    ctx: InsightBuildContext,
    mapping: ApiBusinessMapping | undefined,
    actionLabel: string,
  ): string {
    if (mapping?.buildRequestText) {
      return mapping.buildRequestText(ctx);
    }

    const queryKeys = ctx.event.requestSummary?.queryKeys ?? [];

    if (queryKeys.length > 0) {
      return `${actionLabel}（筛选条件: ${queryKeys.join(', ')}）`;
    }

    return actionLabel;
  }

  private resolveResponseText(
    ctx: InsightBuildContext,
    mapping: ApiBusinessMapping | undefined,
    resultCategory: InsightResultCategory,
  ): string | undefined {
    if (mapping?.buildResponseText) {
      return mapping.buildResponseText(ctx);
    }

    const summary = ctx.event.responseSummary;

    switch (resultCategory) {
      case 'timeout':
        return '请求超时';
      case 'failed':
        return summary?.message ? `接口失败：${summary.message}` : '接口请求失败';
      case 'empty':
        return '接口成功返回，但结果为空';
      case 'invalid_data':
        return '接口请求成功，但返回结构异常';
      case 'success':
        if (typeof summary?.listCount === 'number') {
          return `接口成功返回 ${summary.listCount} 条记录`;
        }
        return '接口请求成功';
      default:
        return undefined;
    }
  }

  private resolveDebugHints(
    ctx: InsightBuildContext,
    mapping: ApiBusinessMapping | undefined,
    resultCategory: InsightResultCategory,
  ): string[] | undefined {
    const customHints = mapping?.buildHints?.(ctx) ?? [];
    const defaultHints: string[] = [];

    switch (resultCategory) {
      case 'empty':
        defaultHints.push('请确认筛选条件是否过严');
        defaultHints.push('页面可能展示为空列表或空态');
        break;
      case 'timeout':
        defaultHints.push('请检查网络耗时、网关或接口性能');
        break;
      case 'failed':
        defaultHints.push('请检查接口错误响应与页面兜底提示');
        break;
      case 'invalid_data':
        defaultHints.push('请检查接口返回字段结构是否符合页面预期');
        break;
      default:
        break;
    }

    const merged = [...customHints, ...defaultHints];
    return merged.length > 0 ? merged : undefined;
  }
}
```

---

# 6. 一个最小使用示例

这个示例把上面几个文件串起来。

```ts
import { InMemoryMappingRegistry } from './mapping-registry';
import { defaultMappings } from './default-mappings';
import { DefaultNetworkInsightTransformer } from './network-insight-transformer';
import type { InsightBuildContext, NormalizedNetworkEvent } from './types';

const registry = new InMemoryMappingRegistry();
registry.register(defaultMappings);

const transformer = new DefaultNetworkInsightTransformer(registry);

const event: NormalizedNetworkEvent = {
  requestId: 'req-001',
  method: 'GET',
  url: '/api/orders?page=1&status=paid',
  urlPattern: '/api/orders',
  resourceName: 'orders',
  actionKind: 'query',
  statusCategory: 'success',
  status: 200,
  durationMs: 420,
  requestSummary: {
    queryKeys: ['page', 'status'],
  },
  responseSummary: {
    success: true,
    listCount: 0,
    total: 0,
    isEmpty: true,
    hasDataField: true,
    hasListField: true,
  },
};

const ctx: InsightBuildContext = {
  event,
  pageContext: {
    appId: 'erp-console',
    module: 'order-list',
    route: '/orders',
  },
  latestInteraction: {
    businessAction: 'searchOrders',
    targetName: '查询',
  },
};

const insight = transformer.transform(ctx);

console.log(insight);
```

---

# 7. 这版骨架的特点

这版代码骨架已经具备：

- 类型边界清楚
- 映射规则可扩展
- 默认映射可直接用
- 响应摘要单独抽离
- insight 转换与 registry 解耦

也就是说，你后面可以很容易继续补：

- `network-normalizer.ts`
- `network-sanitizer.ts`
- `network-timeline-builder.ts`
- `orderMappings.ts`
- Jest 单测

---

如果你愿意，我下一条可以继续直接给你：

1. **`network-normalizer.ts` + `network-sanitizer.ts` 骨架**
2. **这 5 个文件对应的 Jest 单测骨架**