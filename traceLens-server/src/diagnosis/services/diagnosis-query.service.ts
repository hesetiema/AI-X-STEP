import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { DiagnosisRepository } from '../interfaces/diagnosis-repository.interface';
import { DiagnosisTask, DiagnosisResult } from '../interfaces/diagnosis.types';

@Injectable()
export class DiagnosisQueryService {
  constructor(
    @Inject('DiagnosisRepository') private readonly repository: DiagnosisRepository,
  ) {}

  async getResult(taskId: string): Promise<DiagnosisResult> {
    const task = await this.repository.findById(taskId);
    if (!task) {
      throw new NotFoundException(`Diagnosis task ${taskId} not found`);
    }
    return this.toResult(task);
  }

  private toResult(task: DiagnosisTask): DiagnosisResult {
    return {
      taskId: task.id,
      status: task.status,
      createdAt: task.createdAt,
      completedAt: task.completedAt,
      conclusion: task.conclusion,
      dominoChain: task.dominoChain,
      explanation: task.explanation,
    };
  }
}
