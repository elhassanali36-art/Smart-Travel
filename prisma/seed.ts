import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../apps/api/src/auth/password';

const db = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed demo accounts when NODE_ENV=production');
  const demoPassword = process.env.SEED_DEMO_PASSWORD;
  if (!demoPassword || demoPassword.length < 16 || demoPassword.includes('replace-with')) throw new Error('SEED_DEMO_PASSWORD must be a real development secret of at least 16 characters');

  const admin = await db.user.upsert({
    where: { email: 'admin@smarttravel.local' },
    update: { role: 'ADMIN', status: 'ACTIVE' },
    create: { name: 'Smart Travel Admin', email: 'admin@smarttravel.local', passwordHash: await hashPassword(demoPassword), role: 'ADMIN' },
  });

  const host = await db.user.upsert({
    where: { email: 'host@smarttravel.local' },
    update: { role: 'LOCAL_HOST', status: 'ACTIVE' },
    create: { name: 'Nile Local Host', email: 'host@smarttravel.local', passwordHash: await hashPassword(demoPassword), role: 'LOCAL_HOST' },
  });

  const hostProfile = await db.hostProfile.upsert({
    where: { userId: host.id },
    update: { verification: 'VERIFIED' },
    create: { userId: host.id, bio: 'Verified local host', city: 'Khartoum', country: 'Sudan', languages: ['ar', 'en'], expertise: ['culture', 'food'], categories: ['local-life'], verification: 'VERIFIED', completion: 100 },
  });

  const destination = await db.destination.upsert({
    where: { slug: 'khartoum' },
    update: {},
    create: { slug: 'khartoum', nameEn: 'Khartoum', nameAr: 'الخرطوم', countryEn: 'Sudan', countryAr: 'السودان', descriptionEn: 'A meeting point of the Blue and White Nile.', descriptionAr: 'ملتقى النيلين الأزرق والأبيض.', tags: ['culture', 'river', 'history'] },
  });

  const existingExperience = await db.experience.findFirst({ where: { hostProfileId: hostProfile.id, destinationId: destination.id, titleEn: 'Khartoum Local Life Walk' }, select: { id: true } });
  if (!existingExperience) {
    await db.experience.create({
      data: { hostProfileId: hostProfile.id, destinationId: destination.id, titleEn: 'Khartoum Local Life Walk', titleAr: 'جولة الحياة المحلية في الخرطوم', descriptionEn: 'A guided local culture experience.', descriptionAr: 'تجربة ثقافية محلية بصحبة مرشد.', category: 'culture', priceCents: 2500, durationMinutes: 180, capacity: 6, languages: ['ar', 'en'], tags: ['culture', 'food'] },
    });
  }

  console.log(`Seeded demo users: ${admin.email}, ${host.email}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
