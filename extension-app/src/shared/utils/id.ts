// shared/utils/id.ts

let counter = 0;

export function generateId(prefix = ''): string {
  counter += 1;
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}${ts}-${rand}-${counter}`;
}

export function generateSessionId(): string {
  return generateId('sess_');
}

export function generateEventId(): string {
  return generateId('evt_');
}

export function generateRequestId(): string {
  return generateId('req_');
}
