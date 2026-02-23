import { PrismaClient } from "@prisma/client";

const base = new PrismaClient();

// Reconecta automaticamente quando o Neon fecha a conexão por inatividade (P1017)
const prisma = base.$extends({
  query: {
    $allModels: {
      async $allOperations({ args, query }) {
        try {
          return await query(args);
        } catch (e) {
          if (e?.code === "P1017") {
            await base.$disconnect();
            await base.$connect();
            return await query(args);
          }
          throw e;
        }
      },
    },
  },
});

export default prisma;
