先给你一版 **面向 MVP / 可落地实现** 的技术架构设计文档草案，重点收口在你现在的方向：

- 前端交互观测
- 因果链 / domino chain
- 诊断分析
- 可逐步扩展的后端架构

我会按你指定的 5 个部分展开：

1. 浏览器探针
2. 数据模型
3. 图谱构建
4. AI 分析链路
5. 技术选型建议

---

# 前端交互与数据血缘诊断平台技术架构设计（MVP 版）

---

# 1. 文档目标

本文档用于定义一个 **前端交互观测 + 数据血缘追踪 + AI 诊断分析** 平台的 MVP 技术架构。  
平台目标不是单纯做日志采集，而是围绕一次“用户交互失败 / 页面异常 / 数据异常”构建可解释的诊断链路，输出：

- 发生了什么
- 卡在什么环节
- 上下游因果链是什么
- 最可能根因是什么
- 支撑证据有哪些
- 症状与根因如何区分

MVP 阶段优先支持：

- 浏览器端交互采集
- 前后端链路关联
- 数据血缘 / 影响链路构建
- 基于规则 + 轻量 AI 的诊断输出
- domino-style 因果链解释

---

# 2. 总体架构概览

平台整体分为五层：

```text
[浏览器探针层]
  └─ 采集用户行为、UI状态、网络请求、错误、性能、上下文

[数据接入与标准化层]
  └─ 事件接入、清洗、脱敏、统一模型转换、关联ID补全

[图谱与诊断上下文层]
  └─ 构建 interaction / request / service / data lineage / symptom graph

[诊断分析层]
  └─ 规则召回 → 排序 → 归因总结 → domino chain → explanation → AI增强

[工作台与开放接口层]
  └─ 诊断查询、诊断详情、证据查看、因果链展示、报告输出
```

---

# 3. 核心设计原则

## 3.1 以“单次交互”为诊断锚点
平台不是以“日志流”作为用户入口，而是以一次可定位的交互对象为入口，例如：

- 点击提交按钮后失败
- 页面一直 loading
- 列表为空但预期有数据
- 某次表单提交产生错误 toast

系统围绕该交互构建一个 `interaction` 上下文。

---

## 3.2 规则优先、AI 增强
MVP 阶段采用：

- **规则引擎负责稳定召回**
- **AI 负责总结、解释、跨证据补全语义**

不让 AI 直接替代可控诊断主链。

---

## 3.3 因果链优先于孤立告警
平台输出的核心不是“发生错误”，而是：

- 用户动作
- 前端事件
- 网络请求
- BFF/API
- DB/外部依赖
- UI 症状

之间的因果链路。

---

## 3.4 诊断结果必须可解释
每条诊断结论都需要能回溯到：

- 哪些证据命中
- 哪些规则命中
- 为什么判定为根因
- 为什么某些只是 symptom

---

# 4. 浏览器探针设计

---

# 4.1 目标

浏览器探针负责为“单次交互诊断”提供第一现场证据，至少覆盖：

- 用户做了什么
- UI 状态如何变化
- 发起了哪些请求
- 请求结果如何
- 页面报了什么错
- 哪些上下文能帮助复现和定位

---

# 4.2 采集对象

## 4.2.1 用户行为事件
采集典型用户交互：

- click
- input
- change
- submit
- route change
- modal open/close
- tab switch

建议字段：

- `eventId`
- `interactionId`
- `sessionId`
- `userId`（可匿名化）
- `pageUrl`
- `route`
- `timestamp`
- `eventType`
- `targetId`
- `targetName`
- `targetText`
- `componentName`
- `domPath`（可裁剪）
- `businessAction`（如 submitOrder / searchUser）

---

## 4.2.2 UI 状态事件
采集用户可见的状态变化：

- loading start / end
- toast shown
- modal error
- empty state rendered
- button disabled
- retry loop
- skeleton 长时间存在

建议字段：

- `stateEventId`
- `interactionId`
- `stateType`
- `targetId`
- `componentName`
- `beforeState`
- `afterState`
- `durationMs`
- `message`
- `visible`
- `severity`

---

## 4.2.3 网络请求事件
对 fetch / XHR / axios 进行封装或自动拦截，采集：

- request start
- response success/fail
- timeout
- abort
- retry

建议字段：

- `requestId`
- `interactionId`
- `traceId`
- `spanId`
- `method`
- `urlPattern`
- `statusCode`
- `durationMs`
- `requestPayloadSize`
- `responsePayloadSize`
- `errorCode`
- `retryCount`
- `apiName`
- `upstreamService`

注意：MVP 不要求保存完整 payload，优先保存**摘要**与**脱敏结构信息**。

---

## 4.2.4 JS 错误与资源错误
采集：

- uncaught error
- unhandledrejection
- console error（可选）
- resource load failure

建议字段：

- `errorId`
- `interactionId`
- `errorType`
- `message`
- `stack`
- `file`
- `line`
- `column`
- `resourceUrl`
- `componentStack`（React 可选）

---

## 4.2.5 性能与生命周期事件
采集：

- route load
- API timing
- long task
- render duration
- first meaningful state time

用于辅助解释“为什么用户感觉卡”。

---

# 4.3 关联 ID 设计

这是探针设计里最关键的部分。

至少要有：

- `sessionId`：用户会话
- `interactionId`：一次业务交互
- `requestId`：一次前端请求
- `traceId`：全链路追踪标识
- `parentEventId`：上一个关键事件
- `diagnosisId`：诊断任务 ID（后端生成）

关系上：

- 一个 `sessionId` 下有多个 `interactionId`
- 一个 `interactionId` 下有多个 `event/request/error/state`
- 一个 `requestId` 可以映射到后端 `traceId/spanId`

---

# 4.4 浏览器探针架构

```text
[SDK Core]
  ├─ Event Collector
  ├─ UI State Observer
  ├─ Network Interceptor
  ├─ Error Collector
  ├─ Context Enricher
  ├─ Batch Queue
  └─ Transport
```

---

## 4.4.1 Event Collector
负责监听 DOM 事件 / 框架埋点。

## 4.4.2 UI State Observer
负责框架层状态变化采集，建议优先接业务组件埋点，而不是只做 DOM 猜测。

## 4.4.3 Network Interceptor
封装 fetch / XHR / axios。

## 4.4.4 Context Enricher
补充：

- page
- route
- browser
- device
- app version
- tenant/project
- experiment flag

## 4.4.5 Batch Queue
按批次上报，降低对业务线程影响。

## 4.4.6 Transport
支持：

- beacon
- fetch async batch
- retry with backoff

---

# 4.5 探针 MVP 边界

MVP 阶段建议先做：

## 必做
- 用户行为
- 网络请求
- UI 症状
- JS 错误
- interactionId 贯通

## 延后
- 全量 DOM 快照
- session replay
- 自动语义识别所有组件
- 完整前端状态树快照

---

# 5. 数据模型设计

---

# 5.1 设计目标

数据模型要同时满足三类用途：

1. **原始观测存储**
2. **诊断上下文构建**
3. **因果图谱与 AI 分析**

因此建议采用：

- **事件事实表 / 明细表**
- **诊断聚合模型**
- **图谱节点与边模型**

三层分离。

---

# 5.2 核心实体

---

## 5.2.1 Session
表示用户一次会话。

```ts
type Session = {
  sessionId: string;
  userId?: string;
  anonymousId?: string;
  appId: string;
  startedAt: string;
  endedAt?: string;
  deviceInfo?: Record<string, unknown>;
  browserInfo?: Record<string, unknown>;
};
```

---

## 5.2.2 Interaction
表示一次可诊断交互，是平台主锚点。

```ts
type Interaction = {
  interactionId: string;
  sessionId: string;
  userId?: string;
  pageUrl: string;
  route?: string;
  targetId?: string;
  targetName?: string;
  businessAction?: string;
  startedAt: string;
  endedAt?: string;
  status: 'started' | 'succeeded' | 'failed' | 'unknown';
};
```

---

## 5.2.3 Evidence
统一证据模型，用于规则引擎与 AI 链路。

```ts
type Evidence = {
  id: string;
  interactionId: string;
  type:
    | 'ui_event'
    | 'ui_state'
    | 'network_error'
    | 'trace_span'
    | 'log'
    | 'metric'
    | 'exception'
    | 'lineage';
  timestamp: string;
  label: string;
  source: string;
  value: Record<string, unknown>;
  severity?: 'info' | 'warning' | 'error';
  relatedIds?: string[];
};
```

---

## 5.2.4 DiagnosisTask
诊断任务模型。

```ts
type DiagnosisTask = {
  id: string;
  interactionId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
};
```

---

## 5.2.5 DiagnosisResult
诊断结果聚合模型。

```ts
type DiagnosisResult = {
  diagnosisId: string;
  interactionId: string;
  summary: string;
  topCause?: DiagnosisFinding;
  supportingCauses: DiagnosisFinding[];
  symptoms: DiagnosisFinding[];
  dominoChain: DominoNode[];
  explanation: {
    shortText: string;
    detailText: string;
  };
  generatedAt: string;
};
```

---

## 5.2.6 DiagnosisFinding
规则 / AI 归因结果。

```ts
type DiagnosisFinding = {
  ruleCode: string;
  title: string;
  layer:
    | 'user_action'
    | 'frontend_app'
    | 'api'
    | 'bff'
    | 'db'
    | 'external'
    | 'ui_state';
  cluster: string;
  confidence: number;
  isSymptomOnly: boolean;
  evidenceIds: string[];
  detail?: Record<string, unknown>;
};
```

---

# 5.3 存储分层建议

建议拆为三类存储：

## 5.3.1 原始事件存储
存放：

- 交互事件
- UI 状态事件
- 网络事件
- 错误事件

特点：
- 写多读少
- 可做明细检索
- 支撑回放和上下文抽取

---

## 5.3.2 诊断结果存储
存放：

- diagnosis task
- diagnosis result
- finding
- explanation
- domino chain

特点：
- 读多
- 支撑工作台详情页

---

## 5.3.3 图谱/关系存储
存放：

- interaction → request
- request → trace
- trace → service
- service → db
- service → external
- data lineage edges

MVP 阶段不一定需要上图数据库，可以先用关系表/文档化边表实现。

---

# 6. 图谱构建设计

---

# 6.1 目标

图谱构建的目标不是为了“炫技上图数据库”，而是为了把一次交互涉及的：

- 用户动作
- 前端状态
- 请求调用
- 服务依赖
- 数据加工/血缘
- 外部依赖
- 症状输出

串成一个可计算、可解释的因果关系网络。

---

# 6.2 图谱对象

---

## 6.2.1 节点类型

建议最小节点类型：

- `interaction`
- `ui_event`
- `ui_state`
- `request`
- `service`
- `api`
- `db_query`
- `db_table`
- `external_call`
- `exception`
- `metric`
- `dataset`
- `field`
- `diagnosis_finding`

---

## 6.2.2 边类型

建议最小边类型：

- `triggered`
- `caused`
- `calls`
- `depends_on`
- `reads_from`
- `writes_to`
- `derived_from`
- `impacts`
- `supports`
- `explains`

---

# 6.3 图谱构建流程

```text
原始事件流
  → 统一证据模型
  → 关联 interaction/request/trace
  → 构造基础调用链
  → 补充数据血缘边
  → 生成诊断上下文子图
  → 提供给规则/AI分析
```

---

# 6.4 三层图谱模型

建议分三层：

## 6.4.1 观测图（Observation Graph）
由探针和链路追踪直接产出：

- 点击了什么
- 发起了什么请求
- 请求失败了吗
- 页面显示了什么症状

这是最原始、最可靠的一层。

---

## 6.4.2 依赖图（Dependency Graph）
由服务拓扑和数据调用关系构建：

- API 调了哪个 BFF
- BFF 调了哪个服务
- 服务查了哪个 DB / 外部依赖

---

## 6.4.3 诊断图（Diagnosis Graph）
由规则引擎与诊断逻辑在前两层之上构建：

- 哪个节点是 root cause 候选
- 哪些节点只是 symptom
- 哪些边构成 domino chain

---

# 6.5 数据血缘在 MVP 中的落点

如果你当前强调“数据血缘 tracing”，MVP 建议只做到：

## 先支持对象级 / 查询级血缘
例如：

- 这个页面列表依赖哪个 API
- 这个 API 依赖哪个 service
- 这个 service 依赖哪个表/缓存/外部系统
- 这条字段来自哪个查询结果或转换步骤

而不是一上来追求全量字段级 lineage 自动解析。

---

# 6.6 Domino Chain 生成逻辑

Domino Chain 是诊断图的呈现层对象，不完全等同原始图谱。

建议生成规则：

- 选取 top cause 作为链首核心节点
- 选取 supporting causes 构建上游/旁路支撑节点
- 选取 symptom 作为用户可见结果节点
- 同一 cluster/同一节点可聚合多个 finding
- 保留 evidence 引用能力

输出上更像：

```text
用户点击提交
  → 前端发起订单请求
  → API 超时
  → DB 查询超时
  → 页面持续 loading
```

而不是直接把底层图数据库节点原样吐给用户。

---

# 7. AI 分析链路设计

---

# 7.1 目标

AI 的作用不是替代规则引擎，而是增强三个能力：

1. **总结**：把多个 finding 转成用户可读说明
2. **解释**：说明根因、支撑原因、症状之间关系
3. **补全**：在证据碎片较多时做语义关联和优先级辅助

---

# 7.2 推荐分析链路

MVP 采用 **规则优先 + AI 后处理增强**：

```text
诊断请求
  → 构建 DiagnosisContext
  → 收集 Evidence
  → Rule Engine 召回多条 finding
  → Ranking 排序与去重
  → Conclusion 生成 top/supporting/symptoms
  → DominoChainBuilder 生成因果链
  → ExplanationBuilder 生成结构化解释
  → LLM 对 explanation 做自然语言增强（可选）
```

---

# 7.3 分阶段 AI 职责

---

## 7.3.1 P0：无 AI 或弱 AI
只做：

- 模板化 explanation
- 固定结论文案
- 规则驱动 root cause 输出

优点：
- 稳定
- 成本低
- 可控

---

## 7.3.2 P1：轻量 AI 总结
输入：

- DiagnosisConclusion
- DominoChain
- Evidence 摘要

输出：

- 面向用户的自然语言总结
- 更自然的“原因 - 影响 - 建议”表述

注意：AI 不改 root cause 排序结果，只做文字增强。

---

## 7.3.3 P2：AI 辅助证据聚类与候选补全
AI 可以辅助：

- 相似错误归类
- 弱结构日志归一化
- 跨证据摘要
- 历史案例检索解释

但仍不建议让 AI 直接独立决定最终根因。

---

# 7.4 DiagnosisContext 结构建议

AI/规则共享同一个标准上下文：

```ts
type DiagnosisContext = {
  interactionId: string;
  sessionId?: string;
  targetId?: string;
  symptoms: string[];
  evidence: Evidence[];
  lineage?: LineageEdge[];
  metadata?: Record<string, unknown>;
};
```

这样保证：

- 规则能消费
- AI 也能消费
- ExplanationBuilder 也能复用

---

# 7.5 AI 输入治理

AI 输入要控制，不要把所有原始日志直接塞进去。

建议输入给 LLM 的内容应是：

- 高价值 evidence 摘要
- 已排序 finding
- domino chain
- 少量必要上下文

不直接输入：

- 海量原始日志全文
- 敏感 payload
- 无脱敏 headers/token

---

# 7.6 AI 输出约束

AI 输出应受结构约束，例如：

```json
{
  "summary": "...",
  "rootCauseExplanation": "...",
  "symptomExplanation": "...",
  "nextActions": ["..."]
}
```

不能直接让模型自由输出一大段不可控文字并替代系统诊断结果。

---

# 8. 技术选型建议

---

# 8.1 总体原则

MVP 阶段技术选型以：

- **可快速落地**
- **可解释**
- **方便渐进扩展**
- **与现有 NestJS 体系兼容**

为优先。

---

# 8.2 浏览器探针

## 推荐
- TypeScript SDK
- fetch/XHR 拦截
- 框架适配层（React/Vue 可选）
- Beacon + batch upload

## 建议
- SDK core 自研
- 不建议一开始重度依赖完整 replay 平台

## 原因
你当前差异化不在“回放”，而在“因果诊断”。

---

# 8.3 后端服务

## 推荐
- **NestJS** 作为核心后端框架

## 原因
- 你当前已有 Diagnosis 模块实现基础
- 分层清晰，适合：
  - controller
  - application service
  - rule engine
  - builder
  - repository
- 对 DTO / ValidationPipe / Swagger 友好

---

# 8.4 数据存储

MVP 推荐分层：

## 关系型数据库
推荐：
- PostgreSQL 或 MySQL

用途：
- diagnosis task/result
- metadata
- rule hit / finding
- 配置类数据

如果你当前环境偏 MySQL，就先继续 MySQL。

---

## 日志/事件明细存储
MVP 可选两种路径：

### 路径 A：先入关系库简化
适合早期数据量不大时。

### 路径 B：事件进 OLAP / 日志系统
后续可升级到：
- ClickHouse
- Elasticsearch

如果你的事件量未来会上来，我更偏向 **ClickHouse** 做事件明细分析。

---

## 图谱/关系存储
MVP 不建议一开始就上 Neo4j 作为核心依赖。  
先用：

- 关系表
- adjacency list
- edge table
- JSON graph snapshot

足够支撑诊断链路。

等图查询复杂度真的上来，再考虑图数据库。

---

# 8.5 链路追踪

推荐：

- OpenTelemetry 兼容 traceId
- 前端 request header 透传 trace context
- 后端服务接入 trace/span

即使 MVP 不做全套 OTel 平台，也建议先把 `traceId` 机制定下来。

---

# 8.6 规则引擎

推荐：

- 自研轻量规则引擎
- rule file + registry + interface
- RuleEngineService 统一调度

原因：
- 你的规则更像“诊断命中规则”，不是通用复杂规则平台
- 自研更可控，和 ranking/conclusion/explanation 更好耦合

---

# 8.7 AI 能力层

MVP 推荐：

- LLM 只做总结和解释增强
- 后端通过统一 AI adapter 调用模型
- 保留 provider 可替换能力

可抽象为：

```ts
interface DiagnosisAiAdapter {
  summarize(input: DiagnosisAiInput): Promise<DiagnosisAiOutput>;
}
```

避免 AI 调用散落在业务层。

---

# 8.8 前端工作台

推荐：

- 诊断详情页
- domino chain 视图
- evidence drill-down
- root/supporting/symptoms 分区展示

工作台层不要一开始做太重的通用图谱编辑器。  
先做**诊断消费界面**，不是图数据库操作台。

---

# 9. MVP 落地建议

---

# 9.1 P0（先跑通）
范围：

- 浏览器探针最小采集
- Diagnosis 后端服务
- 统一 Evidence 模型
- Rule Engine + Ranking + Conclusion
- Domino Chain 输出
- 基础诊断详情页

---

# 9.2 P1（增强解释）
范围：

- 数据血缘边增强
- 解释文本增强
- 历史相似问题聚类
- AI 总结增强

---

# 9.3 P2（扩展平台能力）
范围：

- 多项目/多应用接入
- 规则平台化管理
- 图谱高级查询
- 案例沉淀与建议闭环
- 报告输出与复盘能力

---

# 10. 最终建议结论

对你当前阶段，最重要的技术路线建议是：

## 10.1 浏览器探针
先做 **交互 + UI状态 + 请求 + 错误** 四类采集，核心是 `interactionId` 贯通。

## 10.2 数据模型
以 **Interaction / Evidence / DiagnosisTask / DiagnosisResult** 为核心主模型，避免一开始过度复杂化。

## 10.3 图谱构建
先做 **可计算的关系边模型**，不急着上重图数据库；domino chain 是用户态核心呈现。

## 10.4 AI 分析链路
坚持 **规则召回优先，AI 只做增强解释**，不要让 AI 直接主导根因裁决。

## 10.5 技术选型
后端继续 **NestJS**，存储优先 **MySQL/PostgreSQL + 可扩展事件存储**，图谱先关系化实现，AI 用适配层接入。

---

如果你愿意，我下一条可以继续直接输出：

**这份技术架构文档的“系统分层图 + 核心时序图（Mermaid版）”**，方便你直接放进方案文档。