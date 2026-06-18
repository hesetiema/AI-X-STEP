import { DiagnosisContext, RuleFinding } from './diagnosis.types';

export interface DiagnosisRule {
  readonly code: string;
  readonly name?: string;
  evaluate(context: DiagnosisContext): RuleFinding[];
}
