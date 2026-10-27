import { describe, expect, it } from "vitest";
import {
  balances,
  balancesAfter,
  computePayday,
  defaultAdvanceCut,
  formatINR,
  givenVsRecovered,
  isOverSalary,
  isValidISODate,
  lastPayday,
  leaveCut,
  markPaid,
  nextPaydayDate,
  parseAmount,
  salaryMonth,
  undoPayday,
} from "../lib/calc";
import { buildStatement, statementText } from "../lib/statement";
import type { Entry, EntryType, Helper } from "../lib/types";

const sunita: Helper = {
  id: "h1",
  name: "Sunita",
  role: "Maid",
  salary: 18000,
  paydayDay: 1,
  createdAt: "2026-10-01T00:00:00Z",
};

let n = 0;
const newId = () => `id${++n}`;
function entry(type: EntryType, amount: number, extra: Partial<Entry> = {}): Entry {
  return {
    id: newId(),
    helperId: "h1",
    date: "2026-10-10",
    type,
    amount,
    reason: "",
    note: "",
    source: "manual",
    createdAt: "2026-10-10T00:00:00Z",
    ...extra,
  };
}

const opening = () => [
  entry("advance", 6000, { source: "opening" }),
  entry("loan", 14000, { source: "opening" }),
];

describe("formatINR", () => {
  it("uses Indian grouping and the rupee sign", () => {
    expect(formatINR(18000)).toBe("₹18,000");
    expect(formatINR(140000)).toBe("₹1,40,000");
    expect(formatINR(0)).toBe("₹0");
    expect(formatINR(-500)).toBe("−₹500");
    expect(formatINR(NaN)).toBe("₹0");
  });
});

describe("parseAmount", () => {
  it("accepts typed rupee strings and rejects junk", () => {
    expect(parseAmount("3,000")).toBe(3000);
    expect(parseAmount("₹ 2,500")).toBe(2500);
    expect(parseAmount("")).toBe(0);
    expect(parseAmount("abc")).toBe(0);
    expect(parseAmount("-50")).toBe(0);
    expect(parseAmount(1234.6)).toBe(1235);
  });
});

describe("balances", () => {
  it("advance and loan come from their own entries and cuts", () => {
    const e = [...opening(), entry("advance_cut", 1000), entry("loan_cut", 4000)];
    expect(balances(e, "h1")).toEqual({ advance: 5000, loan: 10000, total: 15000 });
  });

  it("bonus, salary and leave never change balances", () => {
    const before = balances(opening(), "h1");
    const e = [...opening(), entry("bonus", 5000), entry("salary", 18000), entry("leave", 1200)];
    expect(balances(e, "h1")).toEqual(before);
    expect(balancesAfter(opening(), "h1", "bonus", 9999)).toEqual(before);
  });

  it("filters by helper", () => {
    const e = [...opening(), entry("advance", 999, { helperId: "h2" })];
    expect(balances(e, "h1").advance).toBe(6000);
    expect(balances(e, "h2").advance).toBe(999);
    expect(balances(e).advance).toBe(6999);
  });

  it("balancesAfter previews a new advance", () => {
    expect(balancesAfter([entry("advance", 3000)], "h1", "advance", 3000).advance).toBe(6000);
  });
});

describe("leave cut", () => {
  it("cuts every leave day at salary ÷ 30, rounded to ₹10", () => {
    expect(leaveCut(4, 18000)).toBe(2400);
    expect(leaveCut(1, 18000)).toBe(600);
    expect(leaveCut(0, 18000)).toBe(0);
    expect(leaveCut(-2, 18000)).toBe(0);
    expect(leaveCut(3, 10000)).toBe(1000);
    expect(leaveCut(1, 7000)).toBe(230); // 233.33 → 230
    expect(leaveCut(1, 7100)).toBe(240); // 236.67 → 240
  });
});

describe("payday rules", () => {
  it("default advance cut is min(owed, salary)", () => {
    expect(defaultAdvanceCut(6000, 18000)).toBe(6000);
    expect(defaultAdvanceCut(25000, 18000)).toBe(18000);
    expect(defaultAdvanceCut(-10, 18000)).toBe(0);
  });

  it("a cut can't exceed its balance", () => {
    const r = computePayday({ salary: 18000, advanceCut: 7000, loanCut: 15000, leaveCut: 0, advanceOwed: 6000, loanOwed: 14000 });
    expect(r.advanceError).toBe("Max is ₹6,000 (advance owed)");
    expect(r.loanError).toBe("Max is ₹14,000 (loan owed)");
    expect(r.canMarkPaid).toBe(false);
  });

  it("negative pay blocks Mark paid", () => {
    const r = computePayday({ salary: 10000, advanceCut: 6000, loanCut: 5000, leaveCut: 0, advanceOwed: 6000, loanOwed: 14000 });
    expect(r.pay).toBe(-1000);
    expect(r.negative).toBe(true);
    expect(r.canMarkPaid).toBe(false);
  });

  it("over one month's salary is a warning only", () => {
    expect(isOverSalary(18001, 18000)).toBe(true);
    expect(isOverSalary(18000, 18000)).toBe(false);
  });
});

describe("acceptance test", () => {
  it("₹18,000 salary, 6,000 advance, 2,000 loan cut, 4 leave days → pay ₹7,600", () => {
    const entries = opening();
    const owed = balances(entries, "h1");
    expect(owed).toEqual({ advance: 6000, loan: 14000, total: 20000 });

    const lc = leaveCut(4, sunita.salary);
    expect(lc).toBe(2400);

    const r = computePayday({
      salary: 18000,
      advanceCut: 6000,
      loanCut: 2000,
      leaveCut: lc,
      advanceOwed: owed.advance,
      loanOwed: owed.loan,
    });
    expect(r.pay).toBe(7600);
    expect(formatINR(r.pay)).toBe("₹7,600");
    expect(r.canMarkPaid).toBe(true);

    const out = markPaid({
      helper: sunita,
      entries,
      date: "2026-11-01",
      monthLabel: "October 2026",
      advanceCut: 6000,
      loanCut: 2000,
      leaveDays: 4,
      leaveCut: lc,
      note: "",
      now: "2026-11-01T10:00:00Z",
      newId,
    });
    expect(out.entries.map((e) => [e.type, e.amount, e.source])).toEqual([
      ["advance_cut", 6000, "payday"],
      ["loan_cut", 2000, "payday"],
      ["salary", 7600, "payday"],
    ]);
    expect(out.payday).toMatchObject({ pay: 7600, advanceAfter: 0, loanAfter: 12000, leaveCut: 2400 });

    const after = [...entries, ...out.entries];
    expect(balances(after, "h1")).toEqual({ advance: 0, loan: 12000, total: 12000 });

    // A bonus entry never changes balances.
    expect(balances([...after, entry("bonus", 2100)], "h1")).toEqual({ advance: 0, loan: 12000, total: 12000 });
  });

  it("undoPayday restores balances and the next payday", () => {
    const entries = opening();
    const out = markPaid({
      helper: sunita, entries, date: "2026-11-01", monthLabel: "October 2026",
      advanceCut: 6000, loanCut: 2000, leaveDays: 4, leaveCut: 2400, note: "", now: "x", newId,
    });
    const afterEntries = [...entries, ...out.entries];
    const afterPaydays = [out.payday];
    expect(lastPayday(afterPaydays, "h1")?.id).toBe(out.payday.id);
    expect(nextPaydayDate(1, "2026-10-27", afterPaydays)).toBe("2026-12-01");

    const undone = undoPayday(afterEntries, afterPaydays, out.payday.id);
    expect(undone.paydays).toEqual([]);
    expect(undone.entries).toEqual(entries);
    expect(balances(undone.entries, "h1")).toEqual({ advance: 6000, loan: 14000, total: 20000 });
    expect(nextPaydayDate(1, "2026-10-27", undone.paydays)).toBe("2026-11-01");
  });

  it("markPaid skips zero cuts and refuses an invalid payday", () => {
    const out = markPaid({
      helper: sunita, entries: [], date: "2026-11-01", monthLabel: "October 2026",
      advanceCut: 0, loanCut: 0, leaveDays: 0, leaveCut: 0, note: "", now: "x", newId,
    });
    expect(out.entries.map((e) => e.type)).toEqual(["salary"]);
    expect(() =>
      markPaid({
        helper: sunita, entries: [], date: "2026-11-01", monthLabel: "October 2026",
        advanceCut: 100, loanCut: 0, leaveDays: 0, leaveCut: 0, note: "", now: "x", newId,
      })
    ).toThrow();
  });
});

describe("dates", () => {
  it("validates ISO dates", () => {
    expect(isValidISODate("2026-10-27")).toBe(true);
    expect(isValidISODate("2026-02-30")).toBe(false);
    expect(isValidISODate("27/10/2026")).toBe(false);
  });

  it("next payday", () => {
    expect(nextPaydayDate(1, "2026-10-27")).toBe("2026-11-01");
    expect(nextPaydayDate(28, "2026-10-27")).toBe("2026-10-28");
    expect(nextPaydayDate(27, "2026-10-27")).toBe("2026-10-27");
    expect(nextPaydayDate(5, "2026-12-20")).toBe("2027-01-05");
    const paid = [{ date: "2026-11-01" } as never];
    expect(nextPaydayDate(1, "2026-11-01", paid)).toBe("2026-12-01");
  });

  it("salary month", () => {
    expect(salaryMonth("2026-11-01", 1)).toEqual({ month: 9, year: 2026 });
    expect(salaryMonth("2027-01-05", 5)).toEqual({ month: 11, year: 2026 });
    expect(salaryMonth("2026-10-28", 28)).toEqual({ month: 9, year: 2026 });
  });
});

describe("given vs recovered chart", () => {
  it("buckets last 6 months and excludes opening balances", () => {
    const e = [
      ...opening(),
      entry("advance", 3000, { date: "2026-10-05" }),
      entry("loan", 5000, { date: "2026-08-15" }),
      entry("advance_cut", 2000, { date: "2026-09-01", source: "payday" }),
      entry("bonus", 1000, { date: "2026-10-20" }),
      entry("advance", 999, { date: "2026-03-01" }), // too old
    ];
    const bars = givenVsRecovered(e, "2026-10-27");
    expect(bars.map((b) => b.label)).toEqual(["May", "Jun", "Jul", "Aug", "Sep", "Oct"]);
    expect(bars[5]).toMatchObject({ given: 3000, recovered: 0 });
    expect(bars[4]).toMatchObject({ given: 0, recovered: 2000 });
    expect(bars[3]).toMatchObject({ given: 5000, recovered: 0 });
  });
});

describe("statement", () => {
  const payday = {
    id: "p", helperId: "h1", date: "2026-11-01", monthLabel: "October 2026", salary: 18000,
    advanceCut: 6000, loanCut: 2000, leaveDays: 4, leaveCut: 2400, pay: 7600, note: "",
    advanceAfter: 0, loanAfter: 12000,
  };
  it("Hindi", () => {
    const t = statementText(buildStatement(sunita, payday, "hi"));
    expect(t).toContain("वेतन: ₹18,000");
    expect(t).toContain("एडवांस कटौती: −₹6,000");
    expect(t).toContain("लोन किस्त: −₹2,000");
    expect(t).toContain("छुट्टी (4 दिन): −₹2,400");
    expect(t).toContain("दिया गया: ₹7,600");
    expect(t).toContain("बाकी: एडवांस ₹0 · लोन ₹12,000");
  });
  it("English with bonus listed separately", () => {
    const t = statementText(buildStatement(sunita, payday, "en", 1100));
    expect(t).toContain("Paid: ₹7,600");
    expect(t).toContain("Bonus / gifts (separate, not owed): ₹1,100");
  });
});
