下面我直接给你一版 **MVP 接口时序调用图**。  
重点不是单个 API 定义，而是：

> **在真实使用场景里，这些 API 按什么顺序被调用、由谁调用、返回什么、如何串成闭环。**

我分成 5 类时序图：

1. 页面值异常：反向溯源链路  
2. 点击后没反应：正向主链路  
3. 诊断报告生成链路  
4. AI 解释链路  
5. 前端 SDK 事件上报链路

---

# 1. 页面值异常：反向溯源接口时序图

这个是你 MVP 最核心的一条链路。

## 目标
用户在页面上点一个异常值，比如 `--`，系统最后输出：
- 值从哪里来
- 哪一层出问题
- 修复建议

---

```text
参与者:
User
Browser Plugin / Inspect Panel
Backend API Gateway
Inspect Service
Lineage Service
Trace Service
Metadata Service
Diagnosis Service
Copilot Service

┌──────┐
│ User │
└──┬───┘
   │ 1. 在页面上选择异常值/区域
   ▼
┌────────────────────────────┐
│ Browser Plugin / Inspect UI│
└───────────┬────────────────┘
            │ 2. POST /api/v1/inspect/target
            │    上报 DOM/组件/文本信息
            ▼
┌────────────────────────────┐
│     Backend API Gateway    │
└───────────┬────────────────┘
            ▼
┌────────────────────────────┐
│      Inspect Service       │
└───────────┬────────────────┘
            │ 3. 创建 inspect_target_id
            │ 4. 返回 inspect target
            ▼
┌────────────────────────────┐
│ Browser Plugin / Inspect UI│
└───────────┬────────────────┘
            │ 5. POST /api/v1/lineage/reverse
            │    参数: inspect_target_id
            ▼
┌────────────────────────────┐
│     Backend API Gateway    │
└───────────┬────────────────┘
            ▼
┌────────────────────────────┐
│      Lineage Service       │
└───────────┬────────────────┘
            │ 6. 调 Trace Service 获取最近运行时证据
            │    GET trace by component/session/interaction
            ▼
┌────────────────────────────┐
│       Trace Service        │
└───────────┬────────────────┘
            │ 7. 返回 request/state/render/dom 证据
            ▼
┌────────────────────────────┐
│      Lineage Service       │
└───────────┬────────────────┘
            │ 8. 调 Metadata Service 获取组件元数据
            ▼
┌────────────────────────────┐
│     Metadata Service       │
└───────────┬────────────────┘
            │ 9. 返回组件绑定关系
            │    component -> store/api/render_expr
            ▼
┌────────────────────────────┐
│      Lineage Service       │
└───────────┬────────────────┘
            │ 10. 构建 reverse lineage
            │ 11. 返回 lineage_id + lineage steps
            ▼
┌────────────────────────────┐
│ Browser Plugin / Inspect UI│
└───────────┬────────────────┘
            │ 12. POST /api/v1/diagnosis/run
            │     参数: lineage_id
            ▼
┌────────────────────────────┐
│     Backend API Gateway    │
└───────────┬────────────────┘
            ▼
┌────────────────────────────┐
│    Diagnosis Service       │
└───────────┬────────────────┘
            │ 13. 基于 lineage + evidence 执行规则诊断
            │ 14. 返回 report_id + diagnosis result
            ▼
┌────────────────────────────┐
│ Browser Plugin / Inspect UI│
└───────────┬────────────────┘
            │ 15. POST /api/v1/copilot/explain
            │     参数: report_id
            ▼
┌────────────────────────────┐
│      Copilot Service       │
└───────────┬────────────────┘
            │ 16. 返回自然语言解释
            ▼
┌────────────────────────────┐
│ Browser Plugin / Inspect UI│
└───────────┬────────────────┘
            │ 17. 展示
            │    - 反向血缘路径
            │    - 根因排序
            │    - AI解释
            ▼
┌──────┐
│ User │
└──────┘
```

---

## 这条链路的最小 API 顺序

```text
POST /inspect/target
POST /lineage/reverse
POST /diagnosis/run
POST /copilot/explain
```

这是你 MVP 最值得先打通的一条“黄金路径”。

---

# 2. 点击后没反应：正向主链路接口时序图

## 目标
用户点了一个按钮，想知道：
- 事件触发了吗
- 请求发了吗
- store 更新了吗
- 组件刷新了吗
- DOM 变了吗

---

```text
参与者:
User
Business Page + SDK
Backend API Gateway
Event Ingestion Service
Trace Service
Lineage Service
Diagnosis Service
Copilot Service
Workbench UI

┌──────┐
│ User │
└──┬───┘
   │ 1. 点击按钮
   ▼
┌────────────────────────────┐
│    Business Page + SDK     │
└───────────┬────────────────┘
            │ 2. POST /api/v1/events/batch-ingest
            │    上报 click/request/state/render/dom 等事件
            ▼
┌────────────────────────────┐
│     Backend API Gateway    │
└───────────┬────────────────┘
            ▼
┌────────────────────────────┐
│  Event Ingestion Service   │
└───────────┬────────────────┘
            │ 3. 写入 runtime events / trace nodes
            ▼

            ... 用户打开工作台查看这次点击 ...

┌────────────────────────────┐
│        Workbench UI        │
└───────────┬────────────────┘
            │ 4. GET /api/v1/interactions/{interaction_id}/timeline
            ▼
┌────────────────────────────┐
│     Backend API Gateway    │
└───────────┬────────────────┘
            ▼
┌────────────────────────────┐
│       Trace Service        │
└───────────┬────────────────┘
            │ 5. 返回 interaction timeline
            ▼
┌────────────────────────────┐
│        Workbench UI        │
└───────────┬────────────────┘
            │ 6. GET /api/v1/traces/by-interaction/{interaction_id}
            ▼
┌────────────────────────────┐
│       Trace Service        │
└───────────┬────────────────┘
            │ 7. 返回 nodes + edges
            ▼
┌────────────────────────────┐
│        Workbench UI        │
└───────────┬────────────────┘
            │ 8. POST /api/v1/lineage/forward
            │    参数: interaction_id
            ▼
┌────────────────────────────┐
│      Lineage Service       │
└───────────┬────────────────┘
            │ 9. 构建主链路
            │    click -> request -> state -> render -> dom
            ▼
┌────────────────────────────┐
│        Workbench UI        │
└───────────┬────────────────┘
            │ 10. POST /api/v1/diagnosis/run
            │     参数: interaction_id
            ▼
┌────────────────────────────┐
│    Diagnosis Service       │
└───────────┬────────────────┘
            │ 11. 输出链路中断点/异常点
            ▼
┌────────────────────────────┐
│        Workbench UI        │
└───────────┬────────────────┘
            │ 12. POST /api/v1/copilot/explain
            ▼
┌────────────────────────────┐
│      Copilot Service       │
└───────────┬────────────────┘
            │ 13. 返回人话解释
            ▼
┌────────────────────────────┐
│        Workbench UI        │
└───────────┬────────────────┘
            │ 14. 展示主链路/中断点/解释
            ▼
┌──────┐
│ User │
└──────┘
```

---

## 最小 API 顺序

```text
POST /events/batch-ingest
GET  /interactions/{interaction_id}/timeline
GET  /traces/by-interaction/{interaction_id}
POST /lineage/forward
POST /diagnosis/run
POST /copilot/explain
```

---

# 3. 诊断报告生成链路时序图

这个图更聚焦后端内部服务如何协同。

## 目标
把：
- trace
- lineage
- evidence
- 规则命中

整理成一个诊断报告。

---

```text
参与者:
Workbench UI
API Gateway
Diagnosis Service
Trace Service
Lineage Service
Rule Engine
Report Store

┌────────────────┐
│  Workbench UI  │
└──────┬─────────┘
       │ 1. POST /api/v1/diagnosis/run
       │    参数: interaction_id 或 lineage_id
       ▼
┌────────────────┐
│  API Gateway   │
└──────┬─────────┘
       ▼
┌────────────────┐
│DiagnosisService│
└──────┬─────────┘
       │ 2. 拉取 trace 证据
       ▼
┌────────────────┐
│ Trace Service  │
└──────┬─────────┘
       │ 3. 返回 timeline/nodes/evidence
       ▼
┌────────────────┐
│DiagnosisService│
└──────┬─────────┘
       │ 4. 拉取 lineage 结果
       ▼
┌────────────────┐
│Lineage Service │
└──────┬─────────┘
       │ 5. 返回 lineage steps / runtime evidence
       ▼
┌────────────────┐
│DiagnosisService│
└──────┬─────────┘
       │ 6. 调 Rule Engine
       ▼
┌────────────────┐
│  Rule Engine   │
└──────┬─────────┘
       │ 7. 返回 rule findings
       ▼
┌────────────────┐
│DiagnosisService│
└──────┬─────────┘
       │ 8. 汇总 root cause ranking
       │ 9. 存 report
       ▼
┌────────────────┐
│  Report Store  │
└──────┬─────────┘
       │ 10. 返回 report_id
       ▼
┌────────────────┐
│  Workbench UI  │
└────────────────┘
```

---

## 这个调用链的服务边界很重要

### Diagnosis Service 负责编排
它不应该自己做：
- trace 构建
- lineage 构建
- 规则实现细节

它只负责：
- 拉数据
- 调规则
- 聚合报告

这样后面才好扩展。

---

# 4. AI 解释链路时序图

## 目标
把结构化诊断结果变成自然语言。

---

```text
参与者:
Workbench UI
API Gateway
Copilot Service
Diagnosis Service
Prompt Builder
LLM
Response Formatter

┌────────────────┐
│  Workbench UI  │
└──────┬─────────┘
       │ 1. POST /api/v1/copilot/explain
       │    参数: report_id, style=developer
       ▼
┌────────────────┐
│  API Gateway   │
└──────┬─────────┘
       ▼
┌────────────────┐
│Copilot Service │
└──────┬─────────┘
       │ 2. 拉取 report
       ▼
┌────────────────┐
│DiagnosisService│
└──────┬─────────┘
       │ 3. 返回结构化诊断结果
       ▼
┌────────────────┐
│Copilot Service │
└──────┬─────────┘
       │ 4. Prompt Builder 组织上下文
       ▼
┌────────────────┐
│ Prompt Builder │
└──────┬─────────┘
       │ 5. 生成 prompt
       ▼
┌────────────────┐
│      LLM       │
└──────┬─────────┘
       │ 6. 返回 explanation
       ▼
┌────────────────┐
│ResponseFormattr│
└──────┬─────────┘
       │ 7. 格式化输出
       ▼
┌────────────────┐
│  Workbench UI  │
└────────────────┘
```

---

## 这里建议的关键点
AI 不直接查原始事件流，而是只吃：
- diagnosis report
- rule findings
- evidence summary
- lineage summary

这样稳定很多。

---

# 5. 前端 SDK 事件上报时序图

这个图是平台运行时底座。

## 目标
用户在业务页面操作时，SDK 如何采集并上报事件。

---

```text
参与者:
User
Business Page
SDK Runtime Hooks
Batch Buffer
API Gateway
Event Ingestion Service
Runtime DB

┌──────┐
│ User │
└──┬───┘
   │ 1. 点击/输入/切换路由
   ▼
┌────────────────┐
│ Business Page  │
└──────┬─────────┘
       │ 2. 触发 handler/request/render/dom update
       ▼
┌────────────────┐
│SDK RuntimeHooks│
└──────┬─────────┘
       │ 3. 采集 event
       │ 4. 绑定 session_id / interaction_id
       ▼
┌────────────────┐
│  Batch Buffer  │
└──────┬─────────┘
       │ 5. 满批/超时/页面切换时 flush
       ▼
┌────────────────┐
│  API Gateway   │
└──────┬─────────┘
       │ 6. POST /api/v1/events/batch-ingest
       ▼
┌────────────────┐
│ Event Ingest   │
└──────┬─────────┘
       │ 7. 写 trace_node / snapshot / evidence
       ▼
┌────────────────┐
│   Runtime DB   │
└────────────────┘
```

---

# 6. 两条最关键“黄金链路”

如果你要跟团队强调重点，我建议就反复讲这两条。

---

## 黄金链路 A：值异常诊断
```text
选点
→ POST /inspect/target
→ POST /lineage/reverse
→ POST /diagnosis/run
→ POST /copilot/explain
→ 展示诊断结果
```

---

## 黄金链路 B：点击行为解释
```text
点击时 SDK 自动上报 events
→ GET /interactions/{id}/timeline
→ GET /traces/by-interaction/{id}
→ POST /lineage/forward
→ POST /diagnosis/run
→ POST /copilot/explain
→ 展示链路与结论
```

---

# 7. 合并版总时序图

如果你要一张更“汇报型”的总图，可以用这版：

```text
用户在页面上发现问题
      │
      ├── 场景1：某个值显示异常
      │      │
      │      ├─ inspect/target
      │      ├─ lineage/reverse
      │      ├─ diagnosis/run
      │      └─ copilot/explain
      │
      └── 场景2：点击后没反应
             │
             ├─ SDK events/batch-ingest
             ├─ interactions/{id}/timeline
             ├─ traces/by-interaction/{id}
             ├─ lineage/forward
             ├─ diagnosis/run
             └─ copilot/explain
```

---

# 8. 一个工程落地建议

实际开发时，建议按下面顺序实现，不要并行全做：

### 第 1 批
- `POST /events/batch-ingest`
- `POST /inspect/target`

### 第 2 批
- `GET /interactions/{interaction_id}/timeline`
- `GET /traces/by-interaction/{interaction_id}`

### 第 3 批
- `POST /lineage/reverse`
- `POST /lineage/forward`

### 第 4 批
- `POST /diagnosis/run`

### 第 5 批
- `POST /copilot/explain`

这个顺序最稳。

---

# 9. 一句话总结

这套接口时序调用图，本质上把产品拆成两条闭环：

- **反向闭环**：从页面异常值出发，追到源头
- **正向闭环**：从一次点击出发，追到结果

而 API 设计就是为这两条闭环服务的。

---

如果你愿意，我下一步可以继续直接补其中一个：

1. **数据库表结构 SQL 初稿**
2. **工作台页面信息架构图**
3. **3个月研发排期表**
4. **OpenAPI/Swagger 草案**
5. **Rule Engine 规则清单 v0.1**

如果按产品推进顺序，我建议下一步直接做：  
**《工作台页面信息架构图》**。