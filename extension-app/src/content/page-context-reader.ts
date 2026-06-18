// content/page-context-reader.ts
// 页面上下文读取 —— url / title / route / 桥接上下文

import type { PageContext } from '@/shared/types';
import { BRIDGE_CONTEXT_KEY } from '@/shared/constants';

export function readPageContext(): PageContext {
  const context: PageContext = {
    url: location.href,
    route: location.pathname + location.search,
    title: document.title || undefined,
  };

  const bridge = window[BRIDGE_CONTEXT_KEY];
  if (bridge && typeof bridge === 'object') {
    const appId = readField(bridge, 'appId');
    const module = readField(bridge, 'module');
    const tenantId = readField(bridge, 'tenantId');
    const releaseVersion = readField(bridge, 'releaseVersion');
    if (appId) context.appId = appId;
    if (module) context.module = module;
    if (tenantId) context.tenantId = tenantId;
    if (releaseVersion) context.releaseVersion = releaseVersion;
  }

  return context;
}

function readField(obj: Record<string, unknown>, key: string): string | undefined {
  const value = obj[key];
  return typeof value === 'string' ? value : undefined;
}
