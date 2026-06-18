下面直接给你一版 **Diagnosis API OpenAPI / Swagger 草案**。  
我会按 **MVP 可落地** 来写，重点覆盖：

- 发起诊断
- 查询诊断结果
- 获取证据详情
- 获取链路/多米诺数据

我先用 **OpenAPI 3.0.3** 风格给出，字段命名和你前面已经确定的：

- `Inspect -> Trace -> Lineage -> Rule -> Diagnosis`
- `top_cause / supporting_causes / symptoms`
- `domino_chain`

保持一致。

---

# 1. API 范围建议

MVP 先做 4 个接口就够：

1. `POST /api/v1/diagnosis`  
   发起一次诊断任务

2. `GET /api/v1/diagnosis/{diagnosisId}`  
   获取诊断结果

3. `GET /api/v1/diagnosis/{diagnosisId}/evidences/{evidenceRef}`  
   获取某条证据详情

4. `GET /api/v1/diagnosis/{diagnosisId}/domino-chain`  
   获取多米诺因果链数据

如果你想更偏同步，也可以把 `POST /diagnosis` 做成同步返回。  
但从工程上看，我建议先设计成 **异步任务式**，因为后面做 trace 聚合、规则引擎、证据拼装都更稳。

---

# 2. OpenAPI 草案

下面是一版可以直接作为 Swagger 初稿使用的 YAML。

```yaml
openapi: 3.0.3
info:
  title: Diagnosis API
  version: 0.1.0
  description: >
    Frontend interaction and data-lineage diagnosis API for MVP.
    Covers inspect diagnosis, click diagnosis, evidence retrieval,
    and domino-style causality chain query.

servers:
  - url: https://example.com
    description: Production
  - url: http://localhost:8080
    description: Local

tags:
  - name: Diagnosis
    description: Create and query diagnosis tasks
  - name: Evidence
    description: Query diagnosis evidence details
  - name: DominoChain
    description: Query domino-style causality chain data

paths:
  /api/v1/diagnosis:
    post:
      tags:
        - Diagnosis
      summary: Create a diagnosis task
      operationId: createDiagnosis
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateDiagnosisRequest'
            examples:
              inspectDiagnosis:
                summary: Inspect diagnosis request
                value:
                  mode: inspect_diagnosis
                  page_url: /orders/detail?id=A1001
                  target:
                    dom_selector: .order-amount
                    component_name: OrderAmount
                    displayed_value: "--"
                  trace_context:
                    interaction_id: itr_9f3b2d11
                    lineage_id: lin_b81c44a2
              clickDiagnosis:
                summary: Click diagnosis request
                value:
                  mode: click_diagnosis
                  page_url: /dashboard/device
                  target:
                    dom_selector: .device-status-card .value
                    component_name: DeviceStatusCard
                  action_context:
                    event_type: click
                    event_target: button.refresh-status
                    action_label: 刷新状态
                  trace_context:
                    interaction_id: itr_3ab892ee
      responses:
        '202':
          description: Diagnosis task accepted
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/CreateDiagnosisResponse'
        '400':
          description: Invalid request
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /api/v1/diagnosis/{diagnosisId}:
    get:
      tags:
        - Diagnosis
      summary: Get diagnosis result
      operationId: getDiagnosisById
      parameters:
        - name: diagnosisId
          in: path
          required: true
          schema:
            type: string
          example: diag_20260612_0001
      responses:
        '200':
          description: Diagnosis result
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/GetDiagnosisResponse'
        '404':
          description: Diagnosis not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /api/v1/diagnosis/{diagnosisId}/evidences/{evidenceRef}:
    get:
      tags:
        - Evidence
      summary: Get evidence detail by reference
      operationId: getEvidenceDetail
      parameters:
        - name: diagnosisId
          in: path
          required: true
          schema:
            type: string
        - name: evidenceRef
          in: path
          required: true
          schema:
            type: string
          example: ev_formatter_output_fallback
      responses:
        '200':
          description: Evidence detail
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/GetEvidenceResponse'
        '404':
          description: Evidence not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /api/v1/diagnosis/{diagnosisId}/domino-chain:
    get:
      tags:
        - DominoChain
      summary: Get domino causality chain
      operationId: getDominoChain
      parameters:
        - name: diagnosisId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Domino chain data
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/GetDominoChainResponse'
        '404':
          description: Diagnosis not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

components:
  schemas:
    CreateDiagnosisRequest:
      type: object
      required:
        - mode
        - page_url
        - target
      properties:
        mode:
          type: string
          enum:
            - inspect_diagnosis
            - click_diagnosis
          example: inspect_diagnosis
        page_url:
          type: string
          example: /orders/detail?id=A1001
        target:
          $ref: '#/components/schemas/DiagnosisTarget'
        action_context:
          $ref: '#/components/schemas/ActionContext'
        trace_context:
          $ref: '#/components/schemas/TraceContext'
        options:
          $ref: '#/components/schemas/DiagnosisOptions'

    CreateDiagnosisResponse:
      type: object
      required:
        - code
        - message
        - data
      properties:
        code:
          type: string
          example: ACCEPTED
        message:
          type: string
          example: diagnosis task accepted
        data:
          type: object
          required:
            - diagnosis_id
            - status
          properties:
            diagnosis_id:
              type: string
              example: diag_20260612_0001
            status:
              type: string
              enum:
                - queued
                - running
                - completed
                - failed
              example: queued

    GetDiagnosisResponse:
      type: object
      required:
        - code
        - message
        - data
      properties:
        code:
          type: string
          example: OK
        message:
          type: string
          example: success
        data:
          $ref: '#/components/schemas/DiagnosisResult'

    GetEvidenceResponse:
      type: object
      required:
        - code
        - message
        - data
      properties:
        code:
          type: string
          example: OK
        message:
          type: string
          example: success
        data:
          $ref: '#/components/schemas/EvidenceDetail'

    GetDominoChainResponse:
      type: object
      required:
        - code
        - message
        - data
      properties:
        code:
          type: string
          example: OK
        message:
          type: string
          example: success
        data:
          type: object
          required:
            - diagnosis_id
            - domino_chain
          properties:
            diagnosis_id:
              type: string
              example: diag_20260612_0001
            domino_chain:
              type: array
              items:
                $ref: '#/components/schemas/DominoChainNode'

    ErrorResponse:
      type: object
      required:
        - code
        - message
      properties:
        code:
          type: string
          example: BAD_REQUEST
        message:
          type: string
          example: invalid request payload
        details:
          type: array
          items:
            type: string

    DiagnosisTarget:
      type: object
      required:
        - dom_selector
      properties:
        dom_selector:
          type: string
          example: .order-amount
        component_name:
          type: string
          example: OrderAmount
        displayed_value:
          nullable: true
          oneOf:
            - type: string
            - type: number
            - type: boolean

    ActionContext:
      type: object
      properties:
        event_type:
          type: string
          example: click
        event_target:
          type: string
          example: button.refresh-status
        action_label:
          type: string
          example: 刷新状态

    TraceContext:
      type: object
      properties:
        interaction_id:
          type: string
          example: itr_9f3b2d11
        lineage_id:
          type: string
          example: lin_b81c44a2

    DiagnosisOptions:
      type: object
      properties:
        include_score_breakdown:
          type: boolean
          default: true
        include_domino_chain:
          type: boolean
          default: true
        include_evidence_overview:
          type: boolean
          default: true

    DiagnosisResult:
      type: object
      required:
        - diagnosis_id
        - mode
        - status
        - summary
        - repair_hints
        - supporting_causes
        - symptoms
        - generated_at
      properties:
        diagnosis_id:
          type: string
          example: diag_20260612_0001
        mode:
          type: string
          enum:
            - inspect_diagnosis
            - click_diagnosis
        status:
          type: string
          enum:
            - queued
            - running
            - completed
            - failed
        diagnosis_state:
          type: string
          enum:
            - confirmed_root_cause
            - probable_root_cause
            - insufficient_evidence
            - no_rule_matched
          example: confirmed_root_cause
        interaction_id:
          type: string
          nullable: true
          example: itr_9f3b2d11
        lineage_id:
          type: string
          nullable: true
          example: lin_b81c44a2
        target:
          $ref: '#/components/schemas/DiagnosisResultTarget'
        top_cause:
          nullable: true
          $ref: '#/components/schemas/DiagnosisFinding'
        supporting_causes:
          type: array
          items:
            $ref: '#/components/schemas/DiagnosisFinding'
        symptoms:
          type: array
          items:
            $ref: '#/components/schemas/DiagnosisFinding'
        summary:
          type: string
          example: 最可能根因是「合法值被判空吞掉」。
        repair_hints:
          type: array
          items:
            type: string
        score_breakdown:
          type: array
          items:
            $ref: '#/components/schemas/ScoreBreakdownItem'
        evidence_overview:
          $ref: '#/components/schemas/EvidenceOverview'
        domino_chain:
          type: array
          items:
            $ref: '#/components/schemas/DominoChainNode'
        next_actions:
          type: array
          items:
            $ref: '#/components/schemas/NextAction'
        generated_at:
          type: string
          format: date-time

    DiagnosisResultTarget:
      type: object
      properties:
        page_url:
          type: string
        target_dom_selector:
          type: string
        target_component:
          type: string
        displayed_value:
          nullable: true
          oneOf:
            - type: string
            - type: number
            - type: boolean
        user_action:
          $ref: '#/components/schemas/ActionContext'
        expected_binding:
          $ref: '#/components/schemas/ExpectedBinding'

    ExpectedBinding:
      type: object
      properties:
        api_field_path:
          type: string
          example: response.data.amount
        store_key:
          type: string
          example: order.current.amount
        selector_name:
          type: string
          example: selectOrderAmount
        formatter_name:
          type: string
          example: formatCurrency

    DiagnosisFinding:
      type: object
      required:
        - rule_code
        - title
        - diagnosis_label
        - category
        - severity
        - confidence
        - layer
        - summary
        - evidence_refs
        - suggestions
      properties:
        rule_code:
          type: string
          example: R201
        title:
          type: string
          example: 合法 falsy 值被误判为空
        diagnosis_label:
          type: string
          example: 合法值被判空吞掉
        category:
          type: string
          enum:
            - data_source
            - state_binding
            - render_transform
            - dom
            - interaction
        severity:
          type: string
          enum:
            - low
            - medium
            - high
        confidence:
          type: number
          format: float
          minimum: 0
          maximum: 1
          example: 0.94
        layer:
          type: string
          enum:
            - api
            - api_to_state
            - state
            - selector
            - state_to_render
            - render
            - dom
            - ui
            - handler
            - request_to_ui
        cluster:
          type: string
          example: formatter_fallback
        summary:
          type: string
        evidence_refs:
          type: array
          items:
            type: string
        suggestions:
          type: array
          items:
            type: string
        rank_score:
          $ref: '#/components/schemas/RankScore'
        rank_reasons:
          type: array
          items:
            type: string

    RankScore:
      type: object
      properties:
        rule_code:
          type: string
        base_score:
          type: number
        root_cause_score:
          type: number
        specificity_score:
          type: number
        evidence_score:
          type: number
        chain_consistency_score:
          type: number
        symptom_penalty:
          type: number
        duplicate_penalty:
          type: number
        final_score:
          type: number

    ScoreBreakdownItem:
      type: object
      required:
        - rule_code
        - final_score
        - reason
      properties:
        rule_code:
          type: string
          example: R201
        final_score:
          type: number
          example: 149
        reason:
          type: array
          items:
            type: string

    EvidenceOverview:
      type: object
      properties:
        api:
          $ref: '#/components/schemas/ApiEvidenceOverview'
        state:
          $ref: '#/components/schemas/StateEvidenceOverview'
        selector:
          $ref: '#/components/schemas/SelectorEvidenceOverview'
        render:
          $ref: '#/components/schemas/RenderEvidenceOverview'
        dom:
          $ref: '#/components/schemas/DomEvidenceOverview'
        interaction:
          $ref: '#/components/schemas/InteractionEvidenceOverview'

    ApiEvidenceOverview:
      type: object
      properties:
        response_success:
          type: boolean
          nullable: true
        field_path:
          type: string
          nullable: true
        field_exists:
          type: boolean
          nullable: true
        field_value:
          nullable: true
          oneOf:
            - type: string
            - type: number
            - type: boolean
            - type: object

    StateEvidenceOverview:
      type: object
      properties:
        store_key:
          type: string
          nullable: true
        store_updated:
          type: boolean
          nullable: true
        store_value:
          nullable: true
          oneOf:
            - type: string
            - type: number
            - type: boolean
            - type: object

    SelectorEvidenceOverview:
      type: object
      properties:
        selector_name:
          type: string
          nullable: true
        selector_ran:
          type: boolean
          nullable: true
        selector_value:
          nullable: true
          oneOf:
            - type: string
            - type: number
            - type: boolean
            - type: object

    RenderEvidenceOverview:
      type: object
      properties:
        render_triggered:
          type: boolean
          nullable: true
        formatter_name:
          type: string
          nullable: true
        render_input_value:
          nullable: true
          oneOf:
            - type: string
            - type: number
            - type: boolean
            - type: object
        render_output_value:
          nullable: true
          oneOf:
            - type: string
            - type: number
            - type: boolean
            - type: object
        formatter_output_is_fallback:
          type: boolean
          nullable: true

    DomEvidenceOverview:
      type: object
      properties:
        dom_updated:
          type: boolean
          nullable: true
        dom_visible:
          type: boolean
          nullable: true
        displayed_value:
          nullable: true
          oneOf:
            - type: string
            - type: number
            - type: boolean

    InteractionEvidenceOverview:
      type: object
      properties:
        click_detected:
          type: boolean
          nullable: true
        handler_started:
          type: boolean
          nullable: true
        request_sent:
          type: boolean
          nullable: true
        response_success:
          type: boolean
          nullable: true

    EvidenceDetail:
      type: object
      required:
        - evidence_ref
        - evidence_type
        - title
      properties:
        evidence_ref:
          type: string
          example: ev_formatter_output_fallback
        evidence_type:
          type: string
          enum:
            - api_response
            - state_snapshot
            - selector_trace
            - render_trace
            - dom_snapshot
            - interaction_trace
            - computed_style
        title:
          type: string
          example: Formatter output fallback snapshot
        summary:
          type: string
        payload:
          type: object
          additionalProperties: true
        created_at:
          type: string
          format: date-time

    DominoChainNode:
      type: object
      required:
        - step
        - layer
        - node_type
        - label
        - status
      properties:
        step:
          type: integer
          example: 1
        layer:
          type: string
          enum:
            - api
            - state
            - selector
            - render
            - dom
            - ui
            - handler
        node_type:
          type: string
          example: formatter
        label:
          type: string
          example: formatCurrency(0) -> '--'
        status:
          type: string
          enum:
            - ok
            - broken
            - affected
            - observed
        evidence_ref:
          type: string
          nullable: true
        hit_rule_code:
          type: string
          nullable: true

    NextAction:
      type: object
      properties:
        action_type:
          type: string
          enum:
            - inspect_evidence
            - open_source
            - retry_diagnosis
        label:
          type: string
        target_ref:
          type: string
          nullable: true
```

---

# 3. 设计说明

下面把关键设计点补清楚，方便你后面继续扩。

---

## 3.1 为什么 `POST /diagnosis` 返回 202

因为诊断流程通常不是纯同步的，后面可能涉及：

- trace 聚合
- evidence 归一化
- lineage 构建
- rule engine 执行
- diagnosis ranking
- explanation 拼装

所以建议：

- `POST` 只创建任务
- `GET` 查询结果

这样更稳，也更适合后面扩展成：
- 队列
- 重试
- 超时
- 增量诊断

---

## 3.2 为什么把 `top_cause / supporting_causes / symptoms` 固化到响应里

因为工作台和报告页消费时，真正需要的不是“所有命中规则平铺列表”，而是：

- 主结论
- 补充原因
- 表现层症状

这能直接支撑你后面的：

- 根因卡片
- 辅助说明
- 多米诺链路展示

---

## 3.3 为什么单独提供 `/domino-chain`

虽然 `GET /diagnosis/{id}` 里已经可以带 `domino_chain`，  
但单独拆接口有两个好处：

1. 工作台可以按需懒加载  
2. 后面链路节点可能很多，适合独立扩展

MVP 阶段你甚至可以两个都保留：

- 结果接口里放简版 `domino_chain`
- 单独接口返回完整版

---

## 3.4 为什么单独提供 `/evidences/{evidenceRef}`

因为诊断结果里一般只放证据引用 `evidence_ref`，不放全部 payload。  
否则结果响应会很重。

把证据详情拆出去更合适，尤其适合：

- 点击某个规则后展开
- 点击某个骨牌节点看证据
- 查看 snapshot / trace / computed style

---

# 4. 可选增强接口

如果你准备再往前走一步，我建议未来加这几个，但 MVP 可以先不做：

---

## 4.1 查询诊断列表

```yaml
/api/v1/diagnosis:
  get:
    summary: List diagnosis tasks
```

适合工作台历史记录页。

---

## 4.2 取消诊断任务

```yaml
/api/v1/diagnosis/{diagnosisId}/cancel:
  post:
    summary: Cancel diagnosis task
```

适合异步任务执行时间较长时。

---

## 4.3 重试诊断

```yaml
/api/v1/diagnosis/{diagnosisId}/retry:
  post:
    summary: Retry diagnosis task
```

适合证据补齐后重跑。

---

# 5. 状态机建议

你前端工作台很可能会依赖这个状态，所以建议先定下来：

```text
queued
running
completed
failed
```

另外 `diagnosis_state` 用于表达结果语义：

```text
confirmed_root_cause
probable_root_cause
insufficient_evidence
no_rule_matched
```

这两个不要混。

- `status` = 任务执行状态
- `diagnosis_state` = 诊断语义状态

---

# 6. 返回示例建议

Swagger 里建议至少补这 3 类 example：

1. `confirmed_root_cause`
2. `insufficient_evidence`
3. `no_rule_matched`

因为这三类直接决定前端页面态。

---

# 7. 如果你要更贴近 NestJS

如果后面你想用 NestJS，我建议 DTO 可以拆成：

- `CreateDiagnosisDto`
- `DiagnosisResultDto`
- `DiagnosisFindingDto`
- `EvidenceDetailDto`
- `DominoChainNodeDto`

并且枚举单独提：

- `DiagnosisModeEnum`
- `DiagnosisStatusEnum`
- `DiagnosisStateEnum`
- `RuleCategoryEnum`
- `LayerEnum`

这样 Swagger 装饰器会更好维护。

---

# 8. 一句话总结

这版 OpenAPI 草案的核心目标是：

> 让 Diagnosis API 不只是“返回规则命中结果”，而是成为一个可直接支撑  
> **工作台、诊断报告、证据查看、因果链展示** 的统一服务接口。

---

如果你愿意，我下一步可以继续直接补：

1. **NestJS DTO + Controller 草案**
2. **Diagnosis Service TypeScript 完整代码骨架**
3. **Workbench 诊断结果卡片结构**
4. **domino_chain 前端可视化数据结构**
5. **Swagger 示例响应补全版**

如果按工程顺序，我建议下一步直接做：  
**《NestJS DTO + Controller 草案》**。