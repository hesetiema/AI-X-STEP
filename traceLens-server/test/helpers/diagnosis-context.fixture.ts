import { DiagnosisContext, EvidenceItem } from '../../src/diagnosis/interfaces/diagnosis.types';

interface BuildDiagnosisContextOptions {
  taskId?: string;
  appId?: string;
  pageUrl?: string;
  title?: string;
  evidence?: Partial<EvidenceItem>[];
  symptoms?: string[];
}

export function buildDiagnosisContext(opts: BuildDiagnosisContextOptions = {}): DiagnosisContext {
  return {
    taskId: opts.taskId ?? 'test-task-id',
    appId: opts.appId ?? 'test-app',
    pageUrl: opts.pageUrl ?? 'https://example.com/test',
    title: opts.title ?? 'Test diagnosis',
    evidence: (opts.evidence ?? []).map((e) => ({
      id: e.id ?? `ev-${Math.random().toString(36).slice(2, 8)}`,
      type: e.type ?? 'ui_event',
      label: e.label ?? '',
      value: e.value ?? {},
      source: e.source ?? 'test',
      timestamp: e.timestamp ?? new Date().toISOString(),
    })),
    symptoms: opts.symptoms ?? [],
    createdAt: new Date(),
  };
}
