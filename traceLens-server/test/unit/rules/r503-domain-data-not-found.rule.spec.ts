import { R503DomainDataNotFoundRule } from '../../../src/diagnosis/rules/p1-rules';
import { buildDiagnosisContext } from '../../helpers/diagnosis-context.fixture';
import { expectRuleMiss, expectSingleRuleHit } from '../../helpers/rule-unit-assertions';

describe('R503DomainDataNotFoundRule', () => {
  let rule: R503DomainDataNotFoundRule;

  beforeEach(() => {
    rule = new R503DomainDataNotFoundRule();
  });

  it('should hit when network error has 404 with "data" in label', () => {
    const context = buildDiagnosisContext({
      evidence: [
        { id: 'ev-notfound-1', type: 'network_error', label: 'data not found', value: { status: 404 }, source: 'network-observer' },
      ],
    });
    const result = rule.evaluate(context);
    expectSingleRuleHit(result, {
      ruleCode: 'R503',
      layer: 'domain',
      cluster: 'domain_data_not_found',
      isSymptomOnly: false,
      evidenceIds: ['ev-notfound-1'],
      detail: { matchedCount: 1 },
    });
  });

  it('should hit when network error has 404 with "not found" in label', () => {
    const context = buildDiagnosisContext({
      evidence: [
        { id: 'ev-notfound-2', type: 'network_error', label: 'resource not found', value: { status: 404 }, source: 'network-observer' },
      ],
    });
    expectSingleRuleHit(rule.evaluate(context), {
      ruleCode: 'R503',
      layer: 'domain',
      cluster: 'domain_data_not_found',
      isSymptomOnly: false,
      evidenceIds: ['ev-notfound-2'],
      detail: { matchedCount: 1 },
    });
  });

  it('should not hit with 404 but unrelated label', () => {
    const context = buildDiagnosisContext({
      evidence: [
        { id: 'ev-other-1', type: 'network_error', label: 'unauthorized access', value: { status: 404 }, source: 'network-observer' },
      ],
    });
    expectRuleMiss(rule.evaluate(context));
  });
});
