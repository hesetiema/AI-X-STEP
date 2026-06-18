下面直接给你一版 **`DominoChainBuilder` Jest 单测样例**。  
目标是把你前面定义的“**多米诺骨牌式因果链展示**”落成可回归测试的 builder 级测试。

重点覆盖：

- 节点顺序是否正确
- root cause / supporting / symptom 标记是否正确
- 节点状态是否正确
- 断点是否正确识别
- 无 topFinding 时是否能退化输出
- click 场景与 inspect 场景是否都能工作

---

# 1. 推荐文件位置

```ts
src/modules/diagnosis/domain/domino-chain-builder.spec.ts
```

如果你把 builder 放在 `builders/` 目录，也可以：

```ts
src/modules/diagnosis/builders/domino-chain-builder.spec.ts
```

---

# 2. 一个可对齐的输出结构假设

下面单测默认你的 `DominoChainBuilder` 输出大概像这样：

```ts
type DominoNodeStatus =
  | 'ok'
  | 'warning'
  | 'error'
  | 'symptom'
  | 'unknown';

interface DominoChainNode {
  id: string;
  layer:
    | 'click'
    | 'handler'
    | 'request'
    | 'response'
    | 'state'
    | 'selector'
    | 'render'
    | 'dom';
  label: string;
  value?: unknown;
  status: DominoNodeStatus;
  isRootCause?: boolean;
  isSupporting?: boolean;
  isSymptom?: boolean;
  relatedRuleCodes?: string[];
  evidenceRefs?: string[];
}

type DominoChain = DominoChainNode[];
```

如果你现在字段名不完全一致，比如：

- `type` 替代 `layer`
- `nodeType`
- `badges`
- `causeRole`

只要把断言改一下即可。

---

# 3. 完整 Jest 单测样例

```ts
import { DominoChainBuilder } from './domino-chain-builder';

describe('DominoChainBuilder', () => {
  let builder: DominoChainBuilder;

  beforeEach(() => {
    builder = new DominoChainBuilder();
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
    handlerStarted: true,
    requestSent: true,
    responseReceived: true,
    stateChanged: true,
    renderTriggered: true,
    renderCommitted: true,

    apiFieldPath: 'response.data.success',
    apiFieldExists: true,
    apiValue: true,
    responseSuccess: true,

    storeUpdated: true,
    storeValue: true,
    selectorRan: true,
    selectorValue: true,

    renderInputValue: true,
    renderOutputValue: '提交成功',
    domUpdated: true,
    domVisible: true,
    domValue: '提交成功',

    evidenceRefs: [
      'ev_click_trace',
      'ev_handler_trace',
      'ev_request_trace',
      'ev_response_trace',
      'ev_dom_snapshot',
    ],

    ...overrides,
  });

  const createFinding = (overrides: Record<string, any> = {}) => ({
    ruleCode: 'R999',
    diagnosisLabel: 'default finding',
    summary: 'default summary',
    layer: 'render',
    cluster: 'default_cluster',
    confidence: 0.8,
    isSymptomOnly: false,
    evidenceRefs: ['ev_default'],
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

  describe('inspect 场景 - formatter root cause', () => {
    it('should build ordered domino chain from api -> state -> selector -> render -> dom', () => {
      const context = createInspectContext();

      const topFinding = createFinding({
        ruleCode: 'R201',
        diagnosisLabel: '合法值被判空吞掉',
        layer: 'render',
        cluster: 'formatter_falsy_swallowed',
        confidence: 0.96,
        isSymptomOnly: false,
        evidenceRefs: ['ev_api_amount_0', 'ev_render_trace'],
      });

      const symptomFinding = createFinding({
        ruleCode: 'R501',
        diagnosisLabel: '页面显示占位值',
        layer: 'dom',
        cluster: 'fallback_displayed',
        confidence: 0.88,
        isSymptomOnly: true,
        evidenceRefs: ['ev_dom_snapshot'],
      });

      const conclusion = createConclusion({
        topFinding,
        symptomFindings: [symptomFinding],
        diagnosisState: 'confirmed_root_cause',
        summary: '已定位到 formatter root cause',
      });

      const chain = builder.build(context, conclusion, [topFinding, symptomFinding]);

      expect(chain.map((node) => node.layer)).toEqual([
        'response',
        'state',
        'selector',
        'render',
        'dom',
      ]);

      const renderNode = chain.find((node) => node.layer === 'render');
      const domNode = chain.find((node) => node.layer === 'dom');

      expect(renderNode).toBeDefined();
      expect(domNode).toBeDefined();

      expect(renderNode?.isRootCause).toBe(true);
      expect(renderNode?.status).toBe('error');
      expect(renderNode?.relatedRuleCodes).toContain('R201');

      expect(domNode?.isSymptom).toBe(true);
      expect(domNode?.status).toBe('symptom');
      expect(domNode?.relatedRuleCodes).toContain('R501');
    });
  });

  describe('supporting finding 标记', () => {
    it('should mark supporting findings on corresponding upstream nodes', () => {
      const context = createInspectContext({
        storeUpdated: false,
        selectorRan: false,
      });

      const topFinding = createFinding({
        ruleCode: 'R103',
        diagnosisLabel: '请求成功但状态未更新',
        layer: 'state',
        cluster: 'request_success_state_not_updated',
        confidence: 0.93,
        isSymptomOnly: false,
        evidenceRefs: ['ev_api_amount_0', 'ev_store_missing'],
      });

      const supporting = createFinding({
        ruleCode: 'R104',
        diagnosisLabel: 'selector 取值失败',
        layer: 'selector',
        cluster: 'selector_value_missing',
        confidence: 0.84,
        isSymptomOnly: false,
        evidenceRefs: ['ev_selector_missing'],
      });

      const conclusion = createConclusion({
        topFinding,
        supportingFindings: [supporting],
        diagnosisState: 'confirmed_root_cause',
      });

      const chain = builder.build(context, conclusion, [topFinding, supporting]);

      const stateNode = chain.find((node) => node.layer === 'state');
      const selectorNode = chain.find((node) => node.layer === 'selector');

      expect(stateNode?.isRootCause).toBe(true);
      expect(stateNode?.relatedRuleCodes).toContain('R103');
      expect(stateNode?.status).toBe('error');

      expect(selectorNode?.isSupporting).toBe(true);
      expect(selectorNode?.relatedRuleCodes).toContain('R104');
      expect(selectorNode?.status).toBe('warning');
    });
  });

  describe('click 场景链路', () => {
    it('should build ordered click chain from click -> handler -> request -> response -> state -> render -> dom', () => {
      const context = createClickContext({
        handlerStarted: false,
        requestSent: false,
      });

      const topFinding = createFinding({
        ruleCode: 'R401',
        diagnosisLabel: 'click 未触发 handler',
        layer: 'handler',
        cluster: 'click_handler_not_started',
        confidence: 0.95,
        isSymptomOnly: false,
        evidenceRefs: ['ev_click_trace', 'ev_handler_trace'],
      });

      const symptomFinding = createFinding({
        ruleCode: 'R503',
        diagnosisLabel: '链路中断于 request 之前',
        layer: 'request',
        cluster: 'pre_request_gap',
        confidence: 0.81,
        isSymptomOnly: true,
        evidenceRefs: ['ev_request_trace'],
      });

      const conclusion = createConclusion({
        topFinding,
        symptomFindings: [symptomFinding],
        diagnosisState: 'confirmed_root_cause',
      });

      const chain = builder.build(context, conclusion, [topFinding, symptomFinding]);

      expect(chain.map((node) => node.layer)).toEqual([
        'click',
        'handler',
        'request',
        'response',
        'state',
        'render',
        'dom',
      ]);

      const clickNode = chain.find((node) => node.layer === 'click');
      const handlerNode = chain.find((node) => node.layer === 'handler');
      const requestNode = chain.find((node) => node.layer === 'request');

      expect(clickNode?.status).toBe('ok');

      expect(handlerNode?.isRootCause).toBe(true);
      expect(handlerNode?.status).toBe('error');
      expect(handlerNode?.relatedRuleCodes).toContain('R401');

      expect(requestNode?.isSymptom).toBe(true);
      expect(requestNode?.status).toBe('symptom');
      expect(requestNode?.relatedRuleCodes).toContain('R503');
    });
  });

  describe('节点状态推导', () => {
    it('should mark hidden dom as warning/error according to finding mapping', () => {
      const context = createInspectContext({
        domUpdated: true,
        domVisible: false,
        domValue: '100.00',
        renderOutputValue: '100.00',
      });

      const topFinding = createFinding({
        ruleCode: 'R301',
        diagnosisLabel: 'DOM 被隐藏',
        layer: 'dom',
        cluster: 'dom_hidden',
        confidence: 0.91,
        isSymptomOnly: false,
        evidenceRefs: ['ev_dom_snapshot'],
      });

      const conclusion = createConclusion({
        topFinding,
        diagnosisState: 'confirmed_root_cause',
      });

      const chain = builder.build(context, conclusion, [topFinding]);

      const domNode = chain.find((node) => node.layer === 'dom');

      expect(domNode).toBeDefined();
      expect(domNode?.isRootCause).toBe(true);
      expect(domNode?.status).toBe('error');
      expect(domNode?.relatedRuleCodes).toContain('R301');
    });

    it('should keep unaffected nodes as ok', () => {
      const context = createInspectContext({
        renderOutputValue: '--',
        domValue: '--',
      });

      const topFinding = createFinding({
        ruleCode: 'R201',
        diagnosisLabel: '合法值被判空吞掉',
        layer: 'render',
        confidence: 0.95,
        isSymptomOnly: false,
      });

      const conclusion = createConclusion({
        topFinding,
        diagnosisState: 'confirmed_root_cause',
      });

      const chain = builder.build(context, conclusion, [topFinding]);

      const responseNode = chain.find((node) => node.layer === 'response');
      const stateNode = chain.find((node) => node.layer === 'state');
      const selectorNode = chain.find((node) => node.layer === 'selector');

      expect(responseNode?.status).toBe('ok');
      expect(stateNode?.status).toBe('ok');
      expect(selectorNode?.status).toBe('ok');
    });
  });

  describe('无 topFinding 的退化场景', () => {
    it('should still build a minimal inspect chain when no top finding exists', () => {
      const context = createInspectContext({
        domValue: '--',
      });

      const symptomFinding = createFinding({
        ruleCode: 'R501',
        diagnosisLabel: '页面显示占位值',
        layer: 'dom',
        confidence: 0.8,
        isSymptomOnly: true,
        evidenceRefs: ['ev_dom_snapshot'],
      });

      const conclusion = createConclusion({
        topFinding: null,
        symptomFindings: [symptomFinding],
        diagnosisState: 'no_rule_matched',
        summary: '现有规则未识别明确根因',
      });

      const chain = builder.build(context, conclusion, [symptomFinding]);

      expect(chain.length).toBeGreaterThan(0);

      const domNode = chain.find((node) => node.layer === 'dom');
      expect(domNode).toBeDefined();
      expect(domNode?.isRootCause).not.toBe(true);
      expect(domNode?.isSymptom).toBe(true);
      expect(domNode?.status).toBe('symptom');
    });

    it('should still build a click chain when no root cause is found', () => {
      const context = createClickContext({
        clickDetected: true,
        handlerStarted: true,
        requestSent: false,
      });

      const symptomFinding = createFinding({
        ruleCode: 'R503',
        diagnosisLabel: '链路中断于 request 之前',
        layer: 'request',
        confidence: 0.72,
        isSymptomOnly: true,
        evidenceRefs: ['ev_request_trace'],
      });

      const conclusion = createConclusion({
        topFinding: null,
        symptomFindings: [symptomFinding],
        diagnosisState: 'insufficient_evidence',
      });

      const chain = builder.build(context, conclusion, [symptomFinding]);

      expect(chain.map((node) => node.layer)).toEqual([
        'click',
        'handler',
        'request',
        'response',
        'state',
        'render',
        'dom',
      ]);

      const requestNode = chain.find((node) => node.layer === 'request');
      expect(requestNode?.isSymptom).toBe(true);
      expect(requestNode?.status).toBe('symptom');
    });
  });

  describe('relatedRuleCodes / evidenceRefs 聚合', () => {
    it('should aggregate multiple rule codes on the same node', () => {
      const context = createInspectContext({
        renderOutputValue: '--',
        domValue: '--',
      });

      const topFinding = createFinding({
        ruleCode: 'R201',
        diagnosisLabel: '合法值被判空吞掉',
        layer: 'render',
        isSymptomOnly: false,
        evidenceRefs: ['ev_api_amount_0', 'ev_render_trace'],
      });

      const supporting = createFinding({
        ruleCode: 'R202',
        diagnosisLabel: 'formatter 输出占位值',
        layer: 'render',
        isSymptomOnly: false,
        evidenceRefs: ['ev_render_trace', 'ev_formatter_output'],
      });

      const conclusion = createConclusion({
        topFinding,
        supportingFindings: [supporting],
        diagnosisState: 'confirmed_root_cause',
      });

      const chain = builder.build(context, conclusion, [topFinding, supporting]);

      const renderNode = chain.find((node) => node.layer === 'render');

      expect(renderNode?.relatedRuleCodes).toEqual(
        expect.arrayContaining(['R201', 'R202']),
      );

      expect(renderNode?.evidenceRefs).toEqual(
        expect.arrayContaining([
          'ev_api_amount_0',
          'ev_render_trace',
          'ev_formatter_output',
        ]),
      );
    });

    it('should deduplicate aggregated evidence refs', () => {
      const context = createInspectContext();

      const topFinding = createFinding({
        ruleCode: 'R103',
        layer: 'state',
        isSymptomOnly: false,
        evidenceRefs: ['ev_store_missing', 'ev_store_missing'],
      });

      const conclusion = createConclusion({
        topFinding,
        diagnosisState: 'confirmed_root_cause',
      });

      const chain = builder.build(context, conclusion, [topFinding]);

      const stateNode = chain.find((node) => node.layer === 'state');

      expect(stateNode?.evidenceRefs).toEqual(['ev_store_missing']);
    });
  });

  describe('节点 value 填充', () => {
    it('should expose meaningful values from context for each node', () => {
      const context = createInspectContext({
        apiValue: 0,
        storeValue: 0,
        selectorValue: 0,
        renderOutputValue: '--',
        domValue: '--',
      });

      const conclusion = createConclusion();

      const chain = builder.build(context, conclusion, []);

      const responseNode = chain.find((node) => node.layer === 'response');
      const stateNode = chain.find((node) => node.layer === 'state');
      const selectorNode = chain.find((node) => node.layer === 'selector');
      const renderNode = chain.find((node) => node.layer === 'render');
      const domNode = chain.find((node) => node.layer === 'dom');

      expect(responseNode?.value).toBe(0);
      expect(stateNode?.value).toBe(0);
      expect(selectorNode?.value).toBe(0);
      expect(renderNode?.value).toBe('--');
      expect(domNode?.value).toBe('--');
    });
  });

  describe('空 findings 输入', () => {
    it('should build chain safely when findings is empty', () => {
      const context = createInspectContext();
      const conclusion = createConclusion({
        topFinding: null,
        supportingFindings: [],
        symptomFindings: [],
        diagnosisState: 'no_rule_matched',
      });

      const chain = builder.build(context, conclusion, []);

      expect(Array.isArray(chain)).toBe(true);
      expect(chain.length).toBeGreaterThan(0);
      expect(chain.every((node) => node.id && node.layer && node.status)).toBe(
        true,
      );
    });
  });
});
```

---

# 4. 这组测试覆盖了什么

---

## 4.1 inspect 链路顺序
验证 inspect 模式下链路顺序稳定：

```ts
response -> state -> selector -> render -> dom
```

这对前端多米诺展示非常关键，顺序一乱，因果感就没了。

---

## 4.2 click 链路顺序
验证 click 模式下链路顺序：

```ts
click -> handler -> request -> response -> state -> render -> dom
```

这是你“点击后数据流 / 因果链展示”的核心基础。

---

## 4.3 root / supporting / symptom 标记
分别验证：

- `isRootCause`
- `isSupporting`
- `isSymptom`

确保 builder 产出的链能直接喂给前端做不同视觉样式。

---

## 4.4 节点状态映射
验证：

- root cause 节点 -> `error`
- supporting 节点 -> `warning`
- symptom 节点 -> `symptom`
- 未受影响节点 -> `ok`

如果你后续改成别的状态枚举，比如：
- `healthy`
- `degraded`
- `broken`

测试只要同步改断言即可。

---

## 4.5 无根因时的退化能力
MVP 很需要这个：

- 没 topFinding 也要能画链
- 不能因为规则未命中就前端空白

---

## 4.6 同节点规则与证据聚合
这个很重要。  
因为一个节点经常会被多个 finding 指向，比如 render 节点同时关联：

- `R201`
- `R202`

这时 builder 要把：
- `relatedRuleCodes`
- `evidenceRefs`

聚合并去重。

---

## 4.7 节点 value 是否可展示
前端做骨牌卡片时，一般都会想展示每一层当前值，例如：

- response = `0`
- state = `0`
- selector = `0`
- render = `--`
- dom = `--`

这个测试就是保障这些字段不丢。

---

# 5. 一个可对齐的 `DominoChainBuilder` 实现思路

如果你现在还没完全写完 builder，测试对应的实现大致可以按这个方向：

```ts
build(context, conclusion, findings) {
  const layers =
    context.mode === 'click_diagnosis'
      ? ['click', 'handler', 'request', 'response', 'state', 'render', 'dom']
      : ['response', 'state', 'selector', 'render', 'dom'];

  const nodeMap = new Map();

  for (const layer of layers) {
    nodeMap.set(layer, {
      id: `node_${layer}`,
      layer,
      label: this.buildLabel(layer, context),
      value: this.extractValue(layer, context),
      status: 'ok',
      relatedRuleCodes: [],
      evidenceRefs: [],
    });
  }

  const topRuleCode = conclusion.topFinding?.ruleCode;
  const supportingCodes = new Set(
    (conclusion.supportingFindings ?? []).map((f) => f.ruleCode),
  );
  const symptomCodes = new Set(
    (conclusion.symptomFindings ?? []).map((f) => f.ruleCode),
  );

  for (const finding of findings) {
    const node = nodeMap.get(this.normalizeLayer(finding.layer));
    if (!node) continue;

    node.relatedRuleCodes.push(finding.ruleCode);
    node.evidenceRefs.push(...(finding.evidenceRefs ?? []));

    if (finding.ruleCode === topRuleCode) {
      node.isRootCause = true;
      node.status = 'error';
    } else if (supportingCodes.has(finding.ruleCode)) {
      node.isSupporting = true;
      if (node.status === 'ok') node.status = 'warning';
    } else if (symptomCodes.has(finding.ruleCode)) {
      node.isSymptom = true;
      if (node.status === 'ok') node.status = 'symptom';
    }
  }

  return [...nodeMap.values()].map((node) => ({
    ...node,
    relatedRuleCodes: [...new Set(node.relatedRuleCodes)],
    evidenceRefs: [...new Set(node.evidenceRefs)],
  }));
}
```

---

# 6. 推荐你再补的 3 类测试

---

## 6.1 layer normalize 测试
如果 rule 的 `layer` 和 domino node 的 `layer` 不是完全一一对应，比如：

- `ui` -> `dom`
- `api` -> `response`
- `request_to_ui` -> `request`

那建议补一组映射测试。

---

## 6.2 节点裁剪测试
如果你后面想让前端链路更简洁，可能会做：
- 不显示完全无证据的节点
- 或折叠连续 `ok` 节点

那就需要补：
- `compact mode`
- `full mode`

两套测试。

---

## 6.3 断点位置高亮测试
你这个产品很适合加一个：

```ts
isBreakpoint: true
```

例如：
- handler 没起 -> handler 是断点
- request 没发 -> request 是断点
- DOM 没更新 -> dom 是断点

这个非常利于“多米诺停在哪一块”的视觉表达。

---

# 7. 下一步我建议做什么

你现在已经基本把 diagnosis 核心链的测试骨架补齐了。  
下一步最值得做的是这两个之一：

## 方案 A
**`ExplanationBuilder` Jest 单测样例**
把解释文本生成也固化住。

## 方案 B
**直接给你 diagnosis 模块完整目录 + 文件骨架**
包括：

- `application/`
- `domain/`
- `builders/`
- `dto/`
- `models/`
- `repository/`
- `spec/`

并且按 NestJS 可直接放项目。

---

如果按工程价值排序，我建议下一步直接做：  
**`ExplanationBuilder` Jest 单测样例**。