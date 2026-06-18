// sidepanel/styles.ts

export const COLORS = {
  primary: '#4f46e5',
  success: '#16a34a',
  successBg: '#f0fdf4',
  danger: '#dc2626',
  dangerBg: '#fef2f2',
  warning: '#d97706',
  warningBg: '#fffbeb',
  muted: '#6b7280',
  bg: '#ffffff',
  surface: '#f9fafb',
  border: '#e5e7eb',
  text: '#111827',
  textSecondary: '#6b7280',
} as const;

export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 } as const;

export const panelStyles = {
  container: {
    width: 360,
    minHeight: '100vh',
    background: COLORS.bg,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  } as React.CSSProperties,

  header: {
    padding: `${SPACING.lg}px`,
    borderBottom: `1px solid ${COLORS.border}`,
    display: 'flex',
    alignItems: 'center',
    gap: SPACING.sm,
  } as React.CSSProperties,

  body: {
    padding: SPACING.lg,
    display: 'flex',
    flexDirection: 'column',
    gap: SPACING.lg,
  } as React.CSSProperties,

  card: {
    padding: SPACING.md,
    borderRadius: 8,
    border: `1px solid ${COLORS.border}`,
    background: COLORS.surface,
  } as React.CSSProperties,
};
