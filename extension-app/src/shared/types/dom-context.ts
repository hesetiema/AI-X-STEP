// shared/types/dom-context.ts
// DOM上下文 —— 点击元素周边的结构化语义信息

export interface DomElementInfo {
  tag: string;
  text?: string;
  id?: string;
  className?: string;
  ariaLabel?: string;
  type?: string;
  name?: string;
  placeholder?: string;
  role?: string;
  dataTestid?: string;
}

export interface DomParentNode {
  tag: string;
  id?: string;
  className?: string;
  textSummary?: string;
}

export interface SiblingLabel {
  tag: string;
  text?: string;
  htmlFor?: string;
}

export interface FormFieldInfo {
  name?: string;
  type?: string;
  valueSummary?: string;
  placeholder?: string;
  label?: string;
}

export interface FormContext {
  fields: FormFieldInfo[];
  action?: string;
  method?: string;
}

export interface ContainerContext {
  tag: string;
  heading?: string;
  ariaLabel?: string;
  dataTestid?: string;
}

export interface DomContext {
  element: DomElementInfo;
  parentChain: DomParentNode[];
  siblingLabels: SiblingLabel[];
  formContext?: FormContext;
  containerContext?: ContainerContext;
}
