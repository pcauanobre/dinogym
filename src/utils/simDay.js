const KEY = "dinogym_simday_offset";

export function getSimDayOffset() {
  const v = parseInt(localStorage.getItem(KEY) || "0", 10);
  return isNaN(v) ? 0 : ((v % 7) + 7) % 7;
}

export function setSimDayOffset(offset) {
  const safe = ((offset % 7) + 7) % 7;
  localStorage.setItem(KEY, String(safe));
}

export function advanceSimDay() {
  setSimDayOffset(getSimDayOffset() + 1);
}

export function resetSimDay() {
  localStorage.removeItem(KEY);
}

export function getSimDay() {
  return (new Date().getDay() + getSimDayOffset()) % 7;
}
