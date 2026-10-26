import { formatINR, hindiDate, longDate } from "./calc";
import type { Helper, Payday } from "./types";

export type Lang = "en" | "hi";

export interface StatementLine {
  label: string;
  value: string;
  strong?: boolean;
}

export interface Statement {
  title: string;
  lines: StatementLine[];
  footer: string;
  bonusLine: string | null;
}

/** monthLabel is stored as "October 2026"; Hindi needs the month translated. */
function hindiMonth(monthLabel: string): string {
  const en = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const hi = ["जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"];
  const [m, y] = monthLabel.split(" ");
  const i = en.indexOf(m);
  return i >= 0 ? `${hi[i]}${y ? " " + y : ""}` : monthLabel;
}

export function buildStatement(helper: Helper, p: Payday, lang: Lang, bonus = 0): Statement {
  const minus = (n: number) => "−" + formatINR(n);
  const days = p.leaveDays;
  const lines: StatementLine[] = [];
  if (lang === "hi") {
    lines.push({ label: "वेतन", value: formatINR(p.salary) });
    if (p.advanceCut > 0) lines.push({ label: "एडवांस कटौती", value: minus(p.advanceCut) });
    if (p.loanCut > 0) lines.push({ label: "लोन किस्त", value: minus(p.loanCut) });
    if (p.leaveCut > 0) lines.push({ label: `छुट्टी (${days} दिन)`, value: minus(p.leaveCut) });
    lines.push({ label: "दिया गया", value: formatINR(p.pay), strong: true });
    return {
      title: `${helper.name} — ${hindiMonth(p.monthLabel)} वेतन (${hindiDate(p.date)})`,
      lines,
      footer: `बाकी: एडवांस ${formatINR(p.advanceAfter)} · लोन ${formatINR(p.loanAfter)}`,
      bonusLine: bonus > 0 ? `बोनस / उपहार (अलग से, कटौती नहीं): ${formatINR(bonus)}` : null,
    };
  }
  lines.push({ label: "Salary", value: formatINR(p.salary) });
  if (p.advanceCut > 0) lines.push({ label: "Advance cut", value: minus(p.advanceCut) });
  if (p.loanCut > 0) lines.push({ label: "Loan instalment", value: minus(p.loanCut) });
  if (p.leaveCut > 0) lines.push({ label: `Leave (${days} day${days === 1 ? "" : "s"})`, value: minus(p.leaveCut) });
  lines.push({ label: "Paid", value: formatINR(p.pay), strong: true });
  return {
    title: `${helper.name} — ${p.monthLabel} salary (${longDate(p.date)})`,
    lines,
    footer: `Still to recover: Advance ${formatINR(p.advanceAfter)} · Loan ${formatINR(p.loanAfter)}`,
    bonusLine: bonus > 0 ? `Bonus / gifts (separate, not owed): ${formatINR(bonus)}` : null,
  };
}

export function statementText(s: Statement): string {
  const body = s.lines.map((l) => `${l.label}: ${l.value}`).join("\n");
  return [s.title, "", body, "", s.footer, s.bonusLine].filter((x) => x !== null).join("\n").trim() + "\n\n— PaySlip for Help";
}
