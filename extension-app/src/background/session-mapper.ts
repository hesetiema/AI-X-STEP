// background/session-mapper.ts
// DiagnosisSession → CreateDiagnosisDto 转换
// 插件 ProbeEvent[] → 后端 EvidenceItem[]

import type {
  CreateDiagnosisDto,
  DiagnosisSession,
  EvidenceItemDto,
  ProbeEvent,
} from '@/shared/types';
import { EVIDENCE_TYPE_MAP } from '@/shared/constants';
import { generateId } from '@/shared/utils';

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
  }
}

function buildValue(event: ProbeEvent): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { eventId: _eventId, occurredAt: _occurredAt, tabId: _tabId, ...rest } = event as ProbeEvent & Record<string, unknown>;
  return rest;
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
