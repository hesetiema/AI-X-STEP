// sidepanel/SidePanelApp.tsx
// SidePanel 主入口 —— 常驻侧边栏，含完整录制控制 + 实时事件流 + 用户备注

import React, { useEffect, useRef } from 'react';
import { panelStyles, COLORS, SPACING } from './styles';
import StatusBar from './components/StatusBar';
import RecordControls from './components/RecordControls';
import ResultCard from './components/ResultCard';
import SessionTimeline from './components/SessionTimeline';
import UserHintForm from './components/UserHintForm';
import { useSidePanelStore } from './store';
import { useSidePanelActions } from './store/use-sidepanel-actions';

const SidePanelApp: React.FC = () => {
  const status = useSidePanelStore((s) => s.status);
  const { restoreStatus, refreshStats } = useSidePanelActions();
  const pollRef = useRef<number | null>(null);

  // SidePanel 每次打开时从 background 恢复状态
  useEffect(() => {
    restoreStatus();
  }, [restoreStatus]);

  // 录制中：每 2 秒刷新事件统计
  useEffect(() => {
    if (status === 'recording') {
      pollRef.current = window.setInterval(refreshStats, 2000);
    } else {
      if (pollRef.current !== null) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
    return () => {
      if (pollRef.current !== null) {
        clearInterval(pollRef.current);
      }
    };
  }, [status, refreshStats]);

  return (
    <div style={panelStyles.container}>
      {/* Header */}
      <div style={panelStyles.header}>
        <span style={{ fontSize: 18 }}>🔍</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.text }}>
            TraceLens 诊断助手
          </div>
          <div style={{ fontSize: 11, color: COLORS.textSecondary }}>
            常驻侧边栏 · 录制不会因点击页面而中断
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={panelStyles.body}>
        {/* 状态栏 + 计时 + 事件计数 */}
        <StatusBar />

        {/* 录制控制按钮 */}
        <RecordControls />

        {/* 提交结果 */}
        <ResultCard />

        {/* 事件时间线 */}
        <SessionTimeline />

        {/* 用户备注（提交前补充） */}
        <UserHintForm />
      </div>

      {/* Footer */}
      <div
        style={{
          padding: `${SPACING.sm}px ${SPACING.lg}px`,
          borderTop: `1px solid ${COLORS.border}`,
          fontSize: 11,
          color: COLORS.textSecondary,
          textAlign: 'center',
        }}
      >
        v0.1.0 MVP · 录制交互 → 提交诊断 → 查看因果链
      </div>

      {/* blink 动画 */}
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
};

export default SidePanelApp;
