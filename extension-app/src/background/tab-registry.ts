// background/tab-registry.ts
// 按 tab 管理 session 元数据（tabId ↔ status / taskId / stats）

import type { SessionStatus, SessionStats, UploadResult } from '@/shared/types';

export interface TabSessionMeta {
  tabId: number;
  status: SessionStatus;
  startedAt?: number;
  stats?: SessionStats;
  lastUpload?: UploadResult;
}

class TabRegistry {
  private map = new Map<number, TabSessionMeta>();
  private listeners: Array<(meta: TabSessionMeta) => void> = [];

  get(tabId: number): TabSessionMeta | undefined {
    return this.map.get(tabId);
  }

  ensure(tabId: number): TabSessionMeta {
    let meta = this.map.get(tabId);
    if (!meta) {
      meta = { tabId, status: 'idle' };
      this.map.set(tabId, meta);
    }
    return meta;
  }

  update(tabId: number, patch: Partial<TabSessionMeta>): TabSessionMeta {
    const meta = { ...this.ensure(tabId), ...patch };
    this.map.set(tabId, meta);
    this.emit(meta);
    return meta;
  }

  setStatus(tabId: number, status: SessionStatus): void {
    this.update(tabId, { status });
  }

  setStats(tabId: number, stats: SessionStats): void {
    this.update(tabId, { stats });
  }

  setUploadResult(tabId: number, result: UploadResult): void {
    this.update(tabId, { lastUpload: result, status: result.success ? 'uploaded' : 'failed' });
  }

  clear(tabId: number): void {
    this.map.delete(tabId);
  }

  on(listener: (meta: TabSessionMeta) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emit(meta: TabSessionMeta): void {
    for (const l of this.listeners) l(meta);
  }
}

export const tabRegistry = new TabRegistry();
