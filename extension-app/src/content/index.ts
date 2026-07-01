// content/index.ts
// Content Script 入口 —— 整合所有 observer，接收 background 消息控制录制生命周期

import { recorder } from './recorder';
import { DomObserver } from './dom-observer';
import { ErrorObserver } from './error-observer';
import { RouteObserver } from './route-observer';
import { NetworkObserver } from './network';
import { BridgeListener } from './bridge-listener';
import { UiSymptomDetector } from './ui-symptom-detector';
import { PerformanceObserver_ as PerfObserver } from './performance-observer';
import { InitWindowTracker, setInitWindowTracker } from './init-window-tracker';
import { readPageContext } from './page-context-reader';
import { loadSession } from '@/shared/storage/session-store';
import type { RuntimeMessage, DiagnosisSession, UserHint } from '@/shared/types';

const domObserver = new DomObserver(recorder);
const errorObserver = new ErrorObserver(recorder);
const routeObserver = new RouteObserver(recorder);
const networkObserver = new NetworkObserver(recorder);
const bridgeListener = new BridgeListener(recorder);
const symptomDetector = new UiSymptomDetector(recorder);
const initWindowTracker = new InitWindowTracker({ recorder });
setInitWindowTracker(initWindowTracker);
const perfObserver = new PerfObserver(recorder, (event, summary) => {
  initWindowTracker.onFirstScreenReady(event, summary);
});
routeObserver.onRouteChange(() => perfObserver.onRouteChange());

async function startRecording(): Promise<void> {
  if (recorder.isActive) return;
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
  networkObserver.stop();
  bridgeListener.stop();
  symptomDetector.stop();
  const session = recorder.stop();
  console.log('[TraceLens] recording stopped', session?.events.length ?? 0, 'events');
}

async function resumeRecording(): Promise<void> {
  if (recorder.isActive) return;
  if (!recorder.currentSession) {
    const tabId = (await resolveTabId()) ?? 0;
    if (tabId > 0) {
      await recorder.resumeFromPersisted(tabId);
      startAllObservers();
      console.log('[TraceLens] recording resumed from storage', recorder.getStats());
      return;
    }
  }
  recorder.setStatus('recording');
  if (recorder.currentSession) {
    recorder.currentSession.endedAt = undefined;
  }
  startAllObservers();
  console.log('[TraceLens] recording resumed', recorder.getStats());
}

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
    // background not ready
  }
  return null;
}

async function initFromPersistedSession(): Promise<void> {
  const tabId = await resolveTabId();
  if (tabId === null) return;
  let persisted = await recorder.loadPersistedSession(tabId);
  if (!persisted) {
    await new Promise((r) => setTimeout(r, 500));
    persisted = await recorder.loadPersistedSession(tabId);
  }
  if (!persisted) return;
  if (persisted.status === 'recording' && !recorder.isActive) {
    await recorder.resumeFromPersisted(tabId);
    startAllObservers();
    console.log('[TraceLens] auto-resumed recording after navigation', recorder.getStats());
  } else {
    await recorder.loadPersistedIntoBuffer(tabId);
  }
}

function startAllObservers(): void {
  domObserver.start();
  errorObserver.start();
  networkObserver.start();
  bridgeListener.start();
  symptomDetector.start();
}

/** 性能相关 observer —— 页面加载即启动，与录制生命周期解耦 */
function startAutoObservers(): void {
  perfObserver.start();
  initWindowTracker.start();
  routeObserver.start();
}

void (async () => {
  const tabId = await resolveTabId();
  if (tabId !== null && tabId > 0) {
    recorder.setAutoTabId(tabId);
  }
  startAutoObservers();
  await initFromPersistedSession();
})();

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  handleContentMessage(message)
    .then((result) => sendResponse(result))
    .catch(() => sendResponse({ ok: false, error: 'content message handler failed' }));
  return true;
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
      stopRecording();
      let session = recorder.currentSession;
      if (!session) {
        const tabId = (await resolveTabId()) ?? 0;
        session = await buildSessionFromStorage(tabId);
      }
      return { ok: true, session };
    }
    case 'FETCH_EVENTS':
      return { ok: true, events: recorder.getSnapshot(), stats: recorder.getStats() };
    case 'SET_USER_HINT':
      if (message.userHint) {
        recorder.setUserHint(message.userHint as UserHint);
      }
      return { ok: true };
    case 'ENABLE_DEEP_DIAGNOSIS':
      domObserver.setDeepDiagnosis(true);
      console.log('[TraceLens] deep diagnosis mode enabled');
      return { ok: true };
    case 'DISABLE_DEEP_DIAGNOSIS':
      domObserver.setDeepDiagnosis(false);
      console.log('[TraceLens] deep diagnosis mode disabled');
      return { ok: true };
    case 'FETCH_AUTO_OBSERVE':
      return { ok: true, events: recorder.getAutoObserveSnapshot() };
    case 'FETCH_INIT_WINDOW':
      return { ok: true, window: initWindowTracker.getCurrentWindow() };
    default:
      return { ok: false, error: 'unknown message type' };
  }
}

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
