import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'TraceLens - 前端诊断助手',
  version: '0.1.0',
  description: '浏览器插件主采集 + 页面轻桥接，记录交互/请求/异常，提交后端进行因果链诊断。',
  action: {
    default_title: '点击打开/关闭 TraceLens 诊断侧边栏',
    default_icon: {
      '16': 'public/icon-16.png',
      '48': 'public/icon-48.png',
      '128': 'public/icon-128.png',
    },
  },
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/index.ts'],
      run_at: 'document_start',
    },
  ],
  permissions: ['activeTab', 'storage', 'sidePanel', 'scripting'],
  host_permissions: ['<all_urls>'],
  icons: {
    '16': 'public/icon-16.png',
    '48': 'public/icon-48.png',
    '128': 'public/icon-128.png',
  },
});
