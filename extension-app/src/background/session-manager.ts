// background/session-manager.ts
// Session 管理 —— 协调 content script 录制、收集 session 数据、上传到后端

import type {
  DiagnosisSession,
  SessionStats,
  UploadResult,
} from '@/shared/types';
import { tabRegistry } from './tab-registry';
import { sessionToDto } from './session-mapper';
import { createDiagnosis } from '@/shared/api';

interface FetchSessionResponse {
  ok: boolean;
  session?: DiagnosisSession;
  stats?: SessionStats;
  status?: string;
}

class SessionManager {
  async startRecording(tabId: number): Promise<void> {
    await this.sendMessageToTab<FetchSessionResponse>(tabId, {
      type: 'START_RECORDING',
      tabId,
    });
    tabRegistry.update(tabId, {
      status: 'recording',
      startedAt: Date.now(),
      // 新会话开始：清除上一会话的统计与上传结果，避免 SidePanel 显示残留计数
      stats: undefined,
      lastUpload: undefined,
    });
  }

  async resumeRecording(tabId: number): Promise<void> {
    await this.sendMessageToTab<FetchSessionResponse>(tabId, {
      type: 'RESUME_RECORDING',
      tabId,
    });
    tabRegistry.update(tabId, { status: 'recording' });
  }

  async stopRecording(tabId: number): Promise<SessionStats | null> {
    const response = await this.sendMessageToTab<FetchSessionResponse>(tabId, {
      type: 'STOP_RECORDING',
      tabId,
    });
    const stats = response?.stats ?? null;
    tabRegistry.update(tabId, { status: 'stopped', stats: stats ?? undefined });
    return stats;
  }

  async getStats(tabId: number): Promise<SessionStats | null> {
    const response = await this.sendMessageToTab<{ stats: SessionStats }>(tabId, {
      type: 'GET_SESSION_STATS',
      tabId,
    });
    return response?.stats ?? null;
  }

  async collectAndUpload(tabId: number): Promise<UploadResult> {
    tabRegistry.setStatus(tabId, 'uploading');

    const response = await this.sendMessageToTab<FetchSessionResponse>(tabId, {
      type: 'FETCH_SESSION',
      tabId,
    });

    const session = response?.session;
    if (!session) {
      const result: UploadResult = { success: false, error: 'no session captured' };
      tabRegistry.setUploadResult(tabId, result);
      return result;
    }

    try {
      const dto = sessionToDto(session);
      const created = await createDiagnosis(dto);
      const result: UploadResult = { success: true, taskId: created.taskId };
      tabRegistry.setUploadResult(tabId, result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const result: UploadResult = { success: false, error: message };
      tabRegistry.setUploadResult(tabId, result);
      return result;
    }
  }

  private async sendMessageToTab<T = unknown>(
    tabId: number,
    message: unknown,
  ): Promise<T | null> {
    try {
      const response = await chrome.tabs.sendMessage(tabId, message);
      return (response as T) ?? null;
    } catch {
      return null;
    }
  }
}

export const sessionManager = new SessionManager();
