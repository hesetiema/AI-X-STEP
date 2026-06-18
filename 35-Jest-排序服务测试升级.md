下面直接给你 **`RankingService` 的升级版 Jest / 集成测试**。  
我会分成两部分给你：

1. **Jest 单测版**：精确验证评分与排序逻辑
2. **轻量集成测试版**：验证和真实 finding 数据组合时的行为

这样你后面既能做“规则级回归”，也能做“整体排序回归”。

---

# 1. 建议文件位置

```bash
src/modules/diagnosis/__tests__/
├── ranking.service.spec.ts
└── integration/
    └── ranking.integration.spec.ts
```

---

# 2. `RankingService` 单测版

这个版本重点验证：

- 根因规则优先于 symptom
- 上游 layer 优先
- cluster duplicate 降权
- evidenceRefs 越多分越高
- 不同 finding 的最终顺序符合预期

---

## `src/modules/diagnosis/__tests__/ranking.service.spec.ts`

```ts
import { RankingService } from '../domain/services/ranking.service';
import { DiagnosisContext } from '../domain/models/diagnosis-context.model';
import { RuleFinding } from '../domain/models/rule-finding.model';

describe('RankingService', () => {
  let service: RankingService;

  const buildContext = (
    overrides: Partial<DiagnosisContext> = {},
  ): DiagnosisContext =>
    ({
      diagnosisId: 'diag_rank_test',
      mode: 'inspect_diagnosis',
      fallbackTokens: ['--', '-', '暂无', 'N/A', ''],
      evidenceRefs: [],
      ...overrides,
    }) as DiagnosisContext;

  const buildFinding = (
    overrides: Partial<RuleFinding> = {},
  ): RuleFinding => ({
    ruleCode: 'R999',
    title: 'test finding',
    diagnosisLabel: 'test diagnosis',
    category: 'test',
    severity: 'medium',
    confidence: 0.8,
    layer: 'render',
    cluster: 'default_cluster',
    summary: 'test summary',
    evidenceRefs: [],
    suggestions: [],
    isSymptomOnly: false,
    ...overrides,
  });

  beforeEach(() => {
    service = new RankingService();
  });

  it('should rank root-cause finding above symptom finding when confidence is equal', () => {
    const rootCause = buildFinding({
      ruleCode: 'R201',
      confidence: 0.8,
      layer: 'render',
      isSymptomOnly: false,
      cluster: 'root_cluster',
    });

    const symptom = buildFinding({
      ruleCode: 'R501',
      confidence: 0.8,
      layer: 'ui',
      isSymptomOnly: true,
      cluster: 'symptom_cluster',
    });

    const result = service.rank([symptom, rootCause], buildContext());

    expect(result[0].ruleCode).toBe('R201');
    expect(result[1].ruleCode).toBe('R501');
    expect(result[0].rankScore.finalScore).toBeGreaterThan(
      result[1].rankScore.finalScore,
    );
  });

  it('should rank upstream api finding above downstream dom finding when confidence is equal', () => {
    const apiFinding = buildFinding({
      ruleCode: 'R101',
      confidence: 0.85,
      layer: 'api',
      cluster: 'api_cluster',
      isSymptomOnly: false,
    });

    const domFinding = buildFinding({
      ruleCode: 'R302',
      confidence: 0.85,
      layer: 'dom',
      cluster: 'dom_cluster',
      isSymptomOnly: false,
    });

    const result = service.rank([domFinding, apiFinding], buildContext());

    expect(result[0].ruleCode).toBe('R101');
    expect(result[1].ruleCode).toBe('R302');
  });

  it('should apply duplicate penalty to non-leader finding in the same cluster', () => {
    const clusterLeader = buildFinding({
      ruleCode: 'R201',
      confidence: 0.95,
      layer: 'render',
      cluster: 'formatter_cluster',
      isSymptomOnly: false,
    });

    const duplicate = buildFinding({
      ruleCode: 'R202',
      confidence: 0.83,
      layer: 'render',
      cluster: 'formatter_cluster',
      isSymptomOnly: false,
    });

    const result = service.rank([duplicate, clusterLeader], buildContext());

    const leader = result.find((item) => item.ruleCode === 'R201');
    const duplicateFinding = result.find((item) => item.ruleCode === 'R202');

    expect(leader).toBeDefined();
    expect(duplicateFinding).toBeDefined();
    expect(duplicateFinding!.rankScore.duplicatePenalty).toBeGreaterThan(0);
    expect(leader!.rankScore.duplicatePenalty).toBe(0);
    expect(leader!.rankScore.finalScore).toBeGreaterThan(
      duplicateFinding!.rankScore.finalScore,
    );
  });

  it('should give higher score to finding with richer evidence refs', () => {
    const lowEvidence = buildFinding({
      ruleCode: 'R103',
      confidence: 0.8,
      layer: 'state',
      cluster: 'state_cluster_a',
      evidenceRefs: ['ev1'],
    });

    const highEvidence = buildFinding({
      ruleCode: 'R104',
      confidence: 0.8,
      layer: 'state',
      cluster: 'state_cluster_b',
      evidenceRefs: ['ev1', 'ev2', 'ev3'],
    });

    const result = service.rank([lowEvidence, highEvidence], buildContext());

    const low = result.find((item) => item.ruleCode === 'R103');
    const high = result.find((item) => item.ruleCode === 'R104');

    expect(high).toBeDefined();
    expect(low).toBeDefined();
    expect(high!.rankScore.evidenceScore).toBeGreaterThan(
      low!.rankScore.evidenceScore,
    );
    expect(high!.rankScore.finalScore).toBeGreaterThan(
      low!.rankScore.finalScore,
    );
  });

  it('should keep both findings but lower score for symptom rule', () => {
    const rootCause = buildFinding({
      ruleCode: 'R302',
      confidence: 0.76,
      layer: 'dom',
      cluster: 'dom_cluster_a',
      isSymptomOnly: false,
    });

    const symptom = buildFinding({
      ruleCode: 'R502',
      confidence: 0.9,
      layer: 'dom',
      cluster: 'dom_cluster_b',
      isSymptomOnly: true,
    });

    const result = service.rank([symptom, rootCause], buildContext());

    expect(result).toHaveLength(2);
    expect(result[0].ruleCode).toBe('R302');
    expect(result[1].ruleCode).toBe('R502');
  });

  it('should produce rank reasons for root-cause, upstream, cluster and evidence conditions', () => {
    const finding = buildFinding({
      ruleCode: 'R101',
      confidence: 0.95,
      layer: 'api',
      cluster: 'api_cluster',
      evidenceRefs: ['ev1', 'ev2', 'ev3'],
      isSymptomOnly: false,
    });

    const [ranked] = service.rank([finding], buildContext());

    expect(ranked.rankReasons).toEqual(
      expect.arrayContaining([
        '根因规则优先',
        '上游 API 层优先级最高',
        '规则簇明确，可归入稳定问题类型',
        '证据链完整度高',
        '规则置信度高',
      ]),
    );
  });

  it('should produce symptom downgrade reason for symptom rule', () => {
    const finding = buildFinding({
      ruleCode: 'R501',
      confidence: 0.88,
      layer: 'ui',
      cluster: 'fallback_cluster',
      isSymptomOnly: true,
    });

    const [ranked] = service.rank([finding], buildContext());

    expect(ranked.rankReasons).toContain('症状规则已降权');
    expect(ranked.rankScore.symptomPenalty).toBeGreaterThan(0);
  });

  it('should sort findings by final score descending', () => {
    const findings = [
      buildFinding({
        ruleCode: 'R501',
        confidence: 0.8,
        layer: 'ui',
        cluster: 'symptom_a',
        isSymptomOnly: true,
      }),
      buildFinding({
        ruleCode: 'R101',
        confidence: 0.88,
        layer: 'api',
        cluster: 'api_a',
        isSymptomOnly: false,
        evidenceRefs: ['ev1', 'ev2'],
      }),
      buildFinding({
        ruleCode: 'R302',
        confidence: 0.84,
        layer: 'dom',
        cluster: 'dom_a',
        isSymptomOnly: false,
      }),
    ];

    const result = service.rank(findings, buildContext());

    expect(result.map((item) => item.ruleCode)).toEqual([
      'R101',
      'R302',
      'R501',
    ]);
  });

  it('should assign duplicate penalty reason to non-cluster-leader finding', () => {
    const leader = buildFinding({
      ruleCode: 'R201',
      confidence: 0.94,
      layer: 'render',
      cluster: 'render_cluster',
    });

    const duplicate = buildFinding({
      ruleCode: 'R202',
      confidence: 0.9,
      layer: 'render',
      cluster: 'render_cluster',
    });

    const result = service.rank([leader, duplicate], buildContext());
    const dup = result.find((item) => item.ruleCode === 'R202');

    expect(dup).toBeDefined();
    expect(dup!.rankReasons).toContain('同 cluster 规则已做去重降权');
  });
});
```

---

# 3. `RankingService` 集成测试版

这个版本不 mock `RankingService` 依赖，因为它本身基本没有外部依赖。  
这里所谓“集成测试”，更偏向：

- 用接近真实的 findings 数据组合
- 验证排序行为符合 diagnosis 预期
- 更接近“结论层输入前”的真实场景

---

## `src/modules/diagnosis/__tests__/integration/ranking.integration.spec.ts`

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { RankingService } from '../../domain/services/ranking.service';
import { DiagnosisContext } from '../../domain/models/diagnosis-context.model';
import { RuleFinding } from '../../domain/models/rule-finding.model';

describe('RankingService Integration', () => {
  let service: RankingService;

  const buildContext = (
    overrides: Partial<DiagnosisContext> = {},
  ): DiagnosisContext =>
    ({
      diagnosisId: 'diag_rank_integration',
      mode: 'inspect_diagnosis',
      fallbackTokens: ['--', '-', '暂无', 'N/A', ''],
      evidenceRefs: [],
      ...overrides,
    }) as DiagnosisContext;

  const buildFinding = (
    overrides: Partial<RuleFinding> = {},
  ): RuleFinding => ({
    ruleCode: 'R999',
    title: 'test finding',
    diagnosisLabel: 'test diagnosis',
    category: 'test',
    severity: 'medium',
    confidence: 0.8,
    layer: 'render',
    cluster: 'default_cluster',
    summary: 'test summary',
    evidenceRefs: [],
    suggestions: [],
    isSymptomOnly: false,
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RankingService],
    }).compile();

    service = module.get(RankingService);
  });

  it('should rank API root cause as top finding in a mixed inspect scenario', () => {
    const findings: RuleFinding[] = [
      buildFinding({
        ruleCode: 'R501',
        diagnosisLabel: '页面显示占位值',
        confidence: 0.8,
        layer: 'ui',
        cluster: 'fallback_displayed',
        isSymptomOnly: true,
      }),
      buildFinding({
        ruleCode: 'R202',
        diagnosisLabel: 'formatter 输出占位值',
        confidence: 0.88,
        layer: 'render',
        cluster: 'formatter_cluster',
        isSymptomOnly: false,
        evidenceRefs: ['ev_render'],
      }),
      buildFinding({
        ruleCode: 'R101',
        diagnosisLabel: '接口字段缺失',
        confidence: 0.95,
        layer: 'api',
        cluster: 'api_field_missing',
        isSymptomOnly: false,
        evidenceRefs: ['ev_api_1', 'ev_api_2', 'ev_api_3'],
      }),
    ];

    const result = service.rank(findings, buildContext());

    expect(result[0].ruleCode).toBe('R101');
    expect(result[0].diagnosisLabel).toBe('接口字段缺失');
  });

  it('should rank click handler/request problems above downstream ui symptoms in click scenario', () => {
    const findings: RuleFinding[] = [
      buildFinding({
        ruleCode: 'R503',
        diagnosisLabel: '请求前链路中断',
        confidence: 0.78,
        layer: 'request_to_ui',
        cluster: 'pre_request_gap',
        isSymptomOnly: true,
      }),
      buildFinding({
        ruleCode: 'R402',
        diagnosisLabel: 'handler 执行但 request 未发送',
        confidence: 0.89,
        layer: 'request',
        cluster: 'handler_started_request_not_sent',
        isSymptomOnly: false,
      }),
      buildFinding({
        ruleCode: 'R501',
        diagnosisLabel: '页面显示占位值',
        confidence: 0.8,
        layer: 'ui',
        cluster: 'fallback_displayed',
        isSymptomOnly: true,
      }),
    ];

    const result = service.rank(
      findings,
      buildContext({
        mode: 'click_diagnosis',
      }),
    );

    expect(result[0].ruleCode).toBe('R402');
    expect(result[result.length - 1].isSymptomOnly).toBe(true);
  });

  it('should keep highest-scored rule as cluster leader and suppress sibling rule score', () => {
    const findings: RuleFinding[] = [
      buildFinding({
        ruleCode: 'R201',
        diagnosisLabel: '合法值被判空吞掉',
        confidence: 0.96,
        layer: 'render',
        cluster: 'formatter_shared_cluster',
        isSymptomOnly: false,
        evidenceRefs: ['ev1', 'ev2'],
      }),
      buildFinding({
        ruleCode: 'R202',
        diagnosisLabel: 'formatter 输出占位值',
        confidence: 0.88,
        layer: 'render',
        cluster: 'formatter_shared_cluster',
        isSymptomOnly: false,
        evidenceRefs: ['ev1'],
      }),
      buildFinding({
        ruleCode: 'R501',
        diagnosisLabel: '页面显示占位值',
        confidence: 0.8,
        layer: 'ui',
        cluster: 'fallback_displayed',
        isSymptomOnly: true,
      }),
    ];

    const result = service.rank(findings, buildContext());

    const r201 = result.find((item) => item.ruleCode === 'R201');
    const r202 = result.find((item) => item.ruleCode === 'R202');

    expect(r201).toBeDefined();
    expect(r202).toBeDefined();
    expect(r201!.rankScore.duplicatePenalty).toBe(0);
    expect(r202!.rankScore.duplicatePenalty).toBeGreaterThan(0);
    expect(r201!.rankScore.finalScore).toBeGreaterThan(
      r202!.rankScore.finalScore,
    );
  });

  it('should rank same-layer findings by evidence richness when other factors are close', () => {
    const findings: RuleFinding[] = [
      buildFinding({
        ruleCode: 'R103',
        confidence: 0.86,
        layer: 'state',
        cluster: 'state_a',
        evidenceRefs: ['ev1'],
        isSymptomOnly: false,
      }),
      buildFinding({
        ruleCode: 'R104',
        confidence: 0.86,
        layer: 'state',
        cluster: 'state_b',
        evidenceRefs: ['ev1', 'ev2', 'ev3', 'ev4'],
        isSymptomOnly: false,
      }),
    ];

    const result = service.rank(findings, buildContext());

    expect(result[0].ruleCode).toBe('R104');
    expect(result[0].rankScore.evidenceScore).toBeGreaterThan(
      result[1].rankScore.evidenceScore,
    );
  });

  it('should rank symptom findings behind root-cause findings in mixed final ordering', () => {
    const findings: RuleFinding[] = [
      buildFinding({
        ruleCode: 'R302',
        confidence: 0.84,
        layer: 'dom',
        cluster: 'dom_not_updated',
        isSymptomOnly: false,
      }),
      buildFinding({
        ruleCode: 'R502',
        confidence: 0.79,
        layer: 'dom',
        cluster: 'render_dom_gap',
        isSymptomOnly: true,
      }),
      buildFinding({
        ruleCode: 'R501',
        confidence: 0.8,
        layer: 'ui',
        cluster: 'fallback_displayed',
        isSymptomOnly: true,
      }),
    ];

    const result = service.rank(findings, buildContext());

    expect(result[0].ruleCode).toBe('R302');
    expect(result[1].isSymptomOnly).toBe(true);
    expect(result[2].isSymptomOnly).toBe(true);
  });
});
```

---

# 4. 这两份测试各自的价值

---

## 4.1 `ranking.service.spec.ts`
更偏**算法级单测**，适合保护：

- 评分项是否生效
- reason 文案是否保留
- duplicatePenalty / evidenceScore 等字段是否正确

这类测试在你后面改权重时最有用。

---

## 4.2 `ranking.integration.spec.ts`
更偏**业务排序回归测试**，适合保护：

- API 根因应该压过 UI symptom
- click 链问题应该压过末端现象
- 同 cluster 只保 leader，高分 sibling 降权
- 同层时证据越多越优先

这类测试更接近 diagnosis 的真实产出质量。

---

# 5. 我顺手帮你指出一个很关键的现象

你当前 `RankingService` 的打分大致是：

```ts
finalScore =
  confidence
  + rootCauseBonus
  + upstreamBonus
  + evidenceScore
  + clusterBonus
  - symptomPenalty
  - duplicatePenalty
```

这意味着一种情况：

- 某 symptom 置信度很高
- 某 root cause 置信度较低

如果权重差不足，理论上 symptom 仍然可能反超 root cause。  
而你当前前面的测试里有一条：

```ts
root cause 0.76
symptom 0.9
expect root cause first
```

这能不能稳定通过，要看你现在 `RANKING_WEIGHTS` 的具体值。  
按你之前那版：

```ts
rootCauseBonus: 0.2
symptomPenalty: 0.25
```

确实大概率 root cause 还能赢，但非常接近边界。

所以我建议你把这类 case 当成**策略性测试**来保留，因为它能防止未来有人随手改权重后，让 symptom 爬到前面。

---

# 6. 推荐再补一个“边界测试”

如果你愿意，可以再补一个边界 case，明确规定：

> symptom 即使 confidence 更高，也不应该轻易压过明确 root-cause

例如：

```ts
it('should still prefer root-cause over symptom under close scores', () => {
  ...
});
```

这类测试本质上是在给你的排序策略立规矩。

---

# 7. 下一步最推荐继续补什么

现在你已经有：

- rule unit tests
- rule engine unit test
- rule engine integration test
- ranking unit / integration test

下一个最自然的就是：

### A. `DiagnosisConclusionService` 的升级版 Jest / 集成测试
验证：
- `topFinding`
- `supportingFindings`
- `symptomFindings`
- `diagnosisState`
- `repairHints`
- `scoreBreakdown`

### B. `ExplanationBuilder` 的升级版测试
验证：
- summaryText
- evidenceNarrative
- operatorAdvice

### C. `DominoChainBuilder` 的升级版测试
验证：
- click / inspect 链节点生成
- root/supporting/symptom 标注
- node status

---

如果按你现在的推进链路，我建议下一条直接做：  
**DiagnosisConclusionService 的升级版 Jest / 集成测试**。