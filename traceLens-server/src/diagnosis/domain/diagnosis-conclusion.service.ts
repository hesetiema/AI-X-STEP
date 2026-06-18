import { Injectable } from '@nestjs/common';
import { RankedFinding, DiagnosisConclusion, ConclusionState } from '../interfaces/diagnosis.types';

@Injectable()
export class DiagnosisConclusionService {
  conclude(rankedFindings: RankedFinding[]): DiagnosisConclusion {
    const topFindings = rankedFindings.filter((f) => !f.isSymptomOnly && f.rank <= 3);
    const supportingFindings = rankedFindings.filter((f) => !f.isSymptomOnly && f.rank > 3);
    const symptomFindings = rankedFindings.filter((f) => f.isSymptomOnly);

    const state = this.determineState(topFindings);
    const summary = this.buildSummary(state, topFindings);
    const hints = this.buildHints(topFindings, symptomFindings);

    return {
      topFindings,
      supportingFindings,
      symptomFindings,
      state,
      summary,
      hints,
    };
  }

  private determineState(topFindings: RankedFinding[]): ConclusionState {
    if (topFindings.length > 0 && topFindings[0].confidence >= 0.8) {
      return 'root_cause_identified';
    }
    if (topFindings.length > 0) {
      return 'partial_root_cause';
    }
    return 'insufficient_evidence';
  }

  private buildSummary(state: ConclusionState, topFindings: RankedFinding[]): string {
    if (state === 'root_cause_identified') {
      return `Root cause identified: ${topFindings[0].title}`;
    }
    if (state === 'partial_root_cause') {
      return `Possible root cause: ${topFindings[0]?.title ?? 'unknown'}`;
    }
    return 'Insufficient evidence to determine root cause.';
  }

  private buildHints(topFindings: RankedFinding[], symptomFindings: RankedFinding[]): string[] {
    const hints: string[] = [];
    if (topFindings.length > 0) {
      hints.push(`Investigate: ${topFindings[0].title}`);
    }
    if (symptomFindings.length > 0) {
      hints.push(`Address ${symptomFindings.length} observed symptom(s).`);
    }
    return hints;
  }
}
