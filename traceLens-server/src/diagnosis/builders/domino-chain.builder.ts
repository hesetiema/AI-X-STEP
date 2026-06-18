import { Injectable } from '@nestjs/common';
import { DominoChain, DominoNode, RankedFinding, DiagnosisContext } from '../interfaces/diagnosis.types';

@Injectable()
export class DominoChainBuilder {
  build(rankedFindings: RankedFinding[], context: DiagnosisContext): DominoChain {
    const nodes = rankedFindings.map((f, i) => ({
      id: `${f.layer}-${i}`,
      label: f.title,
      type: f.layer as DominoNode['type'],
      status: (f.isSymptomOnly ? 'degraded' : 'failed') as 'normal' | 'degraded' | 'failed',
      evidenceIds: f.evidenceIds,
      children: [],
    }));

    return { nodes };
  }
}
