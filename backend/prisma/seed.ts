import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@oaisdoaraguaia.com.br';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123';

  const passwordHash = await argon2.hash(adminPassword, { type: argon2.argon2id });

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: 'Administrador',
      email: adminEmail,
      passwordHash,
      role: 'ADMIN',
    },
  });

  for (let number = 1; number <= 11; number++) {
    await prisma.chalet.upsert({
      where: { number },
      update: {},
      create: { number, name: `Chalé ${String(number).padStart(2, '0')}` },
    });
  }

  console.log(`Seed concluído: admin (${adminEmail}) e 11 chalés.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
