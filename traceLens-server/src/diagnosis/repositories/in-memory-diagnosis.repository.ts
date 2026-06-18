import { Injectable } from '@nestjs/common';
import { DiagnosisRepository } from '../interfaces/diagnosis-repository.interface';
import { DiagnosisTask } from '../interfaces/diagnosis.types';

@Injectable()
export class InMemoryDiagnosisRepository implements DiagnosisRepository {
  private readonly store = new Map<string, DiagnosisTask>();

  async save(task: DiagnosisTask): Promise<void> {
    this.store.set(task.id, task);
  }

  async findById(taskId: string): Promise<DiagnosisTask | null> {
    return this.store.get(taskId) ?? null;
  }
}
