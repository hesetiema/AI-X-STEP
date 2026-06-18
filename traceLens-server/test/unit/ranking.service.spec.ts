import { RankingService } from '../../src/diagnosis/domain/ranking.service';
import { RuleFinding, RankedFinding } from '../../src/diagnosis/interfaces/diagnosis.types';

describe('RankingService', () => {
  let service: RankingService;

  beforeEach(() => {
    service = new RankingService();
  });

  it('should sort findings by score descending', () => {
    const findings: RuleFinding[] = [
      { ruleCode: 'R001', score: 50, confidence: 0.5, isSymptomOnly: false, layer: 'api', cluster: 'api_failure', evidenceIds: ['e1'], title: '', summary: '', detail: {} },
      { ruleCode: 'R002', score: 80, confidence: 0.8, isSymptomOnly: false, layer: 'db', cluster: 'db_timeout', evidenceIds: ['e2'], title: '', summary: '', detail: {} },
    ];
    const ranked = service.rank(findings);
    expect(ranked[0].ruleCode).toBe('R002');
    expect(ranked[1].ruleCode).toBe('R001');
  });

  it('should assign ranks starting from 1', () => {
    const findings: RuleFinding[] = [
      { ruleCode: 'R001', score: 91, confidence: 0.91, isSymptomOnly: false, layer: 'api', cluster: 'api_failure', evidenceIds: ['e1'], title: '', summary: '', detail: {} },
      { ruleCode: 'R002', score: 87, confidence: 0.87, isSymptomOnly: false, layer: 'db', cluster: 'db_timeout', evidenceIds: ['e2'], title: '', summary: '', detail: {} },
      { ruleCode: 'R003', score: 78, confidence: 0.78, isSymptomOnly: false, layer: 'bff', cluster: 'gateway_failure', evidenceIds: ['e3'], title: '', summary: '', detail: {} },
    ];
    const ranked = service.rank(findings);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].rank).toBe(2);
    expect(ranked[2].rank).toBe(3);
  });

  it('should place non-symptom findings before symptom findings', () => {
    const findings: RuleFinding[] = [
      { ruleCode: 'R006', score: 69, confidence: 0.69, isSymptomOnly: true, layer: 'ui_state', cluster: 'ui_error_toast', evidenceIds: ['e1'], title: '', summary: '', detail: {} },
      { ruleCode: 'R005', score: 74, confidence: 0.74, isSymptomOnly: true, layer: 'ui_state', cluster: 'ui_loading', evidenceIds: ['e2'], title: '', summary: '', detail: {} },
      { ruleCode: 'R001', score: 91, confidence: 0.91, isSymptomOnly: false, layer: 'api', cluster: 'api_failure', evidenceIds: ['e3'], title: '', summary: '', detail: {} },
    ];
    const ranked = service.rank(findings);
    expect(ranked[0].isSymptomOnly).toBe(false);
    expect(ranked[0].ruleCode).toBe('R001');
  });

  it('should deduplicate findings by cluster', () => {
    const findings: RuleFinding[] = [
      { ruleCode: 'R001', score: 91, confidence: 0.91, isSymptomOnly: false, layer: 'api', cluster: 'api_failure', evidenceIds: ['e1'], title: '', summary: '', detail: {} },
      { ruleCode: 'R401', score: 80, confidence: 0.80, isSymptomOnly: false, layer: 'bff', cluster: 'gateway_connection_error', evidenceIds: ['e2'], title: '', summary: '', detail: {} },
      { ruleCode: 'R008', score: 84, confidence: 0.84, isSymptomOnly: false, layer: 'bff', cluster: 'gateway_failure', evidenceIds: ['e3'], title: '', summary: '', detail: {} },
    ];
    const ranked = service.rank(findings);
    const clusters = ranked.map((r) => r.cluster);
    expect(new Set(clusters).size).toBe(clusters.length);
  });

  it('should handle empty findings', () => {
    const ranked = service.rank([]);
    expect(ranked).toEqual([]);
  });

  it('should compute score with confidence and bonuses', () => {
    const finding: RuleFinding = {
      ruleCode: 'R001', score: 0, confidence: 0.5, isSymptomOnly: false,
      layer: 'api', cluster: 'api_failure', evidenceIds: ['e1', 'e2'],
      title: 'test', summary: 'test', detail: {},
    };
    const ranked = service.rank([finding]);
    expect(ranked[0].score).toBeGreaterThan(50);
    expect(ranked[0].score).toBeLessThanOrEqual(100);
  });
});
