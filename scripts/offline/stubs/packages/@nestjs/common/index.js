// Offline test stub of @nestjs/common: decorators are no-ops, exceptions carry status like the real ones.
const noop = () => () => undefined;
class HttpException extends Error {
  constructor(response, status) { super(typeof response === 'string' ? response : response?.message ?? 'HttpException'); this.response = response; this.status = status; this.name = this.constructor.name; }
  getStatus() { return this.status; }
  getResponse() { return typeof this.response === 'string' ? { message: this.response, statusCode: this.status } : this.response; }
}
const mk = (name, status) => ({ [name]: class extends HttpException { constructor(m) { super(m ?? name, status); } } })[name];
module.exports = {
  HttpException, HttpStatus: { TOO_MANY_REQUESTS: 429, INTERNAL_SERVER_ERROR: 500 },
  BadRequestException: mk('BadRequestException', 400), UnauthorizedException: mk('UnauthorizedException', 401),
  ForbiddenException: mk('ForbiddenException', 403), NotFoundException: mk('NotFoundException', 404), ConflictException: mk('ConflictException', 409),
  Injectable: noop, Inject: noop, Controller: noop, Get: noop, Post: noop, Put: noop, Patch: noop, Delete: noop, Body: noop, Param: noop, Query: noop, Req: noop, Res: noop,
  Global: noop, Module: noop, Catch: noop, UseGuards: noop, SetMetadata: () => () => undefined,
  Logger: class { warn() {} error() {} log() {} },
  ParseUUIDPipe: class {}, ParseIntPipe: class {}, ParseEnumPipe: class {}, DefaultValuePipe: class {},
};
