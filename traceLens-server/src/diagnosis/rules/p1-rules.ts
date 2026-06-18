import { DiagnosisRule } from '../interfaces/diagnosis-rule.interface';
import { DiagnosisContext, RuleFinding } from '../interfaces/diagnosis.types';

export class R101UserActionMissingRule implements DiagnosisRule {
  readonly code = 'R101';
  evaluate(context: DiagnosisContext): RuleFinding[] {
    const userActions = context.evidence.filter((e) => e.type === 'ui_event');
    const networkCalls = context.evidence.filter((e) => e.type === 'network_error');
    if (userActions.length > 0 && networkCalls.length === 0) {
      return [{
        ruleCode: 'R101',
        title: 'Missing API call after user action',
        summary: 'User interaction detected but no corresponding network evidence; possible early termination.',
        confidence: 0.55,
        score: 55,
        layer: 'user_action',
        cluster: 'missing_api_call',
        evidenceIds: userActions.map((x) => x.id),
        isSymptomOnly: false,
        detail: { userActionCount: userActions.length },
        rule: { code: 'R101', name: 'No API call after user action', cluster: 'missing_api_call', layer: 'user_action', severity: 'low', isSymptomOnly: false },
      }];
    }
    return [];
  }
}

export class R102UserActionInvalidTargetRule implements DiagnosisRule {
  readonly code = 'R102';
  evaluate(context: DiagnosisContext): RuleFinding[] {
    const matched = context.evidence.filter(
      (e) => e.type === 'ui_event' && (e.label.toLowerCase().includes('invalid') || e.value?.valid === false),
    );
    if (matched.length === 0) return [];
    return [{
      ruleCode: 'R102',
      title: 'User action invalid target',
      summary: 'User interaction targeted an invalid/non-interactive element.',
      confidence: 0.60,
      score: 60,
      layer: 'user_action',
      cluster: 'invalid_target',
      evidenceIds: matched.map((x) => x.id),
      isSymptomOnly: false,
      detail: { matchedCount: matched.length },
      rule: { code: 'R102', name: 'Invalid interaction target', cluster: 'invalid_target', layer: 'user_action', severity: 'low', isSymptomOnly: false },
    }];
  }
}

export class R103StateNotUpdatedRule implements DiagnosisRule {
  readonly code = 'R103';
  evaluate(context: DiagnosisContext): RuleFinding[] {
    const userActions = context.evidence.filter((e) => e.type === 'ui_event');
    const stateChanges = context.evidence.filter((e) => e.type === 'ui_state');
    if (userActions.length > 0 && stateChanges.length === 0) {
      return [{
        ruleCode: 'R103',
        title: 'State not updated after user action',
        summary: 'User action detected but no corresponding UI state change; possible event not dispatched or handler not executed.',
        confidence: 0.62,
        score: 62,
        layer: 'frontend_app',
        cluster: 'state_not_updated',
        evidenceIds: userActions.map((x) => x.id),
        isSymptomOnly: false,
        detail: { userActionCount: userActions.length },
        rule: { code: 'R103', name: 'State not updated after action', cluster: 'state_not_updated', layer: 'frontend_app', severity: 'medium', isSymptomOnly: false },
      }];
    }
    return [];
  }
}

export class R104FrontendBackendDesyncRule implements DiagnosisRule {
  readonly code = 'R104';
  evaluate(context: DiagnosisContext): RuleFinding[] {
    const networkErrors = context.evidence.filter((e) => e.type === 'network_error');
    const uiState = context.evidence.filter(
      (e) => e.type === 'ui_state' && (e.label.toLowerCase().includes('stale') || e.value?.stale === true),
    );
    if (networkErrors.length > 0 && uiState.length > 0) {
      return [{
        ruleCode: 'R104',
        title: 'Frontend/backend state desync',
        summary: 'Stale UI state combined with network errors suggests frontend and backend state divergence.',
        confidence: 0.70,
        score: 70,
        layer: 'frontend_app',
        cluster: 'state_desync',
        evidenceIds: [...networkErrors.map((x) => x.id), ...uiState.map((x) => x.id)],
        isSymptomOnly: false,
        detail: { networkErrorCount: networkErrors.length, staleStateCount: uiState.length },
        rule: { code: 'R104', name: 'Frontend/backend state desync', cluster: 'state_desync', layer: 'frontend_app', severity: 'medium', isSymptomOnly: false },
      }];
    }
    return [];
  }
}

export class R201ExternalDependencyFailureRule implements DiagnosisRule {
  readonly code = 'R201';
  evaluate(context: DiagnosisContext): RuleFinding[] {
    const matched = context.evidence.filter(
      (e) => e.type === 'network_error' && e.value?.external === true && (e.value?.status === 503 || e.value?.status === 504),
    );
    if (matched.length === 0) return [];
    return [{
      ruleCode: 'R201',
      title: 'External dependency failure',
      summary: 'Observed failure likely originates from an external provider or third-party dependency.',
      confidence: 0.82,
      score: 82,
      layer: 'external',
      cluster: 'external_dependency_failure',
      evidenceIds: matched.map((x) => x.id),
      isSymptomOnly: false,
      detail: { matchedCount: matched.length, provider: matched[0]?.value?.provider },
      rule: { code: 'R201', name: 'External dependency unavailable', cluster: 'external_dependency_failure', layer: 'external', severity: 'high', isSymptomOnly: false },
    }];
  }
}

export class R202ThirdPartyRateLimitRule implements DiagnosisRule {
  readonly code = 'R202';
  evaluate(context: DiagnosisContext): RuleFinding[] {
    const matched = context.evidence.filter(
      (e) => e.type === 'network_error' && e.value?.external === true && (e.value?.status === 429 || e.label.toLowerCase().includes('rate limit')),
    );
    if (matched.length === 0) return [];
    return [{
      ruleCode: 'R202',
      title: 'Third-party rate limit',
      summary: 'Third-party provider is rate limiting requests, causing downstream failures or degraded UX.',
      confidence: 0.86,
      score: 86,
      layer: 'external',
      cluster: 'third_party_rate_limit',
      evidenceIds: matched.map((x) => x.id),
      isSymptomOnly: false,
      detail: { matchedCount: matched.length, provider: matched[0]?.value?.provider },
      rule: { code: 'R202', name: 'Third-party rate limit/429', cluster: 'third_party_rate_limit', layer: 'external', severity: 'high', isSymptomOnly: false },
    }];
  }
}

export class R301UiEmptyStateSymptomRule implements DiagnosisRule {
  readonly code = 'R301';
  evaluate(context: DiagnosisContext): RuleFinding[] {
    const matched = context.evidence.filter(
      (e) => e.type === 'ui_state' && (e.label.toLowerCase().includes('empty state') || (e.value?.empty === true && Number(e.value?.expectedCount) > 0)),
    );
    if (matched.length === 0) return [];
    return [{
      ruleCode: 'R301',
      title: 'UI empty state symptom',
      summary: 'Unexpected empty state was rendered, likely reflecting upstream data or request failure.',
      confidence: 0.66,
      score: 66,
      layer: 'ui_state',
      cluster: 'ui_empty_state',
      evidenceIds: matched.map((x) => x.id),
      isSymptomOnly: true,
      detail: { matchedCount: matched.length },
      rule: { code: 'R301', name: 'UI empty state', cluster: 'ui_empty_state', layer: 'ui_state', severity: 'medium', isSymptomOnly: true },
    }];
  }
}

export class R302UiRetryLoopSymptomRule implements DiagnosisRule {
  readonly code = 'R302';
  evaluate(context: DiagnosisContext): RuleFinding[] {
    const matched = context.evidence.filter(
      (e) => (e.type === 'ui_event' || e.type === 'ui_state') && (e.label.toLowerCase().includes('retry loop') || e.value?.loop === true || (typeof e.value?.retryCount === 'number' && e.value.retryCount >= 3)),
    );
    if (matched.length === 0) return [];
    return [{
      ruleCode: 'R302',
      title: 'UI retry loop symptom',
      summary: 'The UI is repeatedly retrying, indicating unstable upstream dependency or unresolved failure.',
      confidence: 0.71,
      score: 71,
      layer: 'ui_state',
      cluster: 'ui_retry_loop',
      evidenceIds: matched.map((x) => x.id),
      isSymptomOnly: true,
      detail: { matchedCount: matched.length },
      rule: { code: 'R302', name: 'UI retry loop', cluster: 'ui_retry_loop', layer: 'ui_state', severity: 'medium', isSymptomOnly: true },
    }];
  }
}

export class R401BffGatewayConnectionErrorRule implements DiagnosisRule {
  readonly code = 'R401';
  evaluate(context: DiagnosisContext): RuleFinding[] {
    const matched = context.evidence.filter(
      (e) => e.type === 'network_error' && (e.value?.status === 502 || e.value?.status === 504 || e.label.toLowerCase().includes('bad gateway') || e.label.toLowerCase().includes('gateway timeout')),
    );
    if (matched.length === 0) return [];
    return [{
      ruleCode: 'R401',
      title: 'BFF/gateway connection error',
      summary: 'BFF or gateway layer connectivity issue detected.',
      confidence: 0.80,
      score: 80,
      layer: 'bff',
      cluster: 'gateway_connection_error',
      evidenceIds: matched.map((x) => x.id),
      isSymptomOnly: false,
      detail: { matchedCount: matched.length },
      rule: { code: 'R401', name: 'BFF/gateway connection error', cluster: 'gateway_connection_error', layer: 'bff', severity: 'high', isSymptomOnly: false },
    }];
  }
}

export class R402BffProxyTimeoutRule implements DiagnosisRule {
  readonly code = 'R402';
  evaluate(context: DiagnosisContext): RuleFinding[] {
    const matched = context.evidence.filter(
      (e) => e.type === 'network_error' && (e.value?.status === 504 || e.label.toLowerCase().includes('upstream timeout') || e.label.toLowerCase().includes('proxy timeout')),
    );
    if (matched.length === 0) return [];
    return [{
      ruleCode: 'R402',
      title: 'BFF/proxy timeout',
      summary: 'BFF or proxy layer timeout detected, possible upstream delay.',
      confidence: 0.79,
      score: 79,
      layer: 'bff',
      cluster: 'proxy_timeout',
      evidenceIds: matched.map((x) => x.id),
      isSymptomOnly: false,
      detail: { matchedCount: matched.length },
      rule: { code: 'R402', name: 'BFF/proxy timeout', cluster: 'proxy_timeout', layer: 'bff', severity: 'high', isSymptomOnly: false },
    }];
  }
}

export class R501DomainServiceApiErrorRule implements DiagnosisRule {
  readonly code = 'R501';
  evaluate(context: DiagnosisContext): RuleFinding[] {
    const matched = context.evidence.filter(
      (e) => e.type === 'network_error' && (e.value?.status === 500 || e.value?.status === 502),
    );
    if (matched.length === 0) return [];
    return [{
      ruleCode: 'R501',
      title: 'Domain service API error',
      summary: 'Domain service API returned 5xx, indicating backend processing error.',
      confidence: 0.88,
      score: 88,
      layer: 'domain',
      cluster: 'domain_service_error',
      evidenceIds: matched.map((x) => x.id),
      isSymptomOnly: false,
      detail: { matchedCount: matched.length },
      rule: { code: 'R501', name: 'Domain service API error', cluster: 'domain_service_error', layer: 'domain', severity: 'high', isSymptomOnly: false },
    }];
  }
}

export class R502DomainServiceTimeoutRule implements DiagnosisRule {
  readonly code = 'R502';
  evaluate(context: DiagnosisContext): RuleFinding[] {
    const matched = context.evidence.filter(
      (e) => e.type === 'network_error' && (e.value?.status === 504 || (typeof e.value?.durationMs === 'number' && e.value.durationMs > 5000)),
    );
    if (matched.length === 0) return [];
    return [{
      ruleCode: 'R502',
      title: 'Domain service timeout',
      summary: 'Domain service response exceeded threshold, indicating performance issue.',
      confidence: 0.78,
      score: 78,
      layer: 'domain',
      cluster: 'domain_service_timeout',
      evidenceIds: matched.map((x) => x.id),
      isSymptomOnly: false,
      detail: { matchedCount: matched.length },
      rule: { code: 'R502', name: 'Domain service timeout', cluster: 'domain_service_timeout', layer: 'domain', severity: 'high', isSymptomOnly: false },
    }];
  }
}

export class R503DomainDataNotFoundRule implements DiagnosisRule {
  readonly code = 'R503';
  evaluate(context: DiagnosisContext): RuleFinding[] {
    const matched = context.evidence.filter(
      (e) => e.type === 'network_error' && e.value?.status === 404 && (e.label.toLowerCase().includes('data') || e.label.toLowerCase().includes('not found')),
    );
    if (matched.length === 0) return [];
    return [{
      ruleCode: 'R503',
      title: 'Domain data not found',
      summary: 'Requested data returned 404 from server-side; possible missing or deleted resource.',
      confidence: 0.76,
      score: 76,
      layer: 'domain',
      cluster: 'domain_data_not_found',
      evidenceIds: matched.map((x) => x.id),
      isSymptomOnly: false,
      detail: { matchedCount: matched.length },
      rule: { code: 'R503', name: 'Domain data not found', cluster: 'domain_data_not_found', layer: 'domain', severity: 'low', isSymptomOnly: false },
    }];
  }
}

export class R504DomainValidationErrorRule implements DiagnosisRule {
  readonly code = 'R504';
  evaluate(context: DiagnosisContext): RuleFinding[] {
    const matched = context.evidence.filter(
      (e) => e.type === 'network_error' && e.value?.status === 422,
    );
    if (matched.length === 0) return [];
    return [{
      ruleCode: 'R504',
      title: 'Domain validation error',
      summary: 'Server-side validation failed (422), suggesting request payload mismatch or business rule violation.',
      confidence: 0.72,
      score: 72,
      layer: 'domain',
      cluster: 'domain_validation_error',
      evidenceIds: matched.map((x) => x.id),
      isSymptomOnly: false,
      detail: { matchedCount: matched.length },
      rule: { code: 'R504', name: 'Domain validation error', cluster: 'domain_validation_error', layer: 'domain', severity: 'medium', isSymptomOnly: false },
    }];
  }
}
