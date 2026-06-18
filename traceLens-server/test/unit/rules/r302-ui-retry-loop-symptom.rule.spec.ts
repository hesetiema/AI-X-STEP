import { R302UiRetryLoopSymptomRule } from '../../../src/diagnosis/rules/p1-rules';
import { buildDiagnosisContext } from '../../helpers/diagnosis-context.fixture';
import { expectRuleMiss, expectSingleRuleHit } from '../../helpers/rule-unit-assertions';

describe('R302UiRetryLoopSymptomRule', () => {
  let rule: R302UiRetryLoopSymptomRule;

  beforeEach(() => {
    rule = new R302UiRetryLoopSymptomRule();
  });

  it('should hit when label contains "retry loop"', () => {
    const context = buildDiagnosisContext({
      evidence: [
        { id: 'ev-retry-1', type: 'ui_event', label: 'retry loop detected', value: {}, source: 'frontend-sdk' },
      ],
    });
    const result = rule.evaluate(context);
    expectSingleRuleHit(result, {
      ruleCode: 'R302',
      layer: 'ui_state',
      cluster: 'ui_retry_loop',
      isSymptomOnly: true,
      evidenceIds: ['ev-retry-1'],
      detail: { matchedCount: 1 },
    });
  });

  it('should hit when value.loop is true', () => {
    const context = buildDiagnosisContext({
      evidence: [
        { id: 'ev-retry-2', type: 'ui_state', label: 'retrying', value: { loop: true, retryCount: 5 }, source: 'frontend-sdk' },
      ],
    });
    expectSingleRuleHit(rule.evaluate(context), {
      ruleCode: 'R302',
      layer: 'ui_state',
      cluster: 'ui_retry_loop',
      isSymptomOnly: true,
      evidenceIds: ['ev-retry-2'],
      detail: { matchedCount: 1 },
    });
  });

  it('should hit when retryCount >= 3', () => {
    const context = buildDiagnosisContext({
      evidence: [
        { id: 'ev-retry-3', type: 'ui_event', label: 'retry', value: { retryCount: 3 }, source: 'frontend-sdk' },
      ],
    });
    expectSingleRuleHit(rule.evaluate(context), {
      ruleCode: 'R302',
      layer: 'ui_state',
      cluster: 'ui_retry_loop',
      isSymptomOnly: true,
      evidenceIds: ['ev-retry-3'],
      detail: { matchedCount: 1 },
    });
  });

  it('should not hit when retryCount is low', () => {
    const context = buildDiagnosisContext({
      evidence: [
        { id: 'ev-retry-4', type: 'ui_event', label: 'single retry', value: { retryCount: 1, loop: false }, source: 'frontend-sdk' },
      ],
    });
    expectRuleMiss(rule.evaluate(context));
  });
});
