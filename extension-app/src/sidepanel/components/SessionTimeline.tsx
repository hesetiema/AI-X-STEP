// sidepanel/components/SessionTimeline.tsx
// 按时间展示事件流
// - 网络事件按 requestId 合并为单行：POST /api/path + 成功/失败
// - 支持按事件类型筛选
// - 每行支持复制内容

import React, { useMemo, useState } from 'react';
import type { ProbeEvent, NetworkEvent } from '@/shared/types';
import { COLORS, SPACING, panelStyles } from '../styles';
import { useSidePanelStore } from '../store';

const KIND_ICON: Record<string, string> = {
  ui: '👆',
  ui_state: '📊',
  network: '🌐',
  error: '❌',
  bridge: '🔗',
  observation: '👁',
};

const KIND_LABEL: Record<string, string> = {
  ui: '交互',
  ui_state: '状态',
  network: '请求',
  error: '错误',
  bridge: '桥接',
  observation: '检测',
};

const RESULT_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  success: { label: '✓ 成功', color: COLORS.success, bg: COLORS.successBg },
  failed: { label: '✗ 失败', color: COLORS.danger, bg: COLORS.dangerBg },
  timeout: { label: '⏱ 超时', color: COLORS.danger, bg: COLORS.dangerBg },
  empty: { label: '空数据', color: COLORS.warning, bg: COLORS.warningBg },
  invalid_data: { label: '结构异常', color: COLORS.warning, bg: COLORS.warningBg },
  unknown: { label: '未知', color: COLORS.muted, bg: COLORS.surface },
  pending: { label: '请求中...', color: COLORS.muted, bg: COLORS.surface },
};

interface MergedNetworkRow {
  kind: 'network';
  occurredAt: number;
  method: string;
  url: string;
  phase: NetworkEvent['phase'];
  status?: number;
  durationMs?: number;
  errorMessage?: string;
  resultCategory: string;
  actionLabel?: string;
}

type NonNetworkProbeEvent = Exclude<ProbeEvent, NetworkEvent>;
type TimelineRow = NonNetworkProbeEvent | MergedNetworkRow;

function mergeNetworkEvents(events: ProbeEvent[]): TimelineRow[] {
  const rows: TimelineRow[] = [];
  const networkMap = new Map<string, MergedNetworkRow>();

  for (const evt of events) {
    if (evt.kind !== 'network') {
      rows.push(evt);
      continue;
    }
    const existing = networkMap.get(evt.requestId);
    if (!existing) {
      const row: MergedNetworkRow = {
        kind: 'network',
        occurredAt: evt.occurredAt,
        method: evt.method,
        url: evt.url,
        phase: evt.phase,
        status: evt.status,
        durationMs: evt.durationMs,
        errorMessage: evt.errorMessage,
        resultCategory: resolveResultCategory(evt),
        actionLabel: evt.insight?.actionLabel,
      };
      networkMap.set(evt.requestId, row);
      rows.push(row);
    } else {
      existing.phase = evt.phase;
      if (evt.status !== undefined) existing.status = evt.status;
      if (evt.durationMs !== undefined) existing.durationMs = evt.durationMs;
      if (evt.errorMessage !== undefined) existing.errorMessage = evt.errorMessage;
      if (evt.insight?.resultCategory) {
        existing.resultCategory = evt.insight.resultCategory;
      }
      if (evt.insight?.actionLabel) existing.actionLabel = evt.insight.actionLabel;
    }
  }

  rows.sort((a, b) => a.occurredAt - b.occurredAt);
  return rows;
}

function resolveResultCategory(evt: NetworkEvent): string {
  if (evt.insight?.resultCategory) return evt.insight.resultCategory;
  return 'pending';
}

function formatApiPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function formatRowText(row: TimelineRow): string {
  if (row.kind === 'network') {
    return `${row.method} ${formatApiPath(row.url)}`;
  }
  switch (row.kind) {
    case 'ui':
      return `${row.eventType}${row.targetName ? ` → ${row.targetName}` : ''}${row.route ? ` [${row.route}]` : ''}`;
    case 'ui_state':
      return `${row.stateType}${row.message ? `: ${row.message}` : ''}`;
    case 'error':
      return `${row.errorType}: ${row.message.slice(0, 60)}`;
    case 'bridge':
      return `${row.bridgeType}${row.businessAction ? `: ${row.businessAction}` : ''}`;
    case 'observation':
      return `${row.observationType}`;
    default:
      return '';
  }
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  return `${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${d.getMilliseconds().toString().padStart(3, '0')}`;
}

const TimelineRowItem: React.FC<{ row: TimelineRow }> = ({ row }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(formatRowText(row));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const kind = row.kind;
  const badge = kind === 'network' ? RESULT_BADGE[row.resultCategory] : undefined;
  const text = formatRowText(row);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACING.xs,
        fontSize: 12,
        padding: '3px 0',
        borderBottom: `1px solid ${COLORS.border}`,
      }}
    >
      <span style={{ flexShrink: 0, width: 16, textAlign: 'center' }}>
        {KIND_ICON[kind] ?? '•'}
      </span>
      <span style={{ flexShrink: 0, color: COLORS.muted, fontSize: 11, fontFamily: 'monospace' }}>
        {formatTime(row.occurredAt)}
      </span>
      <span
        title={text}
        style={{
          color: COLORS.text,
          flex: 1,
          minWidth: 0,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {text}
      </span>
      {badge && (
        <span
          style={{
            flexShrink: 0,
            fontSize: 10,
            fontWeight: 600,
            color: badge.color,
            background: badge.bg,
            padding: '1px 6px',
            borderRadius: 3,
            whiteSpace: 'nowrap',
          }}
        >
          {badge.label}
        </span>
      )}
      <button
        onClick={handleCopy}
        title="复制"
        style={{
          flexShrink: 0,
          width: 22,
          height: 20,
          fontSize: 11,
          color: copied ? COLORS.success : COLORS.muted,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          fontFamily: 'inherit',
        }}
      >
        {copied ? '✓' : '📋'}
      </button>
    </div>
  );
};

const SessionTimeline: React.FC = () => {
  const events = useSidePanelStore((s) => s.events);
  const status = useSidePanelStore((s) => s.status);
  const [filter, setFilter] = useState<string>('all');

  const rows = useMemo(() => mergeNetworkEvents(events), [events]);
  const visibleRows = useMemo(
    () => (filter === 'all' ? rows : rows.filter((r) => r.kind === filter)),
    [rows, filter],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) c[r.kind] = (c[r.kind] ?? 0) + 1;
    return c;
  }, [rows]);

  const filterChips = useMemo(() => {
    const chips = [{ key: 'all', label: '全部', count: rows.length }];
    for (const kind of Object.keys(KIND_LABEL)) {
      if ((counts[kind] ?? 0) > 0) {
        chips.push({ key: kind, label: KIND_LABEL[kind], count: counts[kind] });
      }
    }
    return chips;
  }, [counts, rows.length]);

  if (events.length === 0) {
    return (
      <div style={panelStyles.card}>
        <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: SPACING.sm }}>
          事件时间线
        </div>
        <div style={{ fontSize: 12, color: COLORS.textSecondary, textAlign: 'center', padding: SPACING.xl }}>
          {status === 'recording' ? '等待事件...' : '暂无事件'}
        </div>
      </div>
    );
  }

  return (
    <div style={panelStyles.card}>
      <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: SPACING.sm }}>
        事件时间线 ({visibleRows.length})
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          marginBottom: SPACING.sm,
        }}
      >
        {filterChips.map((chip) => {
          const active = filter === chip.key;
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => setFilter(chip.key)}
              style={{
                border: `1px solid ${active ? COLORS.primary : COLORS.border}`,
                background: active ? COLORS.primary : COLORS.bg,
                color: active ? '#fff' : COLORS.textSecondary,
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 10,
                cursor: 'pointer',
                lineHeight: '18px',
                fontFamily: 'inherit',
              }}
            >
              {chip.label}
              <span style={{ marginLeft: 3, opacity: 0.8 }}>{chip.count}</span>
            </button>
          );
        })}
      </div>

      <div className="timeline-scroll" style={{ maxHeight: 230, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {visibleRows.map((row, idx) => (
          <TimelineRowItem key={idx} row={row} />
        ))}
        {visibleRows.length === 0 && (
          <div style={{ fontSize: 12, color: COLORS.textSecondary, textAlign: 'center', padding: SPACING.lg }}>
            当前筛选下无事件
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionTimeline;
