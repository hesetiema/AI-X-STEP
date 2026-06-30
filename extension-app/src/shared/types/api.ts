// api.ts
// 与 traceLens-server 后端交互的 request/response 类型

export interface EvidenceItemDto {
  id: string;
  type: string;
  label: string;
  value: Record<string, unknown>;
  source: string;
  timestamp?: string;
}

export interface CreateDiagnosisDto {
  appId: string;
  pageUrl: string;
  title: string;
  description?: string;
  evidence: EvidenceItemDto[];
  symptoms?: string[];
}

export interface CreateDiagnosisResponse {
  taskId: string;
  status: string;
  createdAt: string;
}

export interface DominoNode {
  id: string;
  label: string;
  type:
    | 'page_load'
    | 'user_action'
    | 'ui_state'
    | 'frontend_app'
    | 'bff'
    | 'api'
    | 'domain'
    | 'db'
    | 'external';
  status: 'normal' | 'degraded' | 'failed';
  evidenceIds: string[];
  children: string[];
}

export interface DiagnosisExplanation {
  summaryText: string;
  evidenceNarrative: string[];
  operatorAdvice: string[];
  symptomNotes: string[];
  llmNarrative?: string;
  brokenStage?: DominoNode['type'];
  hypotheses?: string[];
  llmConfidence?: number;
  llmModel?: string;
}

export interface DiagnosisConclusion {
  topFindings: unknown[];
  supportingFindings: unknown[];
  symptomFindings: unknown[];
  summary: string;
  state: 'root_cause_identified' | 'partial_root_cause' | 'insufficient_evidence';
  hints: string[];
}

export interface DiagnosisResult {
  taskId: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  conclusion?: DiagnosisConclusion;
  dominoChain?: { nodes: DominoNode[] };
  explanation?: DiagnosisExplanation;
}
