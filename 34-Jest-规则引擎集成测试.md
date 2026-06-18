下面直接给你 **`RuleEngineService + 真实规则集` 的集成测试 stub**。  
目标不是测 mock 行为，而是测：

- 注入 **真实 rule class**
- 通过 **真实 `DiagnosisRuleRegistry`**
- 最后由 **真实 `RuleEngineService`** 执行
- 验证一个 context 下会命中哪些规则、不会命中哪些规则

这类测试很适合防止你后面改某条规则时，把整体规则组合行为搞偏。

---

# 1. 推荐文件位置

```bash
src/modules/diagnosis/__tests__/integration/rule-engine.integration.spec.ts
```

---

# 2. 完整集成测试 stub

## `src/modules/diagnosis/__tests__/integration/rule-engine.integration.spec.ts`

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { RuleEngineService } from '../../domain/services/rule-engine.service';
import { DiagnosisRuleRegistry } from '../../domain/rules/registry/diagnosis-rule.registry';
import { DiagnosisContext } from '../../domain/models/diagnosis-context.model';

import { R101ApiFieldMissingRule } from '../../domain/rules/data-source/r101-api-field-missing.rule';
import { R102ApiBindingPathInvalidRule } from '../../domain/rules/data-source/r102-api-binding-path-invalid.rule';
import { R103RequestSuccessStateNotUpdatedRule } from '../../domain/rules/state-binding/r103-request-success-state-not-updated.rule';
import { R104SelectorValueMissingRule } from '../../domain/rules/state-binding/r104-selector-value-missing.rule';
import { R201FalsyValueSwallowedRule } from '../../domain/rules/render-transform/r201-falsy-value-swallowed.rule';
import { R202FormatterOutputFallbackRule } from '../../domain/rules/render-transform/r202-formatter-output-fallback.rule';
import { R203RenderOutputUnexpectedRule } from '../../domain/rules/render-transform/r203-render-output-unexpected.rule';
import { R301DomHiddenRule } from '../../domain/rules/dom/r301-dom-hidden.rule';
import { R302DomNotUpdatedRule } from '../../domain/rules/dom/r302-dom-not-updated.rule';
import { R401ClickHandlerNotStartedRule } from '../../domain/rules/interaction/r401-click-handler-not-started.rule';
import { R402HandlerStartedRequestNotSentRule } from '../../domain/rules/interaction/r402-handler-started-request-not-sent.rule';
import { R501FallbackDisplayedRule } from '../../domain/rules/symptom/r501-fallback-displayed.rule';
import { R502RenderDomGapRule } from '../../domain/rules/symptom/r502-render-dom-gap.rule';
import { R503PreRequestGapRule } from '../../domain/rules/symptom/r503-pre-request-gap.rule';
import { R504InsufficientEvidenceRule } from '../../domain/rules/symptom/r504-insufficient-evidence.rule';

describe('RuleEngineService Integration', () => {
  let service: RuleEngineService;

  const buildContext = (
    overrides: Partial<DiagnosisContext> = {},
  ): DiagnosisContext =>
    ({
      diagnosisId: 'diag_integration_test',
      mode: 'inspect_diagnosis',
      fallbackTokens: ['--', '-', '暂无', 'N/A', ''],
      evidenceRefs: [],
      ...overrides,
    }) as DiagnosisContext;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RuleEngineService,
        DiagnosisRuleRegistry,

        R101ApiFieldMissingRule,
        R102ApiBindingPathInvalidRule,
        R103RequestSuccessStateNotUpdatedRule,
        R104SelectorValueMissingRule,
        R201FalsyValueSwallowedRule,
        R202FormatterOutputFallbackRule,
        R203RenderOutputUnexpectedRule,
        R301DomHiddenRule,
        R302DomNotUpdatedRule,
        R401ClickHandlerNotStartedRule,
        R402HandlerStartedRequestNotSentRule,
        R501FallbackDisplayedRule,
        R502RenderDomGapRule,
        R503PreRequestGapRule,
        R504InsufficientEvidenceRule,
      ],
    }).compile();

    service = module.get(RuleEngineService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should match R101 and R102 together when api field is missing and downstream binding exists', () => {
    const context = buildContext({
      responseSuccess: true,
      apiFieldPath: 'response.data.amount',
      apiFieldExists: false,
      selectorName: 'selectAmount',
    });

    const result = service.run(context);
    const codes = result.map((item) => item.ruleCode);

    expect(codes).toContain('R101');
    expect(codes).toContain('R102');
  });

  it('should match R201, R202 and R501 together in falsy swallowed + fallback displayed scenario', () => {
    const context = buildContext({
      responseSuccess: true,
      apiFieldPath: 'response.data.amount',
      apiFieldExists: true,
      apiValue: 0,
      storeUpdated: true,
      storeValue: 0,
      selectorRan: true,
      selectorValue: 0,
      renderTriggered: true,
      renderCommitted: true,
      renderInputValue: 0,
      renderOutputValue: '--',
      formatterOutputIsFallback: true,
      domUpdated: true,
      domVisible: true,
      domValue: '--',
      displayedValue: '--',
    });

    const result = service.run(context);
    const codes = result.map((item) => item.ruleCode);

    expect(codes).toContain('R201');
    expect(codes).toContain('R202');
    expect(codes).toContain('R501');
  });

  it('should match R103 when request succeeded but store was not updated', () => {
    const context = buildContext({
      requestSent: true,
      responseSuccess: true,
      storeUpdated: false,
    });

    const result = service.run(context);
    const codes = result.map((item) => item.ruleCode);

    expect(codes).toContain('R103');
  });

  it('should match R104 when selector returns nil after store update', () => {
    const context = buildContext({
      storeUpdated: true,
      selectorRan: true,
      selectorValue: undefined,
    });

    const result = service.run(context);
    const codes = result.map((item) => item.ruleCode);

    expect(codes).toContain('R104');
  });

  it('should match R301 when dom updated but hidden', () => {
    const context = buildContext({
      domUpdated: true,
      domVisible: false,
    });

    const result = service.run(context);
    const codes = result.map((item) => item.ruleCode);

    expect(codes).toContain('R301');
  });

  it('should match R302 and R502 together when render committed but dom not updated', () => {
    const context = buildContext({
      renderTriggered: true,
      renderCommitted: true,
      renderOutputValue: '100',
      domUpdated: false,
      domValue: '--',
    });

    const result = service.run(context);
    const codes = result.map((item) => item.ruleCode);

    expect(codes).toContain('R302');
    expect(codes).toContain('R502');
  });

  it('should match R401 and R503 together in click flow when handler never starts and request is not sent', () => {
    const context = buildContext({
      mode: 'click_diagnosis',
      clickDetected: true,
      handlerStarted: false,
      requestSent: false,
    });

    const result = service.run(context);
    const codes = result.map((item) => item.ruleCode);

    expect(codes).toContain('R401');
    expect(codes).toContain('R503');
  });

  it('should match R402 when handler started but request not sent', () => {
    const context = buildContext({
      mode: 'click_diagnosis',
      clickDetected: true,
      handlerStarted: true,
      requestSent: false,
    });

    const result = service.run(context);
    const codes = result.map((item) => item.ruleCode);

    expect(codes).toContain('R402');
  });

  it('should match R504 when only fallback symptom exists and upstream evidence is insufficient', () => {
    const context = buildContext({
      domValue: '--',
      displayedValue: '--',
      responseSuccess: false,
      storeUpdated: false,
      renderTriggered: false,
    });

    const result = service.run(context);
    const codes = result.map((item) => item.ruleCode);

    expect(codes).toContain('R504');
  });

  it('should not match click-only rules in inspect mode', () => {
    const context = buildContext({
      mode: 'inspect_diagnosis',
      clickDetected: true,
      handlerStarted: false,
      requestSent: false,
    });

    const result = service.run(context);
    const codes = result.map((item) => item.ruleCode);

    expect(codes).not.toContain('R401');
    expect(codes).not.toContain('R503');
  });

  it('should not match any root-cause rule in a fully healthy flow', () => {
    const context = buildContext({
      responseSuccess: true,
      apiFieldPath: 'response.data.amount',
      apiFieldExists: true,
      apiValue: 100,
      storeUpdated: true,
      storeValue: 100,
      selectorRan: true,
      selectorValue: 100,
      renderTriggered: true,
      renderCommitted: true,
      renderInputValue: 100,
      renderOutputValue: '100',
      formatterOutputIsFallback: false,
      domUpdated: true,
      domVisible: true,
      domValue: '100',
      displayedValue: '100',
      requestSent: true,
    });

    const result = service.run(context);
    const rootCauseCodes = result
      .filter((item) => !item.isSymptomOnly)
      .map((item) => item.ruleCode);

    expect(rootCauseCodes).toEqual([]);
  });
});
```

---

# 3. 这版集成测试覆盖了什么

这组测试不是在测单条 rule 细节，而是在测 **真实规则集组合行为**。

---

## 3.1 允许多规则重叠命中
比如：

- `R101 + R102`
- `R201 + R202 + R501`
- `R302 + R502`
- `R401 + R503`

这正好验证你前面已经定下来的策略：  
**规则引擎偏召回优先，不做过早互斥。**

---

## 3.2 检查场景边界
比如：

```ts
should not match click-only rules in inspect mode
```

这条很重要。  
虽然你现在 registry 还没按 mode 过滤，但 rule 自身已经做了模式判断，所以这条测试能帮你锁住这个行为。

---

## 3.3 检查健康流不误报
```ts
should not match any root-cause rule in a fully healthy flow
```

这条是最像“回归保护”的测试。  
后面你调规则条件时，这条很容易救命。

---

# 4. 我建议你顺手再加两个“更有价值”的断言

如果你想把这份 integration spec 再升级一点，我建议加下面两类断言。

---

## 4.1 断言 symptom / root cause 分类
例如在 `R201 + R202 + R501` 场景下：

```ts
const symptomCodes = result.filter(x => x.isSymptomOnly).map(x => x.ruleCode);
const rootCauseCodes = result.filter(x => !x.isSymptomOnly).map(x => x.ruleCode);

expect(rootCauseCodes).toEqual(expect.arrayContaining(['R201', 'R202']));
expect(symptomCodes).toEqual(expect.arrayContaining(['R501']));
```

这样可以同时保护你的“根因 / 症状分层”。

---

## 4.2 断言 layer 分布
比如 `R401 + R503` 场景可以断言：

```ts
expect(result.find(x => x.ruleCode === 'R401')?.layer).toBe('handler');
expect(result.find(x => x.ruleCode === 'R503')?.layer).toBe('request_to_ui');
```

这能防止后面有人把 layer 改乱，影响 Ranking 和 DominoChain。

---

# 5. 如果你想要更工程化，我建议再拆两个集成测试文件

当前这个文件已经够用，但再往前走，我建议你后面拆成：

---

## `rule-engine.inspect.integration.spec.ts`
专门测 inspect 链：
- R101
- R102
- R103
- R104
- R201
- R202
- R203
- R301
- R302
- R501
- R502
- R504

---

## `rule-engine.click.integration.spec.ts`
专门测 click 链：
- R401
- R402
- R503
- 再覆盖共通 symptom

这样会比一个超大 spec 文件更清晰。

---

# 6. 一个现实提醒：你现在这份集成测试可能会受“规则重叠扩张”影响

例如这个 case：

```ts
R201 + R202 + R501
```

未来你如果把 R203 或 R302 条件放宽，可能这个场景还会额外命中别的规则。  
所以当前断言我故意写成：

```ts
expect(codes).toContain(...)
```

而不是：

```ts
expect(codes).toEqual([...])
```

这是刻意保留“规则召回可扩展性”。

---

# 7. 下一步最推荐继续补什么

你现在已经有：

- 单条 rule unit test
- RuleEngineService unit test
- RuleEngineService + 真实规则集 integration test

下一步最自然的是以下三选一：

### A. `DiagnosisRuleRegistry` 的单测
验证返回顺序与完整性

### B. `RankingService` 的升级版集成测试
验证：
- 根因优先
- symptom 降权
- cluster 去重
- 上游优先

### C. `DiagnosisConclusionService` 的集成测试
验证：
- topFinding
- supportingFindings
- symptomFindings
- diagnosisState
- repairHints

---

如果按工程价值排序，我建议你下一条直接做：  
**B. RankingService 的升级版 Jest / 集成测试**。