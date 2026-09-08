import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@kanto-planner.local";
  const username = process.env.ADMIN_USERNAME ?? "admin";
  const password = process.env.ADMIN_PASSWORD ?? "admin";

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      username,
      passwordHash,
      name: "Kanto",
    },
  });

  await prisma.userStats.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });

  console.log(`Seeded user "${username}" <${email}>.`);
  if (password === "admin") {
    console.warn(
      "WARNING: using default password 'admin'. Change ADMIN_PASSWORD before deploying to the VPS.",
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
