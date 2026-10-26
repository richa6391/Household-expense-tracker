/**
 * All money maths for PaySlip for Help. Pure functions only: no DOM, no
 * storage, no AI. Everything here is covered by tests/calc.test.ts.
 */
import type { Entry, EntryType, Helper, Payday } from "./types";

// ---------- Money ----------

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** ₹18,000 (Indian grouping: ₹1,40,000). Negative values get a leading minus. */
export function formatINR(n: number): string {
  const v = Math.round(Number.isFinite(n) ? n : 0);
  return (v < 0 ? "−₹" : "₹") + inr.format(Math.abs(v));
}

/** Parse what a person typed into a money box. Empty / junk → 0, never negative. */
export function parseAmount(s: string | number | null | undefined): number {
  if (typeof s === "number") return Number.isFinite(s) && s > 0 ? Math.round(s) : 0;
  if (!s) return 0;
  const n = Number(String(s).replace(/[₹,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

export function roundTo10(n: number): number {
  return Math.round(n / 10) * 10;
}

// ---------- Balances ----------

export interface Balances {
  advance: number;
  loan: number;
  total: number;
}

function sumOf(entries: Entry[], type: EntryType): number {
  return entries.reduce((s, e) => (e.type === type ? s + e.amount : s), 0);
}

/**
 * advance = Σadvance − Σadvance_cut, loan = Σloan − Σloan_cut.
 * bonus, salary and leave never count as money owed.
 */
export function balances(entries: Entry[], helperId?: string): Balances {
  const list = helperId ? entries.filter((e) => e.helperId === helperId) : entries;
  const advance = sumOf(list, "advance") - sumOf(list, "advance_cut");
  const loan = sumOf(list, "loan") - sumOf(list, "loan_cut");
  return { advance, loan, total: advance + loan };
}

/** What the balance would be after adding one more entry. */
export function balancesAfter(entries: Entry[], helperId: string, type: EntryType, amount: number): Balances {
  const probe: Entry = {
    id: "_probe",
    helperId,
    date: "",
    type,
    amount,
    reason: "",
    note: "",
    source: "manual",
    createdAt: "",
  };
  return balances([...entries, probe], helperId);
}

export function isOverSalary(amount: number, salary: number): boolean {
  return salary > 0 && amount > salary;
}

// ---------- Payday ----------

/** Leave cut = max(leaveDays − paidLeave, 0) × salary ÷ 30, rounded to nearest ₹10. */
export function leaveCut(leaveDays: number, paidLeave: number, salary: number): number {
  const extra = extraLeaveDays(leaveDays, paidLeave);
  return roundTo10((extra * salary) / 30);
}

export function extraLeaveDays(leaveDays: number, paidLeave: number): number {
  return Math.max((leaveDays || 0) - (paidLeave || 0), 0);
}

export function perDayRate(salary: number): number {
  return roundTo10(salary / 30);
}

export function defaultAdvanceCut(advanceOwed: number, salary: number): number {
  return Math.max(Math.min(advanceOwed, salary), 0);
}

export interface PaydayInput {
  salary: number;
  advanceCut: number;
  loanCut: number;
  leaveCut: number;
  advanceOwed: number;
  loanOwed: number;
}

export interface PaydayResult {
  pay: number;
  advanceAfter: number;
  loanAfter: number;
  advanceError: string | null;
  loanError: string | null;
  negative: boolean;
  canMarkPaid: boolean;
}

/** Pay = salary − advanceCut − loanCut − leaveCut, plus the rules that block Mark paid. */
export function computePayday(i: PaydayInput): PaydayResult {
  const pay = i.salary - i.advanceCut - i.loanCut - i.leaveCut;
  const advanceError =
    i.advanceCut > Math.max(i.advanceOwed, 0) ? `Max is ${formatINR(Math.max(i.advanceOwed, 0))} (advance owed)` : null;
  const loanError = i.loanCut > Math.max(i.loanOwed, 0) ? `Max is ${formatINR(Math.max(i.loanOwed, 0))} (loan owed)` : null;
  const negative = pay < 0;
  return {
    pay,
    advanceAfter: i.advanceOwed - i.advanceCut,
    loanAfter: i.loanOwed - i.loanCut,
    advanceError,
    loanError,
    negative,
    canMarkPaid: !advanceError && !loanError && !negative && i.salary > 0,
  };
}

export interface MarkPaidInput {
  helper: Helper;
  entries: Entry[];
  date: string;
  monthLabel: string;
  advanceCut: number;
  loanCut: number;
  leaveDays: number;
  leaveCut: number;
  note: string;
  now: string;
  newId: () => string;
}

/**
 * Mark paid: advance_cut and loan_cut entries (only if > 0), a salary entry
 * (source payday) for the amount handed over, and a Payday record.
 * Throws if the payday is not allowed by computePayday.
 */
export function markPaid(i: MarkPaidInput): { entries: Entry[]; payday: Payday } {
  const owed = balances(i.entries, i.helper.id);
  const r = computePayday({
    salary: i.helper.salary,
    advanceCut: i.advanceCut,
    loanCut: i.loanCut,
    leaveCut: i.leaveCut,
    advanceOwed: owed.advance,
    loanOwed: owed.loan,
  });
  if (!r.canMarkPaid) throw new Error("Payday is not valid");

  const base = { helperId: i.helper.id, date: i.date, note: "", source: "payday" as const, createdAt: i.now };
  const out: Entry[] = [];
  if (i.advanceCut > 0)
    out.push({ ...base, id: i.newId(), type: "advance_cut", amount: i.advanceCut, reason: `${i.monthLabel} cut` });
  if (i.loanCut > 0)
    out.push({ ...base, id: i.newId(), type: "loan_cut", amount: i.loanCut, reason: `${i.monthLabel} instalment` });
  out.push({ ...base, id: i.newId(), type: "salary", amount: r.pay, reason: `${i.monthLabel} salary`, note: i.note });

  const payday: Payday = {
    id: i.newId(),
    helperId: i.helper.id,
    date: i.date,
    monthLabel: i.monthLabel,
    salary: i.helper.salary,
    advanceCut: i.advanceCut,
    loanCut: i.loanCut,
    leaveDays: i.leaveDays,
    leaveCut: i.leaveCut,
    pay: r.pay,
    note: i.note,
    advanceAfter: r.advanceAfter,
    loanAfter: r.loanAfter,
  };
  return { entries: out, payday };
}

// ---------- Dates ----------

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
export const MONTHS_HI = [
  "जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून",
  "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर",
];

function parts(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, m, d];
}

function iso(y: number, m: number, d: number): string {
  // m is 1-based and may overflow; normalise.
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

export function isValidISODate(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = parts(s);
  return iso(y, m, d) === s;
}

/** "1 Nov" */
export function shortDate(s: string): string {
  const [, m, d] = parts(s);
  return `${d} ${MONTHS[m - 1]}`;
}

/** "1 Nov 2026" */
export function longDate(s: string): string {
  const [y, m, d] = parts(s);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function hindiDate(s: string): string {
  const [, m, d] = parts(s);
  return `${d} ${MONTHS_HI[m - 1]}`;
}

export function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th";
  return `${n}${s}`;
}

/**
 * The next salary due date. With no payday recorded yet: the first payday on
 * or after today. Otherwise: the payday in the month after the last one paid.
 */
export function nextPaydayDate(paydayDay: number, today: string, paydays: Payday[] = []): string {
  if (paydays.length) {
    const last = paydays.reduce((a, p) => (p.date > a ? p.date : a), paydays[0].date);
    const [y, m] = parts(last);
    return iso(y, m + 1, paydayDay);
  }
  const [y, m, d] = parts(today);
  return d <= paydayDay ? iso(y, m, paydayDay) : iso(y, m + 1, paydayDay);
}

/**
 * Which month's salary is due on a given payday. Early-month paydays (1st–15th)
 * pay for the previous month; later ones pay for the current month.
 * Returns the month index (0–11) and year.
 */
export function salaryMonth(dueDate: string, paydayDay: number): { month: number; year: number } {
  const [y, m] = parts(dueDate);
  if (paydayDay <= 15) {
    return m === 1 ? { month: 11, year: y - 1 } : { month: m - 2, year: y };
  }
  return { month: m - 1, year: y };
}

// ---------- Chart ----------

export interface MonthBar {
  key: string; // YYYY-MM
  label: string; // "Oct"
  given: number;
  recovered: number;
}

/**
 * Last `n` months ending with today's month. given = advance + loan,
 * recovered = advance_cut + loan_cut. Opening balances are excluded.
 */
export function givenVsRecovered(entries: Entry[], today: string, n = 6): MonthBar[] {
  const [y, m] = parts(today);
  const bars: MonthBar[] = [];
  for (let k = n - 1; k >= 0; k--) {
    const key = iso(y, m - k, 1).slice(0, 7);
    bars.push({ key, label: MONTHS[Number(key.slice(5, 7)) - 1], given: 0, recovered: 0 });
  }
  const byKey = new Map(bars.map((b) => [b.key, b]));
  for (const e of entries) {
    if (e.source === "opening") continue;
    const b = byKey.get(e.date.slice(0, 7));
    if (!b) continue;
    if (e.type === "advance" || e.type === "loan") b.given += e.amount;
    else if (e.type === "advance_cut" || e.type === "loan_cut") b.recovered += e.amount;
  }
  return bars;
}

// ---------- Misc ----------

/** Newest first: by date, then by createdAt. */
export function sortEntries(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) =>
    a.date === b.date ? (a.createdAt < b.createdAt ? 1 : -1) : a.date < b.date ? 1 : -1
  );
}

/** Bonuses given after the previous payday, up to and including this one. */
export function bonusesSince(entries: Entry[], helperId: string, after: string | null, upTo: string): number {
  return entries
    .filter((e) => e.helperId === helperId && e.type === "bonus" && (!after || e.date > after) && e.date <= upTo)
    .reduce((s, e) => s + e.amount, 0);
}
