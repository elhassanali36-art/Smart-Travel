import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { PrismaService } from './common/prisma.service';
import { FakeDb } from './testing/fake-db';

process.env.JWT_SECRET = 'k'.repeat(48);
process.env.NODE_ENV = 'test';

// Real Nest DI: every module, controller, guard and provider must resolve. Needs real packages and a generated Prisma client.
describe('AppModule wiring', () => {
  it('compiles and resolves all providers with the database replaced by a fake', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(PrismaService).useValue(new FakeDb()).compile();
    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });
});
