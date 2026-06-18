下面直接给你 **`RuleEngineService` 的 Jest 单测升级版**，按你现在这版架构来写：

- `RuleEngineService` 依赖 `DiagnosisRuleRegistry`
- registry 返回多个 rule
- engine 执行全部规则
- 过滤 `null`
- 做 `dedupe`

我会给你两种写法里的 **推荐版**：

1. **纯单测版**：mock `DiagnosisRuleRegistry`
2. **轻量 Nest TestingModule 版**：如果你想保持 Nest 风格

对于当前阶段，我建议优先用 **纯单测版**，更稳、更快。

---

# 1. 被测对象回顾

你现在的 `RuleEngineService` 大概是这样：

```ts
@Injectable()
export class RuleEngineService {
  constructor(private readonly diagnosisRuleRegistry: DiagnosisRuleRegistry) {}

  run(context: DiagnosisContext): RuleFinding[] {
    const findings = this.diagnosisRuleRegistry
      .getRules()
      .map((rule) => rule.evaluate(context))
      .filter((item): item is RuleFinding => !!item);

    return this.dedupeFindings(findings);
  }

  private dedupeFindings(findings: RuleFinding[]): RuleFinding[] {
    const map = new Map<string, RuleFinding>();

    for (const item of findings) {
      const key = `${item.ruleCode}::${item.layer}::${item.cluster ?? ''}`;
      if (!map.has(key)) {
        map.set(key, item);
      }
    }

    return [...map.values()];
  }
}
```

所以测试重点应该是：

- 调用了 registry 的 `getRules`
- 每条规则都收到了同一个 `context`
- `null` 会被过滤
- 多规则同时命中时都能返回
- 同 key 的 finding 会被去重
- 不同 key 的 finding 不会被误去重

---

# 2. 推荐文件位置

```bash
src/modules/diagnosis/__tests__/rule-engine.service.spec.ts
```

---

# 3. 完整 Jest 单测代码

## `src/modules/diagnosis/__tests__/rule-engine.service.spec.ts`

```ts
import { RuleEngineService } from '../domain/services/rule-engine.service';
import { DiagnosisRuleRegistry } from '../domain/rules/registry/diagnosis-rule.registry';
import { DiagnosisContext } from '../domain/models/diagnosis-context.model';
import { RuleFinding } from '../domain/models/rule-finding.model';
import { DiagnosisRule } from '../domain/rules/interfaces/diagnosis-rule.interface';

describe('RuleEngineService', () => {
  let service: RuleEngineService;
  let registry: jest.Mocked<Pick<DiagnosisRuleRegistry, 'getRules'>>;

  const buildContext = (
    overrides: Partial<DiagnosisContext> = {},
  ): DiagnosisContext =>
    ({
      diagnosisId: 'diag_test',
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
    cluster: 'test_cluster',
    summary: 'test summary',
    evidenceRefs: [],
    suggestions: [],
    isSymptomOnly: false,
    ...overrides,
  });

  const buildRule = (
    code: string,
    result: RuleFinding | null,
  ): DiagnosisRule => ({
    code,
    evaluate: jest.fn().mockReturnValue(result),
  });

  beforeEach(() => {
    registry = {
      getRules: jest.fn(),
    };

    service = new RuleEngineService(
      registry as unknown as DiagnosisRuleRegistry,
    );
  });

  it('should call registry.getRules once', () => {
    registry.getRules.mockReturnValue([]);

    service.run(buildContext());

    expect(registry.getRules).toHaveBeenCalledTimes(1);
  });

  it('should execute every rule with the same context', () => {
    const context = buildContext({
      responseSuccess: true,
      apiValue: 0,
    });

    const rule1 = buildRule('R101', null);
    const rule2 = buildRule('R201', null);
    const rule3 = buildRule('R501', null);

    registry.getRules.mockReturnValue([rule1, rule2, rule3]);

    service.run(context);

    expect(rule1.evaluate).toHaveBeenCalledWith(context);
    expect(rule2.evaluate).toHaveBeenCalledWith(context);
    expect(rule3.evaluate).toHaveBeenCalledWith(context);
  });

  it('should return empty array when no rule matches', () => {
    const rule1 = buildRule('R101', null);
    const rule2 = buildRule('R201', null);

    registry.getRules.mockReturnValue([rule1, rule2]);

    const result = service.run(buildContext());

    expect(result).toEqual([]);
  });

  it('should filter out null results and return matched findings', () => {
    const finding1 = buildFinding({
      ruleCode: 'R101',
      layer: 'api',
      cluster: 'api_field_missing',
    });
    const finding2 = buildFinding({
      ruleCode: 'R201',
      layer: 'render',
      cluster: 'formatter_falsy_swallowed',
    });

    const rule1 = buildRule('R101', finding1);
    const rule2 = buildRule('R102', null);
    const rule3 = buildRule('R201', finding2);

    registry.getRules.mockReturnValue([rule1, rule2, rule3]);

    const result = service.run(buildContext());

    expect(result).toHaveLength(2);
    expect(result).toEqual([finding1, finding2]);
  });

  it('should support multiple rules matching at the same time', () => {
    const finding1 = buildFinding({
      ruleCode: 'R101',
      layer: 'api',
      cluster: 'api_field_missing',
    });
    const finding2 = buildFinding({
      ruleCode: 'R102',
      layer: 'api',
      cluster: 'api_binding_invalid',
    });
    const finding3 = buildFinding({
      ruleCode: 'R501',
      layer: 'ui',
      cluster: 'fallback_displayed',
      isSymptomOnly: true,
    });

    registry.getRules.mockReturnValue([
      buildRule('R101', finding1),
      buildRule('R102', finding2),
      buildRule('R501', finding3),
    ]);

    const result = service.run(buildContext());

    expect(result).toHaveLength(3);
    expect(result.map((item) => item.ruleCode)).toEqual([
      'R101',
      'R102',
      'R501',
    ]);
  });

  it('should dedupe findings by ruleCode + layer + cluster', () => {
    const findingA = buildFinding({
      ruleCode: 'R201',
      layer: 'render',
      cluster: 'formatter_falsy_swallowed',
      summary: 'first finding',
    });

    const findingB = buildFinding({
      ruleCode: 'R201',
      layer: 'render',
      cluster: 'formatter_falsy_swallowed',
      summary: 'duplicate finding should be removed',
    });

    registry.getRules.mockReturnValue([
      buildRule('R201-A', findingA),
      buildRule('R201-B', findingB),
    ]);

    const result = service.run(buildContext());

    expect(result).toHaveLength(1);
    expect(result[0].summary).toBe('first finding');
  });

  it('should not dedupe findings when cluster is different', () => {
    const findingA = buildFinding({
      ruleCode: 'R201',
      layer: 'render',
      cluster: 'cluster_a',
    });

    const findingB = buildFinding({
      ruleCode: 'R201',
      layer: 'render',
      cluster: 'cluster_b',
    });

    registry.getRules.mockReturnValue([
      buildRule('R201-A', findingA),
      buildRule('R201-B', findingB),
    ]);

    const result = service.run(buildContext());

    expect(result).toHaveLength(2);
  });

  it('should not dedupe findings when layer is different', () => {
    const findingA = buildFinding({
      ruleCode: 'R501',
      layer: 'ui',
      cluster: 'fallback_displayed',
    });

    const findingB = buildFinding({
      ruleCode: 'R501',
      layer: 'dom',
      cluster: 'fallback_displayed',
    });

    registry.getRules.mockReturnValue([
      buildRule('R501-ui', findingA),
      buildRule('R501-dom', findingB),
    ]);

    const result = service.run(buildContext());

    expect(result).toHaveLength(2);
  });

  it('should treat undefined cluster as empty string in dedupe key', () => {
    const findingA = buildFinding({
      ruleCode: 'R302',
      layer: 'dom',
      cluster: undefined,
      summary: 'first',
    });

    const findingB = buildFinding({
      ruleCode: 'R302',
      layer: 'dom',
      cluster: undefined,
      summary: 'second',
    });

    registry.getRules.mockReturnValue([
      buildRule('R302-A', findingA),
      buildRule('R302-B', findingB),
    ]);

    const result = service.run(buildContext());

    expect(result).toHaveLength(1);
    expect(result[0].summary).toBe('first');
  });

  it('should preserve original order for unique findings', () => {
    const finding1 = buildFinding({
      ruleCode: 'R103',
      layer: 'state',
      cluster: 'state_missing',
    });

    const finding2 = buildFinding({
      ruleCode: 'R201',
      layer: 'render',
      cluster: 'render_fallback',
    });

    const finding3 = buildFinding({
      ruleCode: 'R301',
      layer: 'dom',
      cluster: 'dom_hidden',
    });

    registry.getRules.mockReturnValue([
      buildRule('R103', finding1),
      buildRule('R201', finding2),
      buildRule('R301', finding3),
    ]);

    const result = service.run(buildContext());

    expect(result.map((item) => item.ruleCode)).toEqual([
      'R103',
      'R201',
      'R301',
    ]);
  });
});
```

---

# 4. 这个版本测到了什么

这版已经覆盖了 `RuleEngineService` 的核心契约：

---

## 4.1 registry 调用
```ts
should call registry.getRules once
```

---

## 4.2 规则执行上下文一致
```ts
should execute every rule with the same context
```

这个很重要，能防止后面有人在 engine 里对 context 做中途 mutate。

---

## 4.3 null 过滤
```ts
should return empty array when no rule matches
should filter out null results and return matched findings
```

---

## 4.4 多规则同时命中
```ts
should support multiple rules matching at the same time
```

这正好对应你之前定下来的策略：  
**R101 / R102、R201 / R202 等允许重叠命中。**

---

## 4.5 dedupe 行为
```ts
should dedupe findings by ruleCode + layer + cluster
should not dedupe findings when cluster is different
should not dedupe findings when layer is different
should treat undefined cluster as empty string in dedupe key
```

这几条是“升级版”的核心价值，不只是测跑通，而是在锁定你的 engine 契约。

---

## 4.6 返回顺序稳定
```ts
should preserve original order for unique findings
```

这个对后面的 ranking/debug 都有价值。  
虽然最后排序会在 `RankingService` 做，但 rule engine 输出顺序稳定，便于排查问题。

---

# 5. 一个你现在应该注意的小问题

你当前这个测试里有一条：

```ts
const buildRule = (code: string, result: RuleFinding | null): DiagnosisRule => ({
  code,
  evaluate: jest.fn().mockReturnValue(result),
});
```

这里的 `code` 只是 mock rule 自己的 `code`，而 dedupe 用的是 `finding.ruleCode`，不是 `rule.code`。  
这是故意这样写的，因为你现在 engine 的去重逻辑确实是：

```ts
item.ruleCode + item.layer + item.cluster
```

所以这组测试是在**精确锁定当前实现行为**。  
如果未来你改成按 `rule.code` 去重，测试也会提醒你行为变了。

---

# 6. 如果你想更贴近 Nest TestingModule，可用这个版本

如果你更偏好 Nest 风格，也可以用一个轻量版本：

## 可选写法示意

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { RuleEngineService } from '../domain/services/rule-engine.service';
import { DiagnosisRuleRegistry } from '../domain/rules/registry/diagnosis-rule.registry';

describe('RuleEngineService (Nest)', () => {
  let service: RuleEngineService;
  let registry: { getRules: jest.Mock };

  beforeEach(async () => {
    registry = {
      getRules: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RuleEngineService,
        {
          provide: DiagnosisRuleRegistry,
          useValue: registry,
        },
      ],
    }).compile();

    service = module.get(RuleEngineService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
```

但老实说，**对这个 service 来说没必要**。  
纯单测已经足够，而且更快。

---

# 7. 我建议你下一步顺手再补的两个 spec

现在最自然的后续是：

---

## 7.1 `DiagnosisRuleRegistry` 的单测
验证：
- 返回的 rule 列表完整
- 顺序符合预期
- 后面如果加 `mode` 过滤，也能直接测

---

## 7.2 `RuleEngineService` 的“真实规则集集成测试”
不是 mock rule，而是真注入：
- `R101`
- `R102`
- `R201`
- `R501`

然后给一个 context，断言：
- 哪几条规则会一起命中
- 哪些不会命中

这类测试很适合防止规则改动导致系统行为漂移。

---

# 8. 我推荐你下一条直接做什么

如果按工程推进顺序，现在最适合继续的是：

### 方案 A
**DiagnosisRuleRegistry 的 Jest 单测**

### 方案 B
**RuleEngineService + 真实规则集 的集成测试 stub**

### 方案 C
**把前面 rule 单测里的 `buildContext` 全部抽到 helper，并统一 import**

---

我建议下一步直接做：  
**B. RuleEngineService + 真实规则集 的集成测试 stub**。