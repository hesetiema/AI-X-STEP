// PagePerfIndicator.tsx
// SidePanel 页面性能指示器 —— 展示自动采集的首屏性能摘要，支持按需触发诊断

import React, { useEffect } from 'react';
import { useSidePanelStore } from '../store';
import { COLORS, SPACING } from '../styles';
import type { RuntimeMessage } from '@/shared/types';

export function formatPageReady(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

const PagePerfIndicator: React.FC = () => {
  const pagePerf = useSidePanelStore((s) => s.pagePerf);
  const setPagePerf = useSidePanelStore((s) => s.setPagePerf);
  const status = useSidePanelStore((s) => s.status);

  // 监听来自 content script 的性能更新消息
  useEffect(() => {
    const listener = (message: RuntimeMessage) => {
      if (message.type === 'PERF_UPDATE') {
        setPagePerf(message.perf);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [setPagePerf]);

  // Tab 切换时重置
  useEffect(() => {
    if (status === 'idle') {
      setPagePerf(null);
    }
  }, [status, setPagePerf]);

  const handleDiagnose = async () => {
    try {
      chrome.runtime.sendMessage({ type: 'DIAGNOSE_PAGE_LOAD' });
    } catch (err) {
      console.error('[TraceLens] diagnosePageLoad error', err);
    }
  };

  const isSlow = pagePerf?.isSlow ?? false;
  const readyText = pagePerf
    ? `Page ready ${formatPageReady(pagePerf.pageReadyMs)}${isSlow ? ' (slow)' : ''}`
    : 'Measuring page load...';

  const bgColor = !pagePerf
    ? COLORS.surface
    : isSlow
    ? COLORS.warningBg
    : COLORS.successBg;
  const borderColor = !pagePerf
    ? COLORS.border
    : isSlow
    ? COLORS.warning
    : COLORS.success;
  const textColor = !pagePerf
    ? COLORS.textSecondary
    : isSlow
    ? COLORS.warning
    : COLORS.success;

  return (
    <div
      style={{
        padding: SPACING.md,
        borderRadius: 8,
        border: `1px solid ${borderColor}`,
        background: bgColor,
        display: 'flex',
        flexDirection: 'column',
        gap: SPACING.sm,
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
        <span style={{ fontSize: 14 }}>
          {!pagePerf ? '⏳' : isSlow ? '🐢' : '⚡'}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: textColor }}>
            {readyText}
          </div>
          {pagePerf && (
            <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 2 }}>
              LCP {pagePerf.lcpMs != null ? `${Math.round(pagePerf.lcpMs)}ms` : '—'}
              {' · '} FCP {pagePerf.fcpMs != null ? `${Math.round(pagePerf.fcpMs)}ms` : '—'}
              {' · '} TTFB {pagePerf.ttfbMs != null ? `${Math.round(pagePerf.ttfbMs)}ms` : '—'}
              {' · '} CLS {pagePerf.cls != null ? pagePerf.cls.toFixed(3) : '—'}
            </div>
          )}
        </div>

        {/* Diagnose button — only visible when slow */}
        {pagePerf && isSlow && (
          <button
            onClick={handleDiagnose}
            style={{
              padding: '4px 10px',
              fontSize: 12,
              fontWeight: 600,
              color: '#fff',
              background: COLORS.warning,
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            诊断
          </button>
        )}
      </div>

      {/* Observations */}
      {pagePerf && pagePerf.observations.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {pagePerf.observations.map((o) => (
            <span
              key={o}
              style={{
                fontSize: 10,
                padding: '1px 6px',
                borderRadius: 4,
                background: isSlow ? '#fef3c7' : '#d1fae5',
                color: isSlow ? '#92400e' : '#065f46',
              }}
            >
              {o}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default PagePerfIndicator;
