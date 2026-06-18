下面直接给你一版可放进架构文档的 **Mermaid 图**，包括：

1. 系统分层图  
2. 核心时序图  
3. 补一张可选的“诊断分析内部链路图”

你可以直接粘到 Markdown 文档里。

---

# 1. 系统分层图（Mermaid）

```mermaid
flowchart TB
  subgraph L1[浏览器探针层]
    A1[Event Collector<br/>用户行为采集]
    A2[UI State Observer<br/>UI状态采集]
    A3[Network Interceptor<br/>请求/响应采集]
    A4[Error Collector<br/>JS异常/资源错误]
    A5[Context Enricher<br/>sessionId / interactionId / route]
    A6[Batch Queue & Transport<br/>批量上报]
  end

  subgraph L2[数据接入与标准化层]
    B1[Ingestion API<br/>事件接收]
    B2[Normalizer<br/>统一事件模型转换]
    B3[Sanitizer<br/>脱敏/字段裁剪]
    B4[Correlation Service<br/>关联 requestId / traceId / interactionId]
    B5[Evidence Builder<br/>统一证据模型]
  end

  subgraph L3[存储与关系构建层]
    C1[Raw Event Store<br/>原始事件存储]
    C2[Diagnosis Store<br/>任务/结果存储]
    C3[Relation Edge Store<br/>关系边/血缘边]
    C4[Trace/Log Index<br/>链路/日志索引]
  end

  subgraph L4[图谱与诊断上下文层]
    D1[Interaction Context Builder]
    D2[Observation Graph Builder]
    D3[Dependency Graph Builder]
    D4[Diagnosis Graph Builder]
    D5[Diagnosis Context]
  end

  subgraph L5[诊断分析层]
    E1[Rule Engine<br/>规则召回]
    E2[Ranking Service<br/>排序/去重/降权]
    E3[Conclusion Service<br/>top/supporting/symptoms]
    E4[Domino Chain Builder]
    E5[Explanation Builder]
    E6[AI Adapter<br/>解释增强/总结]
  end

  subgraph L6[接口与工作台层]
    F1[Diagnosis API<br/>POST /diagnosis]
    F2[Diagnosis Query API<br/>GET /diagnosis/:id]
    F3[Diagnosis Workstation<br/>详情页/证据/因果链]
    F4[Report/Export]
  end

  A1 --> A6
  A2 --> A6
  A3 --> A6
  A4 --> A6
  A5 --> A6

  A6 --> B1
  B1 --> B2
  B2 --> B3
  B3 --> B4
  B4 --> B5

  B2 --> C1
  B4 --> C4
  B5 --> D1
  B5 --> D2
  B4 --> D3
  C1 --> D1
  C3 --> D3
  C4 --> D3

  D1 --> D5
  D2 --> D5
  D3 --> D5
  D4 --> D5

  D5 --> E1
  E1 --> E2
  E2 --> E3
  E3 --> E4
  E3 --> E5
  E4 --> E5
  E5 --> E6

  F1 --> C2
  F2 --> D1
  F2 --> E1
  E3 --> C2
  E4 --> C2
  E5 --> C2
  E6 --> C2

  C2 --> F2
  F2 --> F3
  F3 --> F4
```

---

# 2. 核心时序图：一次交互触发诊断

这个图描述的是：

- 浏览器产生交互
- 探针上报
- 用户/系统发起诊断
- 后端 lazy execute
- 返回 diagnosis result

```mermaid
sequenceDiagram
  autonumber
  participant U as User
  participant FE as Frontend App
  participant SDK as Browser Probe SDK
  participant ING as Ingestion API
  participant RAW as Raw Event Store
  participant API as Diagnosis API
  participant REPO as Diagnosis Repository
  participant CTX as Context/Evidence Builder
  participant RULE as Rule Engine
  participant RANK as Ranking Service
  participant CONC as Conclusion Service
  participant DOM as Domino Chain Builder
  participant EXP as Explanation Builder
  participant AI as AI Adapter
  participant UI as Diagnosis Workstation

  U->>FE: 点击提交 / 搜索 / 切换
  FE->>SDK: 触发 interaction event
  SDK->>SDK: 生成 interactionId / requestId
  FE->>SDK: UI state / network / error events
  SDK->>ING: 批量上报事件
  ING->>RAW: 保存原始事件

  U->>UI: 发起诊断
  UI->>API: POST /api/v1/diagnosis
  API->>REPO: 保存 diagnosis task(pending)
  REPO-->>API: diagnosisId
  API-->>UI: 202 Accepted + diagnosisId

  UI->>API: GET /api/v1/diagnosis/:id
  API->>REPO: 查询结果缓存
  alt 已有缓存结果
    REPO-->>API: diagnosis result
    API-->>UI: 200 result
  else 无缓存结果
    API->>CTX: 构建 DiagnosisContext
    CTX->>RAW: 查询 interaction 相关事件/证据
    RAW-->>CTX: evidence set
    CTX-->>API: DiagnosisContext

    API->>RULE: evaluate(context)
    RULE-->>RANK: findings
    RANK-->>CONC: ranked findings
    CONC-->>DOM: top/supporting/symptoms
    CONC-->>EXP: structured conclusion
    DOM-->>EXP: domino chain
    EXP->>AI: 可选解释增强
    AI-->>EXP: enhanced text

    EXP-->>API: diagnosis result
    API->>REPO: 保存 diagnosis result cache
    API-->>UI: 200 result
  end
```

---

# 3. 核心时序图：前端交互到上下游因果链构建

这个图更强调你产品差异化的“因果链/血缘”主线。

```mermaid
sequenceDiagram
  autonumber
  participant U as User
  participant FE as Frontend
  participant SDK as Probe SDK
  participant GW as Correlation/Normalizer
  participant EVT as Event Store
  participant TR as Trace Index
  participant REL as Relation Edge Store
  participant G as Graph Builder
  participant DX as Diagnosis Context Builder

  U->>FE: 触发业务交互
  FE->>SDK: ui_event
  FE->>SDK: ui_state(loading / error / empty)
  FE->>SDK: network request metadata
  SDK->>GW: 上报 events(batch)

  GW->>GW: 标准化 + 脱敏
  GW->>GW: 关联 interactionId / requestId / traceId
  GW->>EVT: 写入原始事件
  GW->>TR: 写入/关联 trace 索引
  GW->>REL: 写入 request->service / service->db / service->external 关系边

  DX->>EVT: 查询 interaction evidence
  DX->>TR: 查询 trace spans / errors
  DX->>REL: 查询 dependency / lineage edges

  EVT-->>DX: observation evidence
  TR-->>DX: trace evidence
  REL-->>DX: dependency edges

  DX->>G: 构建 observation/dependency subgraph
  G-->>DX: diagnosis subgraph
```

---

# 4. 诊断分析内部链路图（Mermaid）

这张图适合放在 Diagnosis 模块设计章节里。

```mermaid
flowchart LR
  A[Diagnosis Request] --> B[DiagnosisContext Builder]
  B --> C[Evidence Collector]
  C --> D[Rule Engine]

  D --> E[Raw Findings]
  E --> F[Ranking Service]
  F --> G[Ranked Findings]

  G --> H[Conclusion Service]
  H --> I1[Top Cause]
  H --> I2[Supporting Causes]
  H --> I3[Symptoms]

  I1 --> J[Domino Chain Builder]
  I2 --> J
  I3 --> J

  H --> K[Explanation Builder]
  J --> K

  K --> L[AI Adapter<br/>Optional Enhancement]
  L --> M[Diagnosis Result]
```

---

# 5. 可直接配套的图说明文案

你可以在文档里直接配下面这段简短说明。

---

## 5.1 系统分层图说明
系统从浏览器探针层采集用户交互、UI 状态、网络请求和错误事件，经数据接入与标准化层完成统一建模、脱敏与关联，再进入存储与关系构建层形成原始事件、关系边和链路索引。在此基础上，图谱与诊断上下文层围绕单次 interaction 构建 observation/dependency/diagnosis 子图，供诊断分析层完成规则召回、排序、归因总结、domino chain 生成与解释增强，最终通过 Diagnosis API 和工作台对外提供查询、展示与报告能力。

## 5.2 核心时序图说明
一次诊断流程以用户交互为起点，浏览器探针在前端侧采集交互和上下文事件并上报。诊断创建接口仅生成 diagnosis task，不同步执行完整分析；查询接口在命中缓存时直接返回结果，在未命中时基于 interaction 相关证据构建 DiagnosisContext，并按“规则召回 → 排序 → 归因总结 → 因果链生成 → 解释增强”的链路完成 lazy execute，再将结果缓存后返回。

## 5.3 诊断分析链路图说明
诊断分析链路以 DiagnosisContext 为统一输入，先由 Rule Engine 召回多个候选 finding，再由 Ranking Service 完成排序、去重和 symptom 降权，由 Conclusion Service 输出 top cause / supporting causes / symptoms，随后 Domino Chain Builder 将其组织为面向用户的因果链，Explanation Builder 生成可解释文本，AI Adapter 仅作为增强层，不直接替代规则与结论判断。

---

# 6. 一个小建议

如果你后面要把这份文档继续整理成正式方案，我建议图的顺序用：

1. **系统分层图**
2. **核心时序图：一次交互触发诊断**
3. **诊断分析内部链路图**

这个顺序最适合汇报，也最符合你现在“先讲整体，再讲主流程，再讲 Diagnosis 内核”的节奏。

如果你愿意，我下一条可以继续直接补：

**“数据模型 ER/关系设计图（Mermaid classDiagram / erDiagram 版）”**。