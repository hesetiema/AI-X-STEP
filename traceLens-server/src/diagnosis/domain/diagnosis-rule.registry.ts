import { Injectable } from '@nestjs/common';
import { DiagnosisRule } from '../interfaces/diagnosis-rule.interface';
import { R001Api5xxRule, R002ApiTimeoutRule, R003DbTimeoutRule, R004DbConnectionExhaustedRule,
  R005UiLoadingSymptomRule, R006UiErrorToastSymptomRule, R007FrontendEventLostRule, R008BffGatewayFailureRule } from '../rules/p0-rules';
import { R101UserActionMissingRule, R102UserActionInvalidTargetRule, R103StateNotUpdatedRule, R104FrontendBackendDesyncRule,
  R201ExternalDependencyFailureRule, R202ThirdPartyRateLimitRule, R301UiEmptyStateSymptomRule, R302UiRetryLoopSymptomRule,
  R401BffGatewayConnectionErrorRule, R402BffProxyTimeoutRule, R501DomainServiceApiErrorRule, R502DomainServiceTimeoutRule,
  R503DomainDataNotFoundRule, R504DomainValidationErrorRule } from '../rules/p1-rules';

@Injectable()
export class DiagnosisRuleRegistry {
  private readonly rules: Map<string, DiagnosisRule>;

  constructor() {
    this.rules = new Map();
    this.registerDefaults();
  }

  private registerDefaults(): void {
    this.register(new R001Api5xxRule());
    this.register(new R002ApiTimeoutRule());
    this.register(new R003DbTimeoutRule());
    this.register(new R004DbConnectionExhaustedRule());
    this.register(new R005UiLoadingSymptomRule());
    this.register(new R006UiErrorToastSymptomRule());
    this.register(new R007FrontendEventLostRule());
    this.register(new R008BffGatewayFailureRule());
    this.register(new R101UserActionMissingRule());
    this.register(new R102UserActionInvalidTargetRule());
    this.register(new R103StateNotUpdatedRule());
    this.register(new R104FrontendBackendDesyncRule());
    this.register(new R201ExternalDependencyFailureRule());
    this.register(new R202ThirdPartyRateLimitRule());
    this.register(new R301UiEmptyStateSymptomRule());
    this.register(new R302UiRetryLoopSymptomRule());
    this.register(new R401BffGatewayConnectionErrorRule());
    this.register(new R402BffProxyTimeoutRule());
    this.register(new R501DomainServiceApiErrorRule());
    this.register(new R502DomainServiceTimeoutRule());
    this.register(new R503DomainDataNotFoundRule());
    this.register(new R504DomainValidationErrorRule());
  }

  register(rule: DiagnosisRule): void {
    this.rules.set(rule.code, rule);
  }

  getAll(): DiagnosisRule[] {
    return Array.from(this.rules.values());
  }

  getByCode(code: string): DiagnosisRule | undefined {
    return this.rules.get(code);
  }
}
