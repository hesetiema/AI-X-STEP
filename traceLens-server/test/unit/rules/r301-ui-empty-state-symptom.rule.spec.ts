import { R301UiEmptyStateSymptomRule } from '../../../src/diagnosis/rules/p1-rules';
import { buildDiagnosisContext } from '../../helpers/diagnosis-context.fixture';
import { expectRuleMiss, expectSingleRuleHit } from '../../helpers/rule-unit-assertions';

describe('R301UiEmptyStateSymptomRule', () => {
  let rule: R301UiEmptyStateSymptomRule;

  beforeEach(() => {
    rule = new R301UiEmptyStateSymptomRule();
  });

  it('should hit when ui_state label contains "empty state"', () => {
    const context = buildDiagnosisContext({
      evidence: [
        { id: 'ev-empty-1', type: 'ui_state', label: 'unexpected empty state', value: {}, source: 'frontend-sdk' },
      ],
    });
    const result = rule.evaluate(context);
    expectSingleRuleHit(result, {
      ruleCode: 'R301',
      layer: 'ui_state',
      cluster: 'ui_empty_state',
      isSymptomOnly: true,
      evidenceIds: ['ev-empty-1'],
      detail: { matchedCount: 1 },
    });
  });

  it('should hit when value.empty is true and expectedCount > 0', () => {
    const context = buildDiagnosisContext({
      evidence: [
        { id: 'ev-empty-2', type: 'ui_state', label: 'list empty', value: { empty: true, expectedCount: 5 }, source: 'frontend-sdk' },
      ],
    });
    expectSingleRuleHit(rule.evaluate(context), {
      ruleCode: 'R301',
      layer: 'ui_state',
      cluster: 'ui_empty_state',
      isSymptomOnly: true,
      evidenceIds: ['ev-empty-2'],
      detail: { matchedCount: 1 },
    });
  });

  it('should not hit when empty with expectedCount 0', () => {
    const context = buildDiagnosisContext({
      evidence: [
        { id: 'ev-empty-3', type: 'ui_state', label: 'empty list', value: { empty: true, expectedCount: 0 }, source: 'frontend-sdk' },
      ],
    });
    expectRuleMiss(rule.evaluate(context));
  });
});
