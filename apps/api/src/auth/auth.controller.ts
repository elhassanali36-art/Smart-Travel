import { Body, Controller, ForbiddenException, Get, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Request, Response } from 'express';
import { ConfigService } from '../common/config.service';
import { isTrustedOrigin, parseCookies, REFRESH_COOKIE, REFRESH_COOKIE_PATH, refreshCookieOptions, SameSite } from '../common/cookies';
import { RateLimit } from '../common/rate-limit.guard';
import { AuthedRequest, Public, Roles } from './auth.guard';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto';

// Token transport: the short-lived access token is returned in the JSON body (the web client keeps it in
// memory only). The refresh token is NEVER returned in the body: it travels in an HttpOnly cookie that is
// scoped to /api/v1/auth, so page scripts cannot read it and other API routes never receive it.
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly config: ConfigService) {}

  private setRefreshCookie(res: Response, raw: string) {
    res.cookie(REFRESH_COOKIE, raw, refreshCookieOptions({ secure: this.config.cookieSecure, sameSite: this.config.cookieSameSite as SameSite, maxAgeMs: this.config.refreshDays * 86400000 }));
  }

  private clearRefreshCookie(res: Response) {
    res.clearCookie(REFRESH_COOKIE, { httpOnly: true, secure: this.config.cookieSecure, sameSite: this.config.cookieSameSite as SameSite, path: REFRESH_COOKIE_PATH });
  }

  // CSRF defence for the two cookie-authenticated endpoints (in addition to SameSite).
  private assertTrustedOrigin(req: Request) {
    if (!isTrustedOrigin(req.headers.origin, this.config.webOrigin)) throw new ForbiddenException('Untrusted origin');
  }

  @Public() @RateLimit(10, 60) @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const t = await this.auth.register(dto);
    this.setRefreshCookie(res, t.refreshToken);
    return { accessToken: t.accessToken, expiresIn: t.expiresIn };
  }

  @Public() @RateLimit(10, 60) @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const t = await this.auth.login(dto);
    this.setRefreshCookie(res, t.refreshToken);
    return { accessToken: t.accessToken, expiresIn: t.expiresIn };
  }

  @Public() @RateLimit(30, 60) @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.assertTrustedOrigin(req);
    const raw = parseCookies(req.headers.cookie)[REFRESH_COOKIE];
    if (!raw) throw new UnauthorizedException('No session');
    try {
      const t = await this.auth.rotate(raw);
      this.setRefreshCookie(res, t.refreshToken);
      return { accessToken: t.accessToken, expiresIn: t.expiresIn };
    } catch (e) {
      this.clearRefreshCookie(res); // a rejected cookie is useless; drop it
      throw e;
    }
  }

  // Public on purpose: the cookie is the credential, so logout works after the access token expired.
  @Public() @RateLimit(30, 60) @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.assertTrustedOrigin(req);
    const raw = parseCookies(req.headers.cookie)[REFRESH_COOKIE];
    if (raw) await this.auth.logout(raw);
    this.clearRefreshCookie(res);
    return { success: true };
  }

  @Get('me')
  me(@Req() req: AuthedRequest) {
    return this.auth.me(req.user.id);
  }

  @Roles(Role.ADMIN) @Get('admin-check')
  adminCheck() {
    return { ok: true, role: 'ADMIN' };
  }
}
