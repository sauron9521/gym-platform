import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/infra/database/generated/prisma/client.js';
import { PasswordHasher } from '@nestjs/authentication';

/**
 * Only a disposable test database may ever receive these known fixture credentials.
 * Never reuse this script for a hosted staging or production database.
 */
const url = process.env.DATABASE_URL;
if (!url || url !== process.env.TEST_DATABASE_URL || process.env.NODE_ENV !== 'test') {
  throw new Error(
    'Admin browser seed requires matching disposable TEST_DATABASE_URL and NODE_ENV=test',
  );
}
const target = new URL(url);
const local = ['127.0.0.1', 'localhost'].includes(target.hostname);
const ci = process.env.CI === 'true' && target.hostname === 'postgres' && target.port === '5432';
if (
  target.pathname !== '/gym_admin_browser_test' ||
  (!local && !ci) ||
  target.protocol !== 'postgresql:'
) {
  throw new Error('Refusing to seed a non-disposable Admin browser test database');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
const passwordHash = await new PasswordHasher().hash('AdminBrowserOnly123!');
try {
  await prisma.user.upsert({
    where: { id: '00000000-0000-4000-8000-000000000099' },
    create: {
      id: '00000000-0000-4000-8000-000000000099',
      email: 'admin-browser-fixture@example.test',
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerified: true,
    },
    update: {
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerified: true,
      deletedAt: null,
    },
  });
  // No ID, tokens, credentials or DB URL in logs.
  process.stdout.write('Disposable Admin browser account seeded.\n');
} finally {
  await prisma.$disconnect();
}
