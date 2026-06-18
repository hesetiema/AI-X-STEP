下面直接给你：

1. `rule-engine-scenarios.fixture.ts`
2. **基于场景 fixture 的更短版** `rule-engine.service.int.spec.ts`

目标是把 integration spec 从“手填 evidence 明细”改成“拿场景构造器直接组装”，更贴近你后面做 MVP 场景资产沉淀的方向。

---

# 一、`test/helpers/rule-engine-scenarios.fixture.ts`

```ts
import { DiagnosisContext } from '../../src/diagnosis/domain/types/diagnosis.types';
import { buildDiagnosisContext } from './diagnosis-context.fixture';

export function buildUserActionMissingScenarioContext(
  overrides: Partial<DiagnosisContext> = {},
): DiagnosisContext {
  return buildDiagnosisContext({
    symptoms: ['ui_loading'],
    evidence: [
      {
        id: 'ev-ui-1',
        type: 'ui_state',
        label: 'loading > 10s',
        value: { loadingMs: 10000 },
        source: 'frontend-sdk',
      },
    ],
    ...overrides,
  });
}

export function buildInvalidTargetScenarioContext(
  overrides: Partial<DiagnosisContext> = {},
): DiagnosisContext {
  return buildDiagnosisContext({
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
    ...overrides,
  });
}

export function buildFrontendEventLostScenarioContext(
  overrides: Partial<DiagnosisContext> = {},
): DiagnosisContext {
  return buildDiagnosisContext({
    evidence: [
      {
        id: 'ev-fe-1',
        type: 'ui_event',
        label: 'dispatch submit event',
        value: { dispatched: true, handled: false },
        source: 'frontend-sdk',
      },
    ],
    ...overrides,
  });
}

export function buildFrontendStateDesyncScenarioContext(
  overrides: Partial<DiagnosisContext> = {},
): DiagnosisContext {
  return buildDiagnosisContext({
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
    ...overrides,
  });
}

export function buildMixedFrontendScenarioContext(
  overrides: Partial<DiagnosisContext> = {},
): DiagnosisContext {
  return buildDiagnosisContext({
    targetId: 'button-submit',
    symptoms: ['ui_loading'],
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
      {
        id: 'ev-fe-1',
        type: 'ui_event',
        label: 'dispatch submit event',
        value: { dispatched: true, handled: false },
        source: 'frontend-sdk',
      },
      {
        id: 'ev-ui-1',
        type: 'ui_state',
        label: 'loading > 15s',
        value: { loadingMs: 15000 },
        source: 'frontend-sdk',
      },
    ],
    ...overrides,
  });
}

export function buildApi5xxScenarioContext(
  overrides: Partial<DiagnosisContext> = {},
): DiagnosisContext {
  return buildDiagnosisContext({
    evidence: [
      {
        id: 'ev-api-1',
        type: 'network_error',
        label: 'POST /orders 500',
        value: { status: 500, url: '/api/orders' },
        source: 'network-observer',
      },
    ],
    ...overrides,
  });
}

export function buildApiTimeoutScenarioContext(
  overrides: Partial<DiagnosisContext> = {},
): DiagnosisContext {
  return buildDiagnosisContext({
    evidence: [
      {
        id: 'ev-api-timeout-1',
        type: 'network_error',
        label: 'POST /orders timeout',
        value: { code: 'ETIMEDOUT', durationMs: 5000 },
        source: 'network-observer',
      },
    ],
    ...overrides,
  });
}

export function buildGatewayFailureScenarioContext(
  overrides: Partial<DiagnosisContext> = {},
): DiagnosisContext {
  return buildDiagnosisContext({
    evidence: [
      {
        id: 'ev-bff-1',
        type: 'network_error',
        label: 'BFF gateway bad gateway',
        value: { status: 502, gateway: true },
        source: 'network-observer',
      },
    ],
    ...overrides,
  });
}

export function buildGatewayTimeoutScenarioContext(
  overrides: Partial<DiagnosisContext> = {},
): DiagnosisContext {
  return buildDiagnosisContext({
    evidence: [
      {
        id: 'ev-api-gtw-timeout-1',
        type: 'network_error',
        label: 'gateway timeout on /api/orders',
        value: { status: 504, gateway: true, durationMs: 6000 },
        source: 'network-observer',
      },
    ],
    ...overrides,
  });
}

export function buildDbTimeoutScenarioContext(
  overrides: Partial<DiagnosisContext> = {},
): DiagnosisContext {
  return buildDiagnosisContext({
    evidence: [
      {
        id: 'ev-db-1',
        type: 'trace_span',
        label: 'db timeout on order query',
        value: { durationMs: 2200 },
        source: 'trace',
      },
    ],
    ...overrides,
  });
}

export function buildDbConnectionExhaustedScenarioContext(
  overrides: Partial<DiagnosisContext> = {},
): DiagnosisContext {
  return buildDiagnosisContext({
    evidence: [
      {
        id: 'ev-db-pool-1',
        type: 'log',
        label: 'db connection pool exhausted',
        value: { poolExhausted: true, activeConnections: 100 },
        source: 'backend-log',
      },
    ],
    ...overrides,
  });
}

export function buildDbSaturationScenarioContext(
  overrides: Partial<DiagnosisContext> = {},
): DiagnosisContext {
  return buildDiagnosisContext({
    evidence: [
      {
        id: 'ev-db-1',
        type: 'trace_span',
        label: 'db timeout on order query',
        value: { durationMs: 3500 },
        source: 'trace',
      },
      {
        id: 'ev-db-pool-1',
        type: 'log',
        label: 'db connection pool exhausted',
        value: { poolExhausted: true, activeConnections: 100 },
        source: 'backend-log',
      },
    ],
    ...overrides,
  });
}

export function buildExternalDependencyFailureScenarioContext(
  overrides: Partial<DiagnosisContext> = {},
): DiagnosisContext {
  return buildDiagnosisContext({
    evidence: [
      {
        id: 'ev-ext-1',
        type: 'network_error',
        label: 'payment provider unavailable',
        value: {
          status: 503,
          provider: 'payment-gateway',
          external: true,
        },
        source: 'network-observer',
      },
    ],
    ...overrides,
  });
}

export function buildThirdPartyRateLimitScenarioContext(
  overrides: Partial<DiagnosisContext> = {},
): DiagnosisContext {
  return buildDiagnosisContext({
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
    ...overrides,
  });
}

export function buildDegradedExternalProviderScenarioContext(
  overrides: Partial<DiagnosisContext> = {},
): DiagnosisContext {
  return buildDiagnosisContext({
    symptoms: ['ui_loading'],
    evidence: [
      {
        id: 'ev-ext-rl-2',
        type: 'network_error',
        label: 'third-party provider rate limit / unavailable',
        value: {
          status: 429,
          provider: 'sms-vendor',
          external: true,
        },
        source: 'network-observer',
      },
      {
        id: 'ev-ui-1',
        type: 'ui_state',
        label: 'loading > 20s',
        value: { loadingMs: 20000 },
        source: 'frontend-sdk',
      },
    ],
    ...overrides,
  });
}

export function buildUiLoadingScenarioContext(
  overrides: Partial<DiagnosisContext> = {},
): DiagnosisContext {
  return buildDiagnosisContext({
    symptoms: [],
    evidence: [
      {
        id: 'ev-ui-1',
        type: 'ui_state',
        label: 'loading > 12s',
        value: { loadingMs: 12000 },
        source: 'frontend-sdk',
      },
    ],
    ...overrides,
  });
}

export function buildUiErrorToastScenarioContext(
  overrides: Partial<DiagnosisContext> = {},
): DiagnosisContext {
  return buildDiagnosisContext({
    evidence: [
      {
        id: 'ev-toast-1',
        type: 'ui_state',
        label: 'error toast visible',
        value: { toastType: 'error', message: 'Submit failed' },
        source: 'frontend-sdk',
      },
    ],
    ...overrides,
  });
}

export function buildUiEmptyStateScenarioContext(
  overrides: Partial<DiagnosisContext> = {},
): DiagnosisContext {
  return buildDiagnosisContext({
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
    ...overrides,
  });
}

export function buildUiRetryLoopScenarioContext(
  overrides: Partial<DiagnosisContext> = {},
): DiagnosisContext {
  return buildDiagnosisContext({
    evidence: [
      {
        id: 'ev-retry-1',
        type: 'ui_event',
        label: 'retry loop detected',
        value: { retryCount: 5, loop: true },
        source: 'frontend-sdk',
      },
    ],
    ...overrides,
  });
}

export function buildUiDegradationScenarioContext(
  overrides: Partial<DiagnosisContext> = {},
): DiagnosisContext {
  return buildDiagnosisContext({
    symptoms: ['ui_loading'],
    evidence: [
      {
        id: 'ev-ui-1',
        type: 'ui_state',
        label: 'loading > 15s',
        value: { loadingMs: 15000 },
        source: 'frontend-sdk',
      },
      {
        id: 'ev-toast-1',
        type: 'ui_state',
        label: 'error toast visible',
        value: { toastType: 'error', message: 'Submit failed' },
        source: 'frontend-sdk',
      },
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
      {
        id: 'ev-retry-1',
        type: 'ui_event',
        label: 'retry loop detected',
        value: { retryCount: 5, loop: true },
        source: 'frontend-sdk',
      },
    ],
    ...overrides,
  });
}

export function buildRealisticApiDbUiIncidentScenarioContext(
  overrides: Partial<DiagnosisContext> = {},
): DiagnosisContext {
  return buildDiagnosisContext({
    targetId: 'button-submit',
    symptoms: ['ui_loading'],
    evidence: [
      {
        id: 'ev-action-1',
        type: 'ui_event',
        label: 'click submit',
        value: {
          expectedTargetId: 'button-submit',
          actualTargetId: 'button-submit',
        },
        source: 'frontend-sdk',
      },
      {
        id: 'ev-api-1',
        type: 'network_error',
        label: 'POST /orders 500',
        value: { status: 500, url: '/api/orders' },
        source: 'network-observer',
      },
      {
        id: 'ev-db-1',
        type: 'trace_span',
        label: 'db timeout on order query',
        value: { durationMs: 3200 },
        source: 'trace',
      },
      {
        id: 'ev-ui-1',
        type: 'ui_state',
        label: 'loading > 12s',
        value: { loadingMs: 12000 },
        source: 'frontend-sdk',
      },
      {
        id: 'ev-toast-1',
        type: 'ui_state',
        label: 'error toast visible',
        value: { toastType: 'error', message: 'Submit failed' },
        source: 'frontend-sdk',
      },
    ],
    ...overrides,
  });
}

export function buildThirdPartyOutageWithUiSymptomsScenarioContext(
  overrides: Partial<DiagnosisContext> = {},
): DiagnosisContext {
  return buildDiagnosisContext({
    symptoms: ['ui_loading'],
    evidence: [
      {
        id: 'ev-ext-1',
        type: 'network_error',
        label: 'payment provider unavailable',
        value: {
          status: 503,
          provider: 'payment-gateway',
          external: true,
        },
        source: 'network-observer',
      },
      {
        id: 'ev-ui-1',
        type: 'ui_state',
        label: 'loading > 20s',
        value: { loadingMs: 20000 },
        source: 'frontend-sdk',
      },
      {
        id: 'ev-retry-1',
        type: 'ui_event',
        label: 'retry loop detected',
        value: { retryCount: 6, loop: true },
        source: 'frontend-sdk',
      },
    ],
    ...overrides,
  });
}

export function buildDedupeApiAndUiScenarioContext(
  overrides: Partial<DiagnosisContext> = {},
): DiagnosisContext {
  return buildDiagnosisContext({
    evidence: [
      {
        id: 'ev-api-1',
        type: 'network_error',
        label: 'POST /orders 500',
        value: { status: 500, url: '/api/orders' },
        source: 'network-observer',
      },
      {
        id: 'ev-api-2',
        type: 'network_error',
        label: 'GET /orders 502',
        value: { status: 502, url: '/api/orders' },
        source: 'network-observer',
      },
      {
        id: 'ev-ui-1',
        type: 'ui_state',
        label: 'loading > 10s',
        value: { loadingMs: 10000 },
        source: 'frontend-sdk',
      },
      {
        id: 'ev-ui-2',
        type: 'ui_state',
        label: 'loading > 12s',
        value: { loadingMs: 12000 },
        source: 'frontend-sdk',
      },
    ],
    ...overrides,
  });
}
```

---

# 二、基于场景 fixture 的更短版 `test/integration/rule-engine.service.int.spec.ts`

```ts
import { RuleEngineService } from '../../src/diagnosis/domain/rule-engine/rule-engine.service';
import {
  expectFindingMeta,
  expectNonSymptomRule,
  expectRuleCodeHit,
  expectRuleCodesToContain,
  expectSingleFindingForRule,
  expectSymptomRule,
} from '../helpers/rule-engine-assertions';
import { createRuleEngineServiceForTest } from '../helpers/rule-engine-test.factory';
import {
  buildApi5xxScenarioContext,
  buildApiTimeoutScenarioContext,
  buildDbConnectionExhaustedScenarioContext,
  buildDbSaturationScenarioContext,
  buildDbTimeoutScenarioContext,
  buildDedupeApiAndUiScenarioContext,
  buildExternalDependencyFailureScenarioContext,
  buildFrontendEventLostScenarioContext,
  buildFrontendStateDesyncScenarioContext,
  buildGatewayFailureScenarioContext,
  buildGatewayTimeoutScenarioContext,
  buildInvalidTargetScenarioContext,
  buildMixedFrontendScenarioContext,
  buildRealisticApiDbUiIncidentScenarioContext,
  buildThirdPartyOutageWithUiSymptomsScenarioContext,
  buildThirdPartyRateLimitScenarioContext,
  buildUiDegradationScenarioContext,
  buildUiEmptyStateScenarioContext,
  buildUiErrorToastScenarioContext,
  buildUiLoadingScenarioContext,
  buildUiRetryLoopScenarioContext,
  buildUserActionMissingScenarioContext,
} from '../helpers/rule-engine-scenarios.fixture';

describe('RuleEngineService (integration)', () => {
  let service: RuleEngineService;

  beforeEach(() => {
    service = createRuleEngineServiceForTest();
  });

  describe('user_action / frontend_app rules', () => {
    it('should recall R101 for missing user action', () => {
      const findings = service.evaluate(buildUserActionMissingScenarioContext());

      expectRuleCodeHit(findings, 'R101');
      expectNonSymptomRule(findings, 'R101');
      expectFindingMeta(findings, 'R101', {
        layer: 'user_action',
        cluster: 'missing_user_action',
      });
    });

    it('should recall R102 for invalid target', () => {
      const findings = service.evaluate(buildInvalidTargetScenarioContext());

      expectRuleCodeHit(findings, 'R102');
      expectNonSymptomRule(findings, 'R102');
      expectFindingMeta(findings, 'R102', {
        layer: 'user_action',
        cluster: 'invalid_action_target',
      });
    });

    it('should recall R103 for lost frontend event', () => {
      const findings = service.evaluate(buildFrontendEventLostScenarioContext());

      expectRuleCodeHit(findings, 'R103');
      expectNonSymptomRule(findings, 'R103');
      expectFindingMeta(findings, 'R103', {
        layer: 'frontend_app',
        cluster: 'event_lost',
      });
    });

    it('should recall R104 for frontend state desync', () => {
      const findings = service.evaluate(buildFrontendStateDesyncScenarioContext());

      expectRuleCodeHit(findings, 'R104');
      expectNonSymptomRule(findings, 'R104');
      expectFindingMeta(findings, 'R104', {
        layer: 'frontend_app',
        cluster: 'state_desync',
      });
    });

    it('should allow overlapping frontend root/symptom recalls', () => {
      const findings = service.evaluate(buildMixedFrontendScenarioContext());

      expectRuleCodesToContain(findings, ['R102', 'R103', 'R501']);
      expectSymptomRule(findings, 'R501');
    });
  });

  describe('api / bff rules', () => {
    it('should recall R201 for api 5xx', () => {
      const findings = service.evaluate(buildApi5xxScenarioContext());

      expectRuleCodeHit(findings, 'R201');
      expectNonSymptomRule(findings, 'R201');
      expectFindingMeta(findings, 'R201', {
        layer: 'api',
        cluster: 'api_failure',
      });
    });

    it('should recall R202 for api timeout', () => {
      const findings = service.evaluate(buildApiTimeoutScenarioContext());

      expectRuleCodeHit(findings, 'R202');
      expectNonSymptomRule(findings, 'R202');
      expectFindingMeta(findings, 'R202', {
        layer: 'api',
        cluster: 'api_timeout',
      });
    });

    it('should recall R203 for gateway/bff failure', () => {
      const findings = service.evaluate(buildGatewayFailureScenarioContext());

      expectRuleCodeHit(findings, 'R203');
      expectNonSymptomRule(findings, 'R203');
      expectFindingMeta(findings, 'R203', {
        layer: 'bff',
        cluster: 'gateway_failure',
      });
    });

    it('should allow overlapping R201 + R203 in gateway failure scenario', () => {
      const findings = service.evaluate(buildGatewayFailureScenarioContext());

      expectRuleCodesToContain(findings, ['R201', 'R203']);
    });

    it('should allow overlapping R202 + R203 in gateway timeout scenario', () => {
      const findings = service.evaluate(buildGatewayTimeoutScenarioContext());

      expectRuleCodesToContain(findings, ['R202', 'R203']);
    });
  });

  describe('db rules', () => {
    it('should recall R301 for db timeout', () => {
      const findings = service.evaluate(buildDbTimeoutScenarioContext());

      expectRuleCodeHit(findings, 'R301');
      expectNonSymptomRule(findings, 'R301');
      expectFindingMeta(findings, 'R301', {
        layer: 'db',
        cluster: 'db_timeout',
      });
    });

    it('should recall R302 for db connection exhaustion', () => {
      const findings = service.evaluate(buildDbConnectionExhaustedScenarioContext());

      expectRuleCodeHit(findings, 'R302');
      expectNonSymptomRule(findings, 'R302');
      expectFindingMeta(findings, 'R302', {
        layer: 'db',
        cluster: 'db_connection_exhausted',
      });
    });

    it('should allow overlapping R301 + R302 in db saturation scenario', () => {
      const findings = service.evaluate(buildDbSaturationScenarioContext());

      expectRuleCodesToContain(findings, ['R301', 'R302']);
    });
  });

  describe('external rules', () => {
    it('should recall R401 for external dependency failure', () => {
      const findings = service.evaluate(buildExternalDependencyFailureScenarioContext());

      expectRuleCodeHit(findings, 'R401');
      expectNonSymptomRule(findings, 'R401');
      expectFindingMeta(findings, 'R401', {
        layer: 'external',
        cluster: 'external_dependency_failure',
      });
    });

    it('should recall R402 for third-party rate limit', () => {
      const findings = service.evaluate(buildThirdPartyRateLimitScenarioContext());

      expectRuleCodeHit(findings, 'R402');
      expectNonSymptomRule(findings, 'R402');
      expectFindingMeta(findings, 'R402', {
        layer: 'external',
        cluster: 'third_party_rate_limit',
      });
    });
  });

  describe('ui symptom rules', () => {
    it('should recall R501 for loading symptom', () => {
      const findings = service.evaluate(buildUiLoadingScenarioContext());

      expectRuleCodeHit(findings, 'R501');
      expectSymptomRule(findings, 'R501');
      expectFindingMeta(findings, 'R501', {
        layer: 'ui_state',
        cluster: 'ui_loading',
      });
    });

    it('should recall R502 for error toast symptom', () => {
      const findings = service.evaluate(buildUiErrorToastScenarioContext());

      expectRuleCodeHit(findings, 'R502');
      expectSymptomRule(findings, 'R502');
      expectFindingMeta(findings, 'R502', {
        layer: 'ui_state',
        cluster: 'ui_error_toast',
      });
    });

    it('should recall R503 for empty state symptom', () => {
      const findings = service.evaluate(buildUiEmptyStateScenarioContext());

      expectRuleCodeHit(findings, 'R503');
      expectSymptomRule(findings, 'R503');
      expectFindingMeta(findings, 'R503', {
        layer: 'ui_state',
        cluster: 'ui_empty_state',
      });
    });

    it('should recall R504 for retry loop symptom', () => {
      const findings = service.evaluate(buildUiRetryLoopScenarioContext());

      expectRuleCodeHit(findings, 'R504');
      expectSymptomRule(findings, 'R504');
      expectFindingMeta(findings, 'R504', {
        layer: 'ui_state',
        cluster: 'ui_retry_loop',
      });
    });

    it('should allow multiple ui symptoms to co-exist', () => {
      const findings = service.evaluate(buildUiDegradationScenarioContext());

      expectRuleCodesToContain(findings, ['R501', 'R502', 'R503', 'R504']);
      expectSymptomRule(findings, 'R501');
      expectSymptomRule(findings, 'R502');
      expectSymptomRule(findings, 'R503');
      expectSymptomRule(findings, 'R504');
    });
  });

  describe('mixed realistic scenarios', () => {
    it('should recall root + supporting + symptom findings in api/db/ui incident', () => {
      const findings = service.evaluate(
        buildRealisticApiDbUiIncidentScenarioContext(),
      );

      expectRuleCodesToContain(findings, ['R201', 'R301', 'R501', 'R502']);
      expectNonSymptomRule(findings, 'R201');
      expectNonSymptomRule(findings, 'R301');
      expectSymptomRule(findings, 'R501');
      expectSymptomRule(findings, 'R502');
    });

    it('should recall external + ui symptoms in third-party outage scenario', () => {
      const findings = service.evaluate(
        buildThirdPartyOutageWithUiSymptomsScenarioContext(),
      );

      expectRuleCodesToContain(findings, ['R401', 'R501', 'R504']);
      expectNonSymptomRule(findings, 'R401');
      expectSymptomRule(findings, 'R501');
      expectSymptomRule(findings, 'R504');
    });
  });

  describe('dedupe behavior', () => {
    it('should dedupe findings by ruleCode + layer + cluster', () => {
      const findings = service.evaluate(buildDedupeApiAndUiScenarioContext());

      expectSingleFindingForRule(findings, 'R201');
      expectSingleFindingForRule(findings, 'R501');
    });
  });
});
```

---

# 三、这一版的好处

## 1. integration spec 变成“业务场景表”
现在 spec 读起来更像：

- missing action
- invalid target
- gateway timeout
- db saturation
- third-party outage
- ui degradation

这比直接在 spec 内铺原始 evidence 更适合你后续积累 **MVP 诊断场景资产**。

---

## 2. fixture 可以复用到别的层
这些 scenario fixture 后面还能直接复用到：

- `ranking.service` 集成测试
- `diagnosis-query.service` orchestration 测试
- controller e2e seed 数据
- demo / playground / story-like diagnosis examples

---

## 3. 后续加规则更顺
以后如果你加了新规则，例如 `R204`：

- 补一个 scenario fixture
- 在 int spec 某个 describe 下增加 case
- 如果属于已有场景，还可以只增强现有 scenario

---

# 四、我建议你下一步最值得做的内容

你现在已经把 **规则拆分、规则单测、规则集 integration、场景 fixture** 都搭起来了。  
下一步最自然的是二选一：

## 方向 A：抽 matcher helpers
我可以下一条直接给你：

- `src/diagnosis/domain/rule-engine/matchers/network.matcher.ts`
- `db.matcher.ts`
- `ui-state.matcher.ts`
- `external.matcher.ts`

然后把几条 rule 改造成 matcher 驱动，降低 rule 文件重复判断逻辑。

---

## 方向 B：把 scenario fixture 向上复用到 DiagnosisQueryService
我可以下一条直接给你：

- 基于这些场景 fixture 的
  - `diagnosis-query.service.spec.ts` 重构版
  - `diagnosis-flow.int.spec.ts` 重构版

这会把你现在的“规则场景资产”真正贯穿到 orchestration 层。

如果你愿意，我建议下一条直接做：

> **matcher helpers 首版（network/db/ui/external）+ 选 4 条 rule 的 matcher 化重构示例**