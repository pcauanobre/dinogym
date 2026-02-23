import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { createDefaultRoutine } from "../src/utils/defaultRoutine.js";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, name: true, email: true } });
  console.log(`\nProcessando ${users.length} usuário(s)...\n`);

  for (const user of users) {
    const existing = await prisma.routineDay.count({ where: { userId: user.id } });
    if (existing > 0) {
      console.log(`  ⏭  ${user.name} (${user.email || user.id}) — já tem rotina (${existing} dia(s)), pulando`);
      continue;
    }
    await createDefaultRoutine(user.id, prisma);
    const created = await prisma.routineDay.count({ where: { userId: user.id } });
    console.log(`  ✅ ${user.name} (${user.email || user.id}) — rotina criada (${created} dia(s))`);
  }

  console.log("\n✅ Concluído!");
}

main().finally(() => prisma.$disconnect());
