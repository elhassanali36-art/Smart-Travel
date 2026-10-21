import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';

export class BookingDto {
  @IsUUID() experienceId!: string;
  @IsOptional() @IsUUID() tripId?: string;
  // ISO-8601 start of the session. The end is computed from the experience duration.
  @IsDateString() startsAt!: string;
  @IsInt() @Min(1) @Max(100) guests!: number;
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
}

export class DisputeDto {
  @IsString() @MinLength(10) @MaxLength(2000) reason!: string;
}

export class ResolveDisputeDto {
  @IsIn(['COMPLETED', 'CANCELLED']) outcome!: 'COMPLETED' | 'CANCELLED';
  @IsString() @MinLength(2) @MaxLength(2000) note!: string;
}
