import { R202ThirdPartyRateLimitRule } from '../../../src/diagnosis/rules/p1-rules';
import { buildDiagnosisContext } from '../../helpers/diagnosis-context.fixture';
import { expectRuleMiss, expectSingleRuleHit } from '../../helpers/rule-unit-assertions';

describe('R202ThirdPartyRateLimitRule', () => {
  let rule: R202ThirdPartyRateLimitRule;

  beforeEach(() => {
    rule = new R202ThirdPartyRateLimitRule();
  });

  it('should hit when external network error has 429 status', () => {
    const context = buildDiagnosisContext({
      evidence: [
        { id: 'ev-rl-1', type: 'network_error', label: 'rate limited', value: { status: 429, external: true, provider: 'sms-vendor' }, source: 'network-observer' },
      ],
    });
    const result = rule.evaluate(context);
    expectSingleRuleHit(result, {
      ruleCode: 'R202',
      layer: 'external',
      cluster: 'third_party_rate_limit',
      isSymptomOnly: false,
      evidenceIds: ['ev-rl-1'],
      detail: { matchedCount: 1, provider: 'sms-vendor' },
    });
  });

  it('should hit when label contains "rate limit"', () => {
    const context = buildDiagnosisContext({
      evidence: [
        { id: 'ev-rl-2', type: 'network_error', label: 'rate limit exceeded', value: { external: true }, source: 'network-observer' },
      ],
    });
    expectSingleRuleHit(rule.evaluate(context), {
      ruleCode: 'R202',
      layer: 'external',
      cluster: 'third_party_rate_limit',
      isSymptomOnly: false,
      evidenceIds: ['ev-rl-2'],
      detail: { matchedCount: 1 },
    });
  });

  it('should not hit when external but not rate limit', () => {
    const context = buildDiagnosisContext({
      evidence: [
        { id: 'ev-ext-1', type: 'network_error', label: 'provider unavailable', value: { status: 503, external: true }, source: 'network-observer' },
      ],
    });
    expectRuleMiss(rule.evaluate(context));
  });
});
