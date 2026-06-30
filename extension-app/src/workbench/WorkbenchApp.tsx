import React from 'react';
import { useDiagnosisResult } from './useDiagnosisResult';
import {
  COLORS,
  SPACING,
  STAGE_LABELS,
  STATE_LABELS,
  NODE_STATUS_STYLE,
  wbStyles,
} from './styles';
import type { DominoNode } from '@/shared/types';

interface FindingView {
  ruleCode?: string;
  title?: string;
  summary?: string;
  confidence?: number;
  score?: number;
  layer?: string;
  rank?: number;
}

const WorkbenchApp: React.FC = () => {
  const taskId = new URLSearchParams(window.location.search).get('taskId');
  const { result, status, error } = useDiagnosisResult(taskId);

  if (status === 'loading') {
    return (
      <div style={wbStyles.loading}>
        <div style={wbStyles.spinner} />
        <div style={{ fontSize: 15, color: COLORS.textSecondary }}>诊断分析中…</div>
        <div style={{ fontSize: 12, color: COLORS.muted }}>
          Task ID: {taskId?.slice(0, 16)}…
        </div>
      </div>
    );
  }

  if (status === 'error' || !result) {
    return (
      <div style={wbStyles.page}>
        <div style={{ ...wbStyles.section, borderColor: COLORS.danger }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: COLORS.danger }}>无法获取诊断结果</div>
          <div style={{ fontSize: 13, color: COLORS.textSecondary, marginTop: SPACING.sm }}>
            {error ?? '未知错误'}
          </div>
        </div>
      </div>
    );
  }

  if (result.status === 'failed') {
    return (
      <div style={wbStyles.page}>
        <Header taskId={result.taskId} />
        <div style={{ ...wbStyles.section, borderColor: COLORS.danger }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: COLORS.danger }}>诊断失败</div>
        </div>
      </div>
    );
  }

  const conclusion = result.conclusion;
  const explanation = result.explanation;
  const stateMeta = conclusion ? STATE_LABELS[conclusion.state] : undefined;
  const topFindings = (conclusion?.topFindings ?? []) as FindingView[];
  const dominoNodes = result.dominoChain?.nodes ?? [];

  return (
    <div style={wbStyles.page}>
      <Header taskId={result.taskId} />

      {/* 结论概要 */}
      {conclusion && stateMeta && (
        <div style={wbStyles.section}>
          <div style={wbStyles.sectionTitle}>
            <span style={wbStyles.badge(stateMeta.color, stateMeta.bg)}>{stateMeta.label}</span>
            诊断结论
          </div>
          <div style={{ fontSize: 14, color: COLORS.text, lineHeight: 1.6 }}>
            {conclusion.summary}
          </div>
        </div>
      )}

      {/* LLM 归因 — 主位 */}
      {explanation?.llmNarrative && (
        <div style={{ ...wbStyles.section, borderColor: COLORS.primary }}>
          <div style={wbStyles.sectionTitle}>
            <span style={{ fontSize: 16 }}>🤖</span>
            LLM 归因分析
            {explanation.brokenStage && (
              <span style={wbStyles.badge(COLORS.primary, COLORS.surface)}>
                断点: {STAGE_LABELS[explanation.brokenStage] ?? explanation.brokenStage}
              </span>
            )}
            {typeof explanation.llmConfidence === 'number' && (
              <span style={{ fontSize: 11, color: COLORS.muted }}>
                置信度 {Math.round(explanation.llmConfidence * 100)}%
              </span>
            )}
          </div>
          <div style={wbStyles.narrative}>{explanation.llmNarrative}</div>
          {explanation.hypotheses && explanation.hypotheses.length > 0 && (
            <div style={{ marginTop: SPACING.sm }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.textSecondary, marginBottom: 4 }}>
                可能的假设:
              </div>
              {explanation.hypotheses.map((h, i) => (
                <div key={i} style={{ fontSize: 13, color: COLORS.text, padding: '4px 0', lineHeight: 1.5 }}>
                  • {h}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 操作建议 */}
      {explanation?.operatorAdvice && explanation.operatorAdvice.length > 0 && (
        <div style={wbStyles.section}>
          <div style={wbStyles.sectionTitle}>💡 操作建议</div>
          {explanation.operatorAdvice.map((a, i) => (
            <div key={i} style={{ fontSize: 13, color: COLORS.text, padding: '6px 0', lineHeight: 1.6, borderBottom: `1px solid ${COLORS.border}` }}>
              {i + 1}. {a}
            </div>
          ))}
        </div>
      )}

      {/* 命中规则 */}
      {topFindings.length > 0 && (
        <div style={wbStyles.section}>
          <div style={wbStyles.sectionTitle}>📋 命中规则 (Top {topFindings.length})</div>
          {topFindings.map((f, i) => (
            <div key={i} style={wbStyles.listItem}>
              <div style={{ fontWeight: 600, color: COLORS.text }}>
                {f.ruleCode ? `[${f.ruleCode}] ` : ''}{f.title ?? '—'}
              </div>
              {f.summary && (
                <div style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 2 }}>{f.summary}</div>
              )}
              <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>
                score: {f.score ?? '—'} · confidence: {f.confidence ?? '—'} · layer: {f.layer ?? '—'}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 多米诺链 */}
      {dominoNodes.length > 0 && (
        <div style={wbStyles.section}>
          <div style={wbStyles.sectionTitle}>🔗 因果链路</div>
          {dominoNodes.map((n: DominoNode, i) => {
            const ns = NODE_STATUS_STYLE[n.status] ?? NODE_STATUS_STYLE.normal;
            return (
              <div key={n.id ?? i} style={wbStyles.dominoRow(n.status)}>
                <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: ns.color, padding: '2px 8px', borderRadius: 4, background: ns.bg }}>
                  {STAGE_LABELS[n.type] ?? n.type}
                </span>
                <span style={{ fontSize: 13, color: COLORS.text }}>{n.label}</span>
                <span style={{ fontSize: 11, color: COLORS.muted, marginLeft: 'auto' }}>
                  {n.status}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* 证据叙述 */}
      {explanation?.evidenceNarrative && explanation.evidenceNarrative.length > 0 && (
        <div style={wbStyles.section}>
          <div style={wbStyles.sectionTitle}>📝 证据叙述</div>
          {explanation.evidenceNarrative.map((n, i) => (
            <div key={i} style={wbStyles.listItem}>{n}</div>
          ))}
        </div>
      )}

      {/* 症状备注 */}
      {explanation?.symptomNotes && explanation.symptomNotes.length > 0 && (
        <div style={wbStyles.section}>
          <div style={wbStyles.sectionTitle}>⚠️ 症状备注</div>
          {explanation.symptomNotes.map((n, i) => (
            <div key={i} style={wbStyles.listItem}>{n}</div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 11, color: COLORS.muted, textAlign: 'center', padding: '8px 0 24px' }}>
        {explanation?.llmModel && `LLM: ${explanation.llmModel} · `}
        TraceLens Diagnosis · {result.taskId.slice(0, 8)}
      </div>
    </div>
  );
};

const Header: React.FC<{ taskId: string }> = ({ taskId }) => (
  <div style={wbStyles.header}>
    <span style={{ fontSize: 24 }}>🔬</span>
    <span style={wbStyles.title}>TraceLens 诊断结果</span>
    <span style={{ marginLeft: 'auto', fontSize: 11, color: COLORS.muted, fontFamily: 'monospace' }}>
      {taskId.slice(0, 16)}…
    </span>
  </div>
);

export default WorkbenchApp;
