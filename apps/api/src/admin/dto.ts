import { IsEnum } from 'class-validator';
import { ReportStatus, Role, UserStatus, VerificationStatus } from '@prisma/client';

export class UserStatusDto { @IsEnum(UserStatus) status!: UserStatus; }
export class UserRoleDto { @IsEnum(Role) role!: Role; }
export class HostVerificationDto { @IsEnum(VerificationStatus) verification!: VerificationStatus; }
export class ReportStatusDto { @IsEnum(ReportStatus) status!: ReportStatus; }
