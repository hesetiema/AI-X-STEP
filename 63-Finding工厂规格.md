下面直接给你两部分：

1. `build-rule-finding.spec.ts`
2. **剩余 matcher 化规则的 factory 版批量重构**

我会优先覆盖最值得统一的这些规则：

- `R203BffGatewayFailureRule`
- `R302DbConnectionExhaustedRule`
- `R401ExternalDependencyFailureRule`
- `R402ThirdPartyRateLimitRule`
- `R501UiLoadingSymptomRule`
- `R503UiEmptyStateSymptomRule`
- `R504UiRetryLoopSymptomRule`

这批做完后，你的 matcher 化 + finding factory 化主干就比较完整了。

---

# 一、`build-rule-finding.spec.ts`

## `test/unit/rule-engine/factories/build-rule-finding.spec.ts`

```ts
import { buildRuleFindingFromMatch } from '../../../../src/diagnosis/domain/rule-engine/factories/build-rule-finding';
import { buildDiagnosisContext } from '../../../helpers/diagnosis-context.fixture';

describe('buildRuleFindingFromMatch', () => {
  it('should build a RuleFinding with evidenceIds from matched evidence', () => {
    const context = buildDiagnosisContext({
      evidence: [
        {
          id: 'ev-1',
          type: 'network_error',
          label: 'POST /orders 500',
          value: { status: 500 },
          source: 'network-observer',
        },
        {
          id: 'ev-2',
          type: 'network_error',
          label: 'GET /orders 502',
          value: { status: 502 },
          source: 'network-observer',
        },
      ],
    });

    const finding = buildRuleFindingFromMatch({
      ruleCode: 'R201',
      ruleName: 'API 5xx indicates downstream instability',
      title: 'API 5xx root cause',
      summary:
        'Observed API 5xx response indicating backend/API-side instability.',
      confidence: 0.91,
      score: 91,
      layer: 'api',
      cluster: 'api_failure',
      severity: 'high',
      isSymptomOnly: false,
      matchedEvidence: context.evidence,
    });

    expect(finding.evidenceIds).toEqual(['ev-1', 'ev-2']);
  });

  it('should set matchedCount into detail by default', () => {
    const context = buildDiagnosisContext({
      evidence: [
        {
          id: 'ev-1',
          type: 'trace_span',
          label: 'db timeout on order query',
          value: { durationMs: 3200 },
          source: 'trace',
        },
      ],
    });

    const finding = buildRuleFindingFromMatch({
      ruleCode: 'R301',
      ruleName: 'DB timeout or latency spike',
      title: 'DB timeout supporting cause',
      summary:
        'Database timeout evidence suggests downstream persistence pressure.',
      confidence: 0.78,
      score: 78,
      layer: 'db',
      cluster: 'db_timeout',
      severity: 'high',
      isSymptomOnly: false,
      matchedEvidence: context.evidence,
    });

    expect(finding.detail).toEqual({
      matchedCount: 1,
    });
  });

  it('should merge custom detail with matchedCount', () => {
    const context = buildDiagnosisContext({
      evidence: [
        {
          id: 'ev-1',
          type: 'ui_state',
          label: 'error toast visible',
          value: { toastType: 'error' },
          source: 'frontend-sdk',
        },
      ],
    });

    const finding = buildRuleFindingFromMatch({
      ruleCode: 'R502',
      ruleName: 'Visible UI error toast/banner',
      title: 'UI error toast symptom',
      summary:
        'User-visible error toast/banner indicates a surfaced failure symptom in the UI layer.',
      confidence: 0.69,
      score: 69,
      layer: 'ui_state',
      cluster: 'ui_error_toast',
      severity: 'medium',
      isSymptomOnly: true,
      matchedEvidence: context.evidence,
      detail: {
        targetId: 'button-submit',
      },
    });

    expect(finding.detail).toEqual({
      matchedCount: 1,
      targetId: 'button-submit',
    });
  });

  it('should build nested rule meta consistently', () => {
    const context = buildDiagnosisContext({
      evidence: [
        {
          id: 'ev-1',
          type: 'network_error',
          label: 'third-party rate limited',
          value: { status: 429, external: true },
          source: 'network-observer',
        },
      ],
    });

    const finding = buildRuleFindingFromMatch({
      ruleCode: 'R402',
      ruleName: 'Third-party rate limit / 429',
      title: 'Third-party rate limit',
      summary:
        'Third-party provider is rate limiting requests, causing downstream failures or degraded UX.',
      confidence: 0.86,
      score: 86,
      layer: 'external',
      cluster: 'third_party_rate_limit',
      severity: 'high',
      isSymptomOnly: false,
      matchedEvidence: context.evidence,
    });

    expect(finding.rule).toEqual({
      code: 'R402',
      name: 'Third-party rate limit / 429',
      cluster: 'third_party_rate_limit',
      layer: 'external',
      severity: 'high',
      isSymptomOnly: false,
    });
  });

  it('should preserve isSymptomOnly on top-level and nested rule meta', () => {
    const context = buildDiagnosisContext({
      evidence: [
        {
          id: 'ev-1',
          type: 'ui_event',
          label: 'retry loop detected',
          value: { retryCount: 5, loop: true },
          source: 'frontend-sdk',
        },
      ],
    });

    const finding = buildRuleFindingFromMatch({
      ruleCode: 'R504',
      ruleName: 'Repeated UI retry loop',
      title: 'UI retry loop symptom',
      summary:
        'The UI is repeatedly retrying, indicating unstable upstream dependency or unresolved failure.',
      confidence: 0.71,
      score: 71,
      layer: 'ui_state',
      cluster: 'ui_retry_loop',
      severity: 'medium',
      isSymptomOnly: true,
      matchedEvidence: context.evidence,
    });

    expect(finding.isSymptomOnly).toBe(true);
    expect(finding.rule?.isSymptomOnly).toBe(true);
  });
});
```

---

# 二、剩余 matcher 化规则的 factory 版批量重构

---

## 1）`src/diagnosis/domain/rule-engine/rules/r203-bff-gateway-failure.rule.ts`

```ts
import { Injectable } from '@nestjs/common';
import { DiagnosisRule } from '../interfaces/diagnosis-rule.interface';
import {
  DiagnosisContext,
  RuleFinding,
} from '../../types/diagnosis.types';
import {
  collectNetworkEvidence,
  isGatewayLikeEvidence,
} from '../matchers/network.matcher';
import { buildRuleFindingFromMatch } from '../factories/build-rule-finding';

@Injectable()
export class R203BffGatewayFailureRule implements DiagnosisRule {
  readonly code = 'R203';

  evaluate(context: DiagnosisContext): RuleFinding[] {
    const matchedEvidence = collectNetworkEvidence(
      context,
      isGatewayLikeEvidence,
    );

    if (matchedEvidence.length === 0) {
      return [];
    }

    return [
      buildRuleFindingFromMatch({
        ruleCode: 'R203',
        ruleName: 'BFF or gateway failure',
        title: 'BFF or gateway failure',
        summary:
          'Failure signal indicates issues at the BFF/gateway layer rather than leaf UI state alone.',
        confidence: 0.84,
        score: 84,
        layer: 'bff',
        cluster: 'gateway_failure',
        severity: 'high',
        isSymptomOnly: false,
        matchedEvidence,
      }),
    ];
  }
}
```

---

## 2）`src/diagnosis/domain/rule-engine/rules/r302-db-connection-exhausted.rule.ts`

```ts
import { Injectable } from '@nestjs/common';
import { DiagnosisRule } from '../interfaces/diagnosis-rule.interface';
import {
  DiagnosisContext,
  RuleFinding,
} from '../../types/diagnosis.types';
import {
  collectDbEvidence,
  isDbConnectionExhaustedEvidence,
} from '../matchers/db.matcher';
import { buildRuleFindingFromMatch } from '../factories/build-rule-finding';

@Injectable()
export class R302DbConnectionExhaustedRule implements DiagnosisRule {
  readonly code = 'R302';

  evaluate(context: DiagnosisContext): RuleFinding[] {
    const matchedEvidence = collectDbEvidence(
      context,
      isDbConnectionExhaustedEvidence,
    );

    if (matchedEvidence.length === 0) {
      return [];
    }

    return [
      buildRuleFindingFromMatch({
        ruleCode: 'R302',
        ruleName: 'DB connection pool exhausted',
        title: 'DB connection exhausted',
        summary:
          'Database connection pool exhaustion suggests resource saturation or pool starvation.',
        confidence: 0.83,
        score: 83,
        layer: 'db',
        cluster: 'db_connection_exhausted',
        severity: 'critical',
        isSymptomOnly: false,
        matchedEvidence,
      }),
    ];
  }
}
```

---

## 3）`src/diagnosis/domain/rule-engine/rules/r401-external-dependency-failure.rule.ts`

```ts
import { Injectable } from '@nestjs/common';
import { DiagnosisRule } from '../interfaces/diagnosis-rule.interface';
import {
  DiagnosisContext,
  RuleFinding,
} from '../../types/diagnosis.types';
import {
  collectExternalEvidence,
  isExternalDependencyFailureEvidence,
} from '../matchers/external.matcher';
import { buildRuleFindingFromMatch } from '../factories/build-rule-finding';

@Injectable()
export class R401ExternalDependencyFailureRule implements DiagnosisRule {
  readonly code = 'R401';

  evaluate(context: DiagnosisContext): RuleFinding[] {
    const matchedEvidence = collectExternalEvidence(
      context,
      isExternalDependencyFailureEvidence,
    );

    if (matchedEvidence.length === 0) {
      return [];
    }

    return [
      buildRuleFindingFromMatch({
        ruleCode: 'R401',
        ruleName: 'External dependency unavailable',
        title: 'External dependency failure',
        summary:
          'Observed failure likely originates from an external provider or third-party dependency.',
        confidence: 0.82,
        score: 82,
        layer: 'external',
        cluster: 'external_dependency_failure',
        severity: 'high',
        isSymptomOnly: false,
        matchedEvidence,
      }),
    ];
  }
}
```

---

## 4）`src/diagnosis/domain/rule-engine/rules/r402-third-party-rate-limit.rule.ts`

```ts
import { Injectable } from '@nestjs/common';
import { DiagnosisRule } from '../interfaces/diagnosis-rule.interface';
import {
  DiagnosisContext,
  RuleFinding,
} from '../../types/diagnosis.types';
import {
  collectExternalEvidence,
  isThirdPartyRateLimitEvidence,
} from '../matchers/external.matcher';
import { buildRuleFindingFromMatch } from '../factories/build-rule-finding';

@Injectable()
export class R402ThirdPartyRateLimitRule implements DiagnosisRule {
  readonly code = 'R402';

  evaluate(context: DiagnosisContext): RuleFinding[] {
    const matchedEvidence = collectExternalEvidence(
      context,
      isThirdPartyRateLimitEvidence,
    );

    if (matchedEvidence.length === 0) {
      return [];
    }

    return [
      buildRuleFindingFromMatch({
        ruleCode: 'R402',
        ruleName: 'Third-party rate limit / 429',
        title: 'Third-party rate limit',
        summary:
          'Third-party provider is rate limiting requests, causing downstream failures or degraded UX.',
        confidence: 0.86,
        score: 86,
        layer: 'external',
        cluster: 'third_party_rate_limit',
        severity: 'high',
        isSymptomOnly: false,
        matchedEvidence,
      }),
    ];
  }
}
```

---

## 5）`src/diagnosis/domain/rule-engine/rules/r501-ui-loading-symptom.rule.ts`

```ts
import { Injectable } from '@nestjs/common';
import { DiagnosisRule } from '../interfaces/diagnosis-rule.interface';
import {
  DiagnosisContext,
  RuleFinding,
} from '../../types/diagnosis.types';
import {
  collectUiEvidence,
  hasLoadingSymptomFlag,
  isLoadingEvidence,
} from '../matchers/ui-state.matcher';
import { buildRuleFindingFromMatch } from '../factories/build-rule-finding';

@Injectable()
export class R501UiLoadingSymptomRule implements DiagnosisRule {
  readonly code = 'R501';

  evaluate(context: DiagnosisContext): RuleFinding[] {
    const matchedEvidence = collectUiEvidence(context, (ev) =>
      isLoadingEvidence(ev, { minLoadingMs: 3000 }),
    );
    const symptomMatched = hasLoadingSymptomFlag(context);

    if (matchedEvidence.length === 0 && !symptomMatched) {
      return [];
    }

    return [
      buildRuleFindingFromMatch({
        ruleCode: 'R501',
        ruleName: 'Long loading or blocked UI state',
        title: 'UI loading symptom',
        summary:
          'UI remained in loading/stuck state; likely symptom rather than root cause.',
        confidence: 0.74,
        score: 74,
        layer: 'ui_state',
        cluster: 'ui_loading',
        severity: 'medium',
        isSymptomOnly: true,
        matchedEvidence,
        detail: {
          symptomMatched,
        },
      }),
    ];
  }
}
```

---

## 6）`src/diagnosis/domain/rule-engine/rules/r503-ui-empty-state-symptom.rule.ts`

```ts
import { Injectable } from '@nestjs/common';
import { DiagnosisRule } from '../interfaces/diagnosis-rule.interface';
import {
  DiagnosisContext,
  RuleFinding,
} from '../../types/diagnosis.types';
import {
  collectUiEvidence,
  isEmptyStateEvidence,
} from '../matchers/ui-state.matcher';
import { buildRuleFindingFromMatch } from '../factories/build-rule-finding';

@Injectable()
export class R503UiEmptyStateSymptomRule implements DiagnosisRule {
  readonly code = 'R503';

  evaluate(context: DiagnosisContext): RuleFinding[] {
    const matchedEvidence = collectUiEvidence(context, isEmptyStateEvidence);

    if (matchedEvidence.length === 0) {
      return [];
    }

    return [
      buildRuleFindingFromMatch({
        ruleCode: 'R503',
        ruleName: 'Unexpected UI empty state',
        title: 'UI empty state symptom',
        summary:
          'Unexpected empty state was rendered, likely reflecting upstream data or request failure.',
        confidence: 0.66,
        score: 66,
        layer: 'ui_state',
        cluster: 'ui_empty_state',
        severity: 'medium',
        isSymptomOnly: true,
        matchedEvidence,
      }),
    ];
  }
}
```

---

## 7）`src/diagnosis/domain/rule-engine/rules/r504-ui-retry-loop-symptom.rule.ts`

```ts
import { Injectable } from '@nestjs/common';
import { DiagnosisRule } from '../interfaces/diagnosis-rule.interface';
import {
  DiagnosisContext,
  RuleFinding,
} from '../../types/diagnosis.types';
import {
  collectUiEvidence,
  isRetryLoopEvidence,
} from '../matchers/ui-state.matcher';
import { buildRuleFindingFromMatch } from '../factories/build-rule-finding';

@Injectable()
export class R504UiRetryLoopSymptomRule implements DiagnosisRule {
  readonly code = 'R504';

  evaluate(context: DiagnosisContext): RuleFinding[] {
    const matchedEvidence = collectUiEvidence(context, isRetryLoopEvidence);

    if (matchedEvidence.length === 0) {
      return [];
    }

    return [
      buildRuleFindingFromMatch({
        ruleCode: 'R504',
        ruleName: 'Repeated UI retry loop',
        title: 'UI retry loop symptom',
        summary:
          'The UI is repeatedly retrying, indicating unstable upstream dependency or unresolved failure.',
        confidence: 0.71,
        score: 71,
        layer: 'ui_state',
        cluster: 'ui_retry_loop',
        severity: 'medium',
        isSymptomOnly: true,
        matchedEvidence,
      }),
    ];
  }
}
```

---

# 三、你现在这层结构已经比较稳定了

到这里你的 rule-engine 规则实现，基本形成了这条稳定分层：

## 1. matcher 层
负责：
- 识别原始 evidence 模式
- 统一阈值 / 文本匹配 / flag 判定

## 2. rule 层
负责：
- 业务语义命名
- 选择 matcher
- 定义 rule metadata
- 控制 symptom / non-symptom 语义

## 3. finding factory 层
负责：
- 统一 `RuleFinding` 对象结构
- 统一 evidenceIds / matchedCount / nested rule meta

这已经很接近一个可持续扩展的 MVP 规则引擎骨架了。

---

# 四、哪些规则暂时不一定要 matcher 化

我建议你目前 **先别急着强行 matcher 化 `R101-R104`**，原因如下：

## `R101`
它更像一个 **absence rule**：
- “没有 user action evidence”

这个更像上下文 completeness 检查，不是典型 evidence pattern matcher。

## `R102-R104`
这些也可以 matcher 化，但收益相对后面几类低一些：
- `R102`: invalid target
- `R103`: dispatched but not handled
- `R104`: desync

它们更偏前端交互语义，不像 network/db/ui/external 这么适合统一为跨规则复用 matcher。

所以现阶段最划算的是：
- network/db/ui/external 全部 matcher 化
- user_action/frontend_app 保留较轻实现

这个切分我认为是合理的。

---

# 五、我建议的下一步

现在最适合继续补的是下面二选一：

## 方向 A：把旧 rule unit tests 微调到 factory 时代
因为 rule 实现已经变化了，你虽然大概率不需要大改测试，但可以做一轮统一整理：
- 只保留外部行为断言
- 不依赖内部 detail 过多细节
- 对 `R501` 增加 `symptomMatched` detail 的轻断言（可选）

## 方向 B：补 finding factory + matcher + rule 的“组合演进规范”
我可以直接给你一份：
- `RULE_AUTHORING.md` 或内部注释模板
- 约定新 rule 如何写：
  1. 先写 matcher test
  2. 再写 rule test
  3. 再接 integration scenario
  4. 统一用 `buildRuleFindingFromMatch`

这对后面继续扩规则很有帮助。

如果你愿意，我建议下一条直接做：

> **基于 factory/matcher 时代的 Rule 单测统一整理模板 + 选 6 条规则重构后的 spec 示例**