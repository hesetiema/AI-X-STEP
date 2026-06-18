import { R402BffProxyTimeoutRule } from '../../../src/diagnosis/rules/p1-rules';
import { buildDiagnosisContext } from '../../helpers/diagnosis-context.fixture';
import { expectRuleMiss, expectSingleRuleHit } from '../../helpers/rule-unit-assertions';

describe('R402BffProxyTimeoutRule', () => {
  let rule: R402BffProxyTimeoutRule;

  beforeEach(() => {
    rule = new R402BffProxyTimeoutRule();
  });

  it('should hit when network error has 504 status', () => {
    const context = buildDiagnosisContext({
      evidence: [
        { id: 'ev-timeout-1', type: 'network_error', label: 'gateway timeout', value: { status: 504 }, source: 'network-observer' },
      ],
    });
    const result = rule.evaluate(context);
    expectSingleRuleHit(result, {
      ruleCode: 'R402',
      layer: 'bff',
      cluster: 'proxy_timeout',
      isSymptomOnly: false,
      evidenceIds: ['ev-timeout-1'],
      detail: { matchedCount: 1 },
    });
  });

  it('should hit when label contains "upstream timeout"', () => {
    const context = buildDiagnosisContext({
      evidence: [
        { id: 'ev-timeout-2', type: 'network_error', label: 'upstream timeout', value: {}, source: 'network-observer' },
      ],
    });
    expectSingleRuleHit(rule.evaluate(context), {
      ruleCode: 'R402',
      layer: 'bff',
      cluster: 'proxy_timeout',
      isSymptomOnly: false,
      evidenceIds: ['ev-timeout-2'],
      detail: { matchedCount: 1 },
    });
  });

  it('should not hit with non-timeout status', () => {
    const context = buildDiagnosisContext({
      evidence: [
        { id: 'ev-other-1', type: 'network_error', label: 'POST /api 500', value: { status: 500 }, source: 'network-observer' },
      ],
    });
    expectRuleMiss(rule.evaluate(context));
  });
});
