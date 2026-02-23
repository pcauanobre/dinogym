const TOKEN_KEY = "dinogym_token";
const KEEP_KEY = "dinogym_keep";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token, keep = false) {
  if (keep) localStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.setItem(TOKEN_KEY, token);
}

export function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

export function getKeepSession() {
  return localStorage.getItem(KEEP_KEY) === "true";
}

export function setKeepSession(val) {
  localStorage.setItem(KEEP_KEY, String(val));
}
