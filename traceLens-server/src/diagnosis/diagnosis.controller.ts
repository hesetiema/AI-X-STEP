import { Controller, Post, Body, Get, Param, ParseUUIDPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { DiagnosisService } from './services/diagnosis.service';
import { CreateDiagnosisDto } from './dto/create-diagnosis.dto';

@Controller('api/v1/diagnosis')
export class DiagnosisController {
  constructor(private readonly diagnosisService: DiagnosisService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateDiagnosisDto) {
    return this.diagnosisService.createDiagnosis(dto);
  }

  @Get(':taskId')
  async getResult(@Param('taskId', ParseUUIDPipe) taskId: string) {
    return this.diagnosisService.getDiagnosisResult(taskId);
  }
}
