"use client";

import { balances, formatINR, givenVsRecovered, nextPaydayDate, ordinal, shortDate, sortEntries, type MonthBar } from "@/lib/calc";
import type { Entry } from "@/lib/types";
import { ArrowDown, ArrowUp, Calendar, Gift, Plus, Trash, Wallet } from "../Icons";
import { BottomBar, type Ctx, SOURCE_LABEL, TopBar, TYPE_LABEL } from "./ui";

const ORANGE = "#E0913F";
const BLUE = "#2563EB";

export default function Ledger({ ctx, helperId }: { ctx: Ctx; helperId: string }) {
  const helper = ctx.helper(helperId);
  if (!helper) return null;
  const entries = ctx.data.entries.filter((e) => e.helperId === helperId);
  const b = balances(entries);
  const bars = givenVsRecovered(entries, ctx.today);
  const due = nextPaydayDate(helper.paydayDay, ctx.today, ctx.data.paydays.filter((p) => p.helperId === helperId));

  const remove = (e: Entry) => {
    if (!window.confirm(`Delete ${TYPE_LABEL[e.type].toLowerCase()} of ${formatINR(e.amount)} on ${shortDate(e.date)}?`)) return;
    ctx.update((d) => ({ ...d, entries: d.entries.filter((x) => x.id !== e.id) }));
    ctx.toast("Entry deleted");
  };

  return (
    <>
      <TopBar title={helper.name} sub={`${helper.role} · ${formatINR(helper.salary)}/month · pay on ${ordinal(helper.paydayDay)}`} onBack={ctx.back} />

      <div className="card">
        <div className="muted small">Owes you</div>
        <div className="big" data-testid="ledger-owed">{formatINR(b.total)}</div>
        <div className="tiles" style={{ marginTop: 12 }}>
          <div className="tile">
            <div className="k">Advance</div>
            <div className="v" data-testid="ledger-advance">{formatINR(b.advance)}</div>
          </div>
          <div className="tile">
            <div className="k">Loan</div>
            <div className="v" data-testid="ledger-loan">{formatINR(b.loan)}</div>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ marginTop: 12 }}
          onClick={() => ctx.push({ name: "record", helperId })}
        >
          <Plus /> Record payment
        </button>
      </div>

      <Chart bars={bars} />

      <div className="card">
        <p className="label-caps">Entries</p>
        {entries.length === 0 && <p className="muted small" style={{ margin: 0 }}>Nothing recorded yet.</p>}
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {sortEntries(entries).map((e) => (
            <EntryRow key={e.id} e={e} onDelete={e.source === "payday" ? undefined : () => remove(e)} />
          ))}
        </ul>
      </div>

      <BottomBar>
        <button type="button" className="btn btn-primary" onClick={() => ctx.push({ name: "payday", helperId })}>
          Go to payday · {shortDate(due)}
        </button>
      </BottomBar>
    </>
  );
}

function EntryRow({ e, onDelete }: { e: Entry; onDelete?: () => void }) {
  const given = e.type === "advance" || e.type === "loan";
  const cut = e.type === "advance_cut" || e.type === "loan_cut";
  const [cls, Icon] = given
    ? (["given", ArrowUp] as const)
    : cut
      ? (["cut", ArrowDown] as const)
      : e.type === "bonus"
        ? (["gift", Gift] as const)
        : e.type === "leave"
          ? (["other", Calendar] as const)
          : (["other", Wallet] as const);
  return (
    <li className="entry">
      <span className={`eic ${cls}`}>
        <Icon size={18} />
      </span>
      <div className="grow">
        <div className="t">
          {TYPE_LABEL[e.type]}
          {e.reason && e.source !== "opening" ? <span className="muted" style={{ fontWeight: 400 }}> · {e.reason}</span> : null}
        </div>
        <div className="muted small">
          {shortDate(e.date)} · {SOURCE_LABEL[e.source]}
        </div>
      </div>
      <span className="amt" style={{ color: given ? "#A65F18" : cut ? BLUE : undefined }}>
        {cut ? "−" : given ? "+" : ""}
        {formatINR(e.amount)}
      </span>
      {onDelete ? (
        <button type="button" className="icon-btn" aria-label={`Delete ${TYPE_LABEL[e.type]} ${formatINR(e.amount)}`} onClick={onDelete}>
          <Trash size={18} />
        </button>
      ) : (
        <span style={{ width: 44 }} aria-hidden="true" />
      )}
    </li>
  );
}

function Chart({ bars }: { bars: MonthBar[] }) {
  const max = Math.max(1, ...bars.flatMap((b) => [b.given, b.recovered]));
  const totalGiven = bars.reduce((s, b) => s + b.given, 0);
  const totalRec = bars.reduce((s, b) => s + b.recovered, 0);
  const W = 320;
  const H = 140;
  const chartH = 110;
  const slot = W / bars.length;
  const bw = Math.min(16, slot / 3);
  return (
    <div className="card chart">
      <p className="label-caps">Given vs recovered · last 6 months</p>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Given ${formatINR(totalGiven)}, recovered ${formatINR(totalRec)} in the last 6 months`}>
        <line x1="0" x2={W} y1={chartH} y2={chartH} stroke="#E2E6E2" />
        {bars.map((b, i) => {
          const cx = slot * i + slot / 2;
          const gh = (b.given / max) * (chartH - 8);
          const rh = (b.recovered / max) * (chartH - 8);
          return (
            <g key={b.key}>
              <title>{`${b.label}: given ${formatINR(b.given)}, recovered ${formatINR(b.recovered)}`}</title>
              <rect x={cx - bw - 1} y={chartH - gh} width={bw} height={gh} rx="3" fill={ORANGE} />
              <rect x={cx + 1} y={chartH - rh} width={bw} height={rh} rx="3" fill={BLUE} />
              <text x={cx} y={H - 10} textAnchor="middle" fontSize="12" fill="#4E5A55">{b.label}</text>
            </g>
          );
        })}
      </svg>
      <div className="legend">
        <span><i style={{ background: ORANGE }} />Given {formatINR(totalGiven)}</span>
        <span><i style={{ background: BLUE }} />Recovered {formatINR(totalRec)}</span>
      </div>
      <p className="muted tiny" style={{ margin: "6px 0 0" }}>Advances and loans given vs cuts on payday. Opening balances not shown.</p>
    </div>
  );
}
