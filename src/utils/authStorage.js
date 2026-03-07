import { supabase } from "../supabaseClient.js";

const KEEP_KEY = "dinogym_keep";

export function getToken() {
  // Check if Supabase has an active session in storage
  const keys = Object.keys(localStorage);
  const sbKey = keys.find((k) => k.startsWith("sb-") && k.endsWith("-auth-token"));
  return sbKey && localStorage.getItem(sbKey) ? "supabase" : null;
}

export function setToken(_token, _keep) {
  // No-op: Supabase manages tokens automatically
}

export function removeToken() {
  supabase.auth.signOut();
}

export function getKeepSession() {
  const val = localStorage.getItem(KEEP_KEY);
  return val === null ? true : val === "true";
}

export function setKeepSession(val) {
  localStorage.setItem(KEEP_KEY, String(val));
}
