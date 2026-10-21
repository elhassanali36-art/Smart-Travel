import { httpFromPrismaCode } from './prisma-errors';
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpErrorFilter');

  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    if (error instanceof HttpException) {
      const status = error.getStatus();
      res.status(status).json({ statusCode: status, error: error.getResponse() });
      return;
    }
    // Unexpected error: never leak details to the client, but do not swallow it silently either.
    // Prisma error messages can embed query arguments (e.g. password hashes), so for those only the
    // class name and error code are logged.
    const name = error instanceof Error ? error.name : 'UnknownError';
    const mapped = name.startsWith('PrismaClient') ? httpFromPrismaCode((error as { code?: string }).code) : null;
    if (mapped) {
      this.logger.warn(`${name} code=${(error as { code?: string }).code}`);
      res.status(mapped.status).json({ statusCode: mapped.status, error: { message: mapped.message } });
      return;
    }
    if (error instanceof Error && !name.startsWith('PrismaClient')) {
      this.logger.error(`${name}: ${error.message}`, error.stack);
    } else {
      this.logger.error(`${name} code=${(error as { code?: string })?.code ?? 'n/a'}`);
    }
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ statusCode: 500, error: { message: 'Internal server error' } });
  }
}
