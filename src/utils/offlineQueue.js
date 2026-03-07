import api from "./api.js";

const KEY_ROUTINE_DAY    = (dow) => `dg_routine_${dow}`;
const KEY_ALL_ROUTINE    = "dg_all_routine";
const KEY_MACHINES       = "dg_machines";
const KEY_USER           = "dg_user";
const KEY_OFFLINE_SES    = "dg_offline_session";
const KEY_PENDING        = "dg_pending_sessions";

// ─── Helpers ──────────────────────────────────────────────────────
function read(key)        { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
function write(key, val)  { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }
function del(key)         { try { localStorage.removeItem(key); } catch {} }

// ─── Routine cache ────────────────────────────────────────────────
export const cacheRoutineDay     = (dow, d) => write(KEY_ROUTINE_DAY(dow), d);
export const getCachedRoutineDay = (dow)    => read(KEY_ROUTINE_DAY(dow));
export const cacheAllRoutine     = (d)      => write(KEY_ALL_ROUTINE, d);
export const getCachedAllRoutine = ()       => read(KEY_ALL_ROUTINE) || [];

// ─── Machines cache ───────────────────────────────────────────────
export const cacheMachines    = (d) => write(KEY_MACHINES, d);
export const getCachedMachines = () => read(KEY_MACHINES) || [];

// ─── History cache ────────────────────────────────────────────────
const KEY_HISTORY = "dg_history";
export const cacheHistory    = (d) => write(KEY_HISTORY, d);
export const getCachedHistory = () => read(KEY_HISTORY);

// ─── Report cache (per month) ─────────────────────────────────
const KEY_REPORT = (y, m) => `dg_report_${y}_${String(m).padStart(2, "0")}`;
export const cacheReport    = (y, m, d) => write(KEY_REPORT(y, m), d);
export const getCachedReport = (y, m)   => read(KEY_REPORT(y, m));

// ─── Templates cache ──────────────────────────────────────────
const KEY_TEMPLATES = "dg_templates";
export const cacheTemplates    = (d) => write(KEY_TEMPLATES, d);
export const getCachedTemplates = () => read(KEY_TEMPLATES) || [];

// ─── User cache ───────────────────────────────────────────────────
export const cacheUser    = (d) => write(KEY_USER, d);
export const getCachedUser = () => read(KEY_USER);

// ─── Today session cache ────────────────────────────────────────
const KEY_TODAY_SESSION = "dg_today_session";
export const cacheTodaySession = (d) => write(KEY_TODAY_SESSION, d);
export const getCachedTodaySession = () => read(KEY_TODAY_SESSION);

// ─── Status cache ───────────────────────────────────────────────
const KEY_STATUS = "dg_status";
export const cacheStatus = (d) => write(KEY_STATUS, d);
export const getCachedStatus = () => read(KEY_STATUS);

// ─── In-progress offline session ─────────────────────────────────
export const saveOfflineSession  = (s) => write(KEY_OFFLINE_SES, s);
export const getOfflineSession   = ()  => read(KEY_OFFLINE_SES);
export const clearOfflineSession = ()  => del(KEY_OFFLINE_SES);

// ─── Pending sessions queue ───────────────────────────────────────
export const getPendingSessions = () => read(KEY_PENDING) || [];

export function addPendingSession(ps) {
  write(KEY_PENDING, [...getPendingSessions(), ps]);
}

function removeSynced(synced) {
  const remaining = getPendingSessions().filter((p) => !synced.includes(p));
  if (remaining.length === 0) del(KEY_PENDING);
  else write(KEY_PENDING, remaining);
}

// ─── Sync pending sessions to server ─────────────────────────────
// Each pending item:
//   { sessionId: string|null, date: ISO string, entries: [...], dayRating, nutrition }
// sessionId = null → create new session on server
// sessionId = real ID → session already exists (partial sync), just post entries + finish
export async function syncPending() {
  const pending = getPendingSessions();
  if (!pending.length) return 0;

  const synced = [];
  for (const ps of pending) {
    try {
      let sessionId = ps.sessionId;

      if (!sessionId) {
        const r = await api.post("/sessions", { date: ps.date });
        sessionId = r.data.id;
      }

      for (const entry of ps.entries) {
        await api.post(`/sessions/${sessionId}/entries`, entry);
      }

      await api.patch(`/sessions/${sessionId}/finish`, {
        dayRating: ps.dayRating || 0,
        nutrition: ps.nutrition || 0,
      });

      synced.push(ps);
    } catch {
      break; // stop on first failure, keep rest in queue for next time
    }
  }

  if (synced.length) removeSynced(synced);
  return synced.length;
}
