// shared/api/diagnosis-client.ts
// 与 traceLens-server 后端交互

import type {
  CreateDiagnosisDto,
  CreateDiagnosisResponse,
  DiagnosisResult,
} from '@/shared/types';
import { BACKEND_ENDPOINT, BACKEND_BASE } from '@/shared/constants';

export async function createDiagnosis(
  dto: CreateDiagnosisDto,
): Promise<CreateDiagnosisResponse> {
  const response = await fetch(BACKEND_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
  if (!response.ok) {
    throw new Error(`createDiagnosis failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as CreateDiagnosisResponse;
}

export async function getDiagnosis(taskId: string): Promise<DiagnosisResult> {
  const response = await fetch(`${BACKEND_ENDPOINT}/${taskId}`);
  if (!response.ok) {
    throw new Error(`getDiagnosis failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as DiagnosisResult;
}

export function buildWorkbenchUrl(taskId: string): string {
  return `${BACKEND_BASE}/?taskId=${encodeURIComponent(taskId)}`;
}
