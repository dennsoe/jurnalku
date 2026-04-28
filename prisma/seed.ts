// prisma/seed.ts
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash("admin123", 10);
  const studentPassword = await bcrypt.hash("smk123", 10);

  // Upsert Admin
  await prisma.user.upsert({
    where: { nis: "admin" },
    update: {},
    create: {
      nis: "admin",
      name: "Super Admin JurnalKu",
      password: adminPassword,
      role: "ADMIN",
    },
  });

  // Upsert Student
  await prisma.user.upsert({
    where: { nis: "2024001" },
    update: {},
    create: {
      nis: "2024001",
      name: "Andi Santoso",
      password: studentPassword,
      role: "STUDENT",
    },
  });

  console.log("Seed successful: Admin (admin/admin123) & Student (2024001/smk123) created.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
