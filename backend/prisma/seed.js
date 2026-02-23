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

const DOW_EXERCISES = {
  1: ROUTINE[1].exercises.map(e => e[0]),
  2: ROUTINE[2].exercises.map(e => e[0]),
  3: ROUTINE[3].exercises.map(e => e[0]),
  5: ROUTINE[5].exercises.map(e => e[0]),
  6: ROUTINE[6].exercises.map(e => e[0]),
};

// ── Datas dinâmicas: 12 meses terminando hoje ────────────────────────────────
const _today = new Date();
_today.setHours(0, 0, 0, 0);
const SESSION_END   = new Date(_today);
const SESSION_START = new Date(_today.getFullYear() - 1, _today.getMonth(), 1);
const _TRAINING_DAYS = new Set([1, 2, 3, 5, 6]);
while (!_TRAINING_DAYS.has(SESSION_START.getDay())) SESSION_START.setDate(SESSION_START.getDate() + 1);

function buildDates() {
  const list = [];
  const d = new Date(SESSION_START);
  while (d <= SESSION_END) {
    const dow = d.getDay();
    if (DOW_EXERCISES[dow]) list.push({ date: new Date(d), dow });
    d.setDate(d.getDate() + 1);
  }
  return list;
}

function r2_5(v) { return Math.round(v / 2.5) * 2.5; }

// Deterministic pseudo-random → [0, 1)
function dhash(n) { return ((Math.imul(n | 0, 1013904223) + 1664525) >>> 0) / 0x100000000; }

// ── Simulação por exercício ───────────────────────────────────────────────────
//
// Regras de rep:
//   ≤ 5 reps → carga pesada demais (fase de adaptação após aumento de carga)
//   6-7 reps → faixa boa, evoluindo
//   8-9 reps → hora de aumentar a carga
//
// Cada exercício tem um ciclo de N sessões dentro de um nível de carga:
//   início do ciclo (sessões 0-2): reps 5-6, sets com fadiga   (6, 5, 5)
//   meio do ciclo   (sessões 3-6): reps 6-7, sets melhores     (7, 7, 6)
//   fim do ciclo    (sessões 7+ ): reps 8-9, sets consistentes (8, 8, 8)
//   → aumento de carga → reinicia ciclo com reps 5-6
//
// O comprimento do ciclo é calibrado por exercício para que a carga final
// (ADMIN_PR_OVERRIDES) seja atingida em ~80% das sessões disponíveis.

const EX_STATE = {};

function initExState(exName, totalSessions) {
  if (!ADMIN_PR_OVERRIDES[exName]) return;
  const finalW   = ADMIN_PR_OVERRIDES[exName];
  const startW   = r2_5(finalW * 0.60);
  const steps    = Math.max(1, Math.round((finalW - startW) / 2.5));
  // Distribui os aumentos de carga em 80% das sessões disponíveis
  const cycleLen = Math.max(4, Math.round((totalSessions * 0.80) / steps));
  EX_STATE[exName] = {
    weight:           startW,
    finalWeight:      finalW,
    sessionsAtWeight: 0,
    cycleLen,
    prWeight:         null,   // melhor carga já registrada
  };
}

// Retorna { weight, reps, setsData, hitPR, previousPR }
function stepExercise(exName, gIdx) {
  const st = EX_STATE[exName];
  if (!st) return null;

  const curW  = st.weight;
  const atMax = curW >= st.finalWeight;

  // Progresso dentro do nível atual: 0 (recém aumentou) → 1 (pronto pra aumentar)
  const prog = atMax
    ? 0.85 + dhash(gIdx * 13) * 0.1  // no plateau: reps oscilam em 8-9
    : Math.min(1, st.sessionsAtWeight / st.cycleLen);

  // Qualidade do dia: 12% chance ruim (−1), 12% chance ótimo (+1), resto neutro
  const h = dhash(gIdx * 37 + (exName.charCodeAt(0) * 7));
  const dayBonus = h < 0.12 ? -1 : h > 0.88 ? 1 : 0;

  // Reps base da sessão: 5 (início do ciclo) → 9 (fim do ciclo) ± dia
  const baseReps = 5 + prog * 4 + dayBonus;

  // Fadiga entre sets: sets posteriores são mais fracos no início do ciclo
  // (baixa prog = pouco adaptado = mais fadiga)
  const fatigue2 = prog < 0.35 ? 1 : 0;  // set 2 sofre quando prog < 35%
  const fatigue3 = prog < 0.65 ? 1 : 0;  // set 3 sofre quando prog < 65%

  const s1 = Math.max(5, Math.min(9, Math.round(baseReps)));
  const s2 = Math.max(5, Math.min(9, Math.round(baseReps - fatigue2)));
  const s3 = Math.max(5, Math.min(9, Math.round(baseReps - fatigue3)));
  const avg = (s1 + s2 + s3) / 3;

  // Detecção de PR
  const hitPR      = st.prWeight !== null && curW > st.prWeight;
  const previousPR = hitPR ? st.prWeight : null;
  if (st.prWeight === null || curW > st.prWeight) st.prWeight = curW;

  // Avança carga: média ≥ 8 reps → próxima sessão aumenta 2.5kg
  if (!atMax && avg >= 8.0) {
    st.weight           = Math.min(r2_5(curW + 2.5), st.finalWeight);
    st.sessionsAtWeight = 0;
  } else if (!atMax && st.sessionsAtWeight >= st.cycleLen * 2) {
    // Segurança: se travou muito tempo no mesmo nível, força avanço
    st.weight           = Math.min(r2_5(curW + 2.5), st.finalWeight);
    st.sessionsAtWeight = 0;
  } else {
    st.sessionsAtWeight++;
  }

  return {
    weight:   curW,
    reps:     s1,
    setsData: [{ reps: s1 }, { reps: s2 }, { reps: s3 }],
    hitPR,
    previousPR,
  };
}

// ── Padrões determinísticos de rating / nutrição ──────────────────────────────
const RATINGS = [3, 3, 3, 3, 3, 3, 3, 3, 2, 3, 3, 3, 3, 2, 3, 3, 3, 3, 3, 1];
const NUTRI   = [3, 3, 3, 3, 2, 3, 3, 3, 3, 3, 2, 3, 3, 3, 3, 3, 1, 3, 3, 3];

// Pull/Push ≈ 45min; Leg/Upper ≈ 60min
function sessionDuration(dow) {
  return (dow === 1 || dow === 2) ? 2700 : 3600;
}

async function main() {
  const email    = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name     = process.env.ADMIN_NAME || "Admin";

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

  // ── Limpeza ───────────────────────────────────────────────────────────────
  const existingSessions = await prisma.workoutSession.findMany({ where: { userId: admin.id } });
  for (const s of existingSessions) {
    await prisma.workoutEntry.deleteMany({ where: { sessionId: s.id } });
  }
  await prisma.workoutSession.deleteMany({ where: { userId: admin.id } });
  console.log("Sessões limpas.");

  const existingDays = await prisma.routineDay.findMany({ where: { userId: admin.id } });
  for (const day of existingDays) {
    await prisma.routineExercise.deleteMany({ where: { routineDayId: day.id } });
  }
  await prisma.routineDay.deleteMany({ where: { userId: admin.id } });
  console.log("Rotina limpa.");

  const existingMachines = await prisma.machine.findMany({ where: { userId: admin.id } });
  for (const m of existingMachines) {
    await prisma.workoutEntry.deleteMany({ where: { machineId: m.id } });
  }
  await prisma.machine.deleteMany({ where: { userId: admin.id } });
  console.log("Exercícios limpos.");

  // ── Exercícios ────────────────────────────────────────────────────────────
  const machineMap = {};
  for (const ex of DEFAULT_EXERCISES) {
    const created = await prisma.machine.create({
      data: {
        userId:    admin.id,
        name:      ex.name,
        category:  ex.category,
        currentPR: ADMIN_PR_OVERRIDES[ex.name] ?? null,
      },
    });
    machineMap[ex.name] = created.id;
  }
  console.log(`✅ ${DEFAULT_EXERCISES.length} exercícios criados.`);

  // ── Rotina semanal ────────────────────────────────────────────────────────
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
            sets, reps, repsMax, sortOrder: i,
          })),
        },
      },
    });
    console.log(`✅ Dia ${dow} (${label}): ${exercises.length} exercícios.`);
  }

  // ── Histórico ─────────────────────────────────────────────────────────────
  const sessionDates = buildDates();

  // Conta sessões por exercício para calibrar o cicleLen individualmente
  const exSessionCount = {};
  for (const { dow } of sessionDates) {
    for (const exName of DOW_EXERCISES[dow]) {
      exSessionCount[exName] = (exSessionCount[exName] || 0) + 1;
    }
  }
  for (const [exName, count] of Object.entries(exSessionCount)) {
    initExState(exName, count);
  }

  console.log(`\nGerando histórico de ${SESSION_START.toLocaleDateString("pt-BR")} a ${SESSION_END.toLocaleDateString("pt-BR")}...`);

  let sessCount = 0;
  let gIdx = 0; // índice global único por (sessão, exercício) para dhash

  for (let i = 0; i < sessionDates.length; i++) {
    const { date, dow } = sessionDates[i];
    date.setHours(12, 0, 0, 0);
    const dur       = sessionDuration(dow);
    const startedAt = new Date(date.getTime() - dur * 1000);

    const session = await prisma.workoutSession.create({
      data: {
        userId:     admin.id,
        date:       new Date(date),
        finished:   true,
        dayRating:  RATINGS[i % RATINGS.length],
        nutrition:  NUTRI[i % NUTRI.length],
        duration:   dur,
        startedAt,
        finishedAt: new Date(date),
      },
    });

    for (const exName of DOW_EXERCISES[dow]) {
      const result = stepExercise(exName, gIdx++);
      if (!result) continue;

      await prisma.workoutEntry.create({
        data: {
          sessionId:  session.id,
          machineId:  machineMap[exName],
          weight:     result.weight,
          sets:       3,
          reps:       result.reps,
          hitPR:      result.hitPR,
          previousPR: result.previousPR,
          setsData:   JSON.stringify(result.setsData),
        },
      });
    }

    sessCount++;
    if (i % 50 === 0 || i === sessionDates.length - 1) {
      process.stdout.write(`  ▸ ${sessCount}/${sessionDates.length} — ${date.toLocaleDateString("pt-BR")}\n`);
    }
  }

  const totalEntries = sessionDates.reduce((sum, { dow }) => sum + DOW_EXERCISES[dow].length, 0);
  console.log(`\n✅ ${sessCount} sessões | ~${totalEntries} entradas`);
  console.log(`   Período: ${SESSION_START.toLocaleDateString("pt-BR")} → ${SESSION_END.toLocaleDateString("pt-BR")}`);
  console.log("✅ Seed concluído!");
}

main().finally(() => prisma.$disconnect());
