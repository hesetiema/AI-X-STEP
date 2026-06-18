下面直接给你一版 **`RuleEngineService` Jest 单测样例**。  
目标是把你前面那版 **P0 / P1 规则实现** 固化成可回归测试的工程资产。

重点覆盖三类：

- **命中 case**
- **不命中 case**
- **边界 case**

这样后面你继续扩规则时，不容易把已验证行为搞坏。

---

# 1. 推荐文件位置

```ts
src/modules/diagnosis/domain/rule-engine.service.spec.ts
```

---

# 2. 完整 Jest 单测样例

```ts
import { RuleEngineService } from './rule-engine.service';
import { DiagnosisContext } from '../models/diagnosis-context.model';

describe('RuleEngineService', () => {
  let service: RuleEngineService;

  beforeEach(() => {
    service = new RuleEngineService();
  });

  const createBaseContext = (
    overrides: Partial<DiagnosisContext> = {},
  ): DiagnosisContext => {
    return {
      diagnosisId: 'diag_test_001',
      mode: 'inspect_diagnosis',

      interactionId: 'itr_test_001',
      lineageId: 'lin_test_001',

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

      renderInputValue: 0,
      renderOutputValue: '--',
      previousRenderOutputValue: '0.00',
      renderTriggered: true,
      formatterName: 'formatCurrency',
      formatterOutputIsFallback: true,

      domValue: '--',
      domUpdated: true,
      domVisible: true,

      clickDetected: false,
      handlerStarted: false,
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
        'ev_render_trace',
      ],

      ...overrides,
    };
  };

  const findRule = (ruleCode: string, context: DiagnosisContext) => {
    return service.run(context).find((item) => item.ruleCode === ruleCode);
  };

  describe('R101 - 接口返回成功但字段缺失', () => {
    it('should hit when response succeeds but target field is missing', () => {
      const context = createBaseContext({
        responseSuccess: true,
        apiFieldPath: 'response.data.amount',
        apiFieldExists: false,
      });

      const hit = findRule('R101', context);

      expect(hit).toBeDefined();
      expect(hit?.diagnosisLabel).toBe('接口字段缺失');
      expect(hit?.isSymptomOnly).toBe(false);
    });

    it('should not hit when response is not successful', () => {
      const context = createBaseContext({
        responseSuccess: false,
        apiFieldExists: false,
      });

      const hit = findRule('R101', context);

      expect(hit).toBeUndefined();
    });

    it('should not hit when api field path is absent', () => {
      const context = createBaseContext({
        apiFieldPath: undefined,
        apiFieldExists: false,
      });

      const hit = findRule('R101', context);

      expect(hit).toBeUndefined();
    });
  });

  describe('R102 - 接口字段路径配置错误 / 绑定失效', () => {
    it('should hit when response succeeds, field missing, and downstream binding exists', () => {
      const context = createBaseContext({
        responseSuccess: true,
        apiFieldPath: 'response.data.amount',
        apiFieldExists: false,
        storeKey: 'order.current.amount',
      });

      const hit = findRule('R102', context);

      expect(hit).toBeDefined();
      expect(hit?.diagnosisLabel).toBe('接口绑定路径失效');
    });

    it('should not hit when downstream binding clue is absent', () => {
      const context = createBaseContext({
        responseSuccess: true,
        apiFieldPath: 'response.data.amount',
        apiFieldExists: false,
        storeKey: undefined,
        selectorName: undefined,
        formatterName: undefined,
      });

      const hit = findRule('R102', context);

      expect(hit).toBeUndefined();
    });
  });

  describe('R103 - 请求成功但未触发状态更新', () => {
    it('should hit when request succeeds but store is not updated', () => {
      const context = createBaseContext({
        requestSent: true,
        responseSuccess: true,
        storeUpdated: false,
      });

      const hit = findRule('R103', context);

      expect(hit).toBeDefined();
      expect(hit?.diagnosisLabel).toBe('请求成功但状态未更新');
    });

    it('should not hit when request was not sent', () => {
      const context = createBaseContext({
        requestSent: false,
        responseSuccess: true,
        storeUpdated: false,
      });

      const hit = findRule('R103', context);

      expect(hit).toBeUndefined();
    });
  });

  describe('R104 - 状态已更新但 selector 未取到值', () => {
    it('should hit when store updated but selector value is nil', () => {
      const context = createBaseContext({
        storeUpdated: true,
        selectorRan: true,
        selectorValue: undefined,
      });

      const hit = findRule('R104', context);

      expect(hit).toBeDefined();
      expect(hit?.diagnosisLabel).toBe('selector 取值失败');
    });

    it('should not hit when selector has value 0', () => {
      const context = createBaseContext({
        storeUpdated: true,
        selectorRan: true,
        selectorValue: 0,
      });

      const hit = findRule('R104', context);

      expect(hit).toBeUndefined();
    });

    it('should not hit when store was not updated', () => {
      const context = createBaseContext({
        storeUpdated: false,
        selectorRan: true,
        selectorValue: undefined,
      });

      const hit = findRule('R104', context);

      expect(hit).toBeUndefined();
    });
  });

  describe('R201 - 合法 falsy 值被误判为空', () => {
    it('should hit when upstream value is 0 and render output is fallback', () => {
      const context = createBaseContext({
        apiValue: 0,
        renderInputValue: 0,
        renderOutputValue: '--',
        formatterOutputIsFallback: true,
      });

      const hit = findRule('R201', context);

      expect(hit).toBeDefined();
      expect(hit?.diagnosisLabel).toBe('合法值被判空吞掉');
    });

    it('should hit when upstream value is false and dom value is fallback', () => {
      const context = createBaseContext({
        apiValue: false,
        storeValue: false,
        selectorValue: false,
        renderInputValue: false,
        renderOutputValue: '--',
        domValue: '--',
        formatterOutputIsFallback: false,
      });

      const hit = findRule('R201', context);

      expect(hit).toBeDefined();
    });

    it('should not hit when upstream value is null', () => {
      const context = createBaseContext({
        apiValue: null,
        storeValue: null,
        selectorValue: null,
        renderInputValue: null,
        renderOutputValue: '--',
        formatterOutputIsFallback: true,
      });

      const hit = findRule('R201', context);

      expect(hit).toBeUndefined();
    });
  });

  describe('R202 - formatter 输出 fallback 占位值', () => {
    it('should hit when render is triggered and formatter output is fallback', () => {
      const context = createBaseContext({
        renderTriggered: true,
        renderInputValue: 123,
        renderOutputValue: '--',
        formatterOutputIsFallback: true,
      });

      const hit = findRule('R202', context);

      expect(hit).toBeDefined();
      expect(hit?.diagnosisLabel).toBe('formatter 输出占位值');
    });

    it('should not hit when render input is nil', () => {
      const context = createBaseContext({
        renderTriggered: true,
        renderInputValue: undefined,
        renderOutputValue: '--',
        formatterOutputIsFallback: true,
      });

      const hit = findRule('R202', context);

      expect(hit).toBeUndefined();
    });

    it('should not hit when render output is normal value', () => {
      const context = createBaseContext({
        renderTriggered: true,
        renderInputValue: 123,
        renderOutputValue: '123.00',
        formatterOutputIsFallback: false,
      });

      const hit = findRule('R202', context);

      expect(hit).toBeUndefined();
    });
  });

  describe('R203 - render 输入正确但输出异常', () => {
    it('should hit when render input/output are different and output is not fallback', () => {
      const context = createBaseContext({
        renderTriggered: true,
        renderInputValue: 100,
        renderOutputValue: '100元',
        formatterOutputIsFallback: false,
        fallbackTokens: ['--', '-', '暂无'],
      });

      const hit = findRule('R203', context);

      expect(hit).toBeDefined();
      expect(hit?.diagnosisLabel).toBe('render 输出异常');
    });

    it('should not hit when input and output are loosely equal', () => {
      const context = createBaseContext({
        renderTriggered: true,
        renderInputValue: 100,
        renderOutputValue: '100',
        formatterOutputIsFallback: false,
      });

      const hit = findRule('R203', context);

      expect(hit).toBeUndefined();
    });

    it('should not hit when output is fallback because R202/R201 should cover it', () => {
      const context = createBaseContext({
        renderTriggered: true,
        renderInputValue: 100,
        renderOutputValue: '--',
        formatterOutputIsFallback: true,
      });

      const hit = findRule('R203', context);

      expect(hit).toBeUndefined();
    });
  });

  describe('R301 - DOM 已渲染但被隐藏', () => {
    it('should hit when dom updated but invisible', () => {
      const context = createBaseContext({
        domUpdated: true,
        domVisible: false,
      });

      const hit = findRule('R301', context);

      expect(hit).toBeDefined();
      expect(hit?.diagnosisLabel).toBe('DOM 被隐藏');
    });

    it('should not hit when dom is visible', () => {
      const context = createBaseContext({
        domUpdated: true,
        domVisible: true,
      });

      const hit = findRule('R301', context);

      expect(hit).toBeUndefined();
    });
  });

  describe('R302 - DOM 未更新或显示值与渲染输出不一致', () => {
    it('should hit when render triggered but dom not updated', () => {
      const context = createBaseContext({
        renderTriggered: true,
        domUpdated: false,
      });

      const hit = findRule('R302', context);

      expect(hit).toBeDefined();
      expect(hit?.diagnosisLabel).toBe('DOM 未反映最新渲染结果');
    });

    it('should hit when render output and dom value mismatch', () => {
      const context = createBaseContext({
        renderTriggered: true,
        renderOutputValue: '100.00',
        domValue: '--',
        domUpdated: true,
      });

      const hit = findRule('R302', context);

      expect(hit).toBeDefined();
    });

    it('should not hit when render output matches dom value', () => {
      const context = createBaseContext({
        renderTriggered: true,
        renderOutputValue: '100.00',
        domValue: '100.00',
        domUpdated: true,
      });

      const hit = findRule('R302', context);

      expect(hit).toBeUndefined();
    });
  });

  describe('R401 - click 已发生但 handler 未启动', () => {
    it('should hit in click_diagnosis mode when click is detected but handler not started', () => {
      const context = createBaseContext({
        mode: 'click_diagnosis',
        clickDetected: true,
        handlerStarted: false,
      });

      const hit = findRule('R401', context);

      expect(hit).toBeDefined();
      expect(hit?.diagnosisLabel).toBe('click 未触发 handler');
    });

    it('should not hit in inspect mode', () => {
      const context = createBaseContext({
        mode: 'inspect_diagnosis',
        clickDetected: true,
        handlerStarted: false,
      });

      const hit = findRule('R401', context);

      expect(hit).toBeUndefined();
    });

    it('should not hit when handler has started', () => {
      const context = createBaseContext({
        mode: 'click_diagnosis',
        clickDetected: true,
        handlerStarted: true,
      });

      const hit = findRule('R401', context);

      expect(hit).toBeUndefined();
    });
  });

  describe('R402 - handler 已执行但 request 未发出', () => {
    it('should hit when handler started but request not sent', () => {
      const context = createBaseContext({
        handlerStarted: true,
        requestSent: false,
      });

      const hit = findRule('R402', context);

      expect(hit).toBeDefined();
      expect(hit?.diagnosisLabel).toBe('handler 执行但 request 未发送');
    });

    it('should not hit when request was sent', () => {
      const context = createBaseContext({
        handlerStarted: true,
        requestSent: true,
      });

      const hit = findRule('R402', context);

      expect(hit).toBeUndefined();
    });
  });

  describe('R501 - 页面显示 fallback 占位值', () => {
    it('should hit when dom or displayed value is fallback token', () => {
      const context = createBaseContext({
        domValue: '--',
      });

      const hit = findRule('R501', context);

      expect(hit).toBeDefined();
      expect(hit?.isSymptomOnly).toBe(true);
    });

    it('should not hit when displayed value is normal', () => {
      const context = createBaseContext({
        domValue: '100.00',
        displayedValue: '100.00',
      });

      const hit = findRule('R501', context);

      expect(hit).toBeUndefined();
    });
  });

  describe('R502 - render 到 DOM 之间存在链路断点', () => {
    it('should hit when render has produced output but dom is not updated', () => {
      const context = createBaseContext({
        renderTriggered: true,
        renderCommitted: true,
        renderOutputValue: '100.00',
        domUpdated: false,
      });

      const hit = findRule('R502', context);

      expect(hit).toBeDefined();
      expect(hit?.isSymptomOnly).toBe(true);
    });

    it('should not hit when dom has updated', () => {
      const context = createBaseContext({
        renderTriggered: true,
        renderCommitted: true,
        renderOutputValue: '100.00',
        domUpdated: true,
      });

      const hit = findRule('R502', context);

      expect(hit).toBeUndefined();
    });
  });

  describe('R503 - 链路中断于 request 之前', () => {
    it('should hit in click mode when click detected but request not sent', () => {
      const context = createBaseContext({
        mode: 'click_diagnosis',
        clickDetected: true,
        requestSent: false,
      });

      const hit = findRule('R503', context);

      expect(hit).toBeDefined();
      expect(hit?.isSymptomOnly).toBe(true);
    });

    it('should not hit in inspect mode', () => {
      const context = createBaseContext({
        mode: 'inspect_diagnosis',
        clickDetected: true,
        requestSent: false,
      });

      const hit = findRule('R503', context);

      expect(hit).toBeUndefined();
    });
  });

  describe('R504 - 证据不足但存在异常表象', () => {
    it('should hit when abnormal display exists but upstream evidence is weak', () => {
      const context = createBaseContext({
        domValue: '--',
        responseSuccess: false,
        storeUpdated: false,
        renderTriggered: false,
        evidenceRefs: ['ev_dom_snapshot'],
      });

      const hit = findRule('R504', context);

      expect(hit).toBeDefined();
      expect(hit?.diagnosisLabel).toBe('证据不足');
      expect(hit?.isSymptomOnly).toBe(true);
    });

    it('should not hit when upstream evidence is sufficiently strong', () => {
      const context = createBaseContext({
        domValue: '--',
        responseSuccess: true,
        storeUpdated: true,
        renderTriggered: true,
        evidenceRefs: ['ev_dom_snapshot', 'ev_api_amount_0', 'ev_store_value'],
      });

      const hit = findRule('R504', context);

      expect(hit).toBeUndefined();
    });
  });

  describe('组合场景', () => {
    it('should return multiple findings in a formatter fallback scenario', () => {
      const context = createBaseContext({
        apiValue: 0,
        storeValue: 0,
        selectorValue: 0,
        renderInputValue: 0,
        renderOutputValue: '--',
        domValue: '--',
        formatterOutputIsFallback: true,
        renderTriggered: true,
        domUpdated: true,
      });

      const findings = service.run(context);
      const codes = findings.map((item) => item.ruleCode);

      expect(codes).toContain('R201');
      expect(codes).toContain('R202');
      expect(codes).toContain('R501');
    });

    it('should return interaction findings in click chain broken scenario', () => {
      const context = createBaseContext({
        mode: 'click_diagnosis',
        clickDetected: true,
        handlerStarted: false,
        requestSent: false,
      });

      const findings = service.run(context);
      const codes = findings.map((item) => item.ruleCode);

      expect(codes).toContain('R401');
      expect(codes).toContain('R503');
    });
  });

  describe('去重行为', () => {
    it('should not produce duplicated findings with same ruleCode/cluster/layer key', () => {
      const context = createBaseContext({
        responseSuccess: true,
        apiFieldPath: 'response.data.amount',
        apiFieldExists: false,
        storeKey: 'order.current.amount',
      });

      const findings = service.run(context);
      const r101 = findings.filter((item) => item.ruleCode === 'R101');
      const r102 = findings.filter((item) => item.ruleCode === 'R102');

      expect(r101).toHaveLength(1);
      expect(r102).toHaveLength(1);
    });
  });
});
```

---

# 3. 这组测试覆盖了什么

---

## 3.1 Data Source
- `R101`
- `R102`

验证：
- 返回成功 + 字段缺失时命中
- 无 downstream binding clue 时 `R102` 不命中

---

## 3.2 State Binding
- `R103`
- `R104`

验证：
- 请求成功但 store 不更新
- store 更新了但 selector 取不到
- **`selectorValue = 0` 不应误判缺失**

这个边界 case 很关键。

---

## 3.3 Render Transform
- `R201`
- `R202`
- `R203`

验证：
- `0 / false` 这种合法 falsy 被吞
- fallback 输出命中 formatter 异常
- 普通输入输出不一致命中 `R203`
- fallback 场景不要重复打到 `R203`

---

## 3.4 DOM / UI
- `R301`
- `R302`

验证：
- DOM 被隐藏
- render 输出和 DOM 显示不一致
- DOM 不更新时命中

---

## 3.5 Interaction
- `R401`
- `R402`

验证：
- click 模式下 click 有了但 handler 没起来
- handler 起来了但 request 没发

---

## 3.6 Symptom Rules
- `R501`
- `R502`
- `R503`
- `R504`

验证：
- 页面 fallback 占位值
- render->DOM 断点
- request 前断点
- 证据不足

---

## 3.7 组合场景
这个最接近真实业务。  
例如：

### formatter fallback 场景
应该同时命中：
- `R201`
- `R202`
- `R501`

### click 断链场景
应该同时命中：
- `R401`
- `R503`

这能证明 RuleEngine 是“多命中、后续排序”的设计，而不是单条互斥判断。

---

# 4. 推荐再补的两个测试方向

---

## 4.1 metadata / evidenceRefs 精细断言
你现在主要测“是否命中”。  
下一步可以补：

```ts
expect(hit?.evidenceRefs).toEqual(
  expect.arrayContaining(['ev_formatter_output_fallback']),
);
```

以及：

```ts
expect(hit?.suggestions).toContain('将 if (!value) 改为 value == null');
```

这样可以防止以后规则命中没问题，但解释字段被改坏。

---

## 4.2 表驱动测试
如果你后面规则继续增多，建议把一部分 case 改成 `it.each()`：

```ts
it.each([
  { value: 0, shouldHit: true },
  { value: false, shouldHit: true },
  { value: null, shouldHit: false },
])(...)
```

这样更适合维护。

---

# 5. 运行方式

只跑这个 spec：

```bash
npx jest src/modules/diagnosis/domain/rule-engine.service.spec.ts
```

或者：

```bash
npm run test -- rule-engine.service.spec.ts
```

全量：

```bash
npm test
```

覆盖率：

```bash
npm run test:cov
```

---

# 6. 一个工程建议

你现在已经有了：

- `RuleEngineService` 实现
- `RankingService` 实现
- `DiagnosisConclusionService` 实现
- 三者对应 Jest 测试

这时下一步最值得补的不是继续写文档，而是做一个 **orchestrator 集成测试**，也就是：

## `DiagnosisQueryService` Jest 集成单测

验证整条主链路：

```text
Repository.findById
 -> EvidenceCollector.collect
 -> ContextBuilder.build
 -> RuleEngine.run
 -> ConclusionService.conclude
 -> ExplanationBuilder.build
 -> DominoChainBuilder.build
 -> Repository.saveCompletedResult
```

这一步会让你的 MVP 从“模块设计”真正进入“可回归工程”。

---

如果你愿意，我下一条可以直接继续给你：  
**`DiagnosisQueryService` Jest 集成单测样例**。