// content/route-observer.ts
// 路由观察器 —— 监听 SPA 路由变化（pushState / replaceState / popstate）

import type { UiEvent } from '@/shared/types';
import type { Recorder } from './recorder';
import { getInitWindowTracker } from './init-window-tracker';

export class RouteObserver {
  private patched = false;
  private originalPushState: typeof history.pushState | null = null;
  private originalReplaceState: typeof history.replaceState | null = null;
  private popstateHandler: (() => void) | null = null;
  private lastRoute: string | null = null;

  constructor(private readonly recorder: Recorder) {}

  start(): void {
    if (this.patched) return;
    this.lastRoute = location.pathname + location.search;

    const self = this;
    this.originalPushState = history.pushState.bind(history);
    this.originalReplaceState = history.replaceState.bind(history);

    history.pushState = function patchedPushState(...args: Parameters<typeof history.pushState>): void {
      self.originalPushState!.apply(history, args);
      self.emitRouteChange();
    };
    history.replaceState = function patchedReplaceState(...args: Parameters<typeof history.replaceState>): void {
      self.originalReplaceState!.apply(history, args);
      self.emitRouteChange();
    };

    this.popstateHandler = () => self.emitRouteChange();
    window.addEventListener('popstate', this.popstateHandler);

    this.patched = true;
  }

  stop(): void {
    if (!this.patched) return;
    if (this.originalPushState) history.pushState = this.originalPushState;
    if (this.originalReplaceState) history.replaceState = this.originalReplaceState;
    if (this.popstateHandler) window.removeEventListener('popstate', this.popstateHandler);
    this.originalPushState = null;
    this.originalReplaceState = null;
    this.popstateHandler = null;
    this.patched = false;
  }

  private emitRouteChange(): void {
    const route = location.pathname + location.search;
    if (route === this.lastRoute) return;
    this.lastRoute = route;

    const tracker = getInitWindowTracker();
    if (tracker) {
      tracker.onRouteEnter(route, location.href);
    }

    if (!this.recorder.isActive) return;

    const event: Omit<UiEvent, 'eventId' | 'occurredAt' | 'tabId'> = {
      kind: 'ui',
      eventType: 'route_change',
      route,
    };
    this.recorder.append(event);
  }
}
