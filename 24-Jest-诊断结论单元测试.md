下面直接给你一版 **`DiagnosisConclusionService` Jest 单测样例**。  
目标是验证你这套“**RuleEngine -> Ranking -> Conclusion**”链路里，**最终结论筛选逻辑**是否符合预期。

重点覆盖：

- `topFinding` 是否正确
- `supportingFindings` 是否过滤正确
- `symptomFindings` 是否单独归类
- `repairHints` 是否去重合并
- `diagnosisState` 是否正确
- 无命中规则时是否返回 `no_rule_matched / insufficient_evidence`

---

# 1. 推荐文件位置

```ts
src/modules/diagnosis/domain/diagnosis-conclusion.service.spec.ts
```

---

# 2. 单测代码

```ts
import { DiagnosisConclusionService } from './diagnosis-conclusion.service';
import { RankingService } from './ranking.service';
import { DiagnosisContext } from '../models/diagnosis-context.model';
import { RuleFinding } from '../models/rule-finding.model';

describe('DiagnosisConclusionService', () => {
  let service: DiagnosisConclusionService;

  beforeEach(() => {
    service = new DiagnosisConclusionService(new RankingService());
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
      previousRenderOutputValue: '0.00',
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

  describe('topFinding 选择', () => {
    it('should choose the highest ranked root cause as topFinding', () => {
      const context = createBaseContext();

      const rootCause = createFinding({
        ruleCode: 'R201',
        title: '合法 falsy 值被误判为空',
        diagnosisLabel: '合法值被判空吞掉',
        category: 'render_transform',
        severity: 'high',
        confidence: 0.96,
        layer: 'render',
        cluster: 'formatter_falsy_swallowed',
        summary: '上游存在合法值 0，但 formatter 将其误判为空。',
        evidenceRefs: ['ev_api_amount_0', 'ev_formatter_output_fallback'],
        suggestions: ['将 if (!value) 改为 value == null'],
        isSymptomOnly: false,
      });

      const symptom = createFinding({
        ruleCode: 'R501',
        title: '页面显示 fallback 占位值',
        diagnosisLabel: '页面显示占位值',
        category: 'dom',
        severity: 'medium',
        confidence: 0.92,
        layer: 'ui',
        cluster: 'fallback_displayed',
        summary: '页面当前显示占位值。',
        evidenceRefs: ['ev_dom_snapshot'],
        suggestions: ['继续检查上游链路'],
        isSymptomOnly: true,
      });

      const conclusion = service.conclude([symptom, rootCause], context);

      expect(conclusion.topFinding).not.toBeNull();
      expect(conclusion.topFinding?.ruleCode).toBe('R201');
      expect(conclusion.summary).toContain('合法值被判空吞掉');
      expect(conclusion.diagnosisState).toBe('confirmed_root_cause');
    });
  });

  describe('supportingFindings 过滤', () => {
    it('should exclude symptom findings from supportingFindings', () => {
      const context = createBaseContext();

      const top = createFinding({
        ruleCode: 'R103',
        diagnosisLabel: '请求成功但状态未更新',
        category: 'state_binding',
        layer: 'state',
        cluster: 'request_success_state_not_updated',
        confidence: 0.91,
        summary: '接口成功但 store 未更新。',
        evidenceRefs: ['ev_api_amount_0', 'ev_store_update_missing'],
        suggestions: ['检查 dispatch/commit 是否执行'],
        isSymptomOnly: false,
      });

      const supporting = createFinding({
        ruleCode: 'R104',
        diagnosisLabel: 'selector 取值失败',
        category: 'state_binding',
        layer: 'selector',
        cluster: 'selector_value_missing',
        confidence: 0.86,
        summary: 'store 更新后 selector 未取到值。',
        evidenceRefs: ['ev_store_value', 'ev_selector_value_missing'],
        suggestions: ['检查 selector 路径'],
        isSymptomOnly: false,
      });

      const symptom = createFinding({
        ruleCode: 'R501',
        diagnosisLabel: '页面显示占位值',
        category: 'dom',
        layer: 'ui',
        cluster: 'fallback_displayed',
        confidence: 0.9,
        summary: '页面显示的是 fallback。',
        evidenceRefs: ['ev_dom_snapshot'],
        suggestions: ['检查上游 render'],
        isSymptomOnly: true,
      });

      const conclusion = service.conclude([top, supporting, symptom], context);

      expect(conclusion.topFinding?.ruleCode).toBe('R103');
      expect(conclusion.supportingFindings.map((f) => f.ruleCode)).toEqual(
        expect.arrayContaining(['R104']),
      );
      expect(conclusion.supportingFindings.map((f) => f.ruleCode)).not.toContain(
        'R501',
      );
      expect(conclusion.symptomFindings.map((f) => f.ruleCode)).toContain(
        'R501',
      );
    });

    it('should exclude findings from the same cluster as topFinding', () => {
      const context = createBaseContext();

      const top = createFinding({
        ruleCode: 'R201',
        diagnosisLabel: '合法值被判空吞掉',
        category: 'render_transform',
        layer: 'render',
        cluster: 'formatter_problem',
        confidence: 0.95,
        summary: '合法值被吞。',
        evidenceRefs: ['ev_api_amount_0', 'ev_formatter_output_fallback'],
        suggestions: ['修正空值判断'],
        isSymptomOnly: false,
      });

      const sameCluster = createFinding({
        ruleCode: 'R202',
        diagnosisLabel: 'formatter 输出占位值',
        category: 'render_transform',
        layer: 'render',
        cluster: 'formatter_problem',
        confidence: 0.9,
        summary: 'formatter 输出 fallback。',
        evidenceRefs: ['ev_formatter_output_fallback'],
        suggestions: ['检查 formatter fallback'],
        isSymptomOnly: false,
      });

      const otherCluster = createFinding({
        ruleCode: 'R302',
        diagnosisLabel: 'DOM 未反映最新渲染结果',
        category: 'dom',
        layer: 'dom',
        cluster: 'dom_not_updated',
        confidence: 0.84,
        summary: 'DOM 未更新。',
        evidenceRefs: ['ev_render_trace', 'ev_dom_snapshot'],
        suggestions: ['检查 commit/更新链路'],
        isSymptomOnly: false,
      });

      const conclusion = service.conclude(
        [top, sameCluster, otherCluster],
        context,
      );

      expect(conclusion.topFinding?.ruleCode).toBe('R201');
      expect(conclusion.supportingFindings.map((f) => f.ruleCode)).toContain(
        'R302',
      );
      expect(conclusion.supportingFindings.map((f) => f.ruleCode)).not.toContain(
        'R202',
      );
    });
  });

  describe('symptomFindings 归类', () => {
    it('should collect all symptom-only findings into symptomFindings', () => {
      const context = createBaseContext();

      const root = createFinding({
        ruleCode: 'R401',
        diagnosisLabel: 'click 未触发 handler',
        category: 'interaction',
        layer: 'handler',
        cluster: 'click_handler_not_started',
        confidence: 0.93,
        summary: '点击发生但 handler 未启动。',
        evidenceRefs: ['ev_click_trace', 'ev_handler_missing'],
        suggestions: ['检查事件绑定'],
        isSymptomOnly: false,
      });

      const symptom1 = createFinding({
        ruleCode: 'R503',
        diagnosisLabel: '请求前链路中断',
        category: 'interaction',
        layer: 'request_to_ui',
        cluster: 'pre_request_gap',
        confidence: 0.8,
        summary: '点击后未发请求。',
        evidenceRefs: ['ev_click_trace', 'ev_request_missing'],
        suggestions: ['检查请求前分支'],
        isSymptomOnly: true,
      });

      const symptom2 = createFinding({
        ruleCode: 'R504',
        diagnosisLabel: '证据不足',
        category: 'interaction',
        layer: 'ui',
        cluster: 'insufficient_evidence',
        confidence: 0.6,
        summary: '存在异常表象但证据不足。',
        evidenceRefs: ['ev_dom_snapshot'],
        suggestions: ['补充 trace'],
        isSymptomOnly: true,
      });

      const conclusion = service.conclude([root, symptom1, symptom2], context);

      expect(conclusion.topFinding?.ruleCode).toBe('R401');
      expect(conclusion.symptomFindings.map((f) => f.ruleCode)).toEqual(
        expect.arrayContaining(['R503', 'R504']),
      );
      expect(conclusion.symptomFindings).toHaveLength(2);
    });
  });

  describe('repairHints 合并去重', () => {
    it('should merge and deduplicate suggestions from top and supporting findings', () => {
      const context = createBaseContext();

      const top = createFinding({
        ruleCode: 'R103',
        diagnosisLabel: '请求成功但状态未更新',
        category: 'state_binding',
        layer: 'state',
        cluster: 'request_success_state_not_updated',
        confidence: 0.92,
        summary: 'store 未更新。',
        evidenceRefs: ['ev_api_amount_0', 'ev_store_update_missing'],
        suggestions: [
          '检查 dispatch/commit 是否执行',
          '检查 reducer / mutation 是否提前 return',
        ],
        isSymptomOnly: false,
      });

      const supporting = createFinding({
        ruleCode: 'R104',
        diagnosisLabel: 'selector 取值失败',
        category: 'state_binding',
        layer: 'selector',
        cluster: 'selector_value_missing',
        confidence: 0.87,
        summary: 'selector 未取到值。',
        evidenceRefs: ['ev_store_value', 'ev_selector_value_missing'],
        suggestions: [
          '检查 selector 路径',
          '检查 dispatch/commit 是否执行',
        ],
        isSymptomOnly: false,
      });

      const conclusion = service.conclude([top, supporting], context);

      expect(conclusion.repairHints).toEqual([
        '检查 dispatch/commit 是否执行',
        '检查 reducer / mutation 是否提前 return',
        '检查 selector 路径',
      ]);
    });

    it('should limit repairHints to 5 items', () => {
      const context = createBaseContext();

      const top = createFinding({
        ruleCode: 'R201',
        diagnosisLabel: '合法值被判空吞掉',
        confidence: 0.95,
        suggestions: ['s1', 's2', 's3'],
        isSymptomOnly: false,
      });

      const supporting1 = createFinding({
        ruleCode: 'R302',
        diagnosisLabel: 'DOM 未更新',
        cluster: 'dom_not_updated',
        confidence: 0.85,
        suggestions: ['s4', 's5', 's6'],
        isSymptomOnly: false,
      });

      const conclusion = service.conclude([top, supporting1], context);

      expect(conclusion.repairHints).toHaveLength(5);
      expect(conclusion.repairHints).toEqual(['s1', 's2', 's3', 's4', 's5']);
    });
  });

  describe('diagnosisState 判定', () => {
    it('should return confirmed_root_cause when top finding confidence >= 0.9', () => {
      const context = createBaseContext();

      const top = createFinding({
        ruleCode: 'R101',
        diagnosisLabel: '接口字段缺失',
        category: 'data_source',
        layer: 'api',
        confidence: 0.95,
        isSymptomOnly: false,
      });

      const conclusion = service.conclude([top], context);

      expect(conclusion.diagnosisState).toBe('confirmed_root_cause');
    });

    it('should return probable_root_cause when top finding confidence < 0.9', () => {
      const context = createBaseContext();

      const top = createFinding({
        ruleCode: 'R203',
        diagnosisLabel: 'render 输出异常',
        category: 'render_transform',
        layer: 'render',
        confidence: 0.82,
        isSymptomOnly: false,
      });

      const conclusion = service.conclude([top], context);

      expect(conclusion.diagnosisState).toBe('probable_root_cause');
    });
  });

  describe('无规则命中时的结论', () => {
    it('should return no_rule_matched when evidence exists but no findings matched', () => {
      const context = createBaseContext({
        responseSuccess: true,
        storeUpdated: true,
        renderTriggered: true,
        domValue: '--',
      });

      const conclusion = service.conclude([], context);

      expect(conclusion.topFinding).toBeNull();
      expect(conclusion.supportingFindings).toEqual([]);
      expect(conclusion.symptomFindings).toEqual([]);
      expect(conclusion.diagnosisState).toBe('no_rule_matched');
      expect(conclusion.summary).toContain('现有规则未识别出明确异常');
      expect(conclusion.repairHints).toEqual([
        '检查业务计算逻辑',
        '补充更细的规则覆盖',
      ]);
    });

    it('should return insufficient_evidence when upstream evidence is weak', () => {
      const context = createBaseContext({
        responseSuccess: false,
        storeUpdated: false,
        renderTriggered: false,
        domValue: undefined,
      });

      const conclusion = service.conclude([], context);

      expect(conclusion.topFinding).toBeNull();
      expect(conclusion.diagnosisState).toBe('insufficient_evidence');
      expect(conclusion.summary).toContain('当前证据不足');
      expect(conclusion.repairHints).toEqual([
        '补充接口响应快照',
        '补充状态更新轨迹',
        '补充渲染证据',
      ]);
    });
  });

  describe('scoreBreakdown 结构', () => {
    it('should expose scoreBreakdown for ranked findings', () => {
      const context = createBaseContext();

      const finding1 = createFinding({
        ruleCode: 'R201',
        diagnosisLabel: '合法值被判空吞掉',
        confidence: 0.96,
        isSymptomOnly: false,
      });

      const finding2 = createFinding({
        ruleCode: 'R501',
        diagnosisLabel: '页面显示占位值',
        confidence: 0.8,
        isSymptomOnly: true,
      });

      const conclusion = service.conclude([finding1, finding2], context);

      expect(conclusion.scoreBreakdown.length).toBeGreaterThanOrEqual(2);

      expect(conclusion.scoreBreakdown[0]).toEqual(
        expect.objectContaining({
          ruleCode: expect.any(String),
          finalScore: expect.any(Number),
          reason: expect.any(Array),
        }),
      );
    });
  });
});
```

---

# 3. 这组测试覆盖了什么

---

## 3.1 `topFinding` 选择是否正确
验证最终结论不会把 symptom 当成 top cause。

---

## 3.2 `supportingFindings` 是否过滤了：
- symptom 规则
- 与 top 同 cluster 的重复规则

这两条很关键，否则结果页会显得很乱。

---

## 3.3 `symptomFindings` 是否独立归类
这样前端可以单独做“异常表象”区域，不和根因混在一起。

---

## 3.4 `repairHints` 是否正确：
- 合并 top + supporting 的建议
- 去重
- 最多保留 5 条

---

## 3.5 `diagnosisState` 是否正确
你当前服务逻辑是：

- `top.confidence >= 0.9` → `confirmed_root_cause`
- 否则 → `probable_root_cause`

这里已经覆盖。

---

## 3.6 无命中规则时的两种 fallback
这组很重要：

### 有证据但没匹配到规则
返回：
- `no_rule_matched`

### 连基础证据都很弱
返回：
- `insufficient_evidence`

这两类状态在工作台上表现应该不同。

---

## 3.7 `scoreBreakdown` 是否有结构化输出
后面你前端要做排序解释卡片，这里是基础保障。

---

# 4. 运行方式

只跑这个 spec：

```bash
npx jest src/modules/diagnosis/domain/diagnosis-conclusion.service.spec.ts
```

或者：

```bash
npm run test -- diagnosis-conclusion.service.spec.ts
```

全量跑：

```bash
npm test
```

覆盖率：

```bash
npm run test:cov
```

---

# 5. 建议你下一步继续补的测试

按工程顺序，我建议接下来补这两类：

---

## 5.1 `RuleEngineService` Jest 单测
验证每条规则：
- 命中
- 不命中
- 边界值

这个是规则引擎最核心的质量保障。

---

## 5.2 `DiagnosisQueryService` 集成风格单测
mock：
- `Repository`
- `EvidenceCollector`
- `ContextBuilder`
- `RuleEngine`
- `ConclusionService`

验证整个 orchestrator 的主链路是否正确。

---

# 6. 一个小提醒

如果你当前 `DiagnosisConclusionService` 还是这版逻辑：

```ts
const supportingFindings = ranked.filter(
  (item, index) =>
    index > 0 &&
    !item.isSymptomOnly &&
    item.cluster !== topFinding?.cluster,
);
```

那上面这些测试是能对齐的。

如果你后面又增强成：
- 同 cluster 全局去重
- supporting 数量限制
- 高置信度 supporting 才保留

那对应测试断言也要同步更新。

---

如果你愿意，我下一条可以继续直接给你：

1. **`RuleEngineService` Jest 单测样例**
2. **`DiagnosisQueryService` Jest 集成单测样例**
3. **规则注册表重构版（每条规则独立文件）**

如果按工程推进顺序，我建议下一步直接做：  
**`RuleEngineService` Jest 单测样例**。