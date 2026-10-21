import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min } from 'class-validator';

// Trim items, drop blanks and duplicates.
const cleanList = ({ value }: { value: unknown }) =>
  Array.isArray(value) ? [...new Set(value.map((x) => (typeof x === 'string' ? x.trim() : x)).filter((x) => x !== ''))] : value;
const list = () => [Transform(cleanList), IsArray(), ArrayMaxSize(20), IsString({ each: true }), MaxLength(50, { each: true })];
const compose = (...d: PropertyDecorator[]): PropertyDecorator => (t, k) => d.forEach((x) => x(t, k));

export class TravelerProfileDto {
  @IsOptional() @IsString() @MaxLength(1000) bio?: string | null;
  @IsOptional() @IsUrl({ protocols: ['https'], require_protocol: true }) @MaxLength(2048) photoUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(100) country?: string | null;
  @IsOptional() @compose(...list()) languages?: string[];
  @IsOptional() @compose(...list()) interests?: string[];
  @IsOptional() @compose(...list()) travelStyles?: string[];
  @IsOptional() @IsInt() @Min(1) @Max(5) budgetLevel?: number | null;
  @IsOptional() @compose(...list()) preferredDestinations?: string[];
  @IsOptional() @compose(...list()) accessibilityNeeds?: string[];
}

export class HostProfileDto {
  @IsOptional() @IsString() @MaxLength(1000) bio?: string | null;
  @IsOptional() @IsUrl({ protocols: ['https'], require_protocol: true }) @MaxLength(2048) photoUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(100) city?: string | null;
  @IsOptional() @IsString() @MaxLength(100) country?: string | null;
  @IsOptional() @compose(...list()) languages?: string[];
  @IsOptional() @compose(...list()) expertise?: string[];
  @IsOptional() @compose(...list()) categories?: string[];
  @IsOptional() @IsString() @MaxLength(500) availabilityNote?: string | null;
}
