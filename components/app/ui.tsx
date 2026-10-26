"use client";

import type { ReactNode } from "react";
import type { AiType, AppData, EntrySource, Helper } from "@/lib/types";
import { Back, Info, Sparkle, Warn } from "../Icons";

// ---------- Navigation ----------

export interface Draft {
  amount: string;
  type: AiType | null;
  date: string;
  reason: string;
  note: string;
}

export type Notice = { kind: "info" | "warn" | "ai"; text: string };

export type View =
  | { name: "home" }
  | { name: "add" }
  | { name: "record"; helperId: string }
  | {
      name: "form";
      helperId: string;
      mode: "ai" | "manual";
      source: EntrySource;
      draft?: Partial<Draft>;
      notices?: Notice[];
      aiType?: AiType;
    }
  | { name: "ledger"; helperId: string }
  | { name: "payday"; helperId: string }
  | { name: "paid"; paydayId: string };

export interface Ctx {
  data: AppData;
  today: string;
  update: (fn: (d: AppData) => AppData) => void;
  push: (v: View) => void;
  back: () => void;
  reset: (stack: View[]) => void;
  toast: (msg: string) => void;
  helper: (id: string) => Helper | undefined;
  record: { image: string | null; text: string };
  setRecord: (r: { image: string | null; text: string }) => void;
}

// ---------- Pieces ----------

export function TopBar({ title, sub, onBack }: { title: ReactNode; sub?: ReactNode; onBack?: () => void }) {
  return (
    <header className="topbar">
      {onBack && (
        <button type="button" className="icon-btn" aria-label="Back" onClick={onBack} style={{ marginLeft: -10 }}>
          <Back size={24} />
        </button>
      )}
      <div>
        <h1>{title}</h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
    </header>
  );
}

export function BottomBar({ children }: { children: ReactNode }) {
  return (
    <div className="bottom-bar">
      <div className="bottom-bar-inner">{children}</div>
    </div>
  );
}

export function Banner({ kind, children }: { kind: "info" | "warn" | "ai" | "error"; children: ReactNode }) {
  const Icon = kind === "warn" || kind === "error" ? Warn : kind === "ai" ? Sparkle : Info;
  return (
    <div className={`banner ${kind}`} role={kind === "error" || kind === "warn" ? "alert" : "status"}>
      <Icon size={18} />
      <div>{children}</div>
    </div>
  );
}

export function MoneyInput({
  id,
  value,
  onChange,
  big,
  invalid,
  label,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  big?: boolean;
  invalid?: boolean;
  label?: string;
  describedBy?: string;
}) {
  return (
    <div className={`money${big ? " big-amt" : ""}`}>
      <span aria-hidden="true">₹</span>
      <input
        id={id}
        className={`input${invalid ? " has-err" : ""}`}
        inputMode="numeric"
        autoComplete="off"
        value={value}
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, "").slice(0, 8))}
        placeholder="0"
      />
    </div>
  );
}

export function initial(name: string): string {
  return (name.trim()[0] || "?").toUpperCase();
}

export const TYPE_LABEL: Record<string, string> = {
  advance: "Advance",
  loan: "Loan",
  bonus: "Bonus / gift",
  salary: "Salary",
  leave: "Leave cut",
  advance_cut: "Advance cut",
  loan_cut: "Loan instalment",
};

export const SOURCE_LABEL: Record<EntrySource, string> = {
  screenshot: "from screenshot",
  text: "typed",
  manual: "entered",
  opening: "opening balance",
  payday: "payday",
};
