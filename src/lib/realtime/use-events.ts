"use client";
import { useEffect, useRef } from "react";

/** Subscribe to branch events. `onEvent` also fires every `pollMs` as a fallback if SSE is down. */
export function useBranchEvents(onEvent: (type?: string) => void, pollMs = 15_000) {
  const ref = useRef(onEvent);
  useEffect(() => { ref.current = onEvent; });
  useEffect(() => {
    let es: EventSource | null = new EventSource("/api/events");
    es.onmessage = (m) => { try { ref.current(JSON.parse(m.data).type); } catch { ref.current(); } };
    const poll = setInterval(() => ref.current(), pollMs);
    return () => { es?.close(); es = null; clearInterval(poll); };
  }, [pollMs]);
}
