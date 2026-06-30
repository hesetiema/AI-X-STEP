// shared/storage/session-store.ts
// 跨页持久化录制会话 —— 用 chrome.storage.session 镜像 content script 内存中的事件流，
// 整页刷新后新页 content script 可据此恢复"只读"事件供 SidePanel 查看与提交。
//
// 设计：content script 内存为主数据源（实时），storage 为镜像。所有调用 try/catch 静默兜底，
// 失败不影响录制主流程。

import type {
  ProbeEvent,
  SessionStats,
  SessionStatus,
  PageContext,
  UserHint,
} from '@/shared/types';
import { RECORDER_CONFIG } from '@/shared/constants';

const KEY_PREFIX = 'tracelens:session:';

export interface PersistedSession {
  sessionId: string;
  tabId: number;
  status: SessionStatus; // 录制状态：recording（进行中，可跨页自动续录）/ stopped（已停止，只读）
  startedAt: string;
  pageContext: PageContext; // 初始页上下文（首帧）
  events: ProbeEvent[]; // 镜像，受 MAX_EVENTS 上限
  stats: SessionStats;
  userHint?: UserHint;
}

function storageKey(tabId: number): string {
  return `${KEY_PREFIX}${tabId}`;
}

function emptyStats(): SessionStats {
  return { total: 0, interaction: 0, network: 0, error: 0, bridge: 0, performance: 0 };
}

export async function loadSession(tabId: number): Promise<PersistedSession | null> {
  try {
    const result = await chrome.storage.session.get(storageKey(tabId));
    const data = result[storageKey(tabId)] as PersistedSession | undefined;
    return data ?? null;
  } catch {
    return null;
  }
}

export async function saveSession(tabId: number, data: PersistedSession): Promise<void> {
  try {
    await chrome.storage.session.set({ [storageKey(tabId)]: data });
  } catch {
    // 静默：持久化失败不阻断录制
  }
}

/**
 * 初始化会话存储（start 时调用）。走串行链，保证在任何 appendEvent 之前完成，
 * 避免 appendEvent 读到空 storage 而丢弃事件。
 */
export function initSession(tabId: number, data: PersistedSession): Promise<void> {
  return serializeWrite(tabId, () => saveSession(tabId, data));
}

export async function clearSession(tabId: number): Promise<void> {
  try {
    await chrome.storage.session.remove(storageKey(tabId));
  } catch {
    // 静默
  }
}

/**
 * 按 tabId 串行化 storage 写入，避免并发 appendEvent/updateStats 之间的
 * read-modify-write 竞态（并发 load 各自读到旧快照后互相覆盖，丢事件）。
 */
const writeChains = new Map<number, Promise<unknown>>();
function serializeWrite<T>(tabId: number, task: () => Promise<T>): Promise<T> {
  const prev = writeChains.get(tabId) ?? Promise.resolve();
  const next = prev.then(task, task);
  // 失败不阻断后续写入链
  writeChains.set(
    tabId,
    next.catch(() => undefined),
  );
  return next;
}

/**
 * 追加单条事件到 storage 中的镜像。超 MAX_EVENTS 时按 EventBuffer 同策略裁剪：
 * 优先丢弃最早的非 error 事件，全为 error 时丢弃最前一条。
 */
export function appendEvent(tabId: number, event: ProbeEvent): Promise<void> {
  return serializeWrite(tabId, async () => {
    const session = await loadSession(tabId);
    if (!session) return; // 无进行中的会话，不镜像
    const events = session.events;
    if (events.length >= RECORDER_CONFIG.MAX_EVENTS) {
      const dropIndex = events.findIndex((e) => e.kind !== 'error');
      if (dropIndex >= 0) events.splice(dropIndex, 1);
      else events.shift();
    }
    events.push(event);
    await saveSession(tabId, { ...session, events });
  });
}

export function updateStats(tabId: number, stats: SessionStats): Promise<void> {
  return serializeWrite(tabId, async () => {
    const session = await loadSession(tabId);
    if (!session) return;
    await saveSession(tabId, { ...session, stats });
  });
}

export function updateUserHint(tabId: number, hint: UserHint): Promise<void> {
  return serializeWrite(tabId, async () => {
    const session = await loadSession(tabId);
    if (!session) return;
    await saveSession(tabId, { ...session, userHint: hint });
  });
}

/**
 * 按 eventId 补充已持久化事件的字段（如 stackTrace / scopeVariables）。
 * CDP 捕获数据异步到达后，合并到 storage 镜像中的原始点击事件。
 */
export function supplementEvent(
  tabId: number,
  eventId: string,
  data: Partial<ProbeEvent>,
): Promise<void> {
  return serializeWrite(tabId, async () => {
    const session = await loadSession(tabId);
    if (!session) return;
    const event = session.events.find((e) => e.eventId === eventId);
    if (event) {
      Object.assign(event, data);
      await saveSession(tabId, { ...session, events: session.events });
    }
  });
}

export { emptyStats };
