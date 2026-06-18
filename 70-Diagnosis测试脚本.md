下面直接给你一套 **可复制的 `package.json` scripts 建议**，按你当前 Diagnosis 测试分层来配：

- `matchers`
- `factories`
- `rules`
- `integration`
- `all`

我先给一个 **最实用版**，默认你用的是 `jest` + `npx jest`，测试目录大致是：

```ts
test/unit/rule-engine/factories/
test/unit/rule-engine/matchers/
test/unit/rules/
test/integration/
```

---

# 一、推荐 scripts（最实用版）

```json
{
  "scripts": {
    "test:diagnosis:factory": "jest test/unit/rule-engine/factories/build-rule-finding.spec.ts --runInBand",
    "test:diagnosis:matchers": "jest test/unit/rule-engine/matchers --runInBand",
    "test:diagnosis:rules": "jest test/unit/rules --runInBand",
    "test:diagnosis:integration": "jest test/integration/rule-engine.service.int.spec.ts --runInBand",
    "test:diagnosis:engine": "jest test/unit/rule-engine test/unit/rules test/integration/rule-engine.service.int.spec.ts --runInBand",
    "test:diagnosis:all": "jest test/unit/rule-engine test/unit/rules test/integration/rule-engine.service.int.spec.ts --runInBand"
  }
}
```

---

# 二、每个 script 的用途

## `test:diagnosis:factory`
只跑 finding factory：

```bash
npm run test:diagnosis:factory
```

适合：
- 改了 `buildRuleFindingFromMatch`
- 改了 `RuleFinding` 输出结构

---

## `test:diagnosis:matchers`
只跑 matcher：

```bash
npm run test:diagnosis:matchers
```

适合：
- 改了 timeout / 5xx / gateway / empty-state / retry-loop 判定
- 调整阈值
- 改 matcher helper

---

## `test:diagnosis:rules`
只跑 rules unit tests：

```bash
npm run test:diagnosis:rules
```

适合：
- 新增 rule
- 改 rule metadata
- 改 cluster / layer / symptom 语义
- 改规则装配逻辑但不涉及 orchestrator

---

## `test:diagnosis:integration`
只跑 rule-engine integration：

```bash
npm run test:diagnosis:integration
```

适合：
- 改 rules registry
- 改 RuleEngineService
- 改 dedupe / recall / ordering 相关逻辑

---

## `test:diagnosis:engine`
跑 diagnosis 规则引擎主干：

```bash
npm run test:diagnosis:engine
```

包含：
- factory
- matchers
- rules
- integration

它基本就是你现在 diagnosis rule engine 的主验证入口。

---

## `test:diagnosis:all`
目前和 `engine` 一样。  
如果你后面再加上：

- controller e2e
- module e2e
- query service integration

那这个脚本可以扩成更完整的 diagnosis 测试总入口。

---

# 三、我更推荐的稍增强版

如果你希望把“unit engine”和“all diagnosis”语义分开，我建议用下面这版。

```json
{
  "scripts": {
    "test:diagnosis:factory": "jest test/unit/rule-engine/factories/build-rule-finding.spec.ts --runInBand",
    "test:diagnosis:matchers": "jest test/unit/rule-engine/matchers --runInBand",
    "test:diagnosis:rules": "jest test/unit/rules --runInBand",
    "test:diagnosis:unit": "jest test/unit/rule-engine test/unit/rules --runInBand",
    "test:diagnosis:integration": "jest test/integration/rule-engine.service.int.spec.ts --runInBand",
    "test:diagnosis:engine": "jest test/unit/rule-engine test/unit/rules test/integration/rule-engine.service.int.spec.ts --runInBand",
    "test:diagnosis:all": "npm run test:diagnosis:engine"
  }
}
```

这个版本更清晰：

- `unit` = factory + matcher + rules
- `integration` = rule-engine integration
- `engine` = unit + integration
- `all` = 当前先等于 engine，后面再扩

我个人更推荐这版。

---

# 四、如果你后面有 controller/module e2e，建议直接预留

如果你已经准备加：

- `diagnosis.controller.e2e-spec.ts`
- `diagnosis.module.e2e-spec.ts`

可以直接预留：

```json
{
  "scripts": {
    "test:diagnosis:factory": "jest test/unit/rule-engine/factories/build-rule-finding.spec.ts --runInBand",
    "test:diagnosis:matchers": "jest test/unit/rule-engine/matchers --runInBand",
    "test:diagnosis:rules": "jest test/unit/rules --runInBand",
    "test:diagnosis:unit": "jest test/unit/rule-engine test/unit/rules --runInBand",
    "test:diagnosis:integration": "jest test/integration/rule-engine.service.int.spec.ts --runInBand",
    "test:diagnosis:e2e": "jest test/e2e/diagnosis --runInBand",
    "test:diagnosis:engine": "jest test/unit/rule-engine test/unit/rules test/integration/rule-engine.service.int.spec.ts --runInBand",
    "test:diagnosis:all": "jest test/unit/rule-engine test/unit/rules test/integration test/e2e/diagnosis --runInBand"
  }
}
```

---

# 五、如果你项目里必须走 Nest 常见命令前缀

有些项目习惯把单测加上 config，例如：

```json
{
  "scripts": {
    "test:diagnosis:factory": "jest --config ./test/jest-unit.json test/unit/rule-engine/factories/build-rule-finding.spec.ts --runInBand",
    "test:diagnosis:matchers": "jest --config ./test/jest-unit.json test/unit/rule-engine/matchers --runInBand",
    "test:diagnosis:rules": "jest --config ./test/jest-unit.json test/unit/rules --runInBand",
    "test:diagnosis:unit": "jest --config ./test/jest-unit.json test/unit/rule-engine test/unit/rules --runInBand",
    "test:diagnosis:integration": "jest --config ./test/jest-int.json test/integration/rule-engine.service.int.spec.ts --runInBand",
    "test:diagnosis:engine": "npm run test:diagnosis:unit && npm run test:diagnosis:integration",
    "test:diagnosis:all": "npm run test:diagnosis:engine"
  }
}
```

如果你项目里已经有：
- `jest.config.js`
- `jest-unit.json`
- `jest-e2e.json`

那建议按现有配置体系接，不要强推单一 config。

---

# 六、我最推荐你现在采用的最终版本

如果你要我帮你做一个“当前阶段最稳”的版本，我建议直接用这个：

```json
{
  "scripts": {
    "test:diagnosis:factory": "jest test/unit/rule-engine/factories/build-rule-finding.spec.ts --runInBand",
    "test:diagnosis:matchers": "jest test/unit/rule-engine/matchers --runInBand",
    "test:diagnosis:rules": "jest test/unit/rules --runInBand",
    "test:diagnosis:unit": "jest test/unit/rule-engine test/unit/rules --runInBand",
    "test:diagnosis:integration": "jest test/integration/rule-engine.service.int.spec.ts --runInBand",
    "test:diagnosis:engine": "jest test/unit/rule-engine test/unit/rules test/integration/rule-engine.service.int.spec.ts --runInBand",
    "test:diagnosis:all": "npm run test:diagnosis:engine"
  }
}
```

---

# 七、为什么我建议都先带 `--runInBand`

因为你现在这个阶段是：

- 结构迁移中
- 文件重命名/替换中
- helper 抽象刚稳定
- 想优先要 **稳定反馈** 而不是最快速度

`--runInBand` 的好处：
- 降低并发导致的噪音
- CI / 本地一致性更高
- 排查 import / fixture 问题更简单

后面等套件稳定了，你可以把：

- `test:diagnosis:rules`
- `test:diagnosis:unit`

去掉 `--runInBand` 来提速。

---

# 八、后续稳定后可升级的版本

当套件稳定后，可以改成：

```json
{
  "scripts": {
    "test:diagnosis:factory": "jest test/unit/rule-engine/factories/build-rule-finding.spec.ts",
    "test:diagnosis:matchers": "jest test/unit/rule-engine/matchers",
    "test:diagnosis:rules": "jest test/unit/rules",
    "test:diagnosis:unit": "jest test/unit/rule-engine test/unit/rules",
    "test:diagnosis:integration": "jest test/integration/rule-engine.service.int.spec.ts --runInBand",
    "test:diagnosis:engine": "npm run test:diagnosis:unit && npm run test:diagnosis:integration",
    "test:diagnosis:all": "npm run test:diagnosis:engine"
  }
}
```

也就是：
- unit 并行
- integration 串行

这个一般是更成熟阶段的配置。

---

# 九、补一个很实用的 watch 脚本

你开发 matcher/rule 时很有用：

```json
{
  "scripts": {
    "test:diagnosis:rules:watch": "jest test/unit/rules --watch",
    "test:diagnosis:matchers:watch": "jest test/unit/rule-engine/matchers --watch"
  }
}
```

如果你经常只改单条规则，还可以再加：

```json
{
  "scripts": {
    "test:diagnosis:r201": "jest test/unit/rules/r201-api-5xx.rule.spec.ts --runInBand",
    "test:diagnosis:r501": "jest test/unit/rules/r501-ui-loading-symptom.rule.spec.ts --runInBand"
  }
}
```

但这种单规则脚本不建议太多，不然 `package.json` 会膨胀。

---

如果你愿意，我下一条可以继续直接给你：

**一版可直接粘贴的完整 `package.json` scripts 区块（含 diagnosis + 现有 Nest 常规 test scripts 的并存写法）**。