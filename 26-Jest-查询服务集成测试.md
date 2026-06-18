下面直接给你一版 **`DiagnosisQueryService` Jest 集成单测样例`**。  
我按你现在这套 MVP 调用链来写，重点不是“真连数据库/真跑 HTTP”，而是做 **service orchestration integration-style test**：

```text
Repository
 -> ContextBuilder
 -> RuleEngine
 -> Ranking / Conclusion
 -> ExplanationBuilder
 -> DominoBuilder
 -> Repository.saveResult
```

也就是：

- **外部依赖 mock**
- **DiagnosisQueryService 真实例**
- 验证整条链路的调用与最终输出

---

# 1. 推荐文件位置

```ts
src/modules/diagnosis/application/diagnosis-query.service.spec.ts
```

---

# 2. 假设的被测服务职责

这里默认你的 `DiagnosisQueryService` 类似这样：

```ts
getDiagnosisResult(id: string): Promise<DiagnosisResultDto>
```

逻辑大概是：

1. 先查 diagnosis task
2. 如果已有 cached result，直接返回
3. 如果没有：
   - 收集 evidence
   - 构建 context
   - 运行 rule engine
   - 生成 conclusion
   - 生成 explanation
   - 生成 domino chain
   - 保存结果
   - 返回结果

如果你实际方法名不同，比如：
- `queryById`
- `getById`
- `getDiagnosisById`

你把测试里的方法名替换一下就行。

---

# 3. Jest 集成单测样例

```ts
import { NotFoundException } from '@nestjs/common';
import { DiagnosisQueryService } from './diagnosis-query.service';

describe('DiagnosisQueryService', () => {
  let service: DiagnosisQueryService;

  const mockDiagnosisRepository = {
    findTaskById: jest.fn(),
    findResultByDiagnosisId: jest.fn(),
    saveResult: jest.fn(),
  };

  const mockEvidenceCollector = {
    collect: jest.fn(),
  };

  const mockContextBuilder = {
    build: jest.fn(),
  };

  const mockRuleEngineService = {
    run: jest.fn(),
  };

  const mockDiagnosisConclusionService = {
    conclude: jest.fn(),
  };

  const mockExplanationBuilder = {
    build: jest.fn(),
  };

  const mockDominoChainBuilder = {
    build: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new DiagnosisQueryService(
      mockDiagnosisRepository as any,
      mockEvidenceCollector as any,
      mockContextBuilder as any,
      mockRuleEngineService as any,
      mockDiagnosisConclusionService as any,
      mockExplanationBuilder as any,
      mockDominoChainBuilder as any,
    );
  });

  const diagnosisTask = {
    id: 'diag_001',
    type: 'inspect_diagnosis',
    status: 'pending',
    target: {
      pageUrl: '/orders/detail?id=A1001',
      domSelector: '.order-amount',
    },
    createdAt: '2026-06-12T06:00:00.000Z',
  };

  const evidenceBundle = {
    snapshots: [
      { id: 'ev_dom_snapshot', type: 'dom_snapshot' },
      { id: 'ev_api_amount_0', type: 'api_response' },
    ],
    traces: [
      { id: 'trace_render_001', type: 'render_trace' },
    ],
    lineage: {
      interactionId: 'itr_001',
      lineageId: 'lin_001',
    },
  };

  const diagnosisContext = {
    diagnosisId: 'diag_001',
    mode: 'inspect_diagnosis',
    pageUrl: '/orders/detail?id=A1001',
    targetDomSelector: '.order-amount',
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

    evidenceRefs: [
      'ev_dom_snapshot',
      'ev_api_amount_0',
      'trace_render_001',
    ],
  };

  const ruleFindings = [
    {
      ruleCode: 'R201',
      title: '合法 falsy 值被误判为空',
      diagnosisLabel: '合法值被判空吞掉',
      category: 'render_transform',
      severity: 'high',
      confidence: 0.96,
      layer: 'render',
      cluster: 'formatter_falsy_swallowed',
      summary: '上游值 0 被 formatter 误判为空。',
      evidenceRefs: ['ev_api_amount_0', 'trace_render_001'],
      suggestions: ['将 if (!value) 改为 value == null'],
      isSymptomOnly: false,
    },
    {
      ruleCode: 'R501',
      title: '页面显示 fallback 占位值',
      diagnosisLabel: '页面显示占位值',
      category: 'dom',
      severity: 'medium',
      confidence: 0.88,
      layer: 'ui',
      cluster: 'fallback_displayed',
      summary: '页面当前显示 --。',
      evidenceRefs: ['ev_dom_snapshot'],
      suggestions: ['检查上游 render / formatter'],
      isSymptomOnly: true,
    },
  ];

  const conclusion = {
    topFinding: {
      ruleCode: 'R201',
      diagnosisLabel: '合法值被判空吞掉',
      confidence: 0.96,
      summary: '上游值 0 被 formatter 误判为空。',
      suggestions: ['将 if (!value) 改为 value == null'],
      isSymptomOnly: false,
    },
    supportingFindings: [],
    symptomFindings: [
      {
        ruleCode: 'R501',
        diagnosisLabel: '页面显示占位值',
        confidence: 0.88,
        isSymptomOnly: true,
      },
    ],
    diagnosisState: 'confirmed_root_cause',
    summary: '已定位到根因：合法值被判空吞掉。',
    repairHints: ['将 if (!value) 改为 value == null'],
    scoreBreakdown: [
      {
        ruleCode: 'R201',
        finalScore: 0.97,
        reason: ['根因规则优先', '证据链完整度高'],
      },
      {
        ruleCode: 'R501',
        finalScore: 0.61,
        reason: ['症状规则已降权'],
      },
    ],
  };

  const explanation = {
    summaryText: '接口返回了合法值 0，但 formatter 将其处理为占位值 --。',
    evidenceNarrative: [
      '接口字段 response.data.amount 返回值为 0',
      'render 输入为 0，输出为 --',
      '页面最终显示为 --',
    ],
    operatorAdvice: [
      '检查 formatter 的空值判断逻辑',
    ],
  };

  const dominoChain = [
    {
      id: 'node_api',
      type: 'api',
      label: 'API amount=0',
      status: 'ok',
    },
    {
      id: 'node_render',
      type: 'render',
      label: 'formatter output=--',
      status: 'error',
    },
    {
      id: 'node_dom',
      type: 'dom',
      label: 'DOM display=--',
      status: 'symptom',
    },
  ];

  describe('缓存命中', () => {
    it('should return cached result directly when repository already has computed result', async () => {
      const cachedResult = {
        diagnosisId: 'diag_001',
        status: 'completed',
        conclusion,
        explanation,
        dominoChain,
      };

      mockDiagnosisRepository.findTaskById.mockResolvedValue(diagnosisTask);
      mockDiagnosisRepository.findResultByDiagnosisId.mockResolvedValue(
        cachedResult,
      );

      const result = await service.getDiagnosisResult('diag_001');

      expect(result).toEqual(cachedResult);

      expect(mockDiagnosisRepository.findTaskById).toHaveBeenCalledWith(
        'diag_001',
      );
      expect(
        mockDiagnosisRepository.findResultByDiagnosisId,
      ).toHaveBeenCalledWith('diag_001');

      expect(mockEvidenceCollector.collect).not.toHaveBeenCalled();
      expect(mockContextBuilder.build).not.toHaveBeenCalled();
      expect(mockRuleEngineService.run).not.toHaveBeenCalled();
      expect(mockDiagnosisConclusionService.conclude).not.toHaveBeenCalled();
      expect(mockExplanationBuilder.build).not.toHaveBeenCalled();
      expect(mockDominoChainBuilder.build).not.toHaveBeenCalled();
      expect(mockDiagnosisRepository.saveResult).not.toHaveBeenCalled();
    });
  });

  describe('缓存未命中 -> 现场执行诊断', () => {
    it('should execute full diagnosis pipeline and persist computed result', async () => {
      mockDiagnosisRepository.findTaskById.mockResolvedValue(diagnosisTask);
      mockDiagnosisRepository.findResultByDiagnosisId.mockResolvedValue(null);
      mockEvidenceCollector.collect.mockResolvedValue(evidenceBundle);
      mockContextBuilder.build.mockReturnValue(diagnosisContext);
      mockRuleEngineService.run.mockReturnValue(ruleFindings);
      mockDiagnosisConclusionService.conclude.mockReturnValue(conclusion);
      mockExplanationBuilder.build.mockReturnValue(explanation);
      mockDominoChainBuilder.build.mockReturnValue(dominoChain);
      mockDiagnosisRepository.saveResult.mockResolvedValue(undefined);

      const result = await service.getDiagnosisResult('diag_001');

      expect(mockDiagnosisRepository.findTaskById).toHaveBeenCalledWith(
        'diag_001',
      );
      expect(
        mockDiagnosisRepository.findResultByDiagnosisId,
      ).toHaveBeenCalledWith('diag_001');

      expect(mockEvidenceCollector.collect).toHaveBeenCalledWith(diagnosisTask);
      expect(mockContextBuilder.build).toHaveBeenCalledWith(
        diagnosisTask,
        evidenceBundle,
      );
      expect(mockRuleEngineService.run).toHaveBeenCalledWith(diagnosisContext);
      expect(mockDiagnosisConclusionService.conclude).toHaveBeenCalledWith(
        ruleFindings,
        diagnosisContext,
      );
      expect(mockExplanationBuilder.build).toHaveBeenCalledWith(
        diagnosisContext,
        conclusion,
        ruleFindings,
      );
      expect(mockDominoChainBuilder.build).toHaveBeenCalledWith(
        diagnosisContext,
        conclusion,
        ruleFindings,
      );

      expect(mockDiagnosisRepository.saveResult).toHaveBeenCalledWith({
        diagnosisId: 'diag_001',
        status: 'completed',
        context: diagnosisContext,
        findings: ruleFindings,
        conclusion,
        explanation,
        dominoChain,
      });

      expect(result).toEqual({
        diagnosisId: 'diag_001',
        status: 'completed',
        context: diagnosisContext,
        findings: ruleFindings,
        conclusion,
        explanation,
        dominoChain,
      });
    });
  });

  describe('任务不存在', () => {
    it('should throw NotFoundException when diagnosis task does not exist', async () => {
      mockDiagnosisRepository.findTaskById.mockResolvedValue(null);

      await expect(service.getDiagnosisResult('diag_404')).rejects.toBeInstanceOf(
        NotFoundException,
      );

      expect(mockDiagnosisRepository.findTaskById).toHaveBeenCalledWith(
        'diag_404',
      );
      expect(
        mockDiagnosisRepository.findResultByDiagnosisId,
      ).not.toHaveBeenCalled();
      expect(mockEvidenceCollector.collect).not.toHaveBeenCalled();
    });
  });

  describe('无规则命中', () => {
    it('should still build conclusion/explanation/domino and save result when no findings matched', async () => {
      const emptyConclusion = {
        topFinding: null,
        supportingFindings: [],
        symptomFindings: [],
        diagnosisState: 'no_rule_matched',
        summary: '现有规则未识别出明确异常。',
        repairHints: ['检查业务计算逻辑', '补充更细的规则覆盖'],
        scoreBreakdown: [],
      };

      const fallbackExplanation = {
        summaryText: '当前未命中明确规则，建议补充更细粒度证据。',
        evidenceNarrative: ['已获取基础 DOM / API / render 证据'],
        operatorAdvice: ['检查业务计算逻辑', '补充规则'],
      };

      const fallbackDominoChain = [
        {
          id: 'node_dom',
          type: 'dom',
          label: 'DOM display=--',
          status: 'symptom',
        },
      ];

      mockDiagnosisRepository.findTaskById.mockResolvedValue(diagnosisTask);
      mockDiagnosisRepository.findResultByDiagnosisId.mockResolvedValue(null);
      mockEvidenceCollector.collect.mockResolvedValue(evidenceBundle);
      mockContextBuilder.build.mockReturnValue(diagnosisContext);
      mockRuleEngineService.run.mockReturnValue([]);
      mockDiagnosisConclusionService.conclude.mockReturnValue(emptyConclusion);
      mockExplanationBuilder.build.mockReturnValue(fallbackExplanation);
      mockDominoChainBuilder.build.mockReturnValue(fallbackDominoChain);
      mockDiagnosisRepository.saveResult.mockResolvedValue(undefined);

      const result = await service.getDiagnosisResult('diag_001');

      expect(mockRuleEngineService.run).toHaveBeenCalledWith(diagnosisContext);
      expect(mockDiagnosisConclusionService.conclude).toHaveBeenCalledWith(
        [],
        diagnosisContext,
      );

      expect(result.conclusion.diagnosisState).toBe('no_rule_matched');
      expect(result.findings).toEqual([]);
      expect(result.explanation).toEqual(fallbackExplanation);
      expect(result.dominoChain).toEqual(fallbackDominoChain);
    });
  });

  describe('Explanation / Domino builder 输入校验', () => {
    it('should pass the same context, conclusion and findings into downstream builders', async () => {
      mockDiagnosisRepository.findTaskById.mockResolvedValue(diagnosisTask);
      mockDiagnosisRepository.findResultByDiagnosisId.mockResolvedValue(null);
      mockEvidenceCollector.collect.mockResolvedValue(evidenceBundle);
      mockContextBuilder.build.mockReturnValue(diagnosisContext);
      mockRuleEngineService.run.mockReturnValue(ruleFindings);
      mockDiagnosisConclusionService.conclude.mockReturnValue(conclusion);
      mockExplanationBuilder.build.mockReturnValue(explanation);
      mockDominoChainBuilder.build.mockReturnValue(dominoChain);
      mockDiagnosisRepository.saveResult.mockResolvedValue(undefined);

      await service.getDiagnosisResult('diag_001');

      const explanationArgs = mockExplanationBuilder.build.mock.calls[0];
      const dominoArgs = mockDominoChainBuilder.build.mock.calls[0];

      expect(explanationArgs[0]).toBe(diagnosisContext);
      expect(explanationArgs[1]).toBe(conclusion);
      expect(explanationArgs[2]).toBe(ruleFindings);

      expect(dominoArgs[0]).toBe(diagnosisContext);
      expect(dominoArgs[1]).toBe(conclusion);
      expect(dominoArgs[2]).toBe(ruleFindings);
    });
  });

  describe('保存结果失败', () => {
    it('should propagate error when repository.saveResult fails', async () => {
      mockDiagnosisRepository.findTaskById.mockResolvedValue(diagnosisTask);
      mockDiagnosisRepository.findResultByDiagnosisId.mockResolvedValue(null);
      mockEvidenceCollector.collect.mockResolvedValue(evidenceBundle);
      mockContextBuilder.build.mockReturnValue(diagnosisContext);
      mockRuleEngineService.run.mockReturnValue(ruleFindings);
      mockDiagnosisConclusionService.conclude.mockReturnValue(conclusion);
      mockExplanationBuilder.build.mockReturnValue(explanation);
      mockDominoChainBuilder.build.mockReturnValue(dominoChain);
      mockDiagnosisRepository.saveResult.mockRejectedValue(
        new Error('save failed'),
      );

      await expect(service.getDiagnosisResult('diag_001')).rejects.toThrow(
        'save failed',
      );

      expect(mockDiagnosisRepository.saveResult).toHaveBeenCalledTimes(1);
    });
  });

  describe('执行顺序', () => {
    it('should execute pipeline in the correct order on cache miss', async () => {
      const callOrder: string[] = [];

      mockDiagnosisRepository.findTaskById.mockImplementation(async () => {
        callOrder.push('findTaskById');
        return diagnosisTask;
      });

      mockDiagnosisRepository.findResultByDiagnosisId.mockImplementation(async () => {
        callOrder.push('findResultByDiagnosisId');
        return null;
      });

      mockEvidenceCollector.collect.mockImplementation(async () => {
        callOrder.push('collect');
        return evidenceBundle;
      });

      mockContextBuilder.build.mockImplementation(() => {
        callOrder.push('buildContext');
        return diagnosisContext;
      });

      mockRuleEngineService.run.mockImplementation(() => {
        callOrder.push('runRules');
        return ruleFindings;
      });

      mockDiagnosisConclusionService.conclude.mockImplementation(() => {
        callOrder.push('conclude');
        return conclusion;
      });

      mockExplanationBuilder.build.mockImplementation(() => {
        callOrder.push('buildExplanation');
        return explanation;
      });

      mockDominoChainBuilder.build.mockImplementation(() => {
        callOrder.push('buildDomino');
        return dominoChain;
      });

      mockDiagnosisRepository.saveResult.mockImplementation(async () => {
        callOrder.push('saveResult');
      });

      await service.getDiagnosisResult('diag_001');

      expect(callOrder).toEqual([
        'findTaskById',
        'findResultByDiagnosisId',
        'collect',
        'buildContext',
        'runRules',
        'conclude',
        'buildExplanation',
        'buildDomino',
        'saveResult',
      ]);
    });
  });
});
```

---

# 4. 这个测试假设的 `DiagnosisQueryService` 结构

上面这组 spec 默认你的 service 大概像下面这样：

```ts
import { Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class DiagnosisQueryService {
  constructor(
    private readonly diagnosisRepository: any,
    private readonly evidenceCollector: any,
    private readonly contextBuilder: any,
    private readonly ruleEngineService: any,
    private readonly diagnosisConclusionService: any,
    private readonly explanationBuilder: any,
    private readonly dominoChainBuilder: any,
  ) {}

  async getDiagnosisResult(diagnosisId: string) {
    const task = await this.diagnosisRepository.findTaskById(diagnosisId);
    if (!task) {
      throw new NotFoundException(`Diagnosis task not found: ${diagnosisId}`);
    }

    const cached = await this.diagnosisRepository.findResultByDiagnosisId(
      diagnosisId,
    );
    if (cached) {
      return cached;
    }

    const evidence = await this.evidenceCollector.collect(task);
    const context = this.contextBuilder.build(task, evidence);
    const findings = this.ruleEngineService.run(context);
    const conclusion = this.diagnosisConclusionService.conclude(
      findings,
      context,
    );
    const explanation = this.explanationBuilder.build(
      context,
      conclusion,
      findings,
    );
    const dominoChain = this.dominoChainBuilder.build(
      context,
      conclusion,
      findings,
    );

    const result = {
      diagnosisId,
      status: 'completed',
      context,
      findings,
      conclusion,
      explanation,
      dominoChain,
    };

    await this.diagnosisRepository.saveResult(result);

    return result;
  }
}
```

如果你现有实现的 repository 方法名不同，比如：

- `findById`
- `findResultById`
- `saveCompletedResult`

你只需要替换测试里的 mock 名称与断言即可。

---

# 5. 这组测试覆盖了什么

---

## 5.1 缓存命中
验证 lazy execution 的核心行为：

- 有缓存结果时直接返回
- 不再触发 collect/build/run/conclude/save

这正是你前面定下来的 MVP 策略。

---

## 5.2 缓存未命中
验证完整主链路：

- 查 task
- 查缓存
- collect evidence
- build context
- run rules
- conclude
- build explanation
- build domino
- save result
- return result

---

## 5.3 任务不存在
验证 `404 / NotFoundException` 路径。

---

## 5.4 无规则命中
验证即使 `findings=[]`，也仍然能正常输出：

- conclusion
- explanation
- dominoChain
- save result

这对 MVP 很重要，不然“没命中规则”会直接断链。

---

## 5.5 下游 builder 入参一致性
这个细节很关键，防止以后有人把：

- `conclusion`
- `context`
- `findings`

传错顺序。

---

## 5.6 保存失败
验证错误传播是否正确。  
MVP 阶段通常直接抛出即可。

---

## 5.7 调用顺序
确保 orchestrator 没有逻辑串错。

---

# 6. 如果你是 Nest TestingModule 风格

如果你想更贴近 Nest 官方测试方式，也可以写成：

```ts
const moduleRef: TestingModule = await Test.createTestingModule({
  providers: [
    DiagnosisQueryService,
    { provide: DiagnosisRepository, useValue: mockDiagnosisRepository },
    { provide: EvidenceCollector, useValue: mockEvidenceCollector },
    { provide: ContextBuilder, useValue: mockContextBuilder },
    { provide: RuleEngineService, useValue: mockRuleEngineService },
    { provide: DiagnosisConclusionService, useValue: mockDiagnosisConclusionService },
    { provide: ExplanationBuilder, useValue: mockExplanationBuilder },
    { provide: DominoChainBuilder, useValue: mockDominoChainBuilder },
  ],
}).compile();

service = moduleRef.get(DiagnosisQueryService);
```

但就你当前阶段来说，**直接 new + mock dependency** 更快、更稳，也更适合先把 orchestrator 逻辑锁住。

---

# 7. 我建议你下一步继续做什么

你现在其实已经有了一整套很完整的测试骨架：

- `RuleEngineService` 单测
- `RankingService` 单测
- `DiagnosisConclusionService` 单测
- `DiagnosisQueryService` 集成单测

下一步最值得补的是：

## 方案 A
**`ExplanationBuilder` 单测样例**  
验证：
- summaryText 生成
- evidenceNarrative 拼装
- operatorAdvice 去重与优先级

## 方案 B
**`DominoChainBuilder` 单测样例**  
验证：
- 因果链节点生成
- root cause / symptom 节点标记
- 上下游链路顺序正确

## 方案 C
**直接给你一套 diagnosis 模块目录骨架**
包括：
- application
- domain
- builders
- repository
- dto
- models
- enums
- spec

---

如果按你现在这个推进顺序，我建议下一步直接做：  
**`DominoChainBuilder` Jest 单测样例**。