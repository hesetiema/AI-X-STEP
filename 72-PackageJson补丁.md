下面给你一版 **`package.json` 完整 diff 风格补丁**。  
我按“**已有常规 Nest scripts 保留 + 新增 diagnosis scripts**”来写。

我先假设你当前 `scripts` 大致接近 Nest 默认模板：

- `build`
- `start`
- `start:dev`
- `start:debug`
- `start:prod`
- `lint`
- `test`
- `test:watch`
- `test:cov`
- `test:debug`
- `test:e2e`

如果你当前脚本有少量差异，也可以直接按这个 diff 的思路合进去。

---

# 方案 A：基于单一 Jest 配置的 diff 补丁

```diff
diff --git a/package.json b/package.json
--- a/package.json
+++ b/package.json
@@ -1,22 +1,34 @@
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
+    "test:diagnosis:factory": "jest test/unit/rule-engine/factories/build-rule-finding.spec.ts --runInBand",
+    "test:diagnosis:matchers": "jest test/unit/rule-engine/matchers --runInBand",
+    "test:diagnosis:rules": "jest test/unit/rules --runInBand",
+    "test:diagnosis:unit": "jest test/unit/rule-engine test/unit/rules --runInBand",
+    "test:diagnosis:integration": "jest test/integration/rule-engine.service.int.spec.ts --runInBand",
+    "test:diagnosis:engine": "jest test/unit/rule-engine test/unit/rules test/integration/rule-engine.service.int.spec.ts --runInBand",
+    "test:diagnosis:all": "npm run test:diagnosis:engine",
+
+    "test:diagnosis:matchers:watch": "jest test/unit/rule-engine/matchers --watch",
+    "test:diagnosis:rules:watch": "jest test/unit/rules --watch"
   }
 }
```

---

# 方案 B：如果你已经拆了 `jest-unit / jest-int / jest-e2e` 配置

如果你项目里已经有：

- `test/jest-unit.json`
- `test/jest-int.json`
- `test/jest-e2e.json`

那更推荐用下面这个 diff。

```diff
diff --git a/package.json b/package.json
--- a/package.json
+++ b/package.json
@@ -1,22 +1,34 @@
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
```

---

# 我建议你当前优先用哪版

## 用方案 A，如果：
- 你现在没有拆多个 jest config
- 想先快速落地 diagnosis 测试命令
- 当前主要是 unit + integration 验证 rule engine

## 用方案 B，如果：
- 你已经在工程里区分 unit / integration / e2e
- 不同测试初始化方式不同
- 想让 diagnosis scripts 和现有测试体系严格一致

---

# 额外给你一版“可直接替换 scripts 节点”的完整块

如果你不想看 diff，想直接替换 `scripts`，可以用这版。

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

# 推荐你落地后的最小验证顺序

改完 `package.json` 后，先跑这 4 个：

```bash
npm run test:diagnosis:factory
npm run test:diagnosis:matchers
npm run test:diagnosis:rules
npm run test:diagnosis:integration
```

都通了，再跑：

```bash
npm run test:diagnosis:engine
```

---

如果你愿意，我下一条可以继续给你：

**`jest-unit.json` / `jest-int.json` / `jest-e2e.json` 的一版建议拆分模板**，方便你把 diagnosis 的 unit / integration / e2e 彻底分开。