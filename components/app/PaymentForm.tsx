"use client";

import { useState } from "react";
import { balances, balancesAfter, formatINR, isOverSalary, isValidISODate, parseAmount } from "@/lib/calc";
import { newId } from "@/lib/storage";
import type { AiType, Entry } from "@/lib/types";
import { Banner, BottomBar, type Ctx, MoneyInput, TopBar, TYPE_LABEL, type View } from "./ui";

const TYPES: AiType[] = ["advance", "loan", "bonus", "salary", "leave"];

export default function PaymentForm({ ctx, view }: { ctx: Ctx; view: Extract<View, { name: "form" }> }) {
  const helper = ctx.helper(view.helperId);
  const d = view.draft || {};
  const [amount, setAmount] = useState(d.amount || "");
  const [type, setType] = useState<AiType | null>(d.type ?? null);
  const [date, setDate] = useState(d.date || ctx.today);
  const [reason, setReason] = useState(d.reason || "");
  const [note, setNote] = useState(d.note || "");
  if (!helper) return null;

  const amt = parseAmount(amount);
  const now = balances(ctx.data.entries, helper.id);
  const after = type ? balancesAfter(ctx.data.entries, helper.id, type, amt) : now;
  const dateOk = isValidISODate(date);
  const canSave = !!type && amt > 0 && dateOk;

  const save = () => {
    if (!canSave || !type) return;
    const e: Entry = {
      id: newId(),
      helperId: helper.id,
      date,
      type,
      amount: amt,
      reason: reason.trim(),
      note: note.trim(),
      source: view.source,
      createdAt: new Date().toISOString(),
    };
    ctx.update((data) => ({ ...data, entries: [...data.entries, e] }));
    ctx.setRecord({ image: null, text: "" });
    const label = type === "bonus" ? "bonus" : TYPE_LABEL[type].toLowerCase();
    ctx.toast(`Saved: ${formatINR(amt)} ${label}${e.reason ? `, ${e.reason}` : ""}`);
    ctx.reset([{ name: "home" }, { name: "ledger", helperId: helper.id }]);
  };

  return (
    <>
      <TopBar title={view.mode === "ai" ? "Check the details" : "Payment details"} sub={`${helper.name} · ${helper.role}`} onBack={ctx.back} />

      {view.notices?.map((n, i) => (
        <Banner key={i} kind={n.kind}>{n.text}</Banner>
      ))}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="field">
          <label className="lbl" htmlFor="amount">
            {type === "leave" ? `Leave cut for ${helper.name}` : `Amount you gave ${helper.name}`}
          </label>
          <MoneyInput id="amount" big value={amount} onChange={setAmount} />
          {isOverSalary(amt, helper.salary) && (
            <div className="banner warn" role="alert" style={{ marginTop: 10, marginBottom: 0 }}>
              More than 1 month&apos;s salary ({formatINR(helper.salary)}). Check the amount. You can still save.
            </div>
          )}
        </div>

        <div className="field">
          <span className="lbl" id="type-lbl">Type</span>
          <div className="chips" role="group" aria-labelledby="type-lbl">
            {TYPES.map((t) => (
              <button type="button" key={t} className="chip" aria-pressed={type === t} onClick={() => setType(t)}>
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>
          {view.aiType && <span className="hint">AI guessed {TYPE_LABEL[view.aiType]}</span>}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label className="field">
            <span className="lbl">Date</span>
            <input type="date" className="input" value={date} max={ctx.today} onChange={(e) => setDate(e.target.value)} />
            {!dateOk && <span className="err">Pick a date</span>}
          </label>
          <label className="field">
            <span className="lbl">Reason</span>
            <input className="input" value={reason} maxLength={40} onChange={(e) => setReason(e.target.value)} placeholder="e.g. school fees" />
          </label>
        </div>

        <label className="field">
          <span className="lbl">Note <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></span>
          <textarea className="textarea" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} style={{ minHeight: 64 }} />
        </label>

        {type && (
          <div className="card" aria-live="polite">
            <p className="label-caps">After saving</p>
            {type === "advance" || type === "loan" ? (
              <div className="row">
                <span>{type === "advance" ? "Advance owed" : "Loan owed"}</span>
                <strong data-testid="after-saving">
                  {formatINR(type === "advance" ? now.advance : now.loan)} → {formatINR(type === "advance" ? after.advance : after.loan)}
                </strong>
              </div>
            ) : (
              <>
                <div className="row">
                  <span>Owes you</span>
                  <strong data-testid="after-saving">{formatINR(now.total)} (no change)</strong>
                </div>
                <p className="muted small" style={{ margin: "6px 0 0" }}>
                  {type === "bonus" ? "Bonus or gifts are never counted as money owed." : "This is kept as a record. It doesn't change what they owe."}
                </p>
              </>
            )}
          </div>
        )}

        <BottomBar>
          {!type && <p className="hint-err">Choose a type to save</p>}
          <button type="submit" className="btn btn-primary" disabled={!canSave}>
            Save
          </button>
        </BottomBar>
      </form>
    </>
  );
}
