import { R502DomainServiceTimeoutRule } from '../../../src/diagnosis/rules/p1-rules';
import { buildDiagnosisContext } from '../../helpers/diagnosis-context.fixture';
import { expectRuleMiss, expectSingleRuleHit } from '../../helpers/rule-unit-assertions';

describe('R502DomainServiceTimeoutRule', () => {
  let rule: R502DomainServiceTimeoutRule;

  beforeEach(() => {
    rule = new R502DomainServiceTimeoutRule();
  });

  it('should hit when network error has 504 status', () => {
    const context = buildDiagnosisContext({
      evidence: [
        { id: 'ev-dom-t-1', type: 'network_error', label: 'domain timeout', value: { status: 504 }, source: 'network-observer' },
      ],
    });
    const result = rule.evaluate(context);
    expectSingleRuleHit(result, {
      ruleCode: 'R502',
      layer: 'domain',
      cluster: 'domain_service_timeout',
      isSymptomOnly: false,
      evidenceIds: ['ev-dom-t-1'],
      detail: { matchedCount: 1 },
    });
  });

  it('should hit when durationMs > 5000', () => {
    const context = buildDiagnosisContext({
      evidence: [
        { id: 'ev-dom-t-2', type: 'network_error', label: 'slow response', value: { durationMs: 6000 }, source: 'network-observer' },
      ],
    });
    expectSingleRuleHit(rule.evaluate(context), {
      ruleCode: 'R502',
      layer: 'domain',
      cluster: 'domain_service_timeout',
      isSymptomOnly: false,
      evidenceIds: ['ev-dom-t-2'],
      detail: { matchedCount: 1 },
    });
  });

  it('should not hit with fast response', () => {
    const context = buildDiagnosisContext({
      evidence: [
        { id: 'ev-dom-t-3', type: 'network_error', label: 'fast response', value: { durationMs: 500 }, source: 'network-observer' },
      ],
    });
    expectRuleMiss(rule.evaluate(context));
  });
});
