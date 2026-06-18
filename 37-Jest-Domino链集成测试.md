下面直接给你 **`DominoChainBuilder` 的升级版 Jest / 集成测试**。  
我会继续按你现在这套 Diagnosis 架构来写，目标是让它能直接放进 NestJS / Jest 工程里改造。

这次分两部分：

1. **Jest 单测版**：锁定 `DominoChainBuilder` 的节点生成规则
2. **集成测试版**：喂入接近真实的 `Conclusion + Context`，验证整条 domino chain 输出

---

# 1. 先约定一个 `DominoChainBuilder` 输出结构

为了让测试可写，我先按一个比较合理的 builder 约定来组织。  
如果你当前实现字段名略有不同，改一下断言字段即可。

---

## 假设的类型

```ts
export interface DominoNode {
  id: string;
  type:
    | 'interaction'
    | 'request'
    | 'response'
    | 'state'
    | 'selector'
    | 'render'
    | 'dom'
    | 'ui';
  label: string;
  status: 'healthy' | 'suspect' | 'broken' | 'symptom';
  layer?: string;
  relatedRuleCodes: string[];
  evidenceRefs: string[];
  isRootCause?: boolean;
  isSupporting?: boolean;
  isSymptom?: boolean;
}

export interface DominoChain {
  mode: 'inspect_diagnosis' | 'click_diagnosis';
  nodes: DominoNode[];
}
```

---

# 2. 建议文件位置

```bash
src/modules/diagnosis/__tests__/
├── domino-chain-builder.spec.ts
└── integration/
    └── domino-chain-builder.integration.spec.ts
```

---

# 3. 单测版

这里测 builder 本身，不依赖其他 service。  
重点覆盖：

- inspect 链节点顺序
- click 链节点顺序
- top/supporting/symptom 对应节点状态
- `relatedRuleCodes` 聚合
- `evidenceRefs` 聚合
- 无结论时的默认健康/待确认节点

---

## `src/modules/diagnosis/__tests__/domino-chain-builder.spec.ts`

```ts
import { DominoChainBuilder } from '../domain/builders/domino-chain.builder';
import { DiagnosisContext } from '../domain/models/diagnosis-context.model';
import { RuleFinding } from '../domain/models/rule-finding.model';
import { DiagnosisConclusion } from '../domain/models/diagnosis-conclusion.model';

describe('DominoChainBuilder', () => {
  let builder: DominoChainBuilder;

  const buildContext = (
    overrides: Partial<DiagnosisContext> = {},
  ): DiagnosisContext =>
    ({
      diagnosisId: 'diag_domino_test',
      mode: 'inspect_diagnosis',
      fallbackTokens: ['--', '-', '暂无', 'N/A', ''],
      evidenceRefs: [],
      ...overrides,
    }) as DiagnosisContext;

  const buildFinding = (
    overrides: Partial<RuleFinding> = {},
  ): RuleFinding => ({
    ruleCode: 'R999',
    title: 'test finding',
    diagnosisLabel: 'test diagnosis',
    category: 'test',
    severity: 'medium',
    confidence: 0.8,
    layer: 'render',
    cluster: 'default_cluster',
    summary: 'test summary',
    evidenceRefs: [],
    suggestions: [],
    isSymptomOnly: false,
    ...overrides,
  });

  const buildConclusion = (
    overrides: Partial<DiagnosisConclusion> = {},
  ): DiagnosisConclusion =>
    ({
      topFinding: null,
      supportingFindings: [],
      symptomFindings: [],
      diagnosisState: 'probable_root_cause',
      summary: '',
      repairHints: [],
      scoreBreakdown: [],
      ...overrides,
    }) as DiagnosisConclusion;

  beforeEach(() => {
    builder = new DominoChainBuilder();
  });

  it('should build inspect mode domino chain with expected node order', () => {
    const chain = builder.build(buildConclusion(), buildContext());

    expect(chain.mode).toBe('inspect_diagnosis');
    expect(chain.nodes.map((node) => node.type)).toEqual([
      'response',
      'state',
      'selector',
      'render',
      'dom',
      'ui',
    ]);
  });

  it('should build click mode domino chain with expected node order', () => {
    const chain = builder.build(
      buildConclusion(),
      buildContext({
        mode: 'click_diagnosis',
      }),
    );

    expect(chain.mode).toBe('click_diagnosis');
    expect(chain.nodes.map((node) => node.type)).toEqual([
      'interaction',
      'request',
      'response',
      'state',
      'render',
      'dom',
      'ui',
    ]);
  });

  it('should mark topFinding node as root cause and broken', () => {
    const conclusion = buildConclusion({
      topFinding: buildFinding({
        ruleCode: 'R101',
        layer: 'api',
        diagnosisLabel: '接口字段缺失',
        evidenceRefs: ['ev_api_1', 'ev_api_2'],
      }),
    });

    const chain = builder.build(conclusion, buildContext());
    const responseNode = chain.nodes.find((node) => node.type === 'response');

    expect(responseNode).toBeDefined();
    expect(responseNode?.status).toBe('broken');
    expect(responseNode?.isRootCause).toBe(true);
    expect(responseNode?.relatedRuleCodes).toContain('R101');
    expect(responseNode?.evidenceRefs).toEqual(['ev_api_1', 'ev_api_2']);
  });

  it('should map state-layer supporting finding to state node as suspect', () => {
    const conclusion = buildConclusion({
      topFinding: buildFinding({
        ruleCode: 'R101',
        layer: 'api',
      }),
      supportingFindings: [
        buildFinding({
          ruleCode: 'R103',
          layer: 'state',
          diagnosisLabel: '请求成功但状态未更新',
          evidenceRefs: ['ev_state_1'],
        }),
      ],
    });

    const chain = builder.build(conclusion, buildContext());
    const stateNode = chain.nodes.find((node) => node.type === 'state');

    expect(stateNode).toBeDefined();
    expect(stateNode?.status).toBe('suspect');
    expect(stateNode?.isSupporting).toBe(true);
    expect(stateNode?.relatedRuleCodes).toContain('R103');
    expect(stateNode?.evidenceRefs).toContain('ev_state_1');
  });

  it('should map symptom finding to ui node as symptom', () => {
    const conclusion = buildConclusion({
      symptomFindings: [
        buildFinding({
          ruleCode: 'R501',
          layer: 'ui',
          isSymptomOnly: true,
          diagnosisLabel: '页面显示占位值',
          evidenceRefs: ['ev_ui_1'],
        }),
      ],
    });

    const chain = builder.build(conclusion, buildContext());
    const uiNode = chain.nodes.find((node) => node.type === 'ui');

    expect(uiNode).toBeDefined();
    expect(uiNode?.status).toBe('symptom');
    expect(uiNode?.isSymptom).toBe(true);
    expect(uiNode?.relatedRuleCodes).toContain('R501');
    expect(uiNode?.evidenceRefs).toContain('ev_ui_1');
  });

  it('should aggregate rule codes from top, supporting and symptom findings onto different nodes', () => {
    const conclusion = buildConclusion({
      topFinding: buildFinding({
        ruleCode: 'R201',
        layer: 'render',
        evidenceRefs: ['ev_render_root'],
      }),
      supportingFindings: [
        buildFinding({
          ruleCode: 'R302',
          layer: 'dom',
          evidenceRefs: ['ev_dom_support'],
        }),
      ],
      symptomFindings: [
        buildFinding({
          ruleCode: 'R501',
          layer: 'ui',
          isSymptomOnly: true,
          evidenceRefs: ['ev_ui_symptom'],
        }),
      ],
    });

    const chain = builder.build(conclusion, buildContext());

    expect(chain.nodes.find((node) => node.type === 'render')?.relatedRuleCodes).toContain(
      'R201',
    );
    expect(chain.nodes.find((node) => node.type === 'dom')?.relatedRuleCodes).toContain(
      'R302',
    );
    expect(chain.nodes.find((node) => node.type === 'ui')?.relatedRuleCodes).toContain(
      'R501',
    );
  });

  it('should dedupe evidence refs on the same node', () => {
    const conclusion = buildConclusion({
      supportingFindings: [
        buildFinding({
          ruleCode: 'R103',
          layer: 'state',
          evidenceRefs: ['ev1', 'ev2'],
        }),
        buildFinding({
          ruleCode: 'R104',
          layer: 'state',
          evidenceRefs: ['ev2', 'ev3'],
        }),
      ],
    });

    const chain = builder.build(conclusion, buildContext());
    const stateNode = chain.nodes.find((node) => node.type === 'state');

    expect(stateNode?.evidenceRefs).toEqual(['ev1', 'ev2', 'ev3']);
  });

  it('should keep node healthy when no finding maps to that node', () => {
    const conclusion = buildConclusion({
      topFinding: buildFinding({
        ruleCode: 'R101',
        layer: 'api',
      }),
    });

    const chain = builder.build(conclusion, buildContext());
    const renderNode = chain.nodes.find((node) => node.type === 'render');

    expect(renderNode).toBeDefined();
    expect(renderNode?.status).toBe('healthy');
    expect(renderNode?.relatedRuleCodes).toEqual([]);
    expect(renderNode?.evidenceRefs).toEqual([]);
  });

  it('should mark interaction node broken for click root cause rule', () => {
    const conclusion = buildConclusion({
      topFinding: buildFinding({
        ruleCode: 'R401',
        layer: 'handler',
        diagnosisLabel: '点击后 handler 未启动',
        evidenceRefs: ['ev_click_1'],
      }),
    });

    const chain = builder.build(
      conclusion,
      buildContext({
        mode: 'click_diagnosis',
      }),
    );

    const interactionNode = chain.nodes.find(
      (node) => node.type === 'interaction',
    );

    expect(interactionNode).toBeDefined();
    expect(interactionNode?.status).toBe('broken');
    expect(interactionNode?.isRootCause).toBe(true);
    expect(interactionNode?.relatedRuleCodes).toContain('R401');
  });

  it('should map request-layer finding to request node in click mode', () => {
    const conclusion = buildConclusion({
      topFinding: buildFinding({
        ruleCode: 'R402',
        layer: 'request',
        diagnosisLabel: 'handler 执行但 request 未发送',
        evidenceRefs: ['ev_request_1'],
      }),
    });

    const chain = builder.build(
      conclusion,
      buildContext({
        mode: 'click_diagnosis',
      }),
    );

    const requestNode = chain.nodes.find((node) => node.type === 'request');

    expect(requestNode).toBeDefined();
    expect(requestNode?.status).toBe('broken');
    expect(requestNode?.relatedRuleCodes).toContain('R402');
    expect(requestNode?.evidenceRefs).toEqual(['ev_request_1']);
  });

  it('should merge multiple findings onto same node with status priority broken > suspect > symptom > healthy', () => {
    const conclusion = buildConclusion({
      topFinding: buildFinding({
        ruleCode: 'R302',
        layer: 'dom',
        evidenceRefs: ['ev_root'],
      }),
      supportingFindings: [
        buildFinding({
          ruleCode: 'R301',
          layer: 'dom',
          evidenceRefs: ['ev_support'],
        }),
      ],
      symptomFindings: [
        buildFinding({
          ruleCode: 'R502',
          layer: 'dom',
          isSymptomOnly: true,
          evidenceRefs: ['ev_symptom'],
        }),
      ],
    });

    const chain = builder.build(conclusion, buildContext());
    const domNode = chain.nodes.find((node) => node.type === 'dom');

    expect(domNode).toBeDefined();
    expect(domNode?.status).toBe('broken');
    expect(domNode?.isRootCause).toBe(true);
    expect(domNode?.isSupporting).toBe(true);
    expect(domNode?.isSymptom).toBe(true);
    expect(domNode?.relatedRuleCodes).toEqual(['R302', 'R301', 'R502']);
    expect(domNode?.evidenceRefs).toEqual(['ev_root', 'ev_support', 'ev_symptom']);
  });
});
```

---

# 4. 这份单测默认要求的 builder 行为

上面这份 spec 隐含要求你的 `DominoChainBuilder` 至少具备这些能力：

---

## 4.1 按 mode 输出固定骨牌链

### inspect
```ts
response -> state -> selector -> render -> dom -> ui
```

### click
```ts
interaction -> request -> response -> state -> render -> dom -> ui
```

---

## 4.2 把 finding 的 layer 映射到 node.type
比如建议映射关系：

```ts
api / response -> response
state -> state
selector -> selector
render -> render
dom -> dom
ui -> ui
handler / interaction -> interaction
request -> request
request_to_ui -> request
```

> 这里 `request_to_ui` 你也可以映射到 `request` 或 `ui`，但要统一。  
我更建议先映射到 `request`，因为它表示的是“请求前后链路断裂”。

---

## 4.3 同一节点支持多 finding 聚合
包括：

- `relatedRuleCodes`
- `evidenceRefs`
- `isRootCause`
- `isSupporting`
- `isSymptom`
- `status` 优先级合并

优先级推荐：

```ts
broken > suspect > symptom > healthy
```

---

# 5. 集成测试版

这里不 mock builder 依赖，直接喂入接近真实的 `DiagnosisConclusion`。  
重点看整体输出是否合理。

---

## `src/modules/diagnosis/__tests__/integration/domino-chain-builder.integration.spec.ts`

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { DominoChainBuilder } from '../../domain/builders/domino-chain.builder';
import { DiagnosisContext } from '../../domain/models/diagnosis-context.model';
import { RuleFinding } from '../../domain/models/rule-finding.model';
import { DiagnosisConclusion } from '../../domain/models/diagnosis-conclusion.model';

describe('DominoChainBuilder Integration', () => {
  let builder: DominoChainBuilder;

  const buildContext = (
    overrides: Partial<DiagnosisContext> = {},
  ): DiagnosisContext =>
    ({
      diagnosisId: 'diag_domino_integration',
      mode: 'inspect_diagnosis',
      fallbackTokens: ['--', '-', '暂无', 'N/A', ''],
      evidenceRefs: [],
      ...overrides,
    }) as DiagnosisContext;

  const buildFinding = (
    overrides: Partial<RuleFinding> = {},
  ): RuleFinding => ({
    ruleCode: 'R999',
    title: 'test finding',
    diagnosisLabel: 'test diagnosis',
    category: 'test',
    severity: 'medium',
    confidence: 0.8,
    layer: 'render',
    cluster: 'default_cluster',
    summary: 'test summary',
    evidenceRefs: [],
    suggestions: [],
    isSymptomOnly: false,
    ...overrides,
  });

  const buildConclusion = (
    overrides: Partial<DiagnosisConclusion> = {},
  ): DiagnosisConclusion =>
    ({
      topFinding: null,
      supportingFindings: [],
      symptomFindings: [],
      diagnosisState: 'probable_root_cause',
      summary: '',
      repairHints: [],
      scoreBreakdown: [],
      ...overrides,
    }) as DiagnosisConclusion;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DominoChainBuilder],
    }).compile();

    builder = module.get(DominoChainBuilder);
  });

  it('should build inspect domino chain showing upstream root cause and downstream symptom path', () => {
    const conclusion = buildConclusion({
      topFinding: buildFinding({
        ruleCode: 'R101',
        diagnosisLabel: '接口字段缺失',
        layer: 'api',
        evidenceRefs: ['ev_api_1', 'ev_api_2'],
      }),
      supportingFindings: [
        buildFinding({
          ruleCode: 'R103',
          diagnosisLabel: '请求成功但状态未更新',
          layer: 'state',
          evidenceRefs: ['ev_state_1'],
        }),
        buildFinding({
          ruleCode: 'R202',
          diagnosisLabel: 'formatter 输出占位值',
          layer: 'render',
          evidenceRefs: ['ev_render_1'],
        }),
      ],
      symptomFindings: [
        buildFinding({
          ruleCode: 'R501',
          diagnosisLabel: '页面显示占位值',
          layer: 'ui',
          isSymptomOnly: true,
          evidenceRefs: ['ev_ui_1'],
        }),
      ],
    });

    const chain = builder.build(conclusion, buildContext());

    expect(chain.mode).toBe('inspect_diagnosis');
    expect(chain.nodes.map((node) => node.type)).toEqual([
      'response',
      'state',
      'selector',
      'render',
      'dom',
      'ui',
    ]);

    expect(chain.nodes.find((node) => node.type === 'response')).toMatchObject({
      status: 'broken',
      isRootCause: true,
      relatedRuleCodes: ['R101'],
    });

    expect(chain.nodes.find((node) => node.type === 'state')).toMatchObject({
      status: 'suspect',
      isSupporting: true,
      relatedRuleCodes: ['R103'],
    });

    expect(chain.nodes.find((node) => node.type === 'render')).toMatchObject({
      status: 'suspect',
      isSupporting: true,
      relatedRuleCodes: ['R202'],
    });

    expect(chain.nodes.find((node) => node.type === 'ui')).toMatchObject({
      status: 'symptom',
      isSymptom: true,
      relatedRuleCodes: ['R501'],
    });
  });

  it('should build click domino chain showing interaction/request break before downstream nodes', () => {
    const conclusion = buildConclusion({
      topFinding: buildFinding({
        ruleCode: 'R402',
        diagnosisLabel: 'handler 执行但 request 未发送',
        layer: 'request',
        evidenceRefs: ['ev_req_1'],
      }),
      symptomFindings: [
        buildFinding({
          ruleCode: 'R503',
          diagnosisLabel: '请求前链路中断',
          layer: 'request_to_ui',
          isSymptomOnly: true,
          evidenceRefs: ['ev_gap_1'],
        }),
        buildFinding({
          ruleCode: 'R501',
          diagnosisLabel: '页面显示占位值',
          layer: 'ui',
          isSymptomOnly: true,
          evidenceRefs: ['ev_ui_1'],
        }),
      ],
    });

    const chain = builder.build(
      conclusion,
      buildContext({
        mode: 'click_diagnosis',
      }),
    );

    expect(chain.mode).toBe('click_diagnosis');
    expect(chain.nodes.map((node) => node.type)).toEqual([
      'interaction',
      'request',
      'response',
      'state',
      'render',
      'dom',
      'ui',
    ]);

    expect(chain.nodes.find((node) => node.type === 'request')).toMatchObject({
      status: 'broken',
      isRootCause: true,
    });

    expect(chain.nodes.find((node) => node.type === 'ui')).toMatchObject({
      status: 'symptom',
      isSymptom: true,
      relatedRuleCodes: ['R501'],
    });
  });

  it('should keep unrelated nodes healthy in a focused single-point failure scenario', () => {
    const conclusion = buildConclusion({
      topFinding: buildFinding({
        ruleCode: 'R302',
        diagnosisLabel: 'DOM 未反映最新渲染结果',
        layer: 'dom',
        evidenceRefs: ['ev_dom_1'],
      }),
    });

    const chain = builder.build(conclusion, buildContext());

    expect(chain.nodes.find((node) => node.type === 'response')).toMatchObject({
      status: 'healthy',
      relatedRuleCodes: [],
    });

    expect(chain.nodes.find((node) => node.type === 'render')).toMatchObject({
      status: 'healthy',
      relatedRuleCodes: [],
    });

    expect(chain.nodes.find((node) => node.type === 'dom')).toMatchObject({
      status: 'broken',
      isRootCause: true,
      relatedRuleCodes: ['R302'],
    });
  });

  it('should aggregate same-node findings into one domino node in inspect mode', () => {
    const conclusion = buildConclusion({
      topFinding: buildFinding({
        ruleCode: 'R201',
        diagnosisLabel: '合法值被判空吞掉',
        layer: 'render',
        evidenceRefs: ['ev1'],
      }),
      supportingFindings: [
        buildFinding({
          ruleCode: 'R202',
          diagnosisLabel: 'formatter 输出占位值',
          layer: 'render',
          evidenceRefs: ['ev2'],
        }),
      ],
      symptomFindings: [
        buildFinding({
          ruleCode: 'R502',
          diagnosisLabel: 'render 与 DOM 不一致',
          layer: 'dom',
          isSymptomOnly: true,
          evidenceRefs: ['ev3'],
        }),
      ],
    });

    const chain = builder.build(conclusion, buildContext());

    expect(chain.nodes.find((node) => node.type === 'render')).toMatchObject({
      status: 'broken',
      isRootCause: true,
      isSupporting: true,
      relatedRuleCodes: ['R201', 'R202'],
      evidenceRefs: ['ev1', 'ev2'],
    });

    expect(chain.nodes.find((node) => node.type === 'dom')).toMatchObject({
      status: 'symptom',
      isSymptom: true,
      relatedRuleCodes: ['R502'],
      evidenceRefs: ['ev3'],
    });
  });
});
```

---

# 6. 我建议你的 `DominoChainBuilder` 最少长这样

为了让上面的测试能落地，你的 builder 可以按这个骨架实现。

---

## builder 骨架示意

```ts
import { Injectable } from '@nestjs/common';
import { DiagnosisContext } from '../models/diagnosis-context.model';
import { DiagnosisConclusion } from '../models/diagnosis-conclusion.model';

type DominoStatus = 'healthy' | 'suspect' | 'broken' | 'symptom';

interface DominoNode {
  id: string;
  type:
    | 'interaction'
    | 'request'
    | 'response'
    | 'state'
    | 'selector'
    | 'render'
    | 'dom'
    | 'ui';
  label: string;
  status: DominoStatus;
  layer?: string;
  relatedRuleCodes: string[];
  evidenceRefs: string[];
  isRootCause?: boolean;
  isSupporting?: boolean;
  isSymptom?: boolean;
}

@Injectable()
export class DominoChainBuilder {
  build(conclusion: DiagnosisConclusion, context: DiagnosisContext) {
    const nodes = this.createBaseNodes(context.mode);

    if (conclusion.topFinding) {
      this.applyFinding(nodes, conclusion.topFinding, 'root');
    }

    for (const item of conclusion.supportingFindings ?? []) {
      this.applyFinding(nodes, item, 'supporting');
    }

    for (const item of conclusion.symptomFindings ?? []) {
      this.applyFinding(nodes, item, 'symptom');
    }

    return {
      mode: context.mode,
      nodes,
    };
  }

  private createBaseNodes(mode: string): DominoNode[] {
    if (mode === 'click_diagnosis') {
      return [
        this.node('interaction', '用户交互'),
        this.node('request', '请求发送'),
        this.node('response', '接口响应'),
        this.node('state', '状态更新'),
        this.node('render', '渲染计算'),
        this.node('dom', 'DOM 更新'),
        this.node('ui', '页面展示'),
      ];
    }

    return [
      this.node('response', '接口响应'),
      this.node('state', '状态更新'),
      this.node('selector', '数据选择'),
      this.node('render', '渲染计算'),
      this.node('dom', 'DOM 更新'),
      this.node('ui', '页面展示'),
    ];
  }

  private node(type: DominoNode['type'], label: string): DominoNode {
    return {
      id: type,
      type,
      label,
      status: 'healthy',
      relatedRuleCodes: [],
      evidenceRefs: [],
    };
  }

  private applyFinding(
    nodes: DominoNode[],
    finding: any,
    role: 'root' | 'supporting' | 'symptom',
  ) {
    const targetType = this.mapLayerToNodeType(finding.layer);
    const node = nodes.find((item) => item.type === targetType);

    if (!node) return;

    if (!node.relatedRuleCodes.includes(finding.ruleCode)) {
      node.relatedRuleCodes.push(finding.ruleCode);
    }

    for (const ref of finding.evidenceRefs ?? []) {
      if (!node.evidenceRefs.includes(ref)) {
        node.evidenceRefs.push(ref);
      }
    }

    if (role === 'root') {
      node.isRootCause = true;
      node.status = this.mergeStatus(node.status, 'broken');
    } else if (role === 'supporting') {
      node.isSupporting = true;
      node.status = this.mergeStatus(node.status, 'suspect');
    } else {
      node.isSymptom = true;
      node.status = this.mergeStatus(node.status, 'symptom');
    }
  }

  private mapLayerToNodeType(layer?: string): DominoNode['type'] {
    switch (layer) {
      case 'api':
      case 'response':
        return 'response';
      case 'state':
        return 'state';
      case 'selector':
        return 'selector';
      case 'render':
        return 'render';
      case 'dom':
        return 'dom';
      case 'ui':
        return 'ui';
      case 'handler':
      case 'interaction':
        return 'interaction';
      case 'request':
      case 'request_to_ui':
        return 'request';
      default:
        return 'ui';
    }
  }

  private mergeStatus(current: DominoStatus, incoming: DominoStatus): DominoStatus {
    const priority: Record<DominoStatus, number> = {
      healthy: 0,
      symptom: 1,
      suspect: 2,
      broken: 3,
    };

    return priority[incoming] > priority[current] ? incoming : current;
  }
}
```

---

# 7. 这组测试的真正价值

这套 `DominoChainBuilder` 测试不是只验证“有输出”，而是在保护你的差异化表达能力：

---

## 7.1 保护“多米诺骨牌式因果链”
确保链条固定，节点位置稳定，前端才能做动画和链路对比。

---

## 7.2 保护“根因 / 支撑 / 症状”三层表达
- 根因：`broken`
- supporting：`suspect`
- symptom：`symptom`

这对工作台展示非常关键。

---

## 7.3 保护“同节点聚合”
一个节点可能同时承载：
- 根因
- supporting
- symptom

不能拆散，不然前端表达会乱。

---

## 7.4 保护“上游根因、下游现象”的可视化路径
尤其是 inspect 场景里：
- `response` broken
- `state/render` suspect
- `ui` symptom

这就是你产品最核心的因果链展示价值。

---

# 8. 下一步最推荐继续补什么

现在诊断主链你已经基本补完了：

- Rule unit tests
- RuleEngine unit / integration
- Ranking unit / integration
- Conclusion unit / integration
- DominoChainBuilder unit / integration

接下来最自然的两个方向：

### A. `ExplanationBuilder` 的升级版 Jest / 集成测试
验证：
- 根因摘要
- 证据叙事
- 处理建议
- 症状补充说明

### B. `DiagnosisQueryService` 的端到端编排测试
验证：
- lazy execution
- repository cache
- context builder / rule engine / ranking / conclusion / explanation / domino 串联结果

---

如果按你现在推进顺序，我建议下一条直接做：  
**ExplanationBuilder 的升级版 Jest / 集成测试**。