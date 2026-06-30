import { COLORS, SPACING } from '../sidepanel/styles';

export { COLORS, SPACING };

export const STAGE_LABELS: Record<string, string> = {
  page_load: '页面加载',
  user_action: '用户操作',
  ui_state: 'UI 状态',
  frontend_app: '前端应用',
  bff: 'BFF 网关',
  api: 'API 服务',
  domain: '领域服务',
  db: '数据库',
  external: '外部依赖',
};

export const STATE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  root_cause_identified: { label: '已定位根因', color: COLORS.success, bg: COLORS.successBg },
  partial_root_cause: { label: '部分定位', color: COLORS.warning, bg: COLORS.warningBg },
  insufficient_evidence: { label: '证据不足', color: COLORS.muted, bg: COLORS.surface },
};

export const NODE_STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  normal: { color: COLORS.success, bg: COLORS.successBg },
  degraded: { color: COLORS.warning, bg: COLORS.warningBg },
  failed: { color: COLORS.danger, bg: COLORS.dangerBg },
};

export const wbStyles = {
  page: {
    maxWidth: 860,
    margin: '0 auto',
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  } as React.CSSProperties,

  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '16px 0',
    borderBottom: `2px solid ${COLORS.primary}`,
  } as React.CSSProperties,

  title: {
    fontSize: 20,
    fontWeight: 700,
    color: COLORS.text,
  } as React.CSSProperties,

  section: {
    background: COLORS.bg,
    borderRadius: 10,
    border: `1px solid ${COLORS.border}`,
    padding: 16,
  } as React.CSSProperties,

  sectionTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: COLORS.text,
    marginBottom: 12,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  } as React.CSSProperties,

  badge: (color: string, bg: string) => ({
    display: 'inline-block',
    fontSize: 12,
    fontWeight: 600,
    color,
    background: bg,
    padding: '3px 10px',
    borderRadius: 12,
  }) as React.CSSProperties,

  narrative: {
    fontSize: 14,
    lineHeight: 1.7,
    color: COLORS.text,
    background: COLORS.surface,
    padding: 14,
    borderRadius: 8,
    border: `1px solid ${COLORS.border}`,
  } as React.CSSProperties,

  listItem: {
    fontSize: 13,
    color: COLORS.text,
    padding: '6px 0',
    borderBottom: `1px solid ${COLORS.border}`,
    lineHeight: 1.6,
  } as React.CSSProperties,

  muted: {
    fontSize: 12,
    color: COLORS.muted,
  } as React.CSSProperties,

  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    gap: 16,
  } as React.CSSProperties,

  spinner: {
    width: 36,
    height: 36,
    border: `3px solid ${COLORS.border}`,
    borderTopColor: COLORS.primary,
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  } as React.CSSProperties,

  dominoRow: (status: string) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 12px',
    borderRadius: 6,
    background: NODE_STATUS_STYLE[status]?.bg ?? COLORS.surface,
    fontSize: 13,
    marginBottom: 4,
  }) as React.CSSProperties,
};
