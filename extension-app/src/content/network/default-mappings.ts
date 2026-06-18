// content/network/default-mappings.ts
// 迁移自文档 94 —— 内置通用 REST 风格映射规则

import type { ApiBusinessMapping, InsightBuildContext } from '@/shared/types';

function defaultListRequestText(ctx: InsightBuildContext): string {
  const queryKeys = ctx.event.requestSummary?.queryKeys ?? [];
  if (queryKeys.length > 0) {
    return `查询列表（筛选条件: ${queryKeys.join(', ')}）`;
  }
  return '查询列表';
}

function defaultListResponseText(ctx: InsightBuildContext): string {
  const summary = ctx.event.responseSummary;
  if (ctx.event.statusCategory === 'timeout') return '请求超时';
  if (ctx.event.statusCategory === 'failed') {
    return summary?.message ? `接口失败：${summary.message}` : '接口请求失败';
  }
  if (summary?.listCount === 0 || summary?.isEmpty) return '接口成功返回，但结果为空';
  if (typeof summary?.listCount === 'number') return `接口成功返回 ${summary.listCount} 条记录`;
  return '接口请求成功';
}

function defaultListHints(ctx: InsightBuildContext): string[] {
  const summary = ctx.event.responseSummary;
  const hints: string[] = [];
  if (summary?.listCount === 0 || summary?.isEmpty) {
    hints.push('请确认筛选条件是否过严');
    hints.push('页面可能展示为空列表或空态');
  }
  if (ctx.event.statusCategory === 'timeout') hints.push('请检查网络耗时或接口性能');
  if (ctx.event.statusCategory === 'failed') hints.push('请检查接口错误响应与前端兜底提示');
  return hints;
}

function simpleResponseText(prefix: string): (ctx: InsightBuildContext) => string {
  return (ctx) => {
    if (ctx.event.statusCategory === 'timeout') return `${prefix}请求超时`;
    if (ctx.event.statusCategory === 'failed') return `${prefix}请求失败`;
    return `${prefix}请求成功`;
  };
}

export const defaultMappings: ApiBusinessMapping[] = [
  {
    id: 'default-query-list',
    match: { method: 'GET', pathRegex: /\/(list|items|query|search)(\/)?$/i },
    actionKey: 'queryList',
    actionLabel: '查询列表',
    buildRequestText: defaultListRequestText,
    buildResponseText: defaultListResponseText,
    buildHints: defaultListHints,
  },
  {
    id: 'default-query-detail',
    match: { method: 'GET', pathRegex: /\/[^/]+\/[^/]+$/i },
    actionKey: 'queryDetail',
    actionLabel: '查询详情',
    buildRequestText: () => '查询详情',
    buildResponseText: simpleResponseText('详情'),
  },
  {
    id: 'default-create',
    match: { method: 'POST', pathRegex: /\/api\/.+/i },
    actionKey: 'createResource',
    actionLabel: '提交创建',
    buildRequestText: () => '提交创建请求',
    buildResponseText: simpleResponseText('创建'),
  },
  {
    id: 'default-update',
    match: { method: 'PUT', pathRegex: /\/api\/.+/i },
    actionKey: 'updateResource',
    actionLabel: '提交更新',
    buildRequestText: () => '提交更新请求',
    buildResponseText: simpleResponseText('更新'),
  },
  {
    id: 'default-patch',
    match: { method: 'PATCH', pathRegex: /\/api\/.+/i },
    actionKey: 'patchResource',
    actionLabel: '局部更新',
    buildRequestText: () => '提交局部更新请求',
    buildResponseText: simpleResponseText('局部更新'),
  },
  {
    id: 'default-delete',
    match: { method: 'DELETE', pathRegex: /\/api\/.+/i },
    actionKey: 'deleteResource',
    actionLabel: '删除数据',
    buildRequestText: () => '提交删除请求',
    buildResponseText: simpleResponseText('删除'),
  },
];
