"use client";

import { useState } from "react";
import { balances, formatINR, nextPaydayDate, ordinal, shortDate } from "@/lib/calc";
import { Chevron, Close, Plus, Search, Users } from "../Icons";
import { BottomBar, type Ctx, initial } from "./ui";

export default function Home({ ctx }: { ctx: Ctx }) {
  const { data, today } = ctx;
  const [query, setQuery] = useState("");

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
        <h1>My helpers</h1>
      </header>

      <div className="card blue">
        <div className="muted small">Total your helpers owe you</div>
        <div className="big" data-testid="total-owed">{formatINR(total)}</div>
        {next && (
          <div className="muted small" style={{ marginTop: 8 }}>
            Next payday: {next.h.name} · {shortDate(next.date)}
          </div>
        )}
      </div>

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

      {shown.map((h) => {
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
  );
}
