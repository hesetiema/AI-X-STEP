// content/recorder.ts
// 录制控制器 —— 管理 session 生命周期，统一接收各 observer 产出的事件

import type {
  DiagnosisSession,
  ProbeEvent,
  SessionStatus,
  PageContext,
  StackFrame,
  ScopeVariable,
} from '@/shared/types';
import { generateSessionId, generateEventId } from '@/shared/utils';
import {
  loadSession,
  saveSession,
  initSession,
  clearSession,
  appendEvent as persistAppendEvent,
  updateStats as persistUpdateStats,
  updateUserHint as persistUpdateUserHint,
  supplementEvent as persistSupplementEvent,
  emptyStats,
  type PersistedSession,
} from '@/shared/storage/session-store';

/**
 * append 接受"已带 kind 的具体 union 成员"（不含 eventId/occurredAt/tabId）。
 * 使用泛型 T 保证 kind 与对应字段一致，避免 union spread 后字段丢失。
 */
export type BaseProbeEventPartial = {
  [K in ProbeEvent['kind']]: Omit<Extract<ProbeEvent, { kind: K }>, 'eventId' | 'occurredAt' | 'tabId'>
}[ProbeEvent['kind']];
import { EventBuffer } from './event-buffer';

export interface RecorderOptions {
  tabId: number;
  initialPageContext: PageContext;
}

export class Recorder {
  private session: DiagnosisSession | null = null;
  private buffer = new EventBuffer();
  private autoObserveBuffer = new EventBuffer();
  private listeners: Array<(status: SessionStatus, stats: unknown) => void> = [];
  private lastTabId: number | null = null; // 最近会话的 tabId，供 reset 清理 storage
  private autoTabId: number | null = null; // 自动观察用的 tabId

  get status(): SessionStatus {
    return this.session?.status ?? 'idle';
  }

  get isActive(): boolean {
    return this.session?.status === 'recording';
  }

  get currentSession(): DiagnosisSession | null {
    return this.session;
  }

  getStats() {
    return this.buffer.getStats();
  }

  start(opts: RecorderOptions): void {
    this.buffer.clear();
    this.lastTabId = opts.tabId;
    this.session = {
      sessionId: generateSessionId(),
      tabId: opts.tabId,
      status: 'recording',
      startedAt: new Date().toISOString(),
      pageContext: opts.initialPageContext,
      events: [],
    };
    // 初始化持久化镜像：走串行链，保证在任何 appendEvent 之前完成，避免首条事件被丢
    const persisted: PersistedSession = {
      sessionId: this.session.sessionId,
      tabId: opts.tabId,
      status: 'recording',
      startedAt: this.session.startedAt,
      pageContext: opts.initialPageContext,
      events: [],
      stats: emptyStats(),
    };
    void initSession(opts.tabId, persisted);
    // 将自动观察 buffer 中的事件 flush 到主 buffer（使手动录制会话包含首屏性能数据）
    for (const e of this.autoObserveBuffer.snapshot()) {
      this.buffer.append(e);
    }
    this.autoObserveBuffer.clear();

    this.emitChange();
  }

  append(partial: BaseProbeEventPartial): string | null {
    if (!this.isActive || !this.session) return null;
    const eventId = generateEventId();
    const event: ProbeEvent = {
      ...partial,
      eventId,
      occurredAt: Date.now(),
      tabId: this.session.tabId,
    } as ProbeEvent;
    this.buffer.append(event);
    // 镜像到 storage：事件 + 统计同步（异步，失败静默）
    const tabId = this.session.tabId;
    void persistAppendEvent(tabId, event);
    void persistUpdateStats(tabId, this.buffer.getStats());
    this.emitChange();
    return eventId;
  }

  /**
   * 自动观察写入 —— 始终收集，不依赖 manual recording 状态。
   * PerformanceObserver 等自动观察者通过此方法写入事件。
   */
  appendAutoObserve(partial: BaseProbeEventPartial): string | null {
    const eventId = generateEventId();
    const tabId = this.lastTabId ?? this.autoTabId ?? 0;
    const event: ProbeEvent = {
      ...partial,
      eventId,
      occurredAt: Date.now(),
      tabId,
    } as ProbeEvent;
    this.autoObserveBuffer.append(event);
    return eventId;
  }

  /** 获取自动观察缓冲区快照，供按需诊断使用 */
  getAutoObserveSnapshot(): ProbeEvent[] {
    return this.autoObserveBuffer.snapshot();
  }

  setAutoTabId(tabId: number): void {
    this.autoTabId = tabId;
  }

  /**
   * 按 eventId 补充事件字段（如 stackTrace / scopeVariables）。
   * CDP 捕获数据异步到达后调用，合并到原始点击事件。
   */
  supplementEvent(
    eventId: string,
    data: { stackTrace?: StackFrame[]; scopeVariables?: ScopeVariable[] },
  ): void {
    if (!this.session) return;
    this.buffer.supplement(eventId, data as Partial<ProbeEvent>);
    const tabId = this.session.tabId;
    void persistSupplementEvent(tabId, eventId, data as Partial<ProbeEvent>);
  }

  stop(): DiagnosisSession | null {
    if (!this.session) return null;
    this.session.status = 'stopped';
    this.session.endedAt = new Date().toISOString();
    this.session.events = this.buffer.snapshot();
    // 持久化停止快照（含统计），供硬跳转后兜底读取
    void saveSession(this.session.tabId, {
      sessionId: this.session.sessionId,
      tabId: this.session.tabId,
      status: 'stopped',
      startedAt: this.session.startedAt,
      pageContext: this.session.pageContext,
      events: this.session.events,
      stats: this.buffer.getStats(),
      userHint: this.session.userHint,
    });
    this.emitChange();
    return this.session;
  }

  setStatus(status: SessionStatus): void {
    if (!this.session) return;
    this.session.status = status;
    if (status === 'uploaded' || status === 'failed') {
      this.session.events = this.buffer.snapshot();
    }
    this.emitChange();
  }

  updatePageContext(ctx: Partial<PageContext>): void {
    if (!this.session) return;
    this.session.pageContext = { ...this.session.pageContext, ...ctx };
  }

  setUserHint(hint: DiagnosisSession['userHint']): void {
    if (!this.session) return;
    this.session.userHint = hint;
    // 镜像用户备注，跨页提交诊断时仍可读
    if (hint) void persistUpdateUserHint(this.session.tabId, hint);
  }

  reset(): void {
    this.session = null;
    this.buffer.clear();
    this.autoObserveBuffer.clear();
    // 清理持久化镜像（按最近会话的 tabId），避免跨会话残留
    if (this.lastTabId !== null) {
      void clearSession(this.lastTabId);
      this.lastTabId = null;
    }
    this.emitChange();
  }

  getSnapshot(): ProbeEvent[] {
    return this.buffer.snapshot();
  }

  /**
   * 从 storage 读取持久化会话（不改变 recorder 状态）。供 content script 启动时
   * 决定是只读恢复还是自动续录。
   */
  async loadPersistedSession(tabId: number): Promise<PersistedSession | null> {
    return loadSession(tabId);
  }

  /**
   * 只读恢复：把持久化事件灌入 buffer，但不重建 session、不改 status（保持 idle）。
   * 用于已停止（stopped）的会话跨页后仍可查看/提交。
   */
  async loadPersistedIntoBuffer(tabId: number): Promise<PersistedSession | null> {
    const persisted = await loadSession(tabId);
    if (!persisted) return null;
    this.buffer.restore(persisted.events);
    this.lastTabId = tabId;
    return persisted;
  }

  /**
   * 自动续录恢复：从 storage 重建 recording session（不清空 buffer），恢复旧事件并
   * 转为 recording 状态，使后续 append 可继续写入。用于整页刷新后无缝续录。
   */
  async resumeFromPersisted(tabId: number): Promise<PersistedSession | null> {
    const persisted = await loadSession(tabId);
    if (!persisted) return null;
    this.lastTabId = tabId;
    this.buffer.restore(persisted.events);
    this.session = {
      sessionId: persisted.sessionId,
      tabId: persisted.tabId,
      status: 'recording',
      startedAt: persisted.startedAt,
      pageContext: persisted.pageContext,
      events: [],
      userHint: persisted.userHint,
    };
    // 同步 storage 状态为 recording（覆盖可能存在的 stopped 快照）
    void saveSession(tabId, { ...persisted, status: 'recording' });
    this.emitChange();
    return persisted;
  }

  onStatusChange(listener: (status: SessionStatus, stats: unknown) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emitChange(): void {
    const status = this.status;
    const stats = this.buffer.getStats();
    for (const l of this.listeners) {
      l(status, stats);
    }
  }
}

// 单例：每个 content script 实例对应一个 tab
export const recorder = new Recorder();
