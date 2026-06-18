可以，先收口成一个 **前端 MVP 方案**。  
我按你当前方向来定：**浏览器插件为主，页面轻桥接为辅，尽量低侵入**。

---

# 前端方案（MVP）

## 1. 目标

前端侧只做三件事：

1. **录制一次诊断会话**
   - 用户手动开始/结束
   - 采集交互、请求、异常、页面状态线索

2. **补充少量业务语义**
   - 当前模块
   - 当前业务动作
   - 关键状态变化

3. **把会话提交给后端**
   - 后端输出 diagnosis result
   - 前端再打开工作台查看

---

## 2. 前端总体形态

推荐采用 **两部分前端组成**：

### A. 浏览器插件
作为主入口，负责：
- 开始/结束诊断
- 自动采集页面事件
- 组织 session
- 提交后端

### B. 页面轻桥接脚本
由业务页面极少量接入，负责：
- 暴露上下文
- 派发关键业务事件
- 不承担完整采集逻辑

---

## 3. 浏览器插件前端方案

## 3.1 插件 UI 结构
MVP 只需要 3 个核心界面：

### 1）Popup 面板
用户点击插件图标后看到：
- 当前页面是否支持诊断
- 开始诊断按钮
- 结束并提交按钮
- 当前录制状态
- 简要事件计数

### 2）Side Panel（可选，推荐）
如果浏览器支持 side panel，可以放：
- 当前 session 摘要
- 最近采集到的事件
- 用户备注输入框
- 提交后跳转结果入口

### 3）结果跳转页
提交成功后：
- 显示 diagnosisId
- 打开工作台详情页

---

## 3.2 插件前端模块划分

```text
extension/
  ├─ popup/
  │   ├─ Popup.tsx
  │   └─ store.ts
  ├─ sidepanel/
  │   ├─ SidePanel.tsx
  │   └─ session-preview.ts
  ├─ background/
  │   ├─ service-worker.ts
  │   ├─ session-manager.ts
  │   └─ uploader.ts
  ├─ content/
  │   ├─ content-script.ts
  │   ├─ dom-observer.ts
  │   ├─ network-observer.ts
  │   ├─ error-observer.ts
  │   ├─ bridge-listener.ts
  │   └─ event-buffer.ts
  ├─ shared/
  │   ├─ types.ts
  │   ├─ protocol.ts
  │   └─ utils.ts
  └─ manifest.json
```

---

## 3.3 插件核心职责分配

### popup
负责用户操作：
- start
- stop
- submit
- 查看状态

### background/service worker
负责全局状态：
- 当前 tab 是否在录制
- session 生命周期
- 上传任务
- 与后端通信

### content script
负责页面内采集：
- DOM 事件
- fetch/xhr hook
- error hook
- bridge 监听

---

## 4. 页面轻桥接前端方案

页面侧不做 SDK 化，只做一个很轻的桥接层。

---

## 4.1 页面要暴露什么

### 全局上下文
```ts
window.__DIAGNOSIS_CONTEXT__ = {
  appId: 'erp-console',
  module: 'order',
  page: '/orders/create',
  tenantId: 't-001',
  releaseVersion: '2026.06.16',
};
```

### 关键交互语义
```ts
window.dispatchEvent(new CustomEvent('diagnosis:interaction', {
  detail: {
    businessAction: 'submitOrder',
    targetId: 'submit-order-btn',
    targetName: '提交订单'
  }
}));
```

### 关键状态语义
```ts
window.dispatchEvent(new CustomEvent('diagnosis:state', {
  detail: {
    type: 'loading',
    businessAction: 'submitOrder',
    componentName: 'OrderSubmitPanel'
  }
}));
```

---

## 4.2 页面桥接建议封成一个最小工具
不要一开始做重 SDK，可以只做一个很小的 helper。

```ts
export const diagnosisBridge = {
  setContext(context: Record<string, unknown>) {
    (window as any).__DIAGNOSIS_CONTEXT__ = context;
  },

  emitInteraction(detail: Record<string, unknown>) {
    window.dispatchEvent(new CustomEvent('diagnosis:interaction', { detail }));
  },

  emitState(detail: Record<string, unknown>) {
    window.dispatchEvent(new CustomEvent('diagnosis:state', { detail }));
  },
};
```

业务方接入成本会很低。

---

## 5. 采集侧前端方案

## 5.1 自动采集范围
MVP 建议 content script 自动采这些：

### 用户交互
- click
- submit
- change
- route change

### 网络
- fetch
- XHR

### 错误
- window error
- unhandledrejection

### 页面症状
先做轻量识别：
- error toast
- empty text
- loading 持续过长
- disabled button

---

## 5.2 采集策略
### 默认策略
- 只有用户点击“开始诊断”后才采集
- 结束后立即停止
- 不做后台长期开启

### 事件组织
所有事件进入当前 `DiagnosisSession`

```ts
type DiagnosisSession = {
  sessionId: string;
  tabId: number;
  status: 'recording' | 'stopped' | 'uploading';
  startedAt: string;
  endedAt?: string;
  context?: Record<string, unknown>;
  events: ProbeEvent[];
  userHint?: {
    summary?: string;
  };
};
```

---

## 6. 前端状态流转

## 6.1 插件侧状态机
建议非常简单：

```text
idle
  -> recording
  -> stopped
  -> uploading
  -> uploaded
  -> failed
```

### 含义
- `idle`: 未开始
- `recording`: 正在采集
- `stopped`: 已结束待提交
- `uploading`: 正在上传
- `uploaded`: 上传成功
- `failed`: 上传失败可重试

---

## 6.2 交互流程
### 用户操作流
1. 打开目标页面
2. 点击插件“开始诊断”
3. 页面复现问题
4. 点击“结束并提交”
5. 插件上传 session
6. 返回 diagnosisId
7. 打开工作台结果页

---

## 7. 推荐前端技术选型

## 插件 UI
- **React + TypeScript**
- 状态管理用轻量方案：
  - Zustand 或简单 context/store
- 构建工具：
  - Vite / CRXJS 或 Plasmo

### 我更推荐
**React + TypeScript + Vite/CRXJS**

理由：
- 上手快
- 结构清晰
- 后续扩展 popup / sidepanel 比较方便

---

## 页面桥接
- 原生 TS 即可
- 不依赖 React/Vue
- 保持 framework-agnostic

---

## 8. MVP 前端页面清单

## 插件侧
### 必做
- Popup：首页
  - 开始诊断
  - 结束并提交
  - 当前状态
- Session 上传成功页 / 跳转提示
- 基础错误提示

### 可选
- Side panel：
  - 当前事件时间线预览
  - 用户备注输入

---

## 页面侧
### 必做
- 全局 context 注入
- 两类自定义事件：
  - `diagnosis:interaction`
  - `diagnosis:state`

---

## 9. 前端与后端接口最小闭环

前端 MVP 只需要两个核心接口就够：

### 1）上传 session
`POST /api/v1/diagnosis-sessions`

请求：
- session context
- events
- attachments(optional)

返回：
- `diagnosisId`

### 2）查询结果
`GET /api/v1/diagnosis/:id`

返回：
- summary
- top cause
- supporting causes
- symptoms
- domino chain

---

## 10. 侵入性控制建议

这是方案里最关键的点。

### 尽量不侵入业务页面的做法：
1. **采集逻辑全部放插件**
2. 页面只提供轻桥接 helper
3. 不要求业务项目初始化完整 SDK
4. 不要求业务项目改造请求层
5. 不要求业务项目大规模埋点

### 只在必要页面补最少语义
例如只在关键流程页加：

- `setContext`
- `emitInteraction`
- `emitState`

这样侵入会很低。

---

## 11. MVP 推荐实现顺序

### Phase 1：纯插件闭环
先做：
- popup
- content script
- session builder
- upload

先不要求页面接桥接协议。

### Phase 2：加轻桥接
在一两个关键模块加：
- context
- interaction
- state

验证桥接是否显著提升诊断质量。

### Phase 3：加 side panel / 备注 / 截图
让插件更像正式诊断工具。

---

## 12. 结论

如果你现在是要一个 **“先能跑起来、低侵入”的前端方案**，我建议就定成：

> **前端采用“浏览器插件主采集 + 页面轻桥接补语义”的 MVP 方案。**  
> 插件负责录制诊断会话、采集交互/请求/异常并提交后端；页面只通过极小的 bridge helper 暴露上下文和关键业务事件，不引入重型 SDK。

---

如果你愿意，我下一条可以继续直接给你两种之一：

1. **前端目录结构 + 模块职责草案**
2. **插件 Popup / SidePanel 的低保真信息架构**