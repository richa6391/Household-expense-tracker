import { expect, test, type Page } from "@playwright/test";

const ok = (body: object) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

async function today(page: Page) {
  return page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
}

test("add helper → record (typed) → confirm → ledger → payday → paid → reload", async ({ page }) => {
  let sent: Record<string, unknown> | null = null;
  await page.route("**/api/extract", async (route) => {
    sent = route.request().postDataJSON();
    await route.fulfill(
      ok({
        readable: true,
        amount: 3000,
        type: "advance",
        date: await today(page),
        reason: "school fees",
        request_only: false,
        helper_name: "Sunita",
        confidence: "high",
      })
    );
  });

  // Landing
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Know what you owe your helper, and what they owe you." })).toBeVisible();
  await page.getByRole("link", { name: "Start" }).click();

  // First time
  await expect(page.getByRole("heading", { name: "Add your first helper" })).toBeVisible();
  await page.getByRole("button", { name: "Add helper" }).click();

  // Add helper
  const save = page.getByRole("button", { name: "Save helper" });
  await expect(save).toBeDisabled();
  await page.getByLabel("Name").fill("Sunita");
  await page.getByRole("button", { name: "Maid" }).click();
  await page.getByLabel("Monthly salary").fill("18000");
  await expect(save).toBeDisabled();
  await page.getByLabel("Payday").selectOption("1");
  await page.getByRole("switch").check();
  await page.getByLabel("Advance owed").fill("3000");
  await page.getByLabel("Loan owed").fill("14000");
  await save.click();

  // Home
  await expect(page.getByTestId("total-owed")).toHaveText("₹17,000");

  // Record (typed)
  await page.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByTestId("ai-left")).toHaveText("20 of 20 AI reads left today");
  await page.getByPlaceholder("e.g. Gave Sunita 3000 advance for school fees").fill("Sunita ko 3k diya school fees ke liye, salary se kaat lena");
  await page.getByRole("button", { name: "Read with AI" }).click();

  // Confirm
  await expect(page.getByRole("heading", { name: "Check the details" })).toBeVisible();
  expect(sent).toMatchObject({ helperName: "Sunita", salary: 18000, text: expect.stringContaining("3k") });
  await expect(page.getByLabel("Amount you gave Sunita")).toHaveValue("3000");
  await expect(page.getByText("AI guessed Advance")).toBeVisible();
  await expect(page.getByRole("button", { name: "Advance", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("after-saving")).toHaveText("₹3,000 → ₹6,000");
  // Over one month's salary is a warning, not a block.
  await page.getByLabel("Amount you gave Sunita").fill("20000");
  await expect(page.getByText("More than 1 month's salary (₹18,000). Check the amount. You can still save.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeEnabled();
  await page.getByLabel("Amount you gave Sunita").fill("3000");
  await page.getByRole("button", { name: "Save", exact: true }).click();

  // Ledger
  await expect(page.getByText("Saved: ₹3,000 advance, school fees")).toBeVisible();
  await expect(page.getByTestId("ledger-advance")).toHaveText("₹6,000");
  await expect(page.getByTestId("ledger-loan")).toHaveText("₹14,000");
  await expect(page.getByText(/· typed$/)).toBeVisible();
  await expect(page.getByText("Given ₹3,000", { exact: true })).toBeVisible(); // opening balances excluded

  // Browser back from ledger skips the finished form and goes home.
  await page.goBack();
  await expect(page.getByTestId("total-owed")).toHaveText("₹20,000");
  await page.getByRole("button", { name: /Sunita, owes you/ }).click();

  // Payday
  await page.getByRole("button", { name: /Go to payday/ }).click();
  await expect(page.getByLabel("Advance cut")).toHaveValue("6000");
  await page.getByLabel("Loan instalment").fill("2000");
  await page.getByLabel("Leave days taken").fill("4");
  await expect(page.getByLabel("Leave cut")).toHaveValue("2400");
  await expect(page.getByText("4 days × ₹600 · auto, editable")).toBeVisible();
  await expect(page.getByTestId("pay-amount")).toHaveText("₹7,600");
  await expect(page.getByTestId("advance-after")).toHaveText("₹0");
  await expect(page.getByTestId("loan-after")).toHaveText("₹12,000");

  const markPaid = page.getByRole("button", { name: /Mark paid/ });
  await expect(markPaid).toHaveText("Mark paid · ₹7,600");

  // Over-balance error
  await page.getByLabel("Advance cut").fill("7000");
  await expect(page.getByText("Max is ₹6,000 (advance owed)")).toBeVisible();
  await expect(markPaid).toBeDisabled();
  // Negative pay
  await page.getByLabel("Advance cut").fill("6000");
  await page.getByLabel("Loan instalment").fill("14000");
  await expect(page.getByText("Cuts are more than the salary. Lower the cuts.")).toBeVisible();
  await expect(markPaid).toBeDisabled();
  await page.getByLabel("Loan instalment").fill("2000");
  await expect(markPaid).toBeEnabled();
  await markPaid.click();

  // Paid
  await expect(page.getByTestId("paid-title")).toHaveText("Paid ₹7,600 to Sunita");
  await expect(page.getByTestId("left-to-recover")).toHaveText("Left to recover: Advance ₹0 · Loan ₹12,000");
  // English is the default statement language.
  const stmt = page.getByTestId("statement");
  await expect(page.getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");
  await expect(stmt).toContainText("Leave (4 days)");
  await expect(page.getByRole("link", { name: /WhatsApp/ })).toHaveCount(0);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Copy statement" }).click();
  await expect(page.getByText("Statement copied. Paste it in WhatsApp.")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("Paid: ₹7,600");
  await page.getByRole("button", { name: "हिंदी" }).click();
  await expect(stmt).toContainText("वेतन");
  await expect(stmt).toContainText("एडवांस कटौती");
  await expect(stmt).toContainText("छुट्टी (4 दिन)");
  await expect(stmt).toContainText("बाकी: एडवांस ₹0 · लोन ₹12,000");
  await page.getByRole("button", { name: "Back to helpers" }).click();
  await expect(page.getByTestId("total-owed")).toHaveText("₹12,000");

  // A bonus never changes balances; type is required.
  await page.getByRole("button", { name: "Record payment" }).click();
  await page.getByRole("button", { name: "Fill in myself" }).click();
  await expect(page.getByRole("heading", { name: "Payment details" })).toBeVisible();
  await page.getByLabel("Amount you gave Sunita").fill("1100");
  await expect(page.getByText("Choose a type to save")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Bonus / gift" }).click();
  await expect(page.getByTestId("after-saving")).toHaveText("₹12,000 (no change)");
  await page.getByLabel("Reason").fill("Diwali gift");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByTestId("ledger-owed")).toHaveText("₹12,000");

  // Reload: data is still there.
  await page.reload();
  await expect(page.getByTestId("total-owed")).toHaveText("₹12,000");
  await page.getByRole("button", { name: /Sunita, owes you/ }).click();
  await expect(page.getByTestId("ledger-advance")).toHaveText("₹0");
  await expect(page.getByTestId("ledger-loan")).toHaveText("₹12,000");
  await expect(page.getByText("Diwali gift")).toBeVisible();
  await expect(page.getByRole("button", { name: /Go to payday/ })).toContainText("1 Dec");

  await page.goto("/");
  await expect(page.getByRole("link", { name: "Open my helpers" })).toBeVisible();
});

test("request-only screenshot shows the amber note; AI failure falls back to manual", async ({ page }) => {
  await page.goto("/app");
  await page.evaluate(() => {
    localStorage.setItem(
      "payslip-for-help:v1",
      JSON.stringify({
        version: 1,
        helpers: [{ id: "h1", name: "Ramesh", role: "Driver", salary: 15000, paydayDay: 5, createdAt: "x" }],
        entries: [],
        paydays: [],
      })
    );
  });
  await page.reload();

  let fail = false;
  await page.route("**/api/extract", (route) =>
    fail
      ? route.fulfill({ status: 502, contentType: "application/json", body: '{"error":"x"}' })
      : route.fulfill(
          ok({ readable: true, amount: 5000, type: "advance", date: "2026-10-20", reason: "rent", request_only: true, helper_name: "Ramesh", confidence: "low" })
        )
  );

  await page.getByRole("button", { name: "Record payment" }).click();
  await page.getByLabel("Choose a screenshot").setInputFiles({
    name: "chat.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    ),
  });
  await expect(page.getByAltText("Screenshot preview")).toBeVisible();
  await page.getByRole("button", { name: "Read with AI" }).click();
  await expect(page.getByText("This looks like a request only. Change the amount if you gave a different amount.")).toBeVisible();
  // Low confidence: guess shown, but the parent must pick.
  await expect(page.getByText("AI guessed Advance")).toBeVisible();
  await expect(page.getByText("Choose a type to save")).toBeVisible();

  await page.goBack();
  fail = true;
  await page.getByRole("button", { name: "Read with AI" }).click();
  await expect(page.getByRole("heading", { name: "Payment details" })).toBeVisible();
  await expect(page.getByText("AI couldn't read this. Please enter the details yourself.")).toBeVisible();
});

test("undo the last payday goes back to that month", async ({ page }) => {
  await page.goto("/app");
  await page.evaluate(() => {
    const h = { id: "k", name: "Kriti", role: "Maid", salary: 2000, paydayDay: 1, createdAt: "x" };
    const e = (id: string, type: string, amount: number, date: string, source: string) =>
      ({ id, helperId: "k", date, type, amount, reason: "", note: "", source, createdAt: id });
    localStorage.setItem(
      "payslip-for-help:v1",
      JSON.stringify({
        version: 1,
        helpers: [h],
        entries: [
          e("1", "advance", 800, "2026-10-01", "opening"),
          e("2", "advance_cut", 800, "2026-11-01", "payday"),
          e("3", "salary", 1200, "2026-11-01", "payday"),
        ],
        paydays: [
          { id: "p1", helperId: "k", date: "2026-11-01", monthLabel: "October 2026", salary: 2000, advanceCut: 800,
            loanCut: 0, leaveDays: 0, leaveCut: 0, pay: 1200, note: "", advanceAfter: 0, loanAfter: 0 },
        ],
      })
    );
  });
  await page.reload();
  await page.getByRole("button", { name: /Kriti, owes you/ }).click();
  await page.getByRole("button", { name: /Go to payday/ }).click();
  await expect(page.getByText("November salary, due 1 Dec")).toBeVisible();
  await expect(page.getByText("October salary was already paid on 1 Nov (₹1,200).")).toBeVisible();

  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Undo that payday" }).click();
  await expect(page.getByText("October payday undone")).toBeVisible();
  await expect(page.getByText("October salary, due 1 Nov")).toBeVisible();
  await expect(page.getByText(/already paid/)).toHaveCount(0);
  await expect(page.getByLabel("Advance cut")).toHaveValue("800");

  // Back goes to the ledger, which shows the advance owed again.
  await page.goBack();
  await expect(page.getByTestId("ledger-advance")).toHaveText("₹800");
});

test("Payday tab lists every helper with a Pay button or Paid status", async ({ page }) => {
  await page.goto("/app");
  const t = await today(page);
  await page.evaluate((t) => {
    localStorage.removeItem("payslip-for-help:home-tab");
    localStorage.setItem(
      "payslip-for-help:v1",
      JSON.stringify({
        version: 1,
        helpers: [
          { id: "h1", name: "Kriti", role: "Cook", salary: 9000, paydayDay: 1, createdAt: "x" },
          { id: "h2", name: "Meena", role: "Maid", salary: 12000, paydayDay: 1, createdAt: "x" },
        ],
        entries: [
          { id: "e1", helperId: "h2", date: t, type: "advance", amount: 2000, reason: "", note: "", source: "manual", createdAt: "x" },
          { id: "e2", helperId: "h1", date: t, type: "salary", amount: 9000, reason: "", note: "Paid in cash", source: "payday", createdAt: "x" },
        ],
        paydays: [
          {
            id: "p1", helperId: "h1", date: t, monthLabel: "September 2026", salary: 9000, advanceCut: 0, loanCut: 0,
            leaveDays: 0, leaveCut: 0, pay: 9000, note: "Paid in cash", advanceAfter: 0, loanAfter: 0,
          },
        ],
      })
    );
  }, t);
  await page.reload();

  await expect(page.getByRole("tab", { name: "My helpers" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Payday" }).click();
  await expect(page.getByTestId("to-pay")).toHaveText("₹10,000");
  await expect(page.getByText("1 of 2 paid")).toBeVisible();

  const meena = page.getByTestId("payday-row-Meena");
  await expect(meena).toContainText("About ₹10,000 after ₹2,000 advance cut");
  const kriti = page.getByTestId("payday-row-Kriti");
  await expect(kriti).toContainText("Paid ₹9,000");
  await expect(kriti).toContainText("Note: Paid in cash");
  // Once paid, the next month's salary can still be paid from here.
  await expect(kriti.getByRole("button", { name: "Pay Kriti" })).toHaveCount(0);
  await expect(kriti.getByRole("button", { name: /^Pay \w+ salary$/ })).toBeVisible();
  // Unpaid helpers come first.
  await expect(page.locator(".payday-card").first()).toHaveAttribute("data-testid", "payday-row-Meena");

  await page.getByLabel("Search helpers").fill("kri");
  await expect(meena).toHaveCount(0);
  await expect(kriti).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();

  await page.getByRole("button", { name: "Pay Meena" }).click();
  await expect(page.getByRole("heading", { name: "Payday · Meena" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("tab", { name: "Payday" })).toHaveAttribute("aria-selected", "true");

  // The tab is remembered after a reload.
  await page.reload();
  await expect(page.getByTestId("to-pay")).toHaveText("₹10,000");
  await page.getByRole("tab", { name: "My helpers" }).click();
  await expect(page.getByTestId("total-owed")).toHaveText("₹2,000");

  // The payday note also shows on the ledger entry.
  await page.getByRole("button", { name: /Kriti, owes you/ }).click();
  await expect(page.getByText("“Paid in cash”")).toBeVisible();
});
