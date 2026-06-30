export interface CreateDiagnosisInput {
  appId: string;
  pageUrl: string;
  title: string;
  description?: string;
  evidence: EvidenceItem[];
  symptoms?: string[];
}

export interface EvidenceItem {
  id: string;
  type: string;
  label: string;
  value: Record<string, unknown>;
  source: string;
  timestamp?: string;
}

export interface DiagnosisContext {
  taskId: string;
  appId: string;
  pageUrl: string;
  title: string;
  description?: string;
  evidence: EvidenceItem[];
  symptoms: string[];
  createdAt: Date;
}

export interface RuleFinding {
  ruleCode: string;
  title: string;
  summary: string;
  confidence: number;
  score: number;
  layer: string;
  cluster: string;
  evidenceIds: string[];
  isSymptomOnly: boolean;
  detail: Record<string, unknown>;
  rule?: RuleMeta;
}

export interface RankedFinding extends RuleFinding {
  rank: number;
}

export interface RuleMeta {
  code: string;
  name: string;
  cluster: string;
  layer: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  isSymptomOnly: boolean;
}

export interface DiagnosisTask {
  id: string;
  status: DiagnosisTaskStage;
  request: CreateDiagnosisInput;
  context?: DiagnosisContext;
  findings?: RuleFinding[];
  rankedFindings?: RankedFinding[];
  conclusion?: DiagnosisConclusion;
  dominoChain?: DominoChain;
  explanation?: DiagnosisExplanation;
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface DiagnosisConclusion {
  topFindings: RankedFinding[];
  supportingFindings: RankedFinding[];
  symptomFindings: RankedFinding[];
  summary: string;
  state: ConclusionState;
  hints: string[];
}

export type ConclusionState = 'root_cause_identified' | 'partial_root_cause' | 'insufficient_evidence';

export interface DominoChain {
  nodes: DominoNode[];
}

export interface DominoNode {
  id: string;
  label: string;
  type: DominoNodeType;
  status: 'normal' | 'degraded' | 'failed';
  evidenceIds: string[];
  children: string[];
}

export type DominoNodeType = 'page_load' | 'user_action' | 'ui_state' | 'frontend_app' | 'bff' | 'api' | 'domain' | 'db' | 'external';

export interface DiagnosisExplanation {
  summaryText: string;
  evidenceNarrative: string[];
  operatorAdvice: string[];
  symptomNotes: string[];
  llmNarrative?: string;
  brokenStage?: DominoNodeType;
  hypotheses?: string[];
  llmConfidence?: number;
  llmModel?: string;
}

export interface LlmDiagnosisResult {
  narrative: string;
  brokenStage: DominoNodeType;
  hypotheses: string[];
  confidence: number;
  advice: string[];
  model: string;
}

export interface CreateDiagnosisRequest {
  appId: string;
  pageUrl: string;
  title: string;
  description?: string;
  evidence: EvidenceItem[];
  symptoms?: string[];
}

export interface CreateDiagnosisResponse {
  taskId: string;
  status: string;
  createdAt: Date;
}

export interface DiagnosisResult {
  taskId: string;
  status: string;
  createdAt: Date;
  completedAt?: Date;
  conclusion?: DiagnosisConclusion;
  dominoChain?: DominoChain;
  explanation?: DiagnosisExplanation;
}

export enum DiagnosisTaskStage {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum EvidenceType {
  NETWORK_ERROR = 'network_error',
  UI_EVENT = 'ui_event',
  UI_STATE = 'ui_state',
  LOG = 'log',
  TRACE_SPAN = 'trace_span',
  METRIC = 'metric',
  PERFORMANCE = 'performance_event',
}
