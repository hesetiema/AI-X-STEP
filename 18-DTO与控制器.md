下面直接给你一版 **NestJS DTO + Controller 草案**。  
我按你前面已经定下来的 Diagnosis API 结构来写，尽量做到：

- 能直接映射 OpenAPI / Swagger
- 能接后面的 Service 实现
- 命名和前面 JSON / OpenAPI 一致
- 先满足 MVP

我会分成 5 部分：

1. 推荐目录结构  
2. 枚举与基础 DTO  
3. 请求 / 响应 DTO  
4. Controller 草案  
5. 实现注意点

---

# 1. 推荐目录结构

建议先按模块化拆：

```ts
src/modules/diagnosis/
  diagnosis.controller.ts
  diagnosis.service.ts
  diagnosis.module.ts

  dto/
    create-diagnosis.dto.ts
    diagnosis-result.dto.ts
    diagnosis-finding.dto.ts
    evidence-detail.dto.ts
    domino-chain.dto.ts
    common-response.dto.ts

  enums/
    diagnosis-mode.enum.ts
    diagnosis-status.enum.ts
    diagnosis-state.enum.ts
    rule-category.enum.ts
    severity.enum.ts
    layer.enum.ts
    domino-node-status.enum.ts
    evidence-type.enum.ts
    next-action-type.enum.ts
```

如果你想更工程化一点，也可以补：

```ts
  interfaces/
  mappers/
  constants/
```

但 MVP 暂时不用太重。

---

# 2. 枚举定义

---

## 2.1 diagnosis-mode.enum.ts

```ts
export enum DiagnosisModeEnum {
  INSPECT = 'inspect_diagnosis',
  CLICK = 'click_diagnosis',
}
```

---

## 2.2 diagnosis-status.enum.ts

```ts
export enum DiagnosisStatusEnum {
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}
```

---

## 2.3 diagnosis-state.enum.ts

```ts
export enum DiagnosisStateEnum {
  CONFIRMED_ROOT_CAUSE = 'confirmed_root_cause',
  PROBABLE_ROOT_CAUSE = 'probable_root_cause',
  INSUFFICIENT_EVIDENCE = 'insufficient_evidence',
  NO_RULE_MATCHED = 'no_rule_matched',
}
```

---

## 2.4 rule-category.enum.ts

```ts
export enum RuleCategoryEnum {
  DATA_SOURCE = 'data_source',
  STATE_BINDING = 'state_binding',
  RENDER_TRANSFORM = 'render_transform',
  DOM = 'dom',
  INTERACTION = 'interaction',
}
```

---

## 2.5 severity.enum.ts

```ts
export enum SeverityEnum {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}
```

---

## 2.6 layer.enum.ts

```ts
export enum LayerEnum {
  API = 'api',
  API_TO_STATE = 'api_to_state',
  STATE = 'state',
  SELECTOR = 'selector',
  STATE_TO_RENDER = 'state_to_render',
  RENDER = 'render',
  DOM = 'dom',
  UI = 'ui',
  HANDLER = 'handler',
  REQUEST_TO_UI = 'request_to_ui',
}
```

---

## 2.7 domino-node-status.enum.ts

```ts
export enum DominoNodeStatusEnum {
  OK = 'ok',
  BROKEN = 'broken',
  AFFECTED = 'affected',
  OBSERVED = 'observed',
}
```

---

## 2.8 evidence-type.enum.ts

```ts
export enum EvidenceTypeEnum {
  API_RESPONSE = 'api_response',
  STATE_SNAPSHOT = 'state_snapshot',
  SELECTOR_TRACE = 'selector_trace',
  RENDER_TRACE = 'render_trace',
  DOM_SNAPSHOT = 'dom_snapshot',
  INTERACTION_TRACE = 'interaction_trace',
  COMPUTED_STYLE = 'computed_style',
}
```

---

## 2.9 next-action-type.enum.ts

```ts
export enum NextActionTypeEnum {
  INSPECT_EVIDENCE = 'inspect_evidence',
  OPEN_SOURCE = 'open_source',
  RETRY_DIAGNOSIS = 'retry_diagnosis',
}
```

---

# 3. 基础 DTO

---

## 3.1 common-response.dto.ts

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({ example: 'BAD_REQUEST' })
  code: string;

  @ApiProperty({ example: 'invalid request payload' })
  message: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['mode should not be empty'],
  })
  details?: string[];
}
```

---

## 3.2 create-diagnosis.dto.ts

```ts
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DiagnosisModeEnum } from '../enums/diagnosis-mode.enum';

export class DiagnosisTargetDto {
  @ApiProperty({ example: '.order-amount' })
  @IsString()
  @IsNotEmpty()
  dom_selector: string;

  @ApiPropertyOptional({ example: 'OrderAmount' })
  @IsOptional()
  @IsString()
  component_name?: string;

  @ApiPropertyOptional({
    example: '--',
    description: 'Current displayed value on page',
  })
  @IsOptional()
  displayed_value?: string | number | boolean;
}

export class ActionContextDto {
  @ApiPropertyOptional({ example: 'click' })
  @IsOptional()
  @IsString()
  event_type?: string;

  @ApiPropertyOptional({ example: 'button.refresh-status' })
  @IsOptional()
  @IsString()
  event_target?: string;

  @ApiPropertyOptional({ example: '刷新状态' })
  @IsOptional()
  @IsString()
  action_label?: string;
}

export class TraceContextDto {
  @ApiPropertyOptional({ example: 'itr_9f3b2d11' })
  @IsOptional()
  @IsString()
  interaction_id?: string;

  @ApiPropertyOptional({ example: 'lin_b81c44a2' })
  @IsOptional()
  @IsString()
  lineage_id?: string;
}

export class DiagnosisOptionsDto {
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  include_score_breakdown?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  include_domino_chain?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  include_evidence_overview?: boolean;
}

export class CreateDiagnosisDto {
  @ApiProperty({ enum: DiagnosisModeEnum, example: DiagnosisModeEnum.INSPECT })
  @IsEnum(DiagnosisModeEnum)
  mode: DiagnosisModeEnum;

  @ApiProperty({ example: '/orders/detail?id=A1001' })
  @IsString()
  @IsNotEmpty()
  page_url: string;

  @ApiProperty({ type: DiagnosisTargetDto })
  @IsObject()
  @ValidateNested()
  @Type(() => DiagnosisTargetDto)
  target: DiagnosisTargetDto;

  @ApiPropertyOptional({ type: ActionContextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ActionContextDto)
  action_context?: ActionContextDto;

  @ApiPropertyOptional({ type: TraceContextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TraceContextDto)
  trace_context?: TraceContextDto;

  @ApiPropertyOptional({ type: DiagnosisOptionsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DiagnosisOptionsDto)
  options?: DiagnosisOptionsDto;
}

export class CreateDiagnosisDataDto {
  @ApiProperty({ example: 'diag_20260612_0001' })
  diagnosis_id: string;

  @ApiProperty({ example: 'queued' })
  status: string;
}

export class CreateDiagnosisResponseDto {
  @ApiProperty({ example: 'ACCEPTED' })
  code: string;

  @ApiProperty({ example: 'diagnosis task accepted' })
  message: string;

  @ApiProperty({ type: CreateDiagnosisDataDto })
  data: CreateDiagnosisDataDto;
}
```

---

## 3.3 diagnosis-finding.dto.ts

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RuleCategoryEnum } from '../enums/rule-category.enum';
import { SeverityEnum } from '../enums/severity.enum';
import { LayerEnum } from '../enums/layer.enum';

export class RankScoreDto {
  @ApiProperty({ example: 'R201' })
  rule_code: string;

  @ApiProperty({ example: 94 })
  base_score: number;

  @ApiProperty({ example: 16 })
  root_cause_score: number;

  @ApiProperty({ example: 20 })
  specificity_score: number;

  @ApiProperty({ example: 15 })
  evidence_score: number;

  @ApiProperty({ example: 8 })
  chain_consistency_score: number;

  @ApiProperty({ example: 0 })
  symptom_penalty: number;

  @ApiProperty({ example: 4 })
  duplicate_penalty: number;

  @ApiProperty({ example: 149 })
  final_score: number;
}

export class DiagnosisFindingDto {
  @ApiProperty({ example: 'R201' })
  rule_code: string;

  @ApiProperty({ example: '合法 falsy 值被误判为空' })
  title: string;

  @ApiProperty({ example: '合法值被判空吞掉' })
  diagnosis_label: string;

  @ApiProperty({ enum: RuleCategoryEnum, example: RuleCategoryEnum.RENDER_TRANSFORM })
  category: RuleCategoryEnum;

  @ApiProperty({ enum: SeverityEnum, example: SeverityEnum.HIGH })
  severity: SeverityEnum;

  @ApiProperty({ example: 0.94 })
  confidence: number;

  @ApiProperty({ enum: LayerEnum, example: LayerEnum.RENDER })
  layer: LayerEnum;

  @ApiPropertyOptional({ example: 'formatter_fallback' })
  cluster?: string;

  @ApiProperty({
    example: '上游存在合法值 0，但格式化逻辑将其判定为空，最终输出兜底值。',
  })
  summary: string;

  @ApiProperty({
    type: [String],
    example: ['ev_api_amount_0', 'ev_formatter_output_fallback'],
  })
  evidence_refs: string[];

  @ApiProperty({
    type: [String],
    example: ['将 if (!value) 改为 value == null'],
  })
  suggestions: string[];

  @ApiPropertyOptional({ type: RankScoreDto })
  rank_score?: RankScoreDto;

  @ApiPropertyOptional({
    type: [String],
    example: ['属于渲染层根因规则', '证据完整度高'],
  })
  rank_reasons?: string[];
}
```

---

## 3.4 domino-chain.dto.ts

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LayerEnum } from '../enums/layer.enum';
import { DominoNodeStatusEnum } from '../enums/domino-node-status.enum';

export class DominoChainNodeDto {
  @ApiProperty({ example: 1 })
  step: number;

  @ApiProperty({ enum: LayerEnum, example: LayerEnum.API })
  layer: LayerEnum;

  @ApiProperty({ example: 'formatter' })
  node_type: string;

  @ApiProperty({ example: "formatCurrency(0) -> '--'" })
  label: string;

  @ApiProperty({ enum: DominoNodeStatusEnum, example: DominoNodeStatusEnum.BROKEN })
  status: DominoNodeStatusEnum;

  @ApiPropertyOptional({ example: 'ev_formatter_output_fallback' })
  evidence_ref?: string;

  @ApiPropertyOptional({ example: 'R201' })
  hit_rule_code?: string;
}

export class GetDominoChainDataDto {
  @ApiProperty({ example: 'diag_20260612_0001' })
  diagnosis_id: string;

  @ApiProperty({ type: [DominoChainNodeDto] })
  domino_chain: DominoChainNodeDto[];
}

export class GetDominoChainResponseDto {
  @ApiProperty({ example: 'OK' })
  code: string;

  @ApiProperty({ example: 'success' })
  message: string;

  @ApiProperty({ type: GetDominoChainDataDto })
  data: GetDominoChainDataDto;
}
```

---

## 3.5 evidence-detail.dto.ts

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EvidenceTypeEnum } from '../enums/evidence-type.enum';

export class EvidenceDetailDto {
  @ApiProperty({ example: 'ev_formatter_output_fallback' })
  evidence_ref: string;

  @ApiProperty({ enum: EvidenceTypeEnum, example: EvidenceTypeEnum.RENDER_TRACE })
  evidence_type: EvidenceTypeEnum;

  @ApiProperty({ example: 'Formatter output fallback snapshot' })
  title: string;

  @ApiPropertyOptional({
    example: 'Formatter received input 0 and produced fallback output --',
  })
  summary?: string;

  @ApiPropertyOptional({
    type: Object,
    additionalProperties: true,
    example: {
      formatter_name: 'formatCurrency',
      input: 0,
      output: '--',
    },
  })
  payload?: Record<string, any>;

  @ApiPropertyOptional({ example: '2026-06-12T06:08:00Z' })
  created_at?: string;
}

export class GetEvidenceResponseDto {
  @ApiProperty({ example: 'OK' })
  code: string;

  @ApiProperty({ example: 'success' })
  message: string;

  @ApiProperty({ type: EvidenceDetailDto })
  data: EvidenceDetailDto;
}
```

---

## 3.6 diagnosis-result.dto.ts

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DiagnosisModeEnum } from '../enums/diagnosis-mode.enum';
import { DiagnosisStatusEnum } from '../enums/diagnosis-status.enum';
import { DiagnosisStateEnum } from '../enums/diagnosis-state.enum';
import { DiagnosisFindingDto } from './diagnosis-finding.dto';
import { DominoChainNodeDto } from './domino-chain.dto';
import { ActionContextDto } from './create-diagnosis.dto';
import { NextActionTypeEnum } from '../enums/next-action-type.enum';

export class ExpectedBindingDto {
  @ApiPropertyOptional({ example: 'response.data.amount' })
  api_field_path?: string;

  @ApiPropertyOptional({ example: 'order.current.amount' })
  store_key?: string;

  @ApiPropertyOptional({ example: 'selectOrderAmount' })
  selector_name?: string;

  @ApiPropertyOptional({ example: 'formatCurrency' })
  formatter_name?: string;
}

export class DiagnosisResultTargetDto {
  @ApiPropertyOptional({ example: '/orders/detail?id=A1001' })
  page_url?: string;

  @ApiPropertyOptional({ example: '.order-amount' })
  target_dom_selector?: string;

  @ApiPropertyOptional({ example: 'OrderAmount' })
  target_component?: string;

  @ApiPropertyOptional({ example: '--' })
  displayed_value?: string | number | boolean;

  @ApiPropertyOptional({ type: ActionContextDto })
  user_action?: ActionContextDto;

  @ApiPropertyOptional({ type: ExpectedBindingDto })
  expected_binding?: ExpectedBindingDto;
}

export class ApiEvidenceOverviewDto {
  @ApiPropertyOptional({ example: true, nullable: true })
  response_success?: boolean | null;

  @ApiPropertyOptional({ example: 'response.data.amount', nullable: true })
  field_path?: string | null;

  @ApiPropertyOptional({ example: true, nullable: true })
  field_exists?: boolean | null;

  @ApiPropertyOptional({ example: 0, nullable: true })
  field_value?: any;
}

export class StateEvidenceOverviewDto {
  @ApiPropertyOptional({ example: 'order.current.amount', nullable: true })
  store_key?: string | null;

  @ApiPropertyOptional({ example: true, nullable: true })
  store_updated?: boolean | null;

  @ApiPropertyOptional({ example: 0, nullable: true })
  store_value?: any;
}

export class SelectorEvidenceOverviewDto {
  @ApiPropertyOptional({ example: 'selectOrderAmount', nullable: true })
  selector_name?: string | null;

  @ApiPropertyOptional({ example: true, nullable: true })
  selector_ran?: boolean | null;

  @ApiPropertyOptional({ example: 0, nullable: true })
  selector_value?: any;
}

export class RenderEvidenceOverviewDto {
  @ApiPropertyOptional({ example: true, nullable: true })
  render_triggered?: boolean | null;

  @ApiPropertyOptional({ example: 'formatCurrency', nullable: true })
  formatter_name?: string | null;

  @ApiPropertyOptional({ example: 0, nullable: true })
  render_input_value?: any;

  @ApiPropertyOptional({ example: '--', nullable: true })
  render_output_value?: any;

  @ApiPropertyOptional({ example: true, nullable: true })
  formatter_output_is_fallback?: boolean | null;
}

export class DomEvidenceOverviewDto {
  @ApiPropertyOptional({ example: true, nullable: true })
  dom_updated?: boolean | null;

  @ApiPropertyOptional({ example: true, nullable: true })
  dom_visible?: boolean | null;

  @ApiPropertyOptional({ example: '--', nullable: true })
  displayed_value?: any;
}

export class InteractionEvidenceOverviewDto {
  @ApiPropertyOptional({ example: true, nullable: true })
  click_detected?: boolean | null;

  @ApiPropertyOptional({ example: true, nullable: true })
  handler_started?: boolean | null;

  @ApiPropertyOptional({ example: true, nullable: true })
  request_sent?: boolean | null;

  @ApiPropertyOptional({ example: true, nullable: true })
  response_success?: boolean | null;
}

export class EvidenceOverviewDto {
  @ApiPropertyOptional({ type: ApiEvidenceOverviewDto })
  api?: ApiEvidenceOverviewDto;

  @ApiPropertyOptional({ type: StateEvidenceOverviewDto })
  state?: StateEvidenceOverviewDto;

  @ApiPropertyOptional({ type: SelectorEvidenceOverviewDto })
  selector?: SelectorEvidenceOverviewDto;

  @ApiPropertyOptional({ type: RenderEvidenceOverviewDto })
  render?: RenderEvidenceOverviewDto;

  @ApiPropertyOptional({ type: DomEvidenceOverviewDto })
  dom?: DomEvidenceOverviewDto;

  @ApiPropertyOptional({ type: InteractionEvidenceOverviewDto })
  interaction?: InteractionEvidenceOverviewDto;
}

export class ScoreBreakdownItemDto {
  @ApiProperty({ example: 'R201' })
  rule_code: string;

  @ApiProperty({ example: 149 })
  final_score: number;

  @ApiProperty({
    type: [String],
    example: ['根因层级优先', '规则具体性最高', '证据链完整'],
  })
  reason: string[];
}

export class NextActionDto {
  @ApiProperty({ enum: NextActionTypeEnum, example: NextActionTypeEnum.INSPECT_EVIDENCE })
  action_type: NextActionTypeEnum;

  @ApiProperty({ example: '查看 formatter 输入输出' })
  label: string;

  @ApiPropertyOptional({ example: 'ev_formatter_output_fallback' })
  target_ref?: string;
}

export class DiagnosisResultDataDto {
  @ApiProperty({ example: 'diag_20260612_0001' })
  diagnosis_id: string;

  @ApiProperty({ enum: DiagnosisModeEnum, example: DiagnosisModeEnum.INSPECT })
  mode: DiagnosisModeEnum;

  @ApiProperty({ enum: DiagnosisStatusEnum, example: DiagnosisStatusEnum.COMPLETED })
  status: DiagnosisStatusEnum;

  @ApiPropertyOptional({
    enum: DiagnosisStateEnum,
    example: DiagnosisStateEnum.CONFIRMED_ROOT_CAUSE,
  })
  diagnosis_state?: DiagnosisStateEnum;

  @ApiPropertyOptional({ example: 'itr_9f3b2d11', nullable: true })
  interaction_id?: string | null;

  @ApiPropertyOptional({ example: 'lin_b81c44a2', nullable: true })
  lineage_id?: string | null;

  @ApiPropertyOptional({ type: DiagnosisResultTargetDto })
  target?: DiagnosisResultTargetDto;

  @ApiPropertyOptional({ type: DiagnosisFindingDto, nullable: true })
  top_cause?: DiagnosisFindingDto | null;

  @ApiProperty({ type: [DiagnosisFindingDto] })
  supporting_causes: DiagnosisFindingDto[];

  @ApiProperty({ type: [DiagnosisFindingDto] })
  symptoms: DiagnosisFindingDto[];

  @ApiProperty({
    example: '最可能根因是「合法值被判空吞掉」：接口、store、selector 中金额值均为 0，但 formatter 将 0 误判为空。',
  })
  summary: string;

  @ApiProperty({ type: [String] })
  repair_hints: string[];

  @ApiPropertyOptional({ type: [ScoreBreakdownItemDto] })
  score_breakdown?: ScoreBreakdownItemDto[];

  @ApiPropertyOptional({ type: EvidenceOverviewDto })
  evidence_overview?: EvidenceOverviewDto;

  @ApiPropertyOptional({ type: [DominoChainNodeDto] })
  domino_chain?: DominoChainNodeDto[];

  @ApiPropertyOptional({ type: [NextActionDto] })
  next_actions?: NextActionDto[];

  @ApiProperty({ example: '2026-06-12T06:08:00Z' })
  generated_at: string;
}

export class GetDiagnosisResponseDto {
  @ApiProperty({ example: 'OK' })
  code: string;

  @ApiProperty({ example: 'success' })
  message: string;

  @ApiProperty({ type: DiagnosisResultDataDto })
  data: DiagnosisResultDataDto;
}
```

---

# 4. Controller 草案

---

## 4.1 diagnosis.controller.ts

```ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import {
  CreateDiagnosisDto,
  CreateDiagnosisResponseDto,
} from './dto/create-diagnosis.dto';
import { GetDiagnosisResponseDto } from './dto/diagnosis-result.dto';
import { GetEvidenceResponseDto } from './dto/evidence-detail.dto';
import { GetDominoChainResponseDto } from './dto/domino-chain.dto';
import { ErrorResponseDto } from './dto/common-response.dto';
import { DiagnosisService } from './diagnosis.service';

@ApiTags('Diagnosis')
@Controller('/api/v1/diagnosis')
export class DiagnosisController {
  constructor(private readonly diagnosisService: DiagnosisService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Create a diagnosis task' })
  @ApiAcceptedResponse({ type: CreateDiagnosisResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async createDiagnosis(
    @Body() dto: CreateDiagnosisDto,
  ): Promise<CreateDiagnosisResponseDto> {
    return this.diagnosisService.createDiagnosis(dto);
  }

  @Get(':diagnosisId')
  @ApiOperation({ summary: 'Get diagnosis result' })
  @ApiParam({
    name: 'diagnosisId',
    example: 'diag_20260612_0001',
  })
  @ApiOkResponse({ type: GetDiagnosisResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async getDiagnosisById(
    @Param('diagnosisId') diagnosisId: string,
  ): Promise<GetDiagnosisResponseDto> {
    return this.diagnosisService.getDiagnosisById(diagnosisId);
  }

  @Get(':diagnosisId/evidences/:evidenceRef')
  @ApiOperation({ summary: 'Get evidence detail by reference' })
  @ApiParam({
    name: 'diagnosisId',
    example: 'diag_20260612_0001',
  })
  @ApiParam({
    name: 'evidenceRef',
    example: 'ev_formatter_output_fallback',
  })
  @ApiOkResponse({ type: GetEvidenceResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async getEvidenceDetail(
    @Param('diagnosisId') diagnosisId: string,
    @Param('evidenceRef') evidenceRef: string,
  ): Promise<GetEvidenceResponseDto> {
    return this.diagnosisService.getEvidenceDetail(diagnosisId, evidenceRef);
  }

  @Get(':diagnosisId/domino-chain')
  @ApiOperation({ summary: 'Get domino causality chain' })
  @ApiParam({
    name: 'diagnosisId',
    example: 'diag_20260612_0001',
  })
  @ApiOkResponse({ type: GetDominoChainResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async getDominoChain(
    @Param('diagnosisId') diagnosisId: string,
  ): Promise<GetDominoChainResponseDto> {
    return this.diagnosisService.getDominoChain(diagnosisId);
  }
}
```

---

# 5. Service 接口草案

你这一步问的是 DTO + Controller，但为了让 Controller 不悬空，我建议顺手把 Service 签名先定了。

---

## 5.1 diagnosis.service.ts

```ts
import { Injectable } from '@nestjs/common';
import {
  CreateDiagnosisDto,
  CreateDiagnosisResponseDto,
} from './dto/create-diagnosis.dto';
import { GetDiagnosisResponseDto } from './dto/diagnosis-result.dto';
import { GetEvidenceResponseDto } from './dto/evidence-detail.dto';
import { GetDominoChainResponseDto } from './dto/domino-chain.dto';

@Injectable()
export class DiagnosisService {
  async createDiagnosis(
    dto: CreateDiagnosisDto,
  ): Promise<CreateDiagnosisResponseDto> {
    return {
      code: 'ACCEPTED',
      message: 'diagnosis task accepted',
      data: {
        diagnosis_id: 'diag_mock_001',
        status: 'queued',
      },
    };
  }

  async getDiagnosisById(
    diagnosisId: string,
  ): Promise<GetDiagnosisResponseDto> {
    return {
      code: 'OK',
      message: 'success',
      data: {
        diagnosis_id: diagnosisId,
        mode: 'inspect_diagnosis' as any,
        status: 'completed' as any,
        diagnosis_state: 'confirmed_root_cause' as any,
        interaction_id: 'itr_mock_001',
        lineage_id: 'lin_mock_001',
        target: {
          page_url: '/orders/detail?id=A1001',
          target_dom_selector: '.order-amount',
          target_component: 'OrderAmount',
          displayed_value: '--',
          expected_binding: {
            api_field_path: 'response.data.amount',
            store_key: 'order.current.amount',
            selector_name: 'selectOrderAmount',
            formatter_name: 'formatCurrency',
          },
        },
        top_cause: {
          rule_code: 'R201',
          title: '合法 falsy 值被误判为空',
          diagnosis_label: '合法值被判空吞掉',
          category: 'render_transform' as any,
          severity: 'high' as any,
          confidence: 0.94,
          layer: 'render' as any,
          cluster: 'formatter_fallback',
          summary:
            '接口、store、selector 中金额值均为 0，但 formatter 将 0 误判为空。',
          evidence_refs: ['ev_api_amount_0', 'ev_formatter_output_fallback'],
          suggestions: ['将 if (!value) 改为 value == null'],
          rank_score: {
            rule_code: 'R201',
            base_score: 94,
            root_cause_score: 16,
            specificity_score: 20,
            evidence_score: 15,
            chain_consistency_score: 8,
            symptom_penalty: 0,
            duplicate_penalty: 4,
            final_score: 149,
          },
          rank_reasons: ['属于渲染层根因规则', '证据完整度高'],
        },
        supporting_causes: [],
        symptoms: [],
        summary: '最可能根因是「合法值被判空吞掉」：formatter 将 0 误判为空。',
        repair_hints: [
          '将金额格式化逻辑中的 if (!value) 替换为 value == null',
        ],
        score_breakdown: [
          {
            rule_code: 'R201',
            final_score: 149,
            reason: ['根因层级优先', '规则具体性最高', '证据链完整'],
          },
        ],
        evidence_overview: {
          api: {
            response_success: true,
            field_path: 'response.data.amount',
            field_exists: true,
            field_value: 0,
          },
          state: {
            store_key: 'order.current.amount',
            store_updated: true,
            store_value: 0,
          },
          render: {
            render_triggered: true,
            formatter_name: 'formatCurrency',
            render_input_value: 0,
            render_output_value: '--',
            formatter_output_is_fallback: true,
          },
          dom: {
            dom_updated: true,
            dom_visible: true,
            displayed_value: '--',
          },
        },
        domino_chain: [
          {
            step: 1,
            layer: 'api' as any,
            node_type: 'response_field',
            label: 'API.amount = 0',
            status: 'ok' as any,
            evidence_ref: 'ev_api_amount_0',
          },
          {
            step: 2,
            layer: 'render' as any,
            node_type: 'formatter',
            label: "formatCurrency(0) -> '--'",
            status: 'broken' as any,
            evidence_ref: 'ev_formatter_output_fallback',
            hit_rule_code: 'R201',
          },
        ],
        next_actions: [
          {
            action_type: 'inspect_evidence' as any,
            label: '查看 formatter 输入输出',
            target_ref: 'ev_formatter_output_fallback',
          },
        ],
        generated_at: new Date().toISOString(),
      },
    };
  }

  async getEvidenceDetail(
    diagnosisId: string,
    evidenceRef: string,
  ): Promise<GetEvidenceResponseDto> {
    return {
      code: 'OK',
      message: 'success',
      data: {
        evidence_ref: evidenceRef,
        evidence_type: 'render_trace' as any,
        title: 'Formatter output fallback snapshot',
        summary: `Evidence for diagnosis ${diagnosisId}`,
        payload: {
          formatter_name: 'formatCurrency',
          input: 0,
          output: '--',
        },
        created_at: new Date().toISOString(),
      },
    };
  }

  async getDominoChain(
    diagnosisId: string,
  ): Promise<GetDominoChainResponseDto> {
    return {
      code: 'OK',
      message: 'success',
      data: {
        diagnosis_id: diagnosisId,
        domino_chain: [
          {
            step: 1,
            layer: 'api' as any,
            node_type: 'response_field',
            label: 'API.amount = 0',
            status: 'ok' as any,
            evidence_ref: 'ev_api_amount_0',
          },
          {
            step: 2,
            layer: 'render' as any,
            node_type: 'formatter',
            label: "formatCurrency(0) -> '--'",
            status: 'broken' as any,
            evidence_ref: 'ev_formatter_output_fallback',
            hit_rule_code: 'R201',
          },
        ],
      },
    };
  }
}
```

---

# 6. Module 草案

---

## 6.1 diagnosis.module.ts

```ts
import { Module } from '@nestjs/common';
import { DiagnosisController } from './diagnosis.controller';
import { DiagnosisService } from './diagnosis.service';

@Module({
  controllers: [DiagnosisController],
  providers: [DiagnosisService],
  exports: [DiagnosisService],
})
export class DiagnosisModule {}
```

---

# 7. main.ts 中 Swagger 注册示例

如果你要让这套 DTO 立刻出 Swagger，需要在 `main.ts` 开启：

```ts
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('Diagnosis API')
    .setDescription('Frontend interaction and data-lineage diagnosis API')
    .setVersion('0.1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('/swagger', app, document);

  await app.listen(8080);
}

bootstrap();
```

---

# 8. 实现注意点

---

## 8.1 DTO 里 `string | number | boolean` 的 Swagger 表达
Nest Swagger 对 union type 支持不算特别优雅。  
MVP 阶段有两个选择：

### 方案 A：保持现在这样
代码更直观，但 Swagger 展示未必完美。

### 方案 B：统一用 `any` / `unknown` 表达动态值
如果你更看重 Swagger 稳定性，可以把这些字段改成：

```ts
@ApiPropertyOptional({ example: '--', nullable: true })
displayed_value?: any;
```

MVP 我其实更推荐 **方案 B**，更省心。

---

## 8.2 `as any` 只是占位
我在 service mock 里用了很多 `as any`，只是为了让草案更短。  
正式实现时应该用真实 enum：

```ts
mode: DiagnosisModeEnum.INSPECT
status: DiagnosisStatusEnum.COMPLETED
layer: LayerEnum.RENDER
```

---

## 8.3 建议增加 ValidationPipe
这样 DTO 校验才会生效：

```ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
);
```

---

## 8.4 后面可以补分页 / 查询参数
如果你接下来做历史记录页，可以继续加：

- `GET /api/v1/diagnosis?status=completed&mode=inspect_diagnosis`
- `GET /api/v1/diagnosis/{id}/evidences`

但 MVP 当前不急。

---

# 9. 一句话总结

这版 **NestJS DTO + Controller 草案** 已经把 Diagnosis API 的基础骨架搭起来了：

- `CreateDiagnosisDto`
- `GetDiagnosisResponseDto`
- `GetEvidenceResponseDto`
- `GetDominoChainResponseDto`
- `DiagnosisController`

它可以直接作为你下一步真正落代码的起点。

---

如果你愿意，我下一步可以继续直接补其中一个：

1. **Diagnosis Service TypeScript 完整代码骨架**
2. **Rule Engine + Diagnosis Service 在 NestJS 中的调用链**
3. **Jest 单测样例**
4. **Workbench 诊断结果卡片结构**
5. **domino_chain 前端可视化数据结构**

如果按工程顺序，我建议下一步直接做：  
**《Rule Engine + Diagnosis Service 在 NestJS 中的调用链》**。