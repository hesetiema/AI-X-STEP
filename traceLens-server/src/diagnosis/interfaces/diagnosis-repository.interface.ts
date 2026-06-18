import { DiagnosisTask } from './diagnosis.types';

export interface DiagnosisRepository {
  save(task: DiagnosisTask): Promise<void>;
  findById(taskId: string): Promise<DiagnosisTask | null>;
}
