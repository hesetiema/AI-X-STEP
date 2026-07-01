// sidepanel/SidePanelApp.tsx
// SidePanel 主入口 —— 常驻侧边栏，含慢接口监控 + 诊断录制

import React, { useEffect, useRef, useState } from 'react';
import { panelStyles, COLORS, SPACING } from './styles';
import SlowApiMonitor from './components/SlowApiMonitor';
import RecordControls from './components/RecordControls';
import DeepDiagnosisToggle from './components/DeepDiagnosisToggle';
import ResultCard from './components/ResultCard';
import SessionTimeline from './components/SessionTimeline';
import UserHintForm from './components/UserHintForm';
import { useSidePanelStore } from './store';
import { useSidePanelActions } from './store/use-sidepanel-actions';
import type { RuntimeMessage } from '@/shared/types';

const SidePanelApp: React.FC = () => {
  const status = useSidePanelStore((s) => s.status);
  const reset = useSidePanelStore((s) => s.reset);
  const upsertSlowApi = useSidePanelStore((s) => s.upsertSlowApi);
  const { restoreStatus, refreshStats } = useSidePanelActions();
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    restoreStatus();
  }, [restoreStatus]);

  // 监听 Tab 切换 + 慢接口更新
  useEffect(() => {
    const listener = (message: RuntimeMessage) => {
      if (message.type === 'TAB_SWITCHED') {
        reset();
        restoreStatus();
      } else if (message.type === 'SLOW_API_UPDATE') {
        upsertSlowApi(message.api);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [restoreStatus, upsertSlowApi]);

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

  const [activeTab, setActiveTab] = useState<'perf' | 'diagnose'>('perf');

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

      {/* Tab Bar */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${COLORS.border}` }}>
        {[
          { key: 'perf' as const, label: '慢接口监控' },
          { key: 'diagnose' as const, label: '诊断录制' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1,
              padding: '10px 0',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.key
                ? `2px solid ${COLORS.primary}`
                : '2px solid transparent',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: activeTab === tab.key ? 600 : 400,
              color: activeTab === tab.key ? COLORS.primary : COLORS.textSecondary,
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={panelStyles.body}>
        {activeTab === 'perf' ? (
          <SlowApiMonitor />
        ) : (
          <>
            {/* 空闲态：仅开始按钮 + 深度诊断开关 */}
            {status === 'idle' && (
              <>
                <RecordControls />
                <DeepDiagnosisToggle />
              </>
            )}

            {/* 录制中：录制指示 + 停止按钮 + 深度诊断 + 实时时间线 */}
            {status === 'recording' && (
              <>
                <RecordControls />
                <DeepDiagnosisToggle />
                <SessionTimeline />
              </>
            )}

            {/* 停止后：操作内容 + 提交结果 + 用户备注 + 提交按钮 */}
            {(status === 'stopped' || status === 'uploading' || status === 'uploaded' || status === 'failed') && (
              <>
                <SessionTimeline />
                <ResultCard />
                <UserHintForm />
                <RecordControls />
              </>
            )}
          </>
        )}
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
        .timeline-scroll::-webkit-scrollbar { width: 6px; }
        .timeline-scroll::-webkit-scrollbar-thumb { background: rgba(107,114,128,0.35); border-radius: 3px; }
        .timeline-scroll::-webkit-scrollbar-track { background: transparent; }
        .timeline-scroll { scrollbar-width: thin; }
      `}</style>
    </div>
  );
};

export default SidePanelApp;
