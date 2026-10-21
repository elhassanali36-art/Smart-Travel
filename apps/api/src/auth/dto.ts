import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsPhoneNumber, IsString, MaxLength, MinLength } from 'class-validator';

// Browsers submit blank inputs as ''. Treat blank as "not provided" so optional fields do not fail validation.
const blankToUndefined = ({ value }: { value: unknown }) => (typeof value === 'string' && value.trim() === '' ? undefined : value);

export class RegisterDto {
  @IsString() @MinLength(2) @MaxLength(100) name!: string;
  @Transform(blankToUndefined) @IsOptional() @IsEmail() @MaxLength(254) email?: string;
  @Transform(blankToUndefined) @IsOptional() @IsPhoneNumber() @MaxLength(32) phone?: string;
  // Upper bound prevents using scrypt as a CPU/memory amplifier.
  @IsString() @MinLength(8) @MaxLength(128) password!: string;
}

export class LoginDto {
  @Transform(blankToUndefined) @IsOptional() @IsEmail() @MaxLength(254) email?: string;
  @Transform(blankToUndefined) @IsOptional() @IsPhoneNumber() @MaxLength(32) phone?: string;
  @IsString() @MaxLength(128) password!: string;
}
