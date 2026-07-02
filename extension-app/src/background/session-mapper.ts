// background/session-mapper.ts
// DiagnosisSession → CreateDiagnosisDto 转换
// 插件 ProbeEvent[] → 后端 EvidenceItem[]
//
// 注意：domContext 对象需在此层做精简，去掉重复的 parentChain 文本，
// 只保留 element + containerContext + formContext 的关键字段。
// 否则 LLM prompt 会被大量 DOM 上下文文本撑爆导致超时。

import type {
  CreateDiagnosisDto,
  DiagnosisSession,
  EvidenceItemDto,
  ProbeEvent,
} from '@/shared/types';
import { EVIDENCE_TYPE_MAP } from '@/shared/constants';
import { generateId } from '@/shared/utils';
import type { DomContext } from '@/shared/types/dom-context';

function eventToEvidence(event: ProbeEvent): EvidenceItemDto {
  const type = EVIDENCE_TYPE_MAP[event.kind] ?? event.kind;
  const label = buildLabel(event);
  const value = buildValue(event);
  return {
    id: generateId('ev_'),
    type,
    label,
    value,
    source: event.kind,
    timestamp: new Date(event.occurredAt).toISOString(),
  };
}

function buildLabel(event: ProbeEvent): string {
  switch (event.kind) {
    case 'ui':
      return `${event.eventType}${event.targetName ? ` -> ${event.targetName}` : ''}`;
    case 'ui_state':
      return `ui_state:${event.stateType}`;
    case 'network':
      return `${event.method} ${event.insight?.actionLabel ?? ''}`.trim();
    case 'error':
      return `error:${event.errorType}`;
    case 'bridge':
      return `bridge:${event.bridgeType}${event.businessAction ? `:${event.businessAction}` : ''}`;
    case 'observation':
      return `observation:${event.observationType}`;
    case 'performance':
      return `performance:${event.perfType}`;
    case 'pipeline_check':
      return `pipeline:${event.pipelineId}`;
  }
}

function buildValue(event: ProbeEvent): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { eventId: _eventId, occurredAt: _occurredAt, tabId: _tabId, ...rest } = event as ProbeEvent & Record<string, unknown>;

  // 精简 domContext：去掉 parentChain（重复信息），保留核心字段
  if (rest['domContext']) {
    rest['domContext'] = compactDomContext(rest['domContext'] as DomContext);
  }

  return rest;
}

/**
 * 精简 domContext：
 * - 保留 element（tag + text + id + ariaLabel + name + type）
 * - 保留 containerContext（tag + heading + ariaLabel）
 * - 保留 formContext（action + method + fields）
 * - 去掉 parentChain（已在 containerContext 中体现层级）
 * - 去掉 siblingLabels（无关紧要）
 * - fields 每个字段只保留 name + type + label
 */
function compactDomContext(dc: DomContext): Partial<DomContext> {
  const out: Record<string, unknown> = {};

  if (dc.element) {
    const e = dc.element as unknown as Record<string, unknown>;
    const ce: Record<string, unknown> = {};
    for (const k of ['tag', 'text', 'id', 'ariaLabel', 'name', 'type']) {
      if (e[k] != null) ce[k] = e[k];
    }
    out['element'] = ce;
  }

  if (dc.containerContext) {
    const cc = dc.containerContext as unknown as Record<string, unknown>;
    const ccc: Record<string, unknown> = {};
    for (const k of ['tag', 'heading', 'ariaLabel']) {
      if (cc[k] != null) ccc[k] = cc[k];
    }
    out['containerContext'] = ccc;
  }

  if (dc.formContext) {
    const fc = dc.formContext as unknown as Record<string, unknown>;
    const cfc: Record<string, unknown> = {};
    if (fc['action']) cfc['action'] = fc['action'];
    if (fc['method']) cfc['method'] = fc['method'];
    if (Array.isArray(fc['fields'])) {
      cfc['fields'] = (fc['fields'] as Array<Record<string, unknown>>).map((f) => {
        const cf: Record<string, unknown> = {};
        for (const k of ['name', 'type', 'label']) {
          if (f[k] != null) cf[k] = f[k];
        }
        return cf;
      });
    }
    out['formContext'] = cfc;
  }

  return out as Partial<DomContext>;
}

function buildSymptoms(session: DiagnosisSession): string[] {
  const symptoms: string[] = [];
  if (session.userHint?.summary) symptoms.push(session.userHint.summary);
  if (session.userHint?.expected) symptoms.push(`预期: ${session.userHint.expected}`);
  if (session.userHint?.actual) symptoms.push(`实际: ${session.userHint.actual}`);
  return symptoms;
}

export function sessionToDto(session: DiagnosisSession): CreateDiagnosisDto {
  const evidence: EvidenceItemDto[] = session.events.map(eventToEvidence);

  return {
    appId: session.pageContext.appId ?? 'unknown',
    pageUrl: session.pageContext.url,
    title: session.pageContext.title ?? session.pageContext.route ?? 'Untitled',
    description: session.userHint?.summary,
    evidence,
    symptoms: buildSymptoms(session),
  };
}
