下面直接给你 **Diagnosis 场景级 fixtures 完整代码**。  
目标是让你的 integration / orchestration tests 从“拼很多对象”变成“直接拿一个场景”。

这套我建议放在：

```bash
src/modules/diagnosis/__tests__/fixtures/
```

与基础 `helpers/` 分层：

- `helpers/`：原子构造器
- `fixtures/`：场景级组合数据

---

# 1. 推荐目录结构

```bash
src/modules/diagnosis/__tests__/
├── helpers/
│   └── ...
└── fixtures/
    ├── build-inspect-api-field-missing-scenario.ts
    ├── build-inspect-falsy-swallowed-scenario.ts
    ├── build-inspect-dom-not-updated-scenario.ts
    ├── build-click-handler-not-started-scenario.ts
    ├── build-click-request-not-sent-scenario.ts
    ├── types.ts
    └── index.ts
```

---

# 2. 先定义统一场景类型

## `src/modules/diagnosis/__tests__/fixtures/types.ts`

```ts
import { DiagnosisContext } from '../../domain/models/diagnosis-context.model';
import { RuleFinding } from '../../domain/models/rule-finding.model';
import { DiagnosisConclusion } from '../../domain/models/diagnosis-conclusion.model';
import { buildDiagnosisTask } from '../helpers/build-task';
import { buildDiagnosisExplanation } from '../helpers/build-explanation';
import { buildDominoChain } from '../helpers/build-domino-chain';

export type DiagnosisTaskFixture = ReturnType<typeof buildDiagnosisTask>;
export type DiagnosisExplanationFixture = ReturnType<typeof buildDiagnosisExplanation>;
export type DominoChainFixture = ReturnType<typeof buildDominoChain>;

export interface DiagnosisScenarioFixture {
  name: string;
  task: DiagnosisTaskFixture;
  context: DiagnosisContext;
  findings: RuleFinding[];
  conclusion: DiagnosisConclusion;
  explanation: DiagnosisExplanationFixture;
  dominoChain: DominoChainFixture;
}
```

---

# 3. inspect：接口字段缺失场景

这个场景适合覆盖：

- `R101` top finding
- `R103` supporting
- `R501` symptom
- 上游根因压过下游症状

---

## `src/modules/diagnosis/__tests__/fixtures/build-inspect-api-field-missing-scenario.ts`

```ts
import { DiagnosisState } from '../../domain/enums/diagnosis-state.enum';
import {
  buildDiagnosisConclusion,
  buildDiagnosisContext,
  buildDiagnosisExplanation,
  buildDiagnosisTask,
  buildDominoChain,
  buildRuleFinding,
} from '../helpers';
import { DiagnosisScenarioFixture } from './types';

export const buildInspectApiFieldMissingScenario =
  (): DiagnosisScenarioFixture => {
    const task = buildDiagnosisTask({
      id: 'diag_inspect_api_field_missing',
      mode: 'inspect_diagnosis',
      target: {
        pageUrl: '/demo/detail',
        selector: '#amount',
      },
      createdAt: '2026-06-12T07:00:00.000Z',
    });

    const context = buildDiagnosisContext({
      diagnosisId: task.id,
      mode: 'inspect_diagnosis',
      responseSuccess: true,
      apiFieldPath: 'response.data.amount',
      apiFieldExists: false,
      apiValue: undefined,
      storeUpdated: false,
      selectorRan: false,
      renderTriggered: false,
      renderCommitted: false,
      domUpdated: false,
      domVisible: true,
      domValue: '--',
      displayedValue: '--',
    });

    const topFinding = buildRuleFinding({
      ruleCode: 'R101',
      title: '接口字段缺失',
      diagnosisLabel: '接口字段缺失',
      category: 'data_source',
      severity: 'high',
      confidence: 0.95,
      layer: 'api',
      cluster: 'api_field_missing',
      summary: '接口响应中缺少 response.data.amount，导致下游无法获得目标值。',
      evidenceRefs: ['ev_api_1', 'ev_api_2'],
      suggestions: ['检查接口返回字段路径', '检查字段映射路径配置'],
      isSymptomOnly: false,
    });

    const supportingFinding = buildRuleFinding({
      ruleCode: 'R103',
      title: '请求成功但状态未更新',
      diagnosisLabel: '请求成功但状态未更新',
      category: 'state_binding',
      severity: 'medium',
      confidence: 0.86,
      layer: 'state',
      cluster: 'state_not_updated',
      summary: '接口虽已返回，但 store 未写入可用值。',
      evidenceRefs: ['ev_state_1'],
      suggestions: ['检查 dispatch/commit 是否执行'],
      isSymptomOnly: false,
    });

    const symptomFinding = buildRuleFinding({
      ruleCode: 'R501',
      title: '页面显示占位值',
      diagnosisLabel: '页面显示占位值',
      category: 'symptom',
      severity: 'low',
      confidence: 0.8,
      layer: 'ui',
      cluster: 'fallback_displayed',
      summary: '页面最终展示为占位值 --。',
      evidenceRefs: ['ev_ui_1'],
      suggestions: ['继续检查上游链路'],
      isSymptomOnly: true,
    });

    const findings = [topFinding, supportingFinding, symptomFinding];

    const conclusion = buildDiagnosisConclusion({
      topFinding,
      supportingFindings: [supportingFinding],
      symptomFindings: [symptomFinding],
      diagnosisState: DiagnosisState.CONFIRMED_ROOT_CAUSE,
      summary: '已定位到根因：接口字段缺失。',
      repairHints: [
        '检查接口返回字段路径',
        '检查字段映射路径配置',
        '检查 dispatch/commit 是否执行',
      ],
      scoreBreakdown: [
        {
          ruleCode: 'R101',
          finalScore: 1.355,
          reason: ['根因规则优先', '上游 API 层优先级最高'],
        },
        {
          ruleCode: 'R103',
          finalScore: 1.02,
          reason: ['状态层异常支撑上游根因'],
        },
        {
          ruleCode: 'R501',
          finalScore: 0.61,
          reason: ['症状规则已降权'],
        },
      ],
    });

    const explanation = buildDiagnosisExplanation({
      summaryText:
        '已确认根因：接口字段缺失。接口响应中缺少 response.data.amount，导致下游无法获得目标值。',
      evidenceNarrative: [
        '核心证据：接口字段缺失。接口响应中缺少 response.data.amount，导致下游无法获得目标值。证据引用: ev_api_1, ev_api_2。',
        '辅助证据：请求成功但状态未更新。接口虽已返回，但 store 未写入可用值。证据引用: ev_state_1。',
      ],
      operatorAdvice: [
        '建议处理：检查接口返回字段路径',
        '建议处理：检查字段映射路径配置',
        '建议处理：检查 dispatch/commit 是否执行',
      ],
      symptomNotes: ['观察到症状：页面显示占位值。页面最终展示为占位值 --。'],
    });

    const dominoChain = buildDominoChain({
      mode: 'inspect_diagnosis',
      nodes: [
        {
          id: 'response',
          type: 'response',
          label: '接口响应',
          status: 'broken',
          relatedRuleCodes: ['R101'],
          evidenceRefs: ['ev_api_1', 'ev_api_2'],
          isRootCause: true,
        },
        {
          id: 'state',
          type: 'state',
          label: '状态更新',
          status: 'suspect',
          relatedRuleCodes: ['R103'],
          evidenceRefs: ['ev_state_1'],
          isSupporting: true,
        },
        {
          id: 'selector',
          type: 'selector',
          label: '数据选择',
          status: 'healthy',
          relatedRuleCodes: [],
          evidenceRefs: [],
        },
        {
          id: 'render',
          type: 'render',
          label: '渲染计算',
          status: 'healthy',
          relatedRuleCodes: [],
          evidenceRefs: [],
        },
        {
          id: 'dom',
          type: 'dom',
          label: 'DOM 更新',
          status: 'healthy',
          relatedRuleCodes: [],
          evidenceRefs: [],
        },
        {
          id: 'ui',
          type: 'ui',
          label: '页面展示',
          status: 'symptom',
          relatedRuleCodes: ['R501'],
          evidenceRefs: ['ev_ui_1'],
          isSymptom: true,
        },
      ],
    });

    return {
      name: 'inspect-api-field-missing',
      task,
      context,
      findings,
      conclusion,
      explanation,
      dominoChain,
    };
  };
```

---

# 4. inspect：合法值被吞 / fallback 显示场景

这个场景适合覆盖：

- `R201` top finding
- `R202` supporting
- `R501` symptom

---

## `src/modules/diagnosis/__tests__/fixtures/build-inspect-falsy-swallowed-scenario.ts`

```ts
import { DiagnosisState } from '../../domain/enums/diagnosis-state.enum';
import {
  buildDiagnosisConclusion,
  buildDiagnosisContext,
  buildDiagnosisExplanation,
  buildDiagnosisTask,
  buildDominoChain,
  buildRuleFinding,
} from '../helpers';
import { DiagnosisScenarioFixture } from './types';

export const buildInspectFalsySwallowedScenario =
  (): DiagnosisScenarioFixture => {
    const task = buildDiagnosisTask({
      id: 'diag_inspect_falsy_swallowed',
      mode: 'inspect_diagnosis',
      target: {
        pageUrl: '/demo/detail',
        selector: '#amount',
      },
    });

    const context = buildDiagnosisContext({
      diagnosisId: task.id,
      mode: 'inspect_diagnosis',
      responseSuccess: true,
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

    const topFinding = buildRuleFinding({
      ruleCode: 'R201',
      title: '合法值被判空吞掉',
      diagnosisLabel: '合法值被判空吞掉',
      category: 'render_transform',
      severity: 'high',
      confidence: 0.96,
      layer: 'render',
      cluster: 'formatter_shared_cluster',
      summary: '输入值为 0，但 formatter 采用 falsy 判定后输出占位值。',
      evidenceRefs: ['ev_render_1', 'ev_render_2'],
      suggestions: ['将 if (!value) 改为 value == null', '保留 0 值'],
      isSymptomOnly: false,
    });

    const supportingFinding = buildRuleFinding({
      ruleCode: 'R202',
      title: 'formatter 输出占位值',
      diagnosisLabel: 'formatter 输出占位值',
      category: 'render_transform',
      severity: 'medium',
      confidence: 0.88,
      layer: 'render',
      cluster: 'formatter_shared_cluster',
      summary: 'formatter 最终输出了占位值 --。',
      evidenceRefs: ['ev_render_3'],
      suggestions: ['检查 formatter fallback 逻辑'],
      isSymptomOnly: false,
    });

    const symptomFinding = buildRuleFinding({
      ruleCode: 'R501',
      title: '页面显示占位值',
      diagnosisLabel: '页面显示占位值',
      category: 'symptom',
      severity: 'low',
      confidence: 0.8,
      layer: 'ui',
      cluster: 'fallback_displayed',
      summary: '页面最终显示为 --。',
      evidenceRefs: ['ev_ui_1'],
      suggestions: ['继续检查渲染链路'],
      isSymptomOnly: true,
    });

    const findings = [topFinding, supportingFinding, symptomFinding];

    const conclusion = buildDiagnosisConclusion({
      topFinding,
      supportingFindings: [],
      symptomFindings: [symptomFinding],
      diagnosisState: DiagnosisState.CONFIRMED_ROOT_CAUSE,
      summary: '已定位到根因：合法值被判空吞掉。',
      repairHints: [
        '将 if (!value) 改为 value == null',
        '保留 0 值',
        '检查 formatter fallback 逻辑',
      ],
      scoreBreakdown: [
        {
          ruleCode: 'R201',
          finalScore: 1.39,
          reason: ['根因规则优先', 'render 层异常可直接解释 UI 症状'],
        },
        {
          ruleCode: 'R202',
          finalScore: 1.01,
          reason: ['同 cluster 规则已做去重降权'],
        },
        {
          ruleCode: 'R501',
          finalScore: 0.61,
          reason: ['症状规则已降权'],
        },
      ],
    });

    const explanation = buildDiagnosisExplanation({
      summaryText:
        '已确认根因：合法值被判空吞掉。输入值为 0，但 formatter 采用 falsy 判定后输出占位值。',
      evidenceNarrative: [
        '核心证据：合法值被判空吞掉。输入值为 0，但 formatter 采用 falsy 判定后输出占位值。证据引用: ev_render_1, ev_render_2。',
      ],
      operatorAdvice: [
        '建议处理：将 if (!value) 改为 value == null',
        '建议处理：保留 0 值',
        '建议处理：检查 formatter fallback 逻辑',
      ],
      symptomNotes: ['观察到症状：页面显示占位值。页面最终显示为 --。'],
    });

    const dominoChain = buildDominoChain({
      mode: 'inspect_diagnosis',
      nodes: [
        {
          id: 'response',
          type: 'response',
          label: '接口响应',
          status: 'healthy',
          relatedRuleCodes: [],
          evidenceRefs: [],
        },
        {
          id: 'state',
          type: 'state',
          label: '状态更新',
          status: 'healthy',
          relatedRuleCodes: [],
          evidenceRefs: [],
        },
        {
          id: 'selector',
          type: 'selector',
          label: '数据选择',
          status: 'healthy',
          relatedRuleCodes: [],
          evidenceRefs: [],
        },
        {
          id: 'render',
          type: 'render',
          label: '渲染计算',
          status: 'broken',
          relatedRuleCodes: ['R201', 'R202'],
          evidenceRefs: ['ev_render_1', 'ev_render_2', 'ev_render_3'],
          isRootCause: true,
          isSupporting: true,
        },
        {
          id: 'dom',
          type: 'dom',
          label: 'DOM 更新',
          status: 'healthy',
          relatedRuleCodes: [],
          evidenceRefs: [],
        },
        {
          id: 'ui',
          type: 'ui',
          label: '页面展示',
          status: 'symptom',
          relatedRuleCodes: ['R501'],
          evidenceRefs: ['ev_ui_1'],
          isSymptom: true,
        },
      ],
    });

    return {
      name: 'inspect-falsy-swallowed',
      task,
      context,
      findings,
      conclusion,
      explanation,
      dominoChain,
    };
  };
```

---

# 5. inspect：DOM 未更新场景

这个场景适合覆盖：

- `R302` top finding
- `R502` symptom
- `PROBABLE_ROOT_CAUSE`

---

## `src/modules/diagnosis/__tests__/fixtures/build-inspect-dom-not-updated-scenario.ts`

```ts
import { DiagnosisState } from '../../domain/enums/diagnosis-state.enum';
import {
  buildDiagnosisConclusion,
  buildDiagnosisContext,
  buildDiagnosisExplanation,
  buildDiagnosisTask,
  buildDominoChain,
  buildRuleFinding,
} from '../helpers';
import { DiagnosisScenarioFixture } from './types';

export const buildInspectDomNotUpdatedScenario =
  (): DiagnosisScenarioFixture => {
    const task = buildDiagnosisTask({
      id: 'diag_inspect_dom_not_updated',
      mode: 'inspect_diagnosis',
      target: {
        pageUrl: '/demo/detail',
        selector: '#amount',
      },
    });

    const context = buildDiagnosisContext({
      diagnosisId: task.id,
      mode: 'inspect_diagnosis',
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
      formatterOutputIsFallback: false,
      domUpdated: false,
      domVisible: true,
      domValue: '--',
      displayedValue: '--',
    });

    const topFinding = buildRuleFinding({
      ruleCode: 'R302',
      title: 'DOM 未反映最新渲染结果',
      diagnosisLabel: 'DOM 未反映最新渲染结果',
      category: 'dom',
      severity: 'medium',
      confidence: 0.84,
      layer: 'dom',
      cluster: 'dom_not_updated',
      summary: 'render 已产出新值，但 DOM 未同步更新。',
      evidenceRefs: ['ev_dom_1'],
      suggestions: ['检查 commit / DOM 更新链路'],
      isSymptomOnly: false,
    });

    const symptomFinding = buildRuleFinding({
      ruleCode: 'R502',
      title: 'render 与 DOM 不一致',
      diagnosisLabel: 'render 与 DOM 不一致',
      category: 'symptom',
      severity: 'low',
      confidence: 0.79,
      layer: 'dom',
      cluster: 'render_dom_gap',
      summary: 'render 输出为 100，但 DOM 仍为 --。',
      evidenceRefs: ['ev_dom_2'],
      suggestions: ['继续核查 DOM patch / commit 流程'],
      isSymptomOnly: true,
    });

    const findings = [topFinding, symptomFinding];

    const conclusion = buildDiagnosisConclusion({
      topFinding,
      supportingFindings: [],
      symptomFindings: [symptomFinding],
      diagnosisState: DiagnosisState.PROBABLE_ROOT_CAUSE,
      summary: '高概率根因：DOM 未反映最新渲染结果。',
      repairHints: ['检查 commit / DOM 更新链路'],
      scoreBreakdown: [
        {
          ruleCode: 'R302',
          finalScore: 1.03,
          reason: ['根因规则优先', 'DOM 层问题可直接解释页面异常'],
        },
        {
          ruleCode: 'R502',
          finalScore: 0.58,
          reason: ['症状规则已降权'],
        },
      ],
    });

    const explanation = buildDiagnosisExplanation({
      summaryText:
        '高概率根因：DOM 未反映最新渲染结果。render 已产出新值，但 DOM 未同步更新。',
      evidenceNarrative: [
        '核心证据：DOM 未反映最新渲染结果。render 已产出新值，但 DOM 未同步更新。证据引用: ev_dom_1。',
      ],
      operatorAdvice: ['建议处理：检查 commit / DOM 更新链路'],
      symptomNotes: ['观察到症状：render 与 DOM 不一致。render 输出为 100，但 DOM 仍为 --。'],
    });

    const dominoChain = buildDominoChain({
      mode: 'inspect_diagnosis',
      nodes: [
        {
          id: 'response',
          type: 'response',
          label: '接口响应',
          status: 'healthy',
          relatedRuleCodes: [],
          evidenceRefs: [],
        },
        {
          id: 'state',
          type: 'state',
          label: '状态更新',
          status: 'healthy',
          relatedRuleCodes: [],
          evidenceRefs: [],
        },
        {
          id: 'selector',
          type: 'selector',
          label: '数据选择',
          status: 'healthy',
          relatedRuleCodes: [],
          evidenceRefs: [],
        },
        {
          id: 'render',
          type: 'render',
          label: '渲染计算',
          status: 'healthy',
          relatedRuleCodes: [],
          evidenceRefs: [],
        },
        {
          id: 'dom',
          type: 'dom',
          label: 'DOM 更新',
          status: 'broken',
          relatedRuleCodes: ['R302', 'R502'],
          evidenceRefs: ['ev_dom_1', 'ev_dom_2'],
          isRootCause: true,
          isSymptom: true,
        },
        {
          id: 'ui',
          type: 'ui',
          label: '页面展示',
          status: 'healthy',
          relatedRuleCodes: [],
          evidenceRefs: [],
        },
      ],
    });

    return {
      name: 'inspect-dom-not-updated',
      task,
      context,
      findings,
      conclusion,
      explanation,
      dominoChain,
    };
  };
```

---

# 6. click：handler 未启动场景

这个场景适合覆盖：

- `R401` top finding
- `R503` symptom / gap
- click 模式链路

---

## `src/modules/diagnosis/__tests__/fixtures/build-click-handler-not-started-scenario.ts`

```ts
import { DiagnosisState } from '../../domain/enums/diagnosis-state.enum';
import {
  buildDiagnosisConclusion,
  buildDiagnosisContext,
  buildDiagnosisExplanation,
  buildDiagnosisTask,
  buildDominoChain,
  buildRuleFinding,
} from '../helpers';
import { DiagnosisScenarioFixture } from './types';

export const buildClickHandlerNotStartedScenario =
  (): DiagnosisScenarioFixture => {
    const task = buildDiagnosisTask({
      id: 'diag_click_handler_not_started',
      mode: 'click_diagnosis',
      target: {
        pageUrl: '/demo/list',
        selector: '#submit-btn',
        actionId: 'click-submit',
      },
    });

    const context = buildDiagnosisContext({
      diagnosisId: task.id,
      mode: 'click_diagnosis',
      clickDetected: true,
      handlerStarted: false,
      requestSent: false,
      responseSuccess: false,
      storeUpdated: false,
      renderTriggered: false,
      domUpdated: false,
      displayedValue: '--',
    });

    const topFinding = buildRuleFinding({
      ruleCode: 'R401',
      title: '点击后 handler 未启动',
      diagnosisLabel: '点击后 handler 未启动',
      category: 'interaction',
      severity: 'high',
      confidence: 0.93,
      layer: 'handler',
      cluster: 'click_handler_not_started',
      summary: '点击事件已发生，但未进入业务处理函数。',
      evidenceRefs: ['ev_click_1'],
      suggestions: ['检查事件绑定是否生效', '检查节点是否被遮挡或禁用'],
      isSymptomOnly: false,
    });

    const symptomFinding = buildRuleFinding({
      ruleCode: 'R503',
      title: '请求前链路中断',
      diagnosisLabel: '请求前链路中断',
      category: 'symptom',
      severity: 'low',
      confidence: 0.78,
      layer: 'request_to_ui',
      cluster: 'pre_request_gap',
      summary: '点击后流程未推进到请求发送阶段。',
      evidenceRefs: ['ev_gap_1'],
      suggestions: ['继续检查 click -> handler -> request 链路'],
      isSymptomOnly: true,
    });

    const findings = [topFinding, symptomFinding];

    const conclusion = buildDiagnosisConclusion({
      topFinding,
      supportingFindings: [],
      symptomFindings: [symptomFinding],
      diagnosisState: DiagnosisState.CONFIRMED_ROOT_CAUSE,
      summary: '已定位到根因：点击后 handler 未启动。',
      repairHints: ['检查事件绑定是否生效', '检查节点是否被遮挡或禁用'],
      scoreBreakdown: [
        {
          ruleCode: 'R401',
          finalScore: 1.31,
          reason: ['根因规则优先', '点击链路起点问题优先级最高'],
        },
        {
          ruleCode: 'R503',
          finalScore: 0.57,
          reason: ['症状规则已降权'],
        },
      ],
    });

    const explanation = buildDiagnosisExplanation({
      summaryText:
        '已确认点击链路根因：点击后 handler 未启动。点击事件已发生，但未进入业务处理函数。',
      evidenceNarrative: [
        '核心证据：点击后 handler 未启动。点击事件已发生，但未进入业务处理函数。证据引用: ev_click_1。',
      ],
      operatorAdvice: ['建议处理：检查事件绑定是否生效', '建议处理：检查节点是否被遮挡或禁用'],
      symptomNotes: ['观察到症状：请求前链路中断。点击后流程未推进到请求发送阶段。'],
    });

    const dominoChain = buildDominoChain({
      mode: 'click_diagnosis',
      nodes: [
        {
          id: 'interaction',
          type: 'interaction',
          label: '用户交互',
          status: 'broken',
          relatedRuleCodes: ['R401'],
          evidenceRefs: ['ev_click_1'],
          isRootCause: true,
        },
        {
          id: 'request',
          type: 'request',
          label: '请求发送',
          status: 'symptom',
          relatedRuleCodes: ['R503'],
          evidenceRefs: ['ev_gap_1'],
          isSymptom: true,
        },
        {
          id: 'response',
          type: 'response',
          label: '接口响应',
          status: 'healthy',
          relatedRuleCodes: [],
          evidenceRefs: [],
        },
        {
          id: 'state',
          type: 'state',
          label: '状态更新',
          status: 'healthy',
          relatedRuleCodes: [],
          evidenceRefs: [],
        },
        {
          id: 'render',
          type: 'render',
          label: '渲染计算',
          status: 'healthy',
          relatedRuleCodes: [],
          evidenceRefs: [],
        },
        {
          id: 'dom',
          type: 'dom',
          label: 'DOM 更新',
          status: 'healthy',
          relatedRuleCodes: [],
          evidenceRefs: [],
        },
        {
          id: 'ui',
          type: 'ui',
          label: '页面展示',
          status: 'healthy',
          relatedRuleCodes: [],
          evidenceRefs: [],
        },
      ],
    });

    return {
      name: 'click-handler-not-started',
      task,
      context,
      findings,
      conclusion,
      explanation,
      dominoChain,
    };
  };
```

---

# 7. click：request 未发送场景

这个场景适合覆盖：

- `R402` top finding
- `R503` symptom
- click 链 request 节点 broken

---

## `src/modules/diagnosis/__tests__/fixtures/build-click-request-not-sent-scenario.ts`

```ts
import { DiagnosisState } from '../../domain/enums/diagnosis-state.enum';
import {
  buildDiagnosisConclusion,
  buildDiagnosisContext,
  buildDiagnosisExplanation,
  buildDiagnosisTask,
  buildDominoChain,
  buildRuleFinding,
} from '../helpers';
import { DiagnosisScenarioFixture } from './types';

export const buildClickRequestNotSentScenario =
  (): DiagnosisScenarioFixture => {
    const task = buildDiagnosisTask({
      id: 'diag_click_request_not_sent',
      mode: 'click_diagnosis',
      target: {
        pageUrl: '/demo/list',
        selector: '#submit-btn',
        actionId: 'click-submit',
      },
    });

    const context = buildDiagnosisContext({
      diagnosisId: task.id,
      mode: 'click_diagnosis',
      clickDetected: true,
      handlerStarted: true,
      requestSent: false,
      responseSuccess: false,
      storeUpdated: false,
      renderTriggered: false,
      domUpdated: false,
      displayedValue: '--',
    });

    const topFinding = buildRuleFinding({
      ruleCode: 'R402',
      title: 'handler 执行但 request 未发送',
      diagnosisLabel: 'handler 执行但 request 未发送',
      category: 'interaction',
      severity: 'high',
      confidence: 0.91,
      layer: 'request',
      cluster: 'handler_started_request_not_sent',
      summary: '点击事件已进入 handler，但未实际发出请求。',
      evidenceRefs: ['ev_request_1'],
      suggestions: ['检查 handler 中请求触发条件', '检查早返回分支是否拦截请求发送'],
      isSymptomOnly: false,
    });

    const symptomFinding = buildRuleFinding({
      ruleCode: 'R503',
      title: '请求前链路中断',
      diagnosisLabel: '请求前链路中断',
      category: 'symptom',
      severity: 'low',
      confidence: 0.78,
      layer: 'request_to_ui',
      cluster: 'pre_request_gap',
      summary: '点击后链路未推进到接口请求阶段。',
      evidenceRefs: ['ev_gap_1'],
      suggestions: ['继续检查 handler -> request 触发路径'],
      isSymptomOnly: true,
    });

    const findings = [topFinding, symptomFinding];

    const conclusion = buildDiagnosisConclusion({
      topFinding,
      supportingFindings: [],
      symptomFindings: [symptomFinding],
      diagnosisState: DiagnosisState.CONFIRMED_ROOT_CAUSE,
      summary: '已定位到根因：handler 执行但 request 未发送。',
      repairHints: ['检查 handler 中请求触发条件', '检查早返回分支是否拦截请求发送'],
      scoreBreakdown: [
        {
          ruleCode: 'R402',
          finalScore: 1.27,
          reason: ['根因规则优先', 'request 层异常可直接解释下游空白'],
        },
        {
          ruleCode: 'R503',
          finalScore: 0.57,
          reason: ['症状规则已降权'],
        },
      ],
    });

    const explanation = buildDiagnosisExplanation({
      summaryText:
        '已确认点击链路根因：handler 执行但 request 未发送。点击事件已进入 handler，但未实际发出请求。',
      evidenceNarrative: [
        '核心证据：handler 执行但 request 未发送。点击事件已进入 handler，但未实际发出请求。证据引用: ev_request_1。',
      ],
      operatorAdvice: [
        '建议处理：检查 handler 中请求触发条件',
        '建议处理：检查早返回分支是否拦截请求发送',
      ],
      symptomNotes: ['观察到症状：请求前链路中断。点击后链路未推进到接口请求阶段。'],
    });

    const dominoChain = buildDominoChain({
      mode: 'click_diagnosis',
      nodes: [
        {
          id: 'interaction',
          type: 'interaction',
          label: '用户交互',
          status: 'healthy',
          relatedRuleCodes: [],
          evidenceRefs: [],
        },
        {
          id: 'request',
          type: 'request',
          label: '请求发送',
          status: 'broken',
          relatedRuleCodes: ['R402', 'R503'],
          evidenceRefs: ['ev_request_1', 'ev_gap_1'],
          isRootCause: true,
          isSymptom: true,
        },
        {
          id: 'response',
          type: 'response',
          label: '接口响应',
          status: 'healthy',
          relatedRuleCodes: [],
          evidenceRefs: [],
        },
        {
          id: 'state',
          type: 'state',
          label: '状态更新',
          status: 'healthy',
          relatedRuleCodes: [],
          evidenceRefs: [],
        },
        {
          id: 'render',
          type: 'render',
          label: '渲染计算',
          status: 'healthy',
          relatedRuleCodes: [],
          evidenceRefs: [],
        },
        {
          id: 'dom',
          type: 'dom',
          label: 'DOM 更新',
          status: 'healthy',
          relatedRuleCodes: [],
          evidenceRefs: [],
        },
        {
          id: 'ui',
          type: 'ui',
          label: '页面展示',
          status: 'healthy',
          relatedRuleCodes: [],
          evidenceRefs: [],
        },
      ],
    });

    return {
      name: 'click-request-not-sent',
      task,
      context,
      findings,
      conclusion,
      explanation,
      dominoChain,
    };
  };
```

---

# 8. 统一导出

## `src/modules/diagnosis/__tests__/fixtures/index.ts`

```ts
export * from './types';
export * from './build-inspect-api-field-missing-scenario';
export * from './build-inspect-falsy-swallowed-scenario';
export * from './build-inspect-dom-not-updated-scenario';
export * from './build-click-handler-not-started-scenario';
export * from './build-click-request-not-sent-scenario';
```

---

# 9. 使用示例

---

## 9.1 用在 `DiagnosisQueryService` integration spec

```ts
import {
  buildInspectApiFieldMissingScenario,
} from '../fixtures';

it('should execute lazy diagnosis with inspect api field missing scenario', async () => {
  const scenario = buildInspectApiFieldMissingScenario();

  repository.findTaskById.mockResolvedValue(scenario.task);
  repository.findResultByDiagnosisId.mockResolvedValue(null);

  contextBuilder.build.mockResolvedValue(scenario.context);
  ruleEngineService.run.mockReturnValue(scenario.findings);
  diagnosisConclusionService.conclude.mockReturnValue(scenario.conclusion);
  explanationBuilder.build.mockReturnValue(scenario.explanation);
  dominoChainBuilder.build.mockReturnValue(scenario.dominoChain);

  const result = await service.getById(scenario.task.id);

  expect(result.conclusion.topFinding?.ruleCode).toBe('R101');
});
```

---

## 9.2 用在 `ExplanationBuilder` integration spec

```ts
import { buildClickRequestNotSentScenario } from '../fixtures';

it('should build click explanation from scenario fixture', () => {
  const scenario = buildClickRequestNotSentScenario();

  const explanation = builder.build(scenario.conclusion, scenario.context);

  expect(explanation.summaryText).toContain('已确认点击链路根因');
  expect(explanation.operatorAdvice).toContain(
    '建议处理：检查 handler 中请求触发条件',
  );
});
```

---

## 9.3 用在 `DominoChainBuilder` integration spec

```ts
import { buildInspectDomNotUpdatedScenario } from '../fixtures';

it('should build domino chain for dom not updated scenario', () => {
  const scenario = buildInspectDomNotUpdatedScenario();

  const chain = builder.build(scenario.conclusion, scenario.context);

  expect(chain.nodes.find((x) => x.type === 'dom')?.status).toBe('broken');
});
```

---

# 10. 我建议你再补一个“场景工厂约定”

后面 fixtures 继续增加时，建议统一返回结构：

```ts
{
  name,
  task,
  context,
  findings,
  conclusion,
  explanation,
  dominoChain,
}
```

并统一命名：

- `buildInspectXxxScenario`
- `buildClickXxxScenario`

这样后面测试读起来会非常顺。

---

# 11. 一个工程化建议

如果你准备长期维护这些 fixtures，我建议把“硬编码字符串”也逐步集中起来，例如：

```ts
src/modules/diagnosis/__tests__/fixtures/constants.ts
```

放：

- 默认 `createdAt`
- 常用 `evidenceRefs`
- fallback token 默认值
- 常见 label 文案

不过现在先不必过度抽象，当前这版已经足够用于测试复用。

---

# 12. 下一步最值得做什么

现在你已经有：

- 基础 helpers
- 场景级 fixtures
- 各 service / builder 的测试骨架

下一步最有价值的是二选一：

### A. 把 fixtures 接入现有 integration spec，进一步缩短测试代码
我可以直接给你：
- `diagnosis-query.service.integration.spec.ts`
- `explanation-builder.integration.spec.ts`
- `domino-chain-builder.integration.spec.ts`

的 **fixtures 化重构版**

### B. 开始补 `DiagnosisController` / `DiagnosisModule` 的 HTTP 级 e2e 骨架
验证：
- `POST /api/v1/diagnosis`
- `GET /api/v1/diagnosis/:id`

---

我建议下一步直接做 **A：把 fixtures 接入现有 integration spec 的重构版**。