下面直接给你 **“把 fixtures 接入现有 integration spec 的重构版”**。  
我给三份最值得先收敛的：

1. `diagnosis-query.service.integration.spec.ts`
2. `explanation-builder.integration.spec.ts`
3. `domino-chain-builder.integration.spec.ts`

目标：

- integration spec 不再手写一堆 `task/context/findings/conclusion/...`
- 直接拿场景 fixture
- 测试只关心 orchestration / builder 行为
- 后续新增场景时，spec 几乎不用改结构

---

# 1. `diagnosis-query.service.integration.spec.ts`

> 路径假设：
>
> `src/modules/diagnosis/__tests__/integration/diagnosis-query.service.integration.spec.ts`

```ts
import { NotFoundException } from '@nestjs/common';
import { DiagnosisQueryService } from '../../application/services/diagnosis-query.service';
import { RuleEngineService } from '../../domain/services/rule-engine.service';
import { DiagnosisConclusionService } from '../../domain/services/diagnosis-conclusion.service';
import { ExplanationBuilder } from '../../domain/builders/explanation.builder';
import { DominoChainBuilder } from '../../domain/builders/domino-chain.builder';

import {
  buildDiagnosisResult,
  buildDiagnosisContext,
  buildDiagnosisConclusion,
  buildDiagnosisExplanation,
  buildDominoChain,
} from '../helpers';

import {
  buildInspectApiFieldMissingScenario,
  buildInspectFalsySwallowedScenario,
  buildClickRequestNotSentScenario,
} from '../fixtures';

describe('DiagnosisQueryService Integration', () => {
  let service: DiagnosisQueryService;

  let repository: {
    findTaskById: jest.Mock;
    findResultByDiagnosisId: jest.Mock;
    saveResult: jest.Mock;
  };

  let contextBuilder: {
    build: jest.Mock;
  };

  let ruleEngineService: {
    run: jest.Mock;
  };

  let diagnosisConclusionService: {
    conclude: jest.Mock;
  };

  let explanationBuilder: {
    build: jest.Mock;
  };

  let dominoChainBuilder: {
    build: jest.Mock;
  };

  beforeEach(() => {
    repository = {
      findTaskById: jest.fn(),
      findResultByDiagnosisId: jest.fn(),
      saveResult: jest.fn(),
    };

    contextBuilder = {
      build: jest.fn(),
    };

    ruleEngineService = {
      run: jest.fn(),
    };

    diagnosisConclusionService = {
      conclude: jest.fn(),
    };

    explanationBuilder = {
      build: jest.fn(),
    };

    dominoChainBuilder = {
      build: jest.fn(),
    };

    service = new DiagnosisQueryService(
      repository as any,
      contextBuilder as any,
      ruleEngineService as unknown as RuleEngineService,
      diagnosisConclusionService as unknown as DiagnosisConclusionService,
      explanationBuilder as unknown as ExplanationBuilder,
      dominoChainBuilder as unknown as DominoChainBuilder,
    );
  });

  it('should return cached result directly when repository result already exists', async () => {
    const scenario = buildInspectApiFieldMissingScenario();

    const cachedResult = buildDiagnosisResult({
      diagnosisId: scenario.task.id,
      context: scenario.context,
      findings: scenario.findings,
      conclusion: scenario.conclusion,
      explanation: scenario.explanation,
      dominoChain: scenario.dominoChain,
    });

    repository.findTaskById.mockResolvedValue(scenario.task);
    repository.findResultByDiagnosisId.mockResolvedValue(cachedResult);

    const result = await service.getById(scenario.task.id);

    expect(repository.findTaskById).toHaveBeenCalledWith(scenario.task.id);
    expect(repository.findResultByDiagnosisId).toHaveBeenCalledWith(
      scenario.task.id,
    );

    expect(contextBuilder.build).not.toHaveBeenCalled();
    expect(ruleEngineService.run).not.toHaveBeenCalled();
    expect(diagnosisConclusionService.conclude).not.toHaveBeenCalled();
    expect(explanationBuilder.build).not.toHaveBeenCalled();
    expect(dominoChainBuilder.build).not.toHaveBeenCalled();
    expect(repository.saveResult).not.toHaveBeenCalled();

    expect(result).toBe(cachedResult);
  });

  it('should perform lazy execution and save result for inspect api-field-missing scenario', async () => {
    const scenario = buildInspectApiFieldMissingScenario();

    repository.findTaskById.mockResolvedValue(scenario.task);
    repository.findResultByDiagnosisId.mockResolvedValue(null);
    contextBuilder.build.mockResolvedValue(scenario.context);
    ruleEngineService.run.mockReturnValue(scenario.findings);
    diagnosisConclusionService.conclude.mockReturnValue(scenario.conclusion);
    explanationBuilder.build.mockReturnValue(scenario.explanation);
    dominoChainBuilder.build.mockReturnValue(scenario.dominoChain);
    repository.saveResult.mockResolvedValue(undefined);

    const result = await service.getById(scenario.task.id);

    expect(contextBuilder.build).toHaveBeenCalledWith(scenario.task);
    expect(ruleEngineService.run).toHaveBeenCalledWith(scenario.context);
    expect(diagnosisConclusionService.conclude).toHaveBeenCalledWith(
      scenario.findings,
      scenario.context,
    );
    expect(explanationBuilder.build).toHaveBeenCalledWith(
      scenario.conclusion,
      scenario.context,
    );
    expect(dominoChainBuilder.build).toHaveBeenCalledWith(
      scenario.conclusion,
      scenario.context,
    );

    expect(repository.saveResult).toHaveBeenCalledWith(
      expect.objectContaining({
        diagnosisId: scenario.task.id,
        status: 'completed',
        context: scenario.context,
        findings: scenario.findings,
        conclusion: scenario.conclusion,
        explanation: scenario.explanation,
        dominoChain: scenario.dominoChain,
      }),
    );

    expect(result).toEqual(
      expect.objectContaining({
        diagnosisId: scenario.task.id,
        status: 'completed',
        conclusion: expect.objectContaining({
          topFinding: expect.objectContaining({
            ruleCode: 'R101',
          }),
        }),
      }),
    );
  });

  it('should perform lazy execution and save result for inspect falsy-swallowed scenario', async () => {
    const scenario = buildInspectFalsySwallowedScenario();

    repository.findTaskById.mockResolvedValue(scenario.task);
    repository.findResultByDiagnosisId.mockResolvedValue(null);
    contextBuilder.build.mockResolvedValue(scenario.context);
    ruleEngineService.run.mockReturnValue(scenario.findings);
    diagnosisConclusionService.conclude.mockReturnValue(scenario.conclusion);
    explanationBuilder.build.mockReturnValue(scenario.explanation);
    dominoChainBuilder.build.mockReturnValue(scenario.dominoChain);

    const result = await service.getById(scenario.task.id);

    expect(result.conclusion.topFinding?.ruleCode).toBe('R201');
    expect(result.conclusion.diagnosisState).toBe('confirmed_root_cause');
    expect(result.explanation.summaryText).toContain('合法值被判空吞掉');

    expect(repository.saveResult).toHaveBeenCalledWith(
      expect.objectContaining({
        diagnosisId: scenario.task.id,
        findings: scenario.findings,
        conclusion: scenario.conclusion,
      }),
    );
  });

  it('should perform lazy execution and save result for click request-not-sent scenario', async () => {
    const scenario = buildClickRequestNotSentScenario();

    repository.findTaskById.mockResolvedValue(scenario.task);
    repository.findResultByDiagnosisId.mockResolvedValue(null);
    contextBuilder.build.mockResolvedValue(scenario.context);
    ruleEngineService.run.mockReturnValue(scenario.findings);
    diagnosisConclusionService.conclude.mockReturnValue(scenario.conclusion);
    explanationBuilder.build.mockReturnValue(scenario.explanation);
    dominoChainBuilder.build.mockReturnValue(scenario.dominoChain);

    const result = await service.getById(scenario.task.id);

    expect(result.conclusion.topFinding?.ruleCode).toBe('R402');
    expect(result.explanation.summaryText).toContain('request 未发送');
    expect(
      result.dominoChain.nodes.find((x: any) => x.type === 'request')?.status,
    ).toBe('broken');
  });

  it('should throw NotFoundException when diagnosis task does not exist', async () => {
    repository.findTaskById.mockResolvedValue(null);

    await expect(service.getById('diag_not_found')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(repository.findResultByDiagnosisId).not.toHaveBeenCalled();
    expect(contextBuilder.build).not.toHaveBeenCalled();
    expect(ruleEngineService.run).not.toHaveBeenCalled();
    expect(repository.saveResult).not.toHaveBeenCalled();
  });

  it('should not save result when context building fails', async () => {
    const scenario = buildInspectApiFieldMissingScenario();

    repository.findTaskById.mockResolvedValue(scenario.task);
    repository.findResultByDiagnosisId.mockResolvedValue(null);
    contextBuilder.build.mockRejectedValue(new Error('context build failed'));

    await expect(service.getById(scenario.task.id)).rejects.toThrow(
      'context build failed',
    );

    expect(ruleEngineService.run).not.toHaveBeenCalled();
    expect(diagnosisConclusionService.conclude).not.toHaveBeenCalled();
    expect(explanationBuilder.build).not.toHaveBeenCalled();
    expect(dominoChainBuilder.build).not.toHaveBeenCalled();
    expect(repository.saveResult).not.toHaveBeenCalled();
  });

  it('should support empty findings and still save completed result', async () => {
    const scenario = buildInspectApiFieldMissingScenario();

    const emptyConclusion = buildDiagnosisConclusion({
      topFinding: null,
      supportingFindings: [],
      symptomFindings: [],
      diagnosisState: 'insufficient_evidence' as any,
      summary: '当前证据不足，无法确认明确根因。',
      repairHints: ['补充接口响应快照'],
      scoreBreakdown: [],
    });

    const emptyExplanation = buildDiagnosisExplanation({
      summaryText: '当前证据不足，暂时无法确认明确根因。',
      evidenceNarrative: [],
      operatorAdvice: ['建议先补充接口响应证据。'],
      symptomNotes: [],
    });

    const emptyDominoChain = buildDominoChain({
      mode: scenario.context.mode,
      nodes: [],
    });

    repository.findTaskById.mockResolvedValue(scenario.task);
    repository.findResultByDiagnosisId.mockResolvedValue(null);
    contextBuilder.build.mockResolvedValue(
      buildDiagnosisContext({
        diagnosisId: scenario.task.id,
        responseSuccess: false,
        storeUpdated: false,
        renderTriggered: false,
      }),
    );
    ruleEngineService.run.mockReturnValue([]);
    diagnosisConclusionService.conclude.mockReturnValue(emptyConclusion);
    explanationBuilder.build.mockReturnValue(emptyExplanation);
    dominoChainBuilder.build.mockReturnValue(emptyDominoChain);

    const result = await service.getById(scenario.task.id);

    expect(diagnosisConclusionService.conclude).toHaveBeenCalledWith(
      [],
      expect.any(Object),
    );

    expect(repository.saveResult).toHaveBeenCalledWith(
      expect.objectContaining({
        diagnosisId: scenario.task.id,
        findings: [],
        conclusion: emptyConclusion,
        explanation: emptyExplanation,
        dominoChain: emptyDominoChain,
      }),
    );

    expect(result).toEqual(
      expect.objectContaining({
        diagnosisId: scenario.task.id,
        findings: [],
        conclusion: emptyConclusion,
      }),
    );
  });
});
```

---

# 2. `explanation-builder.integration.spec.ts`

> 这个 integration spec 的重点不是 mock orchestration，  
> 而是验证 **不同场景 fixture 输入下 explanation 是否稳定产出预期文案结构**。

路径假设：

`src/modules/diagnosis/__tests__/integration/explanation-builder.integration.spec.ts`

```ts
import { ExplanationBuilder } from '../../domain/builders/explanation.builder';
import {
  buildClickHandlerNotStartedScenario,
  buildClickRequestNotSentScenario,
  buildInspectApiFieldMissingScenario,
  buildInspectDomNotUpdatedScenario,
  buildInspectFalsySwallowedScenario,
} from '../fixtures';

describe('ExplanationBuilder Integration', () => {
  let builder: ExplanationBuilder;

  beforeEach(() => {
    builder = new ExplanationBuilder();
  });

  it('should build explanation for inspect api-field-missing scenario', () => {
    const scenario = buildInspectApiFieldMissingScenario();

    const explanation = builder.build(scenario.conclusion, scenario.context);

    expect(explanation.summaryText).toContain('接口字段缺失');
    expect(explanation.evidenceNarrative.length).toBeGreaterThan(0);
    expect(explanation.operatorAdvice).toContain(
      '建议处理：检查接口返回字段路径',
    );
    expect(explanation.symptomNotes).toEqual(
      expect.arrayContaining([
        expect.stringContaining('页面显示占位值'),
      ]),
    );
  });

  it('should build explanation for inspect falsy-swallowed scenario', () => {
    const scenario = buildInspectFalsySwallowedScenario();

    const explanation = builder.build(scenario.conclusion, scenario.context);

    expect(explanation.summaryText).toContain('合法值被判空吞掉');
    expect(explanation.summaryText).toContain('formatter');
    expect(explanation.operatorAdvice).toEqual(
      expect.arrayContaining([
        '建议处理：将 if (!value) 改为 value == null',
        '建议处理：保留 0 值',
      ]),
    );
  });

  it('should build explanation for inspect dom-not-updated scenario', () => {
    const scenario = buildInspectDomNotUpdatedScenario();

    const explanation = builder.build(scenario.conclusion, scenario.context);

    expect(explanation.summaryText).toContain('DOM 未反映最新渲染结果');
    expect(explanation.evidenceNarrative).toEqual(
      expect.arrayContaining([
        expect.stringContaining('DOM 未同步更新'),
      ]),
    );
    expect(explanation.symptomNotes).toEqual(
      expect.arrayContaining([
        expect.stringContaining('render 与 DOM 不一致'),
      ]),
    );
  });

  it('should build explanation for click handler-not-started scenario', () => {
    const scenario = buildClickHandlerNotStartedScenario();

    const explanation = builder.build(scenario.conclusion, scenario.context);

    expect(explanation.summaryText).toContain('点击后 handler 未启动');
    expect(explanation.operatorAdvice).toEqual(
      expect.arrayContaining([
        '建议处理：检查事件绑定是否生效',
        '建议处理：检查节点是否被遮挡或禁用',
      ]),
    );
    expect(explanation.symptomNotes).toEqual(
      expect.arrayContaining([
        expect.stringContaining('请求前链路中断'),
      ]),
    );
  });

  it('should build explanation for click request-not-sent scenario', () => {
    const scenario = buildClickRequestNotSentScenario();

    const explanation = builder.build(scenario.conclusion, scenario.context);

    expect(explanation.summaryText).toContain('handler 执行但 request 未发送');
    expect(explanation.evidenceNarrative).toEqual(
      expect.arrayContaining([
        expect.stringContaining('未实际发出请求'),
      ]),
    );
    expect(explanation.operatorAdvice).toEqual(
      expect.arrayContaining([
        '建议处理：检查 handler 中请求触发条件',
        '建议处理：检查早返回分支是否拦截请求发送',
      ]),
    );
  });

  it('should build fallback explanation when topFinding is null', () => {
    const scenario = buildInspectApiFieldMissingScenario();

    const explanation = builder.build(
      {
        ...scenario.conclusion,
        topFinding: null,
        supportingFindings: [],
        symptomFindings: [],
        summary: '当前证据不足，无法确认明确根因。',
        repairHints: ['补充接口快照'],
      },
      scenario.context,
    );

    expect(explanation.summaryText).toContain('证据不足');
    expect(explanation.operatorAdvice).toEqual(
      expect.arrayContaining(['建议处理：补充接口快照']),
    );
  });
});
```

---

# 3. `domino-chain-builder.integration.spec.ts`

> 这个 integration spec 用 fixture 的价值最大，  
> 因为它天然就是“给定一类场景，验证链路节点状态表达”。

路径假设：

`src/modules/diagnosis/__tests__/integration/domino-chain-builder.integration.spec.ts`

```ts
import { DominoChainBuilder } from '../../domain/builders/domino-chain.builder';
import {
  buildClickHandlerNotStartedScenario,
  buildClickRequestNotSentScenario,
  buildInspectApiFieldMissingScenario,
  buildInspectDomNotUpdatedScenario,
  buildInspectFalsySwallowedScenario,
} from '../fixtures';

describe('DominoChainBuilder Integration', () => {
  let builder: DominoChainBuilder;

  beforeEach(() => {
    builder = new DominoChainBuilder();
  });

  it('should build inspect chain with response as broken root cause for api-field-missing scenario', () => {
    const scenario = buildInspectApiFieldMissingScenario();

    const chain = builder.build(scenario.conclusion, scenario.context);

    const responseNode = chain.nodes.find((node) => node.type === 'response');
    const stateNode = chain.nodes.find((node) => node.type === 'state');
    const uiNode = chain.nodes.find((node) => node.type === 'ui');

    expect(responseNode).toEqual(
      expect.objectContaining({
        status: 'broken',
        isRootCause: true,
      }),
    );
    expect(responseNode?.relatedRuleCodes).toContain('R101');

    expect(stateNode).toEqual(
      expect.objectContaining({
        status: 'suspect',
        isSupporting: true,
      }),
    );
    expect(uiNode).toEqual(
      expect.objectContaining({
        status: 'symptom',
        isSymptom: true,
      }),
    );
  });

  it('should build inspect chain with render as root cause for falsy-swallowed scenario', () => {
    const scenario = buildInspectFalsySwallowedScenario();

    const chain = builder.build(scenario.conclusion, scenario.context);

    const renderNode = chain.nodes.find((node) => node.type === 'render');
    const uiNode = chain.nodes.find((node) => node.type === 'ui');

    expect(renderNode).toEqual(
      expect.objectContaining({
        status: 'broken',
        isRootCause: true,
      }),
    );
    expect(renderNode?.relatedRuleCodes).toEqual(
      expect.arrayContaining(['R201']),
    );
    expect(uiNode?.status).toBe('symptom');
  });

  it('should build inspect chain with dom as probable root cause for dom-not-updated scenario', () => {
    const scenario = buildInspectDomNotUpdatedScenario();

    const chain = builder.build(scenario.conclusion, scenario.context);

    const domNode = chain.nodes.find((node) => node.type === 'dom');
    const renderNode = chain.nodes.find((node) => node.type === 'render');

    expect(domNode).toEqual(
      expect.objectContaining({
        status: 'broken',
        isRootCause: true,
      }),
    );
    expect(domNode?.relatedRuleCodes).toEqual(
      expect.arrayContaining(['R302']),
    );
    expect(renderNode?.status).toBe('healthy');
  });

  it('should build click chain with interaction as broken root cause for handler-not-started scenario', () => {
    const scenario = buildClickHandlerNotStartedScenario();

    const chain = builder.build(scenario.conclusion, scenario.context);

    const interactionNode = chain.nodes.find(
      (node) => node.type === 'interaction',
    );
    const requestNode = chain.nodes.find((node) => node.type === 'request');

    expect(interactionNode).toEqual(
      expect.objectContaining({
        status: 'broken',
        isRootCause: true,
      }),
    );
    expect(interactionNode?.relatedRuleCodes).toContain('R401');

    expect(requestNode).toEqual(
      expect.objectContaining({
        status: 'symptom',
        isSymptom: true,
      }),
    );
  });

  it('should build click chain with request as broken root cause for request-not-sent scenario', () => {
    const scenario = buildClickRequestNotSentScenario();

    const chain = builder.build(scenario.conclusion, scenario.context);

    const interactionNode = chain.nodes.find(
      (node) => node.type === 'interaction',
    );
    const requestNode = chain.nodes.find((node) => node.type === 'request');
    const responseNode = chain.nodes.find((node) => node.type === 'response');

    expect(interactionNode?.status).toBe('healthy');

    expect(requestNode).toEqual(
      expect.objectContaining({
        status: 'broken',
        isRootCause: true,
      }),
    );
    expect(requestNode?.relatedRuleCodes).toEqual(
      expect.arrayContaining(['R402']),
    );

    expect(responseNode?.status).toBe('healthy');
  });

  it('should aggregate root/supporting/symptom findings on same node when same layer maps to same domino node', () => {
    const scenario = buildInspectFalsySwallowedScenario();

    const chain = builder.build(scenario.conclusion, scenario.context);

    const renderNode = chain.nodes.find((node) => node.type === 'render');

    expect(renderNode).toBeDefined();
    expect(renderNode?.relatedRuleCodes).toEqual(
      expect.arrayContaining(['R201', 'R501']),
    );
    expect(renderNode?.relatedRuleCodes.length).toBeGreaterThanOrEqual(1);
  });

  it('should return stable node order for inspect mode', () => {
    const scenario = buildInspectApiFieldMissingScenario();

    const chain = builder.build(scenario.conclusion, scenario.context);

    expect(chain.nodes.map((node) => node.type)).toEqual([
      'response',
      'state',
      'selector',
      'render',
      'dom',
      'ui',
    ]);
  });

  it('should return stable node order for click mode', () => {
    const scenario = buildClickRequestNotSentScenario();

    const chain = builder.build(scenario.conclusion, scenario.context);

    expect(chain.nodes.map((node) => node.type)).toEqual([
      'interaction',
      'request',
      'response',
      'state',
      'render',
      'dom',
      'ui',
    ]);
  });
});
```

---

# 4. 一个需要你注意的小点

上面这条测试：

```ts
it('should aggregate root/supporting/symptom findings on same node when same layer maps to same domino node', ...)
```

我故意写成了：

```ts
expect(renderNode?.relatedRuleCodes).toEqual(
  expect.arrayContaining(['R201', 'R501']),
);
```

但这条是否成立，**取决于你的 DominoChainBuilder 映射规则**：

- 如果 `R501` 的 `layer: 'ui'` 被映射到 `ui` 节点，那它不会出现在 `render` 节点
- 如果你是“同一症状被并入最近异常节点”，才可能在 render 上聚合

所以这条测试你要按真实 builder 逻辑二选一：

### 更保守版本
```ts
expect(renderNode?.relatedRuleCodes).toEqual(
  expect.arrayContaining(['R201', 'R202']),
);
```

这个在你现在 `falsy-swallowed` 场景里更稳，因为 `R201/R202` 都是 `render` 层。

我建议你把它改成这个版本：

```ts
it('should aggregate multiple findings on the same render node', () => {
  const scenario = buildInspectFalsySwallowedScenario();

  const chain = builder.build(scenario.conclusion, scenario.context);

  const renderNode = chain.nodes.find((node) => node.type === 'render');

  expect(renderNode).toBeDefined();
  expect(renderNode?.relatedRuleCodes).toEqual(
    expect.arrayContaining(['R201', 'R202']),
  );
  expect(renderNode?.isRootCause).toBe(true);
});
```

这个更稳。

---

# 5. 这次重构后的收益

接入 fixtures 后，integration spec 的好处非常明确：

---

## 5.1 orchestration 测试只测 orchestration
例如 `DiagnosisQueryService` 里不再关心对象怎么拼，只关心：

- task 查没查到
- cache 命中是否短路
- lazy execution 顺序是否正确
- result 是否 save

---

## 5.2 builder 测试只测 builder 表达
`ExplanationBuilder` / `DominoChainBuilder` 不再手搓一坨输入对象，  
直接拿“业务场景”做输入，测试更接近真实使用方式。

---

## 5.3 后续加规则时更容易扩展
比如以后你再补：

- `buildInspectSelectorNotRanScenario`
- `buildClickResponseSuccessButStateNotUpdatedScenario`

只要 fixture 新增，spec 模式完全复用。

---

# 6. 我建议你下一步继续做的东西

现在你已经有：

- unit spec
- integration spec
- helpers
- scenario fixtures

最顺的下一步是二选一：

---

## 方案 A：继续补 `rule-engine.integration.spec.ts` 的 fixtures 化版本
把真实规则集测试也切到场景 fixture 输入，统一整个测试体系风格。

---

## 方案 B：进入 HTTP 层，补 `DiagnosisController / e2e` 测试骨架
验证：

- `POST /api/v1/diagnosis`
- `GET /api/v1/diagnosis/:id`
- lazy execution HTTP 行为
- 404 / validation 行为

---

我建议下一步做 **B：DiagnosisController / e2e 测试骨架**，因为现在 domain + application 测试层已经比较完整了。