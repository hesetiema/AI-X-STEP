下面直接给你 **所有 rule 文件对应的 Jest 单测 stub**。  
目标：

- **每条规则一个 spec 文件**
- **NestJS/Jest 工程可直接复制**
- 测试粒度聚焦在 `evaluate(context)` 行为
- 每个 spec 至少覆盖：
  - 命中
  - 不命中

我默认你的测试目录放在：

```bash
src/modules/diagnosis/__tests__/rules/
```

如果你更喜欢“测试文件和源码同目录”，可以把这些 `.spec.ts` 放到对应 rule 文件旁边，内容不用改。

---

# 1. 目录结构

```bash
src/modules/diagnosis/__tests__/rules/
├── data-source/
│   ├── r101-api-field-missing.rule.spec.ts
│   └── r102-api-binding-path-invalid.rule.spec.ts
├── state-binding/
│   ├── r103-request-success-state-not-updated.rule.spec.ts
│   └── r104-selector-value-missing.rule.spec.ts
├── render-transform/
│   ├── r201-falsy-value-swallowed.rule.spec.ts
│   ├── r202-formatter-output-fallback.rule.spec.ts
│   └── r203-render-output-unexpected.rule.spec.ts
├── dom/
│   ├── r301-dom-hidden.rule.spec.ts
│   └── r302-dom-not-updated.rule.spec.ts
├── interaction/
│   ├── r401-click-handler-not-started.rule.spec.ts
│   └── r402-handler-started-request-not-sent.rule.spec.ts
└── symptom/
    ├── r501-fallback-displayed.rule.spec.ts
    ├── r502-render-dom-gap.rule.spec.ts
    ├── r503-pre-request-gap.rule.spec.ts
    └── r504-insufficient-evidence.rule.spec.ts
```

---

# 2. 一个通用建议：测试上下文构造方式

你会发现每个规则都要构造 `DiagnosisContext`。  
为了不强依赖完整字段，stub 里我统一用：

```ts
const buildContext = (overrides: Partial<DiagnosisContext> = {}): DiagnosisContext =>
  ({
    diagnosisId: 'diag_test',
    mode: 'inspect_diagnosis',
    fallbackTokens: ['--', '-', '暂无', 'N/A', ''],
    evidenceRefs: [],
    ...overrides,
  }) as DiagnosisContext;
```

这样最省事。

---

# 3. data-source

---

## `src/modules/diagnosis/__tests__/rules/data-source/r101-api-field-missing.rule.spec.ts`

```ts
import { R101ApiFieldMissingRule } from '../../../domain/rules/data-source/r101-api-field-missing.rule';
import { DiagnosisContext } from '../../../domain/models/diagnosis-context.model';

describe('R101ApiFieldMissingRule', () => {
  const rule = new R101ApiFieldMissingRule();

  const buildContext = (
    overrides: Partial<DiagnosisContext> = {},
  ): DiagnosisContext =>
    ({
      diagnosisId: 'diag_test',
      mode: 'inspect_diagnosis',
      fallbackTokens: ['--', '-'],
      evidenceRefs: [],
      ...overrides,
    }) as DiagnosisContext;

  it('should match when response is successful but target api field is missing', () => {
    const result = rule.evaluate(
      buildContext({
        responseSuccess: true,
        apiFieldPath: 'response.data.amount',
        apiFieldExists: false,
      }),
    );

    expect(result).not.toBeNull();
    expect(result?.ruleCode).toBe('R101');
  });

  it('should not match when api field exists', () => {
    const result = rule.evaluate(
      buildContext({
        responseSuccess: true,
        apiFieldPath: 'response.data.amount',
        apiFieldExists: true,
      }),
    );

    expect(result).toBeNull();
  });
});
```

---

## `src/modules/diagnosis/__tests__/rules/data-source/r102-api-binding-path-invalid.rule.spec.ts`

```ts
import { R102ApiBindingPathInvalidRule } from '../../../domain/rules/data-source/r102-api-binding-path-invalid.rule';
import { DiagnosisContext } from '../../../domain/models/diagnosis-context.model';

describe('R102ApiBindingPathInvalidRule', () => {
  const rule = new R102ApiBindingPathInvalidRule();

  const buildContext = (
    overrides: Partial<DiagnosisContext> = {},
  ): DiagnosisContext =>
    ({
      diagnosisId: 'diag_test',
      mode: 'inspect_diagnosis',
      fallbackTokens: ['--', '-'],
      evidenceRefs: [],
      ...overrides,
    }) as DiagnosisContext;

  it('should match when api field is missing and downstream binding artifacts exist', () => {
    const result = rule.evaluate(
      buildContext({
        responseSuccess: true,
        apiFieldPath: 'response.data.amount',
        apiFieldExists: false,
        selectorName: 'selectAmount',
      }),
    );

    expect(result).not.toBeNull();
    expect(result?.ruleCode).toBe('R102');
  });

  it('should not match when downstream binding clues do not exist', () => {
    const result = rule.evaluate(
      buildContext({
        responseSuccess: true,
        apiFieldPath: 'response.data.amount',
        apiFieldExists: false,
      }),
    );

    expect(result).toBeNull();
  });
});
```

---

# 4. state-binding

---

## `src/modules/diagnosis/__tests__/rules/state-binding/r103-request-success-state-not-updated.rule.spec.ts`

```ts
import { R103RequestSuccessStateNotUpdatedRule } from '../../../domain/rules/state-binding/r103-request-success-state-not-updated.rule';
import { DiagnosisContext } from '../../../domain/models/diagnosis-context.model';

describe('R103RequestSuccessStateNotUpdatedRule', () => {
  const rule = new R103RequestSuccessStateNotUpdatedRule();

  const buildContext = (
    overrides: Partial<DiagnosisContext> = {},
  ): DiagnosisContext =>
    ({
      diagnosisId: 'diag_test',
      mode: 'inspect_diagnosis',
      fallbackTokens: ['--', '-'],
      evidenceRefs: [],
      ...overrides,
    }) as DiagnosisContext;

  it('should match when request succeeded but state was not updated', () => {
    const result = rule.evaluate(
      buildContext({
        requestSent: true,
        responseSuccess: true,
        storeUpdated: false,
      }),
    );

    expect(result).not.toBeNull();
    expect(result?.ruleCode).toBe('R103');
  });

  it('should not match when state has been updated', () => {
    const result = rule.evaluate(
      buildContext({
        requestSent: true,
        responseSuccess: true,
        storeUpdated: true,
      }),
    );

    expect(result).toBeNull();
  });
});
```

---

## `src/modules/diagnosis/__tests__/rules/state-binding/r104-selector-value-missing.rule.spec.ts`

```ts
import { R104SelectorValueMissingRule } from '../../../domain/rules/state-binding/r104-selector-value-missing.rule';
import { DiagnosisContext } from '../../../domain/models/diagnosis-context.model';

describe('R104SelectorValueMissingRule', () => {
  const rule = new R104SelectorValueMissingRule();

  const buildContext = (
    overrides: Partial<DiagnosisContext> = {},
  ): DiagnosisContext =>
    ({
      diagnosisId: 'diag_test',
      mode: 'inspect_diagnosis',
      fallbackTokens: ['--', '-'],
      evidenceRefs: [],
      ...overrides,
    }) as DiagnosisContext;

  it('should match when store updated but selector returns nil', () => {
    const result = rule.evaluate(
      buildContext({
        storeUpdated: true,
        selectorRan: true,
        selectorValue: undefined,
      }),
    );

    expect(result).not.toBeNull();
    expect(result?.ruleCode).toBe('R104');
  });

  it('should not match when selector returns valid falsy value 0', () => {
    const result = rule.evaluate(
      buildContext({
        storeUpdated: true,
        selectorRan: true,
        selectorValue: 0,
      }),
    );

    expect(result).toBeNull();
  });
});
```

---

# 5. render-transform

---

## `src/modules/diagnosis/__tests__/rules/render-transform/r201-falsy-value-swallowed.rule.spec.ts`

```ts
import { R201FalsyValueSwallowedRule } from '../../../domain/rules/render-transform/r201-falsy-value-swallowed.rule';
import { DiagnosisContext } from '../../../domain/models/diagnosis-context.model';

describe('R201FalsyValueSwallowedRule', () => {
  const rule = new R201FalsyValueSwallowedRule();

  const buildContext = (
    overrides: Partial<DiagnosisContext> = {},
  ): DiagnosisContext =>
    ({
      diagnosisId: 'diag_test',
      mode: 'inspect_diagnosis',
      fallbackTokens: ['--', '-', '暂无'],
      evidenceRefs: [],
      ...overrides,
    }) as DiagnosisContext;

  it('should match when valid falsy upstream value becomes fallback output', () => {
    const result = rule.evaluate(
      buildContext({
        apiValue: 0,
        renderOutputValue: '--',
      }),
    );

    expect(result).not.toBeNull();
    expect(result?.ruleCode).toBe('R201');
  });

  it('should not match when upstream value is normal non-falsy value', () => {
    const result = rule.evaluate(
      buildContext({
        apiValue: 100,
        renderOutputValue: '100',
      }),
    );

    expect(result).toBeNull();
  });
});
```

---

## `src/modules/diagnosis/__tests__/rules/render-transform/r202-formatter-output-fallback.rule.spec.ts`

```ts
import { R202FormatterOutputFallbackRule } from '../../../domain/rules/render-transform/r202-formatter-output-fallback.rule';
import { DiagnosisContext } from '../../../domain/models/diagnosis-context.model';

describe('R202FormatterOutputFallbackRule', () => {
  const rule = new R202FormatterOutputFallbackRule();

  const buildContext = (
    overrides: Partial<DiagnosisContext> = {},
  ): DiagnosisContext =>
    ({
      diagnosisId: 'diag_test',
      mode: 'inspect_diagnosis',
      fallbackTokens: ['--', '-'],
      evidenceRefs: [],
      ...overrides,
    }) as DiagnosisContext;

  it('should match when render triggered and formatter output is fallback', () => {
    const result = rule.evaluate(
      buildContext({
        renderTriggered: true,
        renderInputValue: 12,
        renderOutputValue: '--',
      }),
    );

    expect(result).not.toBeNull();
    expect(result?.ruleCode).toBe('R202');
  });

  it('should not match when render input is nil', () => {
    const result = rule.evaluate(
      buildContext({
        renderTriggered: true,
        renderInputValue: undefined,
        renderOutputValue: '--',
      }),
    );

    expect(result).toBeNull();
  });
});
```

---

## `src/modules/diagnosis/__tests__/rules/render-transform/r203-render-output-unexpected.rule.spec.ts`

```ts
import { R203RenderOutputUnexpectedRule } from '../../../domain/rules/render-transform/r203-render-output-unexpected.rule';
import { DiagnosisContext } from '../../../domain/models/diagnosis-context.model';

describe('R203RenderOutputUnexpectedRule', () => {
  const rule = new R203RenderOutputUnexpectedRule();

  const buildContext = (
    overrides: Partial<DiagnosisContext> = {},
  ): DiagnosisContext =>
    ({
      diagnosisId: 'diag_test',
      mode: 'inspect_diagnosis',
      fallbackTokens: ['--', '-'],
      evidenceRefs: [],
      ...overrides,
    }) as DiagnosisContext;

  it('should match when render input and output differ unexpectedly', () => {
    const result = rule.evaluate(
      buildContext({
        renderTriggered: true,
        renderInputValue: '100',
        renderOutputValue: '100元整',
        formatterOutputIsFallback: false,
      }),
    );

    expect(result).not.toBeNull();
    expect(result?.ruleCode).toBe('R203');
  });

  it('should not match when output is fallback placeholder', () => {
    const result = rule.evaluate(
      buildContext({
        renderTriggered: true,
        renderInputValue: '100',
        renderOutputValue: '--',
        formatterOutputIsFallback: false,
      }),
    );

    expect(result).toBeNull();
  });
});
```

---

# 6. dom

---

## `src/modules/diagnosis/__tests__/rules/dom/r301-dom-hidden.rule.spec.ts`

```ts
import { R301DomHiddenRule } from '../../../domain/rules/dom/r301-dom-hidden.rule';
import { DiagnosisContext } from '../../../domain/models/diagnosis-context.model';

describe('R301DomHiddenRule', () => {
  const rule = new R301DomHiddenRule();

  const buildContext = (
    overrides: Partial<DiagnosisContext> = {},
  ): DiagnosisContext =>
    ({
      diagnosisId: 'diag_test',
      mode: 'inspect_diagnosis',
      fallbackTokens: ['--'],
      evidenceRefs: [],
      ...overrides,
    }) as DiagnosisContext;

  it('should match when dom updated but not visible', () => {
    const result = rule.evaluate(
      buildContext({
        domUpdated: true,
        domVisible: false,
      }),
    );

    expect(result).not.toBeNull();
    expect(result?.ruleCode).toBe('R301');
  });

  it('should not match when dom is visible', () => {
    const result = rule.evaluate(
      buildContext({
        domUpdated: true,
        domVisible: true,
      }),
    );

    expect(result).toBeNull();
  });
});
```

---

## `src/modules/diagnosis/__tests__/rules/dom/r302-dom-not-updated.rule.spec.ts`

```ts
import { R302DomNotUpdatedRule } from '../../../domain/rules/dom/r302-dom-not-updated.rule';
import { DiagnosisContext } from '../../../domain/models/diagnosis-context.model';

describe('R302DomNotUpdatedRule', () => {
  const rule = new R302DomNotUpdatedRule();

  const buildContext = (
    overrides: Partial<DiagnosisContext> = {},
  ): DiagnosisContext =>
    ({
      diagnosisId: 'diag_test',
      mode: 'inspect_diagnosis',
      fallbackTokens: ['--'],
      evidenceRefs: [],
      ...overrides,
    }) as DiagnosisContext;

  it('should match when render triggered but dom not updated', () => {
    const result = rule.evaluate(
      buildContext({
        renderTriggered: true,
        domUpdated: false,
      }),
    );

    expect(result).not.toBeNull();
    expect(result?.ruleCode).toBe('R302');
  });

  it('should not match when render output and dom value are consistent', () => {
    const result = rule.evaluate(
      buildContext({
        renderTriggered: true,
        domUpdated: true,
        renderOutputValue: '100',
        domValue: '100',
      }),
    );

    expect(result).toBeNull();
  });
});
```

---

# 7. interaction

---

## `src/modules/diagnosis/__tests__/rules/interaction/r401-click-handler-not-started.rule.spec.ts`

```ts
import { R401ClickHandlerNotStartedRule } from '../../../domain/rules/interaction/r401-click-handler-not-started.rule';
import { DiagnosisContext } from '../../../domain/models/diagnosis-context.model';

describe('R401ClickHandlerNotStartedRule', () => {
  const rule = new R401ClickHandlerNotStartedRule();

  const buildContext = (
    overrides: Partial<DiagnosisContext> = {},
  ): DiagnosisContext =>
    ({
      diagnosisId: 'diag_test',
      mode: 'click_diagnosis',
      fallbackTokens: ['--'],
      evidenceRefs: [],
      ...overrides,
    }) as DiagnosisContext;

  it('should match when click detected but handler not started', () => {
    const result = rule.evaluate(
      buildContext({
        clickDetected: true,
        handlerStarted: false,
      }),
    );

    expect(result).not.toBeNull();
    expect(result?.ruleCode).toBe('R401');
  });

  it('should not match in non-click mode', () => {
    const result = rule.evaluate(
      buildContext({
        mode: 'inspect_diagnosis',
        clickDetected: true,
        handlerStarted: false,
      }),
    );

    expect(result).toBeNull();
  });
});
```

---

## `src/modules/diagnosis/__tests__/rules/interaction/r402-handler-started-request-not-sent.rule.spec.ts`

```ts
import { R402HandlerStartedRequestNotSentRule } from '../../../domain/rules/interaction/r402-handler-started-request-not-sent.rule';
import { DiagnosisContext } from '../../../domain/models/diagnosis-context.model';

describe('R402HandlerStartedRequestNotSentRule', () => {
  const rule = new R402HandlerStartedRequestNotSentRule();

  const buildContext = (
    overrides: Partial<DiagnosisContext> = {},
  ): DiagnosisContext =>
    ({
      diagnosisId: 'diag_test',
      mode: 'click_diagnosis',
      fallbackTokens: ['--'],
      evidenceRefs: [],
      ...overrides,
    }) as DiagnosisContext;

  it('should match when handler started but request was not sent', () => {
    const result = rule.evaluate(
      buildContext({
        handlerStarted: true,
        requestSent: false,
      }),
    );

    expect(result).not.toBeNull();
    expect(result?.ruleCode).toBe('R402');
  });

  it('should not match when request was sent', () => {
    const result = rule.evaluate(
      buildContext({
        handlerStarted: true,
        requestSent: true,
      }),
    );

    expect(result).toBeNull();
  });
});
```

---

# 8. symptom

---

## `src/modules/diagnosis/__tests__/rules/symptom/r501-fallback-displayed.rule.spec.ts`

```ts
import { R501FallbackDisplayedRule } from '../../../domain/rules/symptom/r501-fallback-displayed.rule';
import { DiagnosisContext } from '../../../domain/models/diagnosis-context.model';

describe('R501FallbackDisplayedRule', () => {
  const rule = new R501FallbackDisplayedRule();

  const buildContext = (
    overrides: Partial<DiagnosisContext> = {},
  ): DiagnosisContext =>
    ({
      diagnosisId: 'diag_test',
      mode: 'inspect_diagnosis',
      fallbackTokens: ['--', '-'],
      evidenceRefs: [],
      ...overrides,
    }) as DiagnosisContext;

  it('should match when dom displays fallback value', () => {
    const result = rule.evaluate(
      buildContext({
        domValue: '--',
      }),
    );

    expect(result).not.toBeNull();
    expect(result?.ruleCode).toBe('R501');
    expect(result?.isSymptomOnly).toBe(true);
  });

  it('should not match when displayed value is normal', () => {
    const result = rule.evaluate(
      buildContext({
        domValue: '100',
        displayedValue: '100',
      }),
    );

    expect(result).toBeNull();
  });
});
```

---

## `src/modules/diagnosis/__tests__/rules/symptom/r502-render-dom-gap.rule.spec.ts`

```ts
import { R502RenderDomGapRule } from '../../../domain/rules/symptom/r502-render-dom-gap.rule';
import { DiagnosisContext } from '../../../domain/models/diagnosis-context.model';

describe('R502RenderDomGapRule', () => {
  const rule = new R502RenderDomGapRule();

  const buildContext = (
    overrides: Partial<DiagnosisContext> = {},
  ): DiagnosisContext =>
    ({
      diagnosisId: 'diag_test',
      mode: 'inspect_diagnosis',
      fallbackTokens: ['--'],
      evidenceRefs: [],
      ...overrides,
    }) as DiagnosisContext;

  it('should match when render committed but dom not updated', () => {
    const result = rule.evaluate(
      buildContext({
        renderTriggered: true,
        renderCommitted: true,
        domUpdated: false,
      }),
    );

    expect(result).not.toBeNull();
    expect(result?.ruleCode).toBe('R502');
    expect(result?.isSymptomOnly).toBe(true);
  });

  it('should not match when dom is updated', () => {
    const result = rule.evaluate(
      buildContext({
        renderTriggered: true,
        renderCommitted: true,
        domUpdated: true,
      }),
    );

    expect(result).toBeNull();
  });
});
```

---

## `src/modules/diagnosis/__tests__/rules/symptom/r503-pre-request-gap.rule.spec.ts`

```ts
import { R503PreRequestGapRule } from '../../../domain/rules/symptom/r503-pre-request-gap.rule';
import { DiagnosisContext } from '../../../domain/models/diagnosis-context.model';

describe('R503PreRequestGapRule', () => {
  const rule = new R503PreRequestGapRule();

  const buildContext = (
    overrides: Partial<DiagnosisContext> = {},
  ): DiagnosisContext =>
    ({
      diagnosisId: 'diag_test',
      mode: 'click_diagnosis',
      fallbackTokens: ['--'],
      evidenceRefs: [],
      ...overrides,
    }) as DiagnosisContext;

  it('should match when click detected but request not sent', () => {
    const result = rule.evaluate(
      buildContext({
        clickDetected: true,
        requestSent: false,
      }),
    );

    expect(result).not.toBeNull();
    expect(result?.ruleCode).toBe('R503');
    expect(result?.isSymptomOnly).toBe(true);
  });

  it('should not match when request has been sent', () => {
    const result = rule.evaluate(
      buildContext({
        clickDetected: true,
        requestSent: true,
      }),
    );

    expect(result).toBeNull();
  });
});
```

---

## `src/modules/diagnosis/__tests__/rules/symptom/r504-insufficient-evidence.rule.spec.ts`

```ts
import { R504InsufficientEvidenceRule } from '../../../domain/rules/symptom/r504-insufficient-evidence.rule';
import { DiagnosisContext } from '../../../domain/models/diagnosis-context.model';

describe('R504InsufficientEvidenceRule', () => {
  const rule = new R504InsufficientEvidenceRule();

  const buildContext = (
    overrides: Partial<DiagnosisContext> = {},
  ): DiagnosisContext =>
    ({
      diagnosisId: 'diag_test',
      mode: 'inspect_diagnosis',
      fallbackTokens: ['--'],
      evidenceRefs: [],
      ...overrides,
    }) as DiagnosisContext;

  it('should match when fallback symptom exists but upstream evidence is insufficient', () => {
    const result = rule.evaluate(
      buildContext({
        domValue: '--',
        responseSuccess: false,
        storeUpdated: false,
        renderTriggered: false,
      }),
    );

    expect(result).not.toBeNull();
    expect(result?.ruleCode).toBe('R504');
    expect(result?.isSymptomOnly).toBe(true);
  });

  it('should not match when upstream render evidence exists', () => {
    const result = rule.evaluate(
      buildContext({
        domValue: '--',
        responseSuccess: false,
        storeUpdated: false,
        renderTriggered: true,
      }),
    );

    expect(result).toBeNull();
  });
});
```

---

# 9. 建议你顺手再补一个测试辅助文件

虽然不是必须，但我非常建议你把 `buildContext` 提成一个共享 helper，否则后面 rule 一多会很重复。

比如建一个：

```bash
src/modules/diagnosis/__tests__/helpers/build-diagnosis-context.ts
```

---

## `src/modules/diagnosis/__tests__/helpers/build-diagnosis-context.ts`

```ts
import { DiagnosisContext } from '../../domain/models/diagnosis-context.model';

export function buildDiagnosisContext(
  overrides: Partial<DiagnosisContext> = {},
): DiagnosisContext {
  return {
    diagnosisId: 'diag_test',
    mode: 'inspect_diagnosis',
    fallbackTokens: ['--', '-', '暂无', 'N/A', ''],
    evidenceRefs: [],
    ...overrides,
  } as DiagnosisContext;
}
```

然后每个 spec 就能简化成：

```ts
import { buildDiagnosisContext } from '../../helpers/build-diagnosis-context';
```

这样更适合你后面继续扩测试。

---

# 10. 一些很重要的测试注意点

---

## 10.1 `R201 / R104` 要特别防止把 `0`、`false` 判错
这两个规则最容易把“合法 falsy 值”测错，所以你已经至少该保留这两类 case：

- `0` 应该是有效值
- `false` 应该是有效值

你现在 stub 里已经覆盖了 `0`，后面建议再补一个 `false`。

---

## 10.2 `R203` 的断言有业务歧义
当前 rule 的定义是：

- 输入输出不一致
- 且不是 fallback

这个规则其实会把“合理格式化”也判进去，比如：
- `100` -> `100元整`

所以如果你后面觉得这个规则太宽，需要再细化：
- 有 `formatterName` 且结果符合 formatter 预期时不命中
- 或者引入 `expectedRenderOutput`

这个问题在单测里先不改 stub，但你后续要注意。

---

## 10.3 `R102` 和 `R101` 是允许重叠命中的
这是你前面已经定下来的策略，所以测试不应该要求“R102 命中时 R101 不命中”。  
单测只测“本规则是否命中自己的条件”，不要把它写成互斥规则测试。

---

# 11. 下一步最推荐你继续补什么

现在你已经有了：

- rule 独立文件
- registry
- 每条 rule 的 spec stub

下一个最自然的动作是：

### A. `RuleEngineService` 的 Jest 单测升级版
验证：
- registry 全规则执行
- 多规则同时命中
- dedupe 行为

### B. `DiagnosisRuleRegistry` 按 inspect/click 过滤版
让 click 场景不跑 inspect-only 规则

### C. 一次性把这些 spec 变成“可直接通过”的版本
包括：
- import 路径校正
- ts-jest 配置建议
- `package.json` test script

---

如果按你现在工程推进顺序，我建议下一条直接做：  
**A. RuleEngineService 的 Jest 单测升级版**。