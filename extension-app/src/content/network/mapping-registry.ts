// content/network/mapping-registry.ts
// 迁移自文档 94 —— 接口→业务动作映射规则注册与匹配

import type { ApiBusinessMapping, InsightBuildContext } from '@/shared/types';

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
      const methodMatched =
        !mapping.match.method ||
        mapping.match.method.toUpperCase() === event.method.toUpperCase();
      if (!methodMatched) return false;

      const urlPatternMatched =
        !mapping.match.urlPattern || mapping.match.urlPattern === event.urlPattern;
      if (!urlPatternMatched) return false;

      const pathRegexMatched =
        !mapping.match.pathRegex || mapping.match.pathRegex.test(event.urlPattern);
      if (!pathRegexMatched) return false;

      return true;
    });
  }
}
