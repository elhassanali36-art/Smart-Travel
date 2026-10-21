import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

// Serializable transaction with bounded retry on write conflicts (Prisma error P2034).
// Used wherever a read-then-write decision must not interleave with another request
// (booking capacity, last-administrator protection).
export async function runSerializable<T>(db: PrismaService, fn: (tx: Prisma.TransactionClient) => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await db.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (e) {
      if ((e as { code?: string }).code === 'P2034') {
        if (i < attempts) continue;
        throw new ConflictException('The operation conflicted with another request. Please retry.');
      }
      throw e;
    }
  }
}
