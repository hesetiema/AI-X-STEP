// content/network/network-insight-transformer.ts
// 迁移自文档 94 —— 核心业务摘要转换器

import type {
  ApiBusinessMapping,
  InsightBuildContext,
  InsightConfidence,
  InsightResultCategory,
  NetworkInsight,
} from '@/shared/types';
import type { MappingRegistry } from './mapping-registry';

export interface NetworkInsightTransformer {
  transform(ctx: InsightBuildContext): NetworkInsight;
}

export class DefaultNetworkInsightTransformer implements NetworkInsightTransformer {
  constructor(private readonly mappingRegistry: MappingRegistry) {}

  transform(ctx: InsightBuildContext): NetworkInsight {
    const mapping = this.mappingRegistry.match(ctx);

    return {
      requestId: ctx.event.requestId,
      actionKey: mapping?.actionKey,
      actionLabel: this.resolveActionLabel(ctx, mapping),
      module: this.resolveModule(ctx, mapping),
      resource: this.resolveResource(ctx, mapping),
      confidence: this.resolveConfidence(ctx, mapping),
      resultCategory: this.resolveResultCategory(ctx),
      requestText: this.resolveRequestText(ctx, mapping),
      responseText: this.resolveResponseText(ctx, mapping),
      debugHints: this.resolveDebugHints(ctx, mapping),
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
    if (mapping?.actionLabel) return mapping.actionLabel;
    if (ctx.latestInteraction?.businessAction) return ctx.latestInteraction.businessAction;
    switch (ctx.event.actionKind) {
      case 'query': return '查询数据';
      case 'detail': return '查询详情';
      case 'create': return '提交创建';
      case 'update': return '提交更新';
      case 'delete': return '删除数据';
      default: return '请求数据';
    }
  }

  private resolveModule(
    ctx: InsightBuildContext,
    mapping?: ApiBusinessMapping,
  ): string | undefined {
    return ctx.latestModuleState?.module || ctx.pageContext?.module || mapping?.module;
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
    if (mapping) return 'high';
    if (ctx.latestInteraction?.businessAction || ctx.pageContext?.module) return 'medium';
    return 'low';
  }

  private resolveResultCategory(ctx: InsightBuildContext): InsightResultCategory {
    const { event } = ctx;
    const summary = event.responseSummary;

    if (event.statusCategory === 'timeout') return 'timeout';
    if (event.statusCategory === 'failed') return 'failed';
    if (summary?.isEmpty || summary?.listCount === 0) return 'empty';
    if (
      event.statusCategory === 'success' &&
      event.actionKind === 'query' &&
      summary?.hasDataField &&
      summary?.hasListField === false
    ) {
      return 'invalid_data';
    }
    if (event.statusCategory === 'success') return 'success';
    return 'unknown';
  }

  private resolveRequestText(
    ctx: InsightBuildContext,
    mapping?: ApiBusinessMapping,
  ): string {
    if (mapping?.buildRequestText) return mapping.buildRequestText(ctx);
    const queryKeys = ctx.event.requestSummary?.queryKeys ?? [];
    const label = mapping?.actionLabel ?? '请求数据';
    if (queryKeys.length > 0) return `${label}（筛选条件: ${queryKeys.join(', ')}）`;
    return label;
  }

  private resolveResponseText(
    ctx: InsightBuildContext,
    mapping?: ApiBusinessMapping,
  ): string | undefined {
    if (mapping?.buildResponseText) return mapping.buildResponseText(ctx);
    const summary = ctx.event.responseSummary;
    const category = this.resolveResultCategory(ctx);
    switch (category) {
      case 'timeout': return '请求超时';
      case 'failed': return summary?.message ? `接口失败：${summary.message}` : '接口请求失败';
      case 'empty': return '接口成功返回，但结果为空';
      case 'invalid_data': return '接口请求成功，但返回结构异常';
      case 'success':
        if (typeof summary?.listCount === 'number') return `接口成功返回 ${summary.listCount} 条记录`;
        return '接口请求成功';
      default: return undefined;
    }
  }

  private resolveDebugHints(
    ctx: InsightBuildContext,
    mapping?: ApiBusinessMapping,
  ): string[] | undefined {
    const custom = mapping?.buildHints?.(ctx) ?? [];
    const defaults: string[] = [];
    const category = this.resolveResultCategory(ctx);
    switch (category) {
      case 'empty':
        defaults.push('请确认筛选条件是否过严');
        defaults.push('页面可能展示为空列表或空态');
        break;
      case 'timeout':
        defaults.push('请检查网络耗时、网关或接口性能');
        break;
      case 'failed':
        defaults.push('请检查接口错误响应与页面兜底提示');
        break;
      case 'invalid_data':
        defaults.push('请检查接口返回字段结构是否符合页面预期');
        break;
      default:
        break;
    }
    const merged = [...custom, ...defaults];
    return merged.length > 0 ? merged : undefined;
  }
}
