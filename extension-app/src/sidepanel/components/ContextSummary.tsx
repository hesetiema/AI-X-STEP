// sidepanel/components/ContextSummary.tsx
// 页面上下文展示

import React from 'react';
import { COLORS, SPACING, panelStyles } from '../styles';
import { useSidePanelStore } from '../store';

const ContextSummary: React.FC = () => {
  const status = useSidePanelStore((s) => s.status);
  const stats = useSidePanelStore((s) => s.stats);

  return (
    <div style={panelStyles.card}>
      <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: SPACING.sm }}>
        会话上下文
      </div>
      <div style={{ display: 'flex', gap: SPACING.lg, fontSize: 12 }}>
        <div>
          <span style={{ color: COLORS.textSecondary }}>状态: </span>
          <span style={{ fontWeight: 500, color: COLORS.text }}>{status}</span>
        </div>
        {stats && (
          <div>
            <span style={{ color: COLORS.textSecondary }}>事件: </span>
            <span style={{ fontWeight: 500, color: COLORS.text }}>{stats.total}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContextSummary;
