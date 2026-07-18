import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { config as loadEnv } from 'dotenv';

// Load the same env files the app uses, so DATABASE_URL / seed vars resolve.
const nodeEnv = process.env.NODE_ENV ?? 'development';
loadEnv({ path: `.env.${nodeEnv}` });
loadEnv({ path: '.env' });

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      firstName: 'Root',
      lastName: 'Admin',
      role: UserRole.ADMIN,
      isEmailVerified: true,
      admin: { create: {} },
    },
    include: { admin: true },
  });

  console.log(`Seeded admin user: ${user.email} (id: ${user.id})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
