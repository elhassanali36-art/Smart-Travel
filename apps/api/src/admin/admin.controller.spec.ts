import 'reflect-metadata';
import { AdminController } from './admin.controller';
import { BookingsController } from '../bookings/bookings.controller';
import { AuthController } from '../auth/auth.controller';
import { AnalyticsController } from '../analytics/analytics.controller';

// Needs real @nestjs/common (SetMetadata stores the metadata that AuthGuard reads). Not runnable with the offline stubs.
const roles = (target: object) => Reflect.getMetadata('roles', target);
const isPublic = (target: object) => Reflect.getMetadata('public', target);
const proto = (c: { prototype: object }) => c.prototype as unknown as Record<string, object>;

describe('administrator authorization metadata', () => {
  it('the whole admin and analytics controllers require ADMIN and expose no public handler', () => {
    expect(roles(AdminController)).toEqual(['ADMIN']);
    expect(roles(AnalyticsController)).toEqual(['ADMIN']);
    for (const name of Object.getOwnPropertyNames(AdminController.prototype).filter((n) => n !== 'constructor')) expect(isPublic(proto(AdminController)[name])).toBeUndefined();
  });
  it('dispute tooling on the bookings controller is ADMIN-only', () => {
    for (const h of ['disputes', 'expireOverdue', 'resolve']) expect(roles(proto(BookingsController)[h])).toEqual(['ADMIN']);
    for (const h of ['list', 'create', 'status', 'dispute']) expect(roles(proto(BookingsController)[h])).toBeUndefined();
  });
  it('only register, login, refresh and logout are public in the auth controller', () => {
    for (const h of ['register', 'login', 'refresh', 'logout']) expect(isPublic(proto(AuthController)[h])).toBe(true);
    for (const h of ['me', 'adminCheck']) expect(isPublic(proto(AuthController)[h])).toBeUndefined();
    expect(roles(proto(AuthController).adminCheck)).toEqual(['ADMIN']);
  });
});
