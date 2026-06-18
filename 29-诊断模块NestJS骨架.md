下面直接给你一版 **Diagnosis 模块完整 NestJS 目录骨架 + 文件清单**，按你前面已经定下来的调用链和职责拆分来组织，目标是：

- **可直接落到 NestJS 项目**
- **MVP 能跑通**
- **后面方便继续扩 Rule / Ranking / Explanation / Domino**
- 保持你当前的主链路：

```text
Controller
 -> DiagnosisCommandService
 -> DiagnosisQueryService
 -> ContextBuilder / EvidenceCollector
 -> RuleEngineService
 -> RankingService
 -> DiagnosisConclusionService
 -> ExplanationBuilder
 -> DominoChainBuilder
 -> Repository
```

---

# 1. 推荐目录结构

```bash
src/modules/diagnosis/
├── diagnosis.module.ts
├── controller/
│   └── diagnosis.controller.ts
├── application/
│   ├── diagnosis-command.service.ts
│   ├── diagnosis-query.service.ts
│   └── dto/
│       ├── create-diagnosis.dto.ts
│       ├── diagnosis-id-param.dto.ts
│       ├── diagnosis-query.dto.ts
│       └── response/
│           ├── diagnosis-task-response.dto.ts
│           ├── diagnosis-result-response.dto.ts
│           ├── diagnosis-conclusion.dto.ts
│           ├── diagnosis-finding.dto.ts
│           ├── domino-chain-node.dto.ts
│           └── diagnosis-explanation.dto.ts
├── domain/
│   ├── services/
│   │   ├── rule-engine.service.ts
│   │   ├── ranking.service.ts
│   │   ├── diagnosis-conclusion.service.ts
│   │   ├── evidence-collector.service.ts
│   │   └── context-builder.service.ts
│   ├── builders/
│   │   ├── explanation-builder.ts
│   │   └── domino-chain-builder.ts
│   ├── rules/
│   │   ├── registry/
│   │   │   └── diagnosis-rule.registry.ts
│   │   ├── interfaces/
│   │   │   └── diagnosis-rule.interface.ts
│   │   ├── data-source/
│   │   │   ├── r101-api-field-missing.rule.ts
│   │   │   └── r102-api-binding-path-invalid.rule.ts
│   │   ├── state-binding/
│   │   │   ├── r103-request-success-state-not-updated.rule.ts
│   │   │   └── r104-selector-value-missing.rule.ts
│   │   ├── render-transform/
│   │   │   ├── r201-falsy-value-swallowed.rule.ts
│   │   │   ├── r202-formatter-output-fallback.rule.ts
│   │   │   └── r203-render-output-unexpected.rule.ts
│   │   ├── dom/
│   │   │   ├── r301-dom-hidden.rule.ts
│   │   │   └── r302-dom-not-updated.rule.ts
│   │   ├── interaction/
│   │   │   ├── r401-click-handler-not-started.rule.ts
│   │   │   └── r402-handler-started-request-not-sent.rule.ts
│   │   └── symptom/
│   │       ├── r501-fallback-displayed.rule.ts
│   │       ├── r502-render-dom-gap.rule.ts
│   │       ├── r503-pre-request-gap.rule.ts
│   │       └── r504-insufficient-evidence.rule.ts
│   ├── models/
│   │   ├── diagnosis-context.model.ts
│   │   ├── rule-finding.model.ts
│   │   ├── ranked-finding.model.ts
│   │   ├── diagnosis-conclusion.model.ts
│   │   ├── diagnosis-explanation.model.ts
│   │   ├── domino-chain-node.model.ts
│   │   ├── diagnosis-task.model.ts
│   │   └── diagnosis-result.model.ts
│   ├── enums/
│   │   ├── diagnosis-mode.enum.ts
│   │   ├── diagnosis-status.enum.ts
│   │   ├── diagnosis-state.enum.ts
│   │   ├── finding-severity.enum.ts
│   │   ├── finding-layer.enum.ts
│   │   └── domino-node-status.enum.ts
│   └── utils/
│       ├── diagnosis-value.utils.ts
│       ├── diagnosis-text.utils.ts
│       ├── diagnosis-layer.utils.ts
│       └── diagnosis-evidence.utils.ts
├── infrastructure/
│   ├── repositories/
│   │   ├── diagnosis.repository.ts
│   │   ├── diagnosis.repository.impl.ts
│   │   └── mappers/
│   │       └── diagnosis-entity.mapper.ts
│   ├── persistence/
│   │   ├── entities/
│   │   │   ├── diagnosis-task.entity.ts
│   │   │   └── diagnosis-result.entity.ts
│   │   └── schemas/
│   │       └── diagnosis-result.schema.ts
│   └── clients/
│       ├── trace-read.client.ts
│       ├── lineage-read.client.ts
│       └── inspect-read.client.ts
├── constants/
│   ├── diagnosis.constants.ts
│   └── diagnosis-tokens.ts
└── __tests__/
    ├── rule-engine.service.spec.ts
    ├── ranking.service.spec.ts
    ├── diagnosis-conclusion.service.spec.ts
    ├── diagnosis-query.service.spec.ts
    ├── domino-chain-builder.spec.ts
    └── explanation-builder.spec.ts
```

---

# 2. 为什么这样拆

你前面已经明确不希望变成一个“巨型 `DiagnosisService`”，所以这里按 5 层拆：

---

## 2.1 controller
只负责 HTTP 入口：

- 创建任务
- 查询结果

---

## 2.2 application
负责编排用例：

- `DiagnosisCommandService`：创建任务
- `DiagnosisQueryService`：查询 / lazy execute

---

## 2.3 domain/services
负责核心诊断能力：

- 取证
- 构建上下文
- 规则运行
- 排序
- 结论生成

---

## 2.4 domain/builders
负责“结果表达层”：

- `ExplanationBuilder`
- `DominoChainBuilder`

这个拆分很重要，因为它们不是纯业务规则，而是“如何展示诊断结果”。

---

## 2.5 infrastructure
负责持久化与外部依赖：

- repository impl
- trace/inspect/lineage clients

---

# 3. 文件清单与职责说明

下面按“建议必须有 / MVP 可先简化”的角度逐个写。

---

## 3.1 根模块

---

### `diagnosis.module.ts`

**职责：**
- 注册 controller / services / repository / builders
- 暴露 query / command service 给上层模块

**建议内容：**
- providers
- controllers
- exports

---

## 3.2 controller

---

### `controller/diagnosis.controller.ts`

**职责：**
提供两个核心接口：

```ts
POST /api/v1/diagnosis
GET /api/v1/diagnosis/:id
```

**建议方法：**

- `createDiagnosisTask()`
- `getDiagnosisResult()`

**注意：**
- `POST` 只创建任务，不直接跑完整诊断
- `GET` 没结果时触发 lazy execution

---

## 3.3 application 层

---

### `application/diagnosis-command.service.ts`

**职责：**
处理创建诊断任务。

**主要方法：**

```ts
createTask(dto: CreateDiagnosisDto): Promise<DiagnosisTask>
```

**做的事：**
- 生成 diagnosis id
- 写入 task repository
- 返回任务元信息

---

### `application/diagnosis-query.service.ts`

**职责：**
编排查询与 lazy execution。

**主要方法：**

```ts
getDiagnosisResult(diagnosisId: string): Promise<DiagnosisResult>
```

**主流程：**

```ts
findTaskById
 -> findResultByDiagnosisId
 -> collect evidence
 -> build context
 -> run rules
 -> conclude
 -> build explanation
 -> build domino chain
 -> save result
 -> return result
```

---

### `application/dto/create-diagnosis.dto.ts`

**职责：**
创建任务请求 DTO。

**建议字段：**

```ts
mode: 'inspect_diagnosis' | 'click_diagnosis';
pageUrl: string;
targetDomSelector: string;
targetComponent?: string;
interactionId?: string;
lineageId?: string;
traceId?: string;
snapshotId?: string;
```

---

### `application/dto/diagnosis-id-param.dto.ts`

**职责：**
路径参数 DTO。

```ts
id: string;
```

---

### `application/dto/diagnosis-query.dto.ts`

**职责：**
如果你后面要支持 query 参数，如：

- `refresh=false`
- `includeEvidence=true`

可以放这里。  
MVP 可先空着或不使用。

---

### `application/dto/response/diagnosis-task-response.dto.ts`

**职责：**
`POST /diagnosis` 返回结构。

**建议字段：**

```ts
id: string;
status: string;
createdAt: string;
mode: string;
```

---

### `application/dto/response/diagnosis-result-response.dto.ts`

**职责：**
`GET /diagnosis/:id` 返回总结构。

**建议字段：**

```ts
diagnosisId: string;
status: string;
context: DiagnosisContextDto;
findings: DiagnosisFindingDto[];
conclusion: DiagnosisConclusionDto;
explanation: DiagnosisExplanationDto;
dominoChain: DominoChainNodeDto[];
```

---

### `application/dto/response/diagnosis-conclusion.dto.ts`

**职责：**
对外结论结构。

---

### `application/dto/response/diagnosis-finding.dto.ts`

**职责：**
对外规则命中项结构。

---

### `application/dto/response/domino-chain-node.dto.ts`

**职责：**
对外多米诺节点结构。

---

### `application/dto/response/diagnosis-explanation.dto.ts`

**职责：**
对外解释结构。

---

# 4. domain/services 层

---

### `domain/services/evidence-collector.service.ts`

**职责：**
从 trace / inspect / lineage 等来源取证，统一整理成 evidence bundle。

**主要方法：**

```ts
collect(task: DiagnosisTask): Promise<EvidenceBundle>
```

**MVP 可以先做什么：**
- 从 task 上已有字段组装
- mock 外部 client
- 先不做复杂回放

---

### `domain/services/context-builder.service.ts`

**职责：**
把 evidence bundle 转成规则引擎可消费的 `DiagnosisContext`。

**主要方法：**

```ts
build(task: DiagnosisTask, evidence: EvidenceBundle): DiagnosisContext
```

**核心价值：**
把外部证据结构和内部规则上下文隔离开。

---

### `domain/services/rule-engine.service.ts`

**职责：**
运行规则，产出 `RuleFinding[]`

**主要方法：**

```ts
run(context: DiagnosisContext): RuleFinding[]
```

**内部实现建议：**
- 不把所有规则写死在一个方法里
- 通过 registry 注入规则列表

---

### `domain/services/ranking.service.ts`

**职责：**
对 findings 排序。

**主要规则：**
- 根因优先
- 上游优先
- cluster 去重降权
- symptom 降权
- evidence 完整度加分

---

### `domain/services/diagnosis-conclusion.service.ts`

**职责：**
从 ranked findings 中挑出：

- `topFinding`
- `supportingFindings`
- `symptomFindings`
- `diagnosisState`
- `repairHints`

---

## 额外说明：为什么 `EvidenceCollector` / `ContextBuilder` 也放 domain/services

因为它们虽然会依赖基础设施数据，但在这个模块里承担的是“诊断领域内部数据编排”的职责，而不是单纯数据库访问。  
如果你后面想更严格，也可以拆成：

```bash
domain/
application/
infrastructure/
assemblers/
```

但 MVP 阶段没必要过度分层。

---

# 5. domain/builders 层

---

### `domain/builders/explanation-builder.ts`

**职责：**
把诊断结果变成人能读懂的文本说明：

- `summaryText`
- `evidenceNarrative`
- `operatorAdvice`

---

### `domain/builders/domino-chain-builder.ts`

**职责：**
生成前端多米诺链：

- inspect 链路：
  - `response -> state -> selector -> render -> dom`
- click 链路：
  - `click -> handler -> request -> response -> state -> render -> dom`

并标记：
- root cause
- supporting
- symptom
- status

---

# 6. domain/rules 层

这是后续最值得扩展的地方。

---

## 6.1 `rules/interfaces/diagnosis-rule.interface.ts`

**职责：**
统一每条规则的接口。

**建议定义：**

```ts
export interface DiagnosisRule {
  code: string;
  evaluate(context: DiagnosisContext): RuleFinding | null;
}
```

如果你想支持多 finding，也可以是：

```ts
evaluate(context: DiagnosisContext): RuleFinding[];
```

但 MVP 推荐单规则单 finding，更容易控。

---

## 6.2 `rules/registry/diagnosis-rule.registry.ts`

**职责：**
集中注册规则列表，供 `RuleEngineService` 调用。

**主要方法：**

```ts
getRules(): DiagnosisRule[]
```

---

## 6.3 各规则文件

按你当前已经定下的规则编号拆：

---

### Data Source
- `r101-api-field-missing.rule.ts`
- `r102-api-binding-path-invalid.rule.ts`

### State Binding
- `r103-request-success-state-not-updated.rule.ts`
- `r104-selector-value-missing.rule.ts`

### Render Transform
- `r201-falsy-value-swallowed.rule.ts`
- `r202-formatter-output-fallback.rule.ts`
- `r203-render-output-unexpected.rule.ts`

### DOM
- `r301-dom-hidden.rule.ts`
- `r302-dom-not-updated.rule.ts`

### Interaction
- `r401-click-handler-not-started.rule.ts`
- `r402-handler-started-request-not-sent.rule.ts`

### Symptom
- `r501-fallback-displayed.rule.ts`
- `r502-render-dom-gap.rule.ts`
- `r503-pre-request-gap.rule.ts`
- `r504-insufficient-evidence.rule.ts`

---

# 7. domain/models 层

这层建议保留，不要全塞 DTO。

---

### `diagnosis-context.model.ts`

**职责：**
规则引擎上下文模型。

这个是你整个诊断域最关键的内部模型。

---

### `rule-finding.model.ts`

**职责：**
单条规则命中结果。

建议字段：

```ts
ruleCode
title
diagnosisLabel
category
severity
confidence
layer
cluster
summary
evidenceRefs
suggestions
isSymptomOnly
```

---

### `ranked-finding.model.ts`

**职责：**
在 `RuleFinding` 上扩展 ranking 信息：

```ts
rankScore
rankReasons
```

---

### `diagnosis-conclusion.model.ts`

**职责：**
最终归因结论。

---

### `diagnosis-explanation.model.ts`

**职责：**
解释层文本。

---

### `domino-chain-node.model.ts`

**职责：**
多米诺节点。

---

### `diagnosis-task.model.ts`

**职责：**
诊断任务元信息。

---

### `diagnosis-result.model.ts`

**职责：**
最终保存 / 返回的完整结果。

---

# 8. domain/enums 层

建议把 enum 独立出来，不要全写字符串。

---

### `diagnosis-mode.enum.ts`

```ts
inspect_diagnosis
click_diagnosis
```

---

### `diagnosis-status.enum.ts`

```ts
pending
completed
failed
```

---

### `diagnosis-state.enum.ts`

```ts
confirmed_root_cause
probable_root_cause
no_rule_matched
insufficient_evidence
```

---

### `finding-severity.enum.ts`

```ts
low
medium
high
critical
```

---

### `finding-layer.enum.ts`

建议至少有：

```ts
click
handler
request
response
state
selector
render
dom
ui
api
request_to_ui
```

如果你想区分内部 rule layer 和 domino layer，也可以后面再拆。

---

### `domino-node-status.enum.ts`

```ts
ok
warning
error
symptom
unknown
```

---

# 9. domain/utils 层

这一层虽然不是必须，但非常推荐保留。

---

### `diagnosis-value.utils.ts`

**职责：**
处理值判断：

- `isNil`
- `isFalsyButValid`
- `isFallbackValue`
- `safeToString`

这能避免规则里到处复制判断逻辑。

---

### `diagnosis-text.utils.ts`

**职责：**
处理 explanation / summary 文本拼装。

---

### `diagnosis-layer.utils.ts`

**职责：**
处理：
- rule layer -> domino layer 映射
- layer 优先级定义

---

### `diagnosis-evidence.utils.ts`

**职责：**
处理 evidence refs 聚合、去重、完整度计算。

---

# 10. infrastructure 层

---

## 10.1 repository

### `infrastructure/repositories/diagnosis.repository.ts`

**职责：**
定义仓储接口。

**建议方法：**

```ts
createTask(task: DiagnosisTask): Promise<void>;
findTaskById(id: string): Promise<DiagnosisTask | null>;
findResultByDiagnosisId(id: string): Promise<DiagnosisResult | null>;
saveResult(result: DiagnosisResult): Promise<void>;
```

---

### `infrastructure/repositories/diagnosis.repository.impl.ts`

**职责：**
接口实现。

MVP 你可以先：
- 内存实现
- Prisma 实现
- TypeORM 实现

三选一。

---

### `infrastructure/repositories/mappers/diagnosis-entity.mapper.ts`

**职责：**
entity <-> domain model 转换。

如果 MVP 很赶，也可以暂时先不拆，但后面建议补上。

---

## 10.2 persistence

### `entities/diagnosis-task.entity.ts`
### `entities/diagnosis-result.entity.ts`

如果你用 TypeORM，放这里。

---

### `schemas/diagnosis-result.schema.ts`

如果你用 Mongoose，放这里。

---

## 10.3 clients

### `trace-read.client.ts`
### `lineage-read.client.ts`
### `inspect-read.client.ts`

**职责：**
对接外部可观测性数据源。

MVP 可以先 mock / stub。

---

# 11. constants 层

---

### `constants/diagnosis.constants.ts`

放一些固定值，比如：

- 默认 fallback tokens
- repair hint 上限
- supporting findings 上限
- rank score 权重

---

### `constants/diagnosis-tokens.ts`

如果你想在 Nest 里用 provider token：

```ts
export const DIAGNOSIS_REPOSITORY = 'DIAGNOSIS_REPOSITORY';
```

非常推荐。

---

# 12. `__tests__` 层

你前面已经把这套骨架都补齐了，建议保留：

- `rule-engine.service.spec.ts`
- `ranking.service.spec.ts`
- `diagnosis-conclusion.service.spec.ts`
- `diagnosis-query.service.spec.ts`
- `domino-chain-builder.spec.ts`
- `explanation-builder.spec.ts`

如果你团队更习惯测试文件和源码同目录，也可以改成：

```bash
rule-engine.service.spec.ts
ranking.service.spec.ts
...
```

直接放在各自文件旁边。

---

# 13. MVP 第一阶段“最小可运行文件集”

如果你现在不想一次建这么全，可以先只建这些：

```bash
src/modules/diagnosis/
├── diagnosis.module.ts
├── controller/diagnosis.controller.ts
├── application/
│   ├── diagnosis-command.service.ts
│   ├── diagnosis-query.service.ts
│   └── dto/
│       ├── create-diagnosis.dto.ts
│       └── response/
│           ├── diagnosis-task-response.dto.ts
│           └── diagnosis-result-response.dto.ts
├── domain/
│   ├── services/
│   │   ├── rule-engine.service.ts
│   │   ├── ranking.service.ts
│   │   ├── diagnosis-conclusion.service.ts
│   │   ├── evidence-collector.service.ts
│   │   └── context-builder.service.ts
│   ├── builders/
│   │   ├── explanation-builder.ts
│   │   └── domino-chain-builder.ts
│   ├── models/
│   │   ├── diagnosis-context.model.ts
│   │   ├── rule-finding.model.ts
│   │   ├── diagnosis-conclusion.model.ts
│   │   ├── diagnosis-result.model.ts
│   │   └── diagnosis-task.model.ts
│   └── enums/
│       ├── diagnosis-mode.enum.ts
│       ├── diagnosis-status.enum.ts
│       └── diagnosis-state.enum.ts
├── infrastructure/
│   └── repositories/
│       ├── diagnosis.repository.ts
│       └── diagnosis.repository.impl.ts
└── __tests__/
    ├── rule-engine.service.spec.ts
    ├── ranking.service.spec.ts
    ├── diagnosis-conclusion.service.spec.ts
    ├── diagnosis-query.service.spec.ts
    ├── domino-chain-builder.spec.ts
    └── explanation-builder.spec.ts
```

这套已经足够把 MVP 主链跑起来。

---

# 14. 我建议的实际落地顺序

按工程推进，建议你这样建：

---

## Phase 1：先跑通主链
1. `diagnosis.module.ts`
2. `diagnosis.controller.ts`
3. `diagnosis-command.service.ts`
4. `diagnosis-query.service.ts`
5. `diagnosis.repository.ts / impl.ts`
6. `diagnosis-context.model.ts`
7. `rule-finding.model.ts`
8. `rule-engine.service.ts`
9. `ranking.service.ts`
10. `diagnosis-conclusion.service.ts`
11. `explanation-builder.ts`
12. `domino-chain-builder.ts`

---

## Phase 2：把规则拆独立文件
13. `rules/interfaces/diagnosis-rule.interface.ts`
14. `rules/registry/diagnosis-rule.registry.ts`
15. 各 `R101 ~ R504` 规则文件

---

## Phase 3：补对外 DTO / Swagger
16. response dto
17. param dto
18. query dto

---

## Phase 4：补 infra 接外部 trace / inspect / lineage
19. clients
20. collector 真正取数实现

---

# 15. 最后给你一个“最推荐版本”

如果你问我：**在 MVP 阶段，既不臃肿又足够工程化的结构是哪版？**

我建议用这一版：

```bash
src/modules/diagnosis/
├── diagnosis.module.ts
├── controller/
├── application/
├── domain/
│   ├── services/
│   ├── builders/
│   ├── rules/
│   ├── models/
│   ├── enums/
│   └── utils/
├── infrastructure/
│   ├── repositories/
│   └── clients/
└── __tests__/
```

这个平衡最好：

- 不会过度 DDD
- 也不会把所有逻辑塞爆
- 非常适合你现在这类“诊断引擎 + 结果解释 + 因果链展示”的模块

---

如果你愿意，我下一条可以直接继续给你其中一个：

1. **`diagnosis.module.ts + 文件骨架代码模板`**
2. **全部空文件清单 + 每个文件初始代码 stub**
3. **直接给你一版可复制的 NestJS diagnosis 模块 starter**

如果按工程落地效率，我建议下一步直接做：  
**全部文件的初始代码 stub（可直接复制建文件）**。