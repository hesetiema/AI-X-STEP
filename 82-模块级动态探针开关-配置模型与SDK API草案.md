下面给你一版 **“模块级动态探针开关”的配置模型 + SDK API 草案**，目标是：

- 支持按模块/路由/组件动态启停探针
- 不侵入业务逻辑
- 可本地静态配置，也可后续扩展远程配置
- 与你前面的 Diagnosis / 浏览器探针设计保持一致

我分成 6 部分：

1. 设计目标  
2. 配置模型  
3. SDK API 草案  
4. 配置合并与生效规则  
5. 运行时行为建议  
6. MVP 推荐收敛版

---

# 1. 设计目标

模块级动态探针开关要解决的核心问题：

- 哪些模块启用探针
- 每个模块启用哪些探针类型
- 是否按路由/组件进一步细分
- 是否可按环境/租户/用户分群灰度
- 是否可切换不同观测模式（基础 / 增强 / 严格隐私）

因此这套模型需要同时支持：

- **全局默认**
- **模块级覆盖**
- **路由级覆盖**
- **运行时判定**
- **隐私边界优先**

---

# 2. 配置模型草案

我建议把配置拆成两层：

- **静态结构配置**
- **运行时判定上下文**

---

## 2.1 基础类型定义

```ts
export type ProbeType =
  | 'userEvent'
  | 'uiState'
  | 'network'
  | 'error'
  | 'performance';

export type ProbeMode =
  | 'off'
  | 'basic'
  | 'enhanced';

export type PrivacyMode =
  | 'strict'
  | 'default'
  | 'diagnostic';
```

---

## 2.2 单层配置结构

```ts
export interface ProbeLayerConfig {
  enabled?: boolean;
  mode?: ProbeMode;
  probes?: Partial<Record<ProbeType, boolean>>;
  sampleRate?: number;
  privacyMode?: PrivacyMode;
  maxEventsPerMinute?: number;
  tags?: string[];
}
```

说明：

- `enabled`: 该层是否启用
- `mode`:
  - `off`: 不采集
  - `basic`: 基础采集
  - `enhanced`: 增强采集
- `probes`: 具体探针类型开关
- `sampleRate`: 采样率 `0 ~ 1`
- `privacyMode`:
  - `strict`: 更强隐私保护
  - `default`: 默认模式
  - `diagnostic`: 诊断增强模式
- `maxEventsPerMinute`: 限流
- `tags`: 方便后续策略打标

---

## 2.3 模块级配置结构

```ts
export interface ModuleProbeConfig extends ProbeLayerConfig {
  routes?: Record<string, ProbeLayerConfig>;
  components?: Record<string, ProbeLayerConfig>;
}
```

说明：

- 模块内部可以继续对路由、组件做二级覆盖

---

## 2.4 顶层配置结构

```ts
export interface ProbeConfig {
  version: string;

  global: ProbeLayerConfig;

  environments?: Record<string, ProbeLayerConfig>;

  apps?: Record<string, ProbeLayerConfig>;

  modules?: Record<string, ModuleProbeConfig>;

  segments?: ProbeSegmentRule[];

  privacy?: {
    defaultMode?: PrivacyMode;
    forbiddenFields?: string[];
    ignoreSelectors?: string[];
    allowedQueryKeys?: string[];
    allowedHeaders?: string[];
    disableTextCapture?: boolean;
  };
}
```

---

## 2.5 分群规则

```ts
export interface ProbeSegmentRule {
  name: string;
  priority?: number;
  match: {
    tenantId?: string[];
    userId?: string[];
    route?: string[];
    module?: string[];
    releaseVersion?: string[];
    env?: string[];
  };
  config: ProbeLayerConfig;
}
```

说明：

- 用于灰度开关、指定租户启用、指定版本临时增强观测

---

## 2.6 运行时上下文

```ts
export interface ProbeRuntimeContext {
  appId: string;
  env: string;
  module?: string;
  route?: string;
  component?: string;
  tenantId?: string;
  userId?: string;
  releaseVersion?: string;
}
```

---

# 3. SDK API 草案

建议 API 分三层：

1. 初始化与配置层
2. 模块/路由/组件句柄层
3. 显式采集层

---

## 3.1 初始化 API

```ts
export interface DiagnosisProbeInitOptions {
  appId: string;
  env: string;
  endpoint: string;
  appVersion?: string;

  config?: ProbeConfig;
  configLoader?: () => Promise<ProbeConfig>;

  contextProvider?: () => Partial<ProbeRuntimeContext>;

  batch?: {
    maxEvents?: number;
    flushIntervalMs?: number;
  };

  privacy?: {
    disableTextCapture?: boolean;
    maskFields?: string[];
    ignoreSelectors?: string[];
  };
}
```

```ts
export interface DiagnosisProbe {
  init(options: DiagnosisProbeInitOptions): Promise<void>;
  updateConfig(config: ProbeConfig): void;
  getConfig(): ProbeConfig | undefined;
}
```

---

## 3.2 模块句柄 API

推荐支持这种风格：

```ts
const orderProbe = diagnosisProbe.module('order');
```

接口定义：

```ts
export interface ModuleProbeHandle {
  readonly moduleName: string;

  isEnabled(): boolean;
  isProbeEnabled(probeType: ProbeType): boolean;
  getEffectiveConfig(route?: string, component?: string): ResolvedProbeConfig;

  route(routePath: string): RouteProbeHandle;
  component(componentName: string): ComponentProbeHandle;

  startInteraction(input: StartInteractionInput): string | undefined;
  trackUiState(input: TrackUiStateInput): void;
  trackEvent(input: TrackEventInput): void;
  trackError(input: TrackErrorInput): void;
}
```

---

## 3.3 路由句柄 API

```ts
export interface RouteProbeHandle {
  readonly routePath: string;

  isEnabled(): boolean;
  isProbeEnabled(probeType: ProbeType): boolean;
  getEffectiveConfig(component?: string): ResolvedProbeConfig;

  component(componentName: string): ComponentProbeHandle;

  startInteraction(input: StartInteractionInput): string | undefined;
  trackUiState(input: TrackUiStateInput): void;
  trackEvent(input: TrackEventInput): void;
  trackError(input: TrackErrorInput): void;
}
```

---

## 3.4 组件句柄 API

```ts
export interface ComponentProbeHandle {
  readonly componentName: string;

  isEnabled(): boolean;
  isProbeEnabled(probeType: ProbeType): boolean;
  getEffectiveConfig(): ResolvedProbeConfig;

  startInteraction(input: StartInteractionInput): string | undefined;
  trackUiState(input: TrackUiStateInput): void;
  trackEvent(input: TrackEventInput): void;
  trackError(input: TrackErrorInput): void;
}
```

---

## 3.5 全局访问入口

```ts
export interface DiagnosisProbe {
  init(options: DiagnosisProbeInitOptions): Promise<void>;
  updateConfig(config: ProbeConfig): void;
  getConfig(): ProbeConfig | undefined;

  module(moduleName: string): ModuleProbeHandle;

  isEnabled(context?: Partial<ProbeRuntimeContext>): boolean;
  isProbeEnabled(
    probeType: ProbeType,
    context?: Partial<ProbeRuntimeContext>,
  ): boolean;

  resolveConfig(
    context?: Partial<ProbeRuntimeContext>,
  ): ResolvedProbeConfig;
}
```

---

# 4. 事件采集输入模型

这里给一版简化草案，重点体现“句柄只负责声明，最终是否采集由 gate 决定”。

---

## 4.1 StartInteraction

```ts
export interface StartInteractionInput {
  targetId?: string;
  targetName?: string;
  componentName?: string;
  businessAction?: string;
  metadata?: Record<string, unknown>;
}
```

---

## 4.2 TrackUiState

```ts
export interface TrackUiStateInput {
  stateType:
    | 'loading'
    | 'loading_end'
    | 'toast'
    | 'error_toast'
    | 'empty_state'
    | 'retry_loop'
    | 'disabled';
  targetId?: string;
  componentName?: string;
  message?: string;
  severity?: 'info' | 'warning' | 'error';
  visible?: boolean;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}
```

---

## 4.3 TrackEvent

```ts
export interface TrackEventInput {
  eventType: string;
  targetId?: string;
  componentName?: string;
  label?: string;
  metadata?: Record<string, unknown>;
}
```

---

## 4.4 TrackError

```ts
export interface TrackErrorInput {
  errorType?: 'js' | 'promise' | 'resource' | 'manual';
  message: string;
  stack?: string;
  metadata?: Record<string, unknown>;
}
```

---

# 5. 生效后的解析配置

建议 SDK 内部统一得到一个解析后配置对象。

```ts
export interface ResolvedProbeConfig {
  enabled: boolean;
  mode: ProbeMode;
  probes: Record<ProbeType, boolean>;
  sampleRate: number;
  privacyMode: PrivacyMode;
  maxEventsPerMinute?: number;
  sourceChain: string[];
}
```

这里 `sourceChain` 很有用，用来调试：

```ts
[
  'global',
  'environment:prod',
  'module:order',
  'route:/orders/create',
  'segment:tenant-a-enhanced'
]
```

可以在开发环境快速看出为什么某个模块启用了增强探针。

---

# 6. 配置合并规则

这个部分很关键，不然运行时容易混乱。

我建议优先级从低到高：

```text
global
  < environment
  < app
  < module
  < route
  < component
  < segment
```

即后者覆盖前者。

---

## 6.1 合并原则

### enabled
- 显式 `false` 优先级最高，直接关闭该层目标
- 但隐私策略仍独立生效

### mode
- 后者覆盖前者
- `off` 等价于 `enabled = false`

### probes
- 按 probeType 逐项覆盖
- 未声明的继承上层

### sampleRate
- 采用更小值优先，避免局部配置无限放大
- 即：
  - 全局 `0.2`
  - 模块 `1`
  - 最终建议仍取 `0.2` 或按策略限定上限

### privacyMode
- 更严格者优先
- 推荐优先级：
  - `strict` > `default` > `diagnostic`

也就是说，哪怕局部想调成 diagnostic，如果上层是 strict，也不能放开。

---

# 7. SDK 使用示例

---

## 7.1 初始化

```ts
import { diagnosisProbe } from '@acme/diagnosis-probe';

await diagnosisProbe.init({
  appId: 'web-console',
  env: 'prod',
  endpoint: '/collect/events',
  config: {
    version: '1',
    global: {
      enabled: true,
      mode: 'basic',
      probes: {
        userEvent: true,
        network: true,
        error: true,
        uiState: false,
        performance: false,
      },
      sampleRate: 1,
      privacyMode: 'default',
    },
    modules: {
      order: {
        enabled: true,
        mode: 'enhanced',
        probes: {
          uiState: true,
          performance: true,
        },
        routes: {
          '/orders/create': {
            mode: 'enhanced',
            probes: {
              userEvent: true,
              network: true,
              uiState: true,
              error: true,
              performance: true,
            },
          },
        },
      },
      payment: {
        enabled: true,
        mode: 'basic',
        privacyMode: 'strict',
        probes: {
          userEvent: true,
          network: true,
          error: true,
          uiState: true,
          performance: false,
        },
      },
    },
  },
  contextProvider: () => ({
    tenantId: window.__TENANT_ID__,
    userId: window.__USER_ID__,
    releaseVersion: window.__APP_RELEASE__,
  }),
});
```

---

## 7.2 模块内使用

```ts
const orderProbe = diagnosisProbe.module('order');

const interactionId = orderProbe.startInteraction({
  targetId: 'submit-order-btn',
  targetName: '提交订单',
  businessAction: 'submitOrder',
});

orderProbe.trackUiState({
  stateType: 'loading',
  targetId: 'order-submit-panel',
  visible: true,
});

orderProbe.trackUiState({
  stateType: 'error_toast',
  message: '提交失败',
  severity: 'error',
});
```

---

## 7.3 路由级使用

```ts
const createOrderProbe = diagnosisProbe
  .module('order')
  .route('/orders/create');

if (createOrderProbe.isProbeEnabled('performance')) {
  // 可选做一些增强性能观测
}

createOrderProbe.trackEvent({
  eventType: 'ui.submit',
  targetId: 'submit-order-btn',
  label: 'submit order form',
});
```

---

## 7.4 组件级使用

```ts
const submitButtonProbe = diagnosisProbe
  .module('order')
  .route('/orders/create')
  .component('OrderSubmitButton');

submitButtonProbe.trackEvent({
  eventType: 'ui.click',
  targetId: 'submit-order-btn',
});
```

---

# 8. 运行时行为建议

---

## 8.1 句柄 API 始终可调用
即使配置关闭，也不要抛异常。  
应当表现为：

- API 可调用
- 内部判定不采集
- 返回 `undefined` 或 no-op

这样业务方不需要到处写：

```ts
if (probeEnabled) ...
```

---

## 8.2 判定尽量在 SDK 内部完成
业务代码应该是：

```ts
probe.trackUiState(...)
```

而不是：

```ts
if (diagnosisProbe.resolveConfig(...).probes.uiState) {
  ...
}
```

只有极少数高开销探针才建议先问 `isProbeEnabled()`。

---

## 8.3 远程配置更新建议
后续可支持：

```ts
diagnosisProbe.updateConfig(newConfig);
```

SDK 内部需要：
- 原子切换新配置
- 不中断已有队列
- 新事件按新配置判定

---

# 9. MVP 推荐收敛版

如果你现在不想把模型做太大，我建议 MVP 先只保留：

---

## 9.1 MVP 顶层配置

```ts
export interface ProbeConfig {
  version: string;
  global: ProbeLayerConfig;
  modules?: Record<string, ModuleProbeConfig>;
}
```

---

## 9.2 MVP ProbeLayerConfig

```ts
export interface ProbeLayerConfig {
  enabled?: boolean;
  mode?: 'off' | 'basic' | 'enhanced';
  probes?: Partial<Record<ProbeType, boolean>>;
  sampleRate?: number;
  privacyMode?: 'strict' | 'default' | 'diagnostic';
}
```

---

## 9.3 MVP SDK API
只保留：

```ts
diagnosisProbe.init(...)
diagnosisProbe.updateConfig(...)
diagnosisProbe.module(name)

moduleProbe.isEnabled()
moduleProbe.isProbeEnabled(type)
moduleProbe.startInteraction(...)
moduleProbe.trackUiState(...)
moduleProbe.trackEvent(...)
moduleProbe.trackError(...)
```

这已经足够支撑你当前“模块级动态探针开关”的产品能力表达了。

---

# 10. 最终建议

如果要作为架构文档里的正式结论，我建议你这么定：

## 10.1 核心设计
模块级动态探针开关采用“**预埋探针点 + 运行时配置判定**”模式实现，不采用任意运行时代码注入。

## 10.2 配置结构
配置按“全局 → 模块 → 路由 → 组件 → 分群”的层次覆盖，最终生成运行时生效配置。

## 10.3 API 设计
SDK 对业务侧暴露 `module / route / component` 句柄，业务方只声明交互与状态，最终是否采集由 SDK 内部 Feature Gate 决定。

## 10.4 隐私边界
隐私策略优先于探针开关，任何增强模式均不得突破敏感字段禁采规则。

---

如果你愿意，我下一条可以继续直接给你：

**“模块级动态探针开关”的时序图 + 配置生效流程图（Mermaid版）**。