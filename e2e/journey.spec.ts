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
  const wa = page.getByRole("link", { name: "Share on WhatsApp" });
  await expect(wa).toHaveAttribute("target", "_blank");
  const href = (await wa.getAttribute("href")) || "";
  expect(href.startsWith("https://wa.me/?text=")).toBe(true);
  expect(decodeURIComponent(href.split("text=")[1])).toContain("Paid: ₹7,600");
  await page.getByRole("button", { name: "हिंदी" }).click();
  await expect(stmt).toContainText("वेतन");
  await expect(stmt).toContainText("एडवांस कटौती");
  await expect(stmt).toContainText("छुट्टी (4 दिन)");
  await expect(stmt).toContainText("बाकी: एडवांस ₹0 · लोन ₹12,000");
  await page.getByRole("button", { name: "Not now, back to helpers" }).click();
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
