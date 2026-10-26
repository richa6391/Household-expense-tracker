# PaySlip for Help

An AI bookkeeper for one household's helpers (maid, cook, driver, nanny) in India.
Record salary advances and loans from a WhatsApp or UPI screenshot or a typed line
(English, Hindi or Hinglish). On payday the app works out the correct salary after cuts
and creates a statement in English or Hindi to share on WhatsApp.

- No login, no database. All data lives in the browser's `localStorage` (key `payslip-for-help:v1`).
  Use **Download backup** on the helpers screen to keep a JSON copy.
- One server route, `POST /api/extract`, calls OpenAI (vision + strict JSON schema).
  The API key stays on the server.
- All money maths lives in [`lib/calc.ts`](lib/calc.ts), never in the AI.

## Run locally

Requires Node 18.17+ (Node 20+ recommended).

```bash
npm install
cp .env.example .env.local   # then put your OPENAI_API_KEY in .env.local
npm run dev                  # http://localhost:3000
```

Without an API key the app still works: AI reads fail gracefully and open the manual form.

| Command | What it does |
| --- | --- |
| `npm test` | Unit tests for the money maths (`tests/calc.test.ts`, Vitest) |
| `npm run build` | Production build |
| `npm run e2e` | Playwright click-through with `/api/extract` mocked (run `npx playwright install chromium` once, and `npm run build` first) |

## Environment variables

| Name | Required | Default |
| --- | --- | --- |
| `OPENAI_API_KEY` | yes | |
| `OPENAI_MODEL` | no | `gpt-4o-mini` |

Never prefix these with `NEXT_PUBLIC_`; that would send them to the browser.

## Deploy on Vercel

1. Push this repo to GitHub.
2. Go to <https://vercel.com/new>, **Import** the repo. Vercel detects Next.js; keep the default settings.
3. Under **Environment Variables**, add `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`).
4. Click **Deploy**. Every later push to `main` redeploys automatically.

If you add or change an environment variable later, redeploy for it to take effect.

## How the numbers work

- Advance owed = Σ advance − Σ advance cut. Loan owed = Σ loan − Σ loan cut.
  Bonus, salary and leave entries never count as money owed.
- Leave cut = max(leave days − paid leave, 0) × salary ÷ 30, rounded to the nearest ₹10.
- Pay = salary − advance cut − loan cut − leave cut.
- A cut can't be more than what's owed, and pay can't go below ₹0.

Example: salary ₹18,000, 2 paid leave days, advance owed ₹6,000, loan owed ₹14,000.
Cut ₹6,000 advance and ₹2,000 loan, 6 leave days → leave cut ₹2,400, pay **₹7,600**.
Afterwards advance owed is ₹0 and loan owed is ₹12,000.

## Limits

- 20 AI reads per day per device (counted in the browser).
- Images are resized in the browser to max 1400px (JPEG 0.85); the server rejects images over 4 MB
  and text over 1,000 characters.
