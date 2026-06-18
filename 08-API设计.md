下面我直接给你一版 **MVP API 设计清单**。  
目标是配合前面那套 MVP 模块和数据模型，先把最小闭环打通。

我会按这几个部分来给：

1. API 总览  
2. 前端采集类 API  
3. Trace 查询类 API  
4. Lineage/诊断类 API  
5. 工作台展示类 API  
6. AI Copilot API  
7. 返回结构规范  
8. MVP 阶段建议先做的最小集合

---

# 1. API 总览

MVP 阶段建议按 5 组 API 来拆：

```text
A. Ingestion API
   - 接 runtime events
   - 接 inspect target
   - 接诊断任务请求

B. Trace API
   - 查 interaction
   - 查 timeline
   - 查 trace nodes

C. Lineage API
   - 反向溯源页面值
   - 正向构建点击主链路

D. Diagnosis API
   - 跑规则诊断
   - 生成诊断报告

E. Copilot API
   - 自然语言解释
   - 问答
```

---

# 2. API 路由草图

```text
/api/v1
  /events
    POST   /ingest
    POST   /batch-ingest

  /inspect
    POST   /target
    GET    /target/{inspect_target_id}

  /interactions
    POST   /
    GET    /{interaction_id}
    GET    /
    GET    /{interaction_id}/timeline

  /traces
    GET    /by-interaction/{interaction_id}
    GET    /by-component
    GET    /by-session/{session_id}

  /lineage
    POST   /reverse
    POST   /forward
    GET    /{lineage_id}

  /diagnosis
    POST   /run
    GET    /reports/{report_id}
    GET    /reports

  /copilot
    POST   /explain
    POST   /ask

  /metadata
    GET    /components/{component_name}
    POST   /components/register
```

---

# 3. Ingestion API

这组 API 主要给浏览器插件 / SDK 用。

---

## 3.1 POST /api/v1/events/ingest

### 用途
上报单条 runtime event。

### 请求体
```json
{
  "app_id": "trace-lens-demo",
  "env": "dev",
  "session_id": "sess_001",
  "interaction_id": "itx_001",
  "event_type": "network_response",
  "timestamp": 1718162812,
  "component_name": "OrderAmount",
  "layer": "network",
  "node_name": "GET /api/order/detail",
  "target_dom_selector": ".order-amount",
  "summary": "response received",
  "payload": {
    "status": 200,
    "latency_ms": 132
  }
}
```

### 返回
```json
{
  "success": true,
  "event_id": "evt_001",
  "node_id": "node_001"
}
```

---

## 3.2 POST /api/v1/events/batch-ingest

### 用途
批量上报，减少网络开销。  
MVP 实际上更建议先主推这个。

### 请求体
```json
{
  "app_id": "trace-lens-demo",
  "env": "dev",
  "session_id": "sess_001",
  "events": [
    {
      "interaction_id": "itx_001",
      "event_type": "click_event",
      "timestamp": 1718162810,
      "component_name": "SubmitButton",
      "layer": "ui",
      "node_name": "button click"
    },
    {
      "interaction_id": "itx_001",
      "event_type": "network_request",
      "timestamp": 1718162811,
      "component_name": "OrderPage",
      "layer": "network",
      "node_name": "POST /api/order/submit"
    }
  ]
}
```

### 返回
```json
{
  "success": true,
  "accepted": 2,
  "failed": 0,
  "event_ids": ["evt_001", "evt_002"]
}
```

---

## 3.3 POST /api/v1/inspect/target

### 用途
当用户在页面上点选一个值/区域时，上报 inspect 目标，创建 inspect target 记录。

### 请求体
```json
{
  "app_id": "trace-lens-demo",
  "env": "dev",
  "session_id": "sess_001",
  "page_url": "/order/detail?id=123",
  "target_dom_selector": ".order-amount",
  "target_dom_text": "--",
  "visibility": "visible",
  "component_name": "OrderAmount",
  "component_path": "src/pages/order/detail/OrderAmount.tsx",
  "bounding_box": {
    "x": 112,
    "y": 204,
    "width": 88,
    "height": 24
  },
  "captured_at": 1718162815
}
```

### 返回
```json
{
  "success": true,
  "inspect_target_id": "insp_001"
}
```

---

## 3.4 GET /api/v1/inspect/target/{inspect_target_id}

### 用途
查询 inspect target 详情。

### 返回
```json
{
  "inspect_target_id": "insp_001",
  "session_id": "sess_001",
  "page_url": "/order/detail?id=123",
  "target_dom_selector": ".order-amount",
  "target_dom_text": "--",
  "component_name": "OrderAmount",
  "visibility": "visible",
  "created_at": "2026-06-12T03:40:00Z"
}
```

---

# 4. Interaction / Trace API

这组 API 主要给工作台前端查交互链路。

---

## 4.1 POST /api/v1/interactions

### 用途
显式创建 interaction。  
可选，如果前端 SDK 已经自动生成 interaction_id，这个接口可以弱化。

### 请求体
```json
{
  "session_id": "sess_001",
  "interaction_type": "click",
  "target_dom_selector": ".submit-btn",
  "target_dom_text": "提交",
  "target_component": "SubmitButton",
  "started_at": 1718162810
}
```

### 返回
```json
{
  "success": true,
  "interaction_id": "itx_001"
}
```

---

## 4.2 GET /api/v1/interactions/{interaction_id}

### 用途
获取 interaction 基础信息。

### 返回
```json
{
  "interaction_id": "itx_001",
  "session_id": "sess_001",
  "interaction_type": "click",
  "target_dom_selector": ".submit-btn",
  "target_component": "SubmitButton",
  "started_at": "2026-06-12T03:40:10Z",
  "ended_at": "2026-06-12T03:40:12Z",
  "status": "success"
}
```

---

## 4.3 GET /api/v1/interactions

### 用途
按条件查询 interaction 列表。

### 查询参数
- `session_id`
- `interaction_type`
- `component_name`
- `page_url`
- `start_time`
- `end_time`
- `page`
- `page_size`

### 示例
```http
GET /api/v1/interactions?session_id=sess_001&interaction_type=click&page=1&page_size=20
```

---

## 4.4 GET /api/v1/interactions/{interaction_id}/timeline

### 用途
获取某次 interaction 的时间线。

### 返回
```json
{
  "interaction_id": "itx_001",
  "timeline": [
    {
      "node_id": "n1",
      "timestamp": 1718162810,
      "node_type": "event",
      "node_name": "click submit",
      "layer": "ui",
      "status": "success"
    },
    {
      "node_id": "n2",
      "timestamp": 1718162811,
      "node_type": "network_request",
      "node_name": "POST /api/order/submit",
      "layer": "network",
      "status": "success"
    },
    {
      "node_id": "n3",
      "timestamp": 1718162812,
      "node_type": "network_response",
      "node_name": "POST /api/order/submit",
      "layer": "network",
      "status": "success"
    }
  ]
}
```

---

## 4.5 GET /api/v1/traces/by-interaction/{interaction_id}

### 用途
获取 interaction 下完整 trace，包括 nodes + edges。

### 返回
```json
{
  "interaction_id": "itx_001",
  "nodes": [
    {
      "node_id": "n1",
      "node_type": "event",
      "node_name": "click submit"
    },
    {
      "node_id": "n2",
      "node_type": "network_request",
      "node_name": "POST /api/order/submit"
    }
  ],
  "edges": [
    {
      "from_node_id": "n1",
      "to_node_id": "n2",
      "relation": "triggers",
      "confidence": 0.96
    }
  ]
}
```

---

## 4.6 GET /api/v1/traces/by-component

### 用途
查询某个组件最近相关的 trace 节点。

### 查询参数
- `component_name`
- `session_id`
- `start_time`
- `end_time`

### 示例
```http
GET /api/v1/traces/by-component?component_name=OrderAmount&session_id=sess_001
```

---

## 4.7 GET /api/v1/traces/by-session/{session_id}

### 用途
查询整个页面 session 下的 trace 概览。

### 返回
- interaction 列表
- 各 interaction 的简要统计

---

# 5. Lineage API

这是 MVP 的核心 API 之一。

---

## 5.1 POST /api/v1/lineage/reverse

### 用途
对页面值/区域做反向溯源。

### 请求体
```json
{
  "inspect_target_id": "insp_001",
  "session_id": "sess_001",
  "interaction_id": "itx_inspect_001",
  "target_component": "OrderAmount",
  "displayed_value": "--",
  "page_url": "/order/detail?id=123"
}
```

### 返回
```json
{
  "lineage_id": "lin_001",
  "status": "resolved",
  "displayed_value": "--",
  "target_component": "OrderAmount",
  "lineage_steps": [
    {
      "step_order": 1,
      "layer": "dom",
      "source_type": "dom_text",
      "source_key": ".order-amount",
      "value_summary": "--"
    },
    {
      "step_order": 2,
      "layer": "render",
      "source_type": "render_expr",
      "source_key": "formatCurrency(amount)",
      "value_summary": "--"
    },
    {
      "step_order": 3,
      "layer": "state",
      "source_type": "store_key",
      "source_key": "order.current.amount_cent",
      "value_summary": "0"
    },
    {
      "step_order": 4,
      "layer": "api",
      "source_type": "api_field",
      "source_key": "GET /api/order/detail response.data.amount_cent",
      "value_summary": "0"
    }
  ],
  "evidence": [
    {
      "type": "api_field",
      "key": "response.data.amount_cent",
      "value_summary": "0"
    },
    {
      "type": "formatter_output",
      "key": "formatCurrency",
      "value_summary": "--"
    }
  ]
}
```

---

## 5.2 POST /api/v1/lineage/forward

### 用途
对一次点击交互构建正向主链路。  
MVP 先只支持主链，不做复杂分叉。

### 请求体
```json
{
  "interaction_id": "itx_001",
  "session_id": "sess_001"
}
```

### 返回
```json
{
  "lineage_id": "lin_forward_001",
  "direction": "forward",
  "steps": [
    {
      "step_order": 1,
      "layer": "ui",
      "source_type": "event",
      "source_key": "click .submit-btn"
    },
    {
      "step_order": 2,
      "layer": "network",
      "source_type": "request",
      "source_key": "POST /api/order/submit"
    },
    {
      "step_order": 3,
      "layer": "state",
      "source_type": "store_update",
      "source_key": "order.submit.result"
    },
    {
      "step_order": 4,
      "layer": "render",
      "source_type": "component_render",
      "source_key": "SubmitResult"
    },
    {
      "step_order": 5,
      "layer": "dom",
      "source_type": "dom_text",
      "source_key": ".result-message"
    }
  ]
}
```

---

## 5.3 GET /api/v1/lineage/{lineage_id}

### 用途
查询已生成的 lineage 分析详情。

---

# 6. Diagnosis API

这是把 trace + lineage + 规则诊断聚合起来的 API。

---

## 6.1 POST /api/v1/diagnosis/run

### 用途
对某个 inspect 或 interaction 执行诊断。

### 请求体
可以支持两种入口：

### 方式 A：基于 lineage
```json
{
  "lineage_id": "lin_001",
  "mode": "inspect_diagnosis"
}
```

### 方式 B：基于 interaction
```json
{
  "interaction_id": "itx_001",
  "mode": "click_diagnosis"
}
```

### 返回
```json
{
  "report_id": "rep_001",
  "report_type": "inspect_diagnosis",
  "summary": "问题更可能出在前端 formatter 对 0 值的误判",
  "root_cause_top1": "FALSY_VALUE_SWALLOWED",
  "root_cause_ranking": [
    {
      "code": "FALSY_VALUE_SWALLOWED",
      "title": "0 值被前端判空逻辑吞掉",
      "confidence": 0.94
    },
    {
      "code": "API_FIELD_MISSING",
      "title": "接口字段缺失",
      "confidence": 0.06
    }
  ],
  "evidence": [
    {
      "type": "api_field",
      "summary": "接口返回 amount_cent = 0"
    },
    {
      "type": "formatter_output",
      "summary": "formatCurrency(0) 输出为 --"
    }
  ],
  "suggestions": [
    "将 if (!amount) 修改为 amount == null",
    "补充 0 值显示场景单测"
  ]
}
```

---

## 6.2 GET /api/v1/diagnosis/reports/{report_id}

### 用途
查询诊断报告详情。

---

## 6.3 GET /api/v1/diagnosis/reports

### 用途
查询报告列表。

### 查询参数
- `session_id`
- `interaction_id`
- `report_type`
- `root_cause_code`
- `page`
- `page_size`

---

# 7. Metadata API

MVP 不做完整代码图谱，但最好留一个 metadata 接口层。

---

## 7.1 POST /api/v1/metadata/components/register

### 用途
注册组件元数据。  
可由构建插件、脚本或手工配置上报。

### 请求体
```json
{
  "app_id": "trace-lens-demo",
  "components": [
    {
      "component_name": "OrderAmount",
      "file_path": "src/pages/order/detail/OrderAmount.tsx",
      "render_binding": "formatCurrency(amount)",
      "store_keys": ["order.current.amount_cent"],
      "api_fields": ["GET /api/order/detail response.data.amount_cent"]
    }
  ]
}
```

### 返回
```json
{
  "success": true,
  "registered": 1
}
```

---

## 7.2 GET /api/v1/metadata/components/{component_name}

### 用途
查某组件元信息。

---

# 8. Copilot API

AI 层尽量建立在结构化结果之上，不直接吃原始日志。

---

## 8.1 POST /api/v1/copilot/explain

### 用途
把诊断报告转成自然语言解释。

### 请求体
```json
{
  "report_id": "rep_001",
  "style": "developer"
}
```

### style 可选
- `developer`
- `tester`
- `product`

### 返回
```json
{
  "report_id": "rep_001",
  "explanation": "该问题更可能出在前端 formatter。订单详情接口返回的 amount_cent 为 0，store 中值也为 0，但 formatCurrency 使用了 falsy 判空逻辑，最终将 0 显示为 --。建议修改判空逻辑并补充 0 值测试。"
}
```

---

## 8.2 POST /api/v1/copilot/ask

### 用途
用户自然语言提问。

### 请求体
```json
{
  "session_id": "sess_001",
  "interaction_id": "itx_001",
  "question": "点击提交后为什么页面没更新？"
}
```

### 返回
```json
{
  "answer": "这次点击后，请求已成功返回，但没有检测到目标组件发生重渲染。更可能的问题是 store 更新未被组件订阅，或 memo 阻止了刷新。",
  "references": [
    {
      "type": "trace_node",
      "id": "n3"
    },
    {
      "type": "rule_finding",
      "id": "rf_002"
    }
  ]
}
```

---

# 9. 通用返回结构建议

MVP 阶段建议统一返回包一层，便于前端处理。

---

## 成功返回
```json
{
  "success": true,
  "data": {},
  "request_id": "req_001"
}
```

---

## 失败返回
```json
{
  "success": false,
  "error": {
    "code": "LINEAGE_NOT_FOUND",
    "message": "无法解析目标组件的血缘路径"
  },
  "request_id": "req_002"
}
```

---

# 10. 错误码建议

### 通用
- `INVALID_PARAM`
- `UNAUTHORIZED`
- `NOT_FOUND`
- `INTERNAL_ERROR`

### 业务相关
- `INTERACTION_NOT_FOUND`
- `TRACE_NOT_FOUND`
- `LINEAGE_NOT_FOUND`
- `INSPECT_TARGET_NOT_FOUND`
- `DIAGNOSIS_FAILED`
- `METADATA_MISSING`
- `UNSUPPORTED_COMPONENT`
- `INSUFFICIENT_EVIDENCE`

---

# 11. MVP 阶段最小 API 集合

如果你现在就要开干，我建议先只做下面这 **8 个 API**，就能打通核心闭环。

---

## 必做 1：批量上报事件
### POST /api/v1/events/batch-ingest

用于采集 runtime events。

---

## 必做 2：上报 inspect target
### POST /api/v1/inspect/target

用于选点分析入口。

---

## 必做 3：查 interaction 时间线
### GET /api/v1/interactions/{interaction_id}/timeline

用于点击后发生了什么。

---

## 必做 4：查完整 trace
### GET /api/v1/traces/by-interaction/{interaction_id}

用于因果图/时间线。

---

## 必做 5：反向溯源
### POST /api/v1/lineage/reverse

MVP 最核心。

---

## 必做 6：正向主链路
### POST /api/v1/lineage/forward

支持点击主链路展示。

---

## 必做 7：运行诊断
### POST /api/v1/diagnosis/run

输出规则归因和建议。

---

## 必做 8：解释诊断结果
### POST /api/v1/copilot/explain

给人看的自然语言结论。

---

# 12. 推荐调用链

最后给你一个最典型的调用闭环。

---

## 场景 A：页面值异常
```text
1. 插件 POST /inspect/target
2. 工作台 POST /lineage/reverse
3. 工作台 POST /diagnosis/run
4. 工作台 POST /copilot/explain
5. 展示诊断报告
```

---

## 场景 B：点击后没反应
```text
1. SDK POST /events/batch-ingest
2. 工作台 GET /interactions/{id}/timeline
3. 工作台 GET /traces/by-interaction/{id}
4. 工作台 POST /lineage/forward
5. 工作台 POST /diagnosis/run
6. 工作台 POST /copilot/explain
```

---

# 13. 一句话总结

这套 MVP API 的核心设计思路是：

- **Ingestion** 负责收集事实
- **Trace** 负责组织事实
- **Lineage** 负责建立链路
- **Diagnosis** 负责归因
- **Copilot** 负责解释

这样边界清晰，而且很适合后面逐步扩展。

---

如果你愿意，我下一步可以继续直接补其中一个：

1. **数据库表结构 SQL 初稿**
2. **工作台页面信息架构图**
3. **3个月研发排期表**
4. **接口时序调用图**
5. **OpenAPI/Swagger 草案**

如果按工程推进顺序，我建议下一步直接做：  
**《接口时序调用图》**。