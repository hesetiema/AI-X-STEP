下面给你 **方案 A 配套的完整 Jest 测试最终版**，我会按我上一条给出的生产代码 skeleton 路径来对齐，尽量做到你直接复制即可。

我分成 4 组：

1. `test/helpers/*`
2. `test/unit/*`
3. `test/integration/*`
4. `test/e2e/*`

另外补一个：

5. `test/jest-e2e.json`

---

# 一、test helpers

---

## `test/helpers/diagnosis-context.fixture.ts`

```ts
import { DiagnosisContext } from '../../src/diagnosis/domain/types/diagnosis.types';

export function buildDiagnosisContext(
  overrides: Partial<DiagnosisContext> = {},
): DiagnosisContext {
  return {
    traceId: 'trace-001',
    interactionId: 'interaction-001',
    targetId: 'button-submit',
    sessionId: 'session-001',
    occurredAt: '2026-06-12T10:00:00.000Z',
    symptoms: ['submit_failed', 'ui_loading'],
    evidence: [
      {
        id: 'ev-001',
        type: 'ui_event',
        label: 'click submit',
        value: { element: '#submit-btn' },
        source: 'frontend-sdk',
      },
      {
        id: 'ev-002',
        type: 'network_error',
        label: 'POST /orders 500',
        value: { status: 500, url: '/api/orders' },
        source: 'network-observer',
      },
      {
        id: 'ev-003',
        type: 'ui_state',
        label: 'loading > 10s',
        value: { loadingMs: 10000 },
        source: 'frontend-sdk',
      },
    ],
    meta: {
      page: '/checkout',
      appVersion: '1.0.0',
    },
    ...overrides,
  };
}
```

---

## `test/helpers/diagnosis-finding.fixture.ts`

```ts
import {
  DiagnosisLayer,
  RankedFinding,
  RuleFinding,
  RuleMeta,
} from '../../src/diagnosis/domain/types/diagnosis.types';

interface BuildRuleFindingOptions extends Partial<RuleFinding> {
  code?: string;
  layer?: DiagnosisLayer;
  cluster?: string;
  confidence?: number;
  isSymptomOnly?: boolean;
}

export function buildRuleMeta(
  overrides: Partial<RuleMeta> = {},
): RuleMeta {
  return {
    code: 'R201',
    name: 'API 5xx indicates downstream instability',
    cluster: 'api_failure',
    layer: 'api',
    severity: 'high',
    isSymptomOnly: false,
    ...overrides,
  };
}

export function buildRuleFinding(
  options: BuildRuleFindingOptions = {},
): RuleFinding {
  const code = options.code ?? 'R201';
  const layer = options.layer ?? 'api';
  const cluster = options.cluster ?? 'api_failure';
  const confidence = options.confidence ?? 0.82;
  const isSymptomOnly = options.isSymptomOnly ?? false;

  return {
    ruleCode: code,
    title: `${code} finding`,
    summary: `${code} matched on ${layer}`,
    confidence,
    score: Math.round(confidence * 100),
    layer,
    cluster,
    evidenceIds: ['ev-001', 'ev-002'],
    isSymptomOnly,
    detail: {
      matched: true,
    },
    rule: buildRuleMeta({
      code,
      layer,
      cluster,
      isSymptomOnly,
    }),
    ...options,
  };
}

export function buildRankedFinding(
  overrides: Partial<RankedFinding> = {},
): RankedFinding {
  const base = buildRuleFinding(overrides);

  return {
    ...base,
    rankScore: {
      baseScore: 80,
      evidenceScore: 8,
      layerScore: 10,
      clusterPenalty: 0,
      symptomPenalty: base.isSymptomOnly ? -20 : 0,
      finalScore: base.isSymptomOnly ? 68 : 98,
    },
    ...overrides,
  };
}
```

---

## `test/helpers/diagnosis-conclusion.fixture.ts`

```ts
import {
  DiagnosisConclusion,
  RankedFinding,
} from '../../src/diagnosis/domain/types/diagnosis.types';
import { buildRankedFinding } from './diagnosis-finding.fixture';

export function buildDiagnosisConclusion(
  overrides: Partial<DiagnosisConclusion> = {},
): DiagnosisConclusion {
  const topCause =
    overrides.topCause === undefined
      ? buildRankedFinding({
          ruleCode: 'R201',
          title: 'API 5xx root cause',
          layer: 'api',
          cluster: 'api_failure',
          confidence: 0.91,
          isSymptomOnly: false,
          rankScore: {
            baseScore: 91,
            evidenceScore: 10,
            layerScore: 8,
            clusterPenalty: 0,
            symptomPenalty: 0,
            finalScore: 109,
          },
        })
      : overrides.topCause;

  const supportingCauses =
    overrides.supportingCauses ??
    [
      buildRankedFinding({
        ruleCode: 'R301',
        title: 'DB timeout supporting cause',
        layer: 'db',
        cluster: 'db_timeout',
        confidence: 0.78,
        isSymptomOnly: false,
        rankScore: {
          baseScore: 78,
          evidenceScore: 8,
          layerScore: 4,
          clusterPenalty: 0,
          symptomPenalty: 0,
          finalScore: 90,
        },
      }),
    ];

  const symptoms =
    overrides.symptoms ??
    [
      buildRankedFinding({
        ruleCode: 'R501',
        title: 'UI loading symptom',
        layer: 'ui_state',
        cluster: 'ui_loading',
        confidence: 0.74,
        isSymptomOnly: true,
        rankScore: {
          baseScore: 74,
          evidenceScore: 4,
          layerScore: 2,
          clusterPenalty: 0,
          symptomPenalty: -20,
          finalScore: 60,
        },
      }),
    ];

  return {
    topCause,
    supportingCauses,
    symptoms,
    diagnosisState: 'confirmed',
    summary: 'Top cause is API failure, supported by DB timeout and surfaced as UI loading.',
    ...overrides,
  };
}

export function pickRankedFindingsForConclusion(): RankedFinding[] {
  return [
    buildRankedFinding({
      ruleCode: 'R201',
      title: 'API 5xx root cause',
      layer: 'api',
      cluster: 'api_failure',
      confidence: 0.92,
      isSymptomOnly: false,
      rankScore: {
        baseScore: 92,
        evidenceScore: 8,
        layerScore: 8,
        clusterPenalty: 0,
        symptomPenalty: 0,
        finalScore: 108,
      },
    }),
    buildRankedFinding({
      ruleCode: 'R301',
      title: 'DB timeout supporting cause',
      layer: 'db',
      cluster: 'db_timeout',
      confidence: 0.76,
      isSymptomOnly: false,
      rankScore: {
        baseScore: 76,
        evidenceScore: 6,
        layerScore: 4,
        clusterPenalty: 0,
        symptomPenalty: 0,
        finalScore: 86,
      },
    }),
    buildRankedFinding({
      ruleCode: 'R501',
      title: 'UI loading symptom',
      layer: 'ui_state',
      cluster: 'ui_loading',
      confidence: 0.88,
      isSymptomOnly: true,
      rankScore: {
        baseScore: 88,
        evidenceScore: 4,
        layerScore: 2,
        clusterPenalty: 0,
        symptomPenalty: -20,
        finalScore: 74,
      },
    }),
  ];
}
```

---

## `test/helpers/diagnosis-domino.fixture.ts`

```ts
import { DominoChain } from '../../src/diagnosis/domain/types/diagnosis.types';
import { buildRankedFinding } from './diagnosis-finding.fixture';

export function buildDominoChain(
  overrides: Partial<DominoChain> = {},
): DominoChain {
  return {
    nodes: [
      {
        id: 'node:root:api:api_failure',
        type: 'root',
        title: 'Root: API 5xx root cause',
        layer: 'api',
        findings: [
          buildRankedFinding({
            ruleCode: 'R201',
            title: 'API 5xx root cause',
            layer: 'api',
            cluster: 'api_failure',
            isSymptomOnly: false,
          }),
        ],
      },
      {
        id: 'node:supporting:db:db_timeout',
        type: 'supporting',
        title: 'Supporting: DB timeout supporting cause',
        layer: 'db',
        findings: [
          buildRankedFinding({
            ruleCode: 'R301',
            title: 'DB timeout supporting cause',
            layer: 'db',
            cluster: 'db_timeout',
            isSymptomOnly: false,
          }),
        ],
      },
      {
        id: 'node:symptom:ui_state:ui_loading',
        type: 'symptom',
        title: 'Symptom: UI loading symptom',
        layer: 'ui_state',
        findings: [
          buildRankedFinding({
            ruleCode: 'R501',
            title: 'UI loading symptom',
            layer: 'ui_state',
            cluster: 'ui_loading',
            isSymptomOnly: true,
          }),
        ],
      },
    ],
    edges: [
      {
        from: 'node:root:api:api_failure',
        to: 'node:supporting:db:db_timeout',
        relation: 'contributes_to',
      },
      {
        from: 'node:supporting:db:db_timeout',
        to: 'node:symptom:ui_state:ui_loading',
        relation: 'leads_to',
      },
    ],
    ...overrides,
  };
}
```

---

## `test/helpers/diagnosis-task.fixture.ts`

```ts
import { DiagnosisTaskEntity } from '../../src/diagnosis/domain/types/diagnosis.types';
import { buildDiagnosisConclusion } from './diagnosis-conclusion.fixture';
import { buildDominoChain } from './diagnosis-domino.fixture';

export function buildDiagnosisTaskEntity(
  overrides: Partial<DiagnosisTaskEntity> = {},
): DiagnosisTaskEntity {
  return {
    id: 'diag-001',
    status: 'pending',
    input: {
      traceId: 'trace-001',
      targetId: 'button-submit',
      interactionId: 'interaction-001',
      symptoms: ['ui_loading'],
      evidence: [
        {
          id: 'ev-001',
          type: 'network_error',
          label: 'POST /orders 500',
          value: { status: 500 },
          source: 'network-observer',
        },
      ],
    },
    createdAt: '2026-06-12T10:00:00.000Z',
    updatedAt: '2026-06-12T10:00:00.000Z',
    ...overrides,
  };
}

export function buildCompletedDiagnosisTaskEntity(
  overrides: Partial<DiagnosisTaskEntity> = {},
): DiagnosisTaskEntity {
  return buildDiagnosisTaskEntity({
    status: 'completed',
    result: {
      conclusion: buildDiagnosisConclusion(),
      dominoChain: buildDominoChain(),
      explanation:
        'Diagnosis trace trace-001 on target button-submit. Top cause: API 5xx root cause (R201), confidence 91%.',
    },
    ...overrides,
  });
}
```

---

## `test/helpers/fake-diagnosis-task.repository.ts`

```ts
import { DiagnosisTaskRepository } from '../../src/diagnosis/application/ports/diagnosis-task.repository';
import {
  DiagnosisResult,
  DiagnosisTaskEntity,
} from '../../src/diagnosis/domain/types/diagnosis.types';

export class FakeDiagnosisTaskRepository implements DiagnosisTaskRepository {
  private readonly store = new Map<string, DiagnosisTaskEntity>();
  private sequence = 0;

  async create(input: Record<string, unknown>): Promise<DiagnosisTaskEntity> {
    this.sequence += 1;
    const now = new Date().toISOString();

    const entity: DiagnosisTaskEntity = {
      id: `diag-${this.sequence}`,
      status: 'pending',
      input,
      createdAt: now,
      updatedAt: now,
    };

    this.store.set(entity.id, entity);
    return entity;
  }

  async findById(id: string): Promise<DiagnosisTaskEntity | null> {
    return this.store.get(id) ?? null;
  }

  async saveResult(
    id: string,
    result: DiagnosisResult,
  ): Promise<DiagnosisTaskEntity> {
    const entity = this.store.get(id);
    if (!entity) {
      throw new Error(`Diagnosis task not found: ${id}`);
    }

    const updated: DiagnosisTaskEntity = {
      ...entity,
      status: 'completed',
      result,
      updatedAt: new Date().toISOString(),
    };

    this.store.set(id, updated);
    return updated;
  }

  seed(entity: DiagnosisTaskEntity): void {
    this.store.set(entity.id, entity);
  }

  clear(): void {
    this.store.clear();
  }
}
```

---

# 二、unit tests

---

## `test/unit/ranking.service.spec.ts`

```ts
import { RankingService } from '../../src/diagnosis/application/services/ranking.service';
import { buildRuleFinding } from '../helpers/diagnosis-finding.fixture';

describe('RankingService', () => {
  let service: RankingService;

  beforeEach(() => {
    service = new RankingService();
  });

  it('should rank root-cause findings before symptom-only findings', () => {
    const input = [
      buildRuleFinding({
        ruleCode: 'R501',
        title: 'UI loading symptom',
        layer: 'ui_state',
        cluster: 'ui_loading',
        confidence: 0.95,
        isSymptomOnly: true,
      }),
      buildRuleFinding({
        ruleCode: 'R201',
        title: 'API 5xx root cause',
        layer: 'api',
        cluster: 'api_failure',
        confidence: 0.82,
        isSymptomOnly: false,
      }),
    ];

    const result = service.rank(input);

    expect(result[0].ruleCode).toBe('R201');
    expect(result[1].ruleCode).toBe('R501');
    expect(result[0].rankScore.finalScore).toBeGreaterThan(
      result[1].rankScore.finalScore,
    );
  });

  it('should prefer upstream layers when confidence is close', () => {
    const input = [
      buildRuleFinding({
        ruleCode: 'R301',
        title: 'DB timeout supporting cause',
        layer: 'db',
        cluster: 'db_timeout',
        confidence: 0.8,
        isSymptomOnly: false,
      }),
      buildRuleFinding({
        ruleCode: 'R201',
        title: 'API 5xx root cause',
        layer: 'api',
        cluster: 'api_failure',
        confidence: 0.8,
        isSymptomOnly: false,
      }),
    ];

    const result = service.rank(input);

    expect(result[0].ruleCode).toBe('R201');
    expect(result[0].rankScore.layerScore).toBeGreaterThan(
      result[1].rankScore.layerScore,
    );
  });

  it('should apply cluster penalty to later duplicated cluster findings', () => {
    const input = [
      buildRuleFinding({
        ruleCode: 'R201',
        title: 'API 5xx root cause',
        layer: 'api',
        cluster: 'api_failure',
        confidence: 0.91,
      }),
      buildRuleFinding({
        ruleCode: 'R202',
        title: 'API gateway failure',
        layer: 'api',
        cluster: 'api_failure',
        confidence: 0.89,
      }),
      buildRuleFinding({
        ruleCode: 'R301',
        title: 'DB timeout support',
        layer: 'db',
        cluster: 'db_timeout',
        confidence: 0.84,
      }),
    ];

    const result = service.rank(input);

    const r201 = result.find((x) => x.ruleCode === 'R201');
    const r202 = result.find((x) => x.ruleCode === 'R202');

    expect(r201).toBeDefined();
    expect(r202).toBeDefined();
    expect(r201!.rankScore.clusterPenalty).toBe(0);
    expect(r202!.rankScore.clusterPenalty).toBeLessThan(0);
  });

  it('should reward richer evidence', () => {
    const input = [
      buildRuleFinding({
        ruleCode: 'R201',
        title: 'Sparse evidence API failure',
        evidenceIds: ['ev-1'],
        confidence: 0.82,
        cluster: 'api_failure',
        layer: 'api',
      }),
      buildRuleFinding({
        ruleCode: 'R203',
        title: 'Richer evidence API failure',
        evidenceIds: ['ev-1', 'ev-2', 'ev-3', 'ev-4'],
        confidence: 0.82,
        cluster: 'gateway_failure',
        layer: 'api',
      }),
    ];

    const result = service.rank(input);

    const sparse = result.find((x) => x.ruleCode === 'R201');
    const rich = result.find((x) => x.ruleCode === 'R203');

    expect(sparse).toBeDefined();
    expect(rich).toBeDefined();
    expect(rich!.rankScore.evidenceScore).toBeGreaterThan(
      sparse!.rankScore.evidenceScore,
    );
  });

  it('should penalize symptom-only findings even when confidence is high', () => {
    const input = [
      buildRuleFinding({
        ruleCode: 'R501',
        title: 'High-confidence symptom',
        layer: 'ui_state',
        cluster: 'ui_loading',
        confidence: 0.96,
        isSymptomOnly: true,
      }),
      buildRuleFinding({
        ruleCode: 'R301',
        title: 'Lower-confidence supporting root candidate',
        layer: 'db',
        cluster: 'db_timeout',
        confidence: 0.75,
        isSymptomOnly: false,
      }),
    ];

    const result = service.rank(input);

    expect(result[0].ruleCode).toBe('R301');
    expect(result[1].ruleCode).toBe('R501');
    expect(result[1].rankScore.symptomPenalty).toBe(-20);
  });
});
```

---

## `test/unit/diagnosis-conclusion.service.spec.ts`

```ts
import { DiagnosisConclusionService } from '../../src/diagnosis/application/services/diagnosis-conclusion.service';
import { pickRankedFindingsForConclusion } from '../helpers/diagnosis-conclusion.fixture';
import { buildRankedFinding } from '../helpers/diagnosis-finding.fixture';

describe('DiagnosisConclusionService', () => {
  let service: DiagnosisConclusionService;

  beforeEach(() => {
    service = new DiagnosisConclusionService();
  });

  it('should split top cause, supporting causes, and symptoms', () => {
    const ranked = pickRankedFindingsForConclusion();

    const result = service.buildConclusion(ranked);

    expect(result.topCause).not.toBeNull();
    expect(result.topCause?.ruleCode).toBe('R201');
    expect(result.supportingCauses.map((x) => x.ruleCode)).toContain('R301');
    expect(result.symptoms.map((x) => x.ruleCode)).toContain('R501');
  });

  it('should mark diagnosisState as confirmed when top confidence >= 0.85', () => {
    const ranked = [
      buildRankedFinding({
        ruleCode: 'R201',
        confidence: 0.9,
        isSymptomOnly: false,
      }),
    ];

    const result = service.buildConclusion(ranked);

    expect(result.diagnosisState).toBe('confirmed');
  });

  it('should mark diagnosisState as probable when top confidence is between 0.6 and 0.85', () => {
    const ranked = [
      buildRankedFinding({
        ruleCode: 'R201',
        confidence: 0.61,
        isSymptomOnly: false,
      }),
    ];

    const result = service.buildConclusion(ranked);

    expect(result.diagnosisState).toBe('probable');
  });

  it('should return inconclusive when there is no root-cause finding', () => {
    const ranked = [
      buildRankedFinding({
        ruleCode: 'R501',
        title: 'UI loading symptom',
        isSymptomOnly: true,
        confidence: 0.9,
      }),
    ];

    const result = service.buildConclusion(ranked);

    expect(result.topCause).toBeNull();
    expect(result.supportingCauses).toHaveLength(0);
    expect(result.symptoms).toHaveLength(1);
    expect(result.diagnosisState).toBe('inconclusive');
  });

  it('should build readable summary with top cause and supporting/symptom codes', () => {
    const ranked = pickRankedFindingsForConclusion();

    const result = service.buildConclusion(ranked);

    expect(result.summary).toContain('R201');
    expect(result.summary).toContain('R301');
    expect(result.summary).toContain('R501');
  });
});
```

---

## `test/unit/domino-chain.builder.spec.ts`

```ts
import { DominoChainBuilder } from '../../src/diagnosis/application/builders/domino-chain.builder';
import { buildDiagnosisConclusion } from '../helpers/diagnosis-conclusion.fixture';

describe('DominoChainBuilder', () => {
  let builder: DominoChainBuilder;

  beforeEach(() => {
    builder = new DominoChainBuilder();
  });

  it('should build root/supporting/symptom nodes', () => {
    const conclusion = buildDiagnosisConclusion();

    const result = builder.build(conclusion);

    expect(result.nodes.some((x) => x.type === 'root')).toBe(true);
    expect(result.nodes.some((x) => x.type === 'supporting')).toBe(true);
    expect(result.nodes.some((x) => x.type === 'symptom')).toBe(true);
    expect(result.edges.length).toBeGreaterThan(0);
  });

  it('should aggregate multiple findings into one node when type/layer/cluster match', () => {
    const base = buildDiagnosisConclusion();

    const conclusion = buildDiagnosisConclusion({
      topCause: base.topCause,
      supportingCauses: [
        {
          ...base.supportingCauses[0],
          ruleCode: 'R301',
          title: 'DB timeout supporting cause',
          cluster: 'db_timeout',
          layer: 'db',
        },
        {
          ...base.supportingCauses[0],
          ruleCode: 'R302',
          title: 'DB saturation supporting cause',
          cluster: 'db_timeout',
          layer: 'db',
        },
      ],
      symptoms: base.symptoms,
    });

    const result = builder.build(conclusion);

    const dbSupportingNodes = result.nodes.filter(
      (x) =>
        x.type === 'supporting' &&
        x.layer === 'db' &&
        x.id === 'node:supporting:db:db_timeout',
    );

    expect(dbSupportingNodes).toHaveLength(1);
    expect(dbSupportingNodes[0].findings.map((x) => x.ruleCode)).toEqual(
      expect.arrayContaining(['R301', 'R302']),
    );
  });

  it('should connect root to supporting and supporting to symptom', () => {
    const conclusion = buildDiagnosisConclusion();

    const result = builder.build(conclusion);

    expect(result.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          relation: 'contributes_to',
        }),
        expect.objectContaining({
          relation: 'leads_to',
        }),
      ]),
    );
  });

  it('should connect root directly to symptom when no supporting nodes exist', () => {
    const base = buildDiagnosisConclusion();

    const conclusion = buildDiagnosisConclusion({
      topCause: base.topCause,
      supportingCauses: [],
      symptoms: base.symptoms,
    });

    const result = builder.build(conclusion);

    expect(result.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: 'node:root:api:api_failure',
          to: 'node:symptom:ui_state:ui_loading',
          relation: 'explains',
        }),
      ]),
    );
  });
});
```

---

## `test/unit/explanation.builder.spec.ts`

```ts
import { ExplanationBuilder } from '../../src/diagnosis/application/builders/explanation.builder';
import { buildDiagnosisConclusion } from '../helpers/diagnosis-conclusion.fixture';
import { buildDiagnosisContext } from '../helpers/diagnosis-context.fixture';

describe('ExplanationBuilder', () => {
  let builder: ExplanationBuilder;

  beforeEach(() => {
    builder = new ExplanationBuilder();
  });

  it('should generate readable explanation from conclusion and context', () => {
    const conclusion = buildDiagnosisConclusion();
    const context = buildDiagnosisContext();

    const result = builder.build(conclusion, context);

    expect(typeof result).toBe('string');
    expect(result).toContain('trace-001');
    expect(result).toContain('button-submit');
    expect(result).toContain('API 5xx root cause');
    expect(result.length).toBeGreaterThan(40);
  });

  it('should mention supporting causes and symptoms when present', () => {
    const conclusion = buildDiagnosisConclusion();
    const context = buildDiagnosisContext();

    const result = builder.build(conclusion, context);

    expect(result).toContain('Supporting causes');
    expect(result).toContain('Symptoms');
    expect(result).toContain('R301');
    expect(result).toContain('R501');
  });

  it('should not re-rank or re-judge root cause and should use provided conclusion directly', () => {
    const conclusion = buildDiagnosisConclusion({
      topCause: buildDiagnosisConclusion().supportingCauses[0],
      diagnosisState: 'probable',
    });
    const context = buildDiagnosisContext();

    const result = builder.build(conclusion, context);

    expect(result).toContain(conclusion.topCause!.title);
    expect(result).toContain('Diagnosis state: probable.');
  });

  it('should handle no top cause gracefully', () => {
    const conclusion = buildDiagnosisConclusion({
      topCause: null,
      supportingCauses: [],
      symptoms: buildDiagnosisConclusion().symptoms,
      diagnosisState: 'inconclusive',
    });
    const context = buildDiagnosisContext();

    const result = builder.build(conclusion, context);

    expect(result).toContain('No root cause was confidently identified.');
    expect(result).toContain('Diagnosis state: inconclusive.');
  });
});
```

---

## `test/unit/diagnosis-context.builder.spec.ts`

```ts
import { DiagnosisContextBuilder } from '../../src/diagnosis/application/builders/diagnosis-context.builder';
import { buildDiagnosisTaskEntity } from '../helpers/diagnosis-task.fixture';

describe('DiagnosisContextBuilder', () => {
  let builder: DiagnosisContextBuilder;

  beforeEach(() => {
    builder = new DiagnosisContextBuilder();
  });

  it('should build normalized context from task input', () => {
    const task = buildDiagnosisTaskEntity({
      input: {
        traceId: 'trace-ctx-001',
        targetId: 'btn-submit',
        interactionId: 'interaction-ctx-001',
        sessionId: 'session-ctx-001',
        occurredAt: '2026-06-12T09:00:00.000Z',
        symptoms: ['ui_loading'],
        evidence: [
          {
            id: 'ev-ctx-1',
            type: 'network_error',
            label: 'POST /orders 500',
            value: { status: 500 },
            source: 'network-observer',
          },
        ],
        meta: {
          page: '/checkout',
        },
      },
    });

    const result = builder.build(task);

    expect(result.traceId).toBe('trace-ctx-001');
    expect(result.targetId).toBe('btn-submit');
    expect(result.interactionId).toBe('interaction-ctx-001');
    expect(result.sessionId).toBe('session-ctx-001');
    expect(result.symptoms).toEqual(['ui_loading']);
    expect(result.evidence).toHaveLength(1);
    expect(result.meta).toEqual({ page: '/checkout' });
  });

  it('should fallback interactionId and occurredAt when absent', () => {
    const task = buildDiagnosisTaskEntity({
      id: 'diag-fallback',
      createdAt: '2026-06-12T11:00:00.000Z',
      input: {
        traceId: 'trace-fallback',
        targetId: 'btn-fallback',
      },
    });

    const result = builder.build(task);

    expect(result.interactionId).toBe('interaction-diag-fallback');
    expect(result.occurredAt).toBe('2026-06-12T11:00:00.000Z');
  });

  it('should return empty evidence array when input.evidence is not an array', () => {
    const task = buildDiagnosisTaskEntity({
      input: {
        traceId: 'trace-invalid',
        targetId: 'btn-invalid',
        evidence: null as unknown as any[],
      },
    });

    const result = builder.build(task);

    expect(result.evidence).toEqual([]);
  });

  it('should normalize evidence item defaults', () => {
    const task = buildDiagnosisTaskEntity({
      input: {
        traceId: 'trace-ev',
        targetId: 'btn-ev',
        evidence: [
          {
            type: 'console_error',
          },
        ],
      },
    });

    const result = builder.build(task);

    expect(result.evidence[0]).toEqual({
      id: 'ev-1',
      type: 'console_error',
      label: 'evidence-1',
      value: undefined,
      source: undefined,
    });
  });
});
```

---

## `test/unit/diagnosis-create.service.spec.ts`

```ts
import { DiagnosisCreateService } from '../../src/diagnosis/application/services/diagnosis-create.service';
import { FakeDiagnosisTaskRepository } from '../helpers/fake-diagnosis-task.repository';

describe('DiagnosisCreateService', () => {
  let repository: FakeDiagnosisTaskRepository;
  let service: DiagnosisCreateService;

  beforeEach(() => {
    repository = new FakeDiagnosisTaskRepository();
    service = new DiagnosisCreateService(repository);
  });

  it('should create pending diagnosis task only', async () => {
    const result = await service.create({
      traceId: 'trace-001',
      targetId: 'button-submit',
      interactionId: 'interaction-001',
      symptoms: ['ui_loading'],
      evidence: [
        {
          id: 'ev-001',
          type: 'network_error',
          label: 'POST /orders 500',
          value: { status: 500 },
          source: 'network-observer',
        },
      ],
      meta: {
        page: '/checkout',
      },
    });

    expect(result.id).toBeDefined();
    expect(result.status).toBe('pending');
    expect(result.input.traceId).toBe('trace-001');
    expect(result.result).toBeUndefined();
  });

  it('should fill optional arrays/objects with defaults', async () => {
    const result = await service.create({
      traceId: 'trace-002',
      targetId: 'button-002',
    });

    expect(result.input.symptoms).toEqual([]);
    expect(result.input.evidence).toEqual([]);
    expect(result.input.meta).toEqual({});
  });
});
```

---

## `test/unit/diagnosis-query.service.spec.ts`

```ts
import { NotFoundException } from '@nestjs/common';
import { DiagnosisQueryService } from '../../src/diagnosis/application/services/diagnosis-query.service';
import { FakeDiagnosisTaskRepository } from '../helpers/fake-diagnosis-task.repository';
import { buildDiagnosisContext } from '../helpers/diagnosis-context.fixture';
import {
  buildCompletedDiagnosisTaskEntity,
  buildDiagnosisTaskEntity,
} from '../helpers/diagnosis-task.fixture';
import {
  buildRuleFinding,
  buildRankedFinding,
} from '../helpers/diagnosis-finding.fixture';
import { buildDiagnosisConclusion } from '../helpers/diagnosis-conclusion.fixture';
import { buildDominoChain } from '../helpers/diagnosis-domino.fixture';

describe('DiagnosisQueryService', () => {
  let repository: FakeDiagnosisTaskRepository;
  let contextBuilder: { build: jest.Mock };
  let ruleEngine: { evaluate: jest.Mock };
  let rankingService: { rank: jest.Mock };
  let conclusionService: { buildConclusion: jest.Mock };
  let dominoChainBuilder: { build: jest.Mock };
  let explanationBuilder: { build: jest.Mock };
  let service: DiagnosisQueryService;

  beforeEach(() => {
    repository = new FakeDiagnosisTaskRepository();

    contextBuilder = {
      build: jest.fn().mockReturnValue(buildDiagnosisContext()),
    };

    ruleEngine = {
      evaluate: jest.fn().mockReturnValue([
        buildRuleFinding({ ruleCode: 'R201' }),
      ]),
    };

    rankingService = {
      rank: jest.fn().mockReturnValue([
        buildRankedFinding({ ruleCode: 'R201' }),
      ]),
    };

    conclusionService = {
      buildConclusion: jest.fn().mockReturnValue(buildDiagnosisConclusion()),
    };

    dominoChainBuilder = {
      build: jest.fn().mockReturnValue(buildDominoChain()),
    };

    explanationBuilder = {
      build: jest.fn().mockReturnValue('diagnosis explanation'),
    };

    service = new DiagnosisQueryService(
      repository,
      contextBuilder as any,
      ruleEngine as any,
      rankingService as any,
      conclusionService as any,
      dominoChainBuilder as any,
      explanationBuilder as any,
    );
  });

  it('should return cached result when task is already completed', async () => {
    const completed = buildCompletedDiagnosisTaskEntity({ id: 'diag-cached' });
    repository.seed(completed);

    const result = await service.getById('diag-cached');

    expect(result).toEqual(completed);
    expect(contextBuilder.build).not.toHaveBeenCalled();
    expect(ruleEngine.evaluate).not.toHaveBeenCalled();
    expect(rankingService.rank).not.toHaveBeenCalled();
  });

  it('should execute diagnosis lazily when task is pending', async () => {
    const pending = buildDiagnosisTaskEntity({ id: 'diag-pending' });
    repository.seed(pending);

    const result = await service.getById('diag-pending');

    expect(contextBuilder.build).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'diag-pending' }),
    );
    expect(ruleEngine.evaluate).toHaveBeenCalledTimes(1);
    expect(rankingService.rank).toHaveBeenCalledTimes(1);
    expect(conclusionService.buildConclusion).toHaveBeenCalledTimes(1);
    expect(dominoChainBuilder.build).toHaveBeenCalledTimes(1);
    expect(explanationBuilder.build).toHaveBeenCalledTimes(1);

    expect(result.status).toBe('completed');
    expect(result.result?.explanation).toBe('diagnosis explanation');
  });

  it('should throw NotFoundException when task does not exist', async () => {
    await expect(service.getById('missing-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('should propagate execution error and keep task pending in MVP', async () => {
    const pending = buildDiagnosisTaskEntity({ id: 'diag-error' });
    repository.seed(pending);

    ruleEngine.evaluate.mockImplementation(() => {
      throw new Error('rule-engine boom');
    });

    await expect(service.getById('diag-error')).rejects.toThrow(
      'rule-engine boom',
    );

    const stored = await repository.findById('diag-error');
    expect(stored?.status).toBe('pending');
    expect(stored?.result).toBeUndefined();
  });
});
```

---

# 三、rule tests

---

## `test/unit/rules/r201-api-5xx.rule.spec.ts`

```ts
import { R201Api5xxRule } from '../../../src/diagnosis/domain/rule-engine/rules/r201-api-5xx.rule';
import { buildDiagnosisContext } from '../../helpers/diagnosis-context.fixture';

describe('R201Api5xxRule', () => {
  let rule: R201Api5xxRule;

  beforeEach(() => {
    rule = new R201Api5xxRule();
  });

  it('should hit when network_error status >= 500', () => {
    const context = buildDiagnosisContext({
      evidence: [
        {
          id: 'ev-api-1',
          type: 'network_error',
          label: 'POST /orders 500',
          value: { status: 500, url: '/api/orders' },
          source: 'network-observer',
        },
      ],
    });

    const result = rule.evaluate(context);

    expect(result).toHaveLength(1);
    expect(result[0].ruleCode).toBe('R201');
    expect(result[0].layer).toBe('api');
    expect(result[0].cluster).toBe('api_failure');
    expect(result[0].evidenceIds).toEqual(['ev-api-1']);
  });

  it('should not hit when there is no 5xx evidence', () => {
    const context = buildDiagnosisContext({
      evidence: [
        {
          id: 'ev-api-2',
          type: 'network_error',
          label: 'POST /orders 400',
          value: { status: 400, url: '/api/orders' },
          source: 'network-observer',
        },
      ],
    });

    const result = rule.evaluate(context);

    expect(result).toEqual([]);
  });
});
```

---

## `test/unit/rules/r301-db-timeout.rule.spec.ts`

```ts
import { R301DbTimeoutRule } from '../../../src/diagnosis/domain/rule-engine/rules/r301-db-timeout.rule';
import { buildDiagnosisContext } from '../../helpers/diagnosis-context.fixture';

describe('R301DbTimeoutRule', () => {
  let rule: R301DbTimeoutRule;

  beforeEach(() => {
    rule = new R301DbTimeoutRule();
  });

  it('should hit when evidence label contains db/timeout/sql', () => {
    const context = buildDiagnosisContext({
      evidence: [
        {
          id: 'ev-db-1',
          type: 'trace_span',
          label: 'db timeout on order query',
          value: { durationMs: 2200 },
          source: 'trace',
        },
      ],
    });

    const result = rule.evaluate(context);

    expect(result).toHaveLength(1);
    expect(result[0].ruleCode).toBe('R301');
    expect(result[0].layer).toBe('db');
    expect(result[0].cluster).toBe('db_timeout');
    expect(result[0].evidenceIds).toEqual(['ev-db-1']);
  });

  it('should hit when evidence value contains dbTimeoutMs', () => {
    const context = buildDiagnosisContext({
      evidence: [
        {
          id: 'ev-db-2',
          type: 'metric',
          label: 'storage latency',
          value: { dbTimeoutMs: 3000 },
          source: 'metrics',
        },
      ],
    });

    const result = rule.evaluate(context);

    expect(result).toHaveLength(1);
    expect(result[0].ruleCode).toBe('R301');
  });

  it('should not hit when db timeout signals are absent', () => {
    const context = buildDiagnosisContext({
      evidence: [
        {
          id: 'ev-db-3',
          type: 'metric',
          label: 'cpu high',
          value: { cpu: 90 },
          source: 'metrics',
        },
      ],
    });

    const result = rule.evaluate(context);

    expect(result).toEqual([]);
  });
});
```

---

## `test/unit/rules/r501-ui-loading-symptom.rule.spec.ts`

```ts
import { R501UiLoadingSymptomRule } from '../../../src/diagnosis/domain/rule-engine/rules/r501-ui-loading-symptom.rule';
import { buildDiagnosisContext } from '../../helpers/diagnosis-context.fixture';

describe('R501UiLoadingSymptomRule', () => {
  let rule: R501UiLoadingSymptomRule;

  beforeEach(() => {
    rule = new R501UiLoadingSymptomRule();
  });

  it('should hit when ui_state/loading evidence exists', () => {
    const context = buildDiagnosisContext({
      symptoms: [],
      evidence: [
        {
          id: 'ev-ui-1',
          type: 'ui_state',
          label: 'loading > 12s',
          value: { loadingMs: 12000 },
          source: 'frontend-sdk',
        },
      ],
    });

    const result = rule.evaluate(context);

    expect(result).toHaveLength(1);
    expect(result[0].ruleCode).toBe('R501');
    expect(result[0].isSymptomOnly).toBe(true);
    expect(result[0].layer).toBe('ui_state');
  });

  it('should hit when symptoms include loading even without evidence', () => {
    const context = buildDiagnosisContext({
      symptoms: ['ui_loading'],
      evidence: [],
    });

    const result = rule.evaluate(context);

    expect(result).toHaveLength(1);
    expect(result[0].ruleCode).toBe('R501');
  });

  it('should not hit when loading signal is absent', () => {
    const context = buildDiagnosisContext({
      symptoms: ['submit_failed'],
      evidence: [
        {
          id: 'ev-ui-2',
          type: 'ui_event',
          label: 'click button',
          value: { element: '#submit' },
          source: 'frontend-sdk',
        },
      ],
    });

    const result = rule.evaluate(context);

    expect(result).toEqual([]);
  });
});
```

---

# 四、integration tests

---

## `test/integration/rule-engine.service.int.spec.ts`

```ts
import { RuleEngineService } from '../../src/diagnosis/domain/rule-engine/rule-engine.service';
import { DiagnosisRuleRegistry } from '../../src/diagnosis/domain/rule-engine/rule-registry';
import { R201Api5xxRule } from '../../src/diagnosis/domain/rule-engine/rules/r201-api-5xx.rule';
import { R301DbTimeoutRule } from '../../src/diagnosis/domain/rule-engine/rules/r301-db-timeout.rule';
import { R501UiLoadingSymptomRule } from '../../src/diagnosis/domain/rule-engine/rules/r501-ui-loading-symptom.rule';
import { buildDiagnosisContext } from '../helpers/diagnosis-context.fixture';

describe('RuleEngineService (integration)', () => {
  let service: RuleEngineService;

  beforeEach(() => {
    const registry = new DiagnosisRuleRegistry(
      new R201Api5xxRule(),
      new R301DbTimeoutRule(),
      new R501UiLoadingSymptomRule(),
    );

    service = new RuleEngineService(registry);
  });

  it('should hit API-related rule for api 5xx scenario', () => {
    const context = buildDiagnosisContext({
      symptoms: [],
      evidence: [
        {
          id: 'ev-api-1',
          type: 'network_error',
          label: 'POST /orders 500',
          value: { status: 500, url: '/api/orders' },
          source: 'network-observer',
        },
      ],
    });

    const findings = service.evaluate(context);
    const codes = findings.map((x) => x.ruleCode);

    expect(codes).toEqual(expect.arrayContaining(['R201']));
  });

  it('should allow overlapping hits and leave ordering to ranking service', () => {
    const context = buildDiagnosisContext({
      symptoms: ['ui_loading'],
      evidence: [
        {
          id: 'ev-api-1',
          type: 'network_error',
          label: 'gateway timeout 504',
          value: { status: 504, url: '/api/orders' },
          source: 'network-observer',
        },
        {
          id: 'ev-db-1',
          type: 'trace_span',
          label: 'db timeout on order query',
          value: { durationMs: 3500 },
          source: 'trace',
        },
        {
          id: 'ev-ui-1',
          type: 'ui_state',
          label: 'loading > 12s',
          value: { loadingMs: 12000 },
          source: 'frontend-sdk',
        },
      ],
    });

    const findings = service.evaluate(context);
    const codes = findings.map((x) => x.ruleCode);

    expect(codes).toContain('R201');
    expect(codes).toContain('R301');
    expect(codes).toContain('R501');
  });

  it('should dedupe findings by ruleCode + layer + cluster', () => {
    const context = buildDiagnosisContext({
      symptoms: [],
      evidence: [
        {
          id: 'ev-api-1',
          type: 'network_error',
          label: 'POST /orders 500',
          value: { status: 500, url: '/api/orders' },
          source: 'network-observer',
        },
        {
          id: 'ev-api-2',
          type: 'network_error',
          label: 'GET /orders 502',
          value: { status: 502, url: '/api/orders' },
          source: 'network-observer',
        },
      ],
    });

    const findings = service.evaluate(context);
    const r201Findings = findings.filter((x) => x.ruleCode === 'R201');

    expect(r201Findings).toHaveLength(1);
  });

  it('should emit symptom rule when only UI loading evidence exists', () => {
    const context = buildDiagnosisContext({
      symptoms: [],
      evidence: [
        {
          id: 'ev-ui-1',
          type: 'ui_state',
          label: 'loading > 15s',
          value: { loadingMs: 15000 },
          source: 'frontend-sdk',
        },
      ],
    });

    const findings = service.evaluate(context);
    const codes = findings.map((x) => x.ruleCode);

    expect(codes).toEqual(expect.arrayContaining(['R501']));
  });
});
```

---

## `test/integration/diagnosis-flow.int.spec.ts`

> 这个比 e2e 更轻，直接测真实 orchestration 主链。

```ts
import { DiagnosisContextBuilder } from '../../src/diagnosis/application/builders/diagnosis-context.builder';
import { DominoChainBuilder } from '../../src/diagnosis/application/builders/domino-chain.builder';
import { ExplanationBuilder } from '../../src/diagnosis/application/builders/explanation.builder';
import { DiagnosisConclusionService } from '../../src/diagnosis/application/services/diagnosis-conclusion.service';
import { DiagnosisCreateService } from '../../src/diagnosis/application/services/diagnosis-create.service';
import { DiagnosisQueryService } from '../../src/diagnosis/application/services/diagnosis-query.service';
import { RankingService } from '../../src/diagnosis/application/services/ranking.service';
import { RuleEngineService } from '../../src/diagnosis/domain/rule-engine/rule-engine.service';
import { DiagnosisRuleRegistry } from '../../src/diagnosis/domain/rule-engine/rule-registry';
import { R201Api5xxRule } from '../../src/diagnosis/domain/rule-engine/rules/r201-api-5xx.rule';
import { R301DbTimeoutRule } from '../../src/diagnosis/domain/rule-engine/rules/r301-db-timeout.rule';
import { R501UiLoadingSymptomRule } from '../../src/diagnosis/domain/rule-engine/rules/r501-ui-loading-symptom.rule';
import { FakeDiagnosisTaskRepository } from '../helpers/fake-diagnosis-task.repository';

describe('Diagnosis flow (integration)', () => {
  let repository: FakeDiagnosisTaskRepository;
  let createService: DiagnosisCreateService;
  let queryService: DiagnosisQueryService;

  beforeEach(() => {
    repository = new FakeDiagnosisTaskRepository();

    const contextBuilder = new DiagnosisContextBuilder();
    const ruleRegistry = new DiagnosisRuleRegistry(
      new R201Api5xxRule(),
      new R301DbTimeoutRule(),
      new R501UiLoadingSymptomRule(),
    );
    const ruleEngine = new RuleEngineService(ruleRegistry);
    const rankingService = new RankingService();
    const conclusionService = new DiagnosisConclusionService();
    const dominoChainBuilder = new DominoChainBuilder();
    const explanationBuilder = new ExplanationBuilder();

    createService = new DiagnosisCreateService(repository);
    queryService = new DiagnosisQueryService(
      repository,
      contextBuilder,
      ruleEngine,
      rankingService,
      conclusionService,
      dominoChainBuilder,
      explanationBuilder,
    );
  });

  it('should create pending task and resolve completed diagnosis lazily', async () => {
    const created = await createService.create({
      traceId: 'trace-flow-001',
      targetId: 'button-submit',
      interactionId: 'interaction-flow-001',
      symptoms: ['ui_loading'],
      evidence: [
        {
          id: 'ev-api-1',
          type: 'network_error',
          label: 'POST /orders 500',
          value: { status: 500, url: '/api/orders' },
          source: 'network-observer',
        },
        {
          id: 'ev-db-1',
          type: 'trace_span',
          label: 'db timeout on order query',
          value: { durationMs: 2500 },
          source: 'trace',
        },
        {
          id: 'ev-ui-1',
          type: 'ui_state',
          label: 'loading > 10s',
          value: { loadingMs: 10000 },
          source: 'frontend-sdk',
        },
      ],
      meta: {
        page: '/checkout',
      },
    });

    expect(created.status).toBe('pending');

    const resolved = await queryService.getById(created.id);

    expect(resolved.status).toBe('completed');
    expect(resolved.result).toBeDefined();
    expect(resolved.result?.conclusion.topCause?.ruleCode).toBe('R201');
    expect(resolved.result?.conclusion.supportingCauses.map((x) => x.ruleCode)).toContain('R301');
    expect(resolved.result?.conclusion.symptoms.map((x) => x.ruleCode)).toContain('R501');
    expect(resolved.result?.dominoChain.nodes.length).toBeGreaterThan(0);
    expect(typeof resolved.result?.explanation).toBe('string');
  });

  it('should hit cache on second query', async () => {
    const created = await createService.create({
      traceId: 'trace-cache-001',
      targetId: 'button-submit',
      evidence: [
        {
          id: 'ev-api-1',
          type: 'network_error',
          label: 'POST /orders 500',
          value: { status: 500 },
          source: 'network-observer',
        },
      ],
    });

    const first = await queryService.getById(created.id);
    const second = await queryService.getById(created.id);

    expect(first.status).toBe('completed');
    expect(second.status).toBe('completed');
    expect(second.result?.conclusion.topCause?.ruleCode).toBe('R201');
  });
});
```

---

# 五、e2e tests

---

## `test/e2e/diagnosis.controller.e2e-spec.ts`

```ts
import { Body, Controller, Get, Inject, Param, Post, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

@Controller('/api/v1/diagnosis')
class TestDiagnosisController {
  constructor(
    @Inject('DiagnosisCreateService')
    private readonly createService: { create: (body: any) => Promise<any> },
    @Inject('DiagnosisQueryService')
    private readonly queryService: { getById: (id: string) => Promise<any> },
  ) {}

  @Post()
  async create(@Body() body: any) {
    return this.createService.create(body);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.queryService.getById(id);
  }
}

describe('DiagnosisController (e2e skeleton)', () => {
  let app: INestApplication;

  const createService = {
    create: jest.fn(),
  };

  const queryService = {
    getById: jest.fn(),
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TestDiagnosisController],
      providers: [
        {
          provide: 'DiagnosisCreateService',
          useValue: createService,
        },
        {
          provide: 'DiagnosisQueryService',
          useValue: queryService,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await app.close();
  });

  it('POST /api/v1/diagnosis should create task only', async () => {
    createService.create.mockResolvedValue({
      id: 'diag-001',
      status: 'pending',
      createdAt: '2026-06-12T10:00:00.000Z',
      updatedAt: '2026-06-12T10:00:00.000Z',
    });

    await request(app.getHttpServer())
      .post('/api/v1/diagnosis')
      .send({
        traceId: 'trace-001',
        targetId: 'button-submit',
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.id).toBe('diag-001');
        expect(body.status).toBe('pending');
      });

    expect(createService.create).toHaveBeenCalledTimes(1);
  });

  it('GET /api/v1/diagnosis/:id should return diagnosis result', async () => {
    queryService.getById.mockResolvedValue({
      id: 'diag-001',
      status: 'completed',
      createdAt: '2026-06-12T10:00:00.000Z',
      updatedAt: '2026-06-12T10:00:01.000Z',
      result: {
        conclusion: {
          topCause: {
            ruleCode: 'R201',
          },
          supportingCauses: [],
          symptoms: [],
          diagnosisState: 'confirmed',
          summary: 'ok',
        },
        dominoChain: {
          nodes: [],
          edges: [],
        },
        explanation: 'Top cause is API failure.',
      },
    });

    await request(app.getHttpServer())
      .get('/api/v1/diagnosis/diag-001')
      .expect(200)
      .expect(({ body }) => {
        expect(body.id).toBe('diag-001');
        expect(body.status).toBe('completed');
        expect(body.result.conclusion.topCause.ruleCode).toBe('R201');
      });

    expect(queryService.getById).toHaveBeenCalledWith('diag-001');
  });
});
```

---

## `test/e2e/diagnosis.module.semi-real.e2e-spec.ts`

```ts
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

import { DiagnosisModule } from '../../src/diagnosis/diagnosis.module';
import {
  DIAGNOSIS_TASK_REPOSITORY,
} from '../../src/diagnosis/diagnosis.constants';
import { InMemoryDiagnosisTaskRepository } from '../../src/diagnosis/infrastructure/repository/in-memory-diagnosis-task.repository';

describe('DiagnosisModule (semi-real e2e)', () => {
  let app: INestApplication;
  let repository: InMemoryDiagnosisTaskRepository;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [DiagnosisModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    repository = moduleRef.get(DIAGNOSIS_TASK_REPOSITORY);
  });

  afterEach(async () => {
    await app.close();
  });

  it('should create pending task first, then execute lazily on GET', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/diagnosis')
      .send({
        traceId: 'trace-001',
        targetId: 'button-submit',
        interactionId: 'interaction-001',
        symptoms: ['ui_loading'],
        evidence: [
          {
            id: 'ev-api-1',
            type: 'network_error',
            label: 'POST /orders 500',
            value: { status: 500, url: '/api/orders' },
            source: 'network-observer',
          },
          {
            id: 'ev-db-1',
            type: 'trace_span',
            label: 'db timeout on order query',
            value: { durationMs: 2200 },
            source: 'trace',
          },
          {
            id: 'ev-ui-1',
            type: 'ui_state',
            label: 'loading > 12s',
            value: { loadingMs: 12000 },
            source: 'frontend-sdk',
          },
        ],
        meta: {
          page: '/checkout',
        },
      })
      .expect(201);

    expect(createRes.body.status).toBe('pending');
    expect(createRes.body.id).toBeDefined();

    const getRes = await request(app.getHttpServer())
      .get(`/api/v1/diagnosis/${createRes.body.id}`)
      .expect(200);

    expect(getRes.body.status).toBe('completed');
    expect(getRes.body.result).toBeDefined();
    expect(getRes.body.result.conclusion.topCause.ruleCode).toBe('R201');
    expect(
      getRes.body.result.conclusion.supportingCauses.map((x: any) => x.ruleCode),
    ).toContain('R301');
    expect(
      getRes.body.result.conclusion.symptoms.map((x: any) => x.ruleCode),
    ).toContain('R501');
    expect(getRes.body.result.dominoChain.nodes.length).toBeGreaterThan(0);
    expect(typeof getRes.body.result.explanation).toBe('string');
  });

  it('should return cached completed result on second GET', async () => {
    const created = await repository.create({
      traceId: 'trace-cached',
      targetId: 'btn-cached',
      interactionId: 'interaction-cached',
      evidence: [
        {
          id: 'ev-api-1',
          type: 'network_error',
          label: 'POST /orders 500',
          value: { status: 500 },
          source: 'network-observer',
        },
      ],
      symptoms: [],
      meta: {},
    });

    const first = await request(app.getHttpServer())
      .get(`/api/v1/diagnosis/${created.id}`)
      .expect(200);

    const second = await request(app.getHttpServer())
      .get(`/api/v1/diagnosis/${created.id}`)
      .expect(200);

    expect(first.body.status).toBe('completed');
    expect(second.body.status).toBe('completed');
    expect(second.body.result.conclusion.topCause.ruleCode).toBe('R201');
  });

  it('should return 404 when diagnosis task does not exist', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/diagnosis/not-exists')
      .expect(404);
  });

  it('should validate POST body with global ValidationPipe', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/diagnosis')
      .send({
        targetId: 'button-submit',
      })
      .expect(400);
  });
});
```

---

# 六、Jest e2e 配置

---

## `test/jest-e2e.json`

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "..",
  "testEnvironment": "node",
  "testRegex": "test/e2e/.*\\.e2e-spec\\.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  }
}
```

---

# 七、package.json scripts 建议

如果你还没配，可以用：

```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest test/unit",
    "test:int": "jest test/integration",
    "test:e2e": "jest --config ./test/jest-e2e.json"
  }
}
```

---

# 八、两个你复制时最容易踩的坑

## 1. `supertest` 的 import 形式
有的项目用：

```ts
import * as request from 'supertest';
```

有的项目要：

```ts
import request from 'supertest';
```

如果 TS 配置不同，报错就切一下。

---

## 2. token 与 class provider 是否一致
我这套默认：

- repository：`DIAGNOSIS_TASK_REPOSITORY`
- create service：`DIAGNOSIS_CREATE_SERVICE`
- query service：`DIAGNOSIS_QUERY_SERVICE`

但在 `diagnosis.controller.e2e-spec.ts` 的轻量 skeleton 里，为了最小依赖，我用了字符串：

- `'DiagnosisCreateService'`
- `'DiagnosisQueryService'`

如果你想完全统一，也可以把这个 e2e skeleton 改成直接 import constants。

---

# 九、我建议你下一步继续做什么

按你当前阶段，最顺的是这两个方向之一：

## 方向 1：继续补 rule file tests
我可以下一条直接给你：

- `R101-R104`
- `R201-R203`
- `R301-R302`
- `R401-R402`
- `R501-R504`

对应的 **Jest unit test 模板全集**

这和你当前“规则拆文件 + 每条规则单测”的节奏最匹配。

---

## 方向 2：开始做 response assembler / controller DTO 稳定化
我可以下一条直接给你：

- `DiagnosisResponseAssembler`
- 更稳定的 `DiagnosisResponseDto`
- controller 返回结构收敛
- 配套单测

这会让你从“能跑”走到“对外 contract 稳定”。

---

如果你愿意，我下一条可以直接继续输出：

> **Rule 文件拆分后的 Jest unit test 模板全集（R101-R104 / R201-R203 / R301-R302 / R401-R402 / R501-R504）**