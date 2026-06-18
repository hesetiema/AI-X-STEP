import { R102UserActionInvalidTargetRule } from '../../../src/diagnosis/rules/p1-rules';
import { buildDiagnosisContext } from '../../helpers/diagnosis-context.fixture';
import { expectRuleMiss, expectSingleRuleHit } from '../../helpers/rule-unit-assertions';

describe('R102UserActionInvalidTargetRule', () => {
  let rule: R102UserActionInvalidTargetRule;

  beforeEach(() => {
    rule = new R102UserActionInvalidTargetRule();
  });

  it('should hit when ui_event label contains "invalid"', () => {
    const context = buildDiagnosisContext({
      evidence: [
        { id: 'ev-action-1', type: 'ui_event', label: 'click invalid target', value: {}, source: 'frontend-sdk' },
      ],
    });
    const result = rule.evaluate(context);
    expectSingleRuleHit(result, {
      ruleCode: 'R102',
      layer: 'user_action',
      cluster: 'invalid_target',
      isSymptomOnly: false,
      evidenceIds: ['ev-action-1'],
      detail: { matchedCount: 1 },
    });
  });

  it('should hit when value.valid is false', () => {
    const context = buildDiagnosisContext({
      evidence: [
        { id: 'ev-action-2', type: 'ui_event', label: 'click button', value: { valid: false }, source: 'frontend-sdk' },
      ],
    });
    const result = rule.evaluate(context);
    expectSingleRuleHit(result, {
      ruleCode: 'R102',
      layer: 'user_action',
      cluster: 'invalid_target',
      isSymptomOnly: false,
      evidenceIds: ['ev-action-2'],
      detail: { matchedCount: 1 },
    });
  });

  it('should not hit when ui_event has valid target', () => {
    const context = buildDiagnosisContext({
      evidence: [
        { id: 'ev-action-3', type: 'ui_event', label: 'click submit', value: {}, source: 'frontend-sdk' },
      ],
    });
    expectRuleMiss(rule.evaluate(context));
  });
});
