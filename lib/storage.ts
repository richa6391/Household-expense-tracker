import type { AppData } from "./types";

export const DATA_KEY = "payslip-for-help:v1";
const AI_KEY = "payslip-for-help:ai-reads";
export const AI_DAILY_LIMIT = 20;

export function emptyData(): AppData {
  return { version: 1, helpers: [], entries: [], paydays: [] };
}

export function isAppData(x: unknown): x is AppData {
  const d = x as AppData;
  return !!d && d.version === 1 && Array.isArray(d.helpers) && Array.isArray(d.entries) && Array.isArray(d.paydays);
}

export function loadData(): AppData {
  try {
    const raw = window.localStorage.getItem(DATA_KEY);
    if (!raw) return emptyData();
    const parsed = JSON.parse(raw);
    return isAppData(parsed) ? parsed : emptyData();
  } catch {
    return emptyData();
  }
}

/** Returns false when the browser refuses to save (private mode, full storage). */
export function saveData(data: AppData): boolean {
  try {
    window.localStorage.setItem(DATA_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function hasData(): boolean {
  try {
    return loadData().helpers.length > 0;
  } catch {
    return false;
  }
}

export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function readAiCount(): number {
  try {
    const raw = window.localStorage.getItem(AI_KEY);
    if (!raw) return 0;
    const v = JSON.parse(raw) as { date: string; count: number };
    return v.date === localToday() ? v.count : 0;
  } catch {
    return 0;
  }
}

export function aiReadsLeft(): number {
  return Math.max(AI_DAILY_LIMIT - readAiCount(), 0);
}

export function countAiRead(): void {
  try {
    window.localStorage.setItem(AI_KEY, JSON.stringify({ date: localToday(), count: readAiCount() + 1 }));
  } catch {
    // Counting is best effort; the server has its own validation.
  }
}

export function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
}
