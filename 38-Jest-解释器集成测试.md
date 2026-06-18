下面直接给你 **`ExplanationBuilder` 的升级版 Jest / 集成测试**。  
我继续按你现在这条 Diagnosis 主链来设计，目标还是：

- **可直接拷进 NestJS/Jest 工程**
- 覆盖 **summary / evidence narrative / operator advice**
- 兼容你前面已经拆好的：
  - `DiagnosisConclusionService`
  - `DominoChainBuilder`
  - `RankingService`

---

# 1. 先约定 `ExplanationBuilder` 的输出结构

为了让测试可写，先约定一个比较稳的输出模型。

## 推荐类型

```ts
export interface DiagnosisExplanation {
  summaryText: string;
  evidenceNarrative: string[];
  operatorAdvice: string[];
  symptomNotes: string[];
}
```

---

# 2. `ExplanationBuilder` 的职责边界

建议这个 builder 只负责把：

- `DiagnosisConclusion`
- `DiagnosisContext`

转成可展示解释文本，不负责再排序、不负责重新判定根因。

也就是：

- **结论是谁** → `DiagnosisConclusionService`
- **怎么给人读** → `ExplanationBuilder`

---

# 3. 建议文件位置

```bash
src/modules/diagnosis/__tests__/
├── explanation-builder.spec.ts
└── integration/
    └── explanation-builder.integration.spec.ts
```

---

# 4. 单测版

这里重点覆盖：

- 有 topFinding 时的 summary 生成
- supportingFindings 的证据叙事拼装
- symptomFindings 的补充说明
- repairHints 到 operatorAdvice 的映射
- 无根因时的兜底说明
- click / inspect 模式下文案差异

---

## `src/modules/diagnosis/__tests__/explanation-builder.spec.ts`

```ts
import { ExplanationBuilder } from '../domain/builders/explanation.builder';
import { DiagnosisContext } from '../domain/models/diagnosis-context.model';
import { DiagnosisConclusion } from '../domain/models/diagnosis-conclusion.model';
import { RuleFinding } from '../domain/models/rule-finding.model';
import { DiagnosisState } from '../domain/enums/diagnosis-state.enum';

describe('ExplanationBuilder', () => {
  let builder: ExplanationBuilder;

  const buildContext = (
    overrides: Partial<DiagnosisContext> = {},
  ): DiagnosisContext =>
    ({
      diagnosisId: 'diag_explanation_test',
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
      diagnosisState: DiagnosisState.PROBABLE_ROOT_CAUSE,
      summary: '',
      repairHints: [],
      scoreBreakdown: [],
      ...overrides,
    }) as DiagnosisConclusion;

  beforeEach(() => {
    builder = new ExplanationBuilder();
  });

  it('should build summaryText from confirmed top finding', () => {
    const conclusion = buildConclusion({
      topFinding: buildFinding({
        ruleCode: 'R101',
        diagnosisLabel: '接口字段缺失',
        summary: '接口返回中缺少目标字段，导致下游无法取值。',
        confidence: 0.95,
      }),
      diagnosisState: DiagnosisState.CONFIRMED_ROOT_CAUSE,
    });

    const result = builder.build(conclusion, buildContext());

    expect(result.summaryText).toBe(
      '已确认根因：接口字段缺失。接口返回中缺少目标字段，导致下游无法取值。',
    );
  });

  it('should build summaryText from probable top finding', () => {
    const conclusion = buildConclusion({
      topFinding: buildFinding({
        ruleCode: 'R302',
        diagnosisLabel: 'DOM 未反映最新渲染结果',
        summary: '渲染结果已生成，但 DOM 未同步更新。',
        confidence: 0.84,
      }),
      diagnosisState: DiagnosisState.PROBABLE_ROOT_CAUSE,
    });

    const result = builder.build(conclusion, buildContext());

    expect(result.summaryText).toBe(
      '高概率根因：DOM 未反映最新渲染结果。渲染结果已生成，但 DOM 未同步更新。',
    );
  });

  it('should build insufficient evidence summary when diagnosisState is insufficient_evidence', () => {
    const conclusion = buildConclusion({
      diagnosisState: DiagnosisState.INSUFFICIENT_EVIDENCE,
    });

    const result = builder.build(
      conclusion,
      buildContext({
        responseSuccess: false,
        storeUpdated: false,
        renderTriggered: false,
      }),
    );

    expect(result.summaryText).toBe('当前证据不足，暂时无法确认明确根因。');
  });

  it('should build no-rule-matched summary when diagnosisState is no_rule_matched', () => {
    const conclusion = buildConclusion({
      diagnosisState: DiagnosisState.NO_RULE_MATCHED,
    });

    const result = builder.build(conclusion, buildContext());

    expect(result.summaryText).toBe('现有规则未识别出明确异常，可继续补充上下文后再次诊断。');
  });

  it('should build evidenceNarrative including top finding first', () => {
    const conclusion = buildConclusion({
      topFinding: buildFinding({
        ruleCode: 'R101',
        diagnosisLabel: '接口字段缺失',
        summary: '接口返回中缺少 response.data.amount。',
        evidenceRefs: ['ev_api_1', 'ev_api_2'],
      }),
      supportingFindings: [
        buildFinding({
          ruleCode: 'R103',
          diagnosisLabel: '请求成功但状态未更新',
          summary: '请求已成功，但 store 未写入最新值。',
          evidenceRefs: ['ev_state_1'],
        }),
      ],
    });

    const result = builder.build(conclusion, buildContext());

    expect(result.evidenceNarrative).toEqual([
      '核心证据：接口字段缺失。接口返回中缺少 response.data.amount。证据引用: ev_api_1, ev_api_2。',
      '辅助证据：请求成功但状态未更新。请求已成功，但 store 未写入最新值。证据引用: ev_state_1。',
    ]);
  });

  it('should include multiple supporting findings in evidenceNarrative', () => {
    const conclusion = buildConclusion({
      topFinding: buildFinding({
        ruleCode: 'R201',
        diagnosisLabel: '合法值被判空吞掉',
        summary: '值为 0，但 formatter 使用了 falsy 判定。',
      }),
      supportingFindings: [
        buildFinding({
          ruleCode: 'R202',
          diagnosisLabel: 'formatter 输出占位值',
          summary: 'formatter 最终输出了占位值 --。',
        }),
        buildFinding({
          ruleCode: 'R501',
          diagnosisLabel: '页面显示占位值',
          summary: '页面最终展示为 --。',
          isSymptomOnly: true,
        }),
      ],
    });

    const result = builder.build(conclusion, buildContext());

    expect(result.evidenceNarrative[0]).toContain('核心证据：合法值被判空吞掉');
    expect(result.evidenceNarrative[1]).toContain('辅助证据：formatter 输出占位值');
    expect(result.evidenceNarrative[2]).toContain('辅助证据：页面显示占位值');
  });

  it('should build symptomNotes from symptomFindings', () => {
    const conclusion = buildConclusion({
      symptomFindings: [
        buildFinding({
          ruleCode: 'R501',
          diagnosisLabel: '页面显示占位值',
          summary: '页面展示为 --。',
          isSymptomOnly: true,
        }),
        buildFinding({
          ruleCode: 'R502',
          diagnosisLabel: 'render 与 DOM 不一致',
          summary: 'render 输出与 DOM 文本不一致。',
          isSymptomOnly: true,
        }),
      ],
    });

    const result = builder.build(conclusion, buildContext());

    expect(result.symptomNotes).toEqual([
      '观察到症状：页面显示占位值。页面展示为 --。',
      '观察到症状：render 与 DOM 不一致。render 输出与 DOM 文本不一致。',
    ]);
  });

  it('should map repairHints into operatorAdvice with stable order', () => {
    const conclusion = buildConclusion({
      repairHints: [
        '检查接口返回字段路径',
        '检查字段映射路径配置',
        '检查 dispatch/commit 是否执行',
      ],
    });

    const result = builder.build(conclusion, buildContext());

    expect(result.operatorAdvice).toEqual([
      '建议处理：检查接口返回字段路径',
      '建议处理：检查字段映射路径配置',
      '建议处理：检查 dispatch/commit 是否执行',
    ]);
  });

  it('should fallback operatorAdvice when repairHints is empty and evidence is insufficient', () => {
    const conclusion = buildConclusion({
      diagnosisState: DiagnosisState.INSUFFICIENT_EVIDENCE,
      repairHints: [],
    });

    const result = builder.build(
      conclusion,
      buildContext({
        responseSuccess: false,
        storeUpdated: false,
        renderTriggered: false,
      }),
    );

    expect(result.operatorAdvice).toEqual([
      '建议先补充接口响应证据。',
      '建议补充状态更新轨迹。',
      '建议补充渲染或 DOM 快照。',
    ]);
  });

  it('should build click-mode summary with interaction wording', () => {
    const conclusion = buildConclusion({
      topFinding: buildFinding({
        ruleCode: 'R402',
        diagnosisLabel: 'handler 执行但 request 未发送',
        summary: '点击事件已进入处理函数，但未发出请求。',
        confidence: 0.91,
      }),
      diagnosisState: DiagnosisState.CONFIRMED_ROOT_CAUSE,
    });

    const result = builder.build(
      conclusion,
      buildContext({
        mode: 'click_diagnosis',
      }),
    );

    expect(result.summaryText).toBe(
      '已确认点击链路根因：handler 执行但 request 未发送。点击事件已进入处理函数，但未发出请求。',
    );
  });

  it('should omit evidence refs suffix when finding has no evidenceRefs', () => {
    const conclusion = buildConclusion({
      topFinding: buildFinding({
        ruleCode: 'R301',
        diagnosisLabel: 'DOM 被隐藏',
        summary: 'DOM 已更新，但当前节点不可见。',
        evidenceRefs: [],
      }),
    });

    const result = builder.build(conclusion, buildContext());

    expect(result.evidenceNarrative).toEqual([
      '核心证据：DOM 被隐藏。DOM 已更新，但当前节点不可见。',
    ]);
  });

  it('should fallback to diagnosisLabel when summary is empty', () => {
    const conclusion = buildConclusion({
      topFinding: buildFinding({
        ruleCode: 'R104',
        diagnosisLabel: 'selector 返回空值',
        summary: '',
      }),
      diagnosisState: DiagnosisState.PROBABLE_ROOT_CAUSE,
    });

    const result = builder.build(conclusion, buildContext());

    expect(result.summaryText).toBe('高概率根因：selector 返回空值。');
  });

  it('should keep evidenceNarrative empty when no findings exist', () => {
    const result = builder.build(
      buildConclusion({
        topFinding: null,
        supportingFindings: [],
        symptomFindings: [],
      }),
      buildContext(),
    );

    expect(result.evidenceNarrative).toEqual([]);
    expect(result.symptomNotes).toEqual([]);
  });
});
```

---

# 5. 单测覆盖的关键点

这版单测主要锁住：

---

## 5.1 summary 文案分层
- `CONFIRMED_ROOT_CAUSE`
- `PROBABLE_ROOT_CAUSE`
- `INSUFFICIENT_EVIDENCE`
- `NO_RULE_MATCHED`

---

## 5.2 evidence narrative 结构
- top finding 一定先出
- supporting 后出
- 有 `evidenceRefs` 才拼证据引用
- 没有就不加尾巴

---

## 5.3 symptomNotes 单独输出
这点很重要，因为你前面的结论结构已经区分了：

- 根因
- supporting
- symptom

builder 不应该把 symptom 混进 summary 主叙事里。

---

## 5.4 operatorAdvice 的兜底逻辑
如果没有 `repairHints`，builder 至少给操作员一个“下一步应该补什么证据”的建议。

---

# 6. 集成测试版

这里建议走 **真实 `DiagnosisConclusionService` + 真实 `RankingService` + `ExplanationBuilder`**。  
这样可以测试：

- 排序结果会不会影响 explanation 主叙事
- 同一个诊断输入，最终 explanation 输出是否稳定

---

## `src/modules/diagnosis/__tests__/integration/explanation-builder.integration.spec.ts`

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { RankingService } from '../../domain/services/ranking.service';
import { DiagnosisConclusionService } from '../../domain/services/diagnosis-conclusion.service';
import { ExplanationBuilder } from '../../domain/builders/explanation.builder';
import { DiagnosisContext } from '../../domain/models/diagnosis-context.model';
import { RuleFinding } from '../../domain/models/rule-finding.model';
import { DiagnosisState } from '../../domain/enums/diagnosis-state.enum';

describe('ExplanationBuilder Integration', () => {
  let conclusionService: DiagnosisConclusionService;
  let explanationBuilder: ExplanationBuilder;

  const buildContext = (
    overrides: Partial<DiagnosisContext> = {},
  ): DiagnosisContext =>
    ({
      diagnosisId: 'diag_explanation_integration',
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RankingService, DiagnosisConclusionService, ExplanationBuilder],
    }).compile();

    conclusionService = module.get(DiagnosisConclusionService);
    explanationBuilder = module.get(ExplanationBuilder);
  });

  it('should build explanation using upstream root cause as primary narrative in mixed inspect scenario', () => {
    const findings: RuleFinding[] = [
      buildFinding({
        ruleCode: 'R501',
        diagnosisLabel: '页面显示占位值',
        summary: '页面最终显示为 --。',
        confidence: 0.8,
        layer: 'ui',
        cluster: 'fallback_displayed',
        isSymptomOnly: true,
        suggestions: ['继续检查上游链路'],
      }),
      buildFinding({
        ruleCode: 'R202',
        diagnosisLabel: 'formatter 输出占位值',
        summary: 'formatter 将输入值转换成了占位值。',
        confidence: 0.88,
        layer: 'render',
        cluster: 'formatter_cluster',
        isSymptomOnly: false,
        suggestions: ['检查 formatter fallback 逻辑'],
      }),
      buildFinding({
        ruleCode: 'R101',
        diagnosisLabel: '接口字段缺失',
        summary: '接口响应中缺少 response.data.amount。',
        confidence: 0.95,
        layer: 'api',
        cluster: 'api_field_missing',
        isSymptomOnly: false,
        evidenceRefs: ['ev_api_1', 'ev_api_2', 'ev_api_3'],
        suggestions: ['检查接口返回字段路径'],
      }),
    ];

    const context = buildContext();
    const conclusion = conclusionService.conclude(findings, context);
    const explanation = explanationBuilder.build(conclusion, context);

    expect(conclusion.topFinding?.ruleCode).toBe('R101');
    expect(conclusion.diagnosisState).toBe(DiagnosisState.CONFIRMED_ROOT_CAUSE);

    expect(explanation.summaryText).toContain('已确认根因：接口字段缺失');
    expect(explanation.evidenceNarrative[0]).toContain('核心证据：接口字段缺失');
    expect(explanation.evidenceNarrative[1]).toContain('辅助证据');
    expect(explanation.symptomNotes[0]).toContain('观察到症状：页面显示占位值');
    expect(explanation.operatorAdvice).toContain('建议处理：检查接口返回字段路径');
  });

  it('should build probable explanation when dom-layer root cause ranks first but confidence is below 0.9', () => {
    const findings: RuleFinding[] = [
      buildFinding({
        ruleCode: 'R302',
        diagnosisLabel: 'DOM 未反映最新渲染结果',
        summary: 'render 已产出结果，但 DOM 未更新。',
        confidence: 0.84,
        layer: 'dom',
        cluster: 'dom_not_updated',
        isSymptomOnly: false,
        suggestions: ['检查 commit / DOM 更新链路'],
      }),
      buildFinding({
        ruleCode: 'R501',
        diagnosisLabel: '页面显示占位值',
        summary: '页面显示为 --。',
        confidence: 0.8,
        layer: 'ui',
        cluster: 'fallback_displayed',
        isSymptomOnly: true,
      }),
    ];

    const context = buildContext();
    const conclusion = conclusionService.conclude(findings, context);
    const explanation = explanationBuilder.build(conclusion, context);

    expect(conclusion.topFinding?.ruleCode).toBe('R302');
    expect(conclusion.diagnosisState).toBe(DiagnosisState.PROBABLE_ROOT_CAUSE);
    expect(explanation.summaryText).toContain('高概率根因：DOM 未反映最新渲染结果');
    expect(explanation.symptomNotes).toEqual([
      '观察到症状：页面显示占位值。页面显示为 --。',
    ]);
  });

  it('should build click-chain explanation with click-oriented wording', () => {
    const findings: RuleFinding[] = [
      buildFinding({
        ruleCode: 'R503',
        diagnosisLabel: '请求前链路中断',
        summary: '点击后流程未顺利推进到请求发送。',
        confidence: 0.78,
        layer: 'request_to_ui',
        cluster: 'pre_request_gap',
        isSymptomOnly: true,
      }),
      buildFinding({
        ruleCode: 'R402',
        diagnosisLabel: 'handler 执行但 request 未发送',
        summary: '点击事件进入 handler，但没有实际发出请求。',
        confidence: 0.91,
        layer: 'request',
        cluster: 'handler_started_request_not_sent',
        isSymptomOnly: false,
        suggestions: ['检查 handler 中请求触发条件'],
      }),
    ];

    const context = buildContext({
      mode: 'click_diagnosis',
    });

    const conclusion = conclusionService.conclude(findings, context);
    const explanation = explanationBuilder.build(conclusion, context);

    expect(conclusion.topFinding?.ruleCode).toBe('R402');
    expect(explanation.summaryText).toContain('已确认点击链路根因：handler 执行但 request 未发送');
    expect(explanation.evidenceNarrative[0]).toContain('核心证据：handler 执行但 request 未发送');
    expect(explanation.operatorAdvice).toContain('建议处理：检查 handler 中请求触发条件');
  });

  it('should build insufficient-evidence explanation when no findings exist', () => {
    const context = buildContext({
      responseSuccess: false,
      storeUpdated: false,
      renderTriggered: false,
    });

    const conclusion = conclusionService.conclude([], context);
    const explanation = explanationBuilder.build(conclusion, context);

    expect(conclusion.topFinding).toBeNull();
    expect(conclusion.diagnosisState).toBe(DiagnosisState.INSUFFICIENT_EVIDENCE);

    expect(explanation.summaryText).toBe('当前证据不足，暂时无法确认明确根因。');
    expect(explanation.evidenceNarrative).toEqual([]);
    expect(explanation.operatorAdvice).toEqual([
      '建议先补充接口响应证据。',
      '建议补充状态更新轨迹。',
      '建议补充渲染或 DOM 快照。',
    ]);
  });

  it('should build no-rule-matched explanation when evidence exists but no finding matches', () => {
    const context = buildContext({
      responseSuccess: true,
      storeUpdated: false,
      renderTriggered: false,
    });

    const conclusion = conclusionService.conclude([], context);
    const explanation = explanationBuilder.build(conclusion, context);

    expect(conclusion.diagnosisState).toBe(DiagnosisState.NO_RULE_MATCHED);
    expect(explanation.summaryText).toBe(
      '现有规则未识别出明确异常，可继续补充上下文后再次诊断。',
    );
    expect(explanation.evidenceNarrative).toEqual([]);
  });
});
```

---

# 7. 给你一个可直接落地的 `ExplanationBuilder` 骨架

如果你还没实现，我建议先用下面这个版本起步。

## `src/modules/diagnosis/domain/builders/explanation.builder.ts`

```ts
import { Injectable } from '@nestjs/common';
import { DiagnosisContext } from '../models/diagnosis-context.model';
import { DiagnosisConclusion } from '../models/diagnosis-conclusion.model';
import { RuleFinding } from '../models/rule-finding.model';
import { DiagnosisState } from '../enums/diagnosis-state.enum';

export interface DiagnosisExplanation {
  summaryText: string;
  evidenceNarrative: string[];
  operatorAdvice: string[];
  symptomNotes: string[];
}

@Injectable()
export class ExplanationBuilder {
  build(
    conclusion: DiagnosisConclusion,
    context: DiagnosisContext,
  ): DiagnosisExplanation {
    return {
      summaryText: this.buildSummaryText(conclusion, context),
      evidenceNarrative: this.buildEvidenceNarrative(conclusion),
      operatorAdvice: this.buildOperatorAdvice(conclusion, context),
      symptomNotes: this.buildSymptomNotes(conclusion),
    };
  }

  private buildSummaryText(
    conclusion: DiagnosisConclusion,
    context: DiagnosisContext,
  ): string {
    const top = conclusion.topFinding;

    if (conclusion.diagnosisState === DiagnosisState.INSUFFICIENT_EVIDENCE) {
      return '当前证据不足，暂时无法确认明确根因。';
    }

    if (conclusion.diagnosisState === DiagnosisState.NO_RULE_MATCHED) {
      return '现有规则未识别出明确异常，可继续补充上下文后再次诊断。';
    }

    if (!top) {
      return '当前暂无可解释的诊断结论。';
    }

    const detail = top.summary ? `${top.summary}` : '';
    const suffix = detail ? `。${detail}` : '。';

    if (context.mode === 'click_diagnosis') {
      if (conclusion.diagnosisState === DiagnosisState.CONFIRMED_ROOT_CAUSE) {
        return `已确认点击链路根因：${top.diagnosisLabel}${suffix}`;
      }

      return `高概率点击链路根因：${top.diagnosisLabel}${suffix}`;
    }

    if (conclusion.diagnosisState === DiagnosisState.CONFIRMED_ROOT_CAUSE) {
      return `已确认根因：${top.diagnosisLabel}${suffix}`;
    }

    return `高概率根因：${top.diagnosisLabel}${suffix}`;
  }

  private buildEvidenceNarrative(
    conclusion: DiagnosisConclusion,
  ): string[] {
    const result: string[] = [];

    if (conclusion.topFinding) {
      result.push(this.renderFindingNarrative('核心证据', conclusion.topFinding));
    }

    for (const item of conclusion.supportingFindings ?? []) {
      result.push(this.renderFindingNarrative('辅助证据', item));
    }

    return result;
  }

  private buildOperatorAdvice(
    conclusion: DiagnosisConclusion,
    context: DiagnosisContext,
  ): string[] {
    if (conclusion.repairHints?.length) {
      return conclusion.repairHints.map((item) => `建议处理：${item}`);
    }

    if (conclusion.diagnosisState === DiagnosisState.INSUFFICIENT_EVIDENCE) {
      return this.buildFallbackAdvice(context);
    }

    return [];
  }

  private buildSymptomNotes(
    conclusion: DiagnosisConclusion,
  ): string[] {
    return (conclusion.symptomFindings ?? []).map(
      (item) => `观察到症状：${item.diagnosisLabel}${item.summary ? `。${item.summary}` : '。'}`,
    );
  }

  private renderFindingNarrative(prefix: string, finding: RuleFinding): string {
    const base = `${prefix}：${finding.diagnosisLabel}${finding.summary ? `。${finding.summary}` : '。'}`;

    if (!finding.evidenceRefs?.length) {
      return base;
    }

    return `${base}证据引用: ${finding.evidenceRefs.join(', ')}。`;
  }

  private buildFallbackAdvice(context: DiagnosisContext): string[] {
    const tips: string[] = [];

    if (!context.responseSuccess) {
      tips.push('建议先补充接口响应证据。');
    }

    if (!context.storeUpdated) {
      tips.push('建议补充状态更新轨迹。');
    }

    if (!context.renderTriggered) {
      tips.push('建议补充渲染或 DOM 快照。');
    }

    return tips.length
      ? tips
      : ['建议补充更完整的链路证据后再次诊断。'];
  }
}
```

---

# 8. 我建议你再补两个边界测试

如果你要把这块做得更稳，我建议继续加这两个边界 case：

---

## 8.1 限制 evidence narrative 条数
比如只展示：

- 1 条核心证据
- 最多 3 条辅助证据

这样前端不会过长。

可补测试：

```ts
should limit supporting evidence narrative count to 3
```

---

## 8.2 symptomNotes 去重
当多个 symptom finding `diagnosisLabel` 一样时，可以考虑去重或合并。

可补测试：

```ts
should dedupe repeated symptom notes by ruleCode or diagnosisLabel
```

---

# 9. 到这里主链测试基本完整了

你现在已经把一条完整诊断链的测试骨架补得很完整：

- `RuleEngineService`
- 真实规则集 integration
- `RankingService`
- `DiagnosisConclusionService`
- `DominoChainBuilder`
- `ExplanationBuilder`

下一步最有价值的通常只剩两块：

---

## 方向 A：`DiagnosisQueryService` 端到端编排测试
重点验证：

- lazy execution
- repository cache
- 首次查询触发诊断
- 二次查询直接走缓存
- 各 builder/service 串联成功

---

## 方向 B：完整 Diagnosis 模块目录骨架 + 文件清单 + barrel exports
重点验证工程落地：
- module wiring
- provider 注入
- DTO / repository / service 目录落位
- test helpers 抽离

---

如果按你现在推进顺序，我建议下一条直接做：  
**DiagnosisQueryService 的端到端 / 集成测试骨架**。