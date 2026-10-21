import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';

const cleanList = ({ value }: { value: unknown }) =>
  Array.isArray(value) ? [...new Set(value.map((x) => (typeof x === 'string' ? x.trim() : x)).filter((x) => x !== ''))] : value;
const compose = (...d: PropertyDecorator[]): PropertyDecorator => (t, k) => d.forEach((x) => x(t, k));
const list = (max: number, itemMax: number) => compose(Transform(cleanList), IsArray(), ArrayMaxSize(max), IsString({ each: true }), MaxLength(itemMax, { each: true }));

export class ExperienceDto {
  @IsString() @MinLength(2) @MaxLength(150) titleEn!: string;
  @IsString() @MinLength(2) @MaxLength(150) titleAr!: string;
  @IsString() @MinLength(2) @MaxLength(5000) descriptionEn!: string;
  @IsString() @MinLength(2) @MaxLength(5000) descriptionAr!: string;
  @IsString() @MinLength(2) @MaxLength(50) category!: string;
  @IsInt() @Min(0) @Max(10_000_000) priceCents!: number;
  @IsInt() @Min(15) @Max(10_080) durationMinutes!: number;
  @IsInt() @Min(1) @Max(1000) capacity!: number;
  @list(10, 10) languages!: string[];
  @list(20, 50) tags!: string[];
  @IsUUID() destinationId!: string;
}

export class UpdateExperienceDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(150) titleEn?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(150) titleAr?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(5000) descriptionEn?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(5000) descriptionAr?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(50) category?: string;
  @IsOptional() @IsInt() @Min(0) @Max(10_000_000) priceCents?: number;
  @IsOptional() @IsInt() @Min(15) @Max(10_080) durationMinutes?: number;
  @IsOptional() @IsInt() @Min(1) @Max(1000) capacity?: number;
  @IsOptional() @list(10, 10) languages?: string[];
  @IsOptional() @list(20, 50) tags?: string[];
  @IsOptional() @IsBoolean() active?: boolean;
}
