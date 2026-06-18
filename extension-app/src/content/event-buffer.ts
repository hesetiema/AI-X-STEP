// content/event-buffer.ts
// 内存事件缓存 —— 限制最大事件数，按优先级保留高价值事件

import type { ProbeEvent } from '@/shared/types';
import { RECORDER_CONFIG } from '@/shared/constants';

type EventCategory = 'interaction' | 'network' | 'error' | 'bridge' | 'other';

function categorize(event: ProbeEvent): EventCategory {
  switch (event.kind) {
    case 'ui':
      return 'interaction';
    case 'network':
      return 'network';
    case 'error':
      return 'error';
    case 'bridge':
      return 'bridge';
    default:
      return 'other';
  }
}

export interface BufferStats {
  total: number;
  interaction: number;
  network: number;
  error: number;
  bridge: number;
}

export class EventBuffer {
  private events: ProbeEvent[] = [];
  private readonly maxSize: number;

  constructor(maxSize: number = RECORDER_CONFIG.MAX_EVENTS) {
    this.maxSize = maxSize;
  }

  append(event: ProbeEvent): void {
    if (this.events.length >= this.maxSize) {
      // 满了之后丢弃最早的一个非错误、非网络失败事件
      const dropIndex = this.events.findIndex(
        (e) => e.kind !== 'error',
      );
      if (dropIndex >= 0) {
        this.events.splice(dropIndex, 1);
      } else {
        this.events.shift();
      }
    }
    this.events.push(event);
  }

  snapshot(): ProbeEvent[] {
    return [...this.events];
  }

  clear(): void {
    this.events = [];
  }

  /**
   * 用持久化事件重建 buffer（整页刷新后从 storage 恢复只读事件流）。
   * 超出 maxSize 时按 append 同策略裁剪尾部最早的。
   */
  restore(events: ProbeEvent[]): void {
    this.events = events.slice(-this.maxSize);
  }

  getStats(): BufferStats {
    const stats: BufferStats = {
      total: this.events.length,
      interaction: 0,
      network: 0,
      error: 0,
      bridge: 0,
    };
    for (const e of this.events) {
      const cat = categorize(e);
      if (cat !== 'other') {
        stats[cat] += 1;
      }
    }
    return stats;
  }

  get size(): number {
    return this.events.length;
  }
}
