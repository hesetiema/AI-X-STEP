import { Injectable } from '@nestjs/common';
import { DiagnosisConclusion, DiagnosisExplanation, DominoChain, LlmDiagnosisResult, RankedFinding } from '../interfaces/diagnosis.types';

@Injectable()
export class ExplanationBuilder {
  build(
    conclusion: DiagnosisConclusion,
    rankedFindings: RankedFinding[],
    dominoChain: DominoChain,
    llmResult?: LlmDiagnosisResult | null,
  ): DiagnosisExplanation {
    const ruleAdvice = this.buildAdvice(conclusion);
    const llmAdvice = llmResult?.advice ?? [];
    return {
      summaryText: this.buildSummary(conclusion),
      evidenceNarrative: this.buildNarrative(rankedFindings),
      operatorAdvice: llmAdvice.length > 0 ? [...llmAdvice, ...ruleAdvice] : ruleAdvice,
      symptomNotes: this.buildSymptomNotes(rankedFindings),
      llmNarrative: llmResult?.narrative,
      brokenStage: llmResult?.brokenStage,
      hypotheses: llmResult?.hypotheses,
      llmConfidence: llmResult?.confidence,
      llmModel: llmResult?.model,
    };
  }

  private buildSummary(conclusion: DiagnosisConclusion): string {
    return `Diagnosis complete: ${conclusion.summary}`;
  }

  private buildNarrative(rankedFindings: RankedFinding[]): string[] {
    return rankedFindings.map(
      (f) => `${f.title} (score: ${f.score}, confidence: ${f.confidence})`,
    );
  }

  private buildAdvice(conclusion: DiagnosisConclusion): string[] {
    return conclusion.hints ?? [];
  }

  private buildSymptomNotes(rankedFindings: RankedFinding[]): string[] {
    return rankedFindings
      .filter((f) => f.isSymptomOnly)
      .map((f) => `${f.title}: ${f.summary}`);
  }
}
