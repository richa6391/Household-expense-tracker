"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { emptyData, loadData, localToday, saveData } from "@/lib/storage";
import type { AppData } from "@/lib/types";
import { Check } from "../Icons";
import AddHelper from "./AddHelper";
import Home from "./Home";
import Ledger from "./Ledger";
import Paid from "./Paid";
import PaydayScreen from "./PaydayScreen";
import PaymentForm from "./PaymentForm";
import Record from "./Record";
import { EMPTY_RECORD, type Ctx, type RecordDraft, type View } from "./ui";

/** history.state key holding this entry's position in the view stack. */
const KEY = "psfh";

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [data, setData] = useState<AppData>(emptyData);
  const dataRef = useRef(data);
  const [saveFailed, setSaveFailed] = useState(false);
  const [stack, setStackState] = useState<View[]>([{ name: "home" }]);
  // Bumped on every navigation so the screen always remounts with fresh state.
  const [navId, setNavId] = useState(0);
  const stackRef = useRef(stack);
  const pendingReset = useRef<View[] | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const [record, setRecord] = useState<RecordDraft>(EMPTY_RECORD);
  const today = useMemo(() => localToday(), []);

  const setStack = (s: View[]) => {
    stackRef.current = s;
    setStackState(s);
    setNavId((n) => n + 1);
  };

  useEffect(() => {
    const d = loadData();
    dataRef.current = d;
    setData(d);
    setLoaded(true);

    window.history.replaceState({ ...window.history.state, [KEY]: 0 }, "");
    const onPop = (e: PopStateEvent) => {
      if (pendingReset.current) {
        const next = pendingReset.current;
        pendingReset.current = null;
        next.slice(1).forEach((_, i) => window.history.pushState({ [KEY]: i + 1 }, ""));
        setStack(next);
        return;
      }
      const i = typeof e.state?.[KEY] === "number" ? e.state[KEY] : 0;
      setStack(stackRef.current.slice(0, i + 1));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const top = stack[stack.length - 1];
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [top]);

  const update = useCallback((fn: (d: AppData) => AppData) => {
    const next = fn(dataRef.current);
    dataRef.current = next;
    setData(next);
    setSaveFailed(!saveData(next));
  }, []);

  const push = useCallback((v: View) => {
    const next = [...stackRef.current, v];
    window.history.pushState({ [KEY]: next.length - 1 }, "");
    setStack(next);
  }, []);

  const back = useCallback(() => {
    if (stackRef.current.length > 1) window.history.back();
  }, []);

  /** Replace the whole stack (e.g. after saving, so Back skips the finished form). */
  const reset = useCallback((next: View[]) => {
    const depth = stackRef.current.length - 1;
    if (depth === 0) {
      next.slice(1).forEach((_, i) => window.history.pushState({ [KEY]: i + 1 }, ""));
      setStack(next);
    } else {
      pendingReset.current = next;
      window.history.go(-depth);
    }
  }, []);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 3500);
  }, []);

  const ctx: Ctx = {
    data,
    today,
    update,
    push,
    back,
    reset,
    toast,
    helper: (id) => data.helpers.find((h) => h.id === id),
    record,
    setRecord,
  };

  if (!loaded) return <main className="page" aria-busy="true" />;

  let screen: JSX.Element;
  switch (top.name) {
    case "home":
      screen = <Home ctx={ctx} />;
      break;
    case "add":
      screen = <AddHelper ctx={ctx} />;
      break;
    case "record":
      screen = <Record ctx={ctx} view={top} />;
      break;
    case "form":
      screen = <PaymentForm ctx={ctx} view={top} />;
      break;
    case "ledger":
      screen = <Ledger ctx={ctx} helperId={top.helperId} />;
      break;
    case "payday":
      screen = <PaydayScreen ctx={ctx} helperId={top.helperId} />;
      break;
    case "paid":
      screen = <Paid ctx={ctx} paydayId={top.paydayId} />;
      break;
  }

  return (
    <>
      {saveFailed && (
        <div className="save-fail" role="alert">
          Couldn&apos;t save on this phone (private mode or storage full). Changes will be lost when you close this page.
        </div>
      )}
      <main className="page" key={navId}>
        {screen}
      </main>
      {toastMsg && (
        <div className="toast" role="status" aria-live="polite">
          <Check size={18} />
          {toastMsg}
        </div>
      )}
    </>
  );
}
