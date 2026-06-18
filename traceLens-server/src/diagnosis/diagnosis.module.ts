import { Module } from '@nestjs/common';
import { DiagnosisController } from './diagnosis.controller';
import { DiagnosisService } from './services/diagnosis.service';
import { DiagnosisCommandService } from './services/diagnosis-command.service';
import { DiagnosisQueryService } from './services/diagnosis-query.service';
import { ContextBuilderService } from './builders/context-builder.service';
import { DominoChainBuilder } from './builders/domino-chain.builder';
import { ExplanationBuilder } from './builders/explanation.builder';
import { RuleEngineService } from './domain/rule-engine.service';
import { RankingService } from './domain/ranking.service';
import { DiagnosisConclusionService } from './domain/diagnosis-conclusion.service';
import { DiagnosisRuleRegistry } from './domain/diagnosis-rule.registry';
import { InMemoryDiagnosisRepository } from './repositories/in-memory-diagnosis.repository';

@Module({
  controllers: [DiagnosisController],
  providers: [
    DiagnosisService,
    DiagnosisCommandService,
    DiagnosisQueryService,
    ContextBuilderService,
    DominoChainBuilder,
    ExplanationBuilder,
    RuleEngineService,
    RankingService,
    DiagnosisConclusionService,
    DiagnosisRuleRegistry,
    { provide: 'DiagnosisRepository', useClass: InMemoryDiagnosisRepository },
  ],
  exports: [DiagnosisService],
})
export class DiagnosisModule {}
