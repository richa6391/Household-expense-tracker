"use client";

import { useState } from "react";
import {
  balances,
  defaultAdvanceCut,
  formatINR,
  lastPayday,
  MONTHS_LONG,
  nextPaydayDate,
  ordinal,
  salaryMonth,
  shortDate,
} from "@/lib/calc";
import type { Helper } from "@/lib/types";
import { Check, Chevron, Close, Plus, Search, Users } from "../Icons";
import { BottomBar, type Ctx, initial } from "./ui";

type Tab = "helpers" | "payday";
const TAB_KEY = "payslip-for-help:home-tab";

function loadTab(): Tab {
  try {
    return window.localStorage.getItem(TAB_KEY) === "payday" ? "payday" : "helpers";
  } catch {
    return "helpers";
  }
}

export default function Home({ ctx }: { ctx: Ctx }) {
  const { data, today } = ctx;
  const [query, setQuery] = useState("");
  const [tab, setTabState] = useState<Tab>(loadTab);
  const setTab = (t: Tab) => {
    setTabState(t);
    try {
      window.localStorage.setItem(TAB_KEY, t);
    } catch {
      // Remembering the tab is only a convenience.
    }
  };

  if (!data.helpers.length) {
    return (
      <>
        <div className="empty-ic">
          <Users size={36} />
        </div>
        <h2 className="center">Add your first helper</h2>
        <p className="center muted">Set up their salary once. After that, every advance and payday takes a few taps.</p>
        <ol className="steps">
          <li><span><strong>Add your helper</strong> with salary and payday.</span></li>
          <li><span><strong>Record money you give</strong> from a WhatsApp or UPI screenshot, or type it.</span></li>
          <li><span><strong>On payday</strong>, we work out the pay and a statement to share.</span></li>
        </ol>
        <BottomBar>
          <button type="button" className="btn btn-primary" onClick={() => ctx.push({ name: "add" })}>
            <Plus /> Add helper
          </button>
        </BottomBar>
      </>
    );
  }

  const total = balances(data.entries).total;
  const next = data.helpers
    .map((h) => ({ h, date: nextPaydayDate(h.paydayDay, today, data.paydays.filter((p) => p.helperId === h.id)) }))
    .sort((a, b) => (a.date < b.date ? -1 : 1))[0];
  const q = query.trim().toLowerCase();
  const shown = q
    ? data.helpers.filter((h) => h.name.toLowerCase().includes(q) || h.role.toLowerCase().includes(q))
    : data.helpers;

  return (
    <>
      <header className="topbar">
        <h1>{tab === "helpers" ? "My helpers" : "Payday"}</h1>
      </header>

      <div className="seg home-tabs" role="tablist" aria-label="Home">
        <button type="button" role="tab" aria-selected={tab === "helpers"} aria-pressed={tab === "helpers"} onClick={() => setTab("helpers")}>
          My helpers
        </button>
        <button type="button" role="tab" aria-selected={tab === "payday"} aria-pressed={tab === "payday"} onClick={() => setTab("payday")}>
          Payday
        </button>
      </div>

      {tab === "payday" && <PaydaySummary rows={paydayRows(ctx, data.helpers)} />}

      {tab === "helpers" && (
        <div className="card blue">
          <div className="muted small">Total your helpers owe you</div>
          <div className="big" data-testid="total-owed">{formatINR(total)}</div>
          {next && (
            <div className="muted small" style={{ marginTop: 8 }}>
              Next payday: {next.h.name} · {shortDate(next.date)}
            </div>
          )}
        </div>
      )}

      <div className="search">
        <Search size={18} className="search-ic" />
        <input
          type="search"
          className="input"
          placeholder="Search by name or role"
          aria-label="Search helpers"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button type="button" className="icon-btn search-clear" aria-label="Clear search" onClick={() => setQuery("")}>
            <Close size={18} />
          </button>
        )}
      </div>

      {shown.length === 0 && (
        <p className="muted center" style={{ margin: "16px 0" }}>
          No helper matches “{query.trim()}”.
        </p>
      )}

      {tab === "payday" && <PaydayList ctx={ctx} rows={paydayRows(ctx, shown)} />}

      {tab === "helpers" &&
        shown.map((h) => {
          const b = balances(data.entries, h.id);
          return (
            <button
              type="button"
              key={h.id}
              className="card helper-card"
              onClick={() => ctx.push({ name: "ledger", helperId: h.id })}
              aria-label={`${h.name}, owes you ${formatINR(b.total)}. Open ledger`}
            >
              <span className="avatar">{initial(h.name)}</span>
              <span className="grow">
                <span className="name" style={{ display: "block" }}>{h.name}</span>
                <span className="muted small" style={{ display: "block" }}>
                  {h.role} · {formatINR(h.salary)} · pay on {ordinal(h.paydayDay)}
                </span>
                <span style={{ display: "block", fontWeight: 700, margin: "6px 0" }}>Owes you {formatINR(b.total)}</span>
                <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span className="pill adv">Advance {formatINR(b.advance)}</span>
                  <span className="pill loan">Loan {formatINR(b.loan)}</span>
                </span>
              </span>
              <Chevron className="muted" />
            </button>
          );
        })}

      {tab === "helpers" && (
        <>
          <button type="button" className="btn btn-dashed" onClick={() => ctx.push({ name: "add" })}>
            <Plus /> Add another helper
          </button>

          <BottomBar>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => ctx.push({ name: "record", helperId: data.helpers[0].id })}
            >
              Record payment
            </button>
          </BottomBar>
        </>
      )}
    </>
  );
}

type PaydayRow = ReturnType<typeof paydayRows>[number];

/**
 * This cycle's salary for each helper: due (with an estimated pay) or "paid"
 * once the latest payday covers the current cycle. Unpaid first, then by due date.
 */
function paydayRows(ctx: Ctx, helpers: Helper[]) {
  const { data, today } = ctx;
  return helpers
    .map((h) => {
      const mine = data.paydays.filter((p) => p.helperId === h.id);
      const due = nextPaydayDate(h.paydayDay, today, mine);
      const last = lastPayday(mine, h.id);
      // Paid for now when a payday is recorded and the next one is still ahead.
      const paid = !!last && due > today;
      const owed = balances(data.entries, h.id);
      const cut = defaultAdvanceCut(owed.advance, h.salary);
      const sm = salaryMonth(due, h.paydayDay);
      return { h, due, last, paid, owed, cut, pay: h.salary - cut, month: MONTHS_LONG[sm.month] };
    })
    .sort((a, b) => (a.paid === b.paid ? (a.due < b.due ? -1 : a.due > b.due ? 1 : 0) : a.paid ? 1 : -1));
}

function PaydaySummary({ rows }: { rows: PaydayRow[] }) {
  const unpaid = rows.filter((r) => !r.paid);
  return (
    <div className="card blue">
      <div className="muted small">{unpaid.length ? "Still to pay (estimate)" : "Everyone is paid"}</div>
      <div className="big" data-testid="to-pay">{formatINR(unpaid.reduce((s, r) => s + r.pay, 0))}</div>
      <div className="muted small" style={{ marginTop: 8 }}>
        {rows.length - unpaid.length} of {rows.length} paid
      </div>
    </div>
  );
}

function PaydayList({ ctx, rows }: { ctx: Ctx; rows: PaydayRow[] }) {
  const { today } = ctx;
  return (
    <>
      {rows.map((r) => (
        <div key={r.h.id} className="card payday-card" data-testid={`payday-row-${r.h.name}`}>
          <div className="payday-head">
            <span className="avatar">{initial(r.h.name)}</span>
            <span className="grow">
              <span className="name" style={{ display: "block" }}>{r.h.name}</span>
              <span className="muted small" style={{ display: "block" }}>
                {r.paid && r.last
                  ? `${r.last.monthLabel.split(" ")[0]} salary · paid ${shortDate(r.last.date)}`
                  : `${r.month} salary · ${r.due < today ? "was due" : "due"} ${shortDate(r.due)}`}
              </span>
            </span>
          </div>
          {r.paid && r.last ? (
            <>
              <div className="paid-badge">
                <Check size={18} /> Paid {formatINR(r.last.pay)}
                <span className="muted small" style={{ fontWeight: 400, marginLeft: "auto" }}>Next {shortDate(r.due)}</span>
              </div>
              {r.last.note && <p className="small entry-note" style={{ margin: "8px 0 0" }}>Note: {r.last.note}</p>}
              <button
                type="button"
                className="btn btn-secondary"
                style={{ marginTop: 12 }}
                onClick={() => ctx.push({ name: "payday", helperId: r.h.id })}
              >
                Pay {r.month} salary
              </button>
            </>
          ) : (
            <>
              <p className="muted small" style={{ margin: "10px 0" }}>
                About {formatINR(r.pay)}
                {r.cut ? ` after ${formatINR(r.cut)} advance cut` : ""}
                {r.owed.loan ? ` · loan ${formatINR(r.owed.loan)} owed` : ""}
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => ctx.push({ name: "payday", helperId: r.h.id })}
                aria-label={`Pay ${r.h.name}`}
              >
                Pay {r.h.name}
              </button>
            </>
          )}
        </div>
      ))}
    </>
  );
}
