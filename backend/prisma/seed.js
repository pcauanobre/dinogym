import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_EXERCISES } from "../src/utils/defaultExercises.js";

const prisma = new PrismaClient();

const ADMIN_PR_OVERRIDES = {
  "Remada T Bar":          75,
  "Remada Alta":           55,
  "Puxador Frontal":       70,
  "Posterior de Ombro":    20,
  "Bíceps Scott Alta":     30,
  "Supino Inclinado":      60,
  "Voador Máquina":        50,
  "Frontal Ombro":         20,
  "Lateral Ombro":         15,
  "Tríceps Barra W":       35,
  "Extensora":             55,
  "Agachamento Hack":      100,
  "Cadeira Flexora":       55,
  "Flexora em Pé":         40,
  "Adutora":               65,
  "Panturrilha Sentado":   60,
  "Supino Pegada Neutra":  60,
  "Abdutora":              65,
  "Panturrilha em Pé":     70,
};

// dayOfWeek: 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb
const ROUTINE = {
  1: { label: "Pull", exercises: [
    ["Remada T Bar",       3, 6, 9],
    ["Remada Alta",        3, 6, 9],
    ["Puxador Frontal",    3, 6, 9],
    ["Posterior de Ombro", 3, 6, 9],
    ["Bíceps Scott Alta",  3, 6, 9],
  ]},
  2: { label: "Push", exercises: [
    ["Supino Inclinado",  3, 6, 9],
    ["Voador Máquina",    3, 6, 9],
    ["Frontal Ombro",     3, 6, 9],
    ["Lateral Ombro",     3, 6, 9],
    ["Tríceps Barra W",   3, 6, 9],
  ]},
  3: { label: "Leg 1", exercises: [
    ["Extensora",           3, 6, 9],
    ["Agachamento Hack",    3, 6, 9],
    ["Cadeira Flexora",     3, 6, 9],
    ["Flexora em Pé",       3, 6, 9],
    ["Adutora",             3, 6, 9],
    ["Panturrilha Sentado", 3, 6, 9],
  ]},
  // Quinta (4) = Descanso
  5: { label: "Upper", exercises: [
    ["Supino Pegada Neutra", 3, 6, 9],
    ["Remada T Bar",         3, 6, 9],
    ["Lateral Ombro",        3, 6, 9],
    ["Frontal Ombro",        3, 6, 9],
    ["Bíceps Scott Alta",    3, 6, 9],
    ["Tríceps Barra W",      3, 6, 9],
  ]},
  6: { label: "Leg 2", exercises: [
    ["Extensora",          3, 6, 9],
    ["Agachamento Hack",   3, 6, 9],
    ["Cadeira Flexora",    3, 6, 9],
    ["Flexora em Pé",      3, 6, 9],
    ["Abdutora",           3, 6, 9],
    ["Panturrilha em Pé",  3, 6, 9],
  ]},
};

// exercises: [machineName, sets, reps, weight, hitPR, previousPR]
// Today = Feb 22, 2026 (Sun/rest). Treinos de Fev: Seg/Ter/Qua/Sex/Sáb.
// Calendar: Feb 2(Mon)=Pull, 3(Tue)=Push, 4(Wed)=Leg1, 6(Fri)=Upper, 7(Sat)=Leg2
//           Feb 9=Pull, 10=Push, 11=Leg1, 13=Upper, 14=Leg2
//           Feb 16=Pull, 17=Push, 18=Leg1, 20=Upper, 21=Leg2
const SESSION_DATA = [

  // ══════════════ SEMANA 1 (Feb 2–7) ══════════════

  {
    daysAgo: 20, dayRating: 3, nutrition: 3, duration: 3060, // Seg 02/02 – Pull
    exercises: [
      ["Remada T Bar",       3, 10, 65,  false, null],
      ["Remada Alta",        3, 10, 50,  false, null],
      ["Puxador Frontal",    3, 10, 62,  false, null],
      ["Posterior de Ombro", 3, 12, 15,  false, null],
      ["Bíceps Scott Alta",  3, 10, 22,  false, null],
    ],
  },
  {
    daysAgo: 19, dayRating: 2, nutrition: 2, duration: 2700, // Ter 03/02 – Push
    exercises: [
      ["Supino Inclinado",  3, 10, 52,  false, null],
      ["Voador Máquina",    3, 12, 44,  false, null],
      ["Frontal Ombro",     3, 12, 15,  false, null],
      ["Lateral Ombro",     3, 12, 10,  false, null],
      ["Tríceps Barra W",   3, 12, 28,  false, null],
    ],
  },
  {
    daysAgo: 18, dayRating: 3, nutrition: 3, duration: 3840, // Qua 04/02 – Leg 1
    exercises: [
      ["Extensora",           3, 12, 48,  false, null],
      ["Agachamento Hack",    3, 10, 88,  false, null],
      ["Cadeira Flexora",     3, 12, 48,  false, null],
      ["Flexora em Pé",       3, 12, 33,  false, null],
      ["Adutora",             3, 12, 58,  false, null],
      ["Panturrilha Sentado", 3, 15, 52,  false, null],
    ],
  },
  {
    daysAgo: 16, dayRating: 2, nutrition: 2, duration: 3540, // Sex 06/02 – Upper
    exercises: [
      ["Supino Pegada Neutra", 3, 10, 52,  false, null],
      ["Remada T Bar",         3, 10, 65,  false, null],
      ["Lateral Ombro",        3, 12, 10,  false, null],
      ["Frontal Ombro",        3, 12, 15,  false, null],
      ["Bíceps Scott Alta",    3, 10, 22,  false, null],
      ["Tríceps Barra W",      3, 12, 28,  false, null],
    ],
  },
  {
    daysAgo: 15, dayRating: 3, nutrition: 3, duration: 3960, // Sáb 07/02 – Leg 2
    exercises: [
      ["Extensora",          3, 12, 48,  false, null],
      ["Agachamento Hack",   3, 10, 88,  false, null],
      ["Cadeira Flexora",    3, 12, 48,  false, null],
      ["Flexora em Pé",      3, 12, 33,  false, null],
      ["Abdutora",           3, 12, 58,  false, null],
      ["Panturrilha em Pé",  3, 15, 62,  false, null],
    ],
  },

  // ══════════════ SEMANA 2 (Feb 9–14) ══════════════

  {
    daysAgo: 13, dayRating: 3, nutrition: 3, duration: 3180, // Seg 09/02 – Pull
    exercises: [
      ["Remada T Bar",       3, 10, 68,  true,  65],  // PR 65→68
      ["Remada Alta",        3, 10, 52,  true,  50],  // PR 50→52
      ["Puxador Frontal",    3, 10, 65,  true,  62],  // PR 62→65
      ["Posterior de Ombro", 3, 12, 17,  true,  15],  // PR 15→17
      ["Bíceps Scott Alta",  3, 10, 25,  true,  22],  // PR 22→25
    ],
  },
  {
    daysAgo: 12, dayRating: 1, nutrition: 1, duration: 2400, // Ter 10/02 – Push (dia ruim)
    exercises: [
      ["Supino Inclinado",  3,  8, 50,  false, 52],   // regrediu
      ["Voador Máquina",    3, 10, 44,  false, 44],
      ["Frontal Ombro",     3, 12, 15,  false, 15],
      ["Lateral Ombro",     3, 12, 10,  false, 10],
      ["Tríceps Barra W",   3, 10, 30,  true,  28],   // PR 28→30
    ],
  },
  {
    daysAgo: 11, dayRating: 3, nutrition: 2, duration: 4200, // Qua 11/02 – Leg 1
    exercises: [
      ["Extensora",           3, 12, 50,  true,  48],  // PR 48→50
      ["Agachamento Hack",    3, 10, 92,  true,  88],  // PR 88→92
      ["Cadeira Flexora",     3, 12, 50,  true,  48],  // PR 48→50
      ["Flexora em Pé",       3, 12, 36,  true,  33],  // PR 33→36
      ["Adutora",             3, 12, 60,  true,  58],  // PR 58→60
      ["Panturrilha Sentado", 3, 15, 55,  true,  52],  // PR 52→55
    ],
  },
  {
    daysAgo: 9, dayRating: 3, nutrition: 3, duration: 3720, // Sex 13/02 – Upper
    exercises: [
      ["Supino Pegada Neutra", 3, 10, 55,  true,  52],  // PR 52→55
      ["Remada T Bar",         3, 10, 68,  false, 68],
      ["Lateral Ombro",        3, 12, 12,  true,  10],  // PR 10→12
      ["Frontal Ombro",        3, 12, 17,  true,  15],  // PR 15→17
      ["Bíceps Scott Alta",    3, 10, 25,  false, 25],
      ["Tríceps Barra W",      3, 12, 30,  false, 30],
    ],
  },
  {
    daysAgo: 8, dayRating: 2, nutrition: 2, duration: 3600, // Sáb 14/02 – Leg 2
    exercises: [
      ["Extensora",          3, 12, 50,  false, 50],
      ["Agachamento Hack",   3, 10, 92,  false, 92],
      ["Cadeira Flexora",    3, 12, 50,  false, 50],
      ["Flexora em Pé",      3, 12, 36,  false, 36],
      ["Abdutora",           3, 12, 60,  true,  58],   // PR 58→60
      ["Panturrilha em Pé",  3, 15, 65,  true,  62],   // PR 62→65
    ],
  },

  // ══════════════ SEMANA 3 (Feb 16–21) ══════════════

  {
    daysAgo: 6, dayRating: 3, nutrition: 3, duration: 3360, // Seg 16/02 – Pull 🔥 PRs
    exercises: [
      ["Remada T Bar",       3,  8, 75,  true,  68],  // PR 68→75
      ["Remada Alta",        3, 10, 55,  true,  52],  // PR 52→55
      ["Puxador Frontal",    3,  8, 70,  true,  65],  // PR 65→70
      ["Posterior de Ombro", 3, 10, 20,  true,  17],  // PR 17→20
      ["Bíceps Scott Alta",  3,  8, 30,  true,  25],  // PR 25→30
    ],
  },
  {
    daysAgo: 5, dayRating: 3, nutrition: 3, duration: 3060, // Ter 17/02 – Push 🔥 PRs
    exercises: [
      ["Supino Inclinado",  3,  8, 60,  true,  52],   // PR 52→60
      ["Voador Máquina",    3, 10, 50,  true,  44],   // PR 44→50
      ["Frontal Ombro",     3, 10, 20,  true,  17],   // PR 17→20
      ["Lateral Ombro",     3, 10, 15,  true,  12],   // PR 12→15
      ["Tríceps Barra W",   3,  8, 35,  true,  30],   // PR 30→35
    ],
  },
  {
    daysAgo: 4, dayRating: 2, nutrition: 2, duration: 4320, // Qua 18/02 – Leg 1 🔥 PRs
    exercises: [
      ["Extensora",           3, 10, 55,  true,  50],  // PR 50→55
      ["Agachamento Hack",    3,  8, 100, true,  92],  // PR 92→100
      ["Cadeira Flexora",     3, 10, 55,  true,  50],  // PR 50→55
      ["Flexora em Pé",       3, 10, 40,  true,  36],  // PR 36→40
      ["Adutora",             3, 10, 65,  true,  60],  // PR 60→65
      ["Panturrilha Sentado", 3, 12, 60,  true,  55],  // PR 55→60
    ],
  },
  {
    daysAgo: 2, dayRating: 3, nutrition: 3, duration: 3900, // Sex 20/02 – Upper
    exercises: [
      ["Supino Pegada Neutra", 3,  8, 60,  true,  55],  // PR 55→60
      ["Remada T Bar",         3,  8, 75,  false, 75],
      ["Lateral Ombro",        3, 10, 15,  false, 15],
      ["Frontal Ombro",        3, 10, 20,  false, 20],
      ["Bíceps Scott Alta",    3,  8, 30,  false, 30],
      ["Tríceps Barra W",      3,  8, 35,  false, 35],
    ],
  },
  {
    daysAgo: 1, dayRating: 3, nutrition: 3, duration: 4080, // Sáb 21/02 – Leg 2
    exercises: [
      ["Extensora",          3, 10, 55,  false, 55],
      ["Agachamento Hack",   3,  8, 100, false, 100],
      ["Cadeira Flexora",    3, 10, 55,  false, 55],
      ["Flexora em Pé",      3, 10, 40,  false, 40],
      ["Abdutora",           3, 10, 65,  true,  60],   // PR 60→65
      ["Panturrilha em Pé",  3, 12, 70,  true,  65],   // PR 65→70
    ],
  },
];

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || "Admin";

  let admin = await prisma.user.findUnique({ where: { email } });
  if (!admin) {
    const passwordHash = await bcrypt.hash(password, 10);
    admin = await prisma.user.create({
      data: { name, email, passwordHash, role: "ADMIN", firstAccessDone: true },
    });
    console.log(`✅ Admin criado: ${email}`);
  } else {
    console.log("Admin já existe.");
  }

  // Limpa sessões existentes
  const existingSessions = await prisma.workoutSession.findMany({ where: { userId: admin.id } });
  for (const s of existingSessions) {
    await prisma.workoutEntry.deleteMany({ where: { sessionId: s.id } });
  }
  await prisma.workoutSession.deleteMany({ where: { userId: admin.id } });
  console.log("Sessões limpas.");

  // Limpa rotina existente
  const existingDays = await prisma.routineDay.findMany({ where: { userId: admin.id } });
  for (const day of existingDays) {
    await prisma.routineExercise.deleteMany({ where: { routineDayId: day.id } });
  }
  await prisma.routineDay.deleteMany({ where: { userId: admin.id } });
  console.log("Rotina limpa.");

  // Limpa exercícios existentes
  const existingMachines = await prisma.machine.findMany({ where: { userId: admin.id } });
  for (const m of existingMachines) {
    await prisma.workoutEntry.deleteMany({ where: { machineId: m.id } });
  }
  await prisma.machine.deleteMany({ where: { userId: admin.id } });
  console.log("Exercícios limpos.");

  // Cria todos os exercícios com PRs finais
  const machineMap = {};
  for (const ex of DEFAULT_EXERCISES) {
    const created = await prisma.machine.create({
      data: {
        userId: admin.id,
        name: ex.name,
        category: ex.category,
        currentPR: ADMIN_PR_OVERRIDES[ex.name] ?? null,
      },
    });
    machineMap[ex.name] = created.id;
  }
  console.log(`✅ ${DEFAULT_EXERCISES.length} exercícios criados.`);

  // Cria rotina
  for (const [dowStr, { label, exercises }] of Object.entries(ROUTINE)) {
    const dow = parseInt(dowStr);
    await prisma.routineDay.create({
      data: {
        userId: admin.id,
        dayOfWeek: dow,
        label: label || null,
        exercises: {
          create: exercises.map(([machineName, sets, reps, repsMax = null], i) => ({
            machineId: machineMap[machineName],
            sets,
            reps,
            repsMax,
            sortOrder: i,
          })),
        },
      },
    });
    console.log(`✅ Dia ${dow} (${label}): ${exercises.length} exercícios.`);
  }

  // Cria histórico de sessões
  for (const sd of SESSION_DATA) {
    const date = new Date();
    date.setDate(date.getDate() - sd.daysAgo);
    date.setHours(12, 0, 0, 0);

    const startedAt = new Date(date.getTime() - sd.duration * 1000);

    const session = await prisma.workoutSession.create({
      data: {
        userId: admin.id,
        date,
        finished: true,
        dayRating: sd.dayRating,
        nutrition: sd.nutrition,
        duration: sd.duration,
        startedAt,
        finishedAt: date,
      },
    });

    for (const [machineName, sets, reps, weight, hitPR, previousPR] of sd.exercises) {
      const machineId = machineMap[machineName];
      await prisma.workoutEntry.create({
        data: {
          sessionId: session.id,
          machineId,
          weight,
          sets,
          reps,
          hitPR: !!hitPR,
          previousPR,
        },
      });
    }
    console.log(`✅ Sessão: ${sd.daysAgo} dia(s) atrás (${session.date.toLocaleDateString("pt-BR")}) — ${sd.exercises.length} exercícios.`);
  }

  console.log("✅ Seed concluído!");
}

main().finally(() => prisma.$disconnect());
