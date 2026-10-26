export type Role = "Maid" | "Cook" | "Driver" | "Nanny" | "Other";
export const ROLES: Role[] = ["Maid", "Cook", "Driver", "Nanny", "Other"];

export type EntryType =
  | "advance"
  | "loan"
  | "bonus"
  | "salary"
  | "leave"
  | "advance_cut"
  | "loan_cut";

export type EntrySource = "screenshot" | "text" | "manual" | "opening" | "payday";

export interface Helper {
  id: string;
  name: string;
  role: Role;
  salary: number;
  paydayDay: number; // 1–28
  createdAt: string;
}

export interface Entry {
  id: string;
  helperId: string;
  date: string; // YYYY-MM-DD
  type: EntryType;
  amount: number;
  reason: string;
  note: string;
  source: EntrySource;
  createdAt: string;
}

export interface Payday {
  id: string;
  helperId: string;
  date: string;
  monthLabel: string;
  salary: number;
  advanceCut: number;
  loanCut: number;
  leaveDays: number;
  leaveCut: number;
  pay: number;
  note: string;
  advanceAfter: number;
  loanAfter: number;
}

export interface AppData {
  version: 1;
  helpers: Helper[];
  entries: Entry[];
  paydays: Payday[];
}

/** Types the AI may return (cuts only come from payday). */
export type AiType = "advance" | "loan" | "bonus" | "salary" | "leave";

export interface ExtractResult {
  readable: boolean;
  amount: number | null;
  type: AiType;
  date: string | null;
  reason: string;
  request_only: boolean;
  helper_name: string | null;
  confidence: "high" | "medium" | "low";
}
