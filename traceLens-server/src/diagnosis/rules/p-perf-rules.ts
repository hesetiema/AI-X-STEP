// rules/p-perf-rules.ts
// 页面初始化/性能诊断规则 (P001-P010)
// 基于 PerformanceEvent 中的 Core Web Vitals + 首屏 API 数据

import { DiagnosisRule } from '../interfaces/diagnosis-rule.interface';
import { DiagnosisContext, RuleFinding } from '../interfaces/diagnosis.types';

interface PerfTiming {
  lcp?: number;
  fcp?: number;
  ttfb?: number;
  cls?: number;
  firstScreenReadyMs?: number;
  lastApiEndMs?: number;
  observations?: string[];
}

interface PerfApi {
  url: string;
  method: string;
  status?: number;
  startedAt: number;
  durationMs: number;
  phaseDerived: 'success' | 'error' | 'timeout' | 'slow' | 'normal';
  isBlocking?: boolean;
}

function getPerfEvent(context: DiagnosisContext): {
  timing: PerfTiming;
  apis: PerfApi[];
} | null {
  const perfEvent = context.evidence.find(
    (e) => e.type === 'performance_event' && (e.value as Record<string, unknown>)?.perfType === 'first_screen_complete',
  );
  if (!perfEvent) return null;
  const val = perfEvent.value as Record<string, unknown>;
  return {
    timing: (val.timing ?? {}) as PerfTiming,
    apis: (val.firstScreenApis ?? []) as PerfApi[],
  };
}

function makeFinding(
  code: string,
  name: string,
  layer: string,
  cluster: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  isSymptomOnly: boolean,
  confidence: number,
  title: string,
  summary: string,
  evidenceIds: string[],
  detail: Record<string, unknown>,
): RuleFinding {
  return {
    ruleCode: code,
    title,
    summary,
    confidence,
    score: 0,
    layer,
    cluster,
    evidenceIds,
    isSymptomOnly,
    detail,
    rule: { code, name, cluster, layer, severity, isSymptomOnly },
  };
}

// ─── P001: Slow LCP ────────────────────────────────────────────
export class P001SlowLcpRule implements DiagnosisRule {
  readonly code = 'P001';

  evaluate(context: DiagnosisContext): RuleFinding[] {
    const pf = getPerfEvent(context);
    if (!pf || typeof pf.timing.lcp !== 'number' || pf.timing.lcp <= 2500) return [];

    const hasBlockingSlowApi = pf.apis.some(
      (a) => a.isBlocking === true && a.durationMs > 500,
    );

    return [makeFinding(
      'P001', 'Slow LCP',
      'page_load', 'slow_lcp', 'high', false,
      hasBlockingSlowApi ? 0.75 : 0.80,
      'Slow Largest Contentful Paint (LCP)',
      `LCP measured at ${Math.round(pf.timing.lcp)}ms, exceeding the 2500ms "poor" threshold.${
        hasBlockingSlowApi ? ' May be caused by slow blocking API calls.' : ' No slow blocking API detected; suspect frontend rendering pipeline or large resource load.'
      }`,
      context.evidence.filter((e) => e.type === 'performance_event').map((e) => e.id),
      { lcpMs: pf.timing.lcp, fcpMs: pf.timing.fcp, ttfbMs: pf.timing.ttfb, hasBlockingSlowApi },
    )];
  }
}

// ─── P002: Slow TTFB ───────────────────────────────────────────
export class P002SlowTtfbRule implements DiagnosisRule {
  readonly code = 'P002';

  evaluate(context: DiagnosisContext): RuleFinding[] {
    const pf = getPerfEvent(context);
    if (!pf || typeof pf.timing.ttfb !== 'number' || pf.timing.ttfb <= 800) return [];

    return [makeFinding(
      'P002', 'Slow TTFB',
      'page_load', 'slow_ttfb', 'high', false,
      0.82,
      'Slow Time to First Byte (TTFB)',
      `TTFB measured at ${Math.round(pf.timing.ttfb)}ms, exceeding the 800ms "poor" threshold. Suspect server/infrastructure response delay at the edge or origin.`,
      context.evidence.filter((e) => e.type === 'performance_event').map((e) => e.id),
      { ttfbMs: pf.timing.ttfb, lcpMs: pf.timing.lcp },
    )];
  }
}

// ─── P003: High CLS (symptom only) ─────────────────────────────
export class P003HighClsRule implements DiagnosisRule {
  readonly code = 'P003';

  evaluate(context: DiagnosisContext): RuleFinding[] {
    const pf = getPerfEvent(context);
    if (!pf || typeof pf.timing.cls !== 'number' || pf.timing.cls <= 0.1) return [];

    return [makeFinding(
      'P003', 'High CLS',
      'page_load', 'high_cls', 'medium', true,
      0.75,
      'High Cumulative Layout Shift (CLS)',
      `CLS measured at ${pf.timing.cls.toFixed(3)}, exceeding the 0.1 "poor" threshold. Layout instability detected, which degrades user experience and may cause mis-clicks.`,
      context.evidence.filter((e) => e.type === 'performance_event').map((e) => e.id),
      { cls: pf.timing.cls },
    )];
  }
}

// ─── P004: Slow first-screen API ───────────────────────────────
export class P004SlowFirstScreenApiRule implements DiagnosisRule {
  readonly code = 'P004';

  evaluate(context: DiagnosisContext): RuleFinding[] {
    const pf = getPerfEvent(context);
    if (!pf) return [];

    const slowApis = pf.apis.filter((a) => a.durationMs > 500);
    if (slowApis.length === 0) return [];

    const worst = slowApis.reduce((a, b) => (a.durationMs > b.durationMs ? a : b));

    return [makeFinding(
      'P004', 'Slow first-screen API',
      'api', 'slow_first_screen_api', 'medium', false,
      0.72,
      'Slow first-screen API call detected',
      `${slowApis.length} first-screen API call(s) exceeded 500ms. Slowest: ${worst.method} ${worst.url} at ${Math.round(worst.durationMs)}ms.`,
      context.evidence.filter((e) => e.type === 'performance_event').map((e) => e.id),
      { slowApiCount: slowApis.length, worstUrl: worst.url, worstDurationMs: worst.durationMs },
    )];
  }
}

// ─── P005: Blocking API slow ───────────────────────────────────
export class P005BlockingApiSlowRule implements DiagnosisRule {
  readonly code = 'P005';

  evaluate(context: DiagnosisContext): RuleFinding[] {
    const pf = getPerfEvent(context);
    if (!pf || typeof pf.timing.lcp !== 'number' || pf.timing.lcp <= 2500) return [];

    const blockingSlow = pf.apis.filter(
      (a) => a.isBlocking === true && a.durationMs > 500,
    );
    if (blockingSlow.length === 0) return [];

    return [makeFinding(
      'P005', 'Blocking API slow',
      'api', 'blocking_api_slow', 'high', false,
      0.85,
      'Blocking API is bottleneck for page load',
      `${blockingSlow.length} blocking API call(s) exceeded 500ms while LCP was ${Math.round(pf.timing.lcp)}ms. API response is delaying the page from reaching visual completeness.`,
      context.evidence.filter((e) => e.type === 'performance_event').map((e) => e.id),
      {
        lcpMs: pf.timing.lcp,
        blockingSlowCount: blockingSlow.length,
        worstUrl: blockingSlow[0]?.url,
        worstDurationMs: blockingSlow[0]?.durationMs,
      },
    )];
  }
}

// ─── P006: First-screen API error ──────────────────────────────
export class P006FirstScreenApiErrorRule implements DiagnosisRule {
  readonly code = 'P006';

  evaluate(context: DiagnosisContext): RuleFinding[] {
    const pf = getPerfEvent(context);
    if (!pf) return [];

    const errors = pf.apis.filter(
      (a) => a.phaseDerived === 'error' || (a.status != null && a.status >= 500),
    );
    if (errors.length === 0) return [];

    const first = errors[0];

    return [makeFinding(
      'P006', 'First-screen API error',
      'api', 'first_screen_api_error', 'high', false,
      0.88,
      'First-screen API request failed',
      `${errors.length} first-screen API call(s) failed or returned 5xx. First failure: ${first.method} ${first.url} (status=${first.status ?? 'error'}).`,
      context.evidence.filter((e) => e.type === 'performance_event').map((e) => e.id),
      { errorCount: errors.length, firstUrl: first.url, firstStatus: first.status },
    )];
  }
}

// ─── P007: Slow page overall (symptom only) ────────────────────
export class P007SlowPageOverallRule implements DiagnosisRule {
  readonly code = 'P007';

  evaluate(context: DiagnosisContext): RuleFinding[] {
    const pf = getPerfEvent(context);
    if (!pf || typeof pf.timing.firstScreenReadyMs !== 'number' || pf.timing.firstScreenReadyMs <= 4000) return [];

    // Only fire if there's no specific slow-LCP or slow-API finding (avoids overlap)
    const hasBlockingSlow = pf.apis.some((a) => a.isBlocking === true && a.durationMs > 500);
    const hasSlowLcp = typeof pf.timing.lcp === 'number' && pf.timing.lcp > 2500;
    if (hasBlockingSlow || hasSlowLcp) return [];

    return [makeFinding(
      'P007', 'Slow page overall',
      'page_load', 'slow_page_overall', 'medium', true,
      0.65,
      'Slow page load overall',
      `First screen ready at ${Math.round(pf.timing.firstScreenReadyMs)}ms (4s+), but no single clear bottleneck identified. Possible cumulative effect of many small delays.`,
      context.evidence.filter((e) => e.type === 'performance_event').map((e) => e.id),
      { firstScreenReadyMs: pf.timing.firstScreenReadyMs, apiCount: pf.apis.length },
    )];
  }
}

// ─── P008: Resource waterfall ──────────────────────────────────
export class P008ResourceWaterfallRule implements DiagnosisRule {
  readonly code = 'P008';

  evaluate(context: DiagnosisContext): RuleFinding[] {
    const pf = getPerfEvent(context);
    if (!pf) return [];

    const blockingApis = pf.apis.filter((a) => a.isBlocking === true);
    if (blockingApis.length < 8) return [];

    return [makeFinding(
      'P008', 'Resource waterfall',
      'frontend_app', 'resource_waterfall', 'medium', false,
      0.70,
      'Excessive blocking API waterfall',
      `${blockingApis.length} blocking first-screen API calls detected. Consider consolidating sequential calls into a single bulk endpoint or adding parallel request logic.`,
      context.evidence.filter((e) => e.type === 'performance_event').map((e) => e.id),
      { blockingApiCount: blockingApis.length, totalApiCount: pf.apis.length },
    )];
  }
}

// ─── P009: TTFB + API correlation ──────────────────────────────
export class P009TtfbApiCorrelationRule implements DiagnosisRule {
  readonly code = 'P009';

  evaluate(context: DiagnosisContext): RuleFinding[] {
    const pf = getPerfEvent(context);
    if (!pf || typeof pf.timing.ttfb !== 'number' || pf.timing.ttfb <= 800) return [];

    const slowFirstApi = pf.apis.find((a) => a.durationMs > 800);
    if (!slowFirstApi) return [];

    return [makeFinding(
      'P009', 'TTFB + API correlation',
      'bff', 'ttfb_api_correlation', 'high', false,
      0.78,
      'TTFB and first-screen API both slow — likely BFF/gateway bottleneck',
      `TTFB at ${Math.round(pf.timing.ttfb)}ms + slow API (${slowFirstApi.method} ${slowFirstApi.url} at ${Math.round(slowFirstApi.durationMs)}ms). Both indicators point to the gateway/BFF layer as the bottleneck.`,
      context.evidence.filter((e) => e.type === 'performance_event').map((e) => e.id),
      { ttfbMs: pf.timing.ttfb, apiUrl: slowFirstApi.url, apiDurationMs: slowFirstApi.durationMs },
    )];
  }
}

// ─── P010: No performance data (degenerate) ────────────────────
export class P010NoPerfDataRule implements DiagnosisRule {
  readonly code = 'P010';

  evaluate(context: DiagnosisContext): RuleFinding[] {
    const perfEvents = context.evidence.filter((e) => e.type === 'performance_event');
    if (perfEvents.length > 0) return [];

    return [makeFinding(
      'P010', 'No performance data',
      'page_load', 'no_perf_data', 'low', false,
      0.30,
      'No page-load performance data captured',
      'No performance_event evidence was included in this diagnosis. Page-load health cannot be assessed. PerformanceObserver may not have been available.',
      [],
      { evidenceCount: context.evidence.length },
    )];
  }
}

// ─── P011: Frontend settle gap ─────────────────────────────────
// 对应文档 R5：接口成功但渲染延迟过长
export class P011FrontendSettleGapRule implements DiagnosisRule {
  readonly code = 'P011';

  evaluate(context: DiagnosisContext): RuleFinding[] {
    const pf = getPerfEvent(context);
    if (!pf) return [];

    const lastApiEndMs = pf.timing.lastApiEndMs;
    const firstScreenReadyMs = pf.timing.firstScreenReadyMs;
    if (typeof lastApiEndMs !== 'number' || typeof firstScreenReadyMs !== 'number') return [];

    const settleGapMs = firstScreenReadyMs - lastApiEndMs;
    if (settleGapMs <= 2000) return [];

    // 需同时存在 UI loading 症状，排除无 loading 的正常场景
    const hasLoadingSymptom = context.evidence.some(
      (e) => e.type === 'ui_state' && (e.label.includes('loading') || (e.value as Record<string, unknown>)?.stateType === 'loading'),
    );
    if (!hasLoadingSymptom) return [];

    return [makeFinding(
      'P011', 'Frontend settle gap',
      'frontend_app', 'frontend_settle_gap', 'medium', false,
      0.68,
      'Frontend settle gap too large',
      `Last first-screen API completed at ${Math.round(lastApiEndMs)}ms, but first screen wasn\'t ready until ${Math.round(firstScreenReadyMs)}ms (gap=${Math.round(settleGapMs)}ms). API responses are back but the UI is still not ready — suspect frontend state convergence delay or main thread blocking.`,
      context.evidence.filter((e) => e.type === 'performance_event' || e.type === 'ui_state').map((e) => e.id),
      { lastApiEndMs, firstScreenReadyMs, settleGapMs },
    )];
  }
}

// ─── P012: Serial dependency ───────────────────────────────────
// 对应文档 R3：串行依赖拉长初始化
export class P012SerialDependencyRule implements DiagnosisRule {
  readonly code = 'P012';

  evaluate(context: DiagnosisContext): RuleFinding[] {
    const pf = getPerfEvent(context);
    if (!pf || pf.apis.length < 3) return [];

    const apis = pf.apis.filter((a) => typeof a.startedAt === 'number');
    if (apis.length < 3) return [];

    const sorted = [...apis].sort((a, b) => a.startedAt - b.startedAt);
    let serialChains = 0;
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const prevEnd = prev.startedAt + prev.durationMs;
      // The next request started AFTER the previous one ended (within a 200ms window for thread scheduling)
      if (curr.startedAt >= prevEnd && curr.startedAt - prevEnd < 200) {
        serialChains++;
      }
    }

    if (serialChains < 2) return [];

    const totalDuration = sorted.length > 0
      ? sorted[sorted.length - 1].startedAt + sorted[sorted.length - 1].durationMs - sorted[0].startedAt
      : 0;

    return [makeFinding(
      'P012', 'Serial dependency',
      'frontend_app', 'serial_dependency', 'medium', false,
      0.73,
      'Serial API dependency detected during page init',
      `${serialChains} sequential API call(s) detected out of ${sorted.length} total. The requests appear to be serially chained (next starts only after previous ends), causing total init time to approach sum of individual durations (≈${Math.round(totalDuration)}ms). Consider parallelizing independent requests.`,
      context.evidence.filter((e) => e.type === 'performance_event').map((e) => e.id),
      { serialChains, totalApiCount: sorted.length, totalDurationMs: totalDuration },
    )];
  }
}

// ─── P013: Repeat request ──────────────────────────────────────
// 对应文档 R7：重复请求/重试导致初始化拉长
export class P013RepeatRequestRule implements DiagnosisRule {
  readonly code = 'P013';

  evaluate(context: DiagnosisContext): RuleFinding[] {
    const pf = getPerfEvent(context);
    if (!pf || pf.apis.length < 3) return [];

    // Group by URL pattern (strip query string for matching)
    const urlPattern = (url: string): string => {
      try { return new URL(url).pathname; } catch { return url; }
    };

    const groups = new Map<string, typeof pf.apis>();
    for (const a of pf.apis) {
      const key = `${a.method}:${urlPattern(a.url)}`;
      const group = groups.get(key) || [];
      group.push(a);
      groups.set(key, group);
    }

    const repeats = [...groups.entries()]
      .filter(([_, group]) => group.length >= 3)
      .map(([key, group]) => ({ key, count: group.length, totalMs: group.reduce((s, a) => s + a.durationMs, 0) }));

    if (repeats.length === 0) return [];

    const worst = repeats.reduce((a, b) => (a.totalMs > b.totalMs ? a : b));

    return [makeFinding(
      'P013', 'Repeat request',
      'frontend_app', 'repeat_request', 'medium', false,
      0.66,
      'Repeated requests detected during page init',
      `"${worst.key}" was called ${worst.count} times during initialization (total ${Math.round(worst.totalMs)}ms). Repeated calls to the same endpoint in the init window may indicate inadvertent duplicate triggers or aggressive retry logic.`,
      context.evidence.filter((e) => e.type === 'performance_event').map((e) => e.id),
      { repeatCount: repeats.length, worstPattern: worst.key, worstCallCount: worst.count, worstTotalMs: worst.totalMs },
    )];
  }
}
