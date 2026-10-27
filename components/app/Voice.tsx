"use client";

import { useEffect, useRef, useState } from "react";
import { Mic } from "../Icons";

// The Web Speech API isn't in TypeScript's DOM types; this is the part we use.
interface SpeechResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechEvent {
  resultIndex: number;
  results: ArrayLike<SpeechResult>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type RecognitionCtor = new () => Recognition;

function getRecognition(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

const ERRORS: Record<string, string> = {
  "not-allowed": "Allow microphone access to use voice.",
  "service-not-allowed": "Voice isn't allowed in this browser. Please type instead.",
  "no-speech": "Didn't hear anything. Tap the mic and try again.",
  "audio-capture": "No microphone found.",
  network: "Voice needs internet. Please type instead.",
};

export type VoiceLang = "hi-IN" | "en-IN";

/**
 * Mic button that speaks into the text box. Spoken words are added after
 * whatever was already typed, live as they are recognised. Hidden in browsers
 * without speech recognition (e.g. Firefox).
 */
export default function VoiceInput({
  text,
  onText,
  disabled,
}: {
  text: string;
  onText: (t: string) => void;
  disabled?: boolean;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [lang, setLang] = useState<VoiceLang>("hi-IN");
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);

  useEffect(() => {
    setSupported(!!getRecognition());
    return () => rec.current?.abort();
  }, []);

  if (!supported) return null;

  const stop = () => rec.current?.stop();

  const start = () => {
    const Ctor = getRecognition();
    if (!Ctor) return;
    setError(null);
    const base = text.trim() ? text.trim() + " " : "";
    const finals: string[] = [];
    const r = new Ctor();
    r.lang = lang;
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finals[i] = res[0].transcript.trim();
        else interim += res[0].transcript;
      }
      onText((base + [...finals.filter(Boolean), interim.trim()].filter(Boolean).join(" ")).slice(0, 1000));
    };
    r.onerror = (e) => {
      if (e.error !== "aborted") setError(ERRORS[e.error] || "Voice didn't work. Please type instead.");
    };
    r.onend = () => setListening(false);
    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      setError("Voice didn't work. Please type instead.");
    }
  };

  return (
    <div className="voice">
      <div className="row">
        <button
          type="button"
          className={`btn btn-secondary voice-btn${listening ? " on" : ""}`}
          onClick={listening ? stop : start}
          disabled={disabled}
          aria-pressed={listening}
        >
          <Mic size={20} />
          {listening ? "Listening… tap to stop" : "Speak it"}
        </button>
        <div className="seg" role="group" aria-label="Voice language">
          <button type="button" aria-pressed={lang === "hi-IN"} onClick={() => setLang("hi-IN")} disabled={listening} lang="hi">
            हिंदी
          </button>
          <button type="button" aria-pressed={lang === "en-IN"} onClick={() => setLang("en-IN")} disabled={listening}>
            English
          </button>
        </div>
      </div>
      {error && (
        <p className="small" role="alert" style={{ color: "var(--red)", fontWeight: 600, margin: "8px 0 0" }}>
          {error}
        </p>
      )}
    </div>
  );
}
