下面直接给你 **`DiagnosisConclusionService` 的升级版 Jest / 集成测试**。  
我按你当前实现来覆盖这些核心点：

- `topFinding`
- `supportingFindings`
- `symptomFindings`
- `diagnosisState`
- `summary`
- `repairHints`
- `scoreBreakdown`

同样分成两部分：

1. **单测版**：聚焦 `DiagnosisConclusionService` 自身编排逻辑
2. **集成测试版**：带上真实 `RankingService`

---

# 1. 建议文件位置

```bash
src/modules/diagnosis/__tests__/
├── diagnosis-conclusion.service.spec.ts
└── integration/
    └── diagnosis-conclusion.integration.spec.ts
```

---

# 2. 单测版

这里我们 **mock `RankingService`**，只测 `DiagnosisConclusionService` 自身逻辑。

---

## `src/modules/diagnosis/__tests__/diagnosis-conclusion.service.spec.ts`

```ts
import { DiagnosisConclusionService } from '../domain/services/diagnosis-conclusion.service';
import { RankingService } from '../domain/services/ranking.service';
import { DiagnosisContext } from '../domain/models/diagnosis-context.model';
import { RuleFinding } from '../domain/models/rule-finding.model';
import { RankedFinding } from '../domain/models/ranked-finding.model';
import { DiagnosisState } from '../domain/enums/diagnosis-state.enum';

describe('DiagnosisConclusionService', () => {
  let service: DiagnosisConclusionService;
  let rankingService: jest.Mocked<Pick<RankingService, 'rank'>>;

  const buildContext = (
    overrides: Partial<DiagnosisContext> = {},
  ): DiagnosisContext =>
    ({
      diagnosisId: 'diag_conclusion_test',
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

  const buildRankedFinding = (
    overrides: Partial<RankedFinding> = {},
  ): RankedFinding => ({
    ...buildFinding(overrides),
    rankScore: {
      baseConfidence: 0.8,
      rootCauseBonus: 0.2,
      symptomPenalty: 0,
      upstreamBonus: 0.05,
      duplicatePenalty: 0,
      evidenceScore: 0.06,
      clusterBonus: 0.03,
      finalScore: 1.14,
    },
    rankReasons: ['根因规则优先'],
    ...overrides,
  });

  beforeEach(() => {
    rankingService = {
      rank: jest.fn(),
    };

    service = new DiagnosisConclusionService(
      rankingService as unknown as RankingService,
    );
  });

  it('should call ranking service with findings and context', () => {
    const findings: RuleFinding[] = [buildFinding({ ruleCode: 'R101' })];
    const context = buildContext();

    rankingService.rank.mockReturnValue([]);

    service.conclude(findings, context);

    expect(rankingService.rank).toHaveBeenCalledTimes(1);
    expect(rankingService.rank).toHaveBeenCalledWith(findings, context);
  });

  it('should select first ranked root-cause finding as topFinding', () => {
    const ranked = [
      buildRankedFinding({
        ruleCode: 'R101',
        diagnosisLabel: '接口字段缺失',
        cluster: 'api_field_missing',
        confidence: 0.95,
      }),
      buildRankedFinding({
        ruleCode: 'R202',
        diagnosisLabel: 'formatter 输出占位值',
        cluster: 'formatter_cluster',
        confidence: 0.88,
      }),
    ];

    rankingService.rank.mockReturnValue(ranked);

    const result = service.conclude([], buildContext());

    expect(result.topFinding?.ruleCode).toBe('R101');
    expect(result.topFinding?.diagnosisLabel).toBe('接口字段缺失');
  });

  it('should collect supportingFindings excluding topFinding itself and same-cluster root causes', () => {
    const ranked = [
      buildRankedFinding({
        ruleCode: 'R201',
        cluster: 'formatter_cluster',
        diagnosisLabel: '合法值被判空吞掉',
      }),
      buildRankedFinding({
        ruleCode: 'R202',
        cluster: 'formatter_cluster',
        diagnosisLabel: 'formatter 输出占位值',
      }),
      buildRankedFinding({
        ruleCode: 'R103',
        cluster: 'state_cluster',
        diagnosisLabel: '请求成功但状态未更新',
      }),
      buildRankedFinding({
        ruleCode: 'R301',
        cluster: 'dom_cluster',
        diagnosisLabel: 'DOM 被隐藏',
      }),
    ];

    rankingService.rank.mockReturnValue(ranked);

    const result = service.conclude([], buildContext());

    expect(result.topFinding?.ruleCode).toBe('R201');
    expect(result.supportingFindings.map((item) => item.ruleCode)).toEqual([
      'R103',
      'R301',
    ]);
    expect(result.supportingFindings.map((item) => item.ruleCode)).not.toContain(
      'R202',
    );
  });

  it('should collect symptomFindings separately', () => {
    const ranked = [
      buildRankedFinding({
        ruleCode: 'R201',
        isSymptomOnly: false,
        cluster: 'root_cluster',
      }),
      buildRankedFinding({
        ruleCode: 'R501',
        isSymptomOnly: true,
        cluster: 'symptom_cluster_a',
      }),
      buildRankedFinding({
        ruleCode: 'R502',
        isSymptomOnly: true,
        cluster: 'symptom_cluster_b',
      }),
    ];

    rankingService.rank.mockReturnValue(ranked);

    const result = service.conclude([], buildContext());

    expect(result.symptomFindings.map((item) => item.ruleCode)).toEqual([
      'R501',
      'R502',
    ]);
  });

  it('should set diagnosisState to confirmed_root_cause when top finding confidence >= 0.9', () => {
    rankingService.rank.mockReturnValue([
      buildRankedFinding({
        ruleCode: 'R101',
        confidence: 0.95,
      }),
    ]);

    const result = service.conclude([], buildContext());

    expect(result.diagnosisState).toBe(DiagnosisState.CONFIRMED_ROOT_CAUSE);
  });

  it('should set diagnosisState to probable_root_cause when top finding confidence < 0.9', () => {
    rankingService.rank.mockReturnValue([
      buildRankedFinding({
        ruleCode: 'R302',
        confidence: 0.84,
      }),
    ]);

    const result = service.conclude([], buildContext());

    expect(result.diagnosisState).toBe(DiagnosisState.PROBABLE_ROOT_CAUSE);
  });

  it('should set diagnosisState to insufficient_evidence when no ranked finding exists and upstream evidence is weak', () => {
    rankingService.rank.mockReturnValue([]);

    const result = service.conclude(
      [],
      buildContext({
        responseSuccess: false,
        storeUpdated: false,
        renderTriggered: false,
      }),
    );

    expect(result.diagnosisState).toBe(DiagnosisState.INSUFFICIENT_EVIDENCE);
    expect(result.summary).toBe('当前证据不足，无法确认明确根因。');
  });

  it('should set diagnosisState to no_rule_matched when no ranked finding exists but evidence is not weak', () => {
    rankingService.rank.mockReturnValue([]);

    const result = service.conclude(
      [],
      buildContext({
        responseSuccess: true,
        storeUpdated: false,
        renderTriggered: false,
      }),
    );

    expect(result.diagnosisState).toBe(DiagnosisState.NO_RULE_MATCHED);
    expect(result.summary).toBe('现有规则未识别出明确异常。');
  });

  it('should build summary from topFinding diagnosis label', () => {
    rankingService.rank.mockReturnValue([
      buildRankedFinding({
        ruleCode: 'R103',
        diagnosisLabel: '请求成功但状态未更新',
        confidence: 0.91,
      }),
    ]);

    const result = service.conclude([], buildContext());

    expect(result.summary).toBe('已定位到根因：请求成功但状态未更新。');
  });

  it('should merge repair hints from topFinding and supportingFindings with deduplication', () => {
    const ranked = [
      buildRankedFinding({
        ruleCode: 'R201',
        cluster: 'root_cluster',
        suggestions: ['检查 formatter 判空逻辑', '保留 0 值'],
      }),
      buildRankedFinding({
        ruleCode: 'R103',
        cluster: 'state_cluster',
        suggestions: ['检查 dispatch/commit 是否执行', '保留 0 值'],
      }),
    ];

    rankingService.rank.mockReturnValue(ranked);

    const result = service.conclude([], buildContext());

    expect(result.repairHints).toEqual([
      '检查 formatter 判空逻辑',
      '保留 0 值',
      '检查 dispatch/commit 是否执行',
    ]);
  });

  it('should fallback repair hints when no suggestions are available', () => {
    rankingService.rank.mockReturnValue([]);

    const result = service.conclude(
      [],
      buildContext({
        responseSuccess: false,
        storeUpdated: false,
        renderTriggered: false,
      }),
    );

    expect(result.repairHints).toEqual([
      '补充接口响应快照',
      '补充状态更新轨迹',
      '补充渲染证据',
    ]);
  });

  it('should generate scoreBreakdown from ranked findings', () => {
    rankingService.rank.mockReturnValue([
      buildRankedFinding({
        ruleCode: 'R101',
        rankScore: {
          baseConfidence: 0.95,
          rootCauseBonus: 0.2,
          symptomPenalty: 0,
          upstreamBonus: 0.085,
          duplicatePenalty: 0,
          evidenceScore: 0.09,
          clusterBonus: 0.03,
          finalScore: 1.355,
        },
        rankReasons: ['根因规则优先', '上游 API 层优先级最高'],
      }),
      buildRankedFinding({
        ruleCode: 'R501',
        isSymptomOnly: true,
        rankScore: {
          baseConfidence: 0.8,
          rootCauseBonus: 0,
          symptomPenalty: 0.25,
          upstreamBonus: 0.03,
          duplicatePenalty: 0,
          evidenceScore: 0.03,
          clusterBonus: 0.03,
          finalScore: 0.61,
        },
        rankReasons: ['症状规则已降权'],
      }),
    ]);

    const result = service.conclude([], buildContext());

    expect(result.scoreBreakdown).toEqual([
      {
        ruleCode: 'R101',
        finalScore: 1.355,
        reason: ['根因规则优先', '上游 API 层优先级最高'],
      },
      {
        ruleCode: 'R501',
        finalScore: 0.61,
        reason: ['症状规则已降权'],
      },
    ]);
  });

  it('should limit supportingFindings count to configured max', () => {
    const ranked = [
      buildRankedFinding({ ruleCode: 'R101', cluster: 'c1' }),
      buildRankedFinding({ ruleCode: 'R102', cluster: 'c2' }),
      buildRankedFinding({ ruleCode: 'R103', cluster: 'c3' }),
      buildRankedFinding({ ruleCode: 'R104', cluster: 'c4' }),
      buildRankedFinding({ ruleCode: 'R201', cluster: 'c5' }),
    ];

    rankingService.rank.mockReturnValue(ranked);

    const result = service.conclude([], buildContext());

    expect(result.supportingFindings.length).toBeLessThanOrEqual(3);
  });
});
```

---

# 3. 集成测试版

这里用 **真实 `RankingService` + 真实 `DiagnosisConclusionService`**。  
目的是验证“排序 + 结论”一起工作时，输出结构是否符合预期。

---

## `src/modules/diagnosis/__tests__/integration/diagnosis-conclusion.integration.spec.ts`

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { DiagnosisConclusionService } from '../../domain/services/diagnosis-conclusion.service';
import { RankingService } from '../../domain/services/ranking.service';
import { DiagnosisContext } from '../../domain/models/diagnosis-context.model';
import { RuleFinding } from '../../domain/models/rule-finding.model';
import { DiagnosisState } from '../../domain/enums/diagnosis-state.enum';

describe('DiagnosisConclusionService Integration', () => {
  let service: DiagnosisConclusionService;

  const buildContext = (
    overrides: Partial<DiagnosisContext> = {},
  ): DiagnosisContext =>
    ({
      diagnosisId: 'diag_conclusion_integration',
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
      providers: [RankingService, DiagnosisConclusionService],
    }).compile();

    service = module.get(DiagnosisConclusionService);
  });

  it('should pick upstream root-cause as topFinding and keep symptoms separately in mixed inspect scenario', () => {
    const findings: RuleFinding[] = [
      buildFinding({
        ruleCode: 'R501',
        diagnosisLabel: '页面显示占位值',
        confidence: 0.8,
        layer: 'ui',
        cluster: 'fallback_displayed',
        isSymptomOnly: true,
        suggestions: ['继续检查上游链路'],
      }),
      buildFinding({
        ruleCode: 'R202',
        diagnosisLabel: 'formatter 输出占位值',
        confidence: 0.88,
        layer: 'render',
        cluster: 'formatter_cluster',
        isSymptomOnly: false,
        suggestions: ['检查 formatter fallback 逻辑'],
      }),
      buildFinding({
        ruleCode: 'R101',
        diagnosisLabel: '接口字段缺失',
        confidence: 0.95,
        layer: 'api',
        cluster: 'api_field_missing',
        isSymptomOnly: false,
        evidenceRefs: ['ev1', 'ev2', 'ev3'],
        suggestions: ['检查接口返回字段路径'],
      }),
    ];

    const result = service.conclude(findings, buildContext());

    expect(result.topFinding?.ruleCode).toBe('R101');
    expect(result.supportingFindings.map((item) => item.ruleCode)).toContain(
      'R202',
    );
    expect(result.symptomFindings.map((item) => item.ruleCode)).toContain(
      'R501',
    );
    expect(result.diagnosisState).toBe(DiagnosisState.CONFIRMED_ROOT_CAUSE);
  });

  it('should suppress same-cluster sibling from supportingFindings', () => {
    const findings: RuleFinding[] = [
      buildFinding({
        ruleCode: 'R201',
        diagnosisLabel: '合法值被判空吞掉',
        confidence: 0.96,
        layer: 'render',
        cluster: 'formatter_shared_cluster',
        isSymptomOnly: false,
        suggestions: ['将 if (!value) 改为 value == null'],
      }),
      buildFinding({
        ruleCode: 'R202',
        diagnosisLabel: 'formatter 输出占位值',
        confidence: 0.88,
        layer: 'render',
        cluster: 'formatter_shared_cluster',
        isSymptomOnly: false,
        suggestions: ['检查 formatter fallback 逻辑'],
      }),
      buildFinding({
        ruleCode: 'R501',
        diagnosisLabel: '页面显示占位值',
        confidence: 0.8,
        layer: 'ui',
        cluster: 'fallback_displayed',
        isSymptomOnly: true,
      }),
      buildFinding({
        ruleCode: 'R103',
        diagnosisLabel: '请求成功但状态未更新',
        confidence: 0.91,
        layer: 'state',
        cluster: 'state_cluster',
        isSymptomOnly: false,
        suggestions: ['检查 dispatch/commit 是否执行'],
      }),
    ];

    const result = service.conclude(findings, buildContext());

    expect(result.topFinding?.ruleCode).toBe('R201');
    expect(result.supportingFindings.map((item) => item.ruleCode)).toContain(
      'R103',
    );
    expect(result.supportingFindings.map((item) => item.ruleCode)).not.toContain(
      'R202',
    );
  });

  it('should produce probable_root_cause when top finding confidence is below 0.9', () => {
    const findings: RuleFinding[] = [
      buildFinding({
        ruleCode: 'R302',
        diagnosisLabel: 'DOM 未反映最新渲染结果',
        confidence: 0.84,
        layer: 'dom',
        cluster: 'dom_not_updated',
        isSymptomOnly: false,
        suggestions: ['检查 commit / DOM 更新链路'],
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

    const result = service.conclude(findings, buildContext());

    expect(result.topFinding?.ruleCode).toBe('R302');
    expect(result.diagnosisState).toBe(DiagnosisState.PROBABLE_ROOT_CAUSE);
  });

  it('should produce insufficient_evidence when no finding exists and upstream evidence is absent', () => {
    const result = service.conclude(
      [],
      buildContext({
        responseSuccess: false,
        storeUpdated: false,
        renderTriggered: false,
      }),
    );

    expect(result.topFinding).toBeNull();
    expect(result.supportingFindings).toEqual([]);
    expect(result.symptomFindings).toEqual([]);
    expect(result.diagnosisState).toBe(DiagnosisState.INSUFFICIENT_EVIDENCE);
    expect(result.repairHints).toEqual([
      '补充接口响应快照',
      '补充状态更新轨迹',
      '补充渲染证据',
    ]);
  });

  it('should produce no_rule_matched when no finding exists but evidence is partially present', () => {
    const result = service.conclude(
      [],
      buildContext({
        responseSuccess: true,
        storeUpdated: false,
        renderTriggered: false,
      }),
    );

    expect(result.topFinding).toBeNull();
    expect(result.diagnosisState).toBe(DiagnosisState.NO_RULE_MATCHED);
    expect(result.summary).toBe('现有规则未识别出明确异常。');
  });

  it('should merge repair hints from top finding and supporting findings with dedupe', () => {
    const findings: RuleFinding[] = [
      buildFinding({
        ruleCode: 'R101',
        diagnosisLabel: '接口字段缺失',
        confidence: 0.95,
        layer: 'api',
        cluster: 'api_field_missing',
        isSymptomOnly: false,
        suggestions: ['检查接口返回字段路径', '检查字段映射路径配置'],
        evidenceRefs: ['ev1', 'ev2', 'ev3'],
      }),
      buildFinding({
        ruleCode: 'R103',
        diagnosisLabel: '请求成功但状态未更新',
        confidence: 0.91,
        layer: 'state',
        cluster: 'state_cluster',
        isSymptomOnly: false,
        suggestions: ['检查 dispatch/commit 是否执行', '检查字段映射路径配置'],
      }),
    ];

    const result = service.conclude(findings, buildContext());

    expect(result.repairHints).toEqual([
      '检查接口返回字段路径',
      '检查字段映射路径配置',
      '检查 dispatch/commit 是否执行',
    ]);
  });

  it('should generate scoreBreakdown aligned with ranked order', () => {
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
        ruleCode: 'R101',
        diagnosisLabel: '接口字段缺失',
        confidence: 0.95,
        layer: 'api',
        cluster: 'api_field_missing',
        isSymptomOnly: false,
        evidenceRefs: ['ev1', 'ev2', 'ev3'],
      }),
      buildFinding({
        ruleCode: 'R302',
        diagnosisLabel: 'DOM 未反映最新渲染结果',
        confidence: 0.84,
        layer: 'dom',
        cluster: 'dom_not_updated',
        isSymptomOnly: false,
      }),
    ];

    const result = service.conclude(findings, buildContext());

    expect(result.scoreBreakdown[0].ruleCode).toBe(result.topFinding?.ruleCode);
    expect(result.scoreBreakdown.map((item) => item.ruleCode)).toEqual([
      'R101',
      'R302',
      'R501',
    ]);
  });
});
```

---

# 4. 这两份测试覆盖的关键价值

---

## 4.1 单测版保护“结论编排逻辑”
主要防止以后有人改坏这些规则：

- supporting 要排除 topFinding 自己
- supporting 要排除同 cluster root cause sibling
- symptom 要单独分组
- 无结果时 state 如何判定
- fallback repair hints 怎么兜底

---

## 4.2 集成版保护“排序 + 结论协作行为”
这个很重要，因为很多真实问题不是 service 自己的问题，而是：

- ranking 排序变了
- topFinding 变了
- supporting / symptom 分组跟着漂了
- repairHints 顺序和内容变化了

这组测试能帮助你锁住整体行为。

---

# 5. 一个你现在应该特别注意的点

你当前 `DiagnosisConclusionService` 的 `resolveDiagnosisState` 逻辑大致是：

```ts
if (topFinding) {
  return topFinding.confidence >= 0.9
    ? CONFIRMED_ROOT_CAUSE
    : PROBABLE_ROOT_CAUSE;
}
```

这里用的是 **`topFinding.confidence`**，不是 `rankScore.finalScore`。  
这意味着：

- 排序靠 `finalScore`
- 状态确认靠 `confidence`

这是合理的，但一定要明确，因为后面很容易有人误以为：

> top 排第一就一定是 confirmed

实际上不是。  
你现在这套测试已经把这个行为锁住了。

---

# 6. 我建议你后面可以再补两个边界测试

如果你想再严一点，建议加：

---

## 6.1 supportingFindings 上限边界测试
虽然我在单测里已经加了长度断言，但你可以进一步精确断言：

- 超过上限时，保留的是排序最靠前的 3 个

---

## 6.2 repairHints 上限边界测试
如果 `MAX_REPAIR_HINTS = 5`，可以补一个测试验证：

- 合并很多 suggestions 后，只保留前 5 个
- 保持原有顺序 + 去重

这个对前端展示很有价值。

---

# 7. 下一步最推荐继续补什么

现在你已经把诊断主链上的核心测试基本补全了：

- rule unit tests
- rule engine unit / integration
- ranking unit / integration
- conclusion unit / integration

下一个最自然的就是展示层：

### A. `ExplanationBuilder` 的升级版 Jest / 集成测试
验证：
- `summaryText`
- `evidenceNarrative`
- `operatorAdvice`

### B. `DominoChainBuilder` 的升级版 Jest / 集成测试
验证：
- inspect/click 链节点
- root/supporting/symptom 标记
- node status
- relatedRuleCodes / evidenceRefs 去重

### C. `DiagnosisQueryService` 的链路集成测试
验证：
- lazy execution
- repository cache
- collect -> build context -> run rules -> conclude -> build explanation -> build domino -> save result

---

如果按你当前推进顺序，我建议下一条直接做：  
**DominoChainBuilder 的升级版 Jest / 集成测试**。