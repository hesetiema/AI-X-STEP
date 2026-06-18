下面直接给你一版 **Rule Engine + Diagnosis Service 在 NestJS 中的调用链**。  
我会按 **MVP 可落地** 来写，重点回答 4 个问题：

1. NestJS 里模块怎么分  
2. 一次 diagnosis 请求怎么流转  
3. Rule Engine 和 Diagnosis Service 怎么衔接  
4. 代码骨架怎么搭

我尽量用你前面已经定下来的概念，不重新发明命名。

---

# 1. 目标调用链

先给结论版主链路：

```text
Controller
  -> Application Service（DiagnosisAppService）
    -> Context Builder（Evidence/Trace/Lineage 聚合）
    -> Rule Engine
    -> Diagnosis Ranking Service
    -> Explanation Builder
    -> Repository
  -> Response DTO
```

更细一点：

```text
POST /api/v1/diagnosis
  -> DiagnosisController.createDiagnosis()
  -> DiagnosisAppService.createTask()
  -> DiagnosisRepository.create()
  -> 返回 diagnosis_id

GET /api/v1/diagnosis/:id
  -> DiagnosisController.getDiagnosisById()
  -> DiagnosisQueryService.getOrRunDiagnosis()
      -> DiagnosisRepository.findById()
      -> if completed: return cached result
      -> if not completed:
           -> EvidenceCollector.collect()
           -> ContextBuilder.build()
           -> RuleEngine.run()
           -> DiagnosisService.rankAndConclude()
           -> DominoChainBuilder.build()
           -> DiagnosisRepository.saveResult()
           -> return result
```

---

# 2. 推荐模块拆分

我建议不要把所有逻辑都塞进 `DiagnosisService`。  
MVP 也要最少拆成 6 个职责件。

---

## 2.1 模块结构

```ts
src/modules/diagnosis/
  diagnosis.module.ts
  diagnosis.controller.ts

  application/
    diagnosis-app.service.ts
    diagnosis-query.service.ts

  domain/
    rule-engine/
      engine.ts
      ranking.ts
      rules/
    diagnosis/
      diagnosis-conclusion.service.ts
      explanation.builder.ts
      domino-chain.builder.ts

  infrastructure/
    diagnosis.repository.ts
    evidence.collector.ts
    context.builder.ts

  dto/
  enums/
```

---

## 2.2 职责划分

### DiagnosisController
只负责 HTTP 输入输出。

### DiagnosisAppService
处理“创建任务”这种应用层动作。

### DiagnosisQueryService
处理“执行 / 查询诊断结果”。

### EvidenceCollector
从 trace / lineage / store snapshot / dom snapshot 等来源拉证据。

### ContextBuilder
把分散证据组装为 `DiagnosisContext`。

### RuleEngine
跑规则，吐出 `RuleFinding[]`。

### DiagnosisConclusionService
对 findings 做排序、合并、归因。

### ExplanationBuilder
把结论转成：
- summary
- repair_hints
- score_breakdown

### DominoChainBuilder
生成工作台需要的 domino 数据。

### DiagnosisRepository
存任务状态和结果。

---

# 3. 一次请求的完整调用链

下面分 `POST` 和 `GET` 讲。

---

# 3.1 POST /api/v1/diagnosis

这个接口只负责创建诊断任务，不直接跑完整诊断。

---

## 调用流程

```text
DiagnosisController.createDiagnosis(dto)
  -> DiagnosisAppService.createTask(dto)
      -> DiagnosisRepository.create(task)
      -> return { diagnosis_id, status: queued }
```

---

## 伪代码

```ts
// diagnosis.controller.ts
@Post()
async createDiagnosis(
  @Body() dto: CreateDiagnosisDto,
): Promise<CreateDiagnosisResponseDto> {
  return this.diagnosisAppService.createTask(dto);
}
```

```ts
// application/diagnosis-app.service.ts
@Injectable()
export class DiagnosisAppService {
  constructor(private readonly diagnosisRepository: DiagnosisRepository) {}

  async createTask(dto: CreateDiagnosisDto): Promise<CreateDiagnosisResponseDto> {
    const diagnosisId = this.generateDiagnosisId();

    await this.diagnosisRepository.create({
      diagnosisId,
      mode: dto.mode,
      pageUrl: dto.page_url,
      target: dto.target,
      actionContext: dto.action_context,
      traceContext: dto.trace_context,
      options: dto.options,
      status: 'queued',
      createdAt: new Date().toISOString(),
    });

    return {
      code: 'ACCEPTED',
      message: 'diagnosis task accepted',
      data: {
        diagnosis_id: diagnosisId,
        status: 'queued',
      },
    };
  }

  private generateDiagnosisId(): string {
    return `diag_${Date.now()}`;
  }
}
```

---

# 3.2 GET /api/v1/diagnosis/:id

这个接口负责“取结果”。  
MVP 可以做成 **lazy execution**：

- 如果已有结果，直接返回
- 如果没有结果，当场执行一遍并缓存

这样你先不用上消息队列，也能跑起来。

---

## 调用流程

```text
DiagnosisController.getDiagnosisById(id)
  -> DiagnosisQueryService.getOrRunDiagnosis(id)
      -> repository.findTask(id)
      -> if completed => return result
      -> repository.markRunning(id)
      -> collector.collect(task)
      -> contextBuilder.build(rawEvidence)
      -> ruleEngine.run(context)
      -> conclusionService.conclude(findings, context)
      -> dominoChainBuilder.build(context, conclusion)
      -> explanationBuilder.build(context, conclusion)
      -> repository.saveCompletedResult(id, ...)
      -> return result
```

---

# 4. 关键领域对象

---

## 4.1 DiagnosisContext

这个是 Rule Engine 和 Diagnosis Service 之间的桥。

```ts
export interface DiagnosisContext {
  diagnosisId: string;
  mode: 'inspect_diagnosis' | 'click_diagnosis';

  interactionId?: string;
  lineageId?: string;

  pageUrl?: string;
  targetDomSelector?: string;
  targetComponent?: string;
  displayedValue?: unknown;

  apiValue?: unknown;
  apiFieldPath?: string;
  apiFieldExists?: boolean;
  responseSuccess?: boolean;

  storeValue?: unknown;
  storeKey?: string;
  storeUpdated?: boolean;

  selectorValue?: unknown;
  selectorName?: string;
  selectorRan?: boolean;

  renderInputValue?: unknown;
  renderOutputValue?: unknown;
  previousRenderOutputValue?: unknown;
  renderTriggered?: boolean;
  formatterName?: string;
  formatterOutputIsFallback?: boolean;

  domValue?: unknown;
  domUpdated?: boolean;
  domVisible?: boolean;

  clickDetected?: boolean;
  handlerStarted?: boolean;
  requestSent?: boolean;
  responseReceived?: boolean;
  stateChanged?: boolean;
  renderCommitted?: boolean;

  fallbackTokens?: string[];
  evidenceRefs?: string[];
}
```

---

## 4.2 RuleFinding

```ts
export interface RuleFinding {
  ruleCode: string;
  title: string;
  diagnosisLabel: string;
  category: string;
  severity: 'low' | 'medium' | 'high';
  confidence: number;
  layer: string;
  cluster?: string;
  summary: string;
  evidenceRefs: string[];
  suggestions: string[];
}
```

---

## 4.3 DiagnosisConclusion

```ts
export interface DiagnosisConclusion {
  topFinding: EnrichedFinding | null;
  supportingFindings: EnrichedFinding[];
  symptomFindings: EnrichedFinding[];
  summary: string;
  repairHints: string[];
  scoreBreakdown: Array<{
    ruleCode: string;
    finalScore: number;
    reason: string[];
  }>;
  diagnosisState:
    | 'confirmed_root_cause'
    | 'probable_root_cause'
    | 'insufficient_evidence'
    | 'no_rule_matched';
}
```

---

# 5. NestJS 中的实际调用链代码骨架

下面我给你按类串起来。

---

## 5.1 diagnosis.controller.ts

```ts
@Controller('/api/v1/diagnosis')
export class DiagnosisController {
  constructor(
    private readonly diagnosisAppService: DiagnosisAppService,
    private readonly diagnosisQueryService: DiagnosisQueryService,
  ) {}

  @Post()
  async createDiagnosis(
    @Body() dto: CreateDiagnosisDto,
  ): Promise<CreateDiagnosisResponseDto> {
    return this.diagnosisAppService.createTask(dto);
  }

  @Get(':diagnosisId')
  async getDiagnosisById(
    @Param('diagnosisId') diagnosisId: string,
  ): Promise<GetDiagnosisResponseDto> {
    return this.diagnosisQueryService.getOrRunDiagnosis(diagnosisId);
  }

  @Get(':diagnosisId/evidences/:evidenceRef')
  async getEvidenceDetail(
    @Param('diagnosisId') diagnosisId: string,
    @Param('evidenceRef') evidenceRef: string,
  ): Promise<GetEvidenceResponseDto> {
    return this.diagnosisQueryService.getEvidenceDetail(diagnosisId, evidenceRef);
  }

  @Get(':diagnosisId/domino-chain')
  async getDominoChain(
    @Param('diagnosisId') diagnosisId: string,
  ): Promise<GetDominoChainResponseDto> {
    return this.diagnosisQueryService.getDominoChain(diagnosisId);
  }
}
```

---

## 5.2 application/diagnosis-query.service.ts

这是核心 orchestrator。

```ts
@Injectable()
export class DiagnosisQueryService {
  constructor(
    private readonly diagnosisRepository: DiagnosisRepository,
    private readonly evidenceCollector: EvidenceCollector,
    private readonly contextBuilder: ContextBuilder,
    private readonly ruleEngine: RuleEngine,
    private readonly diagnosisConclusionService: DiagnosisConclusionService,
    private readonly explanationBuilder: ExplanationBuilder,
    private readonly dominoChainBuilder: DominoChainBuilder,
  ) {}

  async getOrRunDiagnosis(diagnosisId: string): Promise<GetDiagnosisResponseDto> {
    const task = await this.diagnosisRepository.findById(diagnosisId);
    if (!task) {
      throw new NotFoundException(`Diagnosis ${diagnosisId} not found`);
    }

    if (task.status === 'completed' && task.result) {
      return {
        code: 'OK',
        message: 'success',
        data: task.result,
      };
    }

    await this.diagnosisRepository.markRunning(diagnosisId);

    try {
      const rawEvidence = await this.evidenceCollector.collect(task);
      const context = await this.contextBuilder.build(task, rawEvidence);

      const findings = this.ruleEngine.run(context);
      const conclusion = this.diagnosisConclusionService.conclude(findings, context);
      const explanation = this.explanationBuilder.build(context, conclusion);
      const dominoChain = this.dominoChainBuilder.build(context, conclusion);

      const result = {
        diagnosis_id: diagnosisId,
        mode: task.mode,
        status: 'completed',
        diagnosis_state: conclusion.diagnosisState,
        interaction_id: context.interactionId ?? null,
        lineage_id: context.lineageId ?? null,
        target: explanation.target,
        top_cause: explanation.topCause,
        supporting_causes: explanation.supportingCauses,
        symptoms: explanation.symptoms,
        summary: explanation.summary,
        repair_hints: explanation.repairHints,
        score_breakdown: explanation.scoreBreakdown,
        evidence_overview: explanation.evidenceOverview,
        domino_chain: dominoChain,
        next_actions: explanation.nextActions,
        generated_at: new Date().toISOString(),
      };

      await this.diagnosisRepository.saveCompletedResult(diagnosisId, result);

      return {
        code: 'OK',
        message: 'success',
        data: result,
      };
    } catch (error) {
      await this.diagnosisRepository.markFailed(
        diagnosisId,
        error instanceof Error ? error.message : 'unknown error',
      );
      throw error;
    }
  }

  async getEvidenceDetail(
    diagnosisId: string,
    evidenceRef: string,
  ): Promise<GetEvidenceResponseDto> {
    const evidence = await this.diagnosisRepository.findEvidence(diagnosisId, evidenceRef);
    if (!evidence) {
      throw new NotFoundException(`Evidence ${evidenceRef} not found`);
    }

    return {
      code: 'OK',
      message: 'success',
      data: evidence,
    };
  }

  async getDominoChain(
    diagnosisId: string,
  ): Promise<GetDominoChainResponseDto> {
    const task = await this.diagnosisRepository.findById(diagnosisId);
    if (!task || !task.result) {
      throw new NotFoundException(`Diagnosis ${diagnosisId} not found`);
    }

    return {
      code: 'OK',
      message: 'success',
      data: {
        diagnosis_id: diagnosisId,
        domino_chain: task.result.domino_chain ?? [],
      },
    };
  }
}
```

---

# 6. Evidence -> Context -> Rules -> Conclusion 的衔接

这是最关键的“中段”。

---

## 6.1 infrastructure/evidence.collector.ts

职责：拉原始证据，不做业务归因。

```ts
@Injectable()
export class EvidenceCollector {
  async collect(task: DiagnosisTaskEntity): Promise<RawEvidenceBundle> {
    return {
      trace: await this.collectTrace(task),
      lineage: await this.collectLineage(task),
      network: await this.collectNetwork(task),
      state: await this.collectState(task),
      render: await this.collectRender(task),
      dom: await this.collectDom(task),
    };
  }

  private async collectTrace(task: DiagnosisTaskEntity) {
    return {};
  }

  private async collectLineage(task: DiagnosisTaskEntity) {
    return {};
  }

  private async collectNetwork(task: DiagnosisTaskEntity) {
    return {};
  }

  private async collectState(task: DiagnosisTaskEntity) {
    return {};
  }

  private async collectRender(task: DiagnosisTaskEntity) {
    return {};
  }

  private async collectDom(task: DiagnosisTaskEntity) {
    return {};
  }
}
```

---

## 6.2 infrastructure/context.builder.ts

职责：把离散证据映射成统一上下文。

```ts
@Injectable()
export class ContextBuilder {
  async build(
    task: DiagnosisTaskEntity,
    raw: RawEvidenceBundle,
  ): Promise<DiagnosisContext> {
    return {
      diagnosisId: task.diagnosisId,
      mode: task.mode,
      interactionId: task.traceContext?.interaction_id,
      lineageId: task.traceContext?.lineage_id,

      pageUrl: task.pageUrl,
      targetDomSelector: task.target?.dom_selector,
      targetComponent: task.target?.component_name,
      displayedValue: task.target?.displayed_value,

      apiFieldPath: this.extractApiFieldPath(raw),
      apiFieldExists: this.extractApiFieldExists(raw),
      apiValue: this.extractApiValue(raw),
      responseSuccess: this.extractResponseSuccess(raw),

      storeKey: this.extractStoreKey(raw),
      storeUpdated: this.extractStoreUpdated(raw),
      storeValue: this.extractStoreValue(raw),

      selectorName: this.extractSelectorName(raw),
      selectorRan: this.extractSelectorRan(raw),
      selectorValue: this.extractSelectorValue(raw),

      renderTriggered: this.extractRenderTriggered(raw),
      renderInputValue: this.extractRenderInput(raw),
      renderOutputValue: this.extractRenderOutput(raw),
      previousRenderOutputValue: this.extractPreviousRenderOutput(raw),
      formatterName: this.extractFormatterName(raw),
      formatterOutputIsFallback: this.extractFormatterFallback(raw),

      domUpdated: this.extractDomUpdated(raw),
      domVisible: this.extractDomVisible(raw),
      domValue: this.extractDomValue(raw),

      clickDetected: this.extractClickDetected(raw),
      handlerStarted: this.extractHandlerStarted(raw),
      requestSent: this.extractRequestSent(raw),
      responseReceived: this.extractResponseReceived(raw),
      stateChanged: this.extractStateChanged(raw),
      renderCommitted: this.extractRenderCommitted(raw),

      fallbackTokens: ['--', '-', '暂无', 'N/A', ''],
      evidenceRefs: this.extractEvidenceRefs(raw),
    };
  }

  private extractApiFieldPath(raw: RawEvidenceBundle): string | undefined {
    return raw.lineage?.apiFieldPath;
  }

  private extractApiFieldExists(raw: RawEvidenceBundle): boolean {
    return Boolean(raw.network?.fieldExists);
  }

  private extractApiValue(raw: RawEvidenceBundle): unknown {
    return raw.network?.fieldValue;
  }

  private extractResponseSuccess(raw: RawEvidenceBundle): boolean {
    return Boolean(raw.network?.responseSuccess);
  }

  private extractStoreKey(raw: RawEvidenceBundle): string | undefined {
    return raw.lineage?.storeKey;
  }

  private extractStoreUpdated(raw: RawEvidenceBundle): boolean {
    return Boolean(raw.state?.updated);
  }

  private extractStoreValue(raw: RawEvidenceBundle): unknown {
    return raw.state?.value;
  }

  private extractSelectorName(raw: RawEvidenceBundle): string | undefined {
    return raw.lineage?.selectorName;
  }

  private extractSelectorRan(raw: RawEvidenceBundle): boolean {
    return Boolean(raw.render?.selectorRan);
  }

  private extractSelectorValue(raw: RawEvidenceBundle): unknown {
    return raw.render?.selectorValue;
  }

  private extractRenderTriggered(raw: RawEvidenceBundle): boolean {
    return Boolean(raw.render?.triggered);
  }

  private extractRenderInput(raw: RawEvidenceBundle): unknown {
    return raw.render?.input;
  }

  private extractRenderOutput(raw: RawEvidenceBundle): unknown {
    return raw.render?.output;
  }

  private extractPreviousRenderOutput(raw: RawEvidenceBundle): unknown {
    return raw.render?.previousOutput;
  }

  private extractFormatterName(raw: RawEvidenceBundle): string | undefined {
    return raw.render?.formatterName;
  }

  private extractFormatterFallback(raw: RawEvidenceBundle): boolean {
    return Boolean(raw.render?.formatterOutputIsFallback);
  }

  private extractDomUpdated(raw: RawEvidenceBundle): boolean {
    return Boolean(raw.dom?.updated);
  }

  private extractDomVisible(raw: RawEvidenceBundle): boolean {
    return raw.dom?.visible !== false;
  }

  private extractDomValue(raw: RawEvidenceBundle): unknown {
    return raw.dom?.displayedValue;
  }

  private extractClickDetected(raw: RawEvidenceBundle): boolean {
    return Boolean(raw.trace?.clickDetected);
  }

  private extractHandlerStarted(raw: RawEvidenceBundle): boolean {
    return Boolean(raw.trace?.handlerStarted);
  }

  private extractRequestSent(raw: RawEvidenceBundle): boolean {
    return Boolean(raw.network?.requestSent);
  }

  private extractResponseReceived(raw: RawEvidenceBundle): boolean {
    return Boolean(raw.network?.responseReceived);
  }

  private extractStateChanged(raw: RawEvidenceBundle): boolean {
    return Boolean(raw.state?.changed);
  }

  private extractRenderCommitted(raw: RawEvidenceBundle): boolean {
    return Boolean(raw.render?.committed);
  }

  private extractEvidenceRefs(raw: RawEvidenceBundle): string[] {
    return raw.evidenceRefs ?? [];
  }
}
```

---

# 7. Rule Engine 如何接入 NestJS

建议把 Rule Engine 封成一个 provider。

---

## 7.1 domain/rule-engine/engine.ts

```ts
@Injectable()
export class RuleEngine {
  run(context: DiagnosisContext): RuleFinding[] {
    let findings: RuleFinding[] = [];

    findings = findings.concat(this.runDataSourceRules(context));
    findings = findings.concat(this.runStateBindingRules(context));
    findings = findings.concat(this.runRenderRules(context));
    findings = findings.concat(this.runDomRules(context));
    findings = findings.concat(this.runInteractionRules(context));

    return findings;
  }

  private runDataSourceRules(context: DiagnosisContext): RuleFinding[] {
    return [];
  }

  private runStateBindingRules(context: DiagnosisContext): RuleFinding[] {
    return [];
  }

  private runRenderRules(context: DiagnosisContext): RuleFinding[] {
    return [];
  }

  private runDomRules(context: DiagnosisContext): RuleFinding[] {
    return [];
  }

  private runInteractionRules(context: DiagnosisContext): RuleFinding[] {
    return [];
  }
}
```

正式落地时，这里直接接你前面已经定义好的 TS 规则函数：

```ts
runDataSourceRules(context) => [hitApiFieldMissing(context), ...].filter(Boolean)
```

---

# 8. Diagnosis Service 如何承接 Rule Engine 输出

这里建议单独一个 `DiagnosisConclusionService`，不要和 Controller 层混在一起。

---

## 8.1 domain/diagnosis/diagnosis-conclusion.service.ts

```ts
@Injectable()
export class DiagnosisConclusionService {
  conclude(
    findings: RuleFinding[],
    context: DiagnosisContext,
  ): DiagnosisConclusion {
    if (!findings.length) {
      return this.buildEmptyConclusion(context);
    }

    const ranked = this.rankFindings(findings, context);
    const topFinding = ranked[0] ?? null;

    const supportingFindings = ranked.filter(
      (item, index) =>
        index > 0 &&
        !item.isSymptomOnly &&
        item.cluster !== topFinding?.cluster,
    );

    const symptomFindings = ranked.filter((item) => item.isSymptomOnly);

    const repairHints = Array.from(
      new Set([
        ...(topFinding?.suggestions ?? []),
        ...supportingFindings.flatMap((item) => item.suggestions),
      ]),
    ).slice(0, 5);

    return {
      topFinding,
      supportingFindings,
      symptomFindings,
      summary: topFinding
        ? `最可能根因是「${topFinding.diagnosisLabel}」：${topFinding.summary}`
        : '当前未形成明确归因结论。',
      repairHints,
      scoreBreakdown: ranked.map((item) => ({
        ruleCode: item.ruleCode,
        finalScore: item.rankScore.finalScore,
        reason: item.rankReasons ?? [],
      })),
      diagnosisState: this.resolveDiagnosisState(ranked, context),
    };
  }

  private buildEmptyConclusion(context: DiagnosisContext): DiagnosisConclusion {
    const hasMinimalEvidence =
      Boolean(context.responseSuccess) ||
      Boolean(context.storeUpdated) ||
      Boolean(context.renderTriggered) ||
      Boolean(context.domValue);

    return {
      topFinding: null,
      supportingFindings: [],
      symptomFindings: [],
      summary: hasMinimalEvidence
        ? '当前链路证据存在，但现有规则未识别出明确异常。'
        : '当前证据不足，尚无法明确归因。',
      repairHints: hasMinimalEvidence
        ? ['检查业务计算逻辑', '补充业务规则类诊断']
        : ['补充接口响应快照', '补充 store 更新轨迹', '补充 render 证据'],
      scoreBreakdown: [],
      diagnosisState: hasMinimalEvidence
        ? 'no_rule_matched'
        : 'insufficient_evidence',
    };
  }

  private rankFindings(
    findings: RuleFinding[],
    context: DiagnosisContext,
  ): EnrichedFinding[] {
    return rankFindings(findings, context);
  }

  private resolveDiagnosisState(
    ranked: EnrichedFinding[],
    _context: DiagnosisContext,
  ): DiagnosisConclusion['diagnosisState'] {
    const top = ranked[0];
    if (!top) return 'insufficient_evidence';

    if (top.confidence >= 0.9) return 'confirmed_root_cause';
    return 'probable_root_cause';
  }
}
```

---

# 9. Explanation Builder 如何接结果

Explanation Builder 负责把领域对象装配成 API 可返回的结构。

---

## 9.1 domain/diagnosis/explanation.builder.ts

```ts
@Injectable()
export class ExplanationBuilder {
  build(
    context: DiagnosisContext,
    conclusion: DiagnosisConclusion,
  ) {
    return {
      target: {
        page_url: context.pageUrl,
        target_dom_selector: context.targetDomSelector,
        target_component: context.targetComponent,
        displayed_value: context.displayedValue as any,
        expected_binding: {
          api_field_path: context.apiFieldPath,
          store_key: context.storeKey,
          selector_name: context.selectorName,
          formatter_name: context.formatterName,
        },
      },
      topCause: conclusion.topFinding
        ? this.toFindingDto(conclusion.topFinding)
        : null,
      supportingCauses: conclusion.supportingFindings.map((item) =>
        this.toFindingDto(item),
      ),
      symptoms: conclusion.symptomFindings.map((item) =>
        this.toFindingDto(item),
      ),
      summary: conclusion.summary,
      repairHints: conclusion.repairHints,
      scoreBreakdown: conclusion.scoreBreakdown.map((item) => ({
        rule_code: item.ruleCode,
        final_score: item.finalScore,
        reason: item.reason,
      })),
      evidenceOverview: {
        api: {
          response_success: context.responseSuccess ?? null,
          field_path: context.apiFieldPath ?? null,
          field_exists: context.apiFieldExists ?? null,
          field_value: context.apiValue ?? null,
        },
        state: {
          store_key: context.storeKey ?? null,
          store_updated: context.storeUpdated ?? null,
          store_value: context.storeValue ?? null,
        },
        selector: {
          selector_name: context.selectorName ?? null,
          selector_ran: context.selectorRan ?? null,
          selector_value: context.selectorValue ?? null,
        },
        render: {
          render_triggered: context.renderTriggered ?? null,
          formatter_name: context.formatterName ?? null,
          render_input_value: context.renderInputValue ?? null,
          render_output_value: context.renderOutputValue ?? null,
          formatter_output_is_fallback: context.formatterOutputIsFallback ?? null,
        },
        dom: {
          dom_updated: context.domUpdated ?? null,
          dom_visible: context.domVisible ?? null,
          displayed_value: context.domValue ?? null,
        },
        interaction: {
          click_detected: context.clickDetected ?? null,
          handler_started: context.handlerStarted ?? null,
          request_sent: context.requestSent ?? null,
          response_success: context.responseSuccess ?? null,
        },
      },
      nextActions: this.buildNextActions(conclusion),
    };
  }

  private toFindingDto(item: EnrichedFinding) {
    return {
      rule_code: item.ruleCode,
      title: item.title,
      diagnosis_label: item.diagnosisLabel,
      category: item.category,
      severity: item.severity,
      confidence: item.confidence,
      layer: item.layer,
      cluster: item.cluster,
      summary: item.summary,
      evidence_refs: item.evidenceRefs,
      suggestions: item.suggestions,
      rank_score: {
        rule_code: item.rankScore.ruleCode,
        base_score: item.rankScore.baseScore,
        root_cause_score: item.rankScore.rootCauseScore,
        specificity_score: item.rankScore.specificityScore,
        evidence_score: item.rankScore.evidenceScore,
        chain_consistency_score: item.rankScore.chainConsistencyScore,
        symptom_penalty: item.rankScore.symptomPenalty,
        duplicate_penalty: item.rankScore.duplicatePenalty,
        final_score: item.rankScore.finalScore,
      },
      rank_reasons: item.rankReasons ?? [],
    };
  }

  private buildNextActions(conclusion: DiagnosisConclusion) {
    const top = conclusion.topFinding;
    if (!top) return [];

    return (top.evidenceRefs ?? []).slice(0, 3).map((ref) => ({
      action_type: 'inspect_evidence',
      label: `查看证据 ${ref}`,
      target_ref: ref,
    }));
  }
}
```

---

# 10. DominoChainBuilder 如何接结果

你前面一直强调“多米诺骨牌式因果链”，这一层最好独立。

---

## 10.1 domain/diagnosis/domino-chain.builder.ts

```ts
@Injectable()
export class DominoChainBuilder {
  build(
    context: DiagnosisContext,
    conclusion: DiagnosisConclusion,
  ): Array<Record<string, any>> {
    const brokenRuleCode = conclusion.topFinding?.ruleCode;

    const chain: Array<Record<string, any>> = [];

    if (context.responseSuccess !== undefined) {
      chain.push({
        step: chain.length + 1,
        layer: 'api',
        node_type: 'response_field',
        label: `${context.apiFieldPath ?? 'api_field'} = ${String(context.apiValue)}`,
        status: context.responseSuccess ? 'ok' : 'observed',
        evidence_ref: 'ev_api_value',
      });
    }

    if (context.storeKey) {
      chain.push({
        step: chain.length + 1,
        layer: 'state',
        node_type: 'store_update',
        label: `${context.storeKey} = ${String(context.storeValue)}`,
        status: context.storeUpdated ? 'ok' : brokenRuleCode === 'R101' ? 'broken' : 'observed',
        evidence_ref: 'ev_store_value',
        hit_rule_code: brokenRuleCode === 'R101' ? 'R101' : undefined,
      });
    }

    if (context.formatterName) {
      chain.push({
        step: chain.length + 1,
        layer: 'render',
        node_type: 'formatter',
        label: `${context.formatterName}(${String(context.renderInputValue)}) -> ${String(context.renderOutputValue)}`,
        status:
          brokenRuleCode === 'R201' || brokenRuleCode === 'R202'
            ? 'broken'
            : context.renderTriggered
            ? 'ok'
            : 'affected',
        evidence_ref: 'ev_formatter_trace',
        hit_rule_code:
          brokenRuleCode === 'R201' || brokenRuleCode === 'R202'
            ? brokenRuleCode
            : undefined,
      });
    }

    chain.push({
      step: chain.length + 1,
      layer: 'dom',
      node_type: 'dom_text',
      label: `DOM displays ${String(context.domValue ?? context.displayedValue)}`,
      status: conclusion.topFinding ? 'affected' : 'observed',
      evidence_ref: 'ev_dom_snapshot',
    });

    return chain;
  }
}
```

---

# 11. Repository 应该存什么

MVP 即便先用内存仓库，也建议结构先定。

---

## 11.1 DiagnosisTaskEntity

```ts
export interface DiagnosisTaskEntity {
  diagnosisId: string;
  mode: 'inspect_diagnosis' | 'click_diagnosis';
  pageUrl: string;
  target: {
    dom_selector: string;
    component_name?: string;
    displayed_value?: unknown;
  };
  actionContext?: {
    event_type?: string;
    event_target?: string;
    action_label?: string;
  };
  traceContext?: {
    interaction_id?: string;
    lineage_id?: string;
  };
  options?: {
    include_score_breakdown?: boolean;
    include_domino_chain?: boolean;
    include_evidence_overview?: boolean;
  };
  status: 'queued' | 'running' | 'completed' | 'failed';
  result?: any;
  errorMessage?: string;
  createdAt: string;
  updatedAt?: string;
}
```

---

## 11.2 diagnosis.repository.ts

```ts
@Injectable()
export class DiagnosisRepository {
  private readonly store = new Map<string, DiagnosisTaskEntity>();
  private readonly evidenceStore = new Map<string, Record<string, any>>();

  async create(task: DiagnosisTaskEntity): Promise<void> {
    this.store.set(task.diagnosisId, task);
  }

  async findById(diagnosisId: string): Promise<DiagnosisTaskEntity | null> {
    return this.store.get(diagnosisId) ?? null;
  }

  async markRunning(diagnosisId: string): Promise<void> {
    const task = this.store.get(diagnosisId);
    if (!task) return;
    task.status = 'running';
    task.updatedAt = new Date().toISOString();
    this.store.set(diagnosisId, task);
  }

  async saveCompletedResult(diagnosisId: string, result: any): Promise<void> {
    const task = this.store.get(diagnosisId);
    if (!task) return;
    task.status = 'completed';
    task.result = result;
    task.updatedAt = new Date().toISOString();
    this.store.set(diagnosisId, task);
  }

  async markFailed(diagnosisId: string, errorMessage: string): Promise<void> {
    const task = this.store.get(diagnosisId);
    if (!task) return;
    task.status = 'failed';
    task.errorMessage = errorMessage;
    task.updatedAt = new Date().toISOString();
    this.store.set(diagnosisId, task);
  }

  async findEvidence(
    diagnosisId: string,
    evidenceRef: string,
  ): Promise<any | null> {
    return this.evidenceStore.get(diagnosisId)?.[evidenceRef] ?? null;
  }
}
```

---

# 12. Module 装配关系

---

## 12.1 diagnosis.module.ts

```ts
@Module({
  controllers: [DiagnosisController],
  providers: [
    DiagnosisAppService,
    DiagnosisQueryService,

    DiagnosisRepository,
    EvidenceCollector,
    ContextBuilder,

    RuleEngine,
    DiagnosisConclusionService,
    ExplanationBuilder,
    DominoChainBuilder,
  ],
  exports: [DiagnosisAppService, DiagnosisQueryService],
})
export class DiagnosisModule {}
```

---

# 13. 一张调用链总图

给你一个适合文档里的版本：

```text
[HTTP Request]
    │
    ▼
[DiagnosisController]
    │
    ├── POST /diagnosis
    │      ▼
    │   [DiagnosisAppService]
    │      ▼
    │   [DiagnosisRepository.create]
    │
    └── GET /diagnosis/:id
           ▼
      [DiagnosisQueryService]
           ▼
      [DiagnosisRepository.findById]
           ▼
      [EvidenceCollector]
           ▼
      [ContextBuilder]
           ▼
      [RuleEngine]
           ▼
      [DiagnosisConclusionService]
           ▼
      [ExplanationBuilder]
           ▼
      [DominoChainBuilder]
           ▼
      [DiagnosisRepository.saveCompletedResult]
           ▼
      [Response DTO]
```

---

# 14. MVP 实现建议

如果你下一步真的要落代码，我建议按这个顺序：

### 第一阶段
- `DiagnosisController`
- `DiagnosisAppService`
- `DiagnosisRepository`
- `DiagnosisQueryService`

先把接口骨架跑通。

### 第二阶段
- `ContextBuilder`
- `RuleEngine`
- 先接 6 条 P0 规则

### 第三阶段
- `DiagnosisConclusionService`
- `ExplanationBuilder`

先把结果能排出来、讲出来。

### 第四阶段
- `DominoChainBuilder`
- `/domino-chain`
- `/evidences/:ref`

把工作台能力补起来。

---

# 15. 一句话总结

这套 NestJS 调用链的核心思路是：

> **Controller 只负责进出，Application Service 负责编排，Rule Engine 负责判定，Diagnosis Service 负责归因，Builder 负责面向工作台组织结果。**

这样后面你要扩：

- 异步任务队列
- 缓存
- 多规则批次
- AI explanation
- 多米诺因果链动画

都不会推翻现有结构。

---

如果你愿意，我下一步可以继续直接补：

1. **Diagnosis Service TypeScript 完整代码骨架**
2. **Rule Engine 在 NestJS 中的完整 provider 实现**
3. **Jest 单测样例**
4. **Workbench 诊断结果卡片结构**
5. **domino_chain 前端可视化数据结构**

如果按工程顺序，我建议下一步直接做：  
**《Diagnosis Service TypeScript 完整代码骨架》**。