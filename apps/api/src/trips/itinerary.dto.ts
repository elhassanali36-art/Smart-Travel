import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';

export class ItineraryItemDto {
  @IsInt() @Min(1) @Max(366) dayNumber!: number;
  @IsOptional() @IsInt() @Min(0) @Max(10000) sortOrder?: number;
  @IsString() @MinLength(1) @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(200) location?: string;
  @IsOptional() @IsDateString() startTime?: string;
  @IsOptional() @IsDateString() endTime?: string;
  @IsOptional() @IsUUID() experienceId?: string;
}
