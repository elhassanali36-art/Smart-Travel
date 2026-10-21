import { IsDateString, IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class TripDto {
  @IsString() @MinLength(1) @MaxLength(120) title!: string;
  @IsOptional() @IsUUID() destinationId?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsObject() preferences?: Record<string, unknown>;
}

export class UpdateTripDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) title?: string;
  @IsOptional() @IsUUID() destinationId?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsObject() preferences?: Record<string, unknown>;
}
