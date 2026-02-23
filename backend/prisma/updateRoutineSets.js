import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.routineExercise.updateMany({
    data: { sets: 2, reps: 6, repsMax: 9 },
  });
  console.log(`✅ ${result.count} exercícios de rotina atualizados para 2x6-9`);
}

main().finally(() => prisma.$disconnect());
