import { R504DomainValidationErrorRule } from '../../../src/diagnosis/rules/p1-rules';
import { buildDiagnosisContext } from '../../helpers/diagnosis-context.fixture';
import { expectRuleMiss, expectSingleRuleHit } from '../../helpers/rule-unit-assertions';

describe('R504DomainValidationErrorRule', () => {
  let rule: R504DomainValidationErrorRule;

  beforeEach(() => {
    rule = new R504DomainValidationErrorRule();
  });

  it('should hit when network error has 422 status', () => {
    const context = buildDiagnosisContext({
      evidence: [
        { id: 'ev-val-1', type: 'network_error', label: 'validation failed', value: { status: 422 }, source: 'network-observer' },
      ],
    });
    const result = rule.evaluate(context);
    expectSingleRuleHit(result, {
      ruleCode: 'R504',
      layer: 'domain',
      cluster: 'domain_validation_error',
      isSymptomOnly: false,
      evidenceIds: ['ev-val-1'],
      detail: { matchedCount: 1 },
    });
  });

  it('should not hit with non-422 status', () => {
    const context = buildDiagnosisContext({
      evidence: [
        { id: 'ev-other-1', type: 'network_error', label: 'bad request', value: { status: 400 }, source: 'network-observer' },
      ],
    });
    expectRuleMiss(rule.evaluate(context));
  });
});
