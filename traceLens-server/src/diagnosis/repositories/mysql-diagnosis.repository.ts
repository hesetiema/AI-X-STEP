import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DiagnosisRepository } from '../interfaces/diagnosis-repository.interface';
import {
  DiagnosisTask,
  DiagnosisTaskStage,
  CreateDiagnosisInput,
  EvidenceItem,
} from '../interfaces/diagnosis.types';
import { DiagnosisTaskEntity } from '../entities/diagnosis-task.entity';

@Injectable()
export class MysqlDiagnosisRepository implements DiagnosisRepository {
  constructor(
    @InjectRepository(DiagnosisTaskEntity)
    private readonly repo: Repository<DiagnosisTaskEntity>,
  ) {}

  async save(task: DiagnosisTask): Promise<void> {
    const entity = this.toEntity(task);
    await this.repo.save(entity);
  }

  async findById(taskId: string): Promise<DiagnosisTask | null> {
    const entity = await this.repo.findOne({ where: { id: taskId } });
    return entity ? this.toDomain(entity) : null;
  }

  // ── 映射：领域模型 → 持久化实体 ──

  private toEntity(task: DiagnosisTask): DiagnosisTaskEntity {
    const e = new DiagnosisTaskEntity();
    e.id = task.id;
    e.status = task.status;
    e.appId = task.request.appId;
    e.pageUrl = task.request.pageUrl;
    e.title = task.request.title;
    e.description = task.request.description ?? null;
    e.evidence = task.request.evidence as unknown[];
    e.symptoms = task.request.symptoms ?? null;
    e.findings = (task.findings as unknown[]) ?? null;
    e.rankedFindings = (task.rankedFindings as unknown[]) ?? null;
    e.conclusion = (task.conclusion as unknown as Record<string, unknown>) ?? null;
    e.dominoChain = (task.dominoChain as unknown as Record<string, unknown>) ?? null;
    e.explanation = (task.explanation as unknown as Record<string, unknown>) ?? null;
    e.error = task.error ?? null;
    e.createdAt = task.createdAt;
    e.completedAt = task.completedAt ?? null;
    return e;
  }

  // ── 映射：持久化实体 → 领域模型 ──

  private toDomain(e: DiagnosisTaskEntity): DiagnosisTask {
    const request: CreateDiagnosisInput = {
      appId: e.appId,
      pageUrl: e.pageUrl,
      title: e.title,
      description: e.description ?? undefined,
      evidence: (e.evidence ?? []) as EvidenceItem[],
      symptoms: (e.symptoms ?? undefined) as string[] | undefined,
    };

    return {
      id: e.id,
      status: e.status as DiagnosisTaskStage,
      request,
      findings: e.findings as DiagnosisTask['findings'],
      rankedFindings: e.rankedFindings as DiagnosisTask['rankedFindings'],
      conclusion: e.conclusion as unknown as DiagnosisTask['conclusion'],
      dominoChain: e.dominoChain as unknown as DiagnosisTask['dominoChain'],
      explanation: e.explanation as unknown as DiagnosisTask['explanation'],
      error: e.error ?? undefined,
      createdAt: e.createdAt,
      completedAt: e.completedAt ?? undefined,
    };
  }
}
