import { R201ExternalDependencyFailureRule } from '../../../src/diagnosis/rules/p1-rules';
import { buildDiagnosisContext } from '../../helpers/diagnosis-context.fixture';
import { expectRuleMiss, expectSingleRuleHit } from '../../helpers/rule-unit-assertions';

describe('R201ExternalDependencyFailureRule', () => {
  let rule: R201ExternalDependencyFailureRule;

  beforeEach(() => {
    rule = new R201ExternalDependencyFailureRule();
  });

  it('should hit when external network error has 503 status', () => {
    const context = buildDiagnosisContext({
      evidence: [
        { id: 'ev-ext-1', type: 'network_error', label: 'payment provider down', value: { status: 503, external: true, provider: 'payment-gateway' }, source: 'network-observer' },
      ],
    });
    const result = rule.evaluate(context);
    expectSingleRuleHit(result, {
      ruleCode: 'R201',
      layer: 'external',
      cluster: 'external_dependency_failure',
      isSymptomOnly: false,
      evidenceIds: ['ev-ext-1'],
      detail: { matchedCount: 1, provider: 'payment-gateway' },
    });
  });

  it('should hit when external network error has 504 status', () => {
    const context = buildDiagnosisContext({
      evidence: [
        { id: 'ev-ext-2', type: 'network_error', label: 'external service timeout', value: { status: 504, external: true }, source: 'network-observer' },
      ],
    });
    expectSingleRuleHit(rule.evaluate(context), {
      ruleCode: 'R201',
      layer: 'external',
      cluster: 'external_dependency_failure',
      isSymptomOnly: false,
      evidenceIds: ['ev-ext-2'],
      detail: { matchedCount: 1 },
    });
  });

  it('should not hit when external flag is false', () => {
    const context = buildDiagnosisContext({
      evidence: [
        { id: 'ev-int-1', type: 'network_error', label: 'internal 503', value: { status: 503, external: false }, source: 'network-observer' },
      ],
    });
    expectRuleMiss(rule.evaluate(context));
  });
});
