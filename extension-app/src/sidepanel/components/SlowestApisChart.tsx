// sidepanel/components/SlowestApisChart.tsx
// 慢接口重灾区 —— 已完成接口按 URL 聚合，平均响应时间降序

import React, { useMemo, useState } from 'react';
import { COLORS, SPACING } from '../styles';
import { useSidePanelStore } from '../store';

interface SlowAgg {
  key: string;
  method: string;
  url: string;
  count: number;
  avgDuration: number;
  maxDuration: number;
}

function formatDuration(ms: number): string {
  if (ms >= 1_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

function apiPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

const SlowestApisChart: React.FC = () => {
  const slowApis = useSidePanelStore((s) => s.slowApis);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const groups = useMemo<SlowAgg[]>(() => {
    const map = new Map<string, { total: number; count: number; max: number; method: string; url: string }>();
    for (const api of slowApis) {
      if (api.phase === 'pending') continue;
      const key = `${api.method} ${api.url}`;
      const existing = map.get(key);
      if (existing) {
        existing.total += api.durationMs;
        existing.count++;
        existing.max = Math.max(existing.max, api.durationMs);
      } else {
        map.set(key, { total: api.durationMs, count: 1, max: api.durationMs, method: api.method, url: api.url });
      }
    }
    return Array.from(map.entries())
      .map(([key, v]) => ({ key, method: v.method, url: v.url, count: v.count, avgDuration: v.total / v.count, maxDuration: v.max }))
      .sort((a, b) => b.avgDuration - a.avgDuration);
  }, [slowApis]);

  const maxAvg = groups.length > 0 ? groups[0].avgDuration : 1;

  if (groups.length === 0) {
    return (
      <div style={{ fontSize: 12, color: COLORS.textSecondary, textAlign: 'center', padding: SPACING.xl }}>
        未发现慢接口
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {groups.map((g, i) => (
        <div key={g.key} style={{ display: 'flex', alignItems: 'center', gap: SPACING.xs, fontSize: 11 }}>
          <span style={{ flexShrink: 0, width: 16, color: COLORS.muted, textAlign: 'center', fontWeight: 600 }}>
            {i + 1}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.xs, marginBottom: 2 }}>
              <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 700, color: '#fff', background: COLORS.danger, padding: '0 4px', borderRadius: 2 }}>
                {g.method}
              </span>
              <span
                style={{ flex: 1, minWidth: 0, color: COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                title={g.url}
              >
                {apiPath(g.url)}
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: COLORS.border, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(g.avgDuration / maxAvg) * 100}%`, background: COLORS.danger, borderRadius: 3 }} />
            </div>
          </div>
          <span style={{ flexShrink: 0, color: COLORS.danger, fontWeight: 600, fontSize: 10, whiteSpace: 'nowrap' }}>
            avg {formatDuration(g.avgDuration)} · {g.count}次
          </span>
          <button
            onClick={() => handleCopy(g.key, `${g.method} ${g.url}`)}
            title="复制"
            style={{
              flexShrink: 0,
              width: 20,
              height: 18,
              fontSize: 10,
              color: copiedKey === g.key ? COLORS.success : COLORS.muted,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              fontFamily: 'inherit',
            }}
          >
            {copiedKey === g.key ? '✓' : '📋'}
          </button>
        </div>
      ))}
    </div>
  );
};

export default SlowestApisChart;
