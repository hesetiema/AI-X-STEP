import { Injectable } from '@nestjs/common';
import { DiagnosisRuleRegistry } from './diagnosis-rule.registry';
import { DiagnosisContext, RuleFinding } from '../interfaces/diagnosis.types';

@Injectable()
export class RuleEngineService {
  constructor(
    private readonly registry: DiagnosisRuleRegistry,
  ) {}

  evaluate(context: DiagnosisContext): RuleFinding[] {
    const rules = this.registry.getAll();
    return rules.flatMap((rule) => rule.evaluate(context));
  }
}
