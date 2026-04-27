/* eslint-disable @typescript-eslint/no-require-exports */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

async function main() {
  const prisma = new PrismaClient();
  const email = 'demo@harvest.app';
  const password = 'demo123';
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      firstName: 'Demo',
      lastName: 'User',
      passwordHash,
      invitationStatus: 'ACTIVE',
      invitationAcceptedAt: new Date(),
    },
    update: { passwordHash, firstName: 'Demo', lastName: 'User' },
  });

  let org = await prisma.organization.findFirst();
  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: 'Demo Organization',
        defaultCurrency: 'USD',
      },
    });
  }

  await prisma.userOrganization.upsert({
    where: {
      userId_organizationId: { userId: user.id, organizationId: org.id },
    },
    create: {
      userId: user.id,
      organizationId: org.id,
      systemRole: 'ADMINISTRATOR',
      status: 'ACTIVE',
    },
    /** 演示账号始终为组织管理员（重跑 seed 会纠正历史 MEMBER 等角色） */
    update: { status: 'ACTIVE', systemRole: 'ADMINISTRATOR' },
  });

  // eslint-disable-next-line no-console
  console.log('Seed OK:', email, '/', password, '| org:', org.name, org.id);
  await prisma.$disconnect();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
