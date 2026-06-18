下面直接给你一版 **`RankingService` Jest 单测样例**。  
目标是两点：

1. **能直接落到 NestJS / Jest 工程里**
2. **覆盖你现在最关键的排序语义**
   - 根因优先
   - 症状降权
   - cluster 去重降权
   - 上游优先

我会给你：

- 推荐文件位置
- 完整测试代码
- 测试覆盖点说明
- 运行方式

---

# 1. 推荐文件位置

```ts
src/modules/diagnosis/domain/ranking.service.spec.ts
```

如果你项目是 `test/` 目录集中式管理，也可以放：

```ts
test/modules/diagnosis/ranking.service.spec.ts
```

---

# 2. 完整 Jest 单测样例

```ts
import { RankingService } from './ranking.service';
import { DiagnosisContext } from '../models/diagnosis-context.model';
import { RuleFinding } from '../models/rule-finding.model';

describe('RankingService', () => {
  let service: RankingService;

  beforeEach(() => {
    service = new RankingService();
  });

  const createBaseContext = (
    overrides: Partial<DiagnosisContext> = {},
  ): DiagnosisContext => {
    return {
      diagnosisId: 'diag_test_001',
      mode: 'inspect_diagnosis',

      pageUrl: '/orders/detail?id=A1001',
      targetDomSelector: '.order-amount',
      targetComponent: 'OrderAmount',
      displayedValue: '--',

      apiFieldPath: 'response.data.amount',
      apiFieldExists: true,
      apiValue: 0,
      responseSuccess: true,

      storeKey: 'order.current.amount',
      storeUpdated: true,
      storeValue: 0,

      selectorName: 'selectOrderAmount',
      selectorRan: true,
      selectorValue: 0,

      renderTriggered: true,
      renderInputValue: 0,
      renderOutputValue: '--',
      formatterName: 'formatCurrency',
      formatterOutputIsFallback: true,

      domUpdated: true,
      domVisible: true,
      domValue: '--',

      clickDetected: undefined,
      handlerStarted: undefined,
      requestSent: true,
      responseReceived: true,
      stateChanged: true,
      renderCommitted: true,

      fallbackTokens: ['--', '-', '暂无', 'N/A', ''],
      evidenceRefs: [
        'ev_api_amount_0',
        'ev_store_value',
        'ev_formatter_output_fallback',
        'ev_dom_snapshot',
      ],

      ...overrides,
    };
  };

  const createFinding = (
    overrides: Partial<RuleFinding> = {},
  ): RuleFinding => {
    return {
      ruleCode: 'R999',
      title: 'default rule',
      diagnosisLabel: 'default diagnosis',
      category: 'render_transform',
      severity: 'medium',
      confidence: 0.8,
      layer: 'render',
      cluster: 'default_cluster',
      summary: 'default summary',
      evidenceRefs: ['ev_default'],
      suggestions: ['default suggestion'],
      isSymptomOnly: false,
      ...overrides,
    };
  };

  describe('根因优先', () => {
    it('should rank root-cause finding higher than symptom finding even when symptom confidence is close', () => {
      const context = createBaseContext();

      const rootCause = createFinding({
        ruleCode: 'R201',
        diagnosisLabel: '合法值被判空吞掉',
        category: 'render_transform',
        layer: 'render',
        cluster: 'formatter_falsy_swallowed',
        confidence: 0.9,
        isSymptomOnly: false,
        evidenceRefs: ['ev_api_amount_0', 'ev_formatter_output_fallback'],
      });

      const symptom = createFinding({
        ruleCode: 'R501',
        diagnosisLabel: '页面显示占位值',
        category: 'dom',
        layer: 'ui',
        cluster: 'fallback_displayed',
        confidence: 0.92,
        isSymptomOnly: true,
        evidenceRefs: ['ev_dom_snapshot'],
      });

      const ranked = service.rank([symptom, rootCause], context);

      expect(ranked[0].ruleCode).toBe('R201');
      expect(ranked[1].ruleCode).toBe('R501');
      expect(ranked[0].rankScore.finalScore).toBeGreaterThan(
        ranked[1].rankScore.finalScore,
      );
    });
  });

  describe('上游优先', () => {
    it('should rank upstream api/state rule higher than downstream dom rule when confidence is similar', () => {
      const context = createBaseContext();

      const upstream = createFinding({
        ruleCode: 'R103',
        diagnosisLabel: '请求成功但状态未更新',
        category: 'state_binding',
        layer: 'state',
        cluster: 'request_success_state_not_updated',
        confidence: 0.86,
        isSymptomOnly: false,
        evidenceRefs: ['ev_api_amount_0', 'ev_store_update_missing'],
      });

      const downstream = createFinding({
        ruleCode: 'R302',
        diagnosisLabel: 'DOM 未反映最新渲染结果',
        category: 'dom',
        layer: 'dom',
        cluster: 'dom_not_updated',
        confidence: 0.87,
        isSymptomOnly: false,
        evidenceRefs: ['ev_render_trace', 'ev_dom_snapshot'],
      });

      const ranked = service.rank([downstream, upstream], context);

      expect(ranked[0].ruleCode).toBe('R103');
      expect(ranked[1].ruleCode).toBe('R302');
    });
  });

  describe('cluster 去重降权', () => {
    it('should keep the strongest finding in the same cluster and penalize the others', () => {
      const context = createBaseContext();

      const specificRootCause = createFinding({
        ruleCode: 'R201',
        diagnosisLabel: '合法值被判空吞掉',
        category: 'render_transform',
        layer: 'render',
        cluster: 'formatter_fallback_cluster',
        confidence: 0.94,
        isSymptomOnly: false,
        evidenceRefs: [
          'ev_api_amount_0',
          'ev_store_value',
          'ev_formatter_output_fallback',
        ],
      });

      const genericTransform = createFinding({
        ruleCode: 'R202',
        diagnosisLabel: 'formatter 输出占位值',
        category: 'render_transform',
        layer: 'render',
        cluster: 'formatter_fallback_cluster',
        confidence: 0.9,
        isSymptomOnly: false,
        evidenceRefs: ['ev_formatter_output_fallback'],
      });

      const symptom = createFinding({
        ruleCode: 'R501',
        diagnosisLabel: '页面显示占位值',
        category: 'dom',
        layer: 'ui',
        cluster: 'formatter_fallback_cluster',
        confidence: 0.88,
        isSymptomOnly: true,
        evidenceRefs: ['ev_dom_snapshot'],
      });

      const ranked = service.rank(
        [genericTransform, symptom, specificRootCause],
        context,
      );

      const r201 = ranked.find((item) => item.ruleCode === 'R201');
      const r202 = ranked.find((item) => item.ruleCode === 'R202');
      const r501 = ranked.find((item) => item.ruleCode === 'R501');

      expect(r201).toBeDefined();
      expect(r202).toBeDefined();
      expect(r501).toBeDefined();

      expect(r201!.rankScore.duplicatePenalty).toBe(0);
      expect(r202!.rankScore.duplicatePenalty).toBeGreaterThan(0);
      expect(r501!.rankScore.duplicatePenalty).toBeGreaterThan(0);

      expect(r201!.rankScore.finalScore).toBeGreaterThan(
        r202!.rankScore.finalScore,
      );
      expect(r202!.rankScore.finalScore).toBeGreaterThan(
        r501!.rankScore.finalScore,
      );

      expect(r202!.rankReasons).toContainEqual(
        expect.stringContaining('同 cluster 规则'),
      );
      expect(r501!.rankReasons).toContain('症状规则已降权');
    });
  });

  describe('症状降权', () => {
    it('should apply symptom penalty to symptom-only findings', () => {
      const context = createBaseContext();

      const symptomOnly = createFinding({
        ruleCode: 'R504',
        diagnosisLabel: '证据不足',
        category: 'interaction',
        layer: 'ui',
        cluster: 'insufficient_evidence',
        confidence: 0.95,
        isSymptomOnly: true,
        evidenceRefs: ['ev_dom_snapshot'],
      });

      const rootCause = createFinding({
        ruleCode: 'R401',
        diagnosisLabel: 'click 未触发 handler',
        category: 'interaction',
        layer: 'handler',
        cluster: 'click_handler_not_started',
        confidence: 0.84,
        isSymptomOnly: false,
        evidenceRefs: ['ev_click_trace', 'ev_handler_missing'],
      });

      const ranked = service.rank([symptomOnly, rootCause], context);

      expect(ranked[0].ruleCode).toBe('R401');
      expect(ranked[1].ruleCode).toBe('R504');

      const symptomRank = ranked.find((item) => item.ruleCode === 'R504');
      expect(symptomRank?.rankScore.symptomPenalty).toBeGreaterThan(0);
      expect(symptomRank?.rankReasons).toContain('症状规则已降权');
    });
  });

  describe('证据链加分', () => {
    it('should rank finding with richer evidence higher when other factors are close', () => {
      const context = createBaseContext();

      const richerEvidence = createFinding({
        ruleCode: 'R201',
        diagnosisLabel: '合法值被判空吞掉',
        category: 'render_transform',
        layer: 'render',
        cluster: 'formatter_falsy_swallowed',
        confidence: 0.86,
        isSymptomOnly: false,
        evidenceRefs: [
          'ev_api_amount_0',
          'ev_store_value',
          'ev_formatter_output_fallback',
          'ev_dom_snapshot',
        ],
      });

      const weakerEvidence = createFinding({
        ruleCode: 'R203',
        diagnosisLabel: 'render 输出异常',
        category: 'render_transform',
        layer: 'render',
        cluster: 'render_output_unexpected',
        confidence: 0.87,
        isSymptomOnly: false,
        evidenceRefs: ['ev_render_trace'],
      });

      const ranked = service.rank([weakerEvidence, richerEvidence], context);

      expect(ranked[0].ruleCode).toBe('R201');
      expect(ranked[0].rankScore.evidenceScore).toBeGreaterThan(
        ranked[1].rankScore.evidenceScore,
      );
    });
  });

  describe('同 layer 同 category 但更具体规则优先', () => {
    it('should prefer specific rule over generic rule in same render cluster', () => {
      const context = createBaseContext();

      const specific = createFinding({
        ruleCode: 'R201',
        diagnosisLabel: '合法值被判空吞掉',
        category: 'render_transform',
        layer: 'render',
        cluster: 'formatter_problem',
        confidence: 0.9,
        isSymptomOnly: false,
        evidenceRefs: ['ev_api_amount_0', 'ev_formatter_output_fallback'],
      });

      const generic = createFinding({
        ruleCode: 'R203',
        diagnosisLabel: 'render 输出异常',
        category: 'render_transform',
        layer: 'render',
        cluster: 'formatter_problem',
        confidence: 0.91,
        isSymptomOnly: false,
        evidenceRefs: ['ev_render_trace'],
      });

      const ranked = service.rank([generic, specific], context);

      expect(ranked[0].ruleCode).toBe('R201');
      expect(ranked[1].ruleCode).toBe('R203');
      expect(ranked[1].rankScore.duplicatePenalty).toBeGreaterThan(0);
    });
  });

  describe('无 cluster 规则', () => {
    it('should not apply duplicate penalty for findings without cluster', () => {
      const context = createBaseContext();

      const a = createFinding({
        ruleCode: 'R701',
        cluster: undefined,
        layer: 'api',
        category: 'data_source',
        confidence: 0.8,
      });

      const b = createFinding({
        ruleCode: 'R702',
        cluster: undefined,
        layer: 'render',
        category: 'render_transform',
        confidence: 0.81,
      });

      const ranked = service.rank([a, b], context);

      const r701 = ranked.find((item) => item.ruleCode === 'R701');
      const r702 = ranked.find((item) => item.ruleCode === 'R702');

      expect(r701?.rankScore.duplicatePenalty).toBe(0);
      expect(r702?.rankScore.duplicatePenalty).toBe(0);
    });
  });

  describe('rank reasons', () => {
    it('should generate interpretable rank reasons', () => {
      const context = createBaseContext();

      const finding = createFinding({
        ruleCode: 'R101',
        diagnosisLabel: '接口字段缺失',
        category: 'data_source',
        layer: 'api',
        cluster: 'api_field_missing',
        confidence: 0.95,
        isSymptomOnly: false,
        evidenceRefs: [
          'ev_api_field_missing',
          'ev_api_response',
          'ev_lineage_binding',
        ],
      });

      const [ranked] = service.rank([finding], context);

      expect(ranked.rankReasons).toContain('根因规则优先');
      expect(ranked.rankReasons).toContain('上游 API 层优先级最高');
      expect(ranked.rankReasons).toContain('规则簇明确，可归入稳定问题类型');
      expect(ranked.rankReasons).toContain('证据链完整度高');
      expect(ranked.rankReasons).toContain('规则置信度高');
    });
  });

  describe('交互链路排序', () => {
    it('should rank handler root-cause above pre-request symptom', () => {
      const context = createBaseContext({
        mode: 'click_diagnosis',
        clickDetected: true,
        handlerStarted: false,
        requestSent: false,
      });

      const rootCause = createFinding({
        ruleCode: 'R401',
        diagnosisLabel: 'click 未触发 handler',
        category: 'interaction',
        layer: 'handler',
        cluster: 'click_handler_not_started',
        confidence: 0.93,
        isSymptomOnly: false,
        evidenceRefs: ['ev_click_trace', 'ev_handler_missing'],
      });

      const symptom = createFinding({
        ruleCode: 'R503',
        diagnosisLabel: '请求前链路中断',
        category: 'interaction',
        layer: 'request_to_ui',
        cluster: 'pre_request_gap',
        confidence: 0.91,
        isSymptomOnly: true,
        evidenceRefs: ['ev_click_trace', 'ev_request_missing'],
      });

      const ranked = service.rank([symptom, rootCause], context);

      expect(ranked[0].ruleCode).toBe('R401');
      expect(ranked[1].ruleCode).toBe('R503');
    });
  });
});
```

---

# 3. 这组测试覆盖了什么

---

## 3.1 根因优先
用例：

- `R201` vs `R501`

即使 `R501` 的 confidence 更高，仍要让 `R201` 排前面。

---

## 3.2 上游优先
用例：

- `R103 state` vs `R302 dom`

即使分数接近，也应该让更上游的状态层根因更优先。

---

## 3.3 cluster 去重降权
用例：

- `R201`
- `R202`
- `R501`

三者属于同一 cluster：

- 第一名保留
- 后两者要有 `duplicatePenalty`
- 且更泛、更像症状的规则继续往后排

---

## 3.4 症状降权
用例：

- `R504` vs `R401`

确保 symptom-only 的规则被惩罚，不会压过真实根因。

---

## 3.5 证据链加分
用例：

- 一个规则 evidence 多
- 一个规则 evidence 少

在 confidence 接近时，证据更完整的优先。

---

## 3.6 更具体规则优先
用例：

- `R201` vs `R203`

即使 generic rule 的 confidence 略高，也应该让更具体规则赢。

---

## 3.7 无 cluster 不误伤
避免所有规则都被错误套用 duplicatePenalty。

---

## 3.8 排序理由可解释
验证 `rankReasons` 里真的有可展示的解释文案。

---

## 3.9 交互链路排序
用 click 场景验证：

- `R401` 根因
- `R503` 症状

确保交互诊断链路也符合你的排序原则。

---

# 4. 运行方式

如果你项目已经装好了 Jest / ts-jest，直接：

```bash
npm test
```

或者只跑这个文件：

```bash
npx jest src/modules/diagnosis/domain/ranking.service.spec.ts
```

如果你用的是 Nest 默认测试命令：

```bash
npm run test
```

单测 watch：

```bash
npm run test:watch
```

覆盖率：

```bash
npm run test:cov
```

---

# 5. 可继续补的测试方向

如果你下一步想把这套排序做得更稳，建议再补 4 类 case：

---

## 5.1 边界值测试
比如：

- confidence 完全相同
- evidenceRefs 为空
- layer 未知
- cluster 为空字符串

---

## 5.2 同 cluster 多根因规则
例如：

- `R101`
- `R102`

都在 api binding 问题附近，验证更具体规则是否胜出。

---

## 5.3 多症状同时命中
例如：

- `R501`
- `R502`
- `R504`

验证 symptom 之间的排序是否稳定。

---

## 5.4 conclusion 层联动测试
不仅测试 rank，还测试：

- `topFinding`
- `supportingFindings`
- `symptomFindings`

是否符合最终 API 输出预期。

---

# 6. 我建议你下一步做什么

按工程顺序，接下来最合适的是：

## 方案 A
**`DiagnosisConclusionService` Jest 单测样例**

因为现在：
- RuleEngine 有了
- RankingService 有了
- 下一步就是验证“最终结论筛选”是否正确

## 方案 B
**`RuleEngineService` Jest 单测样例**

把每条规则命中与不命中条件固化下来。

---

如果你愿意，我下一条可以直接继续给你：

1. **`DiagnosisConclusionService` Jest 单测样例**
2. **`RuleEngineService` Jest 单测样例**
3. **规则注册表重构版（每条规则独立文件）**

如果按工程推进顺序，我建议下一步直接做：  
**`DiagnosisConclusionService` Jest 单测样例**。