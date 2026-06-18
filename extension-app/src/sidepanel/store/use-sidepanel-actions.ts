// sidepanel/store/use-sidepanel-actions.ts
// SidePanel 操作 —— 发送消息给 background 控制录制（与 popup 共用 background 协议）

import { useCallback } from 'react';
import { useSidePanelStore } from './sidepanel-store';
import type { SessionStats, SessionStatus, UploadResult, ProbeEvent } from '@/shared/types';

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
  const setStats = useSidePanelStore((s) => s.setStats);
  const setEvents = useSidePanelStore((s) => s.setEvents);
  const clearEvents = useSidePanelStore((s) => s.clearEvents);
  const setUploadResult = useSidePanelStore((s) => s.setUploadResult);
  const reset = useSidePanelStore((s) => s.reset);

  const startRecording = useCallback(async () => {
    try {
      reset();
      clearEvents();
      const res = await sendMessage<{ ok: boolean; meta: TabMeta }>({
        type: 'START_RECORDING',
      });
      if (res.ok) {
        setStatus('recording');
        if (res.meta?.stats) setStats(res.meta.stats);
      }
    } catch (err) {
      console.error('[TraceLens] startRecording error', err);
    }
  }, [reset, clearEvents, setStatus, setStats]);

  const resumeRecording = useCallback(async () => {
    try {
      const res = await sendMessage<{ ok: boolean; meta: TabMeta }>({
        type: 'RESUME_RECORDING',
      });
      if (res.ok) {
        setStatus('recording');
        if (res.meta?.stats) setStats(res.meta.stats);
      }
    } catch (err) {
      console.error('[TraceLens] resumeRecording error', err);
    }
  }, [setStatus, setStats]);

  const stopRecording = useCallback(async () => {
    try {
      const res = await sendMessage<{ ok: boolean; meta: TabMeta }>({
        type: 'STOP_RECORDING',
      });
      if (res.ok) {
        setStatus('stopped');
        if (res.meta?.stats) setStats(res.meta.stats);
      }
    } catch (err) {
      console.error('[TraceLens] stopRecording error', err);
    }
  }, [setStatus, setStats]);

  const submitDiagnosis = useCallback(async () => {
    try {
      setStatus('uploading');
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

  /**
   * 从 background 恢复当前 tab 的完整状态。
   * SidePanel 每次打开时调用。
   */
  const restoreStatus = useCallback(async () => {
    try {
      const res = await sendMessage<StatusResponse>({
        type: 'GET_SESSION_STATUS',
      });
      if (res.ok && res.meta) {
        setStatus(res.meta.status);
        if (res.meta.stats) setStats(res.meta.stats);
        if (res.meta.lastUpload) setUploadResult(res.meta.lastUpload);
      }
    } catch {
      // background 未就绪时静默忽略
    }
  }, [setStatus, setStats, setUploadResult]);

  /**
   * 刷新事件统计 + 拉取最新事件列表。
   * 录制中每 2 秒调用，让 SidePanel 实时展示事件流。
   */
  const refreshStats = useCallback(async () => {
    try {
      // 先刷新 background 侧的 stats
      const statsRes = await sendMessage<StatusResponse>({
        type: 'GET_SESSION_STATUS',
      });
      if (statsRes.ok && statsRes.meta?.stats) {
        setStats(statsRes.meta.stats);
      }
      // 再向 content script 拉取最新事件快照
      const eventsRes = await sendMessage<EventsResponse>({
        type: 'FETCH_EVENTS',
      });
      if (eventsRes.ok && eventsRes.events) {
        setEvents(eventsRes.events);
      }
    } catch {
      // ignore
    }
  }, [setStats, setEvents]);

  return {
    startRecording,
    stopRecording,
    resumeRecording,
    submitDiagnosis,
    restoreStatus,
    refreshStats,
  };
}
