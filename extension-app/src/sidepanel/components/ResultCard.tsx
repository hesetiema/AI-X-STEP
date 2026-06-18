// sidepanel/components/ResultCard.tsx
// 提交结果展示 —— 成功显示 taskId + 打开工作台，失败显示错误

import React from 'react';
import { COLORS, SPACING, panelStyles } from '../styles';
import { useSidePanelStore } from '../store';

const ResultCard: React.FC = () => {
  const uploadResult = useSidePanelStore((s) => s.uploadResult);
  const status = useSidePanelStore((s) => s.status);

  if (!uploadResult || (status !== 'uploaded' && status !== 'failed')) return null;

  const isSuccess = uploadResult.success;

  return (
    <div
      style={{
        ...panelStyles.card,
        background: isSuccess ? COLORS.successBg : COLORS.dangerBg,
        borderColor: isSuccess ? COLORS.success : COLORS.danger,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: isSuccess ? COLORS.success : COLORS.danger }}>
        {isSuccess ? '✓ 诊断提交成功' : '✕ 提交失败'}
      </div>
      {isSuccess && uploadResult.taskId && (
        <>
          <div style={{ marginTop: SPACING.sm, fontSize: 12, color: COLORS.textSecondary }}>
            Task ID:{' '}
            <code style={{ fontSize: 11, background: '#f1f5f9', padding: '1px 4px', borderRadius: 3 }}>
              {uploadResult.taskId.slice(0, 16)}...
            </code>
          </div>
          <a
            href={`http://localhost:4220/?taskId=${encodeURIComponent(uploadResult.taskId)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              marginTop: SPACING.md,
              fontSize: 13,
              fontWeight: 600,
              color: COLORS.primary,
              textDecoration: 'none',
            }}
          >
            打开工作台 →
          </a>
        </>
      )}
      {!isSuccess && uploadResult.error && (
        <div style={{ marginTop: SPACING.sm, fontSize: 12, color: COLORS.danger }}>
          {uploadResult.error}
        </div>
      )}
    </div>
  );
};

export default ResultCard;
