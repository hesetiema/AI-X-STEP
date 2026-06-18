// sidepanel/store/sidepanel-store.ts
// SidePanel 状态 —— 实时事件流 + 用户备注

import { create } from 'zustand';
import type { SessionStatus, SessionStats, ProbeEvent, UploadResult } from '@/shared/types';

interface SidePanelState {
  status: SessionStatus;
  stats: SessionStats | null;
  events: ProbeEvent[];
  userHint: { summary: string; expected: string; actual: string };
  uploadResult: UploadResult | null;

  setStatus: (status: SessionStatus) => void;
  setStats: (stats: SessionStats) => void;
  appendEvent: (event: ProbeEvent) => void;
  setEvents: (events: ProbeEvent[]) => void;
  clearEvents: () => void;
  setUserHint: (hint: Partial<SidePanelState['userHint']>) => void;
  setUploadResult: (result: UploadResult) => void;
  reset: () => void;
}

export const useSidePanelStore = create<SidePanelState>((set) => ({
  status: 'idle',
  stats: null,
  events: [],
  userHint: { summary: '', expected: '', actual: '' },
  uploadResult: null,

  setStatus: (status) => set({ status }),
  setStats: (stats) => set({ stats }),
  appendEvent: (event) => set((s) => ({ events: [...s.events, event] })),
  setEvents: (events) => set({ events }),
  clearEvents: () => set({ events: [] }),
  setUserHint: (hint) =>
    set((s) => ({ userHint: { ...s.userHint, ...hint } })),
  setUploadResult: (result) => set({ uploadResult: result }),
  reset: () =>
    set({
      status: 'idle',
      stats: null,
      events: [],
      userHint: { summary: '', expected: '', actual: '' },
      uploadResult: null,
    }),
}));
