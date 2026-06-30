// content/ui-symptom-detector.ts
// UI 症状自动识别 —— 检测页面常见异常模式
// 对应文档 91 的设计落地

import type { ObservationEvent, UiStateEvent } from '@/shared/types';
import type { Recorder } from './recorder';
import { RECORDER_CONFIG } from '@/shared/constants';

const EMPTY_STATE_PATTERNS = [
  /暂无数据/i,
  /没有(找到)?数据/i,
  /无(相关)?(结果|记录|内容|订单)/i,
  /empty/i,
  /no\s+data/i,
  /no\s+results/i,
];

const ERROR_TOAST_PATTERNS = [
  /请求失败/i,
  /网络异常/i,
  /操作失败/i,
  /服务器错误/i,
  /系统繁忙/i,
];

const SKELETON_SELECTORS = [
  '.skeleton',
  '.skeleton-loading',
  '[class*="skeleton"]',
  '.ant-skeleton',
];

interface PendingLoading {
  selector: string;
  startedAt: number;
}

export class UiSymptomDetector {
  private pendingLoadings: PendingLoading[] = [];
  private observer: MutationObserver | null = null;

  constructor(private readonly recorder: Recorder) {}

  start(): void {
    if (this.observer) return;
    this.scanForLongLoading();
    this.startMutationObserver();
  }

  stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.pendingLoadings = [];
  }

  private startMutationObserver(): void {
    if (!document.body) {
      // Content script 在 document_start 注入时，body 可能尚未就绪。
      // 等待 DOMContentLoaded 后再尝试。
      document.addEventListener('DOMContentLoaded', () => this.startMutationObserver(), { once: true });
      return;
    }

    this.observer = new MutationObserver((mutations) => {
      if (!this.recorder.isActive) return;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement) {
            this.inspectNewNode(node);
          }
        }
      }
    });
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  private inspectNewNode(el: HTMLElement): void {
    this.checkEmptyState(el);
    this.checkErrorToast(el);
  }

  private checkEmptyState(el: HTMLElement): void {
    const text = el.textContent ?? '';
    for (const pattern of EMPTY_STATE_PATTERNS) {
      if (pattern.test(text)) {
        this.emitObservation('module_empty_after_success', {
          detail: { text: text.slice(0, 100), selector: getSelector(el) },
        });
        return;
      }
    }
  }

  private checkErrorToast(el: HTMLElement): void {
    const text = el.textContent ?? '';
    for (const pattern of ERROR_TOAST_PATTERNS) {
      if (pattern.test(text)) {
        this.emitUiState('error_toast', {
          message: text.slice(0, 100),
          severity: 'error',
        });
        this.emitObservation('request_failed_without_feedback', {
          detail: { text: text.slice(0, 100), selector: getSelector(el) },
        });
        return;
      }
    }
  }

  private scanForLongLoading(): void {
    // 检查当前页面是否存在 skeleton / loading 状态
    for (const selector of SKELETON_SELECTORS) {
      const els = document.querySelectorAll(selector);
      for (const el of els) {
        if (el instanceof HTMLElement && el.offsetParent !== null) {
          this.pendingLoadings.push({
            selector,
            startedAt: Date.now(),
          });
        }
      }
    }

    if (this.pendingLoadings.length > 0) {
      this.checkLongLoadingTimeout();
    }
  }

  private checkLongLoadingTimeout(): void {
    const now = Date.now();
    const stillLoading = this.pendingLoadings.filter((p) => {
      const el = document.querySelector(p.selector);
      if (!el) return false;
      if (now - p.startedAt >= RECORDER_CONFIG.LONG_LOADING_THRESHOLD_MS) {
        this.emitObservation('module_loading_too_long', {
          module: p.selector,
          detail: {
            selector: p.selector,
            durationMs: now - p.startedAt,
          },
        });
        return false; // 只报告一次
      }
      return true;
    });
    this.pendingLoadings = stillLoading;

    if (this.pendingLoadings.length > 0) {
      setTimeout(() => this.checkLongLoadingTimeout(), 1000);
    }
  }

  private emitObservation(
    observationType: ObservationEvent['observationType'],
    extra: { module?: string; detail?: Record<string, unknown> },
  ): void {
    this.recorder.append({
      kind: 'observation',
      observationType,
      ...extra,
    });
  }

  private emitUiState(
    stateType: UiStateEvent['stateType'],
    extra: { targetId?: string; message?: string; severity?: 'info' | 'warning' | 'error'; visible?: boolean },
  ): void {
    this.recorder.append({
      kind: 'ui_state',
      stateType,
      ...extra,
    });
  }
}

function getSelector(el: HTMLElement): string {
  if (el.id) return `#${el.id}`;
  const cls = el.className && typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
  return cls ? `${el.tagName.toLowerCase()}.${cls}` : el.tagName.toLowerCase();
}
