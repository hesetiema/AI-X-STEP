// sidepanel/components/WaterfallChart.tsx
// 时间线瀑布流 —— 还原请求时序，识别串行/并行阻塞

import React, { useMemo, useState } from 'react';
import { COLORS, SPACING } from '../styles';
import { useSidePanelStore } from '../store';
import type { SlowApiInfo } from '@/shared/types';

interface WaterfallRow {
  api: SlowApiInfo;
  leftPct: number;
  widthPct: number;
}

const PHASE_COLOR: Record<SlowApiInfo['phase'], string> = {
  pending: COLORS.warning,
  slow: COLORS.danger,
  error: COLORS.danger,
  timeout: COLORS.danger,
};

function formatDuration(ms: number): string {
  if (ms >= 1_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

function formatAxis(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

const WaterfallChart: React.FC = () => {
  const slowApis = useSidePanelStore((s) => s.slowApis);
  const monitoringStartMs = useSidePanelStore((s) => s.monitoringStartMs);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const { rows, totalMs } = useMemo<{ rows: WaterfallRow[]; totalMs: number }>(() => {
    // 按 requestId 去重，保留最新
    const map = new Map<string, SlowApiInfo>();
    for (const api of slowApis) {
      map.set(api.requestId, api);
    }
    const apis = Array.from(map.values()).sort((a, b) => a.startedAt - b.startedAt);

    if (apis.length === 0 || monitoringStartMs == null) {
      return { rows: [], totalMs: 0 };
    }

    const endMs = Math.max(
      ...apis.map((a) => a.startedAt + a.durationMs),
      Date.now(),
    );
    const total = endMs - monitoringStartMs;
    if (total <= 0) return { rows: [], totalMs: 0 };

    const items = apis.map((api) => {
      const left = Math.max(0, api.startedAt - monitoringStartMs);
      const leftPct = (left / total) * 100;
      const widthPct = Math.max(1, (api.durationMs / total) * 100);
      return { api, leftPct, widthPct };
    });

    return { rows: items, totalMs: total };
  }, [slowApis, monitoringStartMs]);

  if (rows.length === 0) {
    return (
      <div style={{ fontSize: 12, color: COLORS.textSecondary, textAlign: 'center', padding: SPACING.xl }}>
        暂无数据
      </div>
    );
  }

  const tickCount = 4;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => (totalMs / tickCount) * i);

  return (
    <div>
      {/* 时间轴标尺 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: COLORS.muted, marginBottom: 4, paddingLeft: 24, fontFamily: 'monospace' }}>
        {ticks.map((t, i) => (
          <span key={i}>{formatAxis(t)}</span>
        ))}
      </div>

      {/* 瀑布流行 */}
      <div className="timeline-scroll" style={{ maxHeight: 300, overflowY: 'auto', overflowX: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {rows.map((row, i) => {
            const color = PHASE_COLOR[row.api.phase];
            const isPending = row.api.phase === 'pending';
            return (
              <div
                key={row.api.requestId}
                title={`${row.api.method} ${row.api.url} · ${formatDuration(row.api.durationMs)}${row.api.status != null ? ` · ${row.api.status}` : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: SPACING.xs,
                  fontSize: 10,
                  height: 18,
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    width: 20,
                    color: COLORS.muted,
                    textAlign: 'right',
                    fontSize: 9,
                  }}
                >
                  {i + 1}
                </span>
                <div style={{ flex: 1, position: 'relative', height: 14, minWidth: 0 }}>
                  {/* 瀑布条 */}
                  <div
                    style={{
                      position: 'absolute',
                      left: `${row.leftPct}%`,
                      width: `${row.widthPct}%`,
                      height: '100%',
                      borderRadius: 3,
                      background: isPending
                        ? `repeating-linear-gradient(45deg, ${color}40, ${color}40 3px, ${color}20 3px, ${color}20 6px)`
                        : color,
                      borderRight: isPending ? `2px dashed ${color}` : 'none',
                      boxSizing: 'border-box',
                      minWidth: 2,
                    }}
                  />
                </div>
                <span
                  style={{
                    flexShrink: 0,
                    color: color,
                    fontWeight: 600,
                    fontSize: 9,
                    whiteSpace: 'nowrap',
                    minWidth: 36,
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatDuration(row.api.durationMs)}
                </span>
                <button
                  onClick={() => handleCopy(row.api.requestId, `${row.api.method} ${row.api.url}`)}
                  title="复制"
                  style={{
                    flexShrink: 0,
                    width: 20,
                    height: 18,
                    fontSize: 10,
                    color: copiedKey === row.api.requestId ? COLORS.success : COLORS.muted,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    fontFamily: 'inherit',
                  }}
                >
                  {copiedKey === row.api.requestId ? '✓' : '📋'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 图例 */}
      <div style={{ display: 'flex', gap: SPACING.md, marginTop: SPACING.sm, fontSize: 9, color: COLORS.muted }}>
        <span>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: COLORS.warning, marginRight: 3 }} />
          pending
        </span>
        <span>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: COLORS.danger, marginRight: 3 }} />
          slow/error
        </span>
      </div>
    </div>
  );
};

export default WaterfallChart;
