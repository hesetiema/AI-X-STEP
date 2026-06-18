import { RuleEngineService } from '../../src/diagnosis/domain/rule-engine.service';
import { DiagnosisRuleRegistry } from '../../src/diagnosis/domain/diagnosis-rule.registry';
import { buildDiagnosisContext } from '../helpers/diagnosis-context.fixture';

describe('RuleEngineService (integration)', () => {
  let service: RuleEngineService;
  let registry: DiagnosisRuleRegistry;

  beforeEach(() => {
    registry = new DiagnosisRuleRegistry();
    service = new RuleEngineService(registry);
  });

  it('should register all 22 rules', () => {
    const rules = registry.getAll();
    const codes = rules.map((r) => r.code).sort();
    expect(codes).toEqual([
      'R001', 'R002', 'R003', 'R004', 'R005', 'R006', 'R007', 'R008',
      'R101', 'R102', 'R103', 'R104',
      'R201', 'R202',
      'R301', 'R302',
      'R401', 'R402',
      'R501', 'R502', 'R503', 'R504',
    ]);
  });

  it('should return findings when evidence matches rules', () => {
    const context = buildDiagnosisContext({
      evidence: [
        { id: 'ev-1', type: 'network_error', label: 'POST /api/orders 500', value: { status: 500 }, source: 'network-observer' },
        { id: 'ev-2', type: 'ui_state', label: 'error toast visible', value: { toastType: 'error' }, source: 'frontend-sdk' },
      ],
    });
    const findings = service.evaluate(context);
    expect(findings.length).toBeGreaterThanOrEqual(2);
    const codes = findings.map((f) => f.ruleCode);
    expect(codes).toContain('R001');
    expect(codes).toContain('R006');
  });

  it('should return empty when no evidence matches any rule', () => {
    const context = buildDiagnosisContext({
      evidence: [
        { id: 'ev-1', type: 'log', label: 'app started', value: {}, source: 'system' },
      ],
    });
    const findings = service.evaluate(context);
    expect(findings).toEqual([]);
  });

  it('should not throw with empty context', () => {
    const context = buildDiagnosisContext({ evidence: [] });
    expect(() => service.evaluate(context)).not.toThrow();
  });
});
