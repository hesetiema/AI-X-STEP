import { RuleFinding } from '../../src/diagnosis/interfaces/diagnosis.types';

type ExpectedSingleRuleHit = {
  ruleCode: string;
  layer: string;
  cluster: string;
  isSymptomOnly: boolean;
  evidenceIds?: string[];
  detail?: Record<string, unknown>;
};

export function expectSingleRuleHit(
  result: RuleFinding[],
  expected: ExpectedSingleRuleHit,
): void {
  expect(result).toHaveLength(1);

  const finding = result[0];

  expect(finding.ruleCode).toBe(expected.ruleCode);
  expect(finding.layer).toBe(expected.layer);
  expect(finding.cluster).toBe(expected.cluster);
  expect(finding.isSymptomOnly).toBe(expected.isSymptomOnly);

  if (expected.evidenceIds !== undefined) {
    expect(finding.evidenceIds).toEqual(expected.evidenceIds);
  }

  if (expected.detail !== undefined) {
    expect(finding.detail).toMatchObject(expected.detail);
  }
}

export function expectRuleMiss(result: RuleFinding[]): void {
  expect(result).toEqual([]);
}
