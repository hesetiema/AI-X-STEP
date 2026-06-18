下面直接给你两部分：

1. `rule-unit-assertions.ts`
2. 把这 **9 个 spec** 压缩成统一 helper 风格版

覆盖：

- `R101`
- `R102`
- `R103`
- `R104`
- `R301`
- `R402`
- `R502`
- `R503`
- `R504`

目标：

- 统一断言形状
- 降低 spec 冗余
- 保持每个 case 的业务可读性

---

# 一、`test/helpers/rule-unit-assertions.ts`

```ts
import { RuleFinding } from '../../src/diagnosis/domain/types/diagnosis.types';

type ExpectedSingleRuleHit = {
  ruleCode: string;
  layer: RuleFinding['layer'];
  cluster: RuleFinding['cluster'];
  isSymptomOnly: boolean;
  evidenceIds?: string[];
  detail?: Record<string, unknown>;
};

export function expectSingleRuleHit(
  result: RuleFinding[],
  expected: ExpectedSingleRuleHit,
): void {
  expect(result).toHaveLength(1);

  const finding = result[0];

  expect(finding.ruleCode).toBe(expected.ruleCode);
  expect(finding.layer).toBe(expected.layer);
  expect(finding.cluster).toBe(expected.cluster);
  expect(finding.isSymptomOnly).toBe(expected.isSymptomOnly);

  if (expected.evidenceIds !== undefined) {
    expect(finding.evidenceIds).toEqual(expected.evidenceIds);
  }

  if (expected.detail !== undefined) {
    expect(finding.detail).toMatchObject(expected.detail);
  }
}

export function expectRuleMiss(result: RuleFinding[]): void {
  expect(result).toEqual([]);
}
```

---

# 二、统一 helper 风格后的 9 个 spec

---

## 1）`test/unit/rules/r101-user-action-missing.rule.spec.ts`

```ts
import { R101UserActionMissingRule } from '../../../src/diagnosis/domain/rule-engine/rules/r101-user-action-missing.rule';
import { buildDiagnosisContext } from '../../helpers/diagnosis-context.fixture';
import {
  expectRuleMiss,
  expectSingleRuleHit,
} from '../../helpers/rule-unit-assertions';

describe('R101UserActionMissingRule', () => {
  let rule: R101UserActionMissingRule;

  beforeEach(() => {
    rule = new R101UserActionMissingRule();
  });

  it('should hit when user action evidence is missing', () => {
    const context = buildDiagnosisContext({
      interactionId: 'itx-101',
      evidence: [
        {
          id: 'ev-ui-1',
          type: 'ui_state',
          label: 'loading > 10s',
          value: { loadingMs: 10000 },
          source: 'frontend-sdk',
        },
      ],
    });

    const result = rule.evaluate(context);

    expectSingleRuleHit(result, {
      ruleCode: 'R101',
      layer: 'user_action',
      cluster: 'missing_user_action',
      isSymptomOnly: false,
      evidenceIds: [],
      detail: {
        interactionId: 'itx-101',
      },
    });
  });

  it('should not hit when ui_event evidence exists', () => {
    const context = buildDiagnosisContext({
      evidence: [
        {
          id: 'ev-action-1',
          type: 'ui_event',
          label: 'click submit',
          value: { element: '#submit-btn' },
          source: 'frontend-sdk',
        },
      ],
    });

    const result = rule.evaluate(context);

    expectRuleMiss(result);
  });
});
```

---

## 2）`test/unit/rules/r102-user-action-invalid-target.rule.spec.ts`

```ts
import { R102UserActionInvalidTargetRule } from '../../../src/diagnosis/domain/rule-engine/rules/r102-user-action-invalid-target.rule';
import { buildDiagnosisContext } from '../../helpers/diagnosis-context.fixture';
import {
  expectRuleMiss,
  expectSingleRuleHit,
} from '../../helpers/rule-unit-assertions';

describe('R102UserActionInvalidTargetRule', () => {
  let rule: R102UserActionInvalidTargetRule;

  beforeEach(() => {
    rule = new R102UserActionInvalidTargetRule();
  });

  it('should hit when actual target differs from expected target', () => {
    const context = buildDiagnosisContext({
      targetId: 'button-submit',
      evidence: [
        {
          id: 'ev-action-1',
          type: 'ui_event',
          label: 'click invalid target',
          value: {
            expectedTargetId: 'button-submit',
            actualTargetId: 'ghost-button',
          },
          source: 'frontend-sdk',
        },
      ],
    });

    const result = rule.evaluate(context);

    expectSingleRuleHit(result, {
      ruleCode: 'R102',
      layer: 'user_action',
      cluster: 'invalid_action_target',
      isSymptomOnly: false,
      evidenceIds: ['ev-action-1'],
      detail: {
        expectedTargetId: 'button-submit',
      },
    });
  });

  it('should not hit when actual target matches expected target', () => {
    const context = buildDiagnosisContext({
      targetId: 'button-submit',
      evidence: [
        {
          id: 'ev-action-2',
          type: 'ui_event',
          label: 'click submit',
          value: {
            expectedTargetId: 'button-submit',
            actualTargetId: 'button-submit',
          },
          source: 'frontend-sdk',
        },
      ],
    });

    const result = rule.evaluate(context);

    expectRuleMiss(result);
  });
});
```

---

## 3）`test/unit/rules/r103-frontend-event-lost.rule.spec.ts`

```ts
import { R103FrontendEventLostRule } from '../../../src/diagnosis/domain/rule-engine/rules/r103-frontend-event-lost.rule';
import { buildDiagnosisContext } from '../../helpers/diagnosis-context.fixture';
import {
  expectRuleMiss,
  expectSingleRuleHit,
} from '../../helpers/rule-unit-assertions';

describe('R103FrontendEventLostRule', () => {
  let rule: R103FrontendEventLostRule;

  beforeEach(() => {
    rule = new R103FrontendEventLostRule();
  });

  it('should hit when event is dispatched but not handled', () => {
    const context = buildDiagnosisContext({
      evidence: [
        {
          id: 'ev-fe-1',
          type: 'ui_event',
          label: 'dispatch submit event',
          value: {
            dispatched: true,
            handled: false,
          },
          source: 'frontend-sdk',
        },
      ],
    });

    const result = rule.evaluate(context);

    expectSingleRuleHit(result, {
      ruleCode: 'R103',
      layer: 'frontend_app',
      cluster: 'event_lost',
      isSymptomOnly: false,
      evidenceIds: ['ev-fe-1'],
    });
  });

  it('should not hit when event is handled normally', () => {
    const context = buildDiagnosisContext({
      evidence: [
        {
          id: 'ev-fe-2',
          type: 'ui_event',
          label: 'dispatch submit event',
          value: {
            dispatched: true,
            handled: true,
          },
          source: 'frontend-sdk',
        },
      ],
    });

    const result = rule.evaluate(context);

    expectRuleMiss(result);
  });
});
```

---

## 4）`test/unit/rules/r104-frontend-state-desync.rule.spec.ts`

```ts
import { R104FrontendStateDesyncRule } from '../../../src/diagnosis/domain/rule-engine/rules/r104-frontend-state-desync.rule';
import { buildDiagnosisContext } from '../../helpers/diagnosis-context.fixture';
import {
  expectRuleMiss,
  expectSingleRuleHit,
} from '../../helpers/rule-unit-assertions';

describe('R104FrontendStateDesyncRule', () => {
  let rule: R104FrontendStateDesyncRule;

  beforeEach(() => {
    rule = new R104FrontendStateDesyncRule();
  });

  it('should hit when ui_state evidence is desynchronized', () => {
    const context = buildDiagnosisContext({
      targetId: 'button-submit',
      evidence: [
        {
          id: 'ev-state-1',
          type: 'ui_state',
          label: 'state desync detected',
          value: {
            expectedStatus: 'success',
            actualStatus: 'loading',
            desynced: true,
          },
          source: 'frontend-sdk',
        },
      ],
    });

    const result = rule.evaluate(context);

    expectSingleRuleHit(result, {
      ruleCode: 'R104',
      layer: 'frontend_app',
      cluster: 'state_desync',
      isSymptomOnly: false,
      evidenceIds: ['ev-state-1'],
      detail: {
        targetId: 'button-submit',
      },
    });
  });

  it('should not hit when desync flag is absent', () => {
    const context = buildDiagnosisContext({
      evidence: [
        {
          id: 'ev-state-2',
          type: 'ui_state',
          label: 'state synced',
          value: {
            expectedStatus: 'success',
            actualStatus: 'success',
            desynced: false,
          },
          source: 'frontend-sdk',
        },
      ],
    });

    const result = rule.evaluate(context);

    expectRuleMiss(result);
  });
});
```

---

## 5）`test/unit/rules/r301-db-timeout.rule.spec.ts`

```ts
import { R301DbTimeoutRule } from '../../../src/diagnosis/domain/rule-engine/rules/r301-db-timeout.rule';
import { buildDiagnosisContext } from '../../helpers/diagnosis-context.fixture';
import {
  expectRuleMiss,
  expectSingleRuleHit,
} from '../../helpers/rule-unit-assertions';

describe('R301DbTimeoutRule', () => {
  let rule: R301DbTimeoutRule;

  beforeEach(() => {
    rule = new R301DbTimeoutRule();
  });

  it('should hit when db timeout evidence exists', () => {
    const context = buildDiagnosisContext({
      evidence: [
        {
          id: 'ev-db-1',
          type: 'trace_span',
          label: 'db timeout on order query',
          value: { durationMs: 3200 },
          source: 'trace',
        },
      ],
    });

    const result = rule.evaluate(context);

    expectSingleRuleHit(result, {
      ruleCode: 'R301',
      layer: 'db',
      cluster: 'db_timeout',
      isSymptomOnly: false,
      evidenceIds: ['ev-db-1'],
    });
  });

  it('should not hit when db timeout signal is absent', () => {
    const context = buildDiagnosisContext({
      evidence: [
        {
          id: 'ev-db-2',
          type: 'metric',
          label: 'db healthy',
          value: { latencyMs: 50 },
          source: 'metrics',
        },
      ],
    });

    const result = rule.evaluate(context);

    expectRuleMiss(result);
  });
});
```

---

## 6）`test/unit/rules/r402-third-party-rate-limit.rule.spec.ts`

```ts
import { R402ThirdPartyRateLimitRule } from '../../../src/diagnosis/domain/rule-engine/rules/r402-third-party-rate-limit.rule';
import { buildDiagnosisContext } from '../../helpers/diagnosis-context.fixture';
import {
  expectRuleMiss,
  expectSingleRuleHit,
} from '../../helpers/rule-unit-assertions';

describe('R402ThirdPartyRateLimitRule', () => {
  let rule: R402ThirdPartyRateLimitRule;

  beforeEach(() => {
    rule = new R402ThirdPartyRateLimitRule();
  });

  it('should hit when third-party rate limit evidence exists', () => {
    const context = buildDiagnosisContext({
      evidence: [
        {
          id: 'ev-ext-rl-1',
          type: 'network_error',
          label: 'third-party rate limited',
          value: {
            status: 429,
            provider: 'sms-vendor',
            external: true,
          },
          source: 'network-observer',
        },
      ],
    });

    const result = rule.evaluate(context);

    expectSingleRuleHit(result, {
      ruleCode: 'R402',
      layer: 'external',
      cluster: 'third_party_rate_limit',
      isSymptomOnly: false,
      evidenceIds: ['ev-ext-rl-1'],
    });
  });

  it('should not hit when rate limit signal is absent', () => {
    const context = buildDiagnosisContext({
      evidence: [
        {
          id: 'ev-ext-rl-2',
          type: 'network_error',
          label: 'provider unavailable',
          value: {
            status: 503,
            external: true,
          },
          source: 'network-observer',
        },
      ],
    });

    const result = rule.evaluate(context);

    expectRuleMiss(result);
  });
});
```

---

## 7）`test/unit/rules/r502-ui-error-toast-symptom.rule.spec.ts`

```ts
import { R502UiErrorToastSymptomRule } from '../../../src/diagnosis/domain/rule-engine/rules/r502-ui-error-toast-symptom.rule';
import { buildDiagnosisContext } from '../../helpers/diagnosis-context.fixture';
import {
  expectRuleMiss,
  expectSingleRuleHit,
} from '../../helpers/rule-unit-assertions';

describe('R502UiErrorToastSymptomRule', () => {
  let rule: R502UiErrorToastSymptomRule;

  beforeEach(() => {
    rule = new R502UiErrorToastSymptomRule();
  });

  it('should hit when ui error toast evidence exists', () => {
    const context = buildDiagnosisContext({
      evidence: [
        {
          id: 'ev-toast-1',
          type: 'ui_state',
          label: 'error toast visible',
          value: {
            toastType: 'error',
            message: 'Submit failed',
          },
          source: 'frontend-sdk',
        },
      ],
    });

    const result = rule.evaluate(context);

    expectSingleRuleHit(result, {
      ruleCode: 'R502',
      layer: 'ui_state',
      cluster: 'ui_error_toast',
      isSymptomOnly: true,
      evidenceIds: ['ev-toast-1'],
    });
  });

  it('should not hit when error toast signal is absent', () => {
    const context = buildDiagnosisContext({
      evidence: [
        {
          id: 'ev-toast-2',
          type: 'ui_state',
          label: 'success toast visible',
          value: {
            toastType: 'success',
            message: 'Saved',
          },
          source: 'frontend-sdk',
        },
      ],
    });

    const result = rule.evaluate(context);

    expectRuleMiss(result);
  });
});
```

---

## 8）`test/unit/rules/r503-ui-empty-state-symptom.rule.spec.ts`

```ts
import { R503UiEmptyStateSymptomRule } from '../../../src/diagnosis/domain/rule-engine/rules/r503-ui-empty-state-symptom.rule';
import { buildDiagnosisContext } from '../../helpers/diagnosis-context.fixture';
import {
  expectRuleMiss,
  expectSingleRuleHit,
} from '../../helpers/rule-unit-assertions';

describe('R503UiEmptyStateSymptomRule', () => {
  let rule: R503UiEmptyStateSymptomRule;

  beforeEach(() => {
    rule = new R503UiEmptyStateSymptomRule();
  });

  it('should hit when unexpected empty state evidence exists', () => {
    const context = buildDiagnosisContext({
      evidence: [
        {
          id: 'ev-empty-1',
          type: 'ui_state',
          label: 'unexpected empty state',
          value: {
            empty: true,
            expectedCount: 5,
            actualCount: 0,
          },
          source: 'frontend-sdk',
        },
      ],
    });

    const result = rule.evaluate(context);

    expectSingleRuleHit(result, {
      ruleCode: 'R503',
      layer: 'ui_state',
      cluster: 'ui_empty_state',
      isSymptomOnly: true,
      evidenceIds: ['ev-empty-1'],
    });
  });

  it('should not hit when empty state is expected', () => {
    const context = buildDiagnosisContext({
      evidence: [
        {
          id: 'ev-empty-2',
          type: 'ui_state',
          label: 'empty list',
          value: {
            empty: true,
            expectedCount: 0,
            actualCount: 0,
          },
          source: 'frontend-sdk',
        },
      ],
    });

    const result = rule.evaluate(context);

    expectRuleMiss(result);
  });
});
```

---

## 9）`test/unit/rules/r504-ui-retry-loop-symptom.rule.spec.ts`

```ts
import { R504UiRetryLoopSymptomRule } from '../../../src/diagnosis/domain/rule-engine/rules/r504-ui-retry-loop-symptom.rule';
import { buildDiagnosisContext } from '../../helpers/diagnosis-context.fixture';
import {
  expectRuleMiss,
  expectSingleRuleHit,
} from '../../helpers/rule-unit-assertions';

describe('R504UiRetryLoopSymptomRule', () => {
  let rule: R504UiRetryLoopSymptomRule;

  beforeEach(() => {
    rule = new R504UiRetryLoopSymptomRule();
  });

  it('should hit when retry loop evidence exists', () => {
    const context = buildDiagnosisContext({
      evidence: [
        {
          id: 'ev-retry-1',
          type: 'ui_event',
          label: 'retry loop detected',
          value: {
            retryCount: 5,
            loop: true,
          },
          source: 'frontend-sdk',
        },
      ],
    });

    const result = rule.evaluate(context);

    expectSingleRuleHit(result, {
      ruleCode: 'R504',
      layer: 'ui_state',
      cluster: 'ui_retry_loop',
      isSymptomOnly: true,
      evidenceIds: ['ev-retry-1'],
    });
  });

  it('should not hit when retry signal is normal', () => {
    const context = buildDiagnosisContext({
      evidence: [
        {
          id: 'ev-retry-2',
          type: 'ui_event',
          label: 'single retry',
          value: {
            retryCount: 1,
            loop: false,
          },
          source: 'frontend-sdk',
        },
      ],
    });

    const result = rule.evaluate(context);

    expectRuleMiss(result);
  });
});
```

---

如果你愿意，我下一条可以继续直接给你：

**把之前的 `R201 / R202 / R203 / R302 / R401 / R501` 也同步改成同一个 helper 风格，形成完整统一版 rules unit tests。**