// sidepanel/components/StatusBar.tsx
// 状态栏 —— 显示当前录制状态 + 计时

import React, { useEffect, useRef, useState } from 'react';
import { COLORS, SPACING, panelStyles } from '../styles';
import { useSidePanelStore } from '../store';

const STATUS_LABEL: Record<string, string> = {
  idle: '待命',
  recording: '录制中',
  stopped: '已停止',
  uploading: '上传中',
  uploaded: '已上传',
  failed: '上传失败',
};

const STATUS_COLOR: Record<string, string> = {
  idle: COLORS.muted,
  recording: COLORS.primary,
  stopped: COLORS.warning,
  uploading: COLORS.warning,
  uploaded: COLORS.success,
  failed: COLORS.danger,
};

const StatusBar: React.FC = () => {
  const status = useSidePanelStore((s) => s.status);
  const stats = useSidePanelStore((s) => s.stats);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<number | null>(null);

  // 录制计时
  useEffect(() => {
    if (status === 'recording') {
      timerRef.current = window.setInterval(() => {
        setElapsed((e) => e + 1);
      }, 1000);
    } else {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (status === 'idle') setElapsed(0);
    }
    return () => {
      if (timerRef.current !== null) clearInterval(timerRef.current);
    };
  }, [status]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div style={{ ...panelStyles.card, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: STATUS_COLOR[status] ?? COLORS.muted,
            display: 'inline-block',
            animation: status === 'recording' ? 'blink 1s infinite' : 'none',
          }}
        />
        <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>
          {STATUS_LABEL[status] ?? status}
        </span>
      </div>
      <div style={{ display: 'flex', gap: SPACING.lg, fontSize: 12, color: COLORS.textSecondary }}>
        {status === 'recording' && (
          <span style={{ fontFamily: 'monospace', color: COLORS.text }}>⏱ {timeStr}</span>
        )}
        {stats && (
          <>
            <span>👆 {stats.interaction}</span>
            <span>🌐 {stats.network}</span>
            <span style={{ color: stats.error > 0 ? COLORS.danger : undefined }}>❌ {stats.error}</span>
          </>
        )}
      </div>
    </div>
  );
};

export default StatusBar;
