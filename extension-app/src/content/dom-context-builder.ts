// content/dom-context-builder.ts
// 从点击的元素提取结构化 DOM 上下文，供 LLM 理解业务语义
// 不序列化整个 DOM（区别于 page-agent），只提取点击位置周边关键信息

import type {
  DomContext,
  DomElementInfo,
  DomParentNode,
  SiblingLabel,
  FormFieldInfo,
  FormContext,
  ContainerContext,
} from '@/shared/types/dom-context';

const SEMANTIC_CONTAINERS = new Set([
  'section', 'article', 'aside', 'nav', 'main', 'fieldset', 'form',
]);

const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

const MAX_PARENT_DEPTH = 3;
const MAX_SIBLING_LABELS = 5;
const MAX_FORM_FIELDS = 10;
const MAX_TEXT_LEN = 80;

export function buildDomContext(target: EventTarget | null): DomContext | undefined {
  if (!(target instanceof Element)) return undefined;

  const element = extractElementInfo(target);
  const parentChain = extractParentChain(target);
  const siblingLabels = extractSiblingLabels(target);
  const formContext = extractFormContext(target);
  const containerContext = extractContainerContext(target);

  return {
    element,
    parentChain,
    siblingLabels,
    formContext,
    containerContext,
  };
}

function extractElementInfo(el: Element): DomElementInfo {
  const tag = el.tagName.toLowerCase();
  const text = trunc(el.textContent?.trim() || undefined, MAX_TEXT_LEN);
  const ariaLabel = el.getAttribute('aria-label') || undefined;
  const role = el.getAttribute('role') || undefined;
  const dataTestid = el.getAttribute('data-testid') || undefined;

  const info: DomElementInfo = { tag, text, ariaLabel, role, dataTestid };

  if (el.id) info.id = el.id;
  if (el.className && typeof el.className === 'string') {
    const cn = el.className.trim();
    if (cn) info.className = trunc(cn, MAX_TEXT_LEN);
  }

  if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
    info.type = el.getAttribute('type') || undefined;
    info.name = el.getAttribute('name') || el.getAttribute('id') || undefined;
    info.placeholder = el.getAttribute('placeholder') || undefined;
  }

  if (el instanceof HTMLButtonElement) {
    info.name = el.name || el.getAttribute('id') || undefined;
    info.type = el.type || 'button';
  }

  return info;
}

function extractParentChain(el: Element): DomParentNode[] {
  const chain: DomParentNode[] = [];
  let current: Element | null = el.parentElement;
  let depth = 0;

  while (current && depth < MAX_PARENT_DEPTH) {
    const node: DomParentNode = {
      tag: current.tagName.toLowerCase(),
    };
    if (current.id) node.id = current.id;
    if (current.className && typeof current.className === 'string') {
      const cn = current.className.trim().split(/\s+/).slice(0, 2).join('.');
      if (cn) node.className = cn;
    }
    const text = current.textContent?.trim();
    if (text) node.textSummary = trunc(text, MAX_TEXT_LEN);
    chain.push(node);
    current = current.parentElement;
    depth += 1;
  }
  return chain;
}

function extractSiblingLabels(el: Element): SiblingLabel[] {
  const parent = el.parentElement;
  if (!parent) return [];

  const labels: SiblingLabel[] = [];
  const children = parent.children;

  for (let i = 0; i < children.length && labels.length < MAX_SIBLING_LABELS; i++) {
    const child = children[i];
    if (child === el) continue;

    if (child.tagName === 'LABEL') {
      labels.push({
        tag: 'label',
        text: trunc(child.textContent?.trim() || undefined, MAX_TEXT_LEN),
        htmlFor: child.getAttribute('for') || undefined,
      });
    }
  }

  return labels;
}

function extractFormContext(el: Element): FormContext | undefined {
  const form = el.closest('form');
  if (!form) return undefined;

  const fields: FormFieldInfo[] = [];
  const inputs = form.querySelectorAll('input, select, textarea');

  for (let i = 0; i < inputs.length && fields.length < MAX_FORM_FIELDS; i++) {
    const input = inputs[i];
    if (!(input instanceof HTMLElement)) continue;

    const name = input.getAttribute('name') || input.getAttribute('id') || undefined;
    const type = input.getAttribute('type') || input.tagName.toLowerCase();
    const placeholder = input.getAttribute('placeholder') || undefined;

    // 值摘要：只记录类型+长度，绝不记录实际值
    let valueSummary: string | undefined;
    if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
      const v = input.value;
      if (v) {
        valueSummary = typeof v === 'string' ? `string(${v.length})` : `value(${typeof v})`;
      }
    } else if (input instanceof HTMLSelectElement) {
      valueSummary = input.selectedOptions.length > 0
        ? `selected(${input.selectedOptions.length})`
        : 'none';
    }

    let fieldLabel: string | undefined;
    // 查找关联 label
    if (input.id) {
      const labels = form.querySelectorAll(`label[for="${CSS.escape(input.id)}"]`);
      if (labels.length > 0) {
        fieldLabel = trunc(labels[0].textContent?.trim() || undefined, MAX_TEXT_LEN);
      }
    }

    fields.push({ name, type, valueSummary, placeholder, label: fieldLabel });
  }

  return {
    fields,
    action: form.getAttribute('action') || undefined,
    method: form.getAttribute('method') || undefined,
  };
}

function extractContainerContext(el: Element): ContainerContext | undefined {
  let current: Element | null = el.parentElement;
  let depth = 0;

  while (current && depth < 6) {
    const tag = current.tagName.toLowerCase();

    if (SEMANTIC_CONTAINERS.has(tag)) {
      const ctx: ContainerContext = { tag };

      // 找最近的 heading
      const heading = findNearestHeading(current);
      if (heading) ctx.heading = heading;

      const ariaLabel = current.getAttribute('aria-label');
      if (ariaLabel) ctx.ariaLabel = ariaLabel;

      const dataTestid = current.getAttribute('data-testid');
      if (dataTestid) ctx.dataTestid = dataTestid;

      return ctx;
    }

    current = current.parentElement;
    depth += 1;
  }

  return undefined;
}

function findNearestHeading(container: Element): string | undefined {
  // 在 container 内查找第一个 heading
  for (const tag of HEADING_TAGS) {
    const h = container.querySelector(tag);
    if (h?.textContent?.trim()) {
      return trunc(h.textContent.trim(), MAX_TEXT_LEN);
    }
  }
  // 如果没找到，往上查找
  let prev = container.previousElementSibling;
  while (prev) {
    if (HEADING_TAGS.has(prev.tagName.toLowerCase())) {
      const text = prev.textContent?.trim();
      if (text) return trunc(text, MAX_TEXT_LEN);
    }
    prev = prev.previousElementSibling;
  }
  return undefined;
}

export function domContextToText(ctx: DomContext): string {
  const parts: string[] = [];

  const { element, parentChain, formContext, containerContext } = ctx;

  parts.push(`element: <${element.tag}>`);
  if (element.text) parts.push(`  text: "${element.text}"`);
  if (element.id) parts.push(`  id: ${element.id}`);
  if (element.className) parts.push(`  class: ${element.className}`);
  if (element.ariaLabel) parts.push(`  aria-label: "${element.ariaLabel}"`);
  if (element.role) parts.push(`  role: ${element.role}`);
  if (element.name) parts.push(`  name: ${element.name}`);
  if (element.type) parts.push(`  type: ${element.type}`);
  if (element.placeholder) parts.push(`  placeholder: "${element.placeholder}"`);

  if (parentChain.length > 0) {
    parts.push(`parent chain:`);
    for (const p of parentChain) {
      const extras: string[] = [];
      if (p.id) extras.push(`#${p.id}`);
      if (p.className) extras.push(`.${p.className}`);
      if (p.textSummary) extras.push(`"${p.textSummary}"`);
      parts.push(`  <${p.tag}>${extras.length > 0 ? ' ' + extras.join(' ') : ''}`);
    }
  }

  if (containerContext) {
    const cc = containerContext;
    parts.push(`container: <${cc.tag}>`);
    if (cc.heading) parts.push(`  heading: "${cc.heading}"`);
    if (cc.ariaLabel) parts.push(`  aria-label: "${cc.ariaLabel}"`);
    if (cc.dataTestid) parts.push(`  data-testid: ${cc.dataTestid}`);
  }

  if (formContext) {
    parts.push(`form context:`);
    if (formContext.action) parts.push(`  action: ${formContext.action}`);
    if (formContext.method) parts.push(`  method: ${formContext.method}`);
    if (formContext.fields.length > 0) {
      parts.push(`  fields (${formContext.fields.length}):`);
      for (const f of formContext.fields) {
        const fieldParts: string[] = [];
        if (f.name) fieldParts.push(`name=${f.name}`);
        if (f.type) fieldParts.push(`type=${f.type}`);
        if (f.label) fieldParts.push(`label="${f.label}"`);
        if (f.valueSummary) fieldParts.push(`value=${f.valueSummary}`);
        if (f.placeholder) fieldParts.push(`placeholder="${f.placeholder}"`);
        parts.push(`    ${fieldParts.join(', ')}`);
      }
    }
  }

  return parts.join('\n');
}

function trunc(s: string | undefined, max: number): string | undefined {
  if (!s) return undefined;
  return s.length > max ? s.slice(0, max) + '...' : s;
}
