// sidepanel/components/SessionTimeline.tsx
// 按时间展示事件流
// - 网络事件按 requestId 合并为单行：POST /url + 成功/失败
// - 支持按事件类型筛选

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

// 网络结果分类 → 中文标签 + 颜色（key 用宽松 string，兼容 insight.resultCategory 的 string 类型）
const RESULT_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  success: { label: '✓ 成功', color: COLORS.success, bg: COLORS.successBg },
  failed: { label: '✗ 失败', color: COLORS.danger, bg: COLORS.dangerBg },
  timeout: { label: '⏱ 超时', color: COLORS.danger, bg: COLORS.dangerBg },
  empty: { label: '空数据', color: COLORS.warning, bg: COLORS.warningBg },
  invalid_data: { label: '结构异常', color: COLORS.warning, bg: COLORS.warningBg },
  unknown: { label: '未知', color: COLORS.muted, bg: COLORS.surface },
  pending: { label: '请求中...', color: COLORS.muted, bg: COLORS.surface },
};

/**
 * 合并后的网络行：同一 requestId 的 request/response/error 聚合为一条。
 * 渲染与筛选都把它当作一条 network 行处理。
 */
interface MergedNetworkRow {
  kind: 'network';
  occurredAt: number; // 取该请求首次出现的时间
  method: string;
  url: string;
  phase: NetworkEvent['phase']; // 最终阶段（response/error 优先于 request）
  status?: number;
  durationMs?: number;
  errorMessage?: string;
  resultCategory: string; // pending 表示仅 request 阶段
  actionLabel?: string;
}

/**
 * 时间线行：网络事件已合并为 MergedNetworkRow，其余为原始 ProbeEvent。
 * 这里用排除 network 的 ProbeEvent 成员 + MergedNetworkRow 构成判别联合，
 * 使 kind === 'network' 时 TS 能收窄到 MergedNetworkRow。
 */
type NonNetworkProbeEvent = Exclude<ProbeEvent, NetworkEvent>;
type TimelineRow = NonNetworkProbeEvent | MergedNetworkRow;

/**
 * 将原始事件流中的网络事件按 requestId 合并，非网络事件原样保留，整体按 occurredAt 升序。
 * 不改 store 原始数据，仅做渲染派生。
 */
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
      // 首次出现（通常是 request 阶段）：创建行并入 rows（占时间轴位置），
      // 同时存进 networkMap 供后续阶段原地更新（rows 持同一引用）。
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
      // 后续阶段覆盖：保留最早的 occurredAt（首次出现位置），更新为最新阶段的数据。
      // rows 已持有 existing 引用，原地修改即同步生效。
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
  // 仅 request 阶段或无 insight 时视为 pending
  return 'pending';
}

function formatRowText(row: TimelineRow): string {
  if (row.kind === 'network') {
    // 网络行：URL（用 actionLabel 替换过长 URL 可选；这里保留 URL 更直观）
    return `${row.method} ${row.url}`;
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

const SessionTimeline: React.FC = () => {
  const events = useSidePanelStore((s) => s.events);
  const status = useSidePanelStore((s) => s.status);
  const [filter, setFilter] = useState<string>('all');

  // 合并网络事件 → 筛选
  const rows = useMemo(() => mergeNetworkEvents(events), [events]);
  const visibleRows = useMemo(
    () => (filter === 'all' ? rows : rows.filter((r) => r.kind === filter)),
    [rows, filter],
  );

  // 每种类型的计数（基于合并后行，供 chip 显示）
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

      {/* 筛选栏 */}
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

      <div style={{ maxHeight: 400, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {visibleRows.map((row, idx) => {
          const kind = row.kind;
          const badge =
            kind === 'network' ? RESULT_BADGE[row.resultCategory] : undefined;
          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: SPACING.sm,
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
              <span style={{ flexShrink: 0, fontSize: 10, color: COLORS.textSecondary, padding: '1px 4px', background: COLORS.surface, borderRadius: 3 }}>
                {KIND_LABEL[kind] ?? kind}
              </span>
              <span style={{ color: COLORS.text, wordBreak: 'break-all', flex: 1 }}>
                {formatRowText(row)}
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
            </div>
          );
        })}
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
