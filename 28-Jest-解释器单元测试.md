下面直接给你一版 **`ExplanationBuilder` Jest 单测样例**。  
目标是把诊断结果里的“**可读解释层**”固化下来，保证以后你调整文案生成逻辑时，不会把核心输出搞坏。

重点覆盖：

- `summaryText` 是否优先围绕 `topFinding`
- `evidenceNarrative` 是否能按上游 -> 下游讲清楚
- `operatorAdvice` 是否去重
- 无 root cause 时是否输出 fallback explanation
- 有 symptom / supporting 时是否正确拼接
- click / inspect 两种模式是否都能生成可读解释

---

# 1. 推荐文件位置

```ts
src/modules/diagnosis/domain/explanation-builder.spec.ts
```

或者如果你放在 builders 目录：

```ts
src/modules/diagnosis/builders/explanation-builder.spec.ts
```

---

# 2. 假设输出结构

下面测试默认你的 `ExplanationBuilder` 输出大概像这样：

```ts
interface DiagnosisExplanation {
  summaryText: string;
  evidenceNarrative: string[];
  operatorAdvice: string[];
}
```

如果你实际还有字段，比如：

- `rootCauseText`
- `technicalNarrative`
- `businessImpact`
- `confidenceComment`

也可以在这套测试基础上继续加。

---

# 3. 完整 Jest 单测样例

```ts
import { ExplanationBuilder } from './explanation-builder';

describe('ExplanationBuilder', () => {
  let builder: ExplanationBuilder;

  beforeEach(() => {
    builder = new ExplanationBuilder();
  });

  const createInspectContext = (overrides: Record<string, any> = {}) => ({
    diagnosisId: 'diag_001',
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

    requestSent: true,
    responseReceived: true,
    stateChanged: true,
    renderCommitted: true,

    evidenceRefs: [
      'ev_api_amount_0',
      'ev_store_value',
      'ev_selector_value',
      'ev_render_trace',
      'ev_dom_snapshot',
    ],

    ...overrides,
  });

  const createClickContext = (overrides: Record<string, any> = {}) => ({
    diagnosisId: 'diag_002',
    mode: 'click_diagnosis',

    pageUrl: '/orders/list',
    targetDomSelector: '.submit-btn',
    targetComponent: 'SubmitButton',

    clickDetected: true,
    handlerStarted: false,
    requestSent: false,
    responseReceived: false,
    stateChanged: false,
    renderTriggered: false,
    renderCommitted: false,

    domUpdated: false,
    domVisible: true,
    domValue: '提交中',

    evidenceRefs: [
      'ev_click_trace',
      'ev_handler_trace',
      'ev_request_trace',
      'ev_dom_snapshot',
    ],

    ...overrides,
  });

  const createFinding = (overrides: Record<string, any> = {}) => ({
    ruleCode: 'R999',
    title: 'default title',
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
  });

  const createConclusion = (overrides: Record<string, any> = {}) => ({
    topFinding: null,
    supportingFindings: [],
    symptomFindings: [],
    diagnosisState: 'no_rule_matched',
    summary: 'default conclusion',
    repairHints: [],
    scoreBreakdown: [],
    ...overrides,
  });

  describe('summaryText 生成', () => {
    it('should generate summaryText around topFinding in inspect mode', () => {
      const context = createInspectContext();

      const topFinding = createFinding({
        ruleCode: 'R201',
        diagnosisLabel: '合法值被判空吞掉',
        summary: '上游存在合法值 0，但 formatter 将其误判为空。',
        layer: 'render',
        confidence: 0.96,
        suggestions: ['将 if (!value) 改为 value == null'],
      });

      const conclusion = createConclusion({
        topFinding,
        diagnosisState: 'confirmed_root_cause',
        summary: '已定位到根因：合法值被判空吞掉。',
      });

      const explanation = builder.build(context, conclusion, [topFinding]);

      expect(explanation.summaryText).toContain('合法值被判空吞掉');
      expect(explanation.summaryText).toContain('0');
      expect(explanation.summaryText).toContain('--');
    });

    it('should generate summaryText around topFinding in click mode', () => {
      const context = createClickContext();

      const topFinding = createFinding({
        ruleCode: 'R401',
        diagnosisLabel: 'click 未触发 handler',
        summary: '点击事件已发生，但业务 handler 没有启动。',
        layer: 'handler',
        confidence: 0.95,
        suggestions: ['检查事件绑定与 disabled 状态'],
      });

      const conclusion = createConclusion({
        topFinding,
        diagnosisState: 'confirmed_root_cause',
        summary: '已定位到根因：click 未触发 handler。',
      });

      const explanation = builder.build(context, conclusion, [topFinding]);

      expect(explanation.summaryText).toContain('click 未触发 handler');
      expect(explanation.summaryText).toContain('handler');
    });

    it('should fallback summaryText when there is no topFinding', () => {
      const context = createInspectContext();

      const conclusion = createConclusion({
        topFinding: null,
        diagnosisState: 'no_rule_matched',
        summary: '现有规则未识别出明确异常。',
      });

      const explanation = builder.build(context, conclusion, []);

      expect(explanation.summaryText).toContain('未识别');
      expect(explanation.summaryText).toContain('明确根因');
    });
  });

  describe('evidenceNarrative 生成', () => {
    it('should generate upstream-to-downstream narrative for inspect diagnosis', () => {
      const context = createInspectContext();

      const topFinding = createFinding({
        ruleCode: 'R201',
        diagnosisLabel: '合法值被判空吞掉',
        layer: 'render',
        summary: '上游值被错误吞掉。',
        evidenceRefs: ['ev_api_amount_0', 'ev_render_trace'],
      });

      const symptomFinding = createFinding({
        ruleCode: 'R501',
        diagnosisLabel: '页面显示占位值',
        layer: 'dom',
        summary: '页面显示占位值。',
        isSymptomOnly: true,
        evidenceRefs: ['ev_dom_snapshot'],
      });

      const conclusion = createConclusion({
        topFinding,
        symptomFindings: [symptomFinding],
        diagnosisState: 'confirmed_root_cause',
      });

      const explanation = builder.build(context, conclusion, [
        topFinding,
        symptomFinding,
      ]);

      expect(explanation.evidenceNarrative.length).toBeGreaterThanOrEqual(3);
      expect(explanation.evidenceNarrative.join(' | ')).toContain(
        'response.data.amount',
      );
      expect(explanation.evidenceNarrative.join(' | ')).toContain('0');
      expect(explanation.evidenceNarrative.join(' | ')).toContain('--');
    });

    it('should generate click-chain narrative for click diagnosis', () => {
      const context = createClickContext({
        clickDetected: true,
        handlerStarted: false,
        requestSent: false,
      });

      const topFinding = createFinding({
        ruleCode: 'R401',
        diagnosisLabel: 'click 未触发 handler',
        layer: 'handler',
        summary: '点击已发生，但 handler 未启动。',
        evidenceRefs: ['ev_click_trace', 'ev_handler_trace'],
      });

      const symptomFinding = createFinding({
        ruleCode: 'R503',
        diagnosisLabel: '链路中断于 request 之前',
        layer: 'request',
        summary: '请求未发出。',
        isSymptomOnly: true,
        evidenceRefs: ['ev_request_trace'],
      });

      const conclusion = createConclusion({
        topFinding,
        symptomFindings: [symptomFinding],
        diagnosisState: 'confirmed_root_cause',
      });

      const explanation = builder.build(context, conclusion, [
        topFinding,
        symptomFinding,
      ]);

      expect(explanation.evidenceNarrative.join(' | ')).toContain('click');
      expect(explanation.evidenceNarrative.join(' | ')).toContain('handler');
      expect(explanation.evidenceNarrative.join(' | ')).toContain('request');
    });

    it('should generate fallback evidence narrative when findings are empty', () => {
      const context = createInspectContext({
        responseSuccess: true,
        storeUpdated: true,
        renderTriggered: true,
        domValue: '--',
      });

      const conclusion = createConclusion({
        topFinding: null,
        diagnosisState: 'no_rule_matched',
      });

      const explanation = builder.build(context, conclusion, []);

      expect(explanation.evidenceNarrative.length).toBeGreaterThan(0);
      expect(explanation.evidenceNarrative.join(' | ')).toContain('DOM');
    });
  });

  describe('operatorAdvice 合并去重', () => {
    it('should merge top/supporting/symptom suggestions and deduplicate them', () => {
      const context = createInspectContext();

      const topFinding = createFinding({
        ruleCode: 'R103',
        diagnosisLabel: '请求成功但状态未更新',
        layer: 'state',
        suggestions: [
          '检查 dispatch/commit 是否执行',
          '检查 reducer / mutation 是否提前 return',
        ],
      });

      const supporting = createFinding({
        ruleCode: 'R104',
        diagnosisLabel: 'selector 取值失败',
        layer: 'selector',
        suggestions: [
          '检查 selector 路径',
          '检查 dispatch/commit 是否执行',
        ],
      });

      const symptom = createFinding({
        ruleCode: 'R501',
        diagnosisLabel: '页面显示占位值',
        layer: 'dom',
        isSymptomOnly: true,
        suggestions: ['检查 selector 路径'],
      });

      const conclusion = createConclusion({
        topFinding,
        supportingFindings: [supporting],
        symptomFindings: [symptom],
        diagnosisState: 'confirmed_root_cause',
        repairHints: [
          '检查 dispatch/commit 是否执行',
          '检查 selector 路径',
        ],
      });

      const explanation = builder.build(context, conclusion, [
        topFinding,
        supporting,
        symptom,
      ]);

      expect(explanation.operatorAdvice).toEqual([
        '检查 dispatch/commit 是否执行',
        '检查 selector 路径',
        '检查 reducer / mutation 是否提前 return',
      ]);
    });

    it('should fallback to conclusion.repairHints when findings have no suggestions', () => {
      const context = createInspectContext();

      const topFinding = createFinding({
        ruleCode: 'R201',
        suggestions: [],
      });

      const conclusion = createConclusion({
        topFinding,
        diagnosisState: 'confirmed_root_cause',
        repairHints: ['修正 formatter 空值判断', '补充 render 单测'],
      });

      const explanation = builder.build(context, conclusion, [topFinding]);

      expect(explanation.operatorAdvice).toEqual([
        '修正 formatter 空值判断',
        '补充 render 单测',
      ]);
    });

    it('should limit operatorAdvice length when too many suggestions exist', () => {
      const context = createInspectContext();

      const topFinding = createFinding({
        suggestions: ['a1', 'a2', 'a3'],
      });

      const supporting = createFinding({
        suggestions: ['a4', 'a5', 'a6'],
      });

      const conclusion = createConclusion({
        topFinding,
        supportingFindings: [supporting],
        repairHints: [],
      });

      const explanation = builder.build(context, conclusion, [
        topFinding,
        supporting,
      ]);

      expect(explanation.operatorAdvice.length).toBeLessThanOrEqual(5);
      expect(explanation.operatorAdvice).toEqual(['a1', 'a2', 'a3', 'a4', 'a5']);
    });
  });

  describe('supporting / symptom 文案融合', () => {
    it('should mention supporting findings in evidence narrative when they exist', () => {
      const context = createInspectContext({
        storeUpdated: false,
        selectorRan: false,
      });

      const topFinding = createFinding({
        ruleCode: 'R103',
        diagnosisLabel: '请求成功但状态未更新',
        layer: 'state',
        summary: 'store 未更新。',
      });

      const supporting = createFinding({
        ruleCode: 'R104',
        diagnosisLabel: 'selector 取值失败',
        layer: 'selector',
        summary: 'selector 未取到值。',
      });

      const conclusion = createConclusion({
        topFinding,
        supportingFindings: [supporting],
        diagnosisState: 'confirmed_root_cause',
      });

      const explanation = builder.build(context, conclusion, [
        topFinding,
        supporting,
      ]);

      expect(explanation.evidenceNarrative.join(' | ')).toContain('store');
      expect(explanation.evidenceNarrative.join(' | ')).toContain('selector');
    });

    it('should mention symptom findings as observed phenomenon', () => {
      const context = createInspectContext({
        domValue: '--',
      });

      const topFinding = createFinding({
        ruleCode: 'R201',
        diagnosisLabel: '合法值被判空吞掉',
        layer: 'render',
        summary: 'formatter 将 0 处理为 --。',
      });

      const symptom = createFinding({
        ruleCode: 'R501',
        diagnosisLabel: '页面显示占位值',
        layer: 'dom',
        summary: '页面显示占位值 --。',
        isSymptomOnly: true,
      });

      const conclusion = createConclusion({
        topFinding,
        symptomFindings: [symptom],
        diagnosisState: 'confirmed_root_cause',
      });

      const explanation = builder.build(context, conclusion, [
        topFinding,
        symptom,
      ]);

      expect(explanation.evidenceNarrative.join(' | ')).toContain('页面');
      expect(explanation.evidenceNarrative.join(' | ')).toContain('--');
    });
  });

  describe('fallback explanation', () => {
    it('should build insufficient_evidence explanation', () => {
      const context = createInspectContext({
        responseSuccess: false,
        storeUpdated: false,
        renderTriggered: false,
        domValue: undefined,
      });

      const conclusion = createConclusion({
        topFinding: null,
        diagnosisState: 'insufficient_evidence',
        summary: '当前证据不足，无法确认根因。',
        repairHints: ['补充接口响应快照', '补充状态更新轨迹', '补充渲染证据'],
      });

      const explanation = builder.build(context, conclusion, []);

      expect(explanation.summaryText).toContain('证据不足');
      expect(explanation.operatorAdvice).toEqual([
        '补充接口响应快照',
        '补充状态更新轨迹',
        '补充渲染证据',
      ]);
      expect(explanation.evidenceNarrative.length).toBeGreaterThan(0);
    });

    it('should build no_rule_matched explanation', () => {
      const context = createInspectContext({
        responseSuccess: true,
        storeUpdated: true,
        renderTriggered: true,
        domValue: '--',
      });

      const conclusion = createConclusion({
        topFinding: null,
        diagnosisState: 'no_rule_matched',
        summary: '现有规则未识别出明确异常。',
        repairHints: ['检查业务计算逻辑', '补充更细的规则覆盖'],
      });

      const explanation = builder.build(context, conclusion, []);

      expect(explanation.summaryText).toContain('未识别');
      expect(explanation.operatorAdvice).toEqual([
        '检查业务计算逻辑',
        '补充更细的规则覆盖',
      ]);
    });
  });

  describe('健壮性', () => {
    it('should build safely when findings is empty and repairHints is empty', () => {
      const context = createInspectContext();

      const conclusion = createConclusion({
        topFinding: null,
        supportingFindings: [],
        symptomFindings: [],
        repairHints: [],
      });

      const explanation = builder.build(context, conclusion, []);

      expect(explanation).toEqual(
        expect.objectContaining({
          summaryText: expect.any(String),
          evidenceNarrative: expect.any(Array),
          operatorAdvice: expect.any(Array),
        }),
      );
    });

    it('should not crash when topFinding.summary is empty', () => {
      const context = createInspectContext();

      const topFinding = createFinding({
        ruleCode: 'R201',
        diagnosisLabel: '合法值被判空吞掉',
        summary: '',
        suggestions: ['修复 formatter 空值判断'],
      });

      const conclusion = createConclusion({
        topFinding,
        diagnosisState: 'confirmed_root_cause',
      });

      const explanation = builder.build(context, conclusion, [topFinding]);

      expect(explanation.summaryText).toContain('合法值被判空吞掉');
      expect(explanation.operatorAdvice).toContain('修复 formatter 空值判断');
    });
  });
});
```

---

# 4. 这组测试覆盖了什么

---

## 4.1 `summaryText`
验证解释摘要是否围绕：

- `topFinding.diagnosisLabel`
- 当前上下文中的关键值
- 当前模式（inspect / click）

来生成，而不是只机械复读 `conclusion.summary`。

---

## 4.2 `evidenceNarrative`
验证证据叙事是否能把链路讲通：

### inspect 模式
从：

- API / response
- store / selector
- render
- DOM

一路讲到页面结果。

### click 模式
从：

- click
- handler
- request

一路讲到链路断点。

---

## 4.3 `operatorAdvice`
验证建议来源与优先级：

1. 先用 `topFinding`
2. 再并入 `supportingFindings`
3. 再并入 `symptomFindings`
4. 再 fallback 到 `conclusion.repairHints`

并且：
- 去重
- 控制数量

---

## 4.4 supporting / symptom 融合
验证 Explanation 不是只讲 topFinding，  
而是能把：

- supporting = 补充链路证据
- symptom = 外显现象

一起组织成更像人话的解释。

---

## 4.5 fallback 场景
验证两个很关键的降级场景：

- `insufficient_evidence`
- `no_rule_matched`

这样即使没有明确根因，也不会出现 explanation 为空。

---

## 4.6 健壮性
避免 builder 因为空字段崩掉，尤其是：

- `topFinding.summary = ''`
- `findings = []`
- `repairHints = []`

---

# 5. 一个可对齐的 `ExplanationBuilder` 实现思路

如果你还没完全写完实现，下面这个结构基本能对齐上面测试：

```ts
export class ExplanationBuilder {
  build(context: any, conclusion: any, findings: any[]) {
    return {
      summaryText: this.buildSummaryText(context, conclusion),
      evidenceNarrative: this.buildEvidenceNarrative(context, conclusion, findings),
      operatorAdvice: this.buildOperatorAdvice(conclusion, findings),
    };
  }

  private buildSummaryText(context: any, conclusion: any): string {
    const top = conclusion.topFinding;

    if (!top) {
      if (conclusion.diagnosisState === 'insufficient_evidence') {
        return '当前证据不足，暂时无法确认明确根因，建议补充接口、状态和渲染链路证据。';
      }
      return '现有规则暂未识别出明确根因，建议结合更多业务规则与链路证据继续排查。';
    }

    if (context.mode === 'click_diagnosis') {
      return `已定位到可疑根因：${top.diagnosisLabel}。当前点击链路未按预期推进到后续阶段。`;
    }

    return `已定位到可疑根因：${top.diagnosisLabel}。当前链路中上游值为 ${String(
      context.apiValue ?? context.storeValue ?? context.selectorValue ?? '未知',
    )}，但最终页面显示为 ${String(context.domValue ?? context.displayedValue ?? '未知')}。`;
  }

  private buildEvidenceNarrative(
    context: any,
    conclusion: any,
    findings: any[],
  ): string[] {
    const lines: string[] = [];

    if (context.mode === 'click_diagnosis') {
      if (context.clickDetected) lines.push('检测到 click 事件已发生。');
      if (context.handlerStarted === false) lines.push('未观察到 handler 正常启动。');
      if (context.requestSent === false) lines.push('后续 request 未发出。');
      return lines.length ? lines : ['当前点击链路证据有限。'];
    }

    if (context.apiFieldPath) {
      lines.push(
        `接口字段 ${context.apiFieldPath} 当前值为 ${String(
          context.apiValue,
        )}。`,
      );
    }

    if (context.storeKey) {
      lines.push(`状态 ${context.storeKey} 当前值为 ${String(context.storeValue)}。`);
    }

    if (context.selectorName) {
      lines.push(
        `selector ${context.selectorName} 取值为 ${String(context.selectorValue)}。`,
      );
    }

    if (context.renderTriggered) {
      lines.push(
        `render 输入为 ${String(
          context.renderInputValue,
        )}，输出为 ${String(context.renderOutputValue)}。`,
      );
    }

    lines.push(`页面最终显示为 ${String(context.domValue ?? context.displayedValue)}。`);

    for (const item of conclusion.supportingFindings ?? []) {
      lines.push(`补充证据：${item.diagnosisLabel}。`);
    }

    for (const item of conclusion.symptomFindings ?? []) {
      lines.push(`外显现象：${item.diagnosisLabel}。`);
    }

    return lines;
  }

  private buildOperatorAdvice(conclusion: any, findings: any[]): string[] {
    const merged = [
      ...(conclusion.topFinding?.suggestions ?? []),
      ...(conclusion.supportingFindings ?? []).flatMap((f) => f.suggestions ?? []),
      ...(conclusion.symptomFindings ?? []).flatMap((f) => f.suggestions ?? []),
      ...(conclusion.repairHints ?? []),
    ];

    return [...new Set(merged)].slice(0, 5);
  }
}
```

---

# 6. 我建议你下一步做什么

你现在这套测试链已经很完整了：

- `RuleEngineService`
- `RankingService`
- `DiagnosisConclusionService`
- `DiagnosisQueryService`
- `DominoChainBuilder`
- `ExplanationBuilder`

下一步最值钱的是二选一：

---

## 方案 A：直接进入代码骨架落地
我可以直接给你一套 **NestJS diagnosis 模块完整目录 + 文件骨架**，包含：

- application services
- domain services
- builders
- dto
- models
- repository interface
- controller
- spec 示例

这个最适合你现在从方案进入实现。

---

## 方案 B：补 OpenAPI + DTO + Result JSON 全链路对齐
我可以把以下三件事一次性对齐：

- `DiagnosisResultResponseDto`
- 结果 JSON 示例
- Swagger/OpenAPI 定义

这样前后端接口就能直接约定。

---

如果按你当前节奏，我建议下一步直接做：  
**Diagnosis 模块完整 NestJS 目录骨架 + 文件清单**。