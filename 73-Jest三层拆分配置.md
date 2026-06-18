下面直接给你一版 **可落地的 Jest 拆分模板**：

- `test/jest-unit.json`
- `test/jest-int.json`
- `test/jest-e2e.json`

目标是把 Diagnosis 的：

- unit
- integration
- e2e

彻底拆开，但又不破坏 Nest 常规测试习惯。

---

# 一、先说推荐原则

我建议你这样分：

## `jest-unit.json`
跑：
- `test/unit/**`

特点：
- 快
- 纯单测
- 不依赖 Nest app 启动
- 适合 rule / matcher / factory / service pure unit

---

## `jest-int.json`
跑：
- `test/integration/**`

特点：
- 允许模块间协作验证
- 可以有更多 fixture / repository mock
- 仍不一定要求完整 e2e HTTP 启动

---

## `jest-e2e.json`
跑：
- `test/e2e/**`

特点：
- Nest app / controller / supertest
- 完整请求入口验证
- 通常最慢

---

# 二、推荐目录结构

建议先统一成：

```ts
test/
  jest-unit.json
  jest-int.json
  jest-e2e.json

  helpers/
    diagnosis-context.fixture.ts
    rule-engine-assertions.ts
    rule-engine-scenarios.fixture.ts
    rule-engine-test.factory.ts
    rule-unit-assertions.ts

  unit/
    rule-engine/
      factories/
      matchers/
    rules/

  integration/
    rule-engine.service.int.spec.ts

  e2e/
    diagnosis/
      diagnosis.controller.e2e-spec.ts
      diagnosis.module.e2e-spec.ts
```

---

# 三、`test/jest-unit.json`

这是最核心的。

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "..",
  "testEnvironment": "node",
  "testRegex": "test/unit/.*\\.spec\\.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  "moduleNameMapper": {
    "^src/(.*)$": "<rootDir>/src/$1"
  },
  "collectCoverageFrom": [
    "src/**/*.ts",
    "!src/main.ts",
    "!src/**/*.module.ts",
    "!src/**/*.dto.ts",
    "!src/**/*.entity.ts",
    "!src/**/index.ts"
  ],
  "coverageDirectory": "./coverage/unit",
  "clearMocks": true,
  "restoreMocks": true,
  "resetMocks": false,
  "verbose": true
}
```

---

# 四、`test/jest-int.json`

Integration 配置建议和 unit 接近，但单独输出 coverage，并只匹配 `test/integration`。

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "..",
  "testEnvironment": "node",
  "testRegex": "test/integration/.*\\.(int\\.)?spec\\.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  "moduleNameMapper": {
    "^src/(.*)$": "<rootDir>/src/$1"
  },
  "collectCoverageFrom": [
    "src/**/*.ts",
    "!src/main.ts",
    "!src/**/*.module.ts",
    "!src/**/*.dto.ts",
    "!src/**/*.entity.ts",
    "!src/**/index.ts"
  ],
  "coverageDirectory": "./coverage/integration",
  "clearMocks": true,
  "restoreMocks": true,
  "resetMocks": false,
  "verbose": true
}
```

---

# 五、`test/jest-e2e.json`

这是 Nest 常见 e2e 配置的增强版。

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "..",
  "testEnvironment": "node",
  "testRegex": "test/e2e/.*\\.e2e-spec\\.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  "moduleNameMapper": {
    "^src/(.*)$": "<rootDir>/src/$1"
  },
  "setupFilesAfterEnv": [],
  "collectCoverageFrom": [
    "src/**/*.ts",
    "!src/main.ts",
    "!src/**/*.module.ts",
    "!src/**/*.dto.ts",
    "!src/**/*.entity.ts",
    "!src/**/index.ts"
  ],
  "coverageDirectory": "./coverage/e2e",
  "clearMocks": true,
  "restoreMocks": true,
  "resetMocks": false,
  "verbose": true
}
```

---

# 六、如果你项目里已经有 `jest` 主配置，建议如何配合

通常你项目里可能已经有：

- `package.json` 里的 `"jest": {...}`
- 或 `jest.config.js`

这时我的建议是：

## 主配置继续服务默认 `npm test`
而 `jest-unit/int/e2e.json` 作为**专项入口**

也就是：

- `npm test` 继续按现有项目习惯跑
- `npm run test:diagnosis:*` 专门走拆分配置

这样迁移成本最低。

---

# 七、推荐 scripts 搭配方式

如果你采用上面三份 config，建议 scripts 用这版：

```json
{
  "scripts": {
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
    "test:diagnosis:all": "npm run test:diagnosis:engine && npm run test:diagnosis:e2e"
  }
}
```

---

# 八、为什么这些配置适合你当前阶段

因为你当前 Diagnosis 模块已经形成了比较稳定的测试分层：

## unit
- matchers
- finding factory
- rules

## integration
- rule-engine orchestrator / registry / dedupe / overlap

## e2e
- controller / module semi-real flow

拆开之后有几个好处：

### 1. 执行更准
你改 matcher，不需要顺手跑 e2e。

### 2. 失败定位更快
一看是 `unit` 还是 `integration` 还是 `e2e`。

### 3. CI 可分阶段
可以先：
- unit
- integration
- e2e

逐步 fail fast。

---

# 九、可选增强项

如果你想更进一步稳一点，可以给 unit 配置加上：

```json
"testPathIgnorePatterns": [
  "/node_modules/",
  "/dist/",
  "/test/integration/",
  "/test/e2e/"
]
```

给 integration 配置加：

```json
"testPathIgnorePatterns": [
  "/node_modules/",
  "/dist/",
  "/test/e2e/"
]
```

给 e2e 配置加：

```json
"testPathIgnorePatterns": [
  "/node_modules/",
  "/dist/"
]
```

不过如果 `testRegex` 已经足够明确，这不是必须。

---

# 十、可直接粘贴版

下面是三份最终版，直接可用。

---

## `test/jest-unit.json`

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "..",
  "testEnvironment": "node",
  "testRegex": "test/unit/.*\\.spec\\.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  "moduleNameMapper": {
    "^src/(.*)$": "<rootDir>/src/$1"
  },
  "collectCoverageFrom": [
    "src/**/*.ts",
    "!src/main.ts",
    "!src/**/*.module.ts",
    "!src/**/*.dto.ts",
    "!src/**/*.entity.ts",
    "!src/**/index.ts"
  ],
  "coverageDirectory": "./coverage/unit",
  "clearMocks": true,
  "restoreMocks": true,
  "resetMocks": false,
  "verbose": true
}
```

---

## `test/jest-int.json`

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "..",
  "testEnvironment": "node",
  "testRegex": "test/integration/.*\\.(int\\.)?spec\\.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  "moduleNameMapper": {
    "^src/(.*)$": "<rootDir>/src/$1"
  },
  "collectCoverageFrom": [
    "src/**/*.ts",
    "!src/main.ts",
    "!src/**/*.module.ts",
    "!src/**/*.dto.ts",
    "!src/**/*.entity.ts",
    "!src/**/index.ts"
  ],
  "coverageDirectory": "./coverage/integration",
  "clearMocks": true,
  "restoreMocks": true,
  "resetMocks": false,
  "verbose": true
}
```

---

## `test/jest-e2e.json`

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "..",
  "testEnvironment": "node",
  "testRegex": "test/e2e/.*\\.e2e-spec\\.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  "moduleNameMapper": {
    "^src/(.*)$": "<rootDir>/src/$1"
  },
  "setupFilesAfterEnv": [],
  "collectCoverageFrom": [
    "src/**/*.ts",
    "!src/main.ts",
    "!src/**/*.module.ts",
    "!src/**/*.dto.ts",
    "!src/**/*.entity.ts",
    "!src/**/index.ts"
  ],
  "coverageDirectory": "./coverage/e2e",
  "clearMocks": true,
  "restoreMocks": true,
  "resetMocks": false,
  "verbose": true
}
```

---

# 十一、我建议你下一步最适合做的事

如果你已经准备真正开始落文件，我建议下一步直接做其中一个：

## 方向 A
我直接给你：
- **这三份 jest config 的 diff 风格补丁**
- 外加 `package.json` scripts 一起合并的补丁

## 方向 B
我直接给你：
- **Diagnosis controller e2e skeleton**
- 并对齐到这套 `jest-e2e.json`

如果按你当前推进顺序，我更建议下一条直接做：

> **`jest-unit.json / jest-int.json / jest-e2e.json + package.json scripts` 的统一 diff 补丁**