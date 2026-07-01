// sidepanel/components/SlowApiMonitor.tsx
// 慢接口监控 —— 手动 start/stop，列出响应慢(>1s)或 pending(>3s) 的接口

import React from 'react';
import { COLORS, SPACING, panelStyles } from '../styles';
import { useSidePanelStore } from '../store';
import { useSidePanelActions } from '../store/use-sidepanel-actions';
import type { SlowApiInfo } from '@/shared/types';

const PHASE_STYLE: Record<SlowApiInfo['phase'], { icon: string; color: string; bg: string; label: string }> = {
  pending: { icon: '🟡', color: COLORS.warning, bg: COLORS.warningBg, label: 'pending' },
  slow: { icon: '🔴', color: COLORS.danger, bg: COLORS.dangerBg, label: 'slow' },
  error: { icon: '❌', color: COLORS.danger, bg: COLORS.dangerBg, label: 'error' },
  timeout: { icon: '⏱', color: COLORS.danger, bg: COLORS.dangerBg, label: 'timeout' },
};

function formatDuration(ms: number): string {
  if (ms >= 10_000) return `${(ms / 1000).toFixed(0)}s`;
  if (ms >= 1_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

function shortenUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname + u.search;
    return path.length > 50 ? path.slice(0, 47) + '...' : path;
  } catch {
    return url.length > 50 ? url.slice(0, 47) + '...' : url;
  }
}

const SlowApiRow: React.FC<{ api: SlowApiInfo }> = ({ api }) => {
  const style = PHASE_STYLE[api.phase];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACING.xs,
        fontSize: 11,
        padding: '4px 6px',
        borderRadius: 4,
        background: style.bg,
      }}
    >
      <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 3, color: '#fff', background: style.color }}>
        {api.method}
      </span>
      <span
        style={{ flex: 1, minWidth: 0, color: COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        title={api.url}
      >
        {shortenUrl(api.url)}
      </span>
      <span style={{ flexShrink: 0, color: style.color, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
        {formatDuration(api.durationMs)}
      </span>
      {api.status != null && (
        <span style={{ flexShrink: 0, fontSize: 10, color: COLORS.muted, minWidth: 28, textAlign: 'right' }}>
          {api.status}
        </span>
      )}
      {api.phase === 'pending' && (
        <span style={{ flexShrink: 0, fontSize: 9, color: style.color }}>...</span>
      )}
    </div>
  );
};

const SlowApiMonitor: React.FC = () => {
  const monitoringStatus = useSidePanelStore((s) => s.monitoringStatus);
  const slowApis = useSidePanelStore((s) => s.slowApis);
  const { startMonitoring, stopMonitoring } = useSidePanelActions();

  const pendingCount = slowApis.filter((a) => a.phase === 'pending').length;

  if (monitoringStatus === 'idle') {
    return (
      <div style={panelStyles.card}>
        <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: SPACING.sm }}>
          🔍 慢接口监控
        </div>
        <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: SPACING.md, lineHeight: 1.5 }}>
          监控当前页面的接口请求，自动列出响应慢（&gt;1s）或长时间 pending（&gt;3s）的接口。
        </div>
        <button
          onClick={startMonitoring}
          style={{
            width: '100%',
            padding: `${SPACING.sm}px ${SPACING.md}px`,
            fontSize: 13,
            fontWeight: 600,
            color: '#fff',
            background: COLORS.primary,
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          开始监控
        </button>
      </div>
    );
  }

  return (
    <div style={panelStyles.card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>
          {monitoringStatus === 'monitoring' ? '🔴 监控中' : '📊 监控结果'}
          {slowApis.length > 0 && (
            <span style={{ fontSize: 11, color: COLORS.textSecondary, marginLeft: 6 }}>
              ({slowApis.length}{pendingCount > 0 ? ` · ${pendingCount} pending` : ''})
            </span>
          )}
        </div>
        {monitoringStatus === 'monitoring' ? (
          <button
            onClick={stopMonitoring}
            style={{
              padding: '4px 12px',
              fontSize: 12,
              fontWeight: 600,
              color: '#fff',
              background: COLORS.danger,
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            停止监控
          </button>
        ) : (
          <button
            onClick={startMonitoring}
            style={{
              padding: '4px 12px',
              fontSize: 12,
              fontWeight: 600,
              color: '#fff',
              background: COLORS.primary,
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            开始新监控
          </button>
        )}
      </div>

      {slowApis.length === 0 ? (
        <div style={{ fontSize: 12, color: COLORS.textSecondary, textAlign: 'center', padding: `${SPACING.xl}px 0` }}>
          {monitoringStatus === 'monitoring' ? '暂无慢接口，持续监控中...' : '本次监控未发现慢接口'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {slowApis.map((api) => (
            <SlowApiRow key={api.requestId} api={api} />
          ))}
        </div>
      )}
    </div>
  );
};

export default SlowApiMonitor;
