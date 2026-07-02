// shared/types/pipeline.ts
// Trace Lens Pipeline —— AI 生成的字段级数据流声明，运行时逐节点校验定位断点

// ─── Pipeline 定义（AI 生成，人 Review） ───

export interface ApiNodeSource {
  method: string;
  urlPattern: string;
  fieldPath: string; // dot notation: 'response.data.order.price'
}

export interface ApiNodeDef {
  name: 'api';
  source: ApiNodeSource;
  verify: {
    exists?: boolean;
    type?: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'enum';
    values?: string[];
    nonEmpty?: boolean;
  };
}

export interface ComputeNodeDef {
  name: 'compute';
  logic: string;
  sources: ApiNodeSource[];
  verify: {
    exists?: boolean;
    type?: 'string' | 'number' | 'boolean';
    nonEmpty?: boolean;
  };
}

export interface TransformNodeDef {
  name: 'transform';
  logic: string;
  mapping?: Record<string, string>;
  verify: {
    exists?: boolean;
    matchesMapping?: boolean;
  };
}

export interface FormatNodeDef {
  name: 'format';
  logic: string;
  inputType?: string;
  outputType?: string;
  verify: {
    exists?: boolean;
    matches?: string; // regex pattern
  };
}

export interface RenderNodeDef {
  name: 'render';
  selector: string;
  verify: {
    renderedNotEmpty?: boolean;
    valueContains?: string; // '{compute_output}' / '{format_output}' template
  };
}

export type PipelineNodeDef =
  | ApiNodeDef
  | ComputeNodeDef
  | TransformNodeDef
  | FormatNodeDef
  | RenderNodeDef;

export interface FieldDef {
  label: string;
  nodes: PipelineNodeDef[];
}

export interface TracelensPipeline {
  route: string;
  routePattern: string; // regex as string, e.g. "^/order/\\d+$"
  generatedFrom: string[];
  fields: Record<string, FieldDef>;
}

// ─── Pipeline 注册表（线上加载） ───

export interface PipelineRegistry {
  pipelines: TracelensPipeline[];
  register(pipeline: TracelensPipeline): void;
  match(route: string): TracelensPipeline | null;
}

// ─── definePipeline helper（AI 生成代码使用） ───

export function definePipeline(pipeline: TracelensPipeline): TracelensPipeline {
  return pipeline;
}
