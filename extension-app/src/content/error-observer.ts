// content/error-observer.ts
// 错误观察器 —— 监听 window.onerror / unhandledrejection / resource error

import type { ErrorEvent as ProbeErrorEvent } from '@/shared/types';
import { truncate } from '@/shared/utils';
import { RECORDER_CONFIG } from '@/shared/constants';
import type { Recorder } from './recorder';

export class ErrorObserver {
  private onErrorHandler: ((...args: unknown[]) => void) | null = null;
  private rejectionHandler: ((e: PromiseRejectionEvent) => void) | null = null;
  private resourceErrorHandler: ((e: Event) => void) | null = null;

  constructor(private readonly recorder: Recorder) {}

  start(): void {
    if (this.onErrorHandler) return;

    this.onErrorHandler = (
      message: unknown,
      filename: unknown,
      lineno: unknown,
      colno: unknown,
      error: unknown,
    ): void => {
      if (!this.recorder.isActive) return;
      const err = error instanceof Error ? error : undefined;
      const msg = typeof message === 'string' ? message : err?.message ?? 'unknown error';

      this.emit({
        kind: 'error',
        errorType: 'js',
        message: truncate(msg, RECORDER_CONFIG.MAX_TEXT_LENGTH),
        filename: typeof filename === 'string' ? filename : undefined,
        lineno: typeof lineno === 'number' ? lineno : undefined,
        colno: typeof colno === 'number' ? colno : undefined,
        stack: err?.stack
          ? truncate(err.stack, RECORDER_CONFIG.MAX_ERROR_STACK_LENGTH)
          : undefined,
      });
    };
    window.addEventListener('error', this.onErrorHandler as EventListener, { capture: true });

    this.rejectionHandler = (e: PromiseRejectionEvent): void => {
      if (!this.recorder.isActive) return;
      const reason = e.reason;
      const msg = reason instanceof Error ? reason.message : String(reason);
      this.emit({
        kind: 'error',
        errorType: 'promise',
        message: truncate(msg, RECORDER_CONFIG.MAX_TEXT_LENGTH),
        stack: reason instanceof Error && reason.stack
          ? truncate(reason.stack, RECORDER_CONFIG.MAX_ERROR_STACK_LENGTH)
          : undefined,
      });
    };
    window.addEventListener('unhandledrejection', this.rejectionHandler);

    this.resourceErrorHandler = (e: Event): void => {
      if (!this.recorder.isActive) return;
      const target = e.target as HTMLElement | null;
      if (!target || !target.tagName) return;
      const src = target.getAttribute('src') || target.getAttribute('href') || '';
      if (!src) return;
      this.emit({
        kind: 'error',
        errorType: 'resource',
        message: `资源加载失败: ${target.tagName.toLowerCase()} ${truncate(src, 80)}`,
      });
    };
    window.addEventListener('error', this.resourceErrorHandler, { capture: true });
  }

  stop(): void {
    if (this.onErrorHandler) {
      window.removeEventListener('error', this.onErrorHandler as EventListener, { capture: true });
      this.onErrorHandler = null;
    }
    if (this.rejectionHandler) {
      window.removeEventListener('unhandledrejection', this.rejectionHandler);
      this.rejectionHandler = null;
    }
    if (this.resourceErrorHandler) {
      window.removeEventListener('error', this.resourceErrorHandler, { capture: true });
      this.resourceErrorHandler = null;
    }
  }

  private emit(partial: Omit<ProbeErrorEvent, 'eventId' | 'occurredAt' | 'tabId'>): void {
    this.recorder.append(partial);
  }
}
