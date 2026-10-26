import { NextResponse } from "next/server";
import { isValidISODate } from "@/lib/calc";
import type { ExtractResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_TEXT = 1000;
const TYPES = ["advance", "loan", "bonus", "salary", "leave"] as const;

const SCHEMA = {
  name: "payment",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["readable", "amount", "type", "date", "reason", "request_only", "helper_name", "confidence"],
    properties: {
      readable: { type: "boolean", description: "false if this is not a message about money given to or asked by a helper" },
      amount: { type: ["number", "null"], description: "Rupees as a plain number, e.g. 3000" },
      type: { type: "string", enum: TYPES },
      date: { type: ["string", "null"], description: "YYYY-MM-DD" },
      reason: { type: "string", description: "1–4 English words, e.g. 'school fees'" },
      request_only: { type: "boolean" },
      helper_name: { type: ["string", "null"] },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
    },
  },
};

function systemPrompt(helperName: string, salary: number, today: string): string {
  return `You are a careful bookkeeper for ONE Indian household. The employer (a working parent) records money they give their domestic helper (maid, cook, driver, nanny). You read a WhatsApp chat screenshot, a UPI payment screenshot (GPay, PhonePe, Paytm, BHIM, bank app) or a typed sentence in English, Hindi or Hinglish, and extract ONE payment.

Context:
- Helper's name: ${helperName || "unknown"}. Monthly salary: ₹${salary || "unknown"}.
- Today's date: ${today}. Resolve relative dates from this: "aaj"/"today" = today, "kal"/"yesterday" = the day before today (in a payment context "kal" means yesterday unless it clearly says future), "parso" = 2 days before. Dates on UPI receipts win over everything else. Output YYYY-MM-DD; if no date is visible use today.

Amount:
- Understand "3k" = 3000, "2.5k" = 2500, "teen hazaar" = 3000, "dedh hazaar" = 1500, "dhai hazaar" = 2500, "paanch sau" = 500, "ek lakh" = 100000, "₹2,500" = 2500, "Rs. 2500/-" = 2500.
- If a UPI / bank transfer amount is visible, use it over any amount only mentioned in chat.
- amount is a plain number in rupees, no symbols.

request_only:
- true when the image/text only shows the helper ASKING for money (e.g. "Didi 5000 chahiye", "Bhaiya advance de do") and there is no proof or statement that it was paid. The amount is then the requested amount.
- false when there is a UPI/transfer receipt, or the employer says they gave/paid/sent it ("diya", "de diya", "bhej diya", "gave", "paid").

type (pick one):
- advance: money taken against salary, to be cut from the next salary. Phrases: "advance", "salary se kaat lena", "agle mahine adjust", "next month adjust", "pagaar se kaat lo", small amounts for school fees, rent, ration, medicine, gas cylinder.
- loan: larger money repaid over several months. Words: loan, udhaar, karz, kisht, EMI, instalments, "thoda thoda karke", hospital, operation, wedding/shaadi, house repair, village/gaon emergency. Usually more than half a month's salary (more than ₹${Math.round((salary || 0) / 2)}).
- bonus: a gift, never repaid. Diwali, Holi, Eid, Rakhi, festival, birthday, inaam, gift, shagun, "rakh lo", "wapas mat dena".
- salary: the monthly salary / tankhwah / pagaar itself.
- leave: a deduction for days not worked (chutti, absent).
- If unsure, use advance with confidence "low".

reason: 1–4 English words saying what the money is for (e.g. "school fees", "hospital bill", "Diwali gift"). Translate Hindi. Use "advance" if no reason is given.
helper_name: the name of the person receiving/asking for money if visible, else null.
readable: false if the image is not a chat or payment about money (e.g. a selfie, a random photo, unreadable/blank). Then set amount null, type advance, confidence low.
confidence: high when amount and type are clear, medium when the type is inferred, low when guessing.`;
}

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function POST(req: Request) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return bad("AI is not set up on this server.", 503);

  let body: { image?: unknown; text?: unknown; helperName?: unknown; salary?: unknown; today?: unknown };
  try {
    body = await req.json();
  } catch {
    return bad("Invalid JSON");
  }

  const image = typeof body.image === "string" && body.image ? body.image : undefined;
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const helperName = typeof body.helperName === "string" ? body.helperName.slice(0, 60) : "";
  const salary = typeof body.salary === "number" && body.salary > 0 ? Math.round(body.salary) : 0;
  const today = isValidISODate(body.today) ? body.today : new Date().toISOString().slice(0, 10);

  if (!image && !text) return bad("Send an image or some text.");
  if (text.length > MAX_TEXT) return bad(`Text must be under ${MAX_TEXT} characters.`);
  if (image) {
    const m = /^data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(image);
    if (!m) return bad("Image must be a PNG, JPEG, WebP or GIF data URL.");
    if (Math.floor((m[2].length * 3) / 4) > MAX_IMAGE_BYTES) return bad("Image must be under 4 MB.", 413);
  }

  const content: unknown[] = [];
  if (text) content.push({ type: "text", text: `Typed by the employer: ${text}` });
  if (image) content.push({ type: "image_url", image_url: { url: image, detail: "high" } });
  if (!text) content.push({ type: "text", text: "Read this screenshot." });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_schema", json_schema: SCHEMA },
        messages: [
          { role: "system", content: systemPrompt(helperName, salary, today) },
          { role: "user", content },
        ],
      }),
    });
    if (!res.ok) {
      console.error("OpenAI error", res.status, (await res.text()).slice(0, 500));
      return bad("The AI could not read this right now.", 502);
    }
    const json = await res.json();
    const raw = json?.choices?.[0]?.message?.content;
    if (typeof raw !== "string") return bad("The AI returned nothing.", 502);
    return NextResponse.json(sanitize(JSON.parse(raw), today));
  } catch (e) {
    console.error("extract failed", e);
    return bad("The AI could not read this right now.", 502);
  } finally {
    clearTimeout(timer);
  }
}

/** Never trust the model: clamp everything to what the app can use. */
function sanitize(r: Partial<ExtractResult>, today: string): ExtractResult {
  const amount = typeof r.amount === "number" && Number.isFinite(r.amount) && r.amount > 0 ? Math.round(r.amount) : null;
  const type = TYPES.includes(r.type as (typeof TYPES)[number]) ? (r.type as ExtractResult["type"]) : "advance";
  const reason = typeof r.reason === "string" ? r.reason.trim().split(/\s+/).slice(0, 4).join(" ").slice(0, 40) : "";
  return {
    readable: r.readable === true && amount !== null,
    amount,
    type,
    date: isValidISODate(r.date) && r.date <= today ? r.date : today,
    reason,
    request_only: r.request_only === true,
    helper_name: typeof r.helper_name === "string" ? r.helper_name.slice(0, 60) : null,
    confidence: r.confidence === "high" || r.confidence === "medium" ? r.confidence : "low",
  };
}
