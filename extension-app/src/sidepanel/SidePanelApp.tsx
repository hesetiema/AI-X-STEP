// sidepanel/SidePanelApp.tsx
// SidePanel 主入口 —— 常驻侧边栏，含完整录制控制 + 实时事件流 + 用户备注

import React, { useEffect, useRef, useState } from 'react';
import { panelStyles, COLORS, SPACING } from './styles';
import PagePerfIndicator from './components/PagePerfIndicator';
import RecordControls from './components/RecordControls';
import ResultCard from './components/ResultCard';
import SessionTimeline from './components/SessionTimeline';
import UserHintForm from './components/UserHintForm';
import { useSidePanelStore } from './store';
import { useSidePanelActions } from './store/use-sidepanel-actions';
import type { RuntimeMessage } from '@/shared/types';

const SidePanelApp: React.FC = () => {
  const status = useSidePanelStore((s) => s.status);
  const deepDiagnosis = useSidePanelStore((s) => s.deepDiagnosis);
  const reset = useSidePanelStore((s) => s.reset);
  const { restoreStatus, refreshStats, toggleDeepDiagnosis } = useSidePanelActions();
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    restoreStatus();
  }, [restoreStatus]);

  // 监听 Tab 切换：background 通过 chrome.tabs.onActivated 发来 TAB_SWITCHED
  // 只有普通窗口（normal）才响应，跳过 popup 窗口（如工作台）
  useEffect(() => {
    const listener = (message: RuntimeMessage) => {
      if (message.type === 'TAB_SWITCHED') {
        reset();
        restoreStatus();
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
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
          { key: 'perf' as const, label: '性能监控' },
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
          <PagePerfIndicator />
        ) : (
          <>
            {/* 录制控制按钮 */}
            <RecordControls />

            {/* 深度诊断开关 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: `${SPACING.md}px`,
                borderRadius: 8,
                border: `1px solid ${deepDiagnosis ? '#4f46e5' : COLORS.border}`,
                background: deepDiagnosis ? '#eef2ff' : COLORS.surface,
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>
                  🔬 深度诊断
                </div>
                <div style={{ fontSize: 11, color: COLORS.textSecondary }}>
                  捕获调用栈与运行时上下文（会显示调试提示条）
                </div>
              </div>
              <button
                onClick={toggleDeepDiagnosis}
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: 12,
                  border: 'none',
                  background: deepDiagnosis ? '#4f46e5' : COLORS.border,
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'background 0.15s',
                }}
                aria-label={deepDiagnosis ? '关闭深度诊断' : '开启深度诊断'}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: 2,
                    left: deepDiagnosis ? 22 : 2,
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: '#fff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    transition: 'left 0.15s',
                  }}
                />
              </button>
            </div>

            {/* 提交结果 */}
            <ResultCard />

            {/* 事件时间线 */}
            <SessionTimeline />

            {/* 用户备注（提交前补充） */}
            <UserHintForm />
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
