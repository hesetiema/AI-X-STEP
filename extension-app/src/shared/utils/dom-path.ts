// shared/utils/dom-path.ts

/**
 * 生成目标元素的精简 DOM 路径摘要，如 "div.container > form > button#submit"
 */
export function buildDomPath(el: EventTarget | null, maxDepth = 5): string | undefined {
  if (!(el instanceof Element)) return undefined;

  const parts: string[] = [];
  let current: Element | null = el;
  let depth = 0;

  while (current && depth < maxDepth) {
    let part = current.tagName.toLowerCase();
    if (current.id) {
      part += `#${current.id}`;
    } else if (current.className && typeof current.className === 'string') {
      const cls = current.className.trim().split(/\s+/).slice(0, 2).join('.');
      if (cls) part += `.${cls}`;
    }
    parts.unshift(part);
    current = current.parentElement;
    depth += 1;
  }

  return parts.join(' > ');
}

export function describeTarget(el: EventTarget | null): {
  targetId?: string;
  targetName?: string;
  textSummary?: string;
} {
  if (!(el instanceof Element)) return {};
  const targetId = el.id || undefined;
  const text = (el.textContent || '').trim();
  return {
    targetId,
    targetName: targetId || el.getAttribute('aria-label') || el.getAttribute('data-name') || undefined,
    textSummary: text ? text.slice(0, 50) : undefined,
  };
}
