import { Injectable } from '@nestjs/common';
import { v4 as randomUUID } from 'uuid';
import { DiagnosisContext, CreateDiagnosisInput } from '../interfaces/diagnosis.types';

@Injectable()
export class ContextBuilderService {
  build(request: CreateDiagnosisInput): DiagnosisContext {
    return {
      taskId: randomUUID(),
      appId: request.appId,
      pageUrl: request.pageUrl,
      title: request.title,
      description: request.description,
      evidence: request.evidence.map((e) => ({ id: e.id, type: e.type, label: e.label, value: e.value ?? {}, source: e.source, timestamp: e.timestamp })),
      symptoms: request.symptoms ?? [],
      createdAt: new Date(),
    };
  }
}
