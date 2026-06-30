import { Injectable } from '@nestjs/common';
import { DiagnosisRule } from '../interfaces/diagnosis-rule.interface';
import { R001Api5xxRule, R002ApiTimeoutRule, R003DbTimeoutRule, R004DbConnectionExhaustedRule,
  R005UiLoadingSymptomRule, R006UiErrorToastSymptomRule, R007FrontendEventLostRule, R008BffGatewayFailureRule } from '../rules/p0-rules';
import { R101UserActionMissingRule, R102UserActionInvalidTargetRule, R103StateNotUpdatedRule, R104FrontendBackendDesyncRule,
  R201ExternalDependencyFailureRule, R202ThirdPartyRateLimitRule, R301UiEmptyStateSymptomRule, R302UiRetryLoopSymptomRule,
  R401BffGatewayConnectionErrorRule, R402BffProxyTimeoutRule, R501DomainServiceApiErrorRule, R502DomainServiceTimeoutRule,
  R503DomainDataNotFoundRule, R504DomainValidationErrorRule } from '../rules/p1-rules';
import { P001SlowLcpRule, P002SlowTtfbRule, P003HighClsRule, P004SlowFirstScreenApiRule,
  P005BlockingApiSlowRule, P006FirstScreenApiErrorRule, P007SlowPageOverallRule, P008ResourceWaterfallRule,
  P009TtfbApiCorrelationRule, P010NoPerfDataRule, P011FrontendSettleGapRule, P012SerialDependencyRule,
  P013RepeatRequestRule } from '../rules/p-perf-rules';

@Injectable()
export class DiagnosisRuleRegistry {
  private readonly rules: Map<string, DiagnosisRule>;

  constructor() {
    this.rules = new Map();
    this.registerDefaults();
  }

  private registerDefaults(): void {
    // P0 规则
    this.register(new R001Api5xxRule());
    this.register(new R002ApiTimeoutRule());
    this.register(new R003DbTimeoutRule());
    this.register(new R004DbConnectionExhaustedRule());
    this.register(new R005UiLoadingSymptomRule());
    this.register(new R006UiErrorToastSymptomRule());
    this.register(new R007FrontendEventLostRule());
    this.register(new R008BffGatewayFailureRule());
    // P1 规则
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
    // P 系列（页面加载性能）
    this.register(new P001SlowLcpRule());
    this.register(new P002SlowTtfbRule());
    this.register(new P003HighClsRule());
    this.register(new P004SlowFirstScreenApiRule());
    this.register(new P005BlockingApiSlowRule());
    this.register(new P006FirstScreenApiErrorRule());
    this.register(new P007SlowPageOverallRule());
    this.register(new P008ResourceWaterfallRule());
    this.register(new P009TtfbApiCorrelationRule());
    this.register(new P010NoPerfDataRule());
    this.register(new P011FrontendSettleGapRule());
    this.register(new P012SerialDependencyRule());
    this.register(new P013RepeatRequestRule());
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
