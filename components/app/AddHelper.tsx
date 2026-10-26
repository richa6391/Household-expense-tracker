"use client";

import { useState } from "react";
import { ordinal, parseAmount } from "@/lib/calc";
import { newId } from "@/lib/storage";
import { ROLES, type Entry, type Helper, type Role } from "@/lib/types";
import { BottomBar, type Ctx, MoneyInput, TopBar } from "./ui";

export default function AddHelper({ ctx }: { ctx: Ctx }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("Maid");
  const [salary, setSalary] = useState("");
  const [payday, setPayday] = useState("");
  const [owes, setOwes] = useState(false);
  const [advance, setAdvance] = useState("");
  const [loan, setLoan] = useState("");

  const ready = name.trim() !== "" && parseAmount(salary) > 0 && payday !== "";

  const save = () => {
    if (!ready) return;
    const now = new Date().toISOString();
    const helper: Helper = {
      id: newId(),
      name: name.trim(),
      role,
      salary: parseAmount(salary),
      paydayDay: Number(payday),
      createdAt: now,
    };
    const opening: Entry[] = [];
    const base = { helperId: helper.id, date: ctx.today, note: "", source: "opening" as const, createdAt: now };
    if (owes && parseAmount(advance) > 0)
      opening.push({ ...base, id: newId(), type: "advance", amount: parseAmount(advance), reason: "Opening balance" });
    if (owes && parseAmount(loan) > 0)
      opening.push({ ...base, id: newId(), type: "loan", amount: parseAmount(loan), reason: "Opening balance" });
    ctx.update((d) => ({ ...d, helpers: [...d.helpers, helper], entries: [...d.entries, ...opening] }));
    ctx.toast(`Added ${helper.name}`);
    ctx.reset([{ name: "home" }]);
  };

  return (
    <>
      <TopBar title="Add helper" onBack={ctx.back} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <label className="field">
          <span className="lbl">Name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sunita" autoComplete="off" maxLength={40} />
        </label>

        <fieldset className="field" style={{ border: 0, padding: 0, margin: "0 0 16px" }}>
          <legend className="lbl" style={{ fontWeight: 600, fontSize: 15, marginBottom: 6, padding: 0 }}>Role</legend>
          <div className="chips">
            {ROLES.map((r) => (
              <button type="button" key={r} className="chip" aria-pressed={role === r} onClick={() => setRole(r)}>
                {r}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="field">
          <label className="lbl" htmlFor="salary">Monthly salary</label>
          <MoneyInput id="salary" value={salary} onChange={setSalary} />
        </div>

        <label className="field">
          <span className="lbl">Payday</span>
          <select className="select" value={payday} onChange={(e) => setPayday(e.target.value)}>
            <option value="">Choose a day</option>
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {ordinal(d)} of every month
              </option>
            ))}
          </select>
        </label>

        <div className="card">
          <label className="switch-row">
            <span>
              <strong>Already owes you money?</strong>
              <span className="muted small" style={{ display: "block" }}>Add what they owe today as a starting balance.</span>
            </span>
            <span className="switch">
              <input type="checkbox" role="switch" checked={owes} onChange={(e) => setOwes(e.target.checked)} />
              <span className="track" />
            </span>
          </label>
          {owes && (
            <div style={{ marginTop: 12 }}>
              <div className="field">
                <label className="lbl" htmlFor="adv-owed">Advance owed</label>
                <MoneyInput id="adv-owed" value={advance} onChange={setAdvance} />
                <span className="hint">Cut from next salary.</span>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="lbl" htmlFor="loan-owed">Loan owed</label>
                <MoneyInput id="loan-owed" value={loan} onChange={setLoan} />
                <span className="hint">Paid back in instalments.</span>
              </div>
            </div>
          )}
        </div>

        <BottomBar>
          <button type="submit" className="btn btn-primary" disabled={!ready}>
            Save helper
          </button>
        </BottomBar>
      </form>
    </>
  );
}
