// sidepanel/store/sidepanel-store.ts
// SidePanel 状态 —— 实时事件流 + 用户备注 + 慢接口监控

import { create } from 'zustand';
import type { SessionStatus, SessionStats, ProbeEvent, UploadResult, PagePerfSummary, SlowApiInfo } from '@/shared/types';

export type MonitoringStatus = 'idle' | 'monitoring' | 'stopped';

interface SidePanelState {
  status: SessionStatus;
  stats: SessionStats | null;
  events: ProbeEvent[];
  userHint: { summary: string; expected: string; actual: string };
  uploadResult: UploadResult | null;
  deepDiagnosis: boolean;
  pagePerf: PagePerfSummary | null;

  // 慢接口监控
  monitoringStatus: MonitoringStatus;
  slowApis: SlowApiInfo[];

  setStatus: (status: SessionStatus) => void;
  setStats: (stats: SessionStats) => void;
  appendEvent: (event: ProbeEvent) => void;
  setEvents: (events: ProbeEvent[]) => void;
  clearEvents: () => void;
  setUserHint: (hint: Partial<SidePanelState['userHint']>) => void;
  setUploadResult: (result: UploadResult) => void;
  toggleDeepDiagnosis: () => void;
  setPagePerf: (perf: PagePerfSummary | null) => void;
  reset: () => void;

  // 慢接口监控 actions
  setMonitoringStatus: (status: MonitoringStatus) => void;
  upsertSlowApi: (api: SlowApiInfo) => void;
  clearSlowApis: () => void;
}

export const useSidePanelStore = create<SidePanelState>((set) => ({
  status: 'idle',
  stats: null,
  events: [],
  userHint: { summary: '', expected: '', actual: '' },
  uploadResult: null,
  deepDiagnosis: false,
  pagePerf: null,
  monitoringStatus: 'idle',
  slowApis: [],

  setStatus: (status) => set({ status }),
  setStats: (stats) => set({ stats }),
  appendEvent: (event) => set((s) => ({ events: [...s.events, event] })),
  setEvents: (events) => set({ events }),
  clearEvents: () => set({ events: [] }),
  setUserHint: (hint) =>
    set((s) => ({ userHint: { ...s.userHint, ...hint } })),
  setUploadResult: (result) => set({ uploadResult: result }),
  toggleDeepDiagnosis: () =>
    set((s) => ({ deepDiagnosis: !s.deepDiagnosis })),
  setPagePerf: (pagePerf) => set({ pagePerf }),
  reset: () =>
    set({
      status: 'idle',
      stats: null,
      events: [],
      userHint: { summary: '', expected: '', actual: '' },
      uploadResult: null,
      deepDiagnosis: false,
      pagePerf: null,
      monitoringStatus: 'idle',
      slowApis: [],
    }),

  setMonitoringStatus: (status) => set({ monitoringStatus: status }),
  upsertSlowApi: (api) =>
    set((s) => {
      const idx = s.slowApis.findIndex((a) => a.requestId === api.requestId);
      if (idx >= 0) {
        const updated = [...s.slowApis];
        updated[idx] = api;
        return { slowApis: updated };
      }
      return { slowApis: [...s.slowApis, api] };
    }),
  clearSlowApis: () => set({ slowApis: [] }),
}));
