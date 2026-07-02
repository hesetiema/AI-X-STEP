// sidepanel/store/use-sidepanel-actions.ts
// SidePanel 操作 —— 发送消息给 background 控制录制（与 popup 共用 background 协议）

import { useCallback } from 'react';
import { useSidePanelStore } from './sidepanel-store';
import type { SessionStats, SessionStatus, UploadResult, ProbeEvent, TracelensPipeline, PipelineCheckEvent } from '@/shared/types';

interface TabMeta {
  tabId: number;
  status: SessionStatus;
  startedAt?: number;
  stats?: SessionStats;
  lastUpload?: UploadResult;
}

interface StatusResponse {
  ok: boolean;
  meta?: TabMeta;
  error?: string;
}

interface EventsResponse {
  ok: boolean;
  events?: ProbeEvent[];
}

interface PipelineCheckResponse {
  ok: boolean;
  result?: PipelineCheckEvent;
  error?: string;
}

function sendMessage<T = unknown>(message: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response as T);
      }
    });
  });
}

export function useSidePanelActions() {
  const setStatus = useSidePanelStore((s) => s.setStatus);
  const setEvents = useSidePanelStore((s) => s.setEvents);
  const setUploadResult = useSidePanelStore((s) => s.setUploadResult);
  const reset = useSidePanelStore((s) => s.reset);
  const deepDiagnosis = useSidePanelStore((s) => s.deepDiagnosis);
  const toggleDeepDiagnosis = useSidePanelStore((s) => s.toggleDeepDiagnosis);
  const setPipelineInfo = useSidePanelStore((s) => s.setPipelineInfo);
  const setPipelineResult = useSidePanelStore((s) => s.setPipelineResult);

  const startRecording = useCallback(async () => {
    try {
      reset();
      const res = await sendMessage<{ ok: boolean; meta: TabMeta }>({
        type: 'START_RECORDING',
      });
      if (res.ok) {
        setStatus('recording');
      }
    } catch (err) {
      console.error('[TraceLens] startRecording error', err);
    }
  }, [reset, setStatus]);

  const resumeRecording = useCallback(async () => {
    try {
      const res = await sendMessage<{ ok: boolean; meta: TabMeta }>({
        type: 'RESUME_RECORDING',
      });
      if (res.ok) {
        setStatus('recording');
      }
    } catch (err) {
      console.error('[TraceLens] resumeRecording error', err);
    }
  }, [setStatus]);

  const stopRecording = useCallback(async () => {
    try {
      const res = await sendMessage<{ ok: boolean; meta: TabMeta }>({
        type: 'STOP_RECORDING',
      });
      if (res.ok) {
        setStatus('stopped');
      }
      const eventsRes = await sendMessage<EventsResponse>({
        type: 'FETCH_EVENTS',
      });
      if (eventsRes.ok && eventsRes.events) {
        setEvents(eventsRes.events);
      }
    } catch (err) {
      console.error('[TraceLens] stopRecording error', err);
    }
  }, [setStatus, setEvents]);

  const submitDiagnosis = useCallback(async () => {
    try {
      setStatus('uploading');
      const userHint = useSidePanelStore.getState().userHint;
      if (userHint.summary || userHint.expected || userHint.actual) {
        await sendMessage({
          type: 'SET_USER_HINT',
          userHint,
        });
      }
      const res = await sendMessage<{
        ok: boolean;
        result: UploadResult;
        meta: TabMeta;
      }>({ type: 'UPLOAD_SESSION' });
      if (res.ok) {
        setUploadResult(res.result);
        setStatus(res.result.success ? 'uploaded' : 'failed');
      } else {
        setStatus('failed');
      }
    } catch (err) {
      console.error('[TraceLens] submitDiagnosis error', err);
      setStatus('failed');
    }
  }, [setStatus, setUploadResult]);

  const restoreStatus = useCallback(async () => {
    try {
      const res = await sendMessage<StatusResponse>({
        type: 'GET_SESSION_STATUS',
      });
      if (res.ok && res.meta) {
        setStatus(res.meta.status);
        if (res.meta.lastUpload) setUploadResult(res.meta.lastUpload);
      }
      const eventsRes = await sendMessage<EventsResponse>({
        type: 'FETCH_EVENTS',
      });
      if (eventsRes.ok && eventsRes.events) {
        setEvents(eventsRes.events);
      }
    } catch {
      // background 未就绪时静默忽略
    }
  }, [setStatus, setUploadResult, setEvents]);

  const refreshStats = useCallback(async () => {
    try {
      const eventsRes = await sendMessage<EventsResponse>({
        type: 'FETCH_EVENTS',
      });
      if (eventsRes.ok && eventsRes.events) {
        setEvents(eventsRes.events);
      }
    } catch {
      // ignore
    }
  }, [setEvents]);

  const toggleDeep = useCallback(async () => {
    const current = useSidePanelStore.getState().deepDiagnosis;
    const next = !current;
    toggleDeepDiagnosis();
    try {
      if (next) {
        await sendMessage({ type: 'ENABLE_DEEP_DIAGNOSIS' });
      } else {
        await sendMessage({ type: 'DISABLE_DEEP_DIAGNOSIS' });
      }
    } catch (err) {
      console.error('[TraceLens] deep diagnosis toggle error', err);
      toggleDeepDiagnosis();
    }
  }, [toggleDeepDiagnosis]);

  const setMonitoringStatus = useSidePanelStore((s) => s.setMonitoringStatus);
  const clearSlowApis = useSidePanelStore((s) => s.clearSlowApis);
  const setMonitoringStartMs = useSidePanelStore((s) => s.setMonitoringStartMs);

  const startMonitoring = useCallback(async () => {
    try {
      clearSlowApis();
      setMonitoringStartMs(Date.now());
      const res = await sendMessage<{ ok: boolean }>({ type: 'START_MONITORING' });
      if (res.ok) {
        setMonitoringStatus('monitoring');
      }
    } catch (err) {
      console.error('[TraceLens] startMonitoring error', err);
    }
  }, [clearSlowApis, setMonitoringStatus, setMonitoringStartMs]);

  const stopMonitoring = useCallback(async () => {
    try {
      await sendMessage<{ ok: boolean }>({ type: 'STOP_MONITORING' });
      setMonitoringStatus('stopped');
    } catch (err) {
      console.error('[TraceLens] stopMonitoring error', err);
    }
  }, [setMonitoringStatus]);

  const registerPipeline = useCallback(async (pipeline: TracelensPipeline, fileName: string) => {
    try {
      await sendMessage({ type: 'REGISTER_PIPELINE', pipeline });
      setPipelineInfo(fileName, pipeline.route);
      console.log('[TraceLens] pipeline registered:', fileName, pipeline.route);
    } catch (err) {
      console.error('[TraceLens] registerPipeline error', err);
    }
  }, [setPipelineInfo]);

  const runPipelineCheck = useCallback(async () => {
    try {
      const res = await sendMessage<PipelineCheckResponse>({ type: 'RUN_PIPELINE_CHECK' });
      if (res.ok && res.result) {
        setPipelineResult(res.result);
      } else {
        console.warn('[TraceLens] pipeline check failed:', res.error);
      }
    } catch (err) {
      console.error('[TraceLens] runPipelineCheck error', err);
    }
  }, [setPipelineResult]);

  return {
    startRecording,
    stopRecording,
    resumeRecording,
    submitDiagnosis,
    restoreStatus,
    refreshStats,
    deepDiagnosis,
    toggleDeepDiagnosis: toggleDeep,
    startMonitoring,
    stopMonitoring,
    registerPipeline,
    runPipelineCheck,
  };
}
