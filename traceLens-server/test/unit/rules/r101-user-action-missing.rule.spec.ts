import { R101UserActionMissingRule } from '../../../src/diagnosis/rules/p1-rules';
import { buildDiagnosisContext } from '../../helpers/diagnosis-context.fixture';
import { expectRuleMiss, expectSingleRuleHit } from '../../helpers/rule-unit-assertions';

describe('R101UserActionMissingRule', () => {
  let rule: R101UserActionMissingRule;

  beforeEach(() => {
    rule = new R101UserActionMissingRule();
  });

  it('should hit when user actions exist but no network calls', () => {
    const context = buildDiagnosisContext({
      evidence: [
        { id: 'ev-ui-1', type: 'ui_event', label: 'click submit', value: {}, source: 'frontend-sdk' },
      ],
    });
    const result = rule.evaluate(context);
    expectSingleRuleHit(result, {
      ruleCode: 'R101',
      layer: 'user_action',
      cluster: 'missing_api_call',
      isSymptomOnly: false,
      evidenceIds: ['ev-ui-1'],
      detail: { userActionCount: 1 },
    });
  });

  it('should not hit when network evidence also exists', () => {
    const context = buildDiagnosisContext({
      evidence: [
        { id: 'ev-ui-1', type: 'ui_event', label: 'click submit', value: {}, source: 'frontend-sdk' },
        { id: 'ev-net-1', type: 'network_error', label: 'POST /api 500', value: { status: 500 }, source: 'network-observer' },
      ],
    });
    expectRuleMiss(rule.evaluate(context));
  });

  it('should not hit when no user actions at all', () => {
    const context = buildDiagnosisContext({
      evidence: [
        { id: 'ev-net-1', type: 'network_error', label: 'POST /api 500', value: { status: 500 }, source: 'network-observer' },
      ],
    });
    expectRuleMiss(rule.evaluate(context));
  });
});
