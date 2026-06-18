下面给你一版 **统一 diff 补丁**，包含：

- `test/jest-unit.json`
- `test/jest-int.json`
- `test/jest-e2e.json`
- `package.json` scripts 增补

我按下面前提来写：

- 你当前是 NestJS + Jest
- 保留已有常规脚本
- 新增 diagnosis 专项脚本
- unit / integration / e2e 三层拆分
- diagnosis e2e 目录预留为 `test/e2e/diagnosis`

---

# 统一 diff 补丁

```diff
diff --git a/package.json b/package.json
--- a/package.json
+++ b/package.json
@@ -1,22 +1,36 @@
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
-    "test:e2e": "jest --config ./test/jest-e2e.json"
+    "test:e2e": "jest --config ./test/jest-e2e.json",
+
+    "test:diagnosis:factory": "jest --config ./test/jest-unit.json test/unit/rule-engine/factories/build-rule-finding.spec.ts --runInBand",
+    "test:diagnosis:matchers": "jest --config ./test/jest-unit.json test/unit/rule-engine/matchers --runInBand",
+    "test:diagnosis:rules": "jest --config ./test/jest-unit.json test/unit/rules --runInBand",
+    "test:diagnosis:unit": "jest --config ./test/jest-unit.json test/unit/rule-engine test/unit/rules --runInBand",
+    "test:diagnosis:integration": "jest --config ./test/jest-int.json test/integration/rule-engine.service.int.spec.ts --runInBand",
+    "test:diagnosis:e2e": "jest --config ./test/jest-e2e.json test/e2e/diagnosis --runInBand",
+    "test:diagnosis:engine": "npm run test:diagnosis:unit && npm run test:diagnosis:integration",
+    "test:diagnosis:all": "npm run test:diagnosis:engine && npm run test:diagnosis:e2e",
+
+    "test:diagnosis:matchers:watch": "jest --config ./test/jest-unit.json test/unit/rule-engine/matchers --watch",
+    "test:diagnosis:rules:watch": "jest --config ./test/jest-unit.json test/unit/rules --watch"
   }
 }
diff --git a/test/jest-unit.json b/test/jest-unit.json
new file mode 100644
--- /dev/null
+++ b/test/jest-unit.json
@@ -0,0 +1,24 @@
+{
+  "moduleFileExtensions": ["js", "json", "ts"],
+  "rootDir": "..",
+  "testEnvironment": "node",
+  "testRegex": "test/unit/.*\\.spec\\.ts$",
+  "transform": {
+    "^.+\\.(t|j)s$": "ts-jest"
+  },
+  "moduleNameMapper": {
+    "^src/(.*)$": "<rootDir>/src/$1"
+  },
+  "collectCoverageFrom": [
+    "src/**/*.ts",
+    "!src/main.ts",
+    "!src/**/*.module.ts",
+    "!src/**/*.dto.ts",
+    "!src/**/*.entity.ts",
+    "!src/**/index.ts"
+  ],
+  "coverageDirectory": "./coverage/unit",
+  "clearMocks": true,
+  "restoreMocks": true,
+  "resetMocks": false,
+  "verbose": true
+}
diff --git a/test/jest-int.json b/test/jest-int.json
new file mode 100644
--- /dev/null
+++ b/test/jest-int.json
@@ -0,0 +1,24 @@
+{
+  "moduleFileExtensions": ["js", "json", "ts"],
+  "rootDir": "..",
+  "testEnvironment": "node",
+  "testRegex": "test/integration/.*\\.(int\\.)?spec\\.ts$",
+  "transform": {
+    "^.+\\.(t|j)s$": "ts-jest"
+  },
+  "moduleNameMapper": {
+    "^src/(.*)$": "<rootDir>/src/$1"
+  },
+  "collectCoverageFrom": [
+    "src/**/*.ts",
+    "!src/main.ts",
+    "!src/**/*.module.ts",
+    "!src/**/*.dto.ts",
+    "!src/**/*.entity.ts",
+    "!src/**/index.ts"
+  ],
+  "coverageDirectory": "./coverage/integration",
+  "clearMocks": true,
+  "restoreMocks": true,
+  "resetMocks": false,
+  "verbose": true
+}
diff --git a/test/jest-e2e.json b/test/jest-e2e.json
--- a/test/jest-e2e.json
+++ b/test/jest-e2e.json
@@ -1,12 +1,22 @@
 {
   "moduleFileExtensions": ["js", "json", "ts"],
   "rootDir": "..",
   "testEnvironment": "node",
-  "testRegex": ".e2e-spec.ts$",
+  "testRegex": "test/e2e/.*\\.e2e-spec\\.ts$",
   "transform": {
     "^.+\\.(t|j)s$": "ts-jest"
   },
-  "moduleNameMapper": {}
+  "moduleNameMapper": {
+    "^src/(.*)$": "<rootDir>/src/$1"
+  },
+  "setupFilesAfterEnv": [],
+  "collectCoverageFrom": [
+    "src/**/*.ts",
+    "!src/main.ts",
+    "!src/**/*.module.ts",
+    "!src/**/*.dto.ts",
+    "!src/**/*.entity.ts",
+    "!src/**/index.ts"
+  ],
+  "coverageDirectory": "./coverage/e2e",
+  "clearMocks": true,
+  "restoreMocks": true,
+  "resetMocks": false,
+  "verbose": true
 }
```

---

# 补丁说明

## `package.json`
新增 diagnosis 专项脚本：

- `test:diagnosis:factory`
- `test:diagnosis:matchers`
- `test:diagnosis:rules`
- `test:diagnosis:unit`
- `test:diagnosis:integration`
- `test:diagnosis:e2e`
- `test:diagnosis:engine`
- `test:diagnosis:all`

以及两个 watch 脚本：

- `test:diagnosis:matchers:watch`
- `test:diagnosis:rules:watch`

---

## `test/jest-unit.json`
专门跑：

- `test/unit/**/*.spec.ts`

适合：
- matchers
- finding factory
- rules
- 纯 unit service

---

## `test/jest-int.json`
专门跑：

- `test/integration/**/*.spec.ts`
- `test/integration/**/*.int.spec.ts`

适合：
- rule-engine service integration
- repository/application orchestration integration

---

## `test/jest-e2e.json`
把原本较宽松的：

```json
"testRegex": ".e2e-spec.ts$"
```

收敛到：

```json
"testRegex": "test/e2e/.*\\.e2e-spec\\.ts$"
```

并补齐：

- `moduleNameMapper`
- `collectCoverageFrom`
- `coverageDirectory`
- mock 清理项
- `verbose`

这样和 unit / integration 风格保持一致。

---

# 推荐应用后的验证顺序

改完后建议按这个顺序跑：

```bash
npm run test:diagnosis:factory
npm run test:diagnosis:matchers
npm run test:diagnosis:rules
npm run test:diagnosis:integration
```

如果都通过，再跑：

```bash
npm run test:diagnosis:engine
```

如果你已经有 diagnosis e2e 文件，再跑：

```bash
npm run test:diagnosis:e2e
npm run test:diagnosis:all
```

---

# 一个小提醒

如果你项目当前 **没有** `test/e2e/diagnosis` 目录，  
那么这个脚本：

```bash
npm run test:diagnosis:e2e
```

会因为找不到匹配文件而失败或退出非零，这取决于 jest 配置与版本。

你可以有两个选择：

## 选择 A：先保留脚本，等 e2e 文件落地后再跑
适合你当前推进节奏。

## 选择 B：在 e2e 真正落地前，把
```json
"test:diagnosis:all": "npm run test:diagnosis:engine && npm run test:diagnosis:e2e"
```
先改成：
```json
"test:diagnosis:all": "npm run test:diagnosis:engine"
```

如果你现在还没建 diagnosis e2e，我更建议先用 B。

---

# 如果你要“当前更稳”的 scripts 微调版

如果 diagnosis e2e 还没建，我建议把 `package.json` 里这两行临时改成：

```diff
-    "test:diagnosis:e2e": "jest --config ./test/jest-e2e.json test/e2e/diagnosis --runInBand",
+    "test:diagnosis:e2e": "jest --config ./test/jest-e2e.json test/e2e/diagnosis --runInBand",
     "test:diagnosis:engine": "npm run test:diagnosis:unit && npm run test:diagnosis:integration",
-    "test:diagnosis:all": "npm run test:diagnosis:engine && npm run test:diagnosis:e2e",
+    "test:diagnosis:all": "npm run test:diagnosis:engine",
```

等 e2e 落地后再把 `all` 接回去。

---

如果你愿意，我下一条可以继续直接给你：

**基于这套 `jest-e2e.json` 的 `diagnosis.controller.e2e-spec.ts` skeleton**。