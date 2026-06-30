# TraceLens Extension

浏览器插件（MVP）：以"浏览器插件主采集 + 页面轻桥接补语义"为路线，记录用户交互、网络请求、异常，提交到后端诊断服务进行因果链分析。

## 技术栈

- React 18 + TypeScript + Vite + CRXJS
- 状态管理：Zustand
- 目标：Chrome Extension Manifest V3

## 开发

```bash
pnpm install
pnpm dev
```

在 Chrome 中打开 `chrome://extensions`，开启"开发者模式"，加载 `dist/` 目录。

## 工程结构

```
src/
├── background/   Service Worker：全局状态 + session 上传
├── content/      Content Script：页面采集核心（DOM/网络/错误/路由）
│   └── network/  网络监听 + 业务摘要转换（NetworkInsightTransformer）
├── popup/        Popup UI：录制控制台
├── sidepanel/    SidePanel UI：会话辅助台
└── shared/       公共类型、工具、API 封装
    ├── types/
    ├── constants/
    ├── utils/
    ├── storage/
    ├── api/
    └── state/
```

## 后端对接

诊断服务：`traceLens-server`（NestJS，端口 8080）

- `POST http://localhost:8080/api/v1/diagnosis` — 提交诊断会话
- `GET  http://localhost:8080/api/v1/diagnosis/:taskId` — 查询诊断结果
