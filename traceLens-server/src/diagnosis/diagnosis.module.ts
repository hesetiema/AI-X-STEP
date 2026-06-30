import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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
import { DiagnosisTaskEntity } from './entities/diagnosis-task.entity';
import { MysqlDiagnosisRepository } from './repositories/mysql-diagnosis.repository';
import { LlmDiagnosisService } from './services/llm-diagnosis.service';
import { BusinessSemanticAnalyzer } from './services/business-semantic-analyzer.service';

@Module({
  imports: [TypeOrmModule.forFeature([DiagnosisTaskEntity])],
  controllers: [DiagnosisController],
  providers: [
    DiagnosisService,
    DiagnosisCommandService,
    DiagnosisQueryService,
    ContextBuilderService,
    DominoChainBuilder,
    ExplanationBuilder,
    LlmDiagnosisService,
    BusinessSemanticAnalyzer,
    RuleEngineService,
    RankingService,
    DiagnosisConclusionService,
    DiagnosisRuleRegistry,
    { provide: 'DiagnosisRepository', useClass: MysqlDiagnosisRepository },
  ],
  exports: [DiagnosisService],
})
export class DiagnosisModule {}
