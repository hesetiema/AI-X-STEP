下面直接给你 **`createDiagnosisContext` fixture helper + 15 个 rule spec 全部改为复用 helper 的重构版**。  
目标：

- 去掉每个 spec 里重复的大段 `createContext`
- 统一默认上下文
- 每个规则只覆盖自己关心的 override
- 后面扩规则 / 改 `DiagnosisContext` 字段时，只改一处

我按你当前工程风格给出：

1. helper 文件
2. 15 个 spec 重构版
3. 可选的 barrel export
4. 使用建议

---

# 1. fixture helper 文件

## 推荐路径

```bash
src/modules/diagnosis/test/fixtures/create-diagnosis-context.fixture.ts
```

---

## `src/modules/diagnosis/test/fixtures/create-diagnosis-context.fixture.ts`

```ts
import { DiagnosisContext } from '../../domain/models/diagnosis-context.model';

export function createDiagnosisContext(
  override: Partial<DiagnosisContext> = {},
): DiagnosisContext {
  return {
    diagnosisId: 'diag_test',
    mode: 'inspect_diagnosis',

    fallbackTokens: ['--', '-', '暂无', 'N/A', ''],
    evidenceRefs: [],

    clickDetected: false,
    handlerStarted: false,
    requestSent: false,

    responseSuccess: false,
    apiFieldPath: 'response.data.value',
    apiFieldExists: false,
    apiValue: undefined,

    storeUpdated: false,
    storeValue: undefined,

    selectorName: 'testSelector',
    selectorRan: false,
    selectorValue: undefined,

    renderTriggered: false,
    renderCommitted: false,
    renderInputValue: undefined,
    renderOutputValue: undefined,
    formatterOutputIsFallback: false,

    domUpdated: false,
    domVisible: false,
    domValue: undefined,

    displayedValue: undefined,

    ...override,
  };
}
```

---

# 2. 15 个 rule spec 重构版

下面默认测试目录仍是：

```bash
src/modules/diagnosis/domain/rules/__tests__/
```

helper 引用路径统一为：

```ts
import { createDiagnosisContext } from '../../../test/fixtures/create-diagnosis-context.fixture';
```

---

## 2.1 `r101-api-field-missing.rule.spec.ts`

```ts
import { R101ApiFieldMissingRule } from '../r101-api-field-missing.rule';
import { createDiagnosisContext } from '../../../test/fixtures/create-diagnosis-context.fixture';

describe('R101ApiFieldMissingRule', () => {
  const rule = new R101ApiFieldMissingRule();

  it('should return finding when response succeeds but target field is missing', () => {
    const result = rule.evaluate(
      createDiagnosisContext({
        responseSuccess: true,
        apiFieldExists: false,
        apiFieldPath: 'response.data.amount',
      }),
    );

    expect(result).toBeTruthy();
    expect(result?.ruleCode).toBe('R101');
    expect(result?.layer).toBe('api');
    expect(result?.cluster).toBe('api_field_missing');
    expect(result?.isSymptomOnly).toBe(false);
  });

  it('should return null when response is not successful', () => {
    const result = rule.evaluate(
      createDiagnosisContext({
        responseSuccess: false,
        apiFieldExists: false,
      }),
    );

    expect(result).toBeNull();
  });

  it('should return null when field exists', () => {
    const result = rule.evaluate(
      createDiagnosisContext({
        responseSuccess: true,
        apiFieldExists: true,
        apiValue: 123,
      }),
    );

    expect(result).toBeNull();
  });
});
```

---

## 2.2 `r102-api-null-value.rule.spec.ts`

```ts
import { R102ApiNullValueRule } from '../r102-api-null-value.rule';
import { createDiagnosisContext } from '../../../test/fixtures/create-diagnosis-context.fixture';

describe('R102ApiNullValueRule', () => {
  const rule = new R102ApiNullValueRule();

  it('should return finding when api field exists but value is nullish', () => {
    const result = rule.evaluate(
      createDiagnosisContext({
        responseSuccess: true,
        apiFieldExists: true,
        apiValue: null,
      }),
    );

    expect(result).toBeTruthy();
    expect(result?.ruleCode).toBe('R102');
    expect(result?.layer).toBe('api');
    expect(result?.cluster).toBe('api_null_value');
    expect(result?.isSymptomOnly).toBe(false);
  });

  it('should return null when field does not exist', () => {
    const result = rule.evaluate(
      createDiagnosisContext({
        responseSuccess: true,
        apiFieldExists: false,
        apiValue: null,
      }),
    );

    expect(result).toBeNull();
  });

  it('should return null when api value is meaningful', () => {
    const result = rule.evaluate(
      createDiagnosisContext({
        responseSuccess: true,
        apiFieldExists: true,
        apiValue: 123,
      }),
    );

    expect(result).toBeNull();
  });
});
```

---

## 2.3 `r103-state-not-updated.rule.spec.ts`

```ts
import { R103StateNotUpdatedRule } from '../r103-state-not-updated.rule';
import { createDiagnosisContext } from '../../../test/fixtures/create-diagnosis-context.fixture';

describe('R103StateNotUpdatedRule', () => {
  const rule = new R103StateNotUpdatedRule();

  it('should return finding when api has value but store not updated', () => {
    const result = rule.evaluate(
      createDiagnosisContext({
        responseSuccess: true,
        apiFieldExists: true,
        apiValue: 123,
        storeUpdated: false,
      }),
    );

    expect(result).toBeTruthy();
    expect(result?.ruleCode).toBe('R103');
    expect(result?.layer).toBe('state');
    expect(result?.cluster).toBe('state_not_updated');
    expect(result?.isSymptomOnly).toBe(false);
  });

  it('should return null when store already updated', () => {
    const result = rule.evaluate(
      createDiagnosisContext({
        responseSuccess: true,
        apiFieldExists: true,
        apiValue: 123,
        storeUpdated: true,
      }),
    );

    expect(result).toBeNull();
  });

  it('should return null when api value is nullish', () => {
    const result = rule.evaluate(
      createDiagnosisContext({
        responseSuccess: true,
        apiFieldExists: true,
        apiValue: null,
        storeUpdated: false,
      }),
    );

    expect(result).toBeNull();
  });
});
```

---

## 2.4 `r104-selector-not-ran.rule.spec.ts`

```ts
import { R104SelectorNotRanRule } from '../r104-selector-not-ran.rule';
import { createDiagnosisContext } from '../../../test/fixtures/create-diagnosis-context.fixture';

describe('R104SelectorNotRanRule', () => {
  const rule = new R104SelectorNotRanRule();

  it('should return finding when state updated but selector not ran', () => {
    const result = rule.evaluate(
      createDiagnosisContext({
        storeUpdated: true,
        storeValue: 123,
        selectorName: 'priceSelector',
        selectorRan: false,
      }),
    );

    expect(result).toBeTruthy();
    expect(result?.ruleCode).toBe('R104');
    expect(result?.layer).toBe('selector');
    expect(result?.cluster).toBe('selector_not_ran');
    expect(result?.isSymptomOnly).toBe(false);
  });

  it('should return null when selector already ran', () => {
    const result = rule.evaluate(
      createDiagnosisContext({
        storeUpdated: true,
        selectorRan: true,
        selectorValue: 123,
      }),
    );

    expect(result).toBeNull();
  });

  it('should return null when store not updated', () => {
    const result = rule.evaluate(
      createDiagnosisContext({
        storeUpdated: false,
        selectorRan: false,
      }),
    );

    expect(result).toBeNull();
  });
});
```

---

## 2.5 `r201-falsy-swallowed.rule.spec.ts`

```ts
import { R201FalsySwallowedRule } from '../r201-falsy-swallowed.rule';
import { createDiagnosisContext } from '../../../test/fixtures/create-diagnosis-context.fixture';

describe('R201FalsySwallowedRule', () => {
  const rule = new R201FalsySwallowedRule();

  it('should return finding when meaningful falsy value is swallowed before render', () => {
    const result = rule.evaluate(
      createDiagnosisContext({
        storeUpdated: true,
        selectorRan: true,
        selectorValue: 0,
        renderTriggered: true,
        renderInputValue: '--',
        renderOutputValue: '--',
        displayedValue: '--',
      }),
    );

    expect(result).toBeTruthy();
    expect(result?.ruleCode).toBe('R201');
    expect(result?.layer).toBe('render');
    expect(result?.cluster).toBe('falsy_swallowed');
    expect(result?.isSymptomOnly).toBe(false);
  });

  it('should return null when selector did not run', () => {
    const result = rule.evaluate(
      createDiagnosisContext({
        selectorRan: false,
        selectorValue: 0,
        renderInputValue: '--',
      }),
    );

    expect(result).toBeNull();
  });

  it('should return null when render input keeps original falsy value', () => {
    const result = rule.evaluate(
      createDiagnosisContext({
        selectorRan: true,
        selectorValue: 0,
        renderInputValue: 0,
      }),
    );

    expect(result).toBeNull();
  });
});
```

---

## 2.6 `r202-formatter-fallback.rule.spec.ts`

```ts
import { R202FormatterFallbackRule } from '../r202-formatter-fallback.rule';
import { createDiagnosisContext } from '../../../test/fixtures/create-diagnosis-context.fixture';

describe('R202FormatterFallbackRule', () => {
  const rule = new R202FormatterFallbackRule();

  it('should return finding when formatter outputs fallback', () => {
    const result = rule.evaluate(
      createDiagnosisContext({
        storeUpdated: true,
        selectorRan: true,
        selectorValue: 10,
        renderTriggered: true,
        renderCommitted: true,
        renderInputValue: 10,
        renderOutputValue: '--',
        formatterOutputIsFallback: true,
        domUpdated: true,
        domVisible: true,
        domValue: '--',
        displayedValue: '--',
      }),
    );

    expect(result).toBeTruthy();
    expect(result?.ruleCode).toBe('R202');
    expect(result?.layer).toBe('render');
    expect(result?.cluster).toBe('formatter_fallback');
    expect(result?.isSymptomOnly).toBe(false);
  });

  it('should return null when selector did not run', () => {
    const result = rule.evaluate(
      createDiagnosisContext({
        selectorRan: false,
        formatterOutputIsFallback: true,
      }),
    );

    expect(result).toBeNull();
  });

  it('should return null when formatter output is not fallback', () => {
    const result = rule.evaluate(
      createDiagnosisContext({
        selectorRan: true,
        formatterOutputIsFallback: false,
      }),
    );

    expect(result).toBeNull();
  });
});
```

---

## 2.7 `r203-render-not-triggered.rule.spec.ts`

```ts
import { R203RenderNotTriggeredRule } from '../r203-render-not-triggered.rule';
import { createDiagnosisContext } from '../../../test/fixtures/create-diagnosis-context.fixture';

describe('R203RenderNotTriggeredRule', () => {
  const rule = new R203RenderNotTriggeredRule();

  it('should return finding when selector ran but render not triggered', () => {
    const result = rule.evaluate(
      createDiagnosisContext({
        storeUpdated: true,
        selectorRan: true,
        selectorValue: 10,
        renderTriggered: false,
      }),
    );

    expect(result).toBeTruthy();
    expect(result?.ruleCode).toBe('R203');
    expect(result?.layer).toBe('render');
    expect(result?.cluster).toBe('render_not_triggered');
    expect(result?.isSymptomOnly).toBe(false);
  });

  it('should return null when render already triggered', () => {
    const result = rule.evaluate(
      createDiagnosisContext({
        selectorRan: true,
        renderTriggered: true,
      }),
    );

    expect(result).toBeNull();
  });

  it('should return null when selector did not run', () => {
    const result = rule.evaluate(
      createDiagnosisContext({
        selectorRan: false,
        renderTriggered: false,
      }),
    );

    expect(result).toBeNull();
  });
});
```

---

## 2.8 `r301-dom-hidden.rule.spec.ts`

```ts
import { R301DomHiddenRule } from '../r301-dom-hidden.rule';
import { createDiagnosisContext } from '../../../test/fixtures/create-diagnosis-context.fixture';

describe('R301DomHiddenRule', () => {
  const rule = new R301DomHiddenRule();

  it('should return finding when dom updated but not visible', () => {
    const result = rule.evaluate(
      createDiagnosisContext({
        storeUpdated: true,
        selectorRan: true,
        renderTriggered: true,
        renderCommitted: true,
        domUpdated: true,
        domVisible: false,
        domValue: 10,
      }),
    );

    expect(result).toBeTruthy();
    expect(result?.ruleCode).toBe('R301');
    expect(result?.layer).toBe('dom');
    expect(result?.cluster).toBe('dom_hidden');
    expect(result?.isSymptomOnly).toBe(false);
  });

  it('should return null when dom is visible', () => {
    const result = rule.evaluate(
      createDiagnosisContext({
        domUpdated: true,
        domVisible: true,
      }),
    );

    expect(result).toBeNull();
  });

  it('should return null when dom not updated', () => {
    const result = rule.evaluate(
      createDiagnosisContext({
        domUpdated: false,
        domVisible: false,
      }),
    );

    expect(result).toBeNull();
  });
});
```

---

## 2.9 `r302-dom-not-updated.rule.spec.ts`

```ts
import { R302DomNotUpdatedRule } from '../r302-dom-not-updated.rule';
import { createDiagnosisContext } from '../../../test/fixtures/create-diagnosis-context.fixture';

describe('R302DomNotUpdatedRule', () => {
  const rule = new R302DomNotUpdatedRule();

  it('should return finding when render committed but dom not updated', () => {
    const result = rule.evaluate(
      createDiagnosisContext({
        renderCommitted: true,
        renderOutputValue: 'new-value',
        domUpdated: false,
        domValue: 'old-value',
      }),
    );

    expect(result).toBeTruthy();
    expect(result?.ruleCode).toBe('R302');
    expect(result?.layer).toBe('dom');
    expect(result?.cluster).toBe('dom_not_updated');
    expect(result?.isSymptomOnly).toBe(false);
  });

  it('should return null when dom already reflects render output', () => {
    const result = rule.evaluate(
      createDiagnosisContext({
        renderCommitted: true,
        renderOutputValue: 'same-value',
        domUpdated: true,
        domValue: 'same-value',
      }),
    );

    expect(result).toBeNull();
  });

  it('should return null when render not committed', () => {
    const result = rule.evaluate(
      createDiagnosisContext({
        renderCommitted: false,
        domUpdated: false,
        renderOutputValue: 'new-value',
        domValue: 'old-value',
      }),
    );

    expect(result).toBeNull();
  });
});
```

---

## 2.10 `r401-click-handler-not-started.rule.spec.ts`

```ts
import { R401ClickHandlerNotStartedRule } from '../r401-click-handler-not-started.rule';
import { createDiagnosisContext } from '../../../test/fixtures/create-diagnosis-context.fixture';

describe('R401ClickHandlerNotStartedRule', () => {
  const rule = new R401ClickHandlerNotStartedRule();

  it('should return finding when click detected but handler not started', () => {
    const result = rule.evaluate(
      createDiagnosisContext({
        mode: 'click_diagnosis',
        clickDetected: true,
        handlerStarted: false,
      }),
    );

    expect(result).toBeTruthy();
    expect(result?.ruleCode).toBe('R401');
    expect(result?.layer).toBe('handler');
    expect(result?.cluster).toBe('click_handler_not_started');
    expect(result?.isSymptomOnly).toBe(false);
  });

  it('should return null when mode is not click_diagnosis', () => {
    const result = rule.evaluate(
      createDiagnosisContext({
        mode: 'inspect_diagnosis',
        clickDetected: true,
        handlerStarted: false,
      }),
    );

    expect(result).toBeNull();
  });

  it('should return null when handler already started', () => {
    const result = rule.evaluate(
      createDiagnosisContext({
        mode: 'click_diagnosis',
        clickDetected: true,
        handlerStarted: true,
      }),
    );

    expect(result).toBeNull();
  });
});
```

---

## 2.11 `r402-request-not-sent.rule.spec.ts`

```ts
import { R402RequestNotSentRule } from '../r402-request-not-sent.rule';
import { createDiagnosisContext } from '../../../test/fixtures/create-diagnosis-context.fixture';

describe('R402RequestNotSentRule', () => {
  const rule = new R402RequestNotSentRule();

  it('should return finding when handler started but request not sent', () => {
    const result = rule.evaluate(
      createDiagnosisContext({
        mode: 'click_diagnosis',
        clickDetected: true,
        handlerStarted: true,
        requestSent: false,
      }),
    );

    expect(result).toBeTruthy();
    expect(result?.ruleCode).toBe('R402');
    expect(result?.layer).toBe('request');
    expect(result?.cluster).toBe('request_not_sent');
    expect(result?.isSymptomOnly).toBe(false);
  });

  it('should return null when request already sent', () => {
    const result = rule.evaluate(
      createDiagnosisContext({
        mode: 'click_diagnosis',
        handlerStarted: true,
        requestSent: true,
      }),
    );

    expect(result).toBeNull();
  });

  it('should return null when handler not started', () => {
    const result = rule.evaluate(
      createDiagnosisContext({
        mode: 'click_diagnosis',
        handlerStarted: false,
        requestSent: false,
      }),
    );

    expect(result).toBeNull();
  });
});
```

---

## 2.12 `r501-fallback-displayed.rule.spec.ts`

```ts
import { R501FallbackDisplayedRule } from '../r501-fallback-displayed.rule';
import { createDiagnosisContext } from '../../../test/fixtures/create-diagnosis-context.fixture';

describe('R501FallbackDisplayedRule', () => {
  const rule = new R501FallbackDisplayedRule();

  it('should return symptom finding when displayed value is fallback token', () => {
    const result = rule.evaluate(
      createDiagnosisContext({
        displayedValue: '--',
      }),
    );

    expect(result).toBeTruthy();
    expect(result?.ruleCode).toBe('R501');
    expect(result?.layer).toBe('ui');
    expect(result?.cluster).toBe('fallback_displayed');
    expect(result?.isSymptomOnly).toBe(true);
  });

  it('should return null when displayed value is not fallback token', () => {
    const result = rule.evaluate(
      createDiagnosisContext({
        displayedValue: 'hello',
      }),
    );

    expect(result).toBeNull();
  });

  it('should treat empty string as fallback when configured in fallbackTokens', () => {
    const result = rule.evaluate(
      createDiagnosisContext({
        displayedValue: '',
        fallbackTokens: ['--', '', 'N/A'],
      }),
    );

    expect(result).toBeTruthy();
    expect(result?.ruleCode).toBe('R501');
  });
});
```

---

## 2.13 `r502-render-dom-mismatch.rule.spec.ts`

```ts
import { R502RenderDomMismatchRule } from '../r502-render-dom-mismatch.rule';
import { createDiagnosisContext } from '../../../test/fixtures/create-diagnosis-context.fixture';

describe('R502RenderDomMismatchRule', () => {
  const rule = new R502RenderDomMismatchRule();

  it('should return symptom finding when render output mismatches dom value', () => {
    const result = rule.evaluate(
      createDiagnosisContext({
        responseSuccess: true,
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
        domUpdated: true,
        domVisible: true,
        domValue: '--',
        displayedValue: '--',
      }),
    );

    expect(result).toBeTruthy();
    expect(result?.ruleCode).toBe('R502');
    expect(result?.layer).toBe('dom');
    expect(result?.cluster).toBe('render_dom_mismatch');
    expect(result?.isSymptomOnly).toBe(true);
  });

  it('should return null when render output equals dom value', () => {
    const result = rule.evaluate(
      createDiagnosisContext({
        renderCommitted: true,
        domUpdated: true,
        renderOutputValue: '100',
        domValue: '100',
      }),
    );

    expect(result).toBeNull();
  });

  it('should return null when render not committed', () => {
    const result = rule.evaluate(
      createDiagnosisContext({
        renderCommitted: false,
        domUpdated: true,
        renderOutputValue: '100',
        domValue: '--',
      }),
    );

    expect(result).toBeNull();
  });
});
```

---

## 2.14 `r503-pre-request-gap.rule.spec.ts`

```ts
import { R503PreRequestGapRule } from '../r503-pre-request-gap.rule';
import { createDiagnosisContext } from '../../../test/fixtures/create-diagnosis-context.fixture';

describe('R503PreRequestGapRule', () => {
  const rule = new R503PreRequestGapRule();

  it('should return symptom finding when chain breaks before request sending', () => {
    const result = rule.evaluate(
      createDiagnosisContext({
        mode: 'click_diagnosis',
        clickDetected: true,
        handlerStarted: true,
        requestSent: false,
      }),
    );

    expect(result).toBeTruthy();
    expect(result?.ruleCode).toBe('R503');
    expect(result?.layer).toBe('request_to_ui');
    expect(result?.cluster).toBe('pre_request_gap');
    expect(result?.isSymptomOnly).toBe(true);
  });

  it('should return null when request already sent', () => {
    const result = rule.evaluate(
      createDiagnosisContext({
        mode: 'click_diagnosis',
        clickDetected: true,
        handlerStarted: true,
        requestSent: true,
      }),
    );

    expect(result).toBeNull();
  });

  it('should return null when handler not started', () => {
    const result = rule.evaluate(
      createDiagnosisContext({
        mode: 'click_diagnosis',
        clickDetected: true,
        handlerStarted: false,
        requestSent: false,
      }),
    );

    expect(result).toBeNull();
  });
});
```

---

## 2.15 `r504-generic-ui-empty.rule.spec.ts`

```ts
import { R504GenericUiEmptyRule } from '../r504-generic-ui-empty.rule';
import { createDiagnosisContext } from '../../../test/fixtures/create-diagnosis-context.fixture';

describe('R504GenericUiEmptyRule', () => {
  const rule = new R504GenericUiEmptyRule();

  it('should return symptom finding when displayed value is empty string', () => {
    const result = rule.evaluate(
      createDiagnosisContext({
        displayedValue: '',
      }),
    );

    expect(result).toBeTruthy();
    expect(result?.ruleCode).toBe('R504');
    expect(result?.layer).toBe('ui');
    expect(result?.cluster).toBe('generic_ui_empty');
    expect(result?.isSymptomOnly).toBe(true);
  });

  it('should return symptom finding when displayed value is blank string', () => {
    const result = rule.evaluate(
      createDiagnosisContext({
        displayedValue: '   ',
      }),
    );

    expect(result).toBeTruthy();
    expect(result?.ruleCode).toBe('R504');
  });

  it('should return null when displayed value is not empty', () => {
    const result = rule.evaluate(
      createDiagnosisContext({
        displayedValue: 'hello',
      }),
    );

    expect(result).toBeNull();
  });
});
```

---

# 3. 如果你要把全部 15 个 spec 一次性收口，这里是完整清单

```bash
src/modules/diagnosis/test/fixtures/create-diagnosis-context.fixture.ts

src/modules/diagnosis/domain/rules/__tests__/r101-api-field-missing.rule.spec.ts
src/modules/diagnosis/domain/rules/__tests__/r102-api-null-value.rule.spec.ts
src/modules/diagnosis/domain/rules/__tests__/r103-state-not-updated.rule.spec.ts
src/modules/diagnosis/domain/rules/__tests__/r104-selector-not-ran.rule.spec.ts
src/modules/diagnosis/domain/rules/__tests__/r201-falsy-swallowed.rule.spec.ts
src/modules/diagnosis/domain/rules/__tests__/r202-formatter-fallback.rule.spec.ts
src/modules/diagnosis/domain/rules/__tests__/r203-render-not-triggered.rule.spec.ts
src/modules/diagnosis/domain/rules/__tests__/r301-dom-hidden.rule.spec.ts
src/modules/diagnosis/domain/rules/__tests__/r302-dom-not-updated.rule.spec.ts
src/modules/diagnosis/domain/rules/__tests__/r401-click-handler-not-started.rule.spec.ts
src/modules/diagnosis/domain/rules/__tests__/r402-request-not-sent.rule.spec.ts
src/modules/diagnosis/domain/rules/__tests__/r501-fallback-displayed.rule.spec.ts
src/modules/diagnosis/domain/rules/__tests__/r502-render-dom-mismatch.rule.spec.ts
src/modules/diagnosis/domain/rules/__tests__/r503-pre-request-gap.rule.spec.ts
src/modules/diagnosis/domain/rules/__tests__/r504-generic-ui-empty.rule.spec.ts
```

---

# 4. 可选：再加一个 fixtures barrel export

如果你后面 fixture 越来越多，可以再补一个：

## `src/modules/diagnosis/test/fixtures/index.ts`

```ts
export * from './create-diagnosis-context.fixture';
```

这样 spec 里可以写：

```ts
import { createDiagnosisContext } from '../../../test/fixtures';
```

不是必须，但后续更整洁。

---

# 5. 这次重构后的收益

这次改完之后，后续如果 `DiagnosisContext` 新增字段，比如：

- `componentMounted`
- `queryCacheHit`
- `requestAborted`

你只要改：

```ts
create-diagnosis-context.fixture.ts
```

不用改 15 个 spec。

---

# 6. 我建议你下一步继续做什么

现在最自然的下一步是二选一：

### 方案 A
**我继续给你输出 `rule.providers.ts + DiagnosisModule 完整更新版 + module wiring spec 更新版`**

这样完整规则集正式接入模块。

### 方案 B
**我继续给你输出 `RuleEngineService 集成测试重构版`**
让它直接基于这 15 个真实规则跑组合命中测试。

---

我建议下一步做 **A**，因为你现在已经把规则文件和单测骨架补齐了，最适合马上把 **完整规则 provider wiring** 一次锁住。