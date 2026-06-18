// sidepanel/components/RecordControls.tsx
// 录制控制按钮 —— 开始/停止/继续/提交/新诊断

import React from 'react';
import { COLORS, SPACING } from '../styles';
import { useSidePanelStore } from '../store';
import { useSidePanelActions } from '../store/use-sidepanel-actions';

const RecordControls: React.FC = () => {
  const status = useSidePanelStore((s) => s.status);
  const hasEvents = useSidePanelStore((s) => s.events.length > 0);
  const { startRecording, stopRecording, resumeRecording, submitDiagnosis } = useSidePanelActions();

  const isRecording = status === 'recording';
  const isUploading = status === 'uploading';
  const canSubmit = status === 'stopped' && !isUploading;
  // 跨页保留事件后（idle 且有事件）：允许「继续录制」沿用旧事件，而非清空重来
  const canResumeFromIdle = status === 'idle' && hasEvents;

  // 主按钮逻辑
  let primaryLabel: string;
  let primaryColor: string;
  let primaryDisabled = false;
  let primaryAction: () => void;

  if (isRecording) {
    primaryLabel = '停止录制';
    primaryColor = COLORS.danger;
    primaryAction = stopRecording;
  } else if (canSubmit) {
    primaryLabel = '提交诊断';
    primaryColor = COLORS.success;
    primaryAction = submitDiagnosis;
  } else if (canResumeFromIdle) {
    // 跨页后只读保留事件（idle 且有事件）：主按钮用「提交诊断」，避免误点清空
    primaryLabel = '提交诊断';
    primaryColor = COLORS.success;
    primaryAction = submitDiagnosis;
  } else if (status === 'uploaded') {
    primaryLabel = '开始新诊断';
    primaryColor = COLORS.primary;
    primaryAction = startRecording;
  } else if (status === 'failed') {
    primaryLabel = '重新开始';
    primaryColor = COLORS.primary;
    primaryAction = startRecording;
  } else if (isUploading) {
    primaryLabel = '提交中...';
    primaryColor = COLORS.muted;
    primaryDisabled = true;
    primaryAction = () => {};
  } else {
    primaryLabel = '开始诊断';
    primaryColor = COLORS.primary;
    primaryAction = startRecording;
  }

  const btnBase: React.CSSProperties = {
    width: '100%',
    padding: `${SPACING.md}px ${SPACING.lg}px`,
    fontSize: 14,
    fontWeight: 600,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: primaryDisabled ? 'not-allowed' : 'pointer',
    opacity: primaryDisabled ? 0.6 : 1,
    transition: 'background 0.15s',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.sm }}>
      {/* 主按钮 */}
      <button
        onClick={primaryAction}
        disabled={primaryDisabled}
        style={{ ...btnBase, background: primaryColor }}
      >
        {isRecording && (
          <span style={{ marginRight: 8, display: 'inline-block' }}>●</span>
        )}
        {primaryLabel}
      </button>

      {/* 停止后：显示「继续诊断」和「开始新诊断」两个次要按钮 */}
      {canSubmit && (
        <>
          <button
            onClick={resumeRecording}
            style={{
              ...btnBase,
              background: COLORS.primary,
              padding: `${SPACING.sm}px`,
              fontSize: 13,
            }}
          >
            继续诊断
          </button>
          <button
            onClick={startRecording}
            style={{
              ...btnBase,
              background: 'transparent',
              color: COLORS.muted,
              border: `1px solid ${COLORS.border}`,
              padding: `${SPACING.sm}px`,
              fontSize: 12,
            }}
          >
            开始新诊断
          </button>
        </>
      )}

      {/* 跨页保留事件后（idle 且有事件）：可继续录制沿用旧事件，或开始全新诊断 */}
      {canResumeFromIdle && (
        <>
          <button
            onClick={resumeRecording}
            style={{
              ...btnBase,
              background: COLORS.primary,
              padding: `${SPACING.sm}px`,
              fontSize: 13,
            }}
          >
            继续录制
          </button>
          <button
            onClick={startRecording}
            style={{
              ...btnBase,
              background: 'transparent',
              color: COLORS.muted,
              border: `1px solid ${COLORS.border}`,
              padding: `${SPACING.sm}px`,
              fontSize: 12,
            }}
          >
            开始新诊断
          </button>
        </>
      )}
    </div>
  );
};

export default RecordControls;
