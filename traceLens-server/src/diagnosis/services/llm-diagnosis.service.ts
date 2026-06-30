import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DiagnosisConclusion,
  DiagnosisContext,
  DominoChain,
  DominoNodeType,
  EvidenceItem,
  LlmDiagnosisResult,
  RankedFinding,
} from '../interfaces/diagnosis.types';
import type { BusinessContext } from './business-semantic-analyzer.service';

const MAX_EVIDENCE_IN_PROMPT = 30;
const MAX_LABEL_LENGTH = 60;

const VALID_STAGES: DominoNodeType[] = [
  'page_load', 'user_action', 'ui_state', 'frontend_app', 'bff', 'api', 'domain', 'db', 'external',
];

const SENSITIVE_VALUE_KEYS = new Set([
  'requestText', 'responseText', 'requestBody', 'responseBody', 'headers', 'cookie', 'token', 'stack',
]);

const SYSTEM_PROMPT = `你是 TraceLens 前端故障诊断专家。你的任务是基于已采集的结构化证据和规则引擎的初步结论，定位故障的断点环节并用自然语言解释原因。

断点环节(brokenStage)必须是以下之一：
- page_load: 页面加载/首屏初始化阶段(资源加载、API 调用、渲染性能)
- user_action: 用户操作层(点击/提交等交互)
- ui_state: UI 状态层(loading/toast/empty_state/disabled 等症状)
- frontend_app: 前端应用层(JS 错误/渲染异常/逻辑问题)
- bff: BFF/网关层
- api: API 服务层(请求失败/超时/状态码异常)
- domain: 领域服务层
- db: 数据库层
- external: 外部依赖层

规则：
1. 只基于给定证据推断，不要编造证据中不存在的事实
2. 如果证据不足以确定断点，给出多个假设并降低 confidence
3. narrative 用中文，简洁说明：发生了什么、断在哪个环节、为什么
4. 利用业务语义分析中的「点击-网络关联」和「操作分组」来理解用户的业务意图
5. 利用页面加载性能数据（LCP/FCP/TTFB/CLS/首屏API统计）诊断首屏性能瓶颈
6. 即使前端代码被混淆，也要利用 DOM 上下文（标签文本、aria-label、表单字段名、容器标题）推断业务语义
7. 如果有调用栈信息（stackTrace），即使函数名被混淆，也要从 URL 路径和入口文件名中提取模块线索
8. 如果有作用域变量（scopeVariables），利用变量名和类型推断业务上下文（如 formValues=object 可能是表单数据，isLoading=boolean 可能是加载状态）
9. 输出必须是合法 JSON，格式如下：
{
  "narrative": "自然语言解释（含业务语义：用户在XX页面点击了XX按钮，触发了XX请求，最终XX失败）",
  "brokenStage": "断点环节枚举值",
  "hypotheses": ["假设1", "假设2"],
  "confidence": 0.0到1.0的数字,
  "advice": ["建议1", "建议2"]
}`;

@Injectable()
export class LlmDiagnosisService {
  private readonly logger = new Logger(LlmDiagnosisService.name);
  private readonly cache = new Map<string, LlmDiagnosisResult>();
  private static readonly CACHE_MAX = 100;

  constructor(private readonly config: ConfigService) {}

  async analyze(params: {
    context: DiagnosisContext;
    rankedFindings: RankedFinding[];
    conclusion: DiagnosisConclusion;
    dominoChain: DominoChain;
    businessContext?: BusinessContext;
  }): Promise<LlmDiagnosisResult | null> {
    const enabled = this.config.get<string>('LLM_ENABLED', 'false')?.toLowerCase() === 'true';
    if (!enabled) {
      return null;
    }

    const baseURL = this.config.get<string>('LLM_BASE_URL');
    const apiKey = this.config.get<string>('LLM_API_KEY');
    const model = this.config.get<string>('LLM_MODEL', 'qwen-plus');
    if (!baseURL || !apiKey) {
      this.logger.warn('LLM_ENABLED=true 但 LLM_BASE_URL/LLM_API_KEY 未配置，跳过 LLM 诊断');
      return null;
    }

    const cacheKey = this.buildCacheKey(params);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.logger.debug('LLM 诊断缓存命中');
      return { ...cached, model };
    }

    const userPrompt = this.buildUserPrompt(params);

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30_000);

      const resp = await fetch(`${baseURL.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        this.logger.warn(`LLM API 返回 ${resp.status}: ${body.slice(0, 200)}`);
        return null;
      }

      const data = await resp.json();
      const content: string | undefined = data?.choices?.[0]?.message?.content;
      if (!content) {
        this.logger.warn('LLM 响应缺少 content 字段');
        return null;
      }

      const parsed = this.parseResponse(content, model);
      if (!parsed) {
        return null;
      }

      this.setCache(cacheKey, parsed);
      return parsed;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`LLM 诊断失败(非致命，降级为纯规则): ${msg}`);
      return null;
    }
  }

  private buildUserPrompt(params: {
    context: DiagnosisContext;
    rankedFindings: RankedFinding[];
    conclusion: DiagnosisConclusion;
    dominoChain: DominoChain;
    businessContext?: BusinessContext;
  }): string {
    const { context, rankedFindings, conclusion, dominoChain, businessContext } = params;
    const lines: string[] = [];

    lines.push(`## 页面信息`);
    lines.push(`- URL: ${context.pageUrl}`);
    lines.push(`- 标题: ${context.title}`);
    if (context.description) {
      lines.push(`- 用户描述: ${context.description}`);
    }
    if (context.symptoms.length > 0) {
      lines.push(`- 症状:`);
      for (const s of context.symptoms) {
        lines.push(`  - ${s}`);
      }
    }

    lines.push('');
    lines.push(`## 采集证据 (${context.evidence.length} 条)`);

    // 精选证据：优先 error → 非空网络响应 → 点击事件，最多投喂 MAX_EVIDENCE_IN_PROMPT 条
    const prioritized = this.prioritizeEvidence(context.evidence);
    const evidenceText = prioritized.map((e, i) => this.textizeEvidence(e, i + 1));
    lines.push(...evidenceText);

    if (businessContext) {
      lines.push(businessContext.toPromptSection());
    }

    lines.push('');
    lines.push(`## 规则引擎结论`);
    lines.push(`- 状态: ${conclusion.state}`);
    lines.push(`- 总结: ${conclusion.summary}`);
    if (conclusion.hints.length > 0) {
      lines.push(`- 提示: ${conclusion.hints.join('; ')}`);
    }
    if (rankedFindings.length > 0) {
      lines.push(`- 命中规则 (按分数排序):`);
      for (const f of rankedFindings.slice(0, 8)) {
        lines.push(`  - [${f.ruleCode}] ${f.title} (score=${f.score}, confidence=${f.confidence}) — ${f.summary}`);
      }
    }

    lines.push('');
    lines.push(`## 多米诺链`);
    if (dominoChain.nodes.length > 0) {
      for (const n of dominoChain.nodes) {
        lines.push(`  - [${n.status}] ${n.type}: ${n.label} (evidence: ${n.evidenceIds.length})`);
      }
    } else {
      lines.push(`  (无)`);
    }

    lines.push('');
    lines.push(`请基于以上信息，输出 JSON 诊断结果。`);
    return lines.join('\n');
  }

  private textizeEvidence(e: EvidenceItem, index: number): string {
    const sanitized = this.sanitizeValue(e.value);
    const label = e.label.length > MAX_LABEL_LENGTH
      ? e.label.slice(0, MAX_LABEL_LENGTH) + '…'
      : e.label;
    const parts: string[] = [`  ${index}. [${e.type}] ${label}`];

    // 将 stackTrace / scopeVariables 从普通字段中分离，单独格式化
    const stackTrace = sanitized['stackTrace'];
    const scopeVariables = sanitized['scopeVariables'];
    const otherEntries = Object.entries(sanitized).filter(
      ([k]) => k !== 'stackTrace' && k !== 'scopeVariables',
    );

    if (otherEntries.length > 0) {
      const kv = otherEntries
        .map(([k, v]) => {
          const vs = typeof v === 'string' ? v : JSON.stringify(v);
          const truncated = vs.length > 120 ? vs.slice(0, 120) + '...' : vs;
          return `${k}=${truncated}`;
        })
        .join(', ');
      parts.push(`     ${kv}`);
    }

    // 格式化调用栈 —— 即使函数名被混淆，URL 路径也能提供模块线索
    if (Array.isArray(stackTrace) && stackTrace.length > 0) {
      parts.push(`     调用栈:`);
      for (let i = 0; i < stackTrace.length; i++) {
        const frame = stackTrace[i] as {
          functionName?: string;
          url?: string;
          lineNumber?: number;
          columnNumber?: number;
        };
        const fn = frame.functionName || '(anonymous)';
        const url = this.shortenUrl(frame.url || '');
        const line = frame.lineNumber ?? 0;
        const col = frame.columnNumber ?? 0;
        parts.push(`       #${i} ${fn} (${url}:${line}:${col})`);
      }
    }

    // 格式化作用域变量 —— 变量名+类型+摘要，不含实际值
    if (Array.isArray(scopeVariables) && scopeVariables.length > 0) {
      parts.push(`     作用域变量:`);
      for (const sv of scopeVariables as Array<{ name: string; type: string; valueSummary: string }>) {
        parts.push(`       ${sv.name}: ${sv.type} = ${sv.valueSummary}`);
      }
    }

    if (e.timestamp) {
      parts.push(`     @ ${e.timestamp}`);
    }
    return parts.join('\n');
  }

  /**
   * 缩短 URL 以提高 prompt 可读性。
   * 保留最后 2 段路径（含文件名），如 app.bundle.js → app.bundle.js，
   * static/js/app.bundle.js → .../js/app.bundle.js
   */
  private shortenUrl(url: string): string {
    try {
      const u = new URL(url);
      const segments = u.pathname.split('/').filter(Boolean);
      if (segments.length <= 2) return u.pathname;
      return '.../' + segments.slice(-2).join('/');
    } catch {
      return url.length > 60 ? '...' + url.slice(-57) : url;
    }
  }

  private sanitizeValue(value: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_VALUE_KEYS.has(k)) continue;
      if (k === 'parentChain' || k === 'siblingLabels' || k === 'domPath') continue;
      if (typeof v === 'string' && v.length > 120) {
        out[k] = v.slice(0, 120) + '...';
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  /**
   * 精选证据：priority order → error > 非空 network response > ui_event (有 domContext 优先)
   * 去重后再截取最多 MAX_EVIDENCE_IN_PROMPT 条，避免 prompt 过大超时。
   */
  private prioritizeEvidence(evidence: EvidenceItem[]): EvidenceItem[] {
    const errors = evidence.filter((e) => e.type === 'frontend_error');
    const perfEvents = evidence.filter((e) => e.type === 'performance_event');
    const networkNonEmpty = evidence.filter(
      (e) => e.type === 'network_event' &&
        (e.value?.['insight'] as Record<string, unknown> | undefined)?.['resultCategory'] !== undefined,
    );
    const uiWithDomCtx = evidence.filter(
      (e) => e.type === 'ui_event' && e.value?.['domContext'] != null,
    );
    const uiWithoutDomCtx = evidence.filter(
      (e) => e.type === 'ui_event' && e.value?.['domContext'] == null,
    );
    const rest = evidence.filter(
      (e) => !['frontend_error', 'network_event', 'ui_event'].includes(e.type),
    );

    const merged = [
      ...errors,
      ...perfEvents,
      ...networkNonEmpty,
      ...uiWithDomCtx,
      ...uiWithoutDomCtx,
      ...rest,
    ];

    // 去重（按 id）
    const seen = new Set<string>();
    const deduped: EvidenceItem[] = [];
    for (const e of merged) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      deduped.push(e);
      if (deduped.length >= MAX_EVIDENCE_IN_PROMPT) break;
    }

    return deduped;
  }

  private parseResponse(content: string, model: string): LlmDiagnosisResult | null {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) {
        this.logger.warn('LLM 响应无法解析为 JSON');
        return null;
      }
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        this.logger.warn('LLM 响应 JSON 提取失败');
        return null;
      }
    }

    const obj = parsed as Record<string, unknown>;
    const narrative = typeof obj.narrative === 'string' ? obj.narrative : '';
    const rawStage = typeof obj.brokenStage === 'string' ? obj.brokenStage.trim() : '';

    // LLM 偶尔在 brokenStage 周围加引号，如 "\"frontend_app\""
    // 去首尾引号 → trim
    const cleanStage = rawStage
      .replace(/^["']|["']$/g, '')
      .trim();

    const brokenStage = (VALID_STAGES.includes(cleanStage as DominoNodeType) ? cleanStage : undefined) as DominoNodeType | undefined;

    if (!narrative) {
      this.logger.warn(
        `LLM 响应缺少 narrative: brokenStage="${cleanStage}" (valid=${VALID_STAGES.includes(cleanStage as DominoNodeType)})`,
      );
      return null;
    }

    if (!brokenStage) {
      this.logger.warn(
        `LLM 响应 brokenStage 非法: raw="${rawStage}" clean="${cleanStage}" (length=${cleanStage.length}, chars=[${[...cleanStage].map(c => c.charCodeAt(0)).join(',')}], valid: ${VALID_STAGES.join(', ')})`,
      );
      return null;
    }

    const hypotheses = Array.isArray(obj.hypotheses)
      ? obj.hypotheses.filter((h) => typeof h === 'string').slice(0, 5)
      : [];
    const advice = Array.isArray(obj.advice)
      ? obj.advice.filter((a) => typeof a === 'string').slice(0, 5)
      : [];
    const confidence = typeof obj.confidence === 'number'
      ? Math.max(0, Math.min(1, obj.confidence))
      : 0.5;

    return { narrative, brokenStage, hypotheses, confidence, advice, model };
  }

  private buildCacheKey(params: {
    context: DiagnosisContext;
    conclusion: DiagnosisConclusion;
    dominoChain: DominoChain;
    businessContext?: BusinessContext;
  }): string {
    const evidenceFp = params.context.evidence
      .map((e) => `${e.type}:${e.label}`)
      .join('|');
    const chainFp = params.dominoChain.nodes
      .map((n) => `${n.type}:${n.status}`)
      .join('|');
    const bizFp = params.businessContext?.correlations.length ?? 0;
    return `${evidenceFp}::${params.conclusion.state}::${chainFp}::biz${bizFp}`;
  }

  private setCache(key: string, value: LlmDiagnosisResult): void {
    if (this.cache.size >= LlmDiagnosisService.CACHE_MAX) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }
}
