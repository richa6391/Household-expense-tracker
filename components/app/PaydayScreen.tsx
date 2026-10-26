"use client";

import { useState } from "react";
import {
  balances,
  computePayday,
  defaultAdvanceCut,
  formatINR,
  leaveCut as calcLeaveCut,
  markPaid,
  MONTHS_LONG,
  nextPaydayDate,
  parseAmount,
  perDayRate,
  salaryMonth,
  shortDate,
} from "@/lib/calc";
import { newId } from "@/lib/storage";
import { BottomBar, type Ctx, MoneyInput, TopBar } from "./ui";

export default function PaydayScreen({ ctx, helperId }: { ctx: Ctx; helperId: string }) {
  const helper = ctx.helper(helperId);
  const owed = balances(ctx.data.entries, helperId);
  const [advanceCut, setAdvanceCut] = useState(String(defaultAdvanceCut(owed.advance, helper?.salary || 0)));
  const [loanCut, setLoanCut] = useState("0");
  const [leaveDays, setLeaveDays] = useState("0");
  const [leaveCut, setLeaveCut] = useState("0");
  const [note, setNote] = useState("");
  if (!helper) return null;

  const due = nextPaydayDate(helper.paydayDay, ctx.today, ctx.data.paydays.filter((p) => p.helperId === helperId));
  const sm = salaryMonth(due, helper.paydayDay);
  const monthLabel = `${MONTHS_LONG[sm.month]} ${sm.year}`;

  const days = Number(leaveDays) || 0;
  const r = computePayday({
    salary: helper.salary,
    advanceCut: parseAmount(advanceCut),
    loanCut: parseAmount(loanCut),
    leaveCut: parseAmount(leaveCut),
    advanceOwed: owed.advance,
    loanOwed: owed.loan,
  });

  const onLeaveDays = (v: string) => {
    const clean = v.replace(/[^\d]/g, "").slice(0, 2);
    setLeaveDays(clean);
    setLeaveCut(String(calcLeaveCut(Number(clean) || 0, helper.salary)));
  };

  const pay = () => {
    if (!r.canMarkPaid) return;
    const out = markPaid({
      helper,
      entries: ctx.data.entries,
      date: due,
      monthLabel,
      advanceCut: parseAmount(advanceCut),
      loanCut: parseAmount(loanCut),
      leaveDays: days,
      leaveCut: parseAmount(leaveCut),
      note: note.trim(),
      now: new Date().toISOString(),
      newId,
    });
    ctx.update((d) => ({ ...d, entries: [...d.entries, ...out.entries], paydays: [...d.paydays, out.payday] }));
    ctx.reset([{ name: "home" }, { name: "paid", paydayId: out.payday.id }]);
  };

  const parts = [
    formatINR(helper.salary),
    parseAmount(advanceCut) ? `− ${formatINR(parseAmount(advanceCut))} advance` : "",
    parseAmount(loanCut) ? `− ${formatINR(parseAmount(loanCut))} loan` : "",
    parseAmount(leaveCut) ? `− ${formatINR(parseAmount(leaveCut))} leave` : "",
  ].filter(Boolean);

  return (
    <>
      <TopBar title={`Payday · ${helper.name}`} sub={`${MONTHS_LONG[sm.month]} salary, due ${shortDate(due)}`} onBack={ctx.back} />

      <div className="card">
        <div className="pay-row">
          <span className="lbl">Salary</span>
          <span className="static">{formatINR(helper.salary)}</span>
        </div>

        <div className="pay-row">
          <label className="lbl" htmlFor="adv-cut">Advance cut</label>
          <MoneyInput id="adv-cut" value={advanceCut} onChange={setAdvanceCut} invalid={!!r.advanceError} describedBy="adv-cut-hint" />
          <span className="hint" id="adv-cut-hint">{formatINR(owed.advance)} owed · max {formatINR(Math.max(owed.advance, 0))}</span>
          {r.advanceError && <span className="err" role="alert">{r.advanceError}</span>}
        </div>

        <div className="pay-row">
          <label className="lbl" htmlFor="loan-cut">Loan instalment</label>
          <MoneyInput id="loan-cut" value={loanCut} onChange={setLoanCut} invalid={!!r.loanError} describedBy="loan-cut-hint" />
          <span className="hint" id="loan-cut-hint">as agreed · {formatINR(owed.loan)} loan owed</span>
          {r.loanError && <span className="err" role="alert">{r.loanError}</span>}
        </div>

        <div className="pay-row">
          <label className="lbl" htmlFor="leave-days">Leave days taken</label>
          <input id="leave-days" className="input" inputMode="numeric" value={leaveDays} onChange={(e) => onLeaveDays(e.target.value)} aria-describedby="leave-days-hint" />
          <span className="hint" id="leave-days-hint">Each day is cut at salary ÷ 30</span>
        </div>

        <div className="pay-row">
          <label className="lbl" htmlFor="leave-cut">Leave cut</label>
          <MoneyInput id="leave-cut" value={leaveCut} onChange={setLeaveCut} describedBy="leave-cut-hint" />
          <span className="hint" id="leave-cut-hint">
            {days} day{days === 1 ? "" : "s"} × {formatINR(perDayRate(helper.salary))} · auto, editable
          </span>
        </div>
      </div>

      <div className={`card ${r.negative ? "red" : "blue"}`} aria-live="polite">
        <div className={r.negative ? "" : "muted"} style={{ fontSize: 15 }}>Pay {helper.name}</div>
        <div className="big" data-testid="pay-amount">{formatINR(r.pay)}</div>
        {r.negative ? (
          <p style={{ margin: "6px 0 0", fontWeight: 600 }} role="alert">Cuts are more than the salary. Lower the cuts.</p>
        ) : (
          <p className="breakdown muted" style={{ margin: "6px 0 0" }}>{parts.join(" ")}</p>
        )}
        <div className="tiles" style={{ marginTop: 12 }}>
          <div className="tile">
            <div className="k">Advance after</div>
            <div className="v" data-testid="advance-after">{formatINR(r.advanceAfter)}</div>
          </div>
          <div className="tile">
            <div className="k">Loan after</div>
            <div className="v" data-testid="loan-after">{formatINR(r.loanAfter)}</div>
          </div>
        </div>
      </div>

      <label className="field">
        <span className="lbl">Note <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></span>
        <input className="input" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Paid in cash" />
      </label>

      <BottomBar>
        <button type="button" className="btn btn-primary" disabled={!r.canMarkPaid} onClick={pay}>
          Mark paid · {formatINR(r.pay)}
        </button>
      </BottomBar>
    </>
  );
}
