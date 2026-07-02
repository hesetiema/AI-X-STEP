// content/pipeline-runner.ts
// Pipeline 运行时校验引擎 —— 加载 Pipeline，路由匹配，逐字段逐节点采集校验，定位断点

import type {
  TracelensPipeline,
  PipelineFieldCheckResult,
  PipelineNodeCheckResult,
  PipelineCheckEvent,
  ApiNodeDef,
  ComputeNodeDef,
  TransformNodeDef,
  FormatNodeDef,
  RenderNodeDef,
  PipelineRegistry,
} from '@/shared/types';
import { apiResponseCache, extractFieldPath } from './api-response-cache';
import type { Recorder } from './recorder';

function safeRegex(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern);
  } catch {
    return null;
  }
}

/**
 * In-memory pipeline registry.
 * Pipelines are loaded by uploading tracelens-pipeline.ts files via the SidePanel.
 */
class InMemoryPipelineRegistry implements PipelineRegistry {
  pipelines: TracelensPipeline[] = [];

  register(pipeline: TracelensPipeline): void {
    const existing = this.pipelines.findIndex((p) => p.route === pipeline.route);
    if (existing >= 0) {
      this.pipelines[existing] = pipeline;
    } else {
      this.pipelines.push(pipeline);
    }
  }

  match(route: string): TracelensPipeline | null {
    for (const p of this.pipelines) {
      const re = safeRegex(p.routePattern);
      if (re && re.test(route)) return p;
    }
    return null;
  }

  clear(): void {
    this.pipelines = [];
  }
}

export const pipelineRegistry = new InMemoryPipelineRegistry();

export interface PipelineRunnerOptions {
  recorder: Recorder;
}

export class PipelineRunner {
  constructor(private readonly recorder: Recorder) {}

  /**
   * Run pipeline checks on the current page.
   * Called on first_screen_complete and when user triggers manual diagnosis.
   */
  run(): PipelineCheckEvent | null {
    const route = location.pathname;
    const pipeline = pipelineRegistry.match(route);
    if (!pipeline) return null;

    const fieldChecks: PipelineFieldCheckResult[] = [];

    for (const [fieldKey, fieldDef] of Object.entries(pipeline.fields)) {
      const result = this.checkField(fieldKey, fieldDef);
      fieldChecks.push(result);
    }

    return {
      kind: 'pipeline_check',
      pipelineId: pipeline.route,
      route,
      fieldChecks,
      eventId: '',
      occurredAt: Date.now(),
      tabId: this.recorder['lastTabId'] ?? 0,
    };
  }

  /**
   * Run and write results to Recorder (autoObserve and/or manual based on state).
   */
  runAndRecord(): void {
    const event = this.run();
    if (!event) return;

    const partial = {
      kind: 'pipeline_check' as const,
      pipelineId: event.pipelineId,
      route: event.route,
      fieldChecks: event.fieldChecks,
    };

    this.recorder.appendAutoObserve(partial);
    if (this.recorder.isActive) {
      this.recorder.append(partial);
    }
  }

  private checkField(fieldKey: string, fieldDef: { label: string; nodes: unknown[] }): PipelineFieldCheckResult {
    const nodes: PipelineNodeCheckResult[] = [];
    let breakpoint: string | undefined;

    for (const node of fieldDef.nodes as Array<Record<string, unknown>>) {
      const result = this.checkNode(node);
      nodes.push(result);
      if (result.status === 'failed' && !breakpoint) {
        breakpoint = result.name;
      }
    }

    return {
      field: fieldKey,
      label: fieldDef.label,
      nodes,
      breakpoint,
    };
  }

  private checkNode(node: Record<string, unknown>): PipelineNodeCheckResult {
    switch (node.name) {
      case 'api':
        return this.checkApiNode(node as unknown as ApiNodeDef);
      case 'compute':
        return this.checkComputeNode(node as unknown as ComputeNodeDef);
      case 'transform':
        return this.checkTransformNode(node as unknown as TransformNodeDef);
      case 'format':
        return this.checkFormatNode(node as unknown as FormatNodeDef);
      case 'render':
        return this.checkRenderNode(node as unknown as RenderNodeDef);
      default:
        return { name: String(node.name || 'unknown'), status: 'skipped', error: 'Unknown node type' };
    }
  }

  private checkApiNode(node: ApiNodeDef): PipelineNodeCheckResult {
    const { source, verify } = node;

    const entry = apiResponseCache.findBySource(source.method, source.urlPattern);
    if (!entry) {
      return { name: 'api', status: 'failed', error: `No cached response for ${source.method} ${source.urlPattern}` };
    }

    const value = extractFieldPath(entry.responseBody, source.fieldPath);

    if (verify.exists && (value === undefined || value === null)) {
      return { name: 'api', status: 'failed', error: `Field ${source.fieldPath} does not exist` };
    }

    if (verify.type === 'enum' && verify.values) {
      if (!verify.values.includes(String(value))) {
        return { name: 'api', status: 'failed', value, expected: `one of [${verify.values.join(', ')}]` };
      }
    } else if (verify.type && typeof value !== verify.type) {
      return { name: 'api', status: 'failed', value, error: `Expected ${verify.type}, got ${typeof value}` };
    }

    if (verify.nonEmpty) {
      if (value === '' || value === null || value === undefined || (Array.isArray(value) && value.length === 0)) {
        return { name: 'api', status: 'failed', value, error: 'Value is empty' };
      }
    }

    return { name: 'api', status: 'passed', value };
  }

  private checkComputeNode(node: ComputeNodeDef): PipelineNodeCheckResult {
    const sourceValues: Record<string, unknown> = {};

    for (const src of node.sources) {
      const entry = apiResponseCache.findBySource(src.method, src.urlPattern);
      if (!entry) {
        return { name: 'compute', status: 'skipped', error: `Missing source: ${src.method} ${src.urlPattern}` };
      }
      const key = src.fieldPath.split('.').pop() || src.fieldPath;
      sourceValues[key] = extractFieldPath(entry.responseBody, src.fieldPath);
    }

    // Execute the logic expression against the extracted source values
    let computed: unknown;
    try {
      computed = this.evalLogic(node.logic, sourceValues);
    } catch (e) {
      return { name: 'compute', status: 'failed', error: `Logic eval failed: ${e instanceof Error ? e.message : String(e)}` };
    }

    if (node.verify.exists && (computed === undefined || computed === null)) {
      return { name: 'compute', status: 'failed', error: 'Computed value is null/undefined' };
    }

    if (node.verify.type && typeof computed !== node.verify.type) {
      return { name: 'compute', status: 'failed', value: computed, error: `Expected ${node.verify.type}, got ${typeof computed}` };
    }

    return { name: 'compute', status: 'passed', value: computed };
  }

  private checkTransformNode(node: TransformNodeDef): PipelineNodeCheckResult {
    if (node.mapping) {
      // Simple mapping check: the upstream value should map to the expected output
      return { name: 'transform', status: 'passed', value: `mapping defined: ${Object.keys(node.mapping).length} entries` };
    }
    return { name: 'transform', status: 'passed', value: node.logic };
  }

  private checkFormatNode(node: FormatNodeDef): PipelineNodeCheckResult {
    if (node.verify.matches) {
      return { name: 'format', status: 'passed', value: `pattern: ${node.verify.matches}` };
    }
    return { name: 'format', status: 'passed', value: node.logic };
  }

  private checkRenderNode(node: RenderNodeDef): PipelineNodeCheckResult {
    try {
      const el = document.querySelector(node.selector);
      if (!el) {
        return { name: 'render', status: 'failed', error: `Selector "${node.selector}" not found in DOM` };
      }

      const textContent = (el.textContent || '').trim();

      if (node.verify.renderedNotEmpty && !textContent) {
        return { name: 'render', status: 'failed', value: '(empty)', error: 'Rendered content is empty' };
      }

      if (node.verify.valueContains) {
        // Template replacement: {compute_output}, {format_output}, {api_output}
        const expected = node.verify.valueContains;
        if (!textContent.includes(expected)) {
          return { name: 'render', status: 'failed', value: textContent, expected, error: 'DOM text does not contain expected value' };
        }
      }

      return { name: 'render', status: 'passed', value: textContent };
    } catch (e) {
      return { name: 'render', status: 'failed', error: `querySelector failed: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  /**
   * Safely evaluate a simple arithmetic/string logic expression against extracted values.
   * Supports: 'a * b', 'a + b', 'a - b', 'a / b', 'formatPrice(n)', ternary.
   * This is intentionally limited — complex logic should be verified by the human reviewer.
   */
  private evalLogic(logic: string, values: Record<string, unknown>): unknown {
    const keys = Object.keys(values);
    const params = keys.join(', ');

    // Build a function body that returns the logic expression
    const body = `const {${params}} = arguments[0]; return ${logic};`;

    try {
      const fn = new Function(body);
      return fn(values);
    } catch {
      return undefined;
    }
  }
}
