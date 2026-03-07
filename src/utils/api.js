/**
 * Camada de compatibilidade: substitui o axios + Express backend
 * por queries diretas ao Supabase. Mantém a mesma interface
 * api.get/post/patch/put/delete para que as pages não precisem mudar.
 */
import { supabase } from "../supabaseClient.js";

// ─── snake_case <-> camelCase helpers ────────────────────────
const SPECIAL_CAMEL = { current_pr: "currentPR", hit_pr: "hitPR", previous_pr: "previousPR" };
const SPECIAL_SNAKE = { currentPR: "current_pr", hitPR: "hit_pr", previousPR: "previous_pr" };

function toCamelStr(s) {
  if (SPECIAL_CAMEL[s]) return SPECIAL_CAMEL[s];
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}
function toSnakeStr(s) {
  if (SPECIAL_SNAKE[s]) return SPECIAL_SNAKE[s];
  return s.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());
}
function camelKeys(o) {
  if (Array.isArray(o)) return o.map(camelKeys);
  if (o !== null && typeof o === "object") {
    return Object.fromEntries(Object.entries(o).map(([k, v]) => [toCamelStr(k), camelKeys(v)]));
  }
  return o;
}
function snakeKeys(o) {
  if (Array.isArray(o)) return o.map(snakeKeys);
  if (o !== null && typeof o === "object") {
    return Object.fromEntries(Object.entries(o).map(([k, v]) => [toSnakeStr(k), snakeKeys(v)]));
  }
  return o;
}

function wrap(data) { return { data: camelKeys(data) }; }

function fail(msg) {
  const e = new Error(msg);
  e.response = { data: { message: msg } };
  throw e;
}

async function uid() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) fail("Sessao expirada");
  return user.id;
}

function todayRange(refDate) {
  const d = refDate ? new Date(refDate) : new Date();
  const start = new Date(d); start.setHours(0, 0, 0, 0);
  const end = new Date(d); end.setHours(23, 59, 59, 999);
  return [start.toISOString(), end.toISOString()];
}

const SESSION_WITH_ENTRIES = "*, entries:workout_entries(*, machine:machines(*))";
const ROUTINE_DAY_WITH_EXERCISES = "*, exercises:routine_exercises(*, machine:machines(id, name, category, current_pr))";

const api = {

  // ======================== GET ========================
  async get(path) {
    const userId = await uid();

    if (path === "/sessions/status") {
      const [mc, rc] = await Promise.all([
        supabase.from("machines").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("routine_days").select("id", { count: "exact", head: true }).eq("user_id", userId),
      ]);
      return wrap({ hasMachines: (mc.count || 0) > 0, hasRoutine: (rc.count || 0) > 0 });
    }

    if (path === "/sessions/today") {
      const [start, end] = todayRange();
      const { data } = await supabase
        .from("workout_sessions").select(SESSION_WITH_ENTRIES)
        .eq("user_id", userId).gte("date", start).lte("date", end)
        .order("sort_order", { referencedTable: "workout_entries", ascending: true, nullsFirst: false })
        .order("created_at", { referencedTable: "workout_entries", ascending: true })
        .maybeSingle();
      return wrap(data);
    }

    if (path === "/sessions/history") {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("workout_sessions").select(SESSION_WITH_ENTRIES)
        .eq("user_id", userId)
        .or(`finished.eq.true,date.lt.${todayStart.toISOString()}`)
        .order("date", { ascending: false })
        .order("created_at", { referencedTable: "workout_entries", ascending: true })
        .limit(60);
      return wrap(data || []);
    }

    const reportMatch = path.match(/^\/sessions\/report\/(\d+)\/(\d+)$/);
    if (reportMatch) {
      const [, y, m] = reportMatch.map(Number);
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0, 23, 59, 59, 999);
      const { data: sessions } = await supabase
        .from("workout_sessions").select(SESSION_WITH_ENTRIES)
        .eq("user_id", userId)
        .gte("date", start.toISOString()).lte("date", end.toISOString())
        .order("date", { ascending: true });
      const s = camelKeys(sessions || []);
      const totalSessions = s.length;
      const prsBeaten = s.flatMap((x) => x.entries || []).filter((e) => e.hitPR).length;
      const rated = s.filter((x) => x.dayRating);
      const avgDayRating = rated.length ? rated.reduce((a, x) => a + x.dayRating, 0) / rated.length : 0;
      const fed = s.filter((x) => x.nutrition);
      const avgNutrition = fed.length ? fed.reduce((a, x) => a + x.nutrition, 0) / fed.length : 0;
      return { data: { sessions: s, totalSessions, prsBeaten, avgDayRating, avgNutrition } };
    }

    const progressMatch = path.match(/^\/sessions\/machine\/([\w-]+)\/progress$/);
    if (progressMatch) {
      const machineId = progressMatch[1];
      const { data: entries } = await supabase
        .from("workout_entries")
        .select("weight, sets, reps, hit_pr, sets_data, session:workout_sessions!inner(date, user_id)")
        .eq("machine_id", machineId)
        .eq("session.user_id", userId)
        .eq("session.finished", true)
        .order("date", { referencedTable: "workout_sessions", ascending: true })
        .limit(50);
      const mapped = (entries || []).map((e) => ({
        date: e.session?.date, weight: e.weight, sets: e.sets, reps: e.reps,
        hitPR: e.hit_pr, setsData: e.sets_data,
      }));
      return { data: mapped };
    }

    if (path === "/routine") {
      const { data } = await supabase
        .from("routine_days").select(ROUTINE_DAY_WITH_EXERCISES)
        .eq("user_id", userId)
        .order("day_of_week", { ascending: true })
        .order("sort_order", { referencedTable: "routine_exercises", ascending: true });
      return wrap(data || []);
    }

    const routineDayMatch = path.match(/^\/routine\/day\/(\d)$/);
    if (routineDayMatch) {
      const dow = parseInt(routineDayMatch[1]);
      const { data } = await supabase
        .from("routine_days").select(ROUTINE_DAY_WITH_EXERCISES)
        .eq("user_id", userId).eq("day_of_week", dow)
        .order("sort_order", { referencedTable: "routine_exercises", ascending: true })
        .maybeSingle();
      return wrap(data);
    }

    if (path === "/routine/templates") {
      const { data } = await supabase.from("profiles").select("routine_templates").eq("id", userId).single();
      const tpls = data?.routine_templates;
      return { data: Array.isArray(tpls) ? tpls : [] };
    }

    if (path.startsWith("/routine/by-email")) {
      const url = new URL(path, "http://x");
      const email = url.searchParams.get("email");
      if (!email) fail("email obrigatorio");
      const { data } = await supabase.rpc("get_routine_by_email", { target_email: email });
      if (!data) fail("Usuario nao encontrado.");
      return { data };
    }

    if (path === "/machines") {
      const { data } = await supabase.from("machines").select("*").eq("user_id", userId).order("category", { ascending: true });
      return wrap(data || []);
    }

    if (path === "/users/me") {
      const { data } = await supabase.from("profiles").select("id, name, email, role, photo_base64").eq("id", userId).single();
      return wrap(data);
    }

    if (path === "/users") {
      const { data } = await supabase.from("profiles").select("id, name, email, cpf, role, first_access_done").order("name", { ascending: true });
      return wrap(data || []);
    }

    fail(`GET ${path} not mapped`);
  },

  // ======================== POST ========================
  async post(path, body = {}) {
    const userId = await uid();

    if (path === "/sessions") {
      const dateParam = body?.date;
      const [start, end] = todayRange(dateParam);
      const { data: existing } = await supabase
        .from("workout_sessions").select(SESSION_WITH_ENTRIES)
        .eq("user_id", userId).gte("date", start).lte("date", end)
        .order("sort_order", { referencedTable: "workout_entries", ascending: true, nullsFirst: false })
        .order("created_at", { referencedTable: "workout_entries", ascending: true })
        .maybeSingle();
      if (existing) return wrap(existing);
      const { data, error } = await supabase
        .from("workout_sessions")
        .insert({ user_id: userId, ...(dateParam && { date: new Date(dateParam).toISOString() }), started_at: new Date().toISOString() })
        .select(SESSION_WITH_ENTRIES).single();
      if (error) fail(error.message);
      return wrap(data);
    }

    const entryMatch = path.match(/^\/sessions\/([\w-]+)\/entries$/);
    if (entryMatch) {
      const sessionId = entryMatch[1];
      const b = snakeKeys(body);
      const { data, error } = await supabase
        .from("workout_entries")
        .insert({
          session_id: sessionId, machine_id: b.machine_id, weight: b.weight,
          sets: b.sets || null, reps: b.reps || null,
          hit_pr: !!b.hit_pr, previous_pr: b.previous_pr, notes: b.notes,
          sets_data: b.sets_data ? (typeof b.sets_data === "string" ? b.sets_data : JSON.stringify(b.sets_data)) : null,
          comment: b.comment || null,
        })
        .select("*, machine:machines(*)").single();
      if (error) fail(error.message);
      return wrap(data);
    }

    if (path === "/machines") {
      const b = snakeKeys(body);
      const { data, error } = await supabase
        .from("machines")
        .insert({ user_id: userId, name: b.name, category: b.category, photo_base64: b.photo_base64 || null, current_pr: b.current_pr || null })
        .select().single();
      if (error) fail(error.message);
      return wrap(data);
    }

    if (path === "/users") {
      const { name, email, cpf, password, role } = body;
      const { createClient } = await import("@supabase/supabase-js");
      const tempClient = createClient(
        import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY,
        { auth: { persistSession: false } }
      );
      const authEmail = email || `${(cpf || "").replace(/\D/g, "")}@dinogym.app`;
      const { data: authData, error: authErr } = await tempClient.auth.signUp({
        email: authEmail, password,
        options: { data: { name, role: role || "MEMBER" } },
      });
      if (authErr) fail(authErr.message);
      if (cpf && authData.user) {
        await supabase.from("profiles").update({ cpf: cpf.replace(/\D/g, "") }).eq("id", authData.user.id);
      }
      if (role === "MEMBER" && authData.user) {
        await tempClient.rpc("create_default_exercises");
        await tempClient.rpc("create_default_routine");
      }
      const { data: profile } = await supabase.from("profiles").select("id, name, email, cpf, role").eq("id", authData.user.id).single();
      return wrap(profile);
    }

    fail(`POST ${path} not mapped`);
  },

  // ======================== PATCH ========================
  async patch(path, body = {}) {
    const userId = await uid();

    const finishMatch = path.match(/^\/sessions\/([\w-]+)\/finish$/);
    if (finishMatch) {
      const sessionId = finishMatch[1];
      const b = snakeKeys(body);
      await supabase.from("workout_sessions").update({
        day_rating: b.day_rating, nutrition: b.nutrition, finished: true,
        finished_at: new Date().toISOString(), ...(b.duration != null && { duration: b.duration }),
      }).eq("id", sessionId).eq("user_id", userId);
      const { data } = await supabase.from("workout_sessions").select(SESSION_WITH_ENTRIES).eq("id", sessionId).single();
      return wrap(data);
    }

    const editEntryMatch = path.match(/^\/sessions\/([\w-]+)\/entries\/([\w-]+)$/);
    if (editEntryMatch) {
      const [, , entryId] = editEntryMatch;
      const b = snakeKeys(body);
      const updateData = {};
      if (b.weight !== undefined) updateData.weight = b.weight;
      if (b.reps !== undefined) updateData.reps = b.reps;
      if (b.sets !== undefined) updateData.sets = b.sets;
      if (b.sets_data !== undefined) updateData.sets_data = typeof b.sets_data === "string" ? b.sets_data : JSON.stringify(b.sets_data);
      if (b.comment !== undefined) updateData.comment = b.comment;
      if (b.sort_order !== undefined) updateData.sort_order = b.sort_order;
      await supabase.from("workout_entries").update(updateData).eq("id", entryId);
      if (b.weight !== undefined) {
        const { data: entry } = await supabase.from("workout_entries").select("machine_id").eq("id", entryId).single();
        if (entry) {
          const { data: machine } = await supabase.from("machines").select("current_pr").eq("id", entry.machine_id).eq("user_id", userId).single();
          if (machine && b.weight > (machine.current_pr ?? -1)) {
            await supabase.from("machines").update({ current_pr: b.weight }).eq("id", entry.machine_id);
            await supabase.from("workout_entries").update({ hit_pr: true, previous_pr: machine.current_pr }).eq("id", entryId);
          }
        }
      }
      const { data: updated } = await supabase.from("workout_entries").select("*, machine:machines(*)").eq("id", entryId).single();
      return wrap(updated);
    }

    const favMatch = path.match(/^\/machines\/([\w-]+)\/favorite$/);
    if (favMatch) {
      const machineId = favMatch[1];
      const { data: machine } = await supabase.from("machines").select("is_favorite").eq("id", machineId).eq("user_id", userId).single();
      if (!machine) fail("Exercicio nao encontrado");
      const { data } = await supabase.from("machines").update({ is_favorite: !machine.is_favorite }).eq("id", machineId).select().single();
      return wrap(data);
    }

    const machineMatch = path.match(/^\/machines\/([\w-]+)$/);
    if (machineMatch) {
      const machineId = machineMatch[1];
      const b = snakeKeys(body);
      const { data } = await supabase.from("machines").update(b).eq("id", machineId).eq("user_id", userId).select().single();
      return wrap(data);
    }

    if (path === "/users/me") {
      const b = snakeKeys(body);
      const { data } = await supabase.from("profiles").update(b).eq("id", userId).select("id, name, email, role, photo_base64").single();
      return wrap(data);
    }

    fail(`PATCH ${path} not mapped`);
  },

  // ======================== PUT ========================
  async put(path, body = {}) {
    const userId = await uid();

    const routineDayMatch = path.match(/^\/routine\/day\/(\d)$/);
    if (routineDayMatch) {
      const dow = parseInt(routineDayMatch[1]);
      const { exercises, label } = body;
      if (!exercises || exercises.length === 0) {
        await supabase.from("routine_days").delete().eq("user_id", userId).eq("day_of_week", dow);
        return wrap({ ok: true });
      }
      const { data: existingDay } = await supabase.from("routine_days").select("id").eq("user_id", userId).eq("day_of_week", dow).maybeSingle();
      let dayId;
      if (existingDay) {
        dayId = existingDay.id;
        if (label !== undefined) await supabase.from("routine_days").update({ label }).eq("id", dayId);
      } else {
        const { data: newDay } = await supabase.from("routine_days").insert({ user_id: userId, day_of_week: dow, ...(label != null && { label }) }).select("id").single();
        dayId = newDay.id;
      }
      await supabase.from("routine_exercises").delete().eq("routine_day_id", dayId);
      const rows = exercises.map((ex, i) => ({
        routine_day_id: dayId, machine_id: ex.machineId,
        sets: ex.sets || 3, reps: ex.reps || 12, reps_max: ex.repsMax ?? null, sort_order: i,
      }));
      await supabase.from("routine_exercises").insert(rows);
      const { data } = await supabase
        .from("routine_days").select(ROUTINE_DAY_WITH_EXERCISES)
        .eq("id", dayId)
        .order("sort_order", { referencedTable: "routine_exercises", ascending: true })
        .single();
      return wrap(data);
    }

    if (path === "/routine/templates") {
      await supabase.from("profiles").update({ routine_templates: body.templates }).eq("id", userId);
      return wrap({ ok: true });
    }

    fail(`PUT ${path} not mapped`);
  },

  // ======================== DELETE ========================
  async delete(path) {
    const userId = await uid();

    if (path === "/sessions/today") {
      const [start, end] = todayRange();
      const { data: session } = await supabase.from("workout_sessions").select("id").eq("user_id", userId).gte("date", start).lte("date", end).maybeSingle();
      if (session) {
        await supabase.from("workout_entries").delete().eq("session_id", session.id);
        await supabase.from("workout_sessions").delete().eq("id", session.id);
      }
      return wrap({ ok: true });
    }

    const sessionMatch = path.match(/^\/sessions\/([\w-]+)$/);
    if (sessionMatch) {
      const sessionId = sessionMatch[1];
      await supabase.from("workout_entries").delete().eq("session_id", sessionId);
      await supabase.from("workout_sessions").delete().eq("id", sessionId).eq("user_id", userId);
      return wrap({ ok: true });
    }

    const machineMatch = path.match(/^\/machines\/([\w-]+)$/);
    if (machineMatch) {
      const machineId = machineMatch[1];
      await supabase.from("machines").delete().eq("id", machineId).eq("user_id", userId);
      return wrap({ ok: true });
    }

    fail(`DELETE ${path} not mapped`);
  },
};

export default api;
