// sidepanel/components/SlowApiMonitor.tsx
// 慢接口监控 —— 手动 start/stop，列出响应慢(>1s)或 pending(>3s) 的接口
// - 按 method+url 去重（保留最新状态，显示重复计数）
// - monitoring 状态：时间线排序；stopped 状态：响应时间降序
// - 列表支持筛选：全部 / pending / 已完成
// - stopped 状态支持 sub-tabs: 列表 / 卡死排行 / 慢接口重灾区 / 瀑布流
// - 每行支持复制

import React, { useEffect, useMemo, useState } from 'react';
import { COLORS, SPACING, panelStyles } from '../styles';
import { useSidePanelStore } from '../store';
import { useSidePanelActions } from '../store/use-sidepanel-actions';
import type { SlowApiInfo } from '@/shared/types';
import TopPendingChart from './TopPendingChart';
import SlowestApisChart from './SlowestApisChart';
import WaterfallChart from './WaterfallChart';

const PHASE_STYLE: Record<SlowApiInfo['phase'], { icon: string; color: string; bg: string }> = {
  pending: { icon: '🟡', color: COLORS.warning, bg: COLORS.warningBg },
  slow: { icon: '🔴', color: COLORS.danger, bg: COLORS.dangerBg },
  error: { icon: '❌', color: COLORS.danger, bg: COLORS.dangerBg },
  timeout: { icon: '⏱', color: COLORS.danger, bg: COLORS.dangerBg },
};

type FilterKey = 'all' | 'pending' | 'completed';
type SubTab = 'list' | 'pending' | 'slowest' | 'waterfall';

interface DedupedApi {
  api: SlowApiInfo;
  firstIndex: number;
  repeatCount: number;
}

function formatDuration(ms: number): string {
  if (ms >= 10_000) return `${(ms / 1000).toFixed(0)}s`;
  if (ms >= 1_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

function shortenUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname + u.search;
    return path.length > 45 ? path.slice(0, 42) + '...' : path;
  } catch {
    return url.length > 45 ? url.slice(0, 42) + '...' : url;
  }
}

const SlowApiRow: React.FC<{ item: DedupedApi }> = ({ item }) => {
  const { api, repeatCount } = item;
  const [copied, setCopied] = useState(false);
  const style = PHASE_STYLE[api.phase];

  const handleCopy = () => {
    navigator.clipboard.writeText(`${api.method} ${api.url}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

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
      {repeatCount > 1 && (
        <span style={{ flexShrink: 0, fontSize: 9, color: COLORS.muted, background: COLORS.surface, padding: '0 4px', borderRadius: 3 }}>
          ×{repeatCount}
        </span>
      )}
      <span style={{ flexShrink: 0, color: style.color, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
        {formatDuration(api.durationMs)}
      </span>
      {api.status != null && (
        <span style={{ flexShrink: 0, fontSize: 10, color: COLORS.muted, minWidth: 24, textAlign: 'right' }}>
          {api.status}
        </span>
      )}
      {api.phase === 'pending' && (
        <span style={{ flexShrink: 0, fontSize: 9, color: style.color }}>...</span>
      )}
      <button
        onClick={handleCopy}
        title="复制"
        style={{
          flexShrink: 0,
          width: 20,
          height: 18,
          fontSize: 10,
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

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: 'list', label: '列表' },
  { key: 'pending', label: '卡死排行' },
  { key: 'slowest', label: '慢接口' },
  { key: 'waterfall', label: '瀑布流' },
];

const SlowApiMonitor: React.FC = () => {
  const monitoringStatus = useSidePanelStore((s) => s.monitoringStatus);
  const slowApis = useSidePanelStore((s) => s.slowApis);
  const { startMonitoring, stopMonitoring } = useSidePanelActions();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [subTab, setSubTab] = useState<SubTab>('list');

  // 按 method + url 去重，保留最新状态，记录首次出现位置和重复计数
  const dedupedApis = useMemo<DedupedApi[]>(() => {
    const map = new Map<string, DedupedApi>();
    slowApis.forEach((api, index) => {
      const key = `${api.method} ${api.url}`;
      const existing = map.get(key);
      if (existing) {
        existing.api = api;
        existing.repeatCount++;
      } else {
        map.set(key, { api, firstIndex: index, repeatCount: 1 });
      }
    });
    const arr = Array.from(map.values());
    // stopped 状态：响应时间降序；monitoring 状态：时间线排序
    if (monitoringStatus === 'stopped') {
      arr.sort((a, b) => b.api.durationMs - a.api.durationMs);
    } else {
      arr.sort((a, b) => a.firstIndex - b.firstIndex);
    }
    return arr;
  }, [slowApis, monitoringStatus]);

  const filteredApis = useMemo(() => {
    if (filter === 'all') return dedupedApis;
    if (filter === 'pending') return dedupedApis.filter(({ api }) => api.phase === 'pending');
    return dedupedApis.filter(({ api }) => api.phase !== 'pending');
  }, [dedupedApis, filter]);

  const pendingCount = dedupedApis.filter(({ api }) => api.phase === 'pending').length;
  const completedCount = dedupedApis.length - pendingCount;

  // 切到 pending 筛选后，若已无 pending 接口，自动切回全部
  useEffect(() => {
    if (filter === 'pending' && pendingCount === 0 && dedupedApis.length > 0) {
      setFilter('all');
    }
  }, [filter, pendingCount, dedupedApis.length]);

  const filterChips = [
    { key: 'all' as const, label: '全部', count: dedupedApis.length },
    { key: 'pending' as const, label: 'Pending', count: pendingCount },
    { key: 'completed' as const, label: '已完成', count: completedCount },
  ].filter((c) => c.count > 0 || c.key === 'all');

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

  const isStopped = monitoringStatus === 'stopped';

  return (
    <div style={panelStyles.card}>
      {/* 标题栏 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>
          {monitoringStatus === 'monitoring' ? '🔴 监控中' : '📊 监控结果'}
          {dedupedApis.length > 0 && (
            <span style={{ fontSize: 11, color: COLORS.textSecondary, marginLeft: 6 }}>
              ({dedupedApis.length}{pendingCount > 0 ? ` · ${pendingCount} pending` : ''})
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

      {/* stopped 状态：sub-tabs */}
      {isStopped && dedupedApis.length > 0 && (
        <div style={{ display: 'flex', gap: 2, marginBottom: SPACING.sm, borderBottom: `1px solid ${COLORS.border}` }}>
          {SUB_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSubTab(tab.key)}
              style={{
                flex: 1,
                padding: '6px 0',
                background: 'none',
                border: 'none',
                borderBottom: subTab === tab.key ? `2px solid ${COLORS.primary}` : '2px solid transparent',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: subTab === tab.key ? 600 : 400,
                color: subTab === tab.key ? COLORS.primary : COLORS.textSecondary,
                fontFamily: 'inherit',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* 列表视图的筛选栏（仅 list sub-tab 或 monitoring 状态） */}
      {(!isStopped || subTab === 'list') && filterChips.length > 1 && (
        <div style={{ display: 'flex', gap: 4, marginBottom: SPACING.sm }}>
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
      )}

      {/* 内容区 */}
      {isStopped && subTab === 'pending' ? (
        <TopPendingChart />
      ) : isStopped && subTab === 'slowest' ? (
        <SlowestApisChart />
      ) : isStopped && subTab === 'waterfall' ? (
        <WaterfallChart />
      ) : (
        // 列表视图（monitoring 状态 或 stopped 的 list sub-tab）
        filteredApis.length === 0 ? (
          <div style={{ fontSize: 12, color: COLORS.textSecondary, textAlign: 'center', padding: `${SPACING.xl}px 0` }}>
            {dedupedApis.length === 0
              ? monitoringStatus === 'monitoring' ? '暂无慢接口，持续监控中...' : '本次监控未发现慢接口'
              : '当前筛选下无接口'}
          </div>
        ) : (
          <div className="timeline-scroll" style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
            {filteredApis.map((item) => (
              <SlowApiRow key={`${item.api.method}-${item.api.url}`} item={item} />
            ))}
          </div>
        )
      )}
    </div>
  );
};

export default SlowApiMonitor;
