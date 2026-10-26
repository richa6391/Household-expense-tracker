"use client";

import { useRef, useState } from "react";
import { resizeImage } from "@/lib/image";
import { AI_DAILY_LIMIT, aiReadsLeft, countAiRead } from "@/lib/storage";
import type { ExtractResult } from "@/lib/types";
import { Camera } from "../Icons";
import { Banner, BottomBar, type Ctx, type Notice, type View, TopBar } from "./ui";

const MAX_TEXT = 1000;

export default function Record({ ctx, view }: { ctx: Ctx; view: Extract<View, { name: "record" }> }) {
  const [helperId, setHelperId] = useState(view.helperId);
  const { image, text } = ctx.record;
  const setImage = (v: string | null) => ctx.setRecord({ image: v, text });
  const setText = (v: string) => ctx.setRecord({ image, text: v });
  const [busy, setBusy] = useState(false);
  const [imgError, setImgError] = useState<string | null>(null);
  const [left] = useState(aiReadsLeft);
  const fileRef = useRef<HTMLInputElement>(null);
  const helper = ctx.helper(helperId);
  if (!helper) return null;

  const manual = (notices?: Notice[]) =>
    ctx.push({ name: "form", helperId, mode: "manual", source: "manual", notices, draft: { reason: "", note: text.trim() } });

  const readWithAi = async () => {
    if (busy) return;
    if (aiReadsLeft() <= 0) {
      manual([{ kind: "info", text: `You've used today's ${AI_DAILY_LIMIT} AI reads. Enter the details yourself; it resets tomorrow.` }]);
      return;
    }
    setBusy(true);
    countAiRead();
    const failNote: Notice = { kind: "info", text: "AI couldn't read this. Please enter the details yourself." };
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: image || undefined,
          text: text.trim() || undefined,
          helperName: helper.name,
          salary: helper.salary,
          today: ctx.today,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const r = (await res.json()) as ExtractResult;
      if (!r.readable || !r.amount) {
        manual([failNote]);
        return;
      }
      const notices: Notice[] = [];
      if (r.request_only)
        notices.push({ kind: "warn", text: "This looks like a request only. Change the amount if you gave a different amount." });
      else notices.push({ kind: "ai", text: "AI filled this in. Check the details before saving." });
      if (r.helper_name && !r.helper_name.toLowerCase().includes(helper.name.toLowerCase().split(" ")[0]))
        notices.push({ kind: "info", text: `The message mentions “${r.helper_name}”. Make sure this is for ${helper.name}.` });
      ctx.push({
        name: "form",
        helperId,
        mode: "ai",
        source: image ? "screenshot" : "text",
        aiType: r.type,
        notices,
        draft: {
          amount: String(r.amount),
          // Low confidence: show the guess as a hint but make the parent pick.
          type: r.confidence === "low" ? null : r.type,
          date: r.date || ctx.today,
          reason: r.reason,
          note: "",
        },
      });
    } catch {
      manual([failNote]);
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (f: File | undefined) => {
    setImgError(null);
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setImgError("Please choose an image.");
      return;
    }
    try {
      setImage(await resizeImage(f));
    } catch {
      setImgError("Couldn't open that image. Try another one.");
    }
  };

  const canRead = !!image || text.trim().length > 0;

  return (
    <>
      <TopBar title="Record payment" sub="Snap it or type it. You'll check before saving." onBack={ctx.back} />

      {ctx.data.helpers.length > 1 && (
        <div className="field">
          <span className="lbl" id="who">Who is it for?</span>
          <div className="chips" role="group" aria-labelledby="who">
            {ctx.data.helpers.map((h) => (
              <button type="button" key={h.id} className="chip" aria-pressed={h.id === helperId} onClick={() => setHelperId(h.id)}>
                {h.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="Choose a screenshot"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {image ? (
        <div className="card preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="Screenshot preview" />
          <div className="grow">
            <strong>Screenshot added</strong>
            <div>
              <button type="button" className="link-btn" onClick={() => fileRef.current?.click()}>Replace</button>
              <button type="button" className="link-btn muted" onClick={() => setImage(null)}>Remove</button>
            </div>
          </div>
        </div>
      ) : (
        <button type="button" className="upload" style={{ width: "100%" }} onClick={() => fileRef.current?.click()}>
          <Camera size={32} />
          <strong style={{ color: "var(--text)" }}>Add a screenshot</strong>
          <span className="small">WhatsApp request or UPI payment</span>
        </button>
      )}
      {imgError && <p className="small" style={{ color: "var(--red)", fontWeight: 600 }}>{imgError}</p>}

      <div className="divider">or type it</div>

      <label className="field">
        <span className="sr-only">Describe the payment</span>
        <textarea
          className="textarea"
          value={text}
          maxLength={MAX_TEXT}
          onChange={(e) => setText(e.target.value)}
          placeholder={`e.g. Gave ${helper.name} 3000 advance for school fees`}
        />
        <span className="hint">English, Hindi or Hinglish all work.</span>
      </label>

      {left <= 0 ? (
        <Banner kind="info">You&apos;ve used today&apos;s {AI_DAILY_LIMIT} AI reads. You can still enter payments yourself.</Banner>
      ) : (
        <p className="muted small center" data-testid="ai-left">{left} of {AI_DAILY_LIMIT} AI reads left today</p>
      )}

      <BottomBar>
        <button type="button" className="btn btn-primary" onClick={readWithAi} disabled={!canRead || busy} aria-busy={busy}>
          {busy ? <><span className="spinner" aria-hidden="true" /> Reading…</> : "Read with AI"}
        </button>
        <button type="button" className="link-btn" style={{ width: "100%" }} onClick={() => manual()}>
          Fill in myself
        </button>
      </BottomBar>
    </>
  );
}
