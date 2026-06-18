下面给你一版 **可直接粘贴的 `package.json` scripts 区块**，包含两部分：

- **Nest 常规 test scripts**
- **Diagnosis 专项 test scripts**

我先给你一个 **通用且稳妥** 的版本，适合大多数 NestJS + Jest 项目。

---

# 推荐版 `scripts`

```json
{
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",

    "lint": "eslint \"{src,test}/**/*.ts\" --fix",

    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:debug": "node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",
    "test:e2e": "jest --config ./test/jest-e2e.json",

    "test:diagnosis:factory": "jest test/unit/rule-engine/factories/build-rule-finding.spec.ts --runInBand",
    "test:diagnosis:matchers": "jest test/unit/rule-engine/matchers --runInBand",
    "test:diagnosis:rules": "jest test/unit/rules --runInBand",
    "test:diagnosis:unit": "jest test/unit/rule-engine test/unit/rules --runInBand",
    "test:diagnosis:integration": "jest test/integration/rule-engine.service.int.spec.ts --runInBand",
    "test:diagnosis:engine": "jest test/unit/rule-engine test/unit/rules test/integration/rule-engine.service.int.spec.ts --runInBand",
    "test:diagnosis:all": "npm run test:diagnosis:engine",

    "test:diagnosis:matchers:watch": "jest test/unit/rule-engine/matchers --watch",
    "test:diagnosis:rules:watch": "jest test/unit/rules --watch"
  }
}
```

---

# 这版的特点

## 保留 Nest 常规命令
- `test`
- `test:watch`
- `test:cov`
- `test:debug`
- `test:e2e`

不会影响团队原来的使用习惯。

## 增加 Diagnosis 专项入口
- `test:diagnosis:factory`
- `test:diagnosis:matchers`
- `test:diagnosis:rules`
- `test:diagnosis:unit`
- `test:diagnosis:integration`
- `test:diagnosis:engine`
- `test:diagnosis:all`

适合你现在这种 Diagnosis 模块单独演进的场景。

---

# 如果你已经有 e2e diagnosis 目录，建议用这个增强版

如果后面你会补：

- `test/e2e/diagnosis/*.spec.ts`

那可以直接换成下面这版。

```json
{
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",

    "lint": "eslint \"{src,test}/**/*.ts\" --fix",

    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:debug": "node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",
    "test:e2e": "jest --config ./test/jest-e2e.json",

    "test:diagnosis:factory": "jest test/unit/rule-engine/factories/build-rule-finding.spec.ts --runInBand",
    "test:diagnosis:matchers": "jest test/unit/rule-engine/matchers --runInBand",
    "test:diagnosis:rules": "jest test/unit/rules --runInBand",
    "test:diagnosis:unit": "jest test/unit/rule-engine test/unit/rules --runInBand",
    "test:diagnosis:integration": "jest test/integration/rule-engine.service.int.spec.ts --runInBand",
    "test:diagnosis:e2e": "jest test/e2e/diagnosis --runInBand",
    "test:diagnosis:engine": "jest test/unit/rule-engine test/unit/rules test/integration/rule-engine.service.int.spec.ts --runInBand",
    "test:diagnosis:all": "jest test/unit/rule-engine test/unit/rules test/integration test/e2e/diagnosis --runInBand",

    "test:diagnosis:matchers:watch": "jest test/unit/rule-engine/matchers --watch",
    "test:diagnosis:rules:watch": "jest test/unit/rules --watch"
  }
}
```

---

# 如果你项目里区分 unit / integration / e2e 的 Jest config，更推荐这版

如果你已经有类似：

- `test/jest-unit.json`
- `test/jest-int.json`
- `test/jest-e2e.json`

那最好接入现有 config，而不是全都走默认 `jest`。

```json
{
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",

    "lint": "eslint \"{src,test}/**/*.ts\" --fix",

    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:debug": "node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",
    "test:e2e": "jest --config ./test/jest-e2e.json",

    "test:diagnosis:factory": "jest --config ./test/jest-unit.json test/unit/rule-engine/factories/build-rule-finding.spec.ts --runInBand",
    "test:diagnosis:matchers": "jest --config ./test/jest-unit.json test/unit/rule-engine/matchers --runInBand",
    "test:diagnosis:rules": "jest --config ./test/jest-unit.json test/unit/rules --runInBand",
    "test:diagnosis:unit": "jest --config ./test/jest-unit.json test/unit/rule-engine test/unit/rules --runInBand",
    "test:diagnosis:integration": "jest --config ./test/jest-int.json test/integration/rule-engine.service.int.spec.ts --runInBand",
    "test:diagnosis:e2e": "jest --config ./test/jest-e2e.json test/e2e/diagnosis --runInBand",
    "test:diagnosis:engine": "npm run test:diagnosis:unit && npm run test:diagnosis:integration",
    "test:diagnosis:all": "npm run test:diagnosis:engine && npm run test:diagnosis:e2e",

    "test:diagnosis:matchers:watch": "jest --config ./test/jest-unit.json test/unit/rule-engine/matchers --watch",
    "test:diagnosis:rules:watch": "jest --config ./test/jest-unit.json test/unit/rules --watch"
  }
}
```

---

# 我建议你当前阶段优先采用哪版

基于你现在的状态，我建议优先用 **第一版** 或 **第三版**：

## 用第一版，如果：
- 你现在只有一个 Jest 主配置
- 还没拆 unit/int/e2e config
- 想先快速落地

## 用第三版，如果：
- 你项目里已经有独立的 Jest config
- integration / e2e 初始化方式不同
- 你想长期更规范

---

# 我个人最推荐你现在直接粘贴的版本

如果要我替你拍板，我建议直接用这个：

```json
{
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",

    "lint": "eslint \"{src,test}/**/*.ts\" --fix",

    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:debug": "node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",
    "test:e2e": "jest --config ./test/jest-e2e.json",

    "test:diagnosis:factory": "jest test/unit/rule-engine/factories/build-rule-finding.spec.ts --runInBand",
    "test:diagnosis:matchers": "jest test/unit/rule-engine/matchers --runInBand",
    "test:diagnosis:rules": "jest test/unit/rules --runInBand",
    "test:diagnosis:unit": "jest test/unit/rule-engine test/unit/rules --runInBand",
    "test:diagnosis:integration": "jest test/integration/rule-engine.service.int.spec.ts --runInBand",
    "test:diagnosis:engine": "jest test/unit/rule-engine test/unit/rules test/integration/rule-engine.service.int.spec.ts --runInBand",
    "test:diagnosis:all": "npm run test:diagnosis:engine",

    "test:diagnosis:matchers:watch": "jest test/unit/rule-engine/matchers --watch",
    "test:diagnosis:rules:watch": "jest test/unit/rules --watch"
  }
}
```

---

如果你愿意，我下一条可以继续直接给你：

**一版 `package.json` 完整 diff 风格补丁**，按“已有常规 Nest scripts + 新增 diagnosis scripts”的形式输出，方便你直接改。