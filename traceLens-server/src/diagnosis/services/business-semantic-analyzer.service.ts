import { Injectable, Logger } from '@nestjs/common';
import {
  EvidenceItem,
  DiagnosisContext,
  RankedFinding,
  DominoChain,
  DiagnosisConclusion,
} from '../interfaces/diagnosis.types';

/**
 * 点击 → 网络请求的时序关联
 */
interface ClickNetworkCorrelation {
  clickLabel: string;
  clickDomContext?: string; // serialized DomContext text
  networkLabel: string;
  networkUrl: string;
  networkMethod: string;
  networkStatus?: number;
  networkResultCategory?: string;
  timeDeltaMs?: number;
}

/**
 * 按容器/模块分组的点击事件
 */
interface ClickGroup {
  containerHeading?: string;
  containerAriaLabel?: string;
  formAction?: string;
  formFields: string[];
  clicks: string[];
}

/**
 * 从证据中提取的数据流线索
 */
interface DataFlowHint {
  source: string;
  target: string;
  description: string;
}

/**
 * 调用栈洞察 —— 从点击事件的运行时调用栈中提取模块/函数线索
 */
interface StackInsight {
  clickLabel: string;
  moduleHint: string;
  handlerName: string;
  scopeVariableNames: string[];
}

export interface BusinessContext {
  clickGroups: ClickGroup[];
  correlations: ClickNetworkCorrelation[];
  dataFlowHints: DataFlowHint[];
  stackInsights: StackInsight[];
  pageLoad?: PageLoadContext;
  clickSummary: string;
  toPromptSection(): string;
}

export interface PageLoadContext {
  firstScreenReadyMs?: number;
  lcp?: number;
  fcp?: number;
  ttfb?: number;
  cls?: number;
  navigationalType?: string;
  firstScreenApiCount: number;
  blockingApiCount: number;
  slowApiCount: number;
  errorApiCount: number;
  observations: string[];
}

@Injectable()
export class BusinessSemanticAnalyzer {
  private readonly logger = new Logger(BusinessSemanticAnalyzer.name);

  preprocess(ctx: DiagnosisContext): BusinessContext {
    const clickGroups = buildClickGroups(ctx.evidence);
    const correlations = buildClickNetworkCorrelations(ctx.evidence);
    const dataFlowHints = buildDataFlowHints(ctx.evidence);
    const stackInsights = buildStackInsights(ctx.evidence);
    const pageLoad = buildPageLoadContext(ctx.evidence);
    const clickSummary = buildClickSummary(ctx.evidence, clickGroups, correlations);

    return {
      clickGroups,
      correlations,
      dataFlowHints,
      stackInsights,
      pageLoad,
      clickSummary,
      toPromptSection(): string {
        return buildPromptSectionFn(this);
      },
    };
  }
}

// ===== 私有实现 =====

/**
 * 从 DOM 上下文值中提取容器信息分组的点击
 */
function buildClickGroups(evidence: EvidenceItem[]): ClickGroup[] {
  const groups: ClickGroup[] = [];
  const containerMap = new Map<string, ClickGroup>();

  for (const ev of evidence) {
    if (ev.type !== 'ui_event') continue;
    const v = ev.value;

    const domCtx = v?.['domContext'] as Record<string, unknown> | undefined;
    if (!domCtx) continue;

    const containerCtx = domCtx['containerContext'] as Record<string, unknown> | undefined;
    const formCtx = domCtx['formContext'] as Record<string, unknown> | undefined;
    const element = domCtx['element'] as Record<string, unknown> | undefined;

    const heading = containerCtx?.['heading'] as string | undefined;
    const ariaLabel = containerCtx?.['ariaLabel'] as string | undefined;
    const formAction = formCtx?.['action'] as string | undefined;

    const key = heading || ariaLabel || formAction || 'unknown';

    let group = containerMap.get(key);
    if (!group) {
      group = {
        containerHeading: heading,
        containerAriaLabel: ariaLabel,
        formAction,
        formFields: [],
        clicks: [],
      };
      containerMap.set(key, group);
      groups.push(group);
    }

    const clickText = (element?.['text'] as string) ||
      (element?.['ariaLabel'] as string) ||
      (element?.['name'] as string) ||
      ev.label;
    group.clicks.push(clickText);

    if (formCtx) {
      const fields = formCtx['fields'] as Array<Record<string, unknown>> | undefined;
      if (fields) {
        for (const f of fields) {
          const label = f['label'] as string | undefined;
          const name = f['name'] as string | undefined;
          if (label || name) {
            group.formFields.push(`${label || name} (${f['type'] || 'text'})`);
          }
        }
      }
    }
  }

  return groups;
}

/**
 * 将用户的点击事件与后续网络请求做时序关联
 * 策略: 同一标签中，click 事件后 2 秒内的第一个网络请求视为关联
 */
function buildClickNetworkCorrelations(evidence: EvidenceItem[]): ClickNetworkCorrelation[] {
  const correlations: ClickNetworkCorrelation[] = [];
  const pendingClicks: Array<{ timestamp: number; label: string; domContext?: string }> = [];

  for (const ev of evidence) {
    if (ev.type === 'ui_event') {
      const v = ev.value;
      const eventType = v?.['eventType'];
      if (eventType !== 'click') continue;

      const ts = parseTimestamp(ev.timestamp);
      if (ts === 0) continue;

      const domCtx = v?.['domContext'];
      const domContextStr = domCtx
        ? domContextToCompactText(domCtx as Record<string, unknown>)
        : undefined;

      pendingClicks.push({
        timestamp: ts,
        label: ev.label,
        domContext: domContextStr,
      });
    } else if (ev.type === 'network_event' || ev.type === 'network_error') {
      const v = ev.value;
      const phase = v?.['phase'];
      if (phase !== 'response' && phase !== 'error') continue;

      const ts = parseTimestamp(ev.timestamp);
      if (ts === 0) continue;

      // 查找 2 秒内的最近点击
      const recentClick = pendingClicks.find((c) => ts - c.timestamp >= 0 && ts - c.timestamp <= 2000);
      if (recentClick) {
        const insight = v?.['insight'] as Record<string, unknown> | undefined;
        correlations.push({
          clickLabel: recentClick.label,
          clickDomContext: recentClick.domContext,
          networkLabel: ev.label,
          networkUrl: (v?.['url'] as string) || '',
          networkMethod: (v?.['method'] as string) || '',
          networkStatus: v?.['status'] as number | undefined,
          networkResultCategory: insight?.['resultCategory'] as string | undefined,
          timeDeltaMs: ts - recentClick.timestamp,
        });
        // 移除已匹配的点击
        pendingClicks.splice(pendingClicks.indexOf(recentClick), 1);
      }
    }
  }

  return correlations;
}

/**
 * 从网络请求字段中提取数据流线索
 */
function buildDataFlowHints(evidence: EvidenceItem[]): DataFlowHint[] {
  const hints: DataFlowHint[] = [];

  for (const ev of evidence) {
    if (ev.type !== 'network_event') continue;
    const v = ev.value;
    if (!v) continue;

    const url = v['url'] as string | undefined;
    if (!url) continue;

    const path = extractPath(url);
    const method = (v['method'] as string) || 'GET';
    const insight = v['insight'] as Record<string, unknown> | undefined;
    const requestText = insight?.['requestText'] as string | undefined;
    const responseText = insight?.['responseText'] as string | undefined;
    const resultCategory = insight?.['resultCategory'] as string | undefined;

    if (resultCategory === 'failed' || resultCategory === 'timeout') {
      hints.push({
        source: `${method} ${path}`,
        target: 'UI',
        description: `请求失败: ${responseText || url}`,
      });
    } else if (resultCategory === 'empty') {
      hints.push({
        source: `${method} ${path}`,
        target: 'UI',
        description: `返回空结果: ${requestText || url} → 页面可能显示空态`,
      });
    }
  }

  return hints;
}

/**
 * 从点击事件的运行时调用栈中提取模块和函数线索。
 * 即使函数名被混淆，URL 路径也能暗示业务模块。
 */
function buildStackInsights(evidence: EvidenceItem[]): StackInsight[] {
  const insights: StackInsight[] = [];

  for (const ev of evidence) {
    if (ev.type !== 'ui_event') continue;
    const v = ev.value;
    const stackTrace = v?.['stackTrace'];
    if (!Array.isArray(stackTrace) || stackTrace.length === 0) continue;

    const firstFrame = stackTrace[0] as Record<string, unknown>;
    const url = (firstFrame['url'] as string) || '';
    const functionName = (firstFrame['functionName'] as string) || '(anonymous)';

    // 从 URL 提取模块线索
    let moduleHint = 'unknown';
    try {
      const u = new URL(url);
      const segments = u.pathname.split('/').filter(Boolean);
      moduleHint = segments.length > 0
        ? segments.slice(-2).join('/')
        : u.pathname || url;
    } catch {
      moduleHint = url.length > 40 ? url.slice(-40) : url;
    }

    // 提取作用域变量名
    const scopeVariables = v?.['scopeVariables'];
    const varNames = Array.isArray(scopeVariables)
      ? (scopeVariables as Array<Record<string, unknown>>)
          .map((s) => s['name'] as string)
          .filter(Boolean)
      : [];

    insights.push({
      clickLabel: ev.label,
      moduleHint,
      handlerName: functionName,
      scopeVariableNames: varNames,
    });
  }

  return insights;
}

/**
 * 构建点击摘要 —— 尝试推断用户的操作意图
 */
function buildClickSummary(
  evidence: EvidenceItem[],
  groups: ClickGroup[],
  correlations: ClickNetworkCorrelation[],
): string {
  const lines: string[] = [];

  if (groups.length > 0) {
    lines.push(`## 业务操作分析`);
    lines.push('');

    for (const g of groups) {
      const heading = g.containerHeading || g.containerAriaLabel || '未知区域';
      lines.push(`### 区域: ${heading}`);

      if (g.clicks.length > 0) {
        const unique = [...new Set(g.clicks)];
        lines.push(`- 点击了: ${unique.join(', ')}`);
      }

      if (g.formFields.length > 0) {
        const unique = [...new Set(g.formFields)];
        lines.push(`- 表单字段: ${unique.join(', ')}`);
      }

      const relatedCorrs = correlations.filter((c) =>
        g.clicks.some((click) => c.clickLabel.includes(click)),
      );

      if (relatedCorrs.length > 0) {
        lines.push(`- 关联的网络请求:`);
        for (const c of relatedCorrs) {
          const statusText = c.networkStatus
            ? ` → ${c.networkStatus}`
            : '';
          lines.push(`  - ${c.networkMethod} ${c.networkUrl}${statusText} (${c.networkResultCategory || 'unknown'})`);
        }
      }

      lines.push('');
    }
  }

  if (correlations.length === 0 && groups.length === 0) {
    const clickCount = evidence.filter((e) => e.type === 'ui_event').length;
    lines.push(`## 用户操作总览`);
    lines.push(`- 共 ${clickCount} 个点击事件，未检测到明确的业务分组或网络关联`);
  }

  return lines.join('\n');
}

// ===== 工具函数 =====

function parseTimestamp(ts: string | undefined): number {
  if (!ts) return 0;
  const d = new Date(ts);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

function extractPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function domContextToCompactText(domCtx: Record<string, unknown>): string {
  const element = domCtx['element'] as Record<string, unknown> | undefined;
  const containerCtx = domCtx['containerContext'] as Record<string, unknown> | undefined;
  const parts: string[] = [];

  if (element) {
    const tag = element['tag'];
    const text = element['text'] || element['ariaLabel'] || element['name'];
    if (text) parts.push(`<${tag}>"${text}"`);
    else parts.push(`<${tag}>`);
  }

  if (containerCtx) {
    const heading = containerCtx['heading'] || containerCtx['ariaLabel'];
    if (heading) parts.push(`in "${heading}"`);
  }

  return parts.join(' ');
}

function buildPageLoadContext(evidence: EvidenceItem[]): PageLoadContext | undefined {
  const perfEvent = evidence.find(
    (e) => e.type === 'performance_event' && (e.value as Record<string, unknown>)?.perfType === 'first_screen_complete',
  );
  if (!perfEvent) return undefined;

  const timing = (perfEvent.value as Record<string, unknown>)?.timing as Record<string, number>;
  const apis = ((perfEvent.value as Record<string, unknown>)?.firstScreenApis ?? []) as Array<Record<string, unknown>>;
  const blocking = apis.filter((a) => a.isBlocking === true);
  const slow = apis.filter((a) => (a.durationMs as number) > 500);
  const errors = apis.filter(
    (a) => a.phaseDerived === 'error' || (a.status as number) >= 500,
  );

  return {
    firstScreenReadyMs: timing?.firstScreenReadyMs,
    lcp: timing?.lcp,
    fcp: timing?.fcp,
    ttfb: timing?.ttfb,
    cls: timing?.cls,
    navigationalType: (perfEvent.value as Record<string, unknown>)?.navigationalType as string,
    firstScreenApiCount: apis.length,
    blockingApiCount: blocking.length,
    slowApiCount: slow.length,
    errorApiCount: errors.length,
    observations: (timing?.observations as unknown as string[]) ?? [],
  };
}

/**
 * 将 BusinessContext 转为 LLM prompt 段落
 */
function buildPromptSectionFn(bc: BusinessContext): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(`## 业务语义分析`);
  lines.push('');

  if (bc.clickGroups.length > 0) {
    lines.push(`### 操作分组 (按页面容器区域)`);
    for (const g of bc.clickGroups) {
      const heading = g.containerHeading || g.containerAriaLabel || '未标记区域';
      lines.push(`- **${heading}**: ${g.clicks.join(', ')}`);
      if (g.formFields.length > 0) {
        lines.push(`  - 表单字段: ${g.formFields.join(', ')}`);
      }
    }
    lines.push('');
  }

  if (bc.correlations.length > 0) {
    lines.push(`### 点击→网络请求 关联`);
    for (const c of bc.correlations) {
      const ctx = c.clickDomContext ? ` (${c.clickDomContext})` : '';
      lines.push(`- 点击"${c.clickLabel}"${ctx} → ${c.networkMethod} ${c.networkUrl} → ${c.networkStatus || '?'} (${c.networkResultCategory || 'unknown'})`);
    }
    lines.push('');
  }

  if (bc.dataFlowHints.length > 0) {
    lines.push(`### 数据流线索`);
    for (const h of bc.dataFlowHints) {
      lines.push(`- ${h.description}`);
    }
    lines.push('');
  }

  if (bc.stackInsights.length > 0) {
    lines.push(`### 运行时调用栈洞察`);
    for (const si of bc.stackInsights) {
      lines.push(`- 点击"${si.clickLabel}" → handler: ${si.handlerName} (module: ${si.moduleHint})`);
      if (si.scopeVariableNames.length > 0) {
        lines.push(`  - 作用域变量: ${si.scopeVariableNames.join(', ')}`);
      }
    }
    lines.push('');
  }

  if (bc.pageLoad) {
    lines.push(`### 页面加载性能`);
    const p = bc.pageLoad;
    lines.push(`- 首屏就绪: ${p.firstScreenReadyMs != null ? (p.firstScreenReadyMs / 1000).toFixed(1) + 's' : '未知'}`);
    lines.push(`- Web Vitals: LCP=${p.lcp != null ? Math.round(p.lcp) + 'ms' : '—'}, FCP=${p.fcp != null ? Math.round(p.fcp) + 'ms' : '—'}, TTFB=${p.ttfb != null ? Math.round(p.ttfb) + 'ms' : '—'}, CLS=${p.cls != null ? p.cls.toFixed(3) : '—'}`);
    lines.push(`- 首屏 API: ${p.firstScreenApiCount} 个请求, ${p.blockingApiCount} 个阻塞, ${p.slowApiCount} 个慢请求, ${p.errorApiCount} 个错误`);
    if (p.observations.length > 0) {
      lines.push(`- 观察: ${p.observations.join(', ')}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// 统一导出名
export { buildPromptSectionFn as buildPromptSection };

