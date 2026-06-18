下面直接给你一套 **Diagnosis 模块 Jest test helpers / fixtures 目录骨架 + 完整代码**。  
目标是把你前面那些 spec 里重复的：

- `buildContext`
- `buildFinding`
- `buildRankedFinding`
- `buildConclusion`
- `buildTask`
- `buildResult`

统一抽出去，后面所有测试直接复用。

我会按你现在模块结构来给。

---

# 1. 推荐目录结构

```bash
src/modules/diagnosis/__tests__/
├── helpers/
│   ├── build-context.ts
│   ├── build-finding.ts
│   ├── build-ranked-finding.ts
│   ├── build-conclusion.ts
│   ├── build-task.ts
│   ├── build-result.ts
│   ├── build-domino-chain.ts
│   ├── build-explanation.ts
│   └── index.ts
```

如果你后面测试越来越多，也可以再拆：

```bash
src/modules/diagnosis/__tests__/fixtures/
```

但当前阶段 `helpers/` 就够用了。

---

# 2. 设计原则

这套 helper 我建议遵循这几个原则：

---

## 2.1 默认值尽量“健康 + 可覆盖”
这样你在测试里只需要写关心的字段：

```ts
const context = buildDiagnosisContext({
  responseSuccess: false,
  storeUpdated: false,
});
```

---

## 2.2 类型尽量贴近真实 domain model
不要为了省事全部 `any`。  
MVP 阶段允许少量 `as Xxx`，但 helper 的输入输出最好还是绑定你真实模型。

---

## 2.3 helper 只负责“构造数据”
不要把测试逻辑塞进去。  
例如不要写这种：

```ts
buildApiFieldMissingScenario()
```

这种更适合后面单独做 `scenario fixtures`，现在先保持基础构造器简洁。

---

# 3. 完整代码

---

## 3.1 `build-context.ts`

```ts
import { DiagnosisContext } from '../../domain/models/diagnosis-context.model';

export const buildDiagnosisContext = (
  overrides: Partial<DiagnosisContext> = {},
): DiagnosisContext =>
  ({
    diagnosisId: 'diag_test_001',
    mode: 'inspect_diagnosis',

    fallbackTokens: ['--', '-', '暂无', 'N/A', ''],
    evidenceRefs: [],

    clickDetected: false,
    handlerStarted: false,
    requestSent: false,

    responseSuccess: true,
    apiFieldPath: 'response.data.amount',
    apiFieldExists: true,
    apiValue: 100,

    storeUpdated: true,
    storeValue: 100,

    selectorName: 'selectAmount',
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

    ...overrides,
  }) as DiagnosisContext;
```

---

## 3.2 `build-finding.ts`

```ts
import { RuleFinding } from '../../domain/models/rule-finding.model';

export const buildRuleFinding = (
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
```

---

## 3.3 `build-ranked-finding.ts`

> 这里假设你有 `RankedFinding` 类型，并且是 `RuleFinding + rankScore + rankReasons`

```ts
import { RankedFinding } from '../../domain/models/ranked-finding.model';
import { buildRuleFinding } from './build-finding';

export const buildRankedFinding = (
  overrides: Partial<RankedFinding> = {},
): RankedFinding => ({
  ...buildRuleFinding(overrides),
  rankScore: {
    baseConfidence: 0.8,
    rootCauseBonus: 0.2,
    symptomPenalty: 0,
    upstreamBonus: 0.05,
    duplicatePenalty: 0,
    evidenceScore: 0.03,
    clusterBonus: 0.03,
    finalScore: 1.11,
  },
  rankReasons: ['根因规则优先'],
  ...overrides,
});
```

---

## 3.4 `build-conclusion.ts`

```ts
import { DiagnosisConclusion } from '../../domain/models/diagnosis-conclusion.model';
import { DiagnosisState } from '../../domain/enums/diagnosis-state.enum';

export const buildDiagnosisConclusion = (
  overrides: Partial<DiagnosisConclusion> = {},
): DiagnosisConclusion =>
  ({
    topFinding: null,
    supportingFindings: [],
    symptomFindings: [],
    diagnosisState: DiagnosisState.PROBABLE_ROOT_CAUSE,
    summary: '',
    repairHints: [],
    scoreBreakdown: [],
    ...overrides,
  }) as DiagnosisConclusion;
```

---

## 3.5 `build-task.ts`

这个 helper 用在 `DiagnosisQueryService`、repository 测试、controller 测试都很有用。

```ts
export interface DiagnosisTaskFixture {
  id: string;
  mode: 'inspect_diagnosis' | 'click_diagnosis';
  target: {
    pageUrl?: string;
    selector?: string;
    actionId?: string;
  };
  createdAt: string;
  [key: string]: any;
}

export const buildDiagnosisTask = (
  overrides: Partial<DiagnosisTaskFixture> = {},
): DiagnosisTaskFixture => ({
  id: 'diag_test_001',
  mode: 'inspect_diagnosis',
  target: {
    pageUrl: '/demo/detail',
    selector: '#amount',
  },
  createdAt: '2026-06-12T07:00:00.000Z',
  ...overrides,
});
```

---

## 3.6 `build-explanation.ts`

```ts
export interface DiagnosisExplanationFixture {
  summaryText: string;
  evidenceNarrative: string[];
  operatorAdvice: string[];
  symptomNotes: string[];
}

export const buildDiagnosisExplanation = (
  overrides: Partial<DiagnosisExplanationFixture> = {},
): DiagnosisExplanationFixture => ({
  summaryText: '已确认根因：test diagnosis。',
  evidenceNarrative: [],
  operatorAdvice: [],
  symptomNotes: [],
  ...overrides,
});
```

---

## 3.7 `build-domino-chain.ts`

```ts
export interface DominoNodeFixture {
  id: string;
  type:
    | 'interaction'
    | 'request'
    | 'response'
    | 'state'
    | 'selector'
    | 'render'
    | 'dom'
    | 'ui';
  label: string;
  status: 'healthy' | 'suspect' | 'broken' | 'symptom';
  layer?: string;
  relatedRuleCodes: string[];
  evidenceRefs: string[];
  isRootCause?: boolean;
  isSupporting?: boolean;
  isSymptom?: boolean;
}

export interface DominoChainFixture {
  mode: 'inspect_diagnosis' | 'click_diagnosis';
  nodes: DominoNodeFixture[];
}

export const buildDominoNode = (
  overrides: Partial<DominoNodeFixture> = {},
): DominoNodeFixture => ({
  id: 'response',
  type: 'response',
  label: '接口响应',
  status: 'healthy',
  relatedRuleCodes: [],
  evidenceRefs: [],
  ...overrides,
});

export const buildDominoChain = (
  overrides: Partial<DominoChainFixture> = {},
): DominoChainFixture => ({
  mode: 'inspect_diagnosis',
  nodes: [],
  ...overrides,
});
```

---

## 3.8 `build-result.ts`

这个是把 query service / repository / controller 最常用的结果对象统一起来。

```ts
import { buildDiagnosisContext } from './build-context';
import { buildDiagnosisConclusion } from './build-conclusion';
import { buildDominoChain } from './build-domino-chain';
import { buildDiagnosisExplanation } from './build-explanation';
import { buildRuleFinding } from './build-finding';

export interface DiagnosisResultFixture {
  diagnosisId: string;
  status: 'completed' | 'failed' | 'pending';
  createdAt: string;
  updatedAt: string;
  context: ReturnType<typeof buildDiagnosisContext>;
  findings: ReturnType<typeof buildRuleFinding>[];
  conclusion: ReturnType<typeof buildDiagnosisConclusion>;
  explanation: ReturnType<typeof buildDiagnosisExplanation>;
  dominoChain: ReturnType<typeof buildDominoChain>;
  errorMessage?: string;
}

export const buildDiagnosisResult = (
  overrides: Partial<DiagnosisResultFixture> = {},
): DiagnosisResultFixture => ({
  diagnosisId: 'diag_test_001',
  status: 'completed',
  createdAt: '2026-06-12T07:00:00.000Z',
  updatedAt: '2026-06-12T07:01:00.000Z',
  context: buildDiagnosisContext(),
  findings: [buildRuleFinding()],
  conclusion: buildDiagnosisConclusion(),
  explanation: buildDiagnosisExplanation(),
  dominoChain: buildDominoChain(),
  ...overrides,
});
```

---

## 3.9 `index.ts`

统一导出，后面测试里引用很方便。

```ts
export * from './build-context';
export * from './build-finding';
export * from './build-ranked-finding';
export * from './build-conclusion';
export * from './build-task';
export * from './build-result';
export * from './build-domino-chain';
export * from './build-explanation';
```

---

# 4. 推荐使用方式

以后你的测试里就可以从：

```ts
const buildContext = (...) => ...
const buildFinding = (...) => ...
```

变成：

```ts
import {
  buildDiagnosisContext,
  buildRuleFinding,
  buildRankedFinding,
  buildDiagnosisConclusion,
  buildDiagnosisTask,
  buildDiagnosisResult,
  buildDiagnosisExplanation,
  buildDominoChain,
} from '../helpers';
```

---

## 示例 1：`RankingService` 测试

```ts
import {
  buildDiagnosisContext,
  buildRuleFinding,
} from '../helpers';

describe('RankingService', () => {
  it('should rank root cause above symptom', () => {
    const context = buildDiagnosisContext();

    const root = buildRuleFinding({
      ruleCode: 'R201',
      isSymptomOnly: false,
      layer: 'render',
      confidence: 0.8,
      cluster: 'root_cluster',
    });

    const symptom = buildRuleFinding({
      ruleCode: 'R501',
      isSymptomOnly: true,
      layer: 'ui',
      confidence: 0.8,
      cluster: 'symptom_cluster',
    });

    // ...
  });
});
```

---

## 示例 2：`DiagnosisConclusionService` 测试

```ts
import {
  buildDiagnosisContext,
  buildRankedFinding,
} from '../helpers';

rankingService.rank.mockReturnValue([
  buildRankedFinding({
    ruleCode: 'R101',
    diagnosisLabel: '接口字段缺失',
    confidence: 0.95,
  }),
]);
```

---

## 示例 3：`DiagnosisQueryService` 测试

```ts
import {
  buildDiagnosisTask,
  buildDiagnosisContext,
  buildRuleFinding,
  buildDiagnosisConclusion,
  buildDiagnosisExplanation,
  buildDominoChain,
} from '../helpers';

const task = buildDiagnosisTask();
const context = buildDiagnosisContext();
const findings = [buildRuleFinding()];
const conclusion = buildDiagnosisConclusion();
const explanation = buildDiagnosisExplanation();
const dominoChain = buildDominoChain();
```

---

# 5. 我建议你再加两个“场景型 fixture”

如果你后面测试继续增加，只靠基础 builder 还不够。  
建议再补两类 **scenario fixture**，价值很高：

---

## 5.1 inspect 场景 fixture

```ts
buildInspectApiFieldMissingScenario()
buildInspectFalsySwallowedScenario()
buildInspectDomNotUpdatedScenario()
```

这些返回：

```ts
{
  context,
  findings,
  conclusion,
}
```

---

## 5.2 click 场景 fixture

```ts
buildClickHandlerNotStartedScenario()
buildClickRequestNotSentScenario()
```

---

当前你先把基础 helper 落地，后面再做 scenario fixture 更合适。

---

# 6. 如果你想进一步规范，我建议补一个文件命名约定

为了让测试目录长期可维护，建议统一：

---

## helper 命名
- `buildDiagnosisContext`
- `buildRuleFinding`
- `buildRankedFinding`
- `buildDiagnosisConclusion`
- `buildDiagnosisTask`
- `buildDiagnosisResult`

---

## spec 内局部变量命名
- `context`
- `findings`
- `conclusion`
- `explanation`
- `dominoChain`
- `task`
- `result`

这样后面跨文件阅读成本最低。

---

# 7. 一个很实用的下一步：批量替换已有 spec 里的内联 builder

你现在前面那些测试文件，应该都有重复的：

- `buildContext`
- `buildFinding`
- `buildConclusion`

我建议下一步直接做一次批量收敛：

---

## 优先替换顺序
1. `RuleEngineService spec`
2. `RankingService spec`
3. `DiagnosisConclusionService spec`
4. `DominoChainBuilder spec`
5. `ExplanationBuilder spec`
6. `DiagnosisQueryService integration spec`

---

# 8. 如果你愿意，我下一条可以直接继续给你两种东西之一

### 方案 A
**把这些 helper 接入到前面已有 spec 的“重构示例版”**  
我直接给你一版：
- `ranking.service.spec.ts`
- `diagnosis-conclusion.service.spec.ts`
- `diagnosis-query.service.integration.spec.ts`
的重构后代码

### 方案 B
**继续补 `scenario fixtures` 完整代码**  
比如：
- `build-inspect-api-field-missing-scenario.ts`
- `build-inspect-falsy-swallowed-scenario.ts`
- `build-click-request-not-sent-scenario.ts`

---

我建议下一步直接做 **A：把 helper 接入已有 spec 的重构示例版**。