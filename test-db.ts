import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function test() {
  try {
    const count = await prisma.user.count();
    console.log("Connection success, user count:", count);
  } catch (e: any) {
    console.error("Connection failed:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}
test();
