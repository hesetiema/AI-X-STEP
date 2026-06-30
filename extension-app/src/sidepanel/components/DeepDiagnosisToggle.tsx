// sidepanel/components/DeepDiagnosisToggle.tsx
// 深度诊断开关 —— 独立组件，紧凑展示

import React from 'react';
import { COLORS, SPACING } from '../styles';
import { useSidePanelStore } from '../store';
import { useSidePanelActions } from '../store/use-sidepanel-actions';

const DeepDiagnosisToggle: React.FC = () => {
  const deepDiagnosis = useSidePanelStore((s) => s.deepDiagnosis);
  const { toggleDeepDiagnosis } = useSidePanelActions();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `${SPACING.sm}px ${SPACING.md}px`,
        borderRadius: 6,
        border: `1px solid ${deepDiagnosis ? '#4f46e5' : COLORS.border}`,
        background: deepDiagnosis ? '#eef2ff' : COLORS.surface,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
        <span style={{ fontSize: 14 }}>🔬</span>
        <span style={{ fontSize: 12, fontWeight: 500, color: COLORS.text }}>
          深度诊断
        </span>
      </div>
      <button
        onClick={toggleDeepDiagnosis}
        style={{
          width: 36,
          height: 20,
          borderRadius: 10,
          border: 'none',
          background: deepDiagnosis ? '#4f46e5' : COLORS.border,
          cursor: 'pointer',
          position: 'relative',
          transition: 'background 0.15s',
        }}
        aria-label={deepDiagnosis ? '关闭深度诊断' : '开启深度诊断'}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: deepDiagnosis ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            transition: 'left 0.15s',
          }}
        />
      </button>
    </div>
  );
};

export default DeepDiagnosisToggle;
