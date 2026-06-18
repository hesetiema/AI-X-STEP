import { Injectable } from '@nestjs/common';
import { RuleFinding, RankedFinding } from '../interfaces/diagnosis.types';

@Injectable()
export class RankingService {
  rank(findings: RuleFinding[]): RankedFinding[] {
    const nonSymptoms = findings.filter((f) => !f.isSymptomOnly);
    const symptoms = findings.filter((f) => f.isSymptomOnly);

    const scored = [...nonSymptoms, ...symptoms].map((f) => ({
      ...f,
      score: this.computeScore(f),
    }));

    const sorted = scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return layerPriority(b.layer) - layerPriority(a.layer);
    });

    const seenClusters = new Set<string>();
    const deduped: RuleFinding[] = [];
    for (const f of sorted) {
      const key = f.cluster;
      if (!seenClusters.has(key)) {
        seenClusters.add(key);
        deduped.push(f);
      }
    }

    return deduped.map((f, i) => ({
      ...f,
      rank: i + 1,
      score: f.score,
    }));
  }

  private computeScore(finding: RuleFinding): number {
    let score = finding.confidence * 100;
    if (!finding.isSymptomOnly) score += 10;
    const layer = finding.layer;
    if (['api', 'db', 'bff', 'domain'].includes(layer)) score += 5;
    if (['external'].includes(layer)) score += 3;
    const evidenceCount = finding.evidenceIds?.length ?? 0;
    score += Math.min(evidenceCount * 2, 10);
    return Math.min(score, 100);
  }
}

function layerPriority(layer: string): number {
  const priorities: Record<string, number> = {
    user_action: 1,
    ui_state: 2,
    frontend_app: 3,
    bff: 4,
    api: 5,
    domain: 6,
    db: 7,
    external: 8,
  };
  return priorities[layer] ?? 0;
}
