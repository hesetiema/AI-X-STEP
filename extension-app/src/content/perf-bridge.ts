// content/perf-bridge.ts
// 桥接 PerformanceEvent → PagePerfSummary → PERF_UPDATE 消息
// 修复 PagePerfIndicator 永远停在 "Measuring page load..." 的死链

import type { PerformanceEvent, PagePerfSummary } from '@/shared/types';
import { RECORDER_CONFIG } from '@/shared/constants';

export function buildPagePerfSummary(event: PerformanceEvent): PagePerfSummary {
  const t = event.timing;
  const observations = t.observations ?? [];
  const isSlow =
    (t.lcp != null && t.lcp > RECORDER_CONFIG.SLOW_LCP_THRESHOLD_MS) ||
    (t.fcp != null && t.fcp > RECORDER_CONFIG.SLOW_FCP_THRESHOLD_MS) ||
    (t.ttfb != null && t.ttfb > RECORDER_CONFIG.SLOW_TTFB_THRESHOLD_MS) ||
    (t.cls != null && t.cls > RECORDER_CONFIG.HIGH_CLS_THRESHOLD) ||
    observations.includes('slow_api');

  return {
    pageReadyMs: t.firstScreenReadyMs ?? 0,
    lcpMs: t.lcp,
    fcpMs: t.fcp,
    ttfbMs: t.ttfb,
    cls: t.cls,
    isSlow,
    observations,
  };
}

export function notifyPerfUpdate(summary: PagePerfSummary, tabId: number): void {
  chrome.runtime.sendMessage({
    type: 'PERF_UPDATE',
    tabId,
    perf: summary,
  }).catch(() => {
    // background may not be ready; silent fail
  });
}
