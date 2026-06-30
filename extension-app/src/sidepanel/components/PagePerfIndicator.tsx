// PagePerfIndicator.tsx
// SidePanel 页面性能指示器 —— 展示自动采集的首屏性能摘要，支持按需触发诊断

import React, { useEffect, useState } from 'react';
import { useSidePanelStore } from '../store';
import { COLORS, SPACING } from '../styles';
import type { RuntimeMessage } from '@/shared/types';

export function formatPageReady(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

type DiagState = 'idle' | 'diagnosing' | 'done' | 'error';

const PagePerfIndicator: React.FC = () => {
  const pagePerf = useSidePanelStore((s) => s.pagePerf);
  const setPagePerf = useSidePanelStore((s) => s.setPagePerf);
  const status = useSidePanelStore((s) => s.status);
  const [diagState, setDiagState] = useState<DiagState>('idle');
  const [taskId, setTaskId] = useState<string | null>(null);

  useEffect(() => {
    const listener = (message: RuntimeMessage) => {
      if (message.type === 'PERF_UPDATE') {
        setPagePerf(message.perf);
        setDiagState('idle');
        setTaskId(null);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [setPagePerf]);

  useEffect(() => {
    if (status === 'idle') {
      setPagePerf(null);
      setDiagState('idle');
      setTaskId(null);
    }
  }, [status, setPagePerf]);

  const handleDiagnose = async () => {
    setDiagState('diagnosing');
    try {
      const res = await chrome.runtime.sendMessage({ type: 'DIAGNOSE_PAGE_LOAD' });
      if (res && res.ok && res.taskId) {
        setTaskId(res.taskId);
        setDiagState('done');
      } else {
        setDiagState('error');
        console.error('[TraceLens] diagnosePageLoad failed:', res?.error);
      }
    } catch (err) {
      setDiagState('error');
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

        {pagePerf && isSlow && diagState === 'idle' && (
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
            一键排查
          </button>
        )}

        {diagState === 'diagnosing' && (
          <span style={{ fontSize: 12, color: COLORS.textSecondary }}>诊断中...</span>
        )}

        {diagState === 'done' && taskId && (
          <button
            onClick={() => chrome.tabs.create({
              url: chrome.runtime.getURL('src/workbench/index.html') + `?taskId=${taskId}`,
            })}
            style={{
              padding: '4px 10px',
              fontSize: 12,
              fontWeight: 600,
              color: '#fff',
              background: COLORS.success,
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            打开工作台
          </button>
        )}

        {diagState === 'error' && (
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
            重试
          </button>
        )}
      </div>

      {pagePerf && isSlow && diagState === 'idle' && (
        <div style={{ fontSize: 11, color: COLORS.warning }}>
          ⚠ 页面初始化偏慢，可能存在接口性能问题，点击「一键排查」诊断
        </div>
      )}

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
