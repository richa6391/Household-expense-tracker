"use client";

import { useEffect, useState } from "react";
import { bonusesSince, formatINR } from "@/lib/calc";
import { buildStatement, type Lang, statementText } from "@/lib/statement";
import { Check, Share } from "../Icons";
import { BottomBar, type Ctx } from "./ui";

export default function Paid({ ctx, paydayId }: { ctx: Ctx; paydayId: string }) {
  const [lang, setLang] = useState<Lang>("en");
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator.share === "function"), []);
  const p = ctx.data.paydays.find((x) => x.id === paydayId);
  const helper = p && ctx.helper(p.helperId);
  if (!p || !helper) return null;

  const previous = ctx.data.paydays
    .filter((x) => x.helperId === helper.id && x.date < p.date)
    .reduce<string | null>((a, x) => (!a || x.date > a ? x.date : a), null);
  const bonus = bonusesSince(ctx.data.entries, helper.id, previous, p.date);
  const s = buildStatement(helper, p, lang, bonus);
  const text = statementText(s);

  // A plain link, not window.open: browsers never block a link the user taps.
  // wa.me opens the WhatsApp app on phones and WhatsApp Web on computers.
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      ctx.toast("Statement copied");
    } catch {
      window.alert("Couldn't copy. Select the statement text and copy it instead.");
    }
  };

  const shareOther = async () => {
    try {
      await navigator.share({ text });
    } catch {
      // Cancelled or not allowed; nothing to do.
    }
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

      <div className="center">
        <button type="button" className="link-btn" onClick={copy}>Copy text</button>
        {canShare && (
          <>
            <span className="muted" aria-hidden="true"> · </span>
            <button type="button" className="link-btn" onClick={shareOther}>More share options</button>
          </>
        )}
      </div>

      <BottomBar>
        <a className="btn btn-primary" href={whatsappUrl} target="_blank" rel="noopener noreferrer">
          <Share /> Share on WhatsApp
        </a>
        <button type="button" className="link-btn muted" style={{ width: "100%" }} onClick={() => ctx.reset([{ name: "home" }])}>
          Not now, back to helpers
        </button>
      </BottomBar>
    </>
  );
}
