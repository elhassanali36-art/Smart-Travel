import { httpFromPrismaCode } from './prisma-errors';

describe('httpFromPrismaCode', () => {
  it('maps client-caused Prisma errors to 4xx', () => {
    expect(httpFromPrismaCode('P2002')).toMatchObject({ status: 409 });
    expect(httpFromPrismaCode('P2025')).toMatchObject({ status: 404 });
    expect(httpFromPrismaCode('P2003')).toMatchObject({ status: 409 });
    expect(httpFromPrismaCode('P2023')).toMatchObject({ status: 400 });
    expect(httpFromPrismaCode('P2034')).toMatchObject({ status: 409 });
  });
  it('leaves everything else as a server error (null) and never echoes details', () => {
    expect(httpFromPrismaCode('P1001')).toBeNull();
    expect(httpFromPrismaCode(undefined)).toBeNull();
    expect(JSON.stringify(httpFromPrismaCode('P2002'))).not.toContain('P2002');
  });
});
