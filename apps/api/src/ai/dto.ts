import { IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AiRecommendDto {
  @IsString() @MinLength(2) @MaxLength(2000) prompt!: string;
  @IsOptional() @IsObject() context?: Record<string, unknown>;
}
