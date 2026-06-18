import { R501DomainServiceApiErrorRule } from '../../../src/diagnosis/rules/p1-rules';
import { buildDiagnosisContext } from '../../helpers/diagnosis-context.fixture';
import { expectRuleMiss, expectSingleRuleHit } from '../../helpers/rule-unit-assertions';

describe('R501DomainServiceApiErrorRule', () => {
  let rule: R501DomainServiceApiErrorRule;

  beforeEach(() => {
    rule = new R501DomainServiceApiErrorRule();
  });

  it('should hit when network error has 500 status', () => {
    const context = buildDiagnosisContext({
      evidence: [
        { id: 'ev-dom-1', type: 'network_error', label: 'internal server error', value: { status: 500 }, source: 'network-observer' },
      ],
    });
    const result = rule.evaluate(context);
    expectSingleRuleHit(result, {
      ruleCode: 'R501',
      layer: 'domain',
      cluster: 'domain_service_error',
      isSymptomOnly: false,
      evidenceIds: ['ev-dom-1'],
      detail: { matchedCount: 1 },
    });
  });

  it('should hit when network error has 502 status', () => {
    const context = buildDiagnosisContext({
      evidence: [
        { id: 'ev-dom-2', type: 'network_error', label: 'bad gateway', value: { status: 502 }, source: 'network-observer' },
      ],
    });
    expectSingleRuleHit(rule.evaluate(context), {
      ruleCode: 'R501',
      layer: 'domain',
      cluster: 'domain_service_error',
      isSymptomOnly: false,
      evidenceIds: ['ev-dom-2'],
      detail: { matchedCount: 1 },
    });
  });

  it('should not hit with non-5xx status', () => {
    const context = buildDiagnosisContext({
      evidence: [
        { id: 'ev-other-1', type: 'network_error', label: 'not found', value: { status: 404 }, source: 'network-observer' },
      ],
    });
    expectRuleMiss(rule.evaluate(context));
  });
});
