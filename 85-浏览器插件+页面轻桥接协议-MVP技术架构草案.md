下面给你一版 **“浏览器插件 + 页面轻桥接协议”的 MVP 技术架构草案**。  
我会刻意收口在 **低侵入、先跑通、能验证产品价值**，不往重平台设计里走。

---

# 浏览器插件 + 页面轻桥接协议 MVP 技术架构草案

---

# 1. 目标与定位

本方案面向“前端交互异常 / 数据异常 / 链路异常”的快速诊断场景，目标是在 **尽量不侵入业务系统** 的前提下，建立一套可用的诊断闭环：

- 在浏览器侧观察用户交互、页面状态、请求与异常
- 通过极轻量桥接拿到必要的业务语义
- 将诊断会话发送到后端进行因果链分析
- 在工作台输出 root cause / supporting causes / symptoms / domino chain

该方案不是传统前端全量埋点 SDK 方案，而是：

> **浏览器插件为主、页面轻桥接为辅、后端诊断服务为核心** 的低侵入式诊断架构。

---

# 2. 为什么采用“插件 + 轻桥接”路线

## 2.1 设计动机
如果直接走 SDK 路线，通常需要业务系统接入初始化、配置、埋点和请求封装，前期改造成本高。  
而当前 MVP 更重要的是验证：

- 这种诊断工作台是否有价值
- 采集到的信号是否足够支撑因果链分析
- 用户是否愿意以“交互录制 + AI诊断”的方式使用产品

因此优先采用插件化路线，以降低接入门槛。

---

## 2.2 路线原则
本架构遵循以下原则：

1. **低侵入优先**：业务页面尽量不改，必要时只加极少桥接代码
2. **外部观测优先**：先采集浏览器可观测事实，再逐步补业务语义
3. **诊断闭环优先**：先跑通一次交互到一次诊断结果，而不是先做重埋点平台
4. **渐进增强**：未来可自然演进到“插件 + 轻量 SDK”模式

---

# 3. 总体架构

```text
[浏览器插件]
  ├─ 页面观察器
  ├─ 请求观察器
  ├─ 异常观察器
  ├─ 诊断录制控制器
  ├─ 页面桥接监听器
  └─ 上报客户端

[页面轻桥接协议]
  ├─ 全局上下文暴露
  ├─ 自定义事件通知
  └─ 关键业务动作/状态提示

[后端诊断服务]
  ├─ 会话接收
  ├─ 事件标准化
  ├─ 证据构建
  ├─ 因果链/血缘关系构建
  ├─ 规则诊断 + AI增强
  └─ 结果查询 API

[诊断工作台]
  ├─ 诊断会话列表
  ├─ 详情页
  ├─ domino chain
  ├─ 证据查看
  └─ 归因解释
```

---

# 4. 核心组成

---

# 4.1 浏览器插件

浏览器插件是 MVP 的主采集端，负责以近黑盒方式收集页面诊断证据。

## 4.1.1 职责
插件负责：

- 监听页面 URL / route 变化
- 监听用户关键交互
- 监听 fetch / XHR 请求
- 监听 JS 异常 / Promise 异常 / 资源异常
- 可选捕获截图/选区/元素摘要
- 接收页面桥接协议提供的业务语义
- 组织为一个 diagnosis session 并上报后端

---

## 4.1.2 插件内部分层
建议分为：

- **Recorder Controller**：开始/暂停/结束诊断录制
- **DOM Observer**：观察用户交互与页面状态线索
- **Network Hook**：采集请求/响应摘要
- **Error Hook**：采集前端错误
- **Bridge Listener**：接收页面轻桥接消息
- **Session Builder**：将各类信号组织成一个 session
- **Uploader**：将会话上传至后端

---

## 4.1.3 插件使用模式
MVP 建议采用“**用户主动触发**”模式：

- 用户点击插件“开始诊断”
- 复现问题
- 点击“结束并提交”
- 插件生成诊断会话并提交

而不是默认全程后台采集。  
这样更符合低侵入和隐私最小化原则。

---

# 4.2 页面轻桥接协议

页面轻桥接协议的目的不是做完整 SDK，而是给插件补充“浏览器外部观测拿不到但诊断有价值”的业务语义。

---

## 4.2.1 设计目标
桥接协议只解决三类信息：

1. 当前页面/模块是什么
2. 当前交互的业务动作是什么
3. 当前 UI 状态在业务语义上代表什么

---

## 4.2.2 桥接方式
建议支持两种轻量桥接方式：

### 方式 A：全局上下文对象
页面暴露一个全局对象，插件读取。

例如：

```ts
window.__DIAGNOSIS_CONTEXT__ = {
  appId: 'erp-console',
  module: 'order',
  page: '/orders/create',
  tenantId: 't-001',
  userId: 'u-001',
  releaseVersion: '2026.06.16'
};
```

适合提供稳定上下文。

---

### 方式 B：自定义事件
页面在关键动作和状态变化时主动 dispatch 事件，插件监听。

例如：

```ts
window.dispatchEvent(
  new CustomEvent('diagnosis:interaction', {
    detail: {
      businessAction: 'submitOrder',
      targetId: 'submit-order-btn',
      targetName: '提交订单'
    }
  }),
);
```

以及：

```ts
window.dispatchEvent(
  new CustomEvent('diagnosis:state', {
    detail: {
      type: 'loading',
      businessAction: 'submitOrder',
      componentName: 'OrderSubmitPanel'
    }
  }),
);
```

适合传递动态业务语义。

---

## 4.2.3 桥接边界
桥接协议只允许传递：

- 模块名
- 页面名
- businessAction
- 业务对象 ID
- 业务状态类型
- 非敏感标签与提示

不建议传：

- 大体量业务数据
- 明文表单内容
- 敏感字段原文
- 完整请求/响应体

---

# 4.3 后端诊断服务

后端负责把插件上传的诊断会话转化成可分析的 DiagnosisContext，并输出诊断结果。

## 4.3.1 输入
输入是一个“诊断会话包”，包含：

- 页面上下文
- 交互事件
- 网络事件
- UI 状态事件
- 错误事件
- 桥接语义事件
- 用户附加说明（可选）
- 截图引用（可选）

---

## 4.3.2 处理流程
后端流程建议保持简单：

1. 接收 session
2. 标准化为统一 Evidence
3. 构建 interaction timeline
4. 建立 request / error / state / businessAction 关系
5. 命中规则
6. 输出 root/supporting/symptoms
7. 生成 domino chain
8. 输出 explanation / AI summary

---

## 4.3.3 MVP 边界
MVP 阶段先不要求：

- 全量 trace 平台接入
- 图数据库
- 大规模实时处理
- 重流式计算

重点是：一份 session 能诊断。

---

# 5. 关键数据对象

---

# 5.1 Diagnosis Session
插件提交给后端的核心对象。

```ts
type DiagnosisSession = {
  sessionId: string;
  startedAt: string;
  endedAt: string;
  pageContext: {
    url: string;
    route?: string;
    title?: string;
    appId?: string;
    module?: string;
    tenantId?: string;
    releaseVersion?: string;
  };
  userHint?: {
    summary?: string;
    expected?: string;
    actual?: string;
  };
  events: ProbeEvent[];
  attachments?: {
    screenshots?: string[];
  };
};
```

---

# 5.2 ProbeEvent
统一事件模型。

```ts
type ProbeEvent =
  | UiEvent
  | UiStateEvent
  | NetworkEvent
  | ErrorEvent
  | BridgeEvent;
```

---

# 5.3 BridgeEvent
桥接事件模型。

```ts
type BridgeEvent = {
  type: 'bridge.context' | 'bridge.interaction' | 'bridge.state';
  timestamp: string;
  detail: Record<string, unknown>;
};
```

---

# 6. MVP 采集范围

为了控制复杂度，MVP 建议只采这些：

## 6.1 插件自动采集
- click
- submit
- route change
- fetch / xhr 摘要
- js error / promise error
- 关键 UI 文本症状（toast/error/empty/loading 的有限识别）
- 当前 DOM 选中元素摘要
- 可选截图

## 6.2 页面桥接补充
- module
- page semantic name
- businessAction
- business object id
- 关键业务状态（loading / success / failed / empty）

---

# 7. 交互流程

---

## 7.1 用户侧流程
1. 用户打开插件
2. 点击“开始诊断”
3. 在页面中复现问题
4. 插件自动采集页面证据
5. 页面通过桥接补充业务语义
6. 用户点击“结束并提交”
7. 后端返回 diagnosisId
8. 用户在工作台查看诊断结果

---

## 7.2 系统侧流程
1. 插件创建 diagnosis session
2. 自动记录 timeline
3. 监听桥接事件并挂到当前 session
4. 提交 session 到后端
5. 后端构建 DiagnosisContext
6. 执行规则诊断 + explanation
7. 返回 diagnosis result

---

# 8. 架构优势

---

## 8.1 低侵入
业务方无需完整接入 SDK，只需要：

- 零改动使用纯插件
- 或者加少量桥接代码增强语义

---

## 8.2 快速验证
可以快速验证三件事：

- 采集信号是否足够
- domino chain 是否有说服力
- 用户是否接受这种诊断方式

---

## 8.3 保留演进空间
未来可以平滑演进到：

- 插件 + 轻量桥接
- 插件 + 页面内轻量 agent
- 插件 + 轻量 SDK
- 最终平台化接入

---

# 9. 局限与补偿策略

---

## 9.1 业务语义有限
### 局限
纯插件模式很难知道业务语义。

### 补偿
通过桥接协议补：
- module
- businessAction
- state semantic

---

## 9.2 框架内部状态不可见
### 局限
插件对 React/Vue store、组件状态感知有限。

### 补偿
不强求框架内部状态，优先使用：
- UI 外显事实
- 页面桥接事件
- 请求/错误链路

---

## 9.3 不能替代全量线上观测
### 局限
插件更偏诊断会话采集，不适合全量线上被动采集。

### 补偿
把产品定位为“问题定位工作台入口”，不是先做全量埋点底座。

---

# 10. 演进路线

---

## P0：纯插件
- 手动开始/结束诊断
- 自动采交互/请求/错误
- 后端输出基本因果链

## P1：插件 + 页面桥接
- 暴露上下文对象
- 派发 interaction/state 自定义事件
- 归因更稳定

## P2：插件 + 轻量页面 agent
- 在页面注入更轻量的业务感知层
- 自动补充更多 UI 状态语义

## P3：插件 + 轻量 SDK
- 对重点模块提供标准化接入
- 插件负责工作台与人工增强
- SDK 负责稳定业务语义和 trace 贯通

---

# 11. 技术决策建议

当前阶段建议明确以下决策：

## 11.1 主体采集方案
采用 **浏览器插件** 作为 MVP 主采集端。

## 11.2 业务语义补充方案
采用 **页面轻桥接协议**，不直接引入重 SDK。

## 11.3 触发模式
采用 **手动开始/结束诊断会话**，避免全量后台采集。

## 11.4 后端分析方式
采用 **统一 session → evidence → diagnosis** 的处理链路。

---

# 12. 建议的 MVP 范围收口

我建议你把 MVP 范围收口到下面这组：

## 必做
- 浏览器插件录制诊断会话
- 请求/错误/交互自动采集
- 页面桥接上下文与 businessAction
- 后端 session 接收与标准化
- diagnosis result + domino chain 输出

## 可选
- 截图
- 手动备注
- UI 症状自动识别增强

## 延后
- 全量 SDK
- 复杂远程配置
- 图数据库
- 全量线上自动采集

---

# 13. 一句话架构结论

> MVP 阶段推荐采用 **“浏览器插件主采集 + 页面轻桥接补语义 + 后端诊断服务做因果分析”** 的低侵入方案，优先验证诊断工作台价值，而不是先投入建设重型前端埋点 SDK 体系。

---

如果你愿意，我下一条可以继续直接给你：

**这套“浏览器插件 + 页面轻桥接协议”方案的系统分层图 + 核心时序图（Mermaid 版）**。