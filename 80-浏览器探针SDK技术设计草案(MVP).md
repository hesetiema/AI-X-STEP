下面给你一版 **浏览器探针 SDK 技术设计草案（MVP）**，聚焦你当前产品方向：

- 前端交互观测
- 数据血缘 / 因果链构建
- 诊断可解释输入
- 先满足 MVP 可落地，不做过重 replay 平台

我按这几个部分展开：

1. 设计目标
2. 采集范围
3. SDK 架构
4. 事件协议
5. 批量上报
6. 性能边界
7. 隐私与安全边界
8. 接入方式
9. MVP / P1 演进建议

---

# 浏览器探针 SDK 技术设计草案（MVP）

---

# 1. 设计目标

浏览器探针 SDK 的目标，不是单纯做前端埋点，而是为一次“用户交互异常/数据异常”的诊断分析提供高质量第一现场证据。  
SDK 应支持以下核心能力：

- 以 **interaction** 为中心采集用户行为与上下文
- 采集 UI 状态、请求链路、异常和性能信号
- 建立 `interactionId / requestId / traceId` 关联
- 为后端 DiagnosisContext 提供统一证据输入
- 在业务可接受的性能和隐私边界内运行

MVP 阶段 SDK 的定位是：

> “轻量交互诊断探针”，而不是完整 Session Replay 平台。

---

# 2. 采集范围

SDK 采集范围以“诊断最小闭环”为准，优先覆盖会直接影响因果判断的信号。

---

## 2.1 用户行为事件

用于回答：**用户做了什么，诊断锚点是什么。**

### 采集事件类型
- `click`
- `input`
- `change`
- `submit`
- `route_change`
- `modal_open`
- `modal_close`
- `tab_switch`

### 最小字段
- `eventId`
- `sessionId`
- `interactionId`
- `timestamp`
- `pageUrl`
- `route`
- `eventType`
- `targetId`
- `targetName`
- `targetText`（截断）
- `componentName`（如可获得）
- `businessAction`（可选业务埋点）
- `domPath`（裁剪/哈希化后）

### 采集策略
- 默认只采集关键交互，不采全量 DOM 事件流
- `input` 默认不采集原始输入值，只采：
  - 字段名
  - 是否为空
  - 长度区间
  - 是否触发 change/submit

---

## 2.2 UI 状态事件

用于回答：**用户看到了什么，症状是什么。**

### 采集事件类型
- `loading_start`
- `loading_end`
- `toast_show`
- `error_toast`
- `empty_state_show`
- `button_disabled`
- `retry_loop_detected`
- `skeleton_long_visible`

### 最小字段
- `stateEventId`
- `interactionId`
- `timestamp`
- `stateType`
- `targetId`
- `componentName`
- `message`（脱敏/截断）
- `durationMs`
- `visible`
- `severity`

### 采集策略
- 优先通过业务组件埋点触发
- DOM 猜测仅作为补充，不作为主机制
- 明确区分：
  - 事实状态（loading）
  - 用户症状（error toast / empty state）

---

## 2.3 网络请求事件

用于回答：**前端发了什么请求，请求结果如何。**

### 采集对象
- `fetch`
- `XMLHttpRequest`
- `axios`（如项目统一封装可直接接接入层）

### 采集阶段
- request start
- response success
- response error
- timeout
- abort
- retry

### 最小字段
- `requestId`
- `interactionId`
- `traceId`
- `spanId`（可选）
- `timestamp`
- `method`
- `urlPattern`
- `statusCode`
- `durationMs`
- `errorCode`
- `retryCount`
- `apiName`
- `serviceHint`
- `requestSize`
- `responseSize`

### 不建议默认采集
- 完整 request body
- 完整 response body
- headers 全量
- token/cookie

### 建议采集替代信息
- body schema 摘要
- 字段数量
- payload size
- status family
- error category

---

## 2.4 JS 异常与资源错误

用于回答：**前端自身是否报错。**

### 采集对象
- `window.onerror`
- `window.onunhandledrejection`
- `resource error`
- 可选：`console.error` hook

### 最小字段
- `errorId`
- `interactionId`
- `timestamp`
- `errorType`
- `message`
- `stack`（截断/脱敏）
- `file`
- `line`
- `column`
- `resourceUrl`
- `componentStack`（React 可选）

### 采集策略
- 同类错误需做短时间去重
- stack 要做长度限制
- 资源 URL 要做域名/参数脱敏

---

## 2.5 性能与生命周期信号

用于回答：**为什么用户感知卡顿/慢。**

### 建议采集
- route render duration
- API request duration
- long task
- first meaningful state
- interaction -> response visible latency

### MVP 策略
- 只保留和诊断强相关的性能数据
- 不一开始做完整 RUM 指标体系

---

## 2.6 业务上下文扩展字段

用于增强诊断解释能力。

### 建议字段
- `appId`
- `appVersion`
- `env`
- `tenantId`
- `projectId`
- `userId`（可匿名）
- `sessionTags`
- `experimentFlags`
- `releaseVersion`

### 策略
- 允许业务接入方通过 `contextProvider` 注入
- 不强耦合在 SDK 核心内部

---

# 3. SDK 架构设计

建议采用插件化、分层架构，避免一个大而杂的单体 SDK。

```text
SDK Core
 ├─ Context Manager
 ├─ Interaction Manager
 ├─ Event Bus
 ├─ Queue Manager
 ├─ Transport
 └─ Plugin Runtime

Plugins
 ├─ User Event Plugin
 ├─ UI State Plugin
 ├─ Network Plugin
 ├─ Error Plugin
 ├─ Performance Plugin
 └─ Business Context Plugin
```

---

## 3.1 Core 组件职责

### Context Manager
维护稳定上下文：
- sessionId
- app/version/env
- page/route
- user/tenant/project

### Interaction Manager
负责：
- 创建 interactionId
- 管理 interaction 生命周期
- 将后续 UI/request/error 事件挂到当前 interaction 上

### Event Bus
统一插件事件输入输出，避免插件间直接耦合。

### Queue Manager
负责缓存、批量、重试、丢弃策略。

### Transport
负责真正上报：
- `sendBeacon`
- `fetch`
- fallback transport

---

## 3.2 插件职责

### User Event Plugin
监听用户关键交互。

### UI State Plugin
接收显式 UI 状态埋点，必要时辅助自动检测。

### Network Plugin
封装/代理 fetch/XHR/axios。

### Error Plugin
监听异常。

### Performance Plugin
采集与交互相关的时延和性能信号。

### Business Context Plugin
承接业务方自定义字段和 action 标签。

---

# 4. 事件协议设计

建议 SDK 对外与对内统一采用 **Envelope + Event Body** 结构。

---

## 4.1 上报包结构

```ts
type SdkEventEnvelope = {
  sdkVersion: string;
  appId: string;
  env: string;
  sessionId: string;
  interactionId?: string;
  occurredAt: string;
  eventType: string;
  page: {
    url: string;
    route?: string;
    title?: string;
  };
  context: {
    userId?: string;
    tenantId?: string;
    projectId?: string;
    appVersion?: string;
    releaseVersion?: string;
  };
  event: Record<string, unknown>;
};
```

---

## 4.2 事件分类建议

### 用户行为类
- `ui.click`
- `ui.input`
- `ui.change`
- `ui.submit`
- `ui.route_change`

### UI 状态类
- `state.loading`
- `state.toast`
- `state.empty`
- `state.retry_loop`
- `state.disabled`

### 网络类
- `network.request`
- `network.response`
- `network.error`
- `network.timeout`

### 异常类
- `error.js`
- `error.promise`
- `error.resource`

### 性能类
- `perf.route_render`
- `perf.long_task`
- `perf.interaction_latency`

---

## 4.3 示例：点击事件

```json
{
  "sdkVersion": "0.1.0",
  "appId": "web-console",
  "env": "prod",
  "sessionId": "sess-001",
  "interactionId": "itx-001",
  "occurredAt": "2026-06-15T10:00:00.000Z",
  "eventType": "ui.click",
  "page": {
    "url": "/orders/create",
    "route": "/orders/create",
    "title": "Create Order"
  },
  "context": {
    "userId": "u-001",
    "tenantId": "t-001",
    "appVersion": "1.3.2"
  },
  "event": {
    "eventId": "evt-001",
    "targetId": "submit-order-btn",
    "targetName": "提交订单",
    "componentName": "OrderSubmitButton",
    "businessAction": "submitOrder"
  }
}
```

---

## 4.4 示例：网络错误事件

```json
{
  "sdkVersion": "0.1.0",
  "appId": "web-console",
  "env": "prod",
  "sessionId": "sess-001",
  "interactionId": "itx-001",
  "occurredAt": "2026-06-15T10:00:01.200Z",
  "eventType": "network.error",
  "page": {
    "url": "/orders/create",
    "route": "/orders/create"
  },
  "context": {
    "userId": "u-001",
    "tenantId": "t-001",
    "appVersion": "1.3.2"
  },
  "event": {
    "requestId": "req-001",
    "traceId": "trace-001",
    "method": "POST",
    "urlPattern": "/api/orders",
    "statusCode": 504,
    "durationMs": 5120,
    "errorCode": "GATEWAY_TIMEOUT",
    "retryCount": 1
  }
}
```

---

# 5. 批量上报设计

MVP 不建议每个事件都立即上报，应该通过队列批量发送。

---

## 5.1 设计目标
- 减少请求数
- 降低主线程干扰
- 在页面关闭时尽可能送达
- 避免事件风暴压垮服务端

---

## 5.2 队列策略

### 推荐阈值
- 条数阈值：`10 ~ 30`
- 时间阈值：`3s ~ 5s`
- 页面卸载时强制 flush

### flush 触发条件
- 达到数量阈值
- 达到时间阈值
- `visibilitychange -> hidden`
- `beforeunload` / `pagehide`
- 关键错误发生后可立即 flush

---

## 5.3 发送策略
优先级建议：

1. `navigator.sendBeacon`
2. `fetch(..., keepalive: true)`
3. 普通异步 `fetch`

---

## 5.4 上报包结构

```ts
type SdkBatchPayload = {
  appId: string;
  sdkVersion: string;
  sentAt: string;
  sessionId: string;
  events: SdkEventEnvelope[];
};
```

---

## 5.5 重试策略
建议只做**轻量重试**：

- 网络失败时最多 1~2 次重试
- 指数退避
- 本地临时缓存上限受控
- 不保证强一致送达

MVP 目标是“尽量送达”，不是“消息队列级可靠性”。

---

# 6. 性能边界设计

探针不能反过来影响业务页面，这是硬约束。

---

## 6.1 CPU / 主线程占用边界
原则：

- 监听轻量
- 计算后置
- 批量发送
- 避免同步 JSON 大对象构造
- 避免频繁序列化/深拷贝

建议：
- 重解析、脱敏、压缩优先放到发送前
- 高频事件默认采样或限流

---

## 6.2 内存边界
原则：

- 队列有上限
- 缓存有 TTL
- 过量时优先丢弃低优先级事件

建议：
- 最大排队事件数：如 100~300
- 超限后丢弃 debug/低价值事件，保留 error/network/ui symptom

---

## 6.3 网络边界
原则：

- 控制单批 payload 大小
- 控制上报频率
- 大字段截断

建议：
- 单事件 payload 限制
- 单批最大体积限制，如 `100KB ~ 300KB`
- 超限拆批

---

## 6.4 事件优先级
建议给事件分优先级：

### 高优先级
- `network.error`
- `error.js`
- `state.error_toast`
- `state.retry_loop`

### 中优先级
- `ui.click`
- `ui.submit`
- `network.response`
- `state.loading`

### 低优先级
- 一般性 UI 状态变动
- 非关键性能指标

在超限场景下，优先保留高优先级。

---

# 7. 隐私与安全边界

这是 SDK 设计里必须写清楚的部分。

---

## 7.1 默认不采集的内容
默认禁止采集：

- 密码
- token
- cookie
- 身份证号/手机号/邮箱原文
- 完整 request/response body
- 输入框原始值
- 富文本内容
- 文件内容

---

## 7.2 字段脱敏策略
对可能敏感字段做统一处理：

- URL query 参数白名单保留
- headers 默认只保留少数字段
- message / stack / payload 做关键词脱敏
- targetText 做长度裁剪和模式脱敏

例如：
- 手机号替换为 `138****0000`
- 邮箱替换为 `a***@xx.com`

---

## 7.3 DOM / 文本采集边界
建议：

- 不采整页 DOM 快照
- 不采 input 原值
- 文本只采有限长度、有限白名单组件
- 可配置 `ignoreSelectors`

---

## 7.4 配置项建议
SDK 应允许业务接入方配置：

- `maskFields`
- `ignoreUrls`
- `ignoreSelectors`
- `allowedQueryKeys`
- `allowedHeaders`
- `disableTextCapture`
- `samplingRules`

---

## 7.5 合规原则
文档中建议明确写出：

- SDK 以诊断定位为目的，按最小必要原则采集
- 敏感字段默认关闭
- 业务方可配置禁采范围
- 服务端仍需二次脱敏与校验

---

# 8. 接入方式设计

---

## 8.1 SDK 初始化示例

```ts
diagnosisProbe.init({
  appId: 'web-console',
  env: 'prod',
  endpoint: '/collect/events',
  appVersion: '1.3.2',
  enableUserEvent: true,
  enableNetwork: true,
  enableError: true,
  enablePerformance: true,
  batch: {
    maxEvents: 20,
    flushIntervalMs: 3000,
  },
  privacy: {
    disableTextCapture: false,
    maskFields: ['phone', 'email', 'idCard'],
    ignoreSelectors: ['[data-private=true]'],
  },
  contextProvider: () => ({
    userId: window.__USER_ID__,
    tenantId: window.__TENANT_ID__,
    releaseVersion: window.__RELEASE_VERSION__,
  }),
});
```

---

## 8.2 业务显式打点接口

为了更稳定地拿到业务语义，SDK 应提供轻量显式 API：

```ts
diagnosisProbe.startInteraction({
  targetId: 'submit-order-btn',
  businessAction: 'submitOrder',
});

diagnosisProbe.trackUiState({
  stateType: 'loading',
  targetId: 'order-submit-panel',
  visible: true,
});

diagnosisProbe.trackUiState({
  stateType: 'error_toast',
  message: '提交失败',
  severity: 'error',
});
```

这类显式打点对于 MVP 很重要，比“全自动推断”更可靠。

---

## 8.3 框架适配建议
MVP 阶段建议：

- 先做框架无关 core
- 再提供可选适配：
  - React hook / HOC
  - Vue plugin
  - axios adapter

不要一开始把框架适配耦死在 core 内。

---

# 9. SDK 对后端诊断的价值映射

建议在文档里明确说明 SDK 采集如何服务后端诊断：

| SDK 信号 | 后端用途 |
|---|---|
| `ui.click / submit` | 确定 interaction 锚点 |
| `state.loading / empty / toast` | 形成 symptom evidence |
| `network.error / timeout / retry` | 命中 API/BFF/外部依赖规则 |
| `error.js / promise` | 命中前端错误/事件丢失规则 |
| `traceId / requestId` | 构建上下游依赖链 |
| `businessAction / targetId` | 增强结论解释与定位 |

---

# 10. MVP 与后续演进建议

---

## 10.1 MVP 必做
- interactionId 管理
- 用户关键行为采集
- UI symptom 采集
- 网络请求采集
- 异常采集
- 批量上报
- 基础脱敏能力

---

## 10.2 P1 增强
- 更丰富的 UI 状态自动识别
- 交互性能指标增强
- 前后端 trace context 自动透传
- 规则友好的 event normalization
- 历史相似交互聚类标签

---

## 10.3 P2 扩展
- session replay 片段化采样
- 智能采样
- 远程配置
- 实验开关
- 更丰富框架生态适配

---

# 11. 最终建议结论

浏览器探针 SDK 在 MVP 阶段应坚持四个原则：

## 11.1 以 interaction 为中心
不是记录所有浏览器行为，而是围绕一次可诊断交互构建上下文。

## 11.2 以诊断有用为准
优先采集能支撑 root cause / symptom 判断的信号，而非追求全量观测。

## 11.3 以轻量低侵入为约束
批量、截断、脱敏、采样、优先级控制必须是默认能力。

## 11.4 以可扩展插件化为架构基础
先做好核心采集闭环，再逐步扩展到更复杂的性能、回放和智能分析能力。

---

如果你愿意，我下一条可以继续直接输出：

**“浏览器探针 SDK 的事件协议 JSON Schema 草案 + TypeScript 类型定义草案”**。