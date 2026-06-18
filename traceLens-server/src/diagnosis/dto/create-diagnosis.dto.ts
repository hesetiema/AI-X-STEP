import { IsString, IsOptional, IsArray, ValidateNested, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class EvidenceItemDto {
  @IsString()
  id: string;

  @IsString()
  type: string;

  @IsString()
  label: string;

  @IsOptional()
  value?: Record<string, unknown>;

  @IsString()
  source: string;

  @IsOptional()
  timestamp?: string;
}

export class CreateDiagnosisDto {
  @IsString()
  appId: string;

  @IsString()
  pageUrl: string;

  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EvidenceItemDto)
  evidence: EvidenceItemDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  symptoms?: string[];
}
