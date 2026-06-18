import { R103StateNotUpdatedRule } from '../../../src/diagnosis/rules/p1-rules';
import { buildDiagnosisContext } from '../../helpers/diagnosis-context.fixture';
import { expectRuleMiss, expectSingleRuleHit } from '../../helpers/rule-unit-assertions';

describe('R103StateNotUpdatedRule', () => {
  let rule: R103StateNotUpdatedRule;

  beforeEach(() => {
    rule = new R103StateNotUpdatedRule();
  });

  it('should hit when user actions exist but no ui_state changes', () => {
    const context = buildDiagnosisContext({
      evidence: [
        { id: 'ev-ui-1', type: 'ui_event', label: 'click submit', value: {}, source: 'frontend-sdk' },
      ],
    });
    const result = rule.evaluate(context);
    expectSingleRuleHit(result, {
      ruleCode: 'R103',
      layer: 'frontend_app',
      cluster: 'state_not_updated',
      isSymptomOnly: false,
      evidenceIds: ['ev-ui-1'],
      detail: { userActionCount: 1 },
    });
  });

  it('should not hit when ui_state changes also exist', () => {
    const context = buildDiagnosisContext({
      evidence: [
        { id: 'ev-ui-1', type: 'ui_event', label: 'click submit', value: {}, source: 'frontend-sdk' },
        { id: 'ev-state-1', type: 'ui_state', label: 'loading started', value: {}, source: 'frontend-sdk' },
      ],
    });
    expectRuleMiss(rule.evaluate(context));
  });
});
