// content/index.ts
// Content Script 入口 —— 整合所有 observer，接收 background 消息控制录制生命周期

import { recorder } from './recorder';
import { DomObserver } from './dom-observer';
import { ErrorObserver } from './error-observer';
import { RouteObserver } from './route-observer';
import { NetworkObserver } from './network';
import { BridgeListener } from './bridge-listener';
import { UiSymptomDetector } from './ui-symptom-detector';
import { readPageContext } from './page-context-reader';
import { loadSession } from '@/shared/storage/session-store';
import type { RuntimeMessage, DiagnosisSession } from '@/shared/types';

const domObserver = new DomObserver(recorder);
const errorObserver = new ErrorObserver(recorder);
const routeObserver = new RouteObserver(recorder);
const networkObserver = new NetworkObserver(recorder);
const bridgeListener = new BridgeListener(recorder);
const symptomDetector = new UiSymptomDetector(recorder);

async function startRecording(): Promise<void> {
  if (recorder.isActive) return;
  // 确保拿到真实 tabId（storage key 依赖它）；解析失败回退 0 不影响内存录制
  const tabId = (await resolveTabId()) ?? 0;
  resolvedTabId = tabId;
  const pageContext = readPageContext();
  recorder.start({
    tabId,
    initialPageContext: pageContext,
  });
  startAllObservers();
  console.log('[TraceLens] recording started', pageContext.url);
}

function stopRecording(): void {
  if (!recorder.isActive) return;
  domObserver.stop();
  errorObserver.stop();
  routeObserver.stop();
  networkObserver.stop();
  bridgeListener.stop();
  symptomDetector.stop();
  const session = recorder.stop();
  console.log('[TraceLens] recording stopped', session?.events.length ?? 0, 'events');
}

/**
 * 继续录制 —— 不清除已有事件，重新启动所有 observer。
 * 与 startRecording 的区别：不调用 recorder.start()（会清空 buffer），
 * 而是直接将 recorder 状态恢复为 recording 并重启 observer。
 */
async function resumeRecording(): Promise<void> {
  if (recorder.isActive) return;
  // 内存 session 可能在硬跳转后丢失（只读恢复未重建 session）：
  // 此时从 storage 重建 recording session + 恢复旧事件。
  if (!recorder.currentSession) {
    const tabId = (await resolveTabId()) ?? 0;
    if (tabId > 0) {
      await recorder.resumeFromPersisted(tabId);
      startAllObservers();
      console.log('[TraceLens] recording resumed from storage', recorder.getStats());
      return;
    }
  }
  // 恢复 session 状态为 recording，不清空已有事件
  recorder.setStatus('recording');
  // 清除 stop() 时写入的 endedAt，因为录制仍在继续
  if (recorder.currentSession) {
    recorder.currentSession.endedAt = undefined;
  }
  startAllObservers();
  console.log('[TraceLens] recording resumed', recorder.getStats());
}

// content script 没有 chrome.tabs API，需向 background 请求自身 tabId。
// 缓存解析结果，供 storage key 使用。
let resolvedTabId: number | null = null;

async function resolveTabId(): Promise<number | null> {
  if (resolvedTabId !== null) return resolvedTabId;
  try {
    const res = await chrome.runtime.sendMessage({ type: 'GET_TAB_ID' });
    if (res && res.ok && typeof res.tabId === 'number') {
      resolvedTabId = res.tabId;
      return resolvedTabId;
    }
  } catch {
    // background 未就绪，静默
  }
  return null;
}

/**
 * content script 启动时：解析 tabId，从 storage 恢复持久化会话。
 * - 若上一会话仍在 recording（硬跳转中断的录制）：自动续录 —— 重建 session、恢复旧事件、
 *   启动所有 observer，让事件流无缝继续。
 * - 若已 stopped 或仅查看：只读灌入 buffer（status 保持 idle），供 SidePanel 查看/提交。
 */
async function initFromPersistedSession(): Promise<void> {
  const tabId = await resolveTabId();
  if (tabId === null) return;
  let persisted = await recorder.loadPersistedSession(tabId);
  // 首次安装/SW 未就绪时 setAccessLevel 可能尚未生效，导致读不到 storage；短暂等待后重试一次。
  if (!persisted) {
    await new Promise((r) => setTimeout(r, 500));
    persisted = await recorder.loadPersistedSession(tabId);
  }
  if (!persisted) return;
  if (persisted.status === 'recording' && !recorder.isActive) {
    // 自动续录：恢复 session + 旧事件，启动 observer
    await recorder.resumeFromPersisted(tabId);
    startAllObservers();
    console.log('[TraceLens] auto-resumed recording after navigation', recorder.getStats());
  } else {
    // 只读恢复（已停止的会话）
    await recorder.loadPersistedIntoBuffer(tabId);
  }
}

/** 启动全部 observer（startRecording / resumeRecording / 自动续录共用）。 */
function startAllObservers(): void {
  domObserver.start();
  errorObserver.start();
  routeObserver.start();
  networkObserver.start();
  bridgeListener.start();
  symptomDetector.start();
}

void initFromPersistedSession();

// 接收 background / popup 的消息
chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  handleContentMessage(message)
    .then((result) => sendResponse(result))
    .catch(() => sendResponse({ ok: false, error: 'content message handler failed' }));
  return true; // 保持 channel 开放以异步响应
});

async function handleContentMessage(message: RuntimeMessage): Promise<unknown> {
  switch (message.type) {
    case 'START_RECORDING':
      await startRecording();
      return { ok: true, status: recorder.status };
    case 'STOP_RECORDING':
      stopRecording();
      return { ok: true, status: recorder.status, stats: recorder.getStats() };
    case 'RESUME_RECORDING':
      await resumeRecording();
      return { ok: true, status: recorder.status, stats: recorder.getStats() };
    case 'GET_SESSION_STATUS':
      return { ok: true, status: recorder.status, stats: recorder.getStats() };
    case 'GET_SESSION_STATS':
      return { ok: true, stats: recorder.getStats() };
    case 'FETCH_SESSION': {
      // 优先返回内存中的 session；若内存为空（如硬跳转后从未续录），
      // 从 storage 兜底构造 session，保证上传能拿到跨页保留的事件。
      stopRecording();
      let session = recorder.currentSession;
      if (!session) {
        const tabId = (await resolveTabId()) ?? 0;
        session = await buildSessionFromStorage(tabId);
      }
      return { ok: true, session };
    }
    case 'FETCH_EVENTS':
      // 返回当前事件快照给 sidepanel 实时展示
      return { ok: true, events: recorder.getSnapshot(), stats: recorder.getStats() };
    default:
      return { ok: false, error: 'unknown message type' };
  }
}

/**
 * 从 storage 构造 DiagnosisSession（硬跳转后内存 session 丢失时的上传兜底）。
 * 仅当内存 session 不存在时调用。
 */
async function buildSessionFromStorage(tabId: number): Promise<DiagnosisSession | null> {
  if (tabId <= 0) return null;
  const persisted = await loadSession(tabId);
  if (!persisted) return null;
  return {
    sessionId: persisted.sessionId,
    tabId: persisted.tabId,
    status: 'stopped',
    startedAt: persisted.startedAt,
    pageContext: persisted.pageContext,
    events: persisted.events,
    userHint: persisted.userHint,
  };
}

console.log('[TraceLens] content script ready');
