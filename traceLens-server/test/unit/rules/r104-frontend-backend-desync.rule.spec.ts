import { R104FrontendBackendDesyncRule } from '../../../src/diagnosis/rules/p1-rules';
import { buildDiagnosisContext } from '../../helpers/diagnosis-context.fixture';
import { expectRuleMiss, expectSingleRuleHit } from '../../helpers/rule-unit-assertions';

describe('R104FrontendBackendDesyncRule', () => {
  let rule: R104FrontendBackendDesyncRule;

  beforeEach(() => {
    rule = new R104FrontendBackendDesyncRule();
  });

  it('should hit when network errors and stale ui_state both exist', () => {
    const context = buildDiagnosisContext({
      evidence: [
        { id: 'ev-net-1', type: 'network_error', label: 'POST /api timeout', value: { status: 504 }, source: 'network-observer' },
        { id: 'ev-state-1', type: 'ui_state', label: 'stale data', value: { stale: true }, source: 'frontend-sdk' },
      ],
    });
    const result = rule.evaluate(context);
    expectSingleRuleHit(result, {
      ruleCode: 'R104',
      layer: 'frontend_app',
      cluster: 'state_desync',
      isSymptomOnly: false,
      evidenceIds: ['ev-net-1', 'ev-state-1'],
      detail: { networkErrorCount: 1, staleStateCount: 1 },
    });
  });

  it('should not hit without stale ui_state', () => {
    const context = buildDiagnosisContext({
      evidence: [
        { id: 'ev-net-1', type: 'network_error', label: 'POST /api timeout', value: { status: 504 }, source: 'network-observer' },
        { id: 'ev-state-1', type: 'ui_state', label: 'loading', value: {}, source: 'frontend-sdk' },
      ],
    });
    expectRuleMiss(rule.evaluate(context));
  });

  it('should not hit without network errors', () => {
    const context = buildDiagnosisContext({
      evidence: [
        { id: 'ev-state-1', type: 'ui_state', label: 'stale data', value: { stale: true }, source: 'frontend-sdk' },
      ],
    });
    expectRuleMiss(rule.evaluate(context));
  });
});
