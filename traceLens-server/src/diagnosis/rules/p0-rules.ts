import { DiagnosisRule } from '../interfaces/diagnosis-rule.interface';
import { DiagnosisContext, RuleFinding } from '../interfaces/diagnosis.types';

export class R001Api5xxRule implements DiagnosisRule {
  readonly code = 'R001';
  evaluate(context: DiagnosisContext): RuleFinding[] {
    const matched = context.evidence.filter(
      (e) => e.type === 'network_error' && typeof e.value?.status === 'number' && e.value.status >= 500 && e.value.status < 600,
    );
    if (matched.length === 0) return [];
    return [{
      ruleCode: 'R001',
      title: 'API 5xx root cause',
      summary: 'Observed API 5xx response indicating backend/API-side instability.',
      confidence: 0.91,
      score: 91,
      layer: 'api',
      cluster: 'api_failure',
      evidenceIds: matched.map((x) => x.id),
      isSymptomOnly: false,
      detail: { matchedCount: matched.length },
      rule: { code: 'R001', name: 'API 5xx upstream failure', cluster: 'api_failure', layer: 'api', severity: 'high', isSymptomOnly: false },
    }];
  }
}

export class R002ApiTimeoutRule implements DiagnosisRule {
  readonly code = 'R002';
  evaluate(context: DiagnosisContext): RuleFinding[] {
    const matched = context.evidence.filter(
      (e) => e.type === 'network_error' && (e.value?.code === 'ETIMEDOUT' || e.value?.status === 504 || (typeof e.value?.durationMs === 'number' && e.value.durationMs > 3000)),
    );
    if (matched.length === 0) return [];
    return [{
      ruleCode: 'R002',
      title: 'API timeout root cause',
      summary: 'The request path shows timeout behavior consistent with API-side response delay or no response.',
      confidence: 0.87,
      score: 87,
      layer: 'api',
      cluster: 'api_timeout',
      evidenceIds: matched.map((x) => x.id),
      isSymptomOnly: false,
      detail: { matchedCount: matched.length },
      rule: { code: 'R002', name: 'API response timeout', cluster: 'api_timeout', layer: 'api', severity: 'high', isSymptomOnly: false },
    }];
  }
}

export class R003DbTimeoutRule implements DiagnosisRule {
  readonly code = 'R003';
  evaluate(context: DiagnosisContext): RuleFinding[] {
    const matched = context.evidence.filter(
      (e) => e.type === 'trace_span' && e.label.toLowerCase().includes('db') && e.label.toLowerCase().includes('timeout'),
    );
    if (matched.length === 0) return [];
    return [{
      ruleCode: 'R003',
      title: 'DB timeout supporting cause',
      summary: 'Database timeout evidence suggests downstream persistence pressure.',
      confidence: 0.78,
      score: 78,
      layer: 'db',
      cluster: 'db_timeout',
      evidenceIds: matched.map((x) => x.id),
      isSymptomOnly: false,
      detail: { matchedCount: matched.length },
      rule: { code: 'R003', name: 'DB timeout/latency spike', cluster: 'db_timeout', layer: 'db', severity: 'high', isSymptomOnly: false },
    }];
  }
}

export class R004DbConnectionExhaustedRule implements DiagnosisRule {
  readonly code = 'R004';
  evaluate(context: DiagnosisContext): RuleFinding[] {
    const matched = context.evidence.filter(
      (e) => (e.type === 'log' || e.type === 'metric') && (e.label.toLowerCase().includes('connection pool') || e.value?.poolExhausted === true),
    );
    if (matched.length === 0) return [];
    return [{
      ruleCode: 'R004',
      title: 'DB connection exhausted',
      summary: 'Database connection pool exhaustion suggests resource saturation or pool starvation.',
      confidence: 0.83,
      score: 83,
      layer: 'db',
      cluster: 'db_connection_exhausted',
      evidenceIds: matched.map((x) => x.id),
      isSymptomOnly: false,
      detail: { matchedCount: matched.length },
      rule: { code: 'R004', name: 'DB connection pool exhausted', cluster: 'db_connection_exhausted', layer: 'db', severity: 'critical', isSymptomOnly: false },
    }];
  }
}

export class R005UiLoadingSymptomRule implements DiagnosisRule {
  readonly code = 'R005';
  evaluate(context: DiagnosisContext): RuleFinding[] {
    const matched = context.evidence.filter(
      (e) => e.type === 'ui_state' && (e.label.toLowerCase().includes('loading') || (typeof e.value?.loadingMs === 'number' && e.value.loadingMs > 10000)),
    );
    const symptomMatched = context.symptoms.includes('ui_loading');
    if (matched.length === 0 && !symptomMatched) return [];
    return [{
      ruleCode: 'R005',
      title: 'UI loading symptom',
      summary: 'UI remained in loading/stuck state; likely symptom rather than root cause.',
      confidence: 0.74,
      score: 74,
      layer: 'ui_state',
      cluster: 'ui_loading',
      evidenceIds: matched.map((x) => x.id),
      isSymptomOnly: true,
      detail: { matchedCount: matched.length, symptomMatched },
      rule: { code: 'R005', name: 'UI loading/blocked state', cluster: 'ui_loading', layer: 'ui_state', severity: 'medium', isSymptomOnly: true },
    }];
  }
}

export class R006UiErrorToastSymptomRule implements DiagnosisRule {
  readonly code = 'R006';
  evaluate(context: DiagnosisContext): RuleFinding[] {
    const matched = context.evidence.filter(
      (e) => e.type === 'ui_state' && (e.label.toLowerCase().includes('error toast') || e.value?.toastType === 'error'),
    );
    if (matched.length === 0) return [];
    return [{
      ruleCode: 'R006',
      title: 'UI error toast symptom',
      summary: 'User-visible error toast/banner indicates a surfaced failure symptom in the UI layer.',
      confidence: 0.69,
      score: 69,
      layer: 'ui_state',
      cluster: 'ui_error_toast',
      evidenceIds: matched.map((x) => x.id),
      isSymptomOnly: true,
      detail: { matchedCount: matched.length },
      rule: { code: 'R006', name: 'UI error toast/banner', cluster: 'ui_error_toast', layer: 'ui_state', severity: 'medium', isSymptomOnly: true },
    }];
  }
}

export class R007FrontendEventLostRule implements DiagnosisRule {
  readonly code = 'R007';
  evaluate(context: DiagnosisContext): RuleFinding[] {
    const userActions = context.evidence.filter((e) => e.type === 'ui_event');
    const stateChanges = context.evidence.filter((e) => e.type === 'ui_state');
    const networkErrors = context.evidence.filter((e) => e.type === 'network_error');
    if (userActions.length > 0 && stateChanges.length === 0 && networkErrors.length > 0) {
      return [{
        ruleCode: 'R007',
        title: 'Frontend event lost',
        summary: 'User action detected but no state change or response observed, possible event dispatch failure.',
        confidence: 0.65,
        score: 65,
        layer: 'frontend_app',
        cluster: 'frontend_event_lost',
        evidenceIds: userActions.map((x) => x.id),
        isSymptomOnly: false,
        detail: { userActionCount: userActions.length },
        rule: { code: 'R007', name: 'Frontend event not handled', cluster: 'frontend_event_lost', layer: 'frontend_app', severity: 'medium', isSymptomOnly: false },
      }];
    }
    return [];
  }
}

export class R008BffGatewayFailureRule implements DiagnosisRule {
  readonly code = 'R008';
  evaluate(context: DiagnosisContext): RuleFinding[] {
    const matched = context.evidence.filter(
      (e) => e.type === 'network_error' && (e.value?.status === 502 || e.value?.status === 504 || e.label.toLowerCase().includes('gateway')),
    );
    if (matched.length === 0) return [];
    return [{
      ruleCode: 'R008',
      title: 'BFF or gateway failure',
      summary: 'Failure signal indicates issues at the BFF/gateway layer rather than leaf UI state alone.',
      confidence: 0.84,
      score: 84,
      layer: 'bff',
      cluster: 'gateway_failure',
      evidenceIds: matched.map((x) => x.id),
      isSymptomOnly: false,
      detail: { matchedCount: matched.length },
      rule: { code: 'R008', name: 'BFF/gateway failure', cluster: 'gateway_failure', layer: 'bff', severity: 'high', isSymptomOnly: false },
    }];
  }
}
