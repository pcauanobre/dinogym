// Rotina padrão criada para novos usuários: 2 séries × 6-9 reps
export const DEFAULT_ROUTINE = {
  1: { label: "Pull", exercises: [
    ["Remada T Bar",       2, 6, 9],
    ["Remada Alta",        2, 6, 9],
    ["Puxador Frontal",    2, 6, 9],
    ["Posterior de Ombro", 2, 6, 9],
    ["Bíceps Scott Alta",  2, 6, 9],
  ]},
  2: { label: "Push", exercises: [
    ["Supino Inclinado",  2, 6, 9],
    ["Voador Máquina",    2, 6, 9],
    ["Frontal Ombro",     2, 6, 9],
    ["Lateral Ombro",     2, 6, 9],
    ["Tríceps Barra W",   2, 6, 9],
  ]},
  3: { label: "Leg 1", exercises: [
    ["Extensora",           2, 6, 9],
    ["Agachamento Hack",    2, 6, 9],
    ["Cadeira Flexora",     2, 6, 9],
    ["Flexora em Pé",       2, 6, 9],
    ["Adutora",             2, 6, 9],
    ["Panturrilha Sentado", 2, 6, 9],
  ]},
  // Quinta (4) = Descanso
  5: { label: "Upper", exercises: [
    ["Supino Pegada Neutra", 2, 6, 9],
    ["Remada T Bar",         2, 6, 9],
    ["Lateral Ombro",        2, 6, 9],
    ["Frontal Ombro",        2, 6, 9],
    ["Bíceps Scott Alta",    2, 6, 9],
    ["Tríceps Barra W",      2, 6, 9],
  ]},
  6: { label: "Leg 2", exercises: [
    ["Extensora",          2, 6, 9],
    ["Agachamento Hack",   2, 6, 9],
    ["Cadeira Flexora",    2, 6, 9],
    ["Flexora em Pé",      2, 6, 9],
    ["Abdutora",           2, 6, 9],
    ["Panturrilha em Pé",  2, 6, 9],
  ]},
};

/**
 * Cria a rotina padrão para um usuário, mapeando nomes de exercício
 * para os IDs das máquinas já criadas para esse usuário.
 * Dias que já existem não são sobrescritos.
 */
export async function createDefaultRoutine(userId, prisma) {
  // Busca as máquinas do usuário indexadas por nome
  const machines = await prisma.machine.findMany({ where: { userId } });
  const machineMap = Object.fromEntries(machines.map((m) => [m.name, m.id]));

  for (const [dowStr, { label, exercises }] of Object.entries(DEFAULT_ROUTINE)) {
    const dow = parseInt(dowStr);

    // Não sobrescreve dia que já existe
    const existing = await prisma.routineDay.findUnique({
      where: { userId_dayOfWeek: { userId, dayOfWeek: dow } },
    });
    if (existing) continue;

    // Filtra exercícios cujo nome existe nas máquinas do usuário
    const mapped = exercises
      .filter(([name]) => machineMap[name])
      .map(([name, sets, reps, repsMax], i) => ({
        machineId: machineMap[name],
        sets, reps, repsMax: repsMax ?? null, sortOrder: i,
      }));

    if (mapped.length === 0) continue;

    await prisma.routineDay.create({
      data: {
        userId,
        dayOfWeek: dow,
        label,
        exercises: { create: mapped },
      },
    });
  }
}
