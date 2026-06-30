import { Injectable } from '@nestjs/common';
import { DominoChain, DominoNode, RankedFinding, DiagnosisContext } from '../interfaces/diagnosis.types';

@Injectable()
export class DominoChainBuilder {
  build(rankedFindings: RankedFinding[], context: DiagnosisContext): DominoChain {
    const nodes: DominoNode[] = [];

    const hasPerfFindings = rankedFindings.some((f) => f.layer === 'page_load');
    if (hasPerfFindings) {
      const perfEvents = context.evidence.filter((e) => e.type === 'performance_event');
      const timing = (perfEvents[0]?.value?.timing as Record<string, number>) ?? {};
      const pageReadyMs = timing.firstScreenReadyMs;

      nodes.push({
        id: 'page_load-0',
        label: pageReadyMs != null
          ? `Page loaded in ${(pageReadyMs / 1000).toFixed(1)}s${pageReadyMs > 4000 ? ' (slow)' : ''}`
          : 'Page load',
        type: 'page_load',
        status: (pageReadyMs != null && pageReadyMs > 4000) ? 'degraded' : 'normal',
        evidenceIds: perfEvents.map((e) => e.id),
        children: [],
      });
    }

    const findingNodes = rankedFindings.map((f, i) => ({
      id: `${f.layer}-${i + (hasPerfFindings ? 1 : 0)}`,
      label: f.title,
      type: f.layer as DominoNode['type'],
      status: (f.isSymptomOnly ? 'degraded' : 'failed') as 'normal' | 'degraded' | 'failed',
      evidenceIds: f.evidenceIds,
      children: [],
    }));

    return { nodes: [...nodes, ...findingNodes] };
  }
}
