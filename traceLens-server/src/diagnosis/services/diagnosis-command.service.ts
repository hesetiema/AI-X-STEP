import { Injectable, Inject } from '@nestjs/common';
import { v4 as randomUUID } from 'uuid';
import { CreateDiagnosisDto } from '../dto/create-diagnosis.dto';
import { DiagnosisTask, DiagnosisTaskStage, CreateDiagnosisResponse, EvidenceItem } from '../interfaces/diagnosis.types';
import { DiagnosisRepository } from '../interfaces/diagnosis-repository.interface';
import { ContextBuilderService } from '../builders/context-builder.service';
import { RuleEngineService } from '../domain/rule-engine.service';
import { RankingService } from '../domain/ranking.service';
import { DiagnosisConclusionService } from '../domain/diagnosis-conclusion.service';
import { DominoChainBuilder } from '../builders/domino-chain.builder';
import { ExplanationBuilder } from '../builders/explanation.builder';

@Injectable()
export class DiagnosisCommandService {
  constructor(
    private readonly contextBuilder: ContextBuilderService,
    private readonly ruleEngine: RuleEngineService,
    private readonly rankingService: RankingService,
    private readonly conclusionService: DiagnosisConclusionService,
    private readonly dominoChainBuilder: DominoChainBuilder,
    private readonly explanationBuilder: ExplanationBuilder,
    @Inject('DiagnosisRepository') private readonly repository: DiagnosisRepository,
  ) {}

  async create(dto: CreateDiagnosisDto): Promise<CreateDiagnosisResponse> {
    const evidence: EvidenceItem[] = dto.evidence.map((e) => ({
      id: e.id,
      type: e.type,
      label: e.label,
      value: e.value ?? {},
      source: e.source,
      timestamp: e.timestamp,
    }));

    const task: DiagnosisTask = {
      id: randomUUID(),
      status: DiagnosisTaskStage.PENDING,
      request: { appId: dto.appId, pageUrl: dto.pageUrl, title: dto.title, description: dto.description, evidence, symptoms: dto.symptoms },
      createdAt: new Date(),
    };
    await this.repository.save(task);

    this.processTask(task).catch((err) => {
      console.error(`Task ${task.id} failed:`, err.message);
    });

    return {
      taskId: task.id,
      status: task.status,
      createdAt: task.createdAt,
    };
  }

  private async processTask(task: DiagnosisTask): Promise<void> {
    try {
      task.status = DiagnosisTaskStage.PROCESSING;
      await this.repository.save(task);

      const context = this.contextBuilder.build(task.request);
      const findings = this.ruleEngine.evaluate(context);
      task.findings = findings;

      const rankedFindings = this.rankingService.rank(findings);
      task.rankedFindings = rankedFindings;

      const conclusion = this.conclusionService.conclude(rankedFindings);
      task.conclusion = conclusion;

      const dominoChain = this.dominoChainBuilder.build(rankedFindings, context);
      task.dominoChain = dominoChain;

      const explanation = this.explanationBuilder.build(conclusion, rankedFindings, dominoChain);
      task.explanation = explanation;

      task.status = DiagnosisTaskStage.COMPLETED;
      task.completedAt = new Date();
    } catch (err) {
      task.status = DiagnosisTaskStage.FAILED;
      task.error = err.message;
    }
    await this.repository.save(task);
  }
}
