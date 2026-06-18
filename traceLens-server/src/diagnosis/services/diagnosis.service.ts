import { Injectable } from '@nestjs/common';
import { DiagnosisCommandService } from './diagnosis-command.service';
import { DiagnosisQueryService } from './diagnosis-query.service';
import { CreateDiagnosisDto } from '../dto/create-diagnosis.dto';
import { CreateDiagnosisResponse, DiagnosisResult } from '../interfaces/diagnosis.types';

@Injectable()
export class DiagnosisService {
  constructor(
    private readonly commandService: DiagnosisCommandService,
    private readonly queryService: DiagnosisQueryService,
  ) {}

  async createDiagnosis(dto: CreateDiagnosisDto): Promise<CreateDiagnosisResponse> {
    return this.commandService.create(dto);
  }

  async getDiagnosisResult(taskId: string): Promise<DiagnosisResult> {
    return this.queryService.getResult(taskId);
  }
}
