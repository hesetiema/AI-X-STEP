// sidepanel/components/UserHintForm.tsx
// 用户问题描述 / 预期 / 实际

import React from 'react';
import { COLORS, SPACING, panelStyles } from '../styles';
import { useSidePanelStore } from '../store';

const UserHintForm: React.FC = () => {
  const userHint = useSidePanelStore((s) => s.userHint);
  const setUserHint = useSidePanelStore((s) => s.setUserHint);

  return (
    <div style={panelStyles.card}>
      <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: SPACING.sm }}>
        问题描述
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.sm }}>
        <textarea
          placeholder="简要描述你看到的问题..."
          value={userHint.summary}
          onChange={(e) => setUserHint({ summary: e.target.value })}
          rows={2}
          style={{
            fontSize: 12,
            padding: SPACING.sm,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 6,
            resize: 'vertical',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
        <input
          placeholder="预期结果"
          value={userHint.expected}
          onChange={(e) => setUserHint({ expected: e.target.value })}
          style={{
            fontSize: 12,
            padding: `${SPACING.sm}px`,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 6,
            outline: 'none',
          }}
        />
        <input
          placeholder="实际结果"
          value={userHint.actual}
          onChange={(e) => setUserHint({ actual: e.target.value })}
          style={{
            fontSize: 12,
            padding: `${SPACING.sm}px`,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 6,
            outline: 'none',
          }}
        />
      </div>
    </div>
  );
};

export default UserHintForm;
