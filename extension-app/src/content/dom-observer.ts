// content/dom-observer.ts
// DOM 交互观察器 —— 监听 click / submit / change 事件

import type { UiEvent, StackFrame, ScopeVariable } from '@/shared/types';
import { buildDomPath, describeTarget, truncate } from '@/shared/utils';
import { RECORDER_CONFIG } from '@/shared/constants';
import type { Recorder } from './recorder';
import { buildDomContext } from './dom-context-builder';

const OBSERVED_EVENTS: Array<keyof DocumentEventMap> = ['click', 'submit', 'change'];

export class DomObserver {
  private handler: ((e: Event) => void) | null = null;
  private deepDiagnosis = false;

  constructor(private readonly recorder: Recorder) {}

  start(): void {
    if (this.handler) return;

    this.handler = (e: Event) => {
      if (!this.recorder.isActive) return;

      const target = e.target;
      const { targetId, targetName, textSummary } = describeTarget(target);
      const domPath = buildDomPath(target);

      const eventType = this.mapEventType(e.type);
      if (!eventType) return;

      const domContext = buildDomContext(target);

      const event: Omit<UiEvent, 'eventId' | 'occurredAt' | 'tabId'> = {
        kind: 'ui',
        eventType,
        targetId,
        targetName,
        domPath,
        textSummary: textSummary
          ? truncate(textSummary, RECORDER_CONFIG.MAX_TEXT_LENGTH)
          : undefined,
        route: location.pathname + location.search,
        domContext,
      };

      if (this.deepDiagnosis && eventType === 'click') {
        this.captureAndAppend(event);
      } else {
        this.recorder.append(event);
      }
    };

    for (const eventName of OBSERVED_EVENTS) {
      document.addEventListener(eventName, this.handler, {
        capture: true,
        passive: true,
      });
    }
  }

  stop(): void {
    if (!this.handler) return;
    for (const eventName of OBSERVED_EVENTS) {
      document.removeEventListener(eventName, this.handler, { capture: true } as EventListenerOptions);
    }
    this.handler = null;
  }

  setDeepDiagnosis(enabled: boolean): void {
    this.deepDiagnosis = enabled;
  }

  private async captureAndAppend(
    event: Omit<UiEvent, 'eventId' | 'occurredAt' | 'tabId'>,
  ): Promise<void> {
    const eventId = this.recorder.append(event);
    if (!eventId) return;

    try {
      const res = await chrome.runtime.sendMessage({
        type: 'CAPTURE_CLICK_RUNTIME',
      });
      if (res?.ok) {
        const supplement: { stackTrace?: StackFrame[]; scopeVariables?: ScopeVariable[] } = {};
        if (Array.isArray(res.frames) && res.frames.length > 0) {
          supplement.stackTrace = res.frames as StackFrame[];
        }
        if (Array.isArray(res.scopeVariables) && res.scopeVariables.length > 0) {
          supplement.scopeVariables = res.scopeVariables as ScopeVariable[];
        }
        if (supplement.stackTrace || supplement.scopeVariables) {
          this.recorder.supplementEvent(eventId, supplement);
        }
      }
    } catch {
      // CDP unavailable, ignore
    }
  }

  private mapEventType(type: string): UiEvent['eventType'] | null {
    switch (type) {
      case 'click':
        return 'click';
      case 'submit':
        return 'submit';
      case 'change':
        return 'change';
      default:
        return null;
    }
  }
}
