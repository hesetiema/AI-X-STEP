下面直接给你一版 **Diagnosis API 响应 JSON 示例**。  
我会按你前面已经确定的链路来设计，并尽量贴近可落地的 MVP。

我分成 4 类：

1. API 响应顶层结构  
2. 成功诊断示例：页面值异常  
3. 成功诊断示例：点击后无变化  
4. 证据不足 / 无明确归因示例

---

# 1. 顶层响应结构建议

建议 Diagnosis API 统一返回：

```json
{
  "code": "OK",
  "message": "success",
  "data": {
    "diagnosis_id": "diag_xxx",
    "mode": "inspect_diagnosis",
    "status": "completed",
    "interaction_id": "itr_xxx",
    "lineage_id": "lin_xxx",
    "target": {},
    "top_cause": {},
    "supporting_causes": [],
    "symptoms": [],
    "summary": "",
    "repair_hints": [],
    "score_breakdown": [],
    "evidence_overview": {},
    "domino_chain": [],
    "generated_at": "2026-06-12T06:08:00Z"
  }
}
```

---

# 2. 示例一：页面值异常诊断

场景：

- 用户 inspect 到页面金额显示 `--`
- 实际接口和 store 中值都是 `0`
- formatter 把 `0` 判成空，输出了 `--`

这类场景非常适合展示 `R201 > R202 > R303` 的排序关系。

---

## 2.1 响应 JSON

```json
{
  "code": "OK",
  "message": "success",
  "data": {
    "diagnosis_id": "diag_20260612_0001",
    "mode": "inspect_diagnosis",
    "status": "completed",
    "interaction_id": "itr_9f3b2d11",
    "lineage_id": "lin_b81c44a2",
    "target": {
      "page_url": "/orders/detail?id=A1001",
      "target_dom_selector": ".order-amount",
      "target_component": "OrderAmount",
      "displayed_value": "--",
      "expected_binding": {
        "api_field_path": "response.data.amount",
        "store_key": "order.current.amount",
        "selector_name": "selectOrderAmount",
        "formatter_name": "formatCurrency"
      }
    },
    "top_cause": {
      "rule_code": "R201",
      "title": "合法 falsy 值被误判为空",
      "diagnosis_label": "合法值被判空吞掉",
      "category": "render_transform",
      "severity": "high",
      "confidence": 0.94,
      "layer": "render",
      "cluster": "formatter_fallback",
      "summary": "上游存在合法值 0，但格式化逻辑将其判定为空，最终输出兜底值 '--'。",
      "evidence_refs": [
        "ev_api_amount_0",
        "ev_store_amount_0",
        "ev_selector_amount_0",
        "ev_formatter_output_fallback",
        "ev_dom_display_dash"
      ],
      "suggestions": [
        "将 if (!value) 改为 value == null",
        "补充 0 值展示单测",
        "检查金额格式化函数对 0 的处理逻辑"
      ],
      "rank_score": {
        "rule_code": "R201",
        "base_score": 94,
        "root_cause_score": 16,
        "specificity_score": 20,
        "evidence_score": 15,
        "chain_consistency_score": 8,
        "symptom_penalty": 0,
        "duplicate_penalty": 4,
        "final_score": 149
      },
      "rank_reasons": [
        "属于渲染层根因规则",
        "比 R202 更具体，解释力更强",
        "证据完整度高",
        "与 inspect_diagnosis 链路高度一致"
      ]
    },
    "supporting_causes": [
      {
        "rule_code": "R202",
        "title": "格式化函数输出兜底值",
        "diagnosis_label": "格式化输出兜底值",
        "category": "render_transform",
        "severity": "medium",
        "confidence": 0.86,
        "layer": "render",
        "cluster": "formatter_fallback",
        "summary": "formatter formatCurrency 收到输入 0，但输出了 fallback '--'。",
        "evidence_refs": [
          "ev_formatter_input_0",
          "ev_formatter_output_fallback"
        ],
        "suggestions": [
          "检查 formatter 判空逻辑",
          "避免使用 !value 作为统一空值判断"
        ],
        "rank_score": {
          "rule_code": "R202",
          "base_score": 86,
          "root_cause_score": 16,
          "specificity_score": 8,
          "evidence_score": 15,
          "chain_consistency_score": 6,
          "symptom_penalty": 0,
          "duplicate_penalty": 4,
          "final_score": 127
        }
      }
    ],
    "symptoms": [
      {
        "rule_code": "R303",
        "title": "最终 DOM 被兜底文案覆盖",
        "diagnosis_label": "最终展示为兜底文案",
        "category": "dom",
        "severity": "medium",
        "confidence": 0.82,
        "layer": "dom",
        "cluster": "dom_fallback",
        "summary": "上游有真实值，但最终页面展示为 '--'。",
        "evidence_refs": [
          "ev_render_output_dash",
          "ev_dom_display_dash"
        ],
        "suggestions": [
          "检查模板最终展示逻辑"
        ],
        "rank_score": {
          "rule_code": "R303",
          "base_score": 82,
          "root_cause_score": 10,
          "specificity_score": 6,
          "evidence_score": 10,
          "chain_consistency_score": 4,
          "symptom_penalty": 6,
          "duplicate_penalty": 0,
          "final_score": 106
        }
      }
    ],
    "summary": "最可能根因是「合法值被判空吞掉」：接口、store、selector 中金额值均为 0，但 formatter 将 0 误判为空，最终页面显示 '--'。",
    "repair_hints": [
      "将金额格式化逻辑中的 if (!value) 替换为 value == null",
      "增加 0 值页面渲染测试用例",
      "对 fallback 输出增加调用前输入值埋点"
    ],
    "score_breakdown": [
      {
        "rule_code": "R201",
        "final_score": 149,
        "reason": [
          "根因层级优先",
          "规则具体性最高",
          "证据链完整"
        ]
      },
      {
        "rule_code": "R202",
        "final_score": 127,
        "reason": [
          "与 top cause 属于同一问题簇",
          "解释的是直接技术表现"
        ]
      },
      {
        "rule_code": "R303",
        "final_score": 106,
        "reason": [
          "更偏页面表现，不是最上游根因"
        ]
      }
    ],
    "evidence_overview": {
      "api": {
        "response_success": true,
        "field_path": "response.data.amount",
        "field_exists": true,
        "field_value": 0
      },
      "state": {
        "store_key": "order.current.amount",
        "store_updated": true,
        "store_value": 0
      },
      "selector": {
        "selector_name": "selectOrderAmount",
        "selector_ran": true,
        "selector_value": 0
      },
      "render": {
        "render_triggered": true,
        "formatter_name": "formatCurrency",
        "render_input_value": 0,
        "render_output_value": "--",
        "formatter_output_is_fallback": true
      },
      "dom": {
        "dom_updated": true,
        "dom_visible": true,
        "displayed_value": "--"
      }
    },
    "domino_chain": [
      {
        "step": 1,
        "layer": "api",
        "node_type": "response_field",
        "label": "API.amount = 0",
        "status": "ok",
        "evidence_ref": "ev_api_amount_0"
      },
      {
        "step": 2,
        "layer": "state",
        "node_type": "store_update",
        "label": "store.order.current.amount = 0",
        "status": "ok",
        "evidence_ref": "ev_store_amount_0"
      },
      {
        "step": 3,
        "layer": "selector",
        "node_type": "selector_output",
        "label": "selectOrderAmount() = 0",
        "status": "ok",
        "evidence_ref": "ev_selector_amount_0"
      },
      {
        "step": 4,
        "layer": "render",
        "node_type": "formatter",
        "label": "formatCurrency(0) -> '--'",
        "status": "broken",
        "evidence_ref": "ev_formatter_output_fallback",
        "hit_rule_code": "R201"
      },
      {
        "step": 5,
        "layer": "dom",
        "node_type": "dom_text",
        "label": "DOM displays '--'",
        "status": "affected",
        "evidence_ref": "ev_dom_display_dash"
      }
    ],
    "generated_at": "2026-06-12T06:08:00Z"
  }
}
```

---

# 3. 示例二：点击后无变化诊断

场景：

- 用户点击“刷新”
- request 成功返回
- 但 store 没更新
- 页面没有任何变化

这类场景通常会命中：

- `R101 STORE_NOT_UPDATED`
- `R403 REQUEST_SUCCESS_BUT_PAGE_NO_CHANGE`

而主结论应该是 `R101`。

---

## 3.1 响应 JSON

```json
{
  "code": "OK",
  "message": "success",
  "data": {
    "diagnosis_id": "diag_20260612_0002",
    "mode": "click_diagnosis",
    "status": "completed",
    "interaction_id": "itr_3ab892ee",
    "lineage_id": "lin_01bd223f",
    "target": {
      "page_url": "/dashboard/device",
      "target_dom_selector": ".device-status-card .value",
      "target_component": "DeviceStatusCard",
      "user_action": {
        "event_type": "click",
        "event_target": "button.refresh-status",
        "action_label": "刷新状态"
      }
    },
    "top_cause": {
      "rule_code": "R101",
      "title": "请求成功后状态未更新",
      "diagnosis_label": "状态未更新",
      "category": "state_binding",
      "severity": "high",
      "confidence": 0.9,
      "layer": "state",
      "cluster": "state_update",
      "summary": "请求成功返回后，预期的 store key `device.status.current` 未发生更新，导致后续渲染链路未启动。",
      "evidence_refs": [
        "ev_click_refresh",
        "ev_request_sent",
        "ev_response_success",
        "ev_store_no_update"
      ],
      "suggestions": [
        "检查 response -> store 的映射逻辑",
        "检查 reducer/setter 是否执行",
        "检查成功分支是否提前 return"
      ],
      "rank_score": {
        "rule_code": "R101",
        "base_score": 90,
        "root_cause_score": 24,
        "specificity_score": 18,
        "evidence_score": 15,
        "chain_consistency_score": 5,
        "symptom_penalty": 0,
        "duplicate_penalty": 0,
        "final_score": 152
      },
      "rank_reasons": [
        "属于状态层根因，优先级高于页面表现类规则",
        "明确定位到 request -> store 中断点",
        "证据完整度高"
      ]
    },
    "supporting_causes": [],
    "symptoms": [
      {
        "rule_code": "R403",
        "title": "请求成功但页面没有变化",
        "diagnosis_label": "请求成功但页面无变化",
        "category": "interaction",
        "severity": "high",
        "confidence": 0.93,
        "layer": "request_to_ui",
        "cluster": "request_ui_chain",
        "summary": "请求成功后，未观察到状态、渲染或 DOM 的后续变化。",
        "evidence_refs": [
          "ev_request_sent",
          "ev_response_success",
          "ev_no_render",
          "ev_dom_no_change"
        ],
        "suggestions": [
          "检查 response 是否被消费",
          "检查是否遗漏 store 更新"
        ],
        "rank_score": {
          "rule_code": "R403",
          "base_score": 93,
          "root_cause_score": 12,
          "specificity_score": 10,
          "evidence_score": 15,
          "chain_consistency_score": 8,
          "symptom_penalty": 8,
          "duplicate_penalty": 0,
          "final_score": 130
        }
      }
    ],
    "summary": "最可能根因是「状态未更新」：点击触发请求后接口已成功返回，但目标 store 未更新，导致页面无后续变化。",
    "repair_hints": [
      "检查请求成功后的 store 写入逻辑",
      "核对 action/reducer 是否命中",
      "检查页面是否订阅了正确 store key"
    ],
    "score_breakdown": [
      {
        "rule_code": "R101",
        "final_score": 152,
        "reason": [
          "根因优先",
          "状态层中断点清晰",
          "证据链完整"
        ]
      },
      {
        "rule_code": "R403",
        "final_score": 130,
        "reason": [
          "是结果表现，不是最上游根因"
        ]
      }
    ],
    "evidence_overview": {
      "interaction": {
        "click_detected": true,
        "handler_started": true,
        "request_sent": true,
        "response_success": true
      },
      "state": {
        "store_key": "device.status.current",
        "store_updated": false
      },
      "render": {
        "render_triggered": false
      },
      "dom": {
        "dom_updated": false
      }
    },
    "domino_chain": [
      {
        "step": 1,
        "layer": "ui",
        "node_type": "click_event",
        "label": "User clicks refresh button",
        "status": "ok",
        "evidence_ref": "ev_click_refresh"
      },
      {
        "step": 2,
        "layer": "handler",
        "node_type": "event_handler",
        "label": "refreshStatus() starts",
        "status": "ok",
        "evidence_ref": "ev_handler_start"
      },
      {
        "step": 3,
        "layer": "api",
        "node_type": "network_request",
        "label": "GET /api/device/status",
        "status": "ok",
        "evidence_ref": "ev_request_sent"
      },
      {
        "step": 4,
        "layer": "api",
        "node_type": "network_response",
        "label": "response 200 success",
        "status": "ok",
        "evidence_ref": "ev_response_success"
      },
      {
        "step": 5,
        "layer": "state",
        "node_type": "store_update",
        "label": "device.status.current not updated",
        "status": "broken",
        "evidence_ref": "ev_store_no_update",
        "hit_rule_code": "R101"
      },
      {
        "step": 6,
        "layer": "render",
        "node_type": "render_commit",
        "label": "no render triggered",
        "status": "affected",
        "evidence_ref": "ev_no_render"
      },
      {
        "step": 7,
        "layer": "dom",
        "node_type": "dom_snapshot",
        "label": "page remains unchanged",
        "status": "affected",
        "evidence_ref": "ev_dom_no_change"
      }
    ],
    "generated_at": "2026-06-12T06:08:00Z"
  }
}
```

---

# 4. 示例三：证据不足

场景：

- 只拿到了 DOM 显示异常
- 没拿到 API / store / render trace
- 暂时无法确认是上游断了，还是中间层吞了

这种情况不要硬给结论，要明确返回 `insufficient_evidence`。

---

## 4.1 响应 JSON

```json
{
  "code": "OK",
  "message": "success",
  "data": {
    "diagnosis_id": "diag_20260612_0003",
    "mode": "inspect_diagnosis",
    "status": "completed",
    "interaction_id": "itr_77f42de1",
    "lineage_id": null,
    "target": {
      "page_url": "/user/profile",
      "target_dom_selector": ".user-phone",
      "target_component": "UserPhoneField",
      "displayed_value": "--"
    },
    "top_cause": null,
    "supporting_causes": [],
    "symptoms": [],
    "summary": "当前证据不足，尚无法明确页面值异常发生在 API、状态、渲染或 DOM 的哪一层。",
    "repair_hints": [
      "补充接口响应快照",
      "补充 store 更新轨迹",
      "补充 render/formatter 证据"
    ],
    "score_breakdown": [],
    "evidence_overview": {
      "api": {
        "response_success": null,
        "field_path": null,
        "field_exists": null,
        "field_value": null
      },
      "state": {
        "store_key": null,
        "store_updated": null,
        "store_value": null
      },
      "render": {
        "render_triggered": null,
        "formatter_name": null,
        "render_input_value": null,
        "render_output_value": null
      },
      "dom": {
        "dom_updated": null,
        "dom_visible": true,
        "displayed_value": "--"
      }
    },
    "domino_chain": [
      {
        "step": 1,
        "layer": "dom",
        "node_type": "dom_text",
        "label": "DOM displays '--'",
        "status": "observed",
        "evidence_ref": "ev_dom_display_dash"
      }
    ],
    "generated_at": "2026-06-12T06:08:00Z"
  }
}
```

---

# 5. 示例四：无规则命中但链路完整

场景：

- API、store、render、dom 都有值
- 页面也变了
- 但用户觉得“结果不对”
- 当前规则体系无法判定

这种情况和“证据不足”不一样，应该返回：

- 证据充分
- 但当前规则集无明确异常命中

---

## 5.1 响应 JSON

```json
{
  "code": "OK",
  "message": "success",
  "data": {
    "diagnosis_id": "diag_20260612_0004",
    "mode": "inspect_diagnosis",
    "status": "completed",
    "interaction_id": "itr_8c91ea31",
    "lineage_id": "lin_18ca90bc",
    "target": {
      "page_url": "/inventory/detail?id=SKU1009",
      "target_dom_selector": ".stock-count",
      "target_component": "StockCount",
      "displayed_value": "12"
    },
    "top_cause": null,
    "supporting_causes": [],
    "symptoms": [],
    "summary": "当前链路证据完整，但现有规则未识别出明确的前端数据流异常。问题可能属于业务口径、计算逻辑或非规则覆盖场景。",
    "repair_hints": [
      "检查业务计算公式是否正确",
      "对比期望值与实际上游数据",
      "补充业务规则类诊断规则"
    ],
    "score_breakdown": [],
    "evidence_overview": {
      "api": {
        "response_success": true,
        "field_path": "response.data.stockCount",
        "field_exists": true,
        "field_value": 12
      },
      "state": {
        "store_key": "inventory.current.stockCount",
        "store_updated": true,
        "store_value": 12
      },
      "render": {
        "render_triggered": true,
        "formatter_name": "identity",
        "render_input_value": 12,
        "render_output_value": "12"
      },
      "dom": {
        "dom_updated": true,
        "dom_visible": true,
        "displayed_value": "12"
      }
    },
    "domino_chain": [
      {
        "step": 1,
        "layer": "api",
        "node_type": "response_field",
        "label": "API.stockCount = 12",
        "status": "ok",
        "evidence_ref": "ev_api_stock_12"
      },
      {
        "step": 2,
        "layer": "state",
        "node_type": "store_update",
        "label": "store.inventory.current.stockCount = 12",
        "status": "ok",
        "evidence_ref": "ev_store_stock_12"
      },
      {
        "step": 3,
        "layer": "render",
        "node_type": "render_commit",
        "label": "render output = '12'",
        "status": "ok",
        "evidence_ref": "ev_render_stock_12"
      },
      {
        "step": 4,
        "layer": "dom",
        "node_type": "dom_text",
        "label": "DOM displays '12'",
        "status": "ok",
        "evidence_ref": "ev_dom_stock_12"
      }
    ],
    "generated_at": "2026-06-12T06:08:00Z"
  }
}
```

---

# 6. 建议补两个字段

如果你后面要接工作台，我建议额外加两个字段，价值很高。

---

## 6.1 `diagnosis_state`

用于前端区分页面态：

```json
{
  "diagnosis_state": "confirmed_root_cause"
}
```

可选值建议：

- `confirmed_root_cause`
- `probable_root_cause`
- `insufficient_evidence`
- `no_rule_matched`

---

## 6.2 `next_actions`

用于工作台直接给 CTA：

```json
{
  "next_actions": [
    {
      "action_type": "inspect_evidence",
      "label": "查看 formatter 输入输出",
      "target_ref": "ev_formatter_output_fallback"
    },
    {
      "action_type": "open_source",
      "label": "查看 formatCurrency 实现",
      "target_ref": "src/utils/formatCurrency.ts"
    }
  ]
}
```

---

# 7. 最小 MVP 响应结构建议

如果你想先极简上线，可以先只保留这些字段：

```json
{
  "code": "OK",
  "message": "success",
  "data": {
    "diagnosis_id": "diag_xxx",
    "mode": "inspect_diagnosis",
    "status": "completed",
    "top_cause": {
      "rule_code": "R201",
      "title": "合法 falsy 值被误判为空",
      "summary": "上游存在合法值 0，但 formatter 输出 '--'"
    },
    "supporting_causes": [],
    "symptoms": [],
    "summary": "最可能根因是格式化层将 0 误判为空。",
    "repair_hints": [
      "将 if (!value) 改为 value == null"
    ],
    "domino_chain": []
  }
}
```

---

# 8. 一句话总结

Diagnosis API 的返回不应该只是“规则列表”，而应该是：

> **一个面向工作台消费的、已经完成归因排序与解释组织的诊断结果对象。**

核心要有：

- `top_cause`
- `supporting_causes`
- `symptoms`
- `summary`
- `repair_hints`
- `domino_chain`

这样你的工作台、报告页、因果链动画才能直接消费。

---

如果你愿意，我下一步可以继续直接补：

1. **Diagnosis API OpenAPI / Swagger 草案**
2. **Diagnosis Service TypeScript 完整代码骨架**
3. **Workbench 诊断结果卡片结构**
4. **domino_chain 前端可视化数据结构**
5. **Jest 单测样例**

如果按工程落地顺序，我建议下一步直接做：  
**《Diagnosis API OpenAPI / Swagger 草案》**。