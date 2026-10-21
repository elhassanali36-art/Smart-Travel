import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateReportDto {
  @IsOptional() @IsUUID() subjectUserId?: string;
  @IsString() @MinLength(2) @MaxLength(120) reason!: string;
  @IsOptional() @IsString() @MaxLength(4000) details?: string;
}
