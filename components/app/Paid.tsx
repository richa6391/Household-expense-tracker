"use client";

import { useState } from "react";
import { bonusesSince, formatINR } from "@/lib/calc";
import { buildStatement, type Lang, statementText } from "@/lib/statement";
import { Check, Share } from "../Icons";
import { BottomBar, type Ctx } from "./ui";

export default function Paid({ ctx, paydayId }: { ctx: Ctx; paydayId: string }) {
  const [lang, setLang] = useState<Lang>("hi");
  const p = ctx.data.paydays.find((x) => x.id === paydayId);
  const helper = p && ctx.helper(p.helperId);
  if (!p || !helper) return null;

  const previous = ctx.data.paydays
    .filter((x) => x.helperId === helper.id && x.date < p.date)
    .reduce<string | null>((a, x) => (!a || x.date > a ? x.date : a), null);
  const bonus = bonusesSince(ctx.data.entries, helper.id, previous, p.date);
  const s = buildStatement(helper, p, lang, bonus);
  const text = statementText(s);

  const share = async () => {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ text });
        return;
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return;
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };

  return (
    <>
      <div className="done-ic">
        <Check size={36} />
      </div>
      <h2 className="center" data-testid="paid-title">
        Paid {formatINR(p.pay)} to {helper.name}
      </h2>
      <p className="center muted" data-testid="left-to-recover">
        Left to recover: Advance {formatINR(p.advanceAfter)} · Loan {formatINR(p.loanAfter)}
      </p>

      <div className="row" style={{ margin: "24px 0 12px" }}>
        <strong>Share statement with {helper.name}?</strong>
        <div className="seg" role="group" aria-label="Statement language">
          <button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")}>English</button>
          <button type="button" aria-pressed={lang === "hi"} onClick={() => setLang("hi")} lang="hi">हिंदी</button>
        </div>
      </div>

      <div className="card" lang={lang} data-testid="statement">
        <p style={{ fontWeight: 700, margin: "0 0 8px" }}>{s.title}</p>
        {s.lines.map((l) => (
          <div key={l.label} className={`stmt-line${l.strong ? " strong" : ""}`}>
            <span>{l.label}</span>
            <span>{l.value}</span>
          </div>
        ))}
        <p className="muted small" style={{ margin: "10px 0 0" }}>{s.footer}</p>
        {s.bonusLine && <p className="muted small" style={{ margin: "4px 0 0" }}>{s.bonusLine}</p>}
      </div>
      <p className="muted small">Bonus or gifts are listed separately and are never counted as money owed.</p>

      <BottomBar>
        <button type="button" className="btn btn-primary" onClick={share}>
          <Share /> Share on WhatsApp
        </button>
        <button type="button" className="link-btn muted" style={{ width: "100%" }} onClick={() => ctx.reset([{ name: "home" }])}>
          Not now, back to helpers
        </button>
      </BottomBar>
    </>
  );
}
