下面直接给你 **`DiagnosisQueryService` 的端到端 / 集成测试骨架**。  
这部分我会按你前面已经确定的链路来写：

```ts
Controller
  -> Application Service / Query Service
  -> Context Builder / Evidence Collector
  -> RuleEngineService
  -> DiagnosisConclusionService
  -> ExplanationBuilder
  -> DominoChainBuilder
  -> Repository
```

并且对齐你当前约束：

- `POST /diagnosis` 只创建任务，不立即执行
- `GET /diagnosis/:id` 走 **lazy execution**
- 如果 repository 里已有结果，则直接返回缓存
- 如果没有结果，则现场执行并缓存

---

# 1. 测试目标拆分

`DiagnosisQueryService` 最值得测的不是算法本身，而是 **编排行为**：

---

## 1.1 缓存命中
- repository 已有 result
- 不再触发 context/rule/conclusion/explanation/domino
- 直接返回

---

## 1.2 首次查询触发 lazy execution
- repository 有 task
- repository 无 result
- 触发完整执行链
- 保存 result
- 返回 result

---

## 1.3 任务不存在
- 抛 `NotFoundException`

---

## 1.4 执行失败兜底
- 中间某一步报错
- 记录失败结果或抛出异常
- 看你当前设计是“抛异常”还是“保存 failed 状态”

我下面先给你 **MVP 推荐版**：

- **优先抛异常**
- 如果你后面要做诊断任务状态机，再补 `failed` 分支测试

---

# 2. 推荐文件位置

```bash
src/modules/diagnosis/__tests__/
└── integration/
    └── diagnosis-query.service.integration.spec.ts
```

如果你后面想进一步做 e2e（HTTP 级别），可以再加：

```bash
test/diagnosis.e2e-spec.ts
```

但当前阶段，先做 **service-level integration** 最合适。

---

# 3. 先假设 `DiagnosisQueryService` 接口

为了让测试有锚点，先假设 service 大概长这样：

```ts
@Injectable()
export class DiagnosisQueryService {
  constructor(
    private readonly repository: DiagnosisRepository,
    private readonly contextBuilder: DiagnosisContextBuilder,
    private readonly ruleEngineService: RuleEngineService,
    private readonly diagnosisConclusionService: DiagnosisConclusionService,
    private readonly explanationBuilder: ExplanationBuilder,
    private readonly dominoChainBuilder: DominoChainBuilder,
  ) {}

  async getById(id: string): Promise<DiagnosisResult> {
    const task = await this.repository.findTaskById(id);
    if (!task) {
      throw new NotFoundException(`Diagnosis task not found: ${id}`);
    }

    const cached = await this.repository.findResultByDiagnosisId(id);
    if (cached) {
      return cached;
    }

    const context = await this.contextBuilder.build(task);
    const findings = this.ruleEngineService.run(context);
    const conclusion = this.diagnosisConclusionService.conclude(findings, context);
    const explanation = this.explanationBuilder.build(conclusion, context);
    const dominoChain = this.dominoChainBuilder.build(conclusion, context);

    const result: DiagnosisResult = {
      diagnosisId: id,
      status: 'completed',
      context,
      findings,
      conclusion,
      explanation,
      dominoChain,
      createdAt: task.createdAt,
      updatedAt: new Date().toISOString(),
    };

    await this.repository.saveResult(result);

    return result;
  }
}
```

---

# 4. 集成测试骨架

这里用 **真实 `DiagnosisQueryService`**，但它依赖的下游先都 mock。  
这是最稳的“编排集成测试”方式：  
**测 query service 的 orchestration，不重复测下游算法。**

---

## `src/modules/diagnosis/__tests__/integration/diagnosis-query.service.integration.spec.ts`

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';

import { DiagnosisQueryService } from '../../application/services/diagnosis-query.service';
import { RuleEngineService } from '../../domain/services/rule-engine.service';
import { DiagnosisConclusionService } from '../../domain/services/diagnosis-conclusion.service';
import { ExplanationBuilder } from '../../domain/builders/explanation.builder';
import { DominoChainBuilder } from '../../domain/builders/domino-chain.builder';

import { DiagnosisContext } from '../../domain/models/diagnosis-context.model';
import { RuleFinding } from '../../domain/models/rule-finding.model';
import { DiagnosisConclusion } from '../../domain/models/diagnosis-conclusion.model';

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

  const buildTask = (overrides: Record<string, any> = {}) => ({
    id: 'diag_001',
    mode: 'inspect_diagnosis',
    target: {
      pageUrl: '/demo/detail',
      selector: '#amount',
    },
    createdAt: '2026-06-12T07:00:00.000Z',
    ...overrides,
  });

  const buildContext = (
    overrides: Partial<DiagnosisContext> = {},
  ): DiagnosisContext =>
    ({
      diagnosisId: 'diag_001',
      mode: 'inspect_diagnosis',
      fallbackTokens: ['--', '-', '暂无', 'N/A', ''],
      evidenceRefs: [],
      responseSuccess: true,
      storeUpdated: true,
      renderTriggered: true,
      ...overrides,
    }) as DiagnosisContext;

  const buildFinding = (
    overrides: Partial<RuleFinding> = {},
  ): RuleFinding => ({
    ruleCode: 'R101',
    title: '接口字段缺失',
    diagnosisLabel: '接口字段缺失',
    category: 'data_source',
    severity: 'high',
    confidence: 0.95,
    layer: 'api',
    cluster: 'api_field_missing',
    summary: '接口响应中缺少目标字段。',
    evidenceRefs: ['ev_api_1'],
    suggestions: ['检查接口返回字段路径'],
    isSymptomOnly: false,
    ...overrides,
  });

  const buildConclusion = (
    overrides: Partial<DiagnosisConclusion> = {},
  ): DiagnosisConclusion =>
    ({
      topFinding: buildFinding(),
      supportingFindings: [],
      symptomFindings: [],
      diagnosisState: 'confirmed_root_cause',
      summary: '已定位到根因：接口字段缺失。',
      repairHints: ['检查接口返回字段路径'],
      scoreBreakdown: [
        {
          ruleCode: 'R101',
          finalScore: 1.35,
          reason: ['根因规则优先', '上游 API 层优先级最高'],
        },
      ],
      ...overrides,
    }) as DiagnosisConclusion;

  beforeEach(async () => {
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiagnosisQueryService,
        {
          provide: 'DiagnosisRepository',
          useValue: repository,
        },
        {
          provide: 'DiagnosisContextBuilder',
          useValue: contextBuilder,
        },
        {
          provide: RuleEngineService,
          useValue: ruleEngineService,
        },
        {
          provide: DiagnosisConclusionService,
          useValue: diagnosisConclusionService,
        },
        {
          provide: ExplanationBuilder,
          useValue: explanationBuilder,
        },
        {
          provide: DominoChainBuilder,
          useValue: dominoChainBuilder,
        },
      ],
    }).compile();

    service = module.get(DiagnosisQueryService);
  });

  it('should return cached result directly when repository result already exists', async () => {
    const task = buildTask();
    const cachedResult = {
      diagnosisId: 'diag_001',
      status: 'completed',
      conclusion: {
        topFinding: { ruleCode: 'R101' },
      },
      explanation: {
        summaryText: 'cached explanation',
      },
      dominoChain: {
        mode: 'inspect_diagnosis',
        nodes: [],
      },
    };

    repository.findTaskById.mockResolvedValue(task);
    repository.findResultByDiagnosisId.mockResolvedValue(cachedResult);

    const result = await service.getById('diag_001');

    expect(repository.findTaskById).toHaveBeenCalledWith('diag_001');
    expect(repository.findResultByDiagnosisId).toHaveBeenCalledWith('diag_001');

    expect(contextBuilder.build).not.toHaveBeenCalled();
    expect(ruleEngineService.run).not.toHaveBeenCalled();
    expect(diagnosisConclusionService.conclude).not.toHaveBeenCalled();
    expect(explanationBuilder.build).not.toHaveBeenCalled();
    expect(dominoChainBuilder.build).not.toHaveBeenCalled();
    expect(repository.saveResult).not.toHaveBeenCalled();

    expect(result).toBe(cachedResult);
  });

  it('should perform lazy execution and save result when cached result does not exist', async () => {
    const task = buildTask();
    const context = buildContext();
    const findings = [buildFinding()];
    const conclusion = buildConclusion();
    const explanation = {
      summaryText: '已确认根因：接口字段缺失。',
      evidenceNarrative: ['核心证据：接口字段缺失。接口响应中缺少目标字段。'],
      operatorAdvice: ['建议处理：检查接口返回字段路径'],
      symptomNotes: [],
    };
    const dominoChain = {
      mode: 'inspect_diagnosis',
      nodes: [
        {
          id: 'response',
          type: 'response',
          label: '接口响应',
          status: 'broken',
          relatedRuleCodes: ['R101'],
          evidenceRefs: ['ev_api_1'],
          isRootCause: true,
        },
      ],
    };

    repository.findTaskById.mockResolvedValue(task);
    repository.findResultByDiagnosisId.mockResolvedValue(null);
    contextBuilder.build.mockResolvedValue(context);
    ruleEngineService.run.mockReturnValue(findings);
    diagnosisConclusionService.conclude.mockReturnValue(conclusion);
    explanationBuilder.build.mockReturnValue(explanation);
    dominoChainBuilder.build.mockReturnValue(dominoChain);
    repository.saveResult.mockResolvedValue(undefined);

    const result = await service.getById('diag_001');

    expect(repository.findTaskById).toHaveBeenCalledWith('diag_001');
    expect(repository.findResultByDiagnosisId).toHaveBeenCalledWith('diag_001');

    expect(contextBuilder.build).toHaveBeenCalledTimes(1);
    expect(contextBuilder.build).toHaveBeenCalledWith(task);

    expect(ruleEngineService.run).toHaveBeenCalledTimes(1);
    expect(ruleEngineService.run).toHaveBeenCalledWith(context);

    expect(diagnosisConclusionService.conclude).toHaveBeenCalledTimes(1);
    expect(diagnosisConclusionService.conclude).toHaveBeenCalledWith(
      findings,
      context,
    );

    expect(explanationBuilder.build).toHaveBeenCalledTimes(1);
    expect(explanationBuilder.build).toHaveBeenCalledWith(conclusion, context);

    expect(dominoChainBuilder.build).toHaveBeenCalledTimes(1);
    expect(dominoChainBuilder.build).toHaveBeenCalledWith(conclusion, context);

    expect(repository.saveResult).toHaveBeenCalledTimes(1);
    expect(repository.saveResult).toHaveBeenCalledWith(
      expect.objectContaining({
        diagnosisId: 'diag_001',
        status: 'completed',
        context,
        findings,
        conclusion,
        explanation,
        dominoChain,
      }),
    );

    expect(result).toEqual(
      expect.objectContaining({
        diagnosisId: 'diag_001',
        status: 'completed',
        context,
        findings,
        conclusion,
        explanation,
        dominoChain,
      }),
    );
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
    const task = buildTask();

    repository.findTaskById.mockResolvedValue(task);
    repository.findResultByDiagnosisId.mockResolvedValue(null);
    contextBuilder.build.mockRejectedValue(new Error('context build failed'));

    await expect(service.getById('diag_001')).rejects.toThrow(
      'context build failed',
    );

    expect(ruleEngineService.run).not.toHaveBeenCalled();
    expect(diagnosisConclusionService.conclude).not.toHaveBeenCalled();
    expect(explanationBuilder.build).not.toHaveBeenCalled();
    expect(dominoChainBuilder.build).not.toHaveBeenCalled();
    expect(repository.saveResult).not.toHaveBeenCalled();
  });

  it('should not save result when rule engine fails', async () => {
    const task = buildTask();
    const context = buildContext();

    repository.findTaskById.mockResolvedValue(task);
    repository.findResultByDiagnosisId.mockResolvedValue(null);
    contextBuilder.build.mockResolvedValue(context);
    ruleEngineService.run.mockImplementation(() => {
      throw new Error('rule engine failed');
    });

    await expect(service.getById('diag_001')).rejects.toThrow(
      'rule engine failed',
    );

    expect(diagnosisConclusionService.conclude).not.toHaveBeenCalled();
    expect(explanationBuilder.build).not.toHaveBeenCalled();
    expect(dominoChainBuilder.build).not.toHaveBeenCalled();
    expect(repository.saveResult).not.toHaveBeenCalled();
  });

  it('should preserve task createdAt in saved result metadata', async () => {
    const task = buildTask({
      id: 'diag_002',
      createdAt: '2026-06-12T06:30:00.000Z',
    });
    const context = buildContext({
      diagnosisId: 'diag_002',
    });
    const findings = [buildFinding()];
    const conclusion = buildConclusion();
    const explanation = {
      summaryText: '已确认根因：接口字段缺失。',
      evidenceNarrative: [],
      operatorAdvice: [],
      symptomNotes: [],
    };
    const dominoChain = {
      mode: 'inspect_diagnosis',
      nodes: [],
    };

    repository.findTaskById.mockResolvedValue(task);
    repository.findResultByDiagnosisId.mockResolvedValue(null);
    contextBuilder.build.mockResolvedValue(context);
    ruleEngineService.run.mockReturnValue(findings);
    diagnosisConclusionService.conclude.mockReturnValue(conclusion);
    explanationBuilder.build.mockReturnValue(explanation);
    dominoChainBuilder.build.mockReturnValue(dominoChain);

    await service.getById('diag_002');

    expect(repository.saveResult).toHaveBeenCalledWith(
      expect.objectContaining({
        diagnosisId: 'diag_002',
        createdAt: '2026-06-12T06:30:00.000Z',
      }),
    );
  });

  it('should support empty findings and still save completed result', async () => {
    const task = buildTask();
    const context = buildContext({
      responseSuccess: false,
      storeUpdated: false,
      renderTriggered: false,
    });
    const findings: RuleFinding[] = [];
    const conclusion = {
      topFinding: null,
      supportingFindings: [],
      symptomFindings: [],
      diagnosisState: 'insufficient_evidence',
      summary: '当前证据不足，无法确认明确根因。',
      repairHints: ['补充接口响应快照'],
      scoreBreakdown: [],
    };
    const explanation = {
      summaryText: '当前证据不足，暂时无法确认明确根因。',
      evidenceNarrative: [],
      operatorAdvice: ['建议先补充接口响应证据。'],
      symptomNotes: [],
    };
    const dominoChain = {
      mode: 'inspect_diagnosis',
      nodes: [],
    };

    repository.findTaskById.mockResolvedValue(task);
    repository.findResultByDiagnosisId.mockResolvedValue(null);
    contextBuilder.build.mockResolvedValue(context);
    ruleEngineService.run.mockReturnValue(findings);
    diagnosisConclusionService.conclude.mockReturnValue(conclusion);
    explanationBuilder.build.mockReturnValue(explanation);
    dominoChainBuilder.build.mockReturnValue(dominoChain);

    const result = await service.getById('diag_001');

    expect(diagnosisConclusionService.conclude).toHaveBeenCalledWith(
      [],
      context,
    );

    expect(repository.saveResult).toHaveBeenCalledWith(
      expect.objectContaining({
        findings: [],
        conclusion,
        explanation,
      }),
    );

    expect(result).toEqual(
      expect.objectContaining({
        findings: [],
        conclusion,
      }),
    );
  });
});
```

---

# 5. 这份测试实际锁住了什么

这组测试的核心价值，不在“返回了啥”，而在 **编排契约**：

---

## 5.1 lazy execution 只在缓存 miss 时发生
```ts
findTaskById -> findResultByDiagnosisId -> miss -> build/run/conclude/build/save
```

这个是你现在 MVP 的关键行为。

---

## 5.2 缓存命中时，不重复执行诊断链
这是防止后面有人改 service 时把缓存绕开。

---

## 5.3 各下游调用顺序和输入契约
尤其这几条：

```ts
contextBuilder.build(task)
ruleEngineService.run(context)
diagnosisConclusionService.conclude(findings, context)
explanationBuilder.build(conclusion, context)
dominoChainBuilder.build(conclusion, context)
```

这就是你 Diagnosis 模块主链的真实 contract。

---

## 5.4 失败时不保存半成品
这很关键。  
MVP 阶段先保证：
- 成功才 saveResult
- 失败直接抛错

后面如果你要加“失败结果缓存”，再扩展测试。

---

# 6. 我建议你真实代码里的依赖注入方式统一一下

上面的测试里为了示例，用了：

```ts
provide: 'DiagnosisRepository'
provide: 'DiagnosisContextBuilder'
```

但你真实工程里最好统一成一种风格：

---

## 方案 A：class token
如果 repository / builder 都是 class：

```ts
provide: DiagnosisRepository, useValue: repository
provide: DiagnosisContextBuilder, useValue: contextBuilder
```

---

## 方案 B：symbol / const token
如果你做接口抽象：

```ts
export const DIAGNOSIS_REPOSITORY = Symbol('DIAGNOSIS_REPOSITORY');
export const DIAGNOSIS_CONTEXT_BUILDER = Symbol('DIAGNOSIS_CONTEXT_BUILDER');
```

然后测试里：

```ts
provide: DIAGNOSIS_REPOSITORY, useValue: repository
provide: DIAGNOSIS_CONTEXT_BUILDER, useValue: contextBuilder
```

---

## 我建议
对你这个模块，**repository 用 token，service / builder 用 class** 比较顺：

- repository：可替换基础设施实现
- service / builder：直接 class provider

---

# 7. 如果你要进一步升级成 HTTP 级 e2e，可加这个骨架

如果你后面要测 controller + route，可以再加一个最小 e2e：

## `test/diagnosis.e2e-spec.ts`

```ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DiagnosisModule } from '../src/modules/diagnosis/diagnosis.module';

describe('Diagnosis API (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [DiagnosisModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/v1/diagnosis/:id should return diagnosis result', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/diagnosis/diag_001')
      .expect(200);
  });
});
```

但当前阶段我还是建议你先把 **service integration** 做实，不着急 HTTP e2e。

---

# 8. 还可以再补的两个高价值 case

---

## 8.1 二次调用命中缓存
你现在已有“缓存命中测试”，但还可以再加一个**同一个 id 连续两次 getById**：

- 第一次 miss → 执行并 save
- 第二次 hit → 直接返回 save 后结果

这个更接近真实使用路径。

---

## 8.2 保存结果后再回读
如果你的 repository 设计是：
- `saveResult(result)`
- 再 `findResultByDiagnosisId(id)` 返回最终持久化版本

那可以补一个测试，约束 query service 是否直接返回内存 result，还是 save 后再 read 一次。  
MVP 下两种都行，但要选一种并固定。

---

# 9. 我建议你下一步直接做什么

到这里，你已经把 diagnosis 主链测试骨架基本补齐了。  
现在最值得做的不是继续堆单测，而是把这些共用构造器抽出来，不然 spec 很快会重复膨胀。

---

## 我建议下一步直接做：
### **Diagnosis 模块 test helpers / fixtures 统一抽离**

比如抽这些公共 helper：

```bash
src/modules/diagnosis/__tests__/helpers/
├── build-context.ts
├── build-finding.ts
├── build-ranked-finding.ts
├── build-conclusion.ts
├── build-task.ts
└── build-result.ts
```

这样你后面的 rule / ranking / conclusion / domino / query 全部都能复用。

如果你愿意，我下一条可以直接给你：

**`Diagnosis 模块 Jest test helpers / fixtures 目录骨架 + 完整代码`**。