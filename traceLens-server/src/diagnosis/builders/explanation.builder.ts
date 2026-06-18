import { Injectable } from '@nestjs/common';
import { DiagnosisConclusion, DiagnosisExplanation, RankedFinding, DominoChain } from '../interfaces/diagnosis.types';

@Injectable()
export class ExplanationBuilder {
  build(
    conclusion: DiagnosisConclusion,
    rankedFindings: RankedFinding[],
    dominoChain: DominoChain,
  ): DiagnosisExplanation {
    return {
      summaryText: this.buildSummary(conclusion),
      evidenceNarrative: this.buildNarrative(rankedFindings),
      operatorAdvice: this.buildAdvice(conclusion),
      symptomNotes: this.buildSymptomNotes(rankedFindings),
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
