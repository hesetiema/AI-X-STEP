import { R401BffGatewayConnectionErrorRule } from '../../../src/diagnosis/rules/p1-rules';
import { buildDiagnosisContext } from '../../helpers/diagnosis-context.fixture';
import { expectRuleMiss, expectSingleRuleHit } from '../../helpers/rule-unit-assertions';

describe('R401BffGatewayConnectionErrorRule', () => {
  let rule: R401BffGatewayConnectionErrorRule;

  beforeEach(() => {
    rule = new R401BffGatewayConnectionErrorRule();
  });

  it('should hit when network error has 502 status', () => {
    const context = buildDiagnosisContext({
      evidence: [
        { id: 'ev-gw-1', type: 'network_error', label: 'bad gateway', value: { status: 502 }, source: 'network-observer' },
      ],
    });
    const result = rule.evaluate(context);
    expectSingleRuleHit(result, {
      ruleCode: 'R401',
      layer: 'bff',
      cluster: 'gateway_connection_error',
      isSymptomOnly: false,
      evidenceIds: ['ev-gw-1'],
      detail: { matchedCount: 1 },
    });
  });

  it('should hit when label contains "bad gateway"', () => {
    const context = buildDiagnosisContext({
      evidence: [
        { id: 'ev-gw-2', type: 'network_error', label: 'upstream bad gateway', value: { status: 502 }, source: 'network-observer' },
      ],
    });
    expectSingleRuleHit(rule.evaluate(context), {
      ruleCode: 'R401',
      layer: 'bff',
      cluster: 'gateway_connection_error',
      isSymptomOnly: false,
      evidenceIds: ['ev-gw-2'],
      detail: { matchedCount: 1 },
    });
  });

  it('should not hit with unrelated status', () => {
    const context = buildDiagnosisContext({
      evidence: [
        { id: 'ev-other-1', type: 'network_error', label: 'POST /api 500', value: { status: 500 }, source: 'network-observer' },
      ],
    });
    expectRuleMiss(rule.evaluate(context));
  });
});
