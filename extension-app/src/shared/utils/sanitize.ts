// shared/utils/sanitize.ts

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

export function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
}

const SENSITIVE_KEY_PATTERNS = [
  'token',
  'authorization',
  'password',
  'passwd',
  'mobile',
  'phone',
  'idcard',
  '身份证',
  'cookie',
  'secret',
];

export function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEY_PATTERNS.some((p) => lower.includes(p));
}
