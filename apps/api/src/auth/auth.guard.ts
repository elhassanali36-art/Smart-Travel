import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role, UserStatus } from '@prisma/client';
import { AuthService } from './auth.service';

export const Public = () => SetMetadata('public', true);
export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);

// Identity attached to the request by AuthGuard. Loaded from the database on every request and
// deliberately excludes passwordHash and every other security field.
export interface SafeUser {
  id: string;
  name: string;
  role: Role;
  status: UserStatus;
}
export interface AuthedRequest {
  user: SafeUser;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService, private readonly reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>('public', [ctx.getHandler(), ctx.getClass()])) return true;

    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException();

    const user = await this.auth.verifyAccess(header.slice(7));
    const roles = this.reflector.getAllAndOverride<Role[]>('roles', [ctx.getHandler(), ctx.getClass()]);
    if (roles?.length && !roles.includes(user.role)) throw new ForbiddenException('Insufficient role');

    req.user = user;
    return true;
  }
}
