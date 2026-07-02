// sidepanel/components/PipelineResult.tsx
// Pipeline 诊断结果展示 —— 字段级逐 node 状态 + 断点高亮

import React from 'react';
import { COLORS, SPACING, panelStyles } from '../styles';
import { useSidePanelStore } from '../store';

const statusConfig = {
  passed: { color: COLORS.success, bg: COLORS.successBg, label: '通过' },
  failed: { color: COLORS.danger, bg: COLORS.dangerBg, label: '失败' },
  skipped: { color: COLORS.muted, bg: COLORS.surface, label: '跳过' },
} as const;

const PipelineResult: React.FC = () => {
  const pipelineResult = useSidePanelStore((s) => s.pipelineResult);

  if (!pipelineResult) return null;

  const { fieldChecks } = pipelineResult;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.sm }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>
        诊断结果
      </div>

      {fieldChecks.map((fc) => {
        const hasFailure = fc.breakpoint;
        return (
          <div
            key={fc.field}
            style={{
              ...panelStyles.card,
              borderColor: hasFailure ? COLORS.danger : COLORS.border,
              padding: SPACING.sm,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: COLORS.text,
                marginBottom: SPACING.xs,
                display: 'flex',
                alignItems: 'center',
                gap: SPACING.xs,
              }}
            >
              <span>{fc.label}</span>
              <span style={{ fontWeight: 400, color: COLORS.textSecondary, fontSize: 11 }}>({fc.field})</span>
              {hasFailure && (
                <span style={{
                  fontSize: 10,
                  color: '#fff',
                  background: COLORS.danger,
                  padding: '1px 6px',
                  borderRadius: 3,
                  marginLeft: 'auto',
                }}>
                  断点: {fc.breakpoint}
                </span>
              )}
            </div>

            {/* Node chain */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
              {fc.nodes.map((node, i) => {
                const cfg = statusConfig[node.status];
                return (
                  <React.Fragment key={node.name}>
                    {i > 0 && (
                      <span style={{ color: COLORS.textSecondary, fontSize: 10 }}>→</span>
                    )}
                    <span
                      title={node.error ?? node.value != null ? `值: ${JSON.stringify(node.value)}` : undefined}
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: node.status === 'failed' ? 600 : 400,
                        color: cfg.color,
                        background: cfg.bg,
                        border: `1px solid ${node.status === 'failed' ? COLORS.danger : 'transparent'}`,
                        cursor: node.error || node.value != null ? 'help' : 'default',
                      }}
                    >
                      {node.name}
                    </span>
                  </React.Fragment>
                );
              })}
            </div>

            {/* Detail lines for failed/skipped nodes */}
            {fc.nodes.filter(n => n.status !== 'passed').map((node) => (
              <div key={node.name} style={{ marginTop: SPACING.xs, fontSize: 10, color: COLORS.textSecondary }}>
                {node.error && <div>原因: {node.error}</div>}
                {node.value !== undefined && <div>实际值: {JSON.stringify(node.value)}</div>}
                {node.expected !== undefined && <div>期望值: {JSON.stringify(node.expected)}</div>}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};

export default PipelineResult;
