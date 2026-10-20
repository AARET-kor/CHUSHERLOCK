// components/bbip/care/useCareOrder.ts
"use client";

import { useCallback, useRef, useState } from "react";
import type { CareItem, CareOrder } from "../../../lib/bbip/care/types";

export type CareStatus = "idle" | "generating" | "ready" | "failed";

export interface CareController {
  order: CareOrder | null;
  status: CareStatus;
  error: string | null;
  generate: (replace?: boolean) => Promise<void>;
  saveItems: (items: CareItem[]) => Promise<void>;
  /** A row change is still on its way to the server. */
  saving: boolean;
  /** Resolves to an error message, or null when saved. */
  saveSet: (procedure: string) => Promise<string | null>;
}

interface CareState {
  sessionId: string | null;
  order: CareOrder | null;
  status: CareStatus;
  error: string | null;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

/** Client state of the session's care order. A new session starts idle. */
export function useCareOrder(sessionId: string | null, initial: CareOrder | null): CareController {
  const [state, setState] = useState<CareState>({
    sessionId,
    order: initial,
    status: initial ? "ready" : "idle",
    error: null,
  });
  const current: CareState =
    state.sessionId === sessionId ? state : { sessionId, order: null, status: "idle", error: null };
  if (state.sessionId !== sessionId) setState(current);

  const sessionRef = useRef(sessionId);
  sessionRef.current = sessionId;
  const orderRef = useRef(current.order);
  orderRef.current = current.order;
  // Row saves go out one at a time, always with the newest rows: parallel
  // PATCHes could land out of order and leave an older state on the server
  // while the screen shows the newer one.
  const inflight = useRef<Promise<void> | null>(null);
  const queued = useRef<{ orderId: string; items: CareItem[] } | null>(null);
  const [saving, setSaving] = useState(false);

  const generate = useCallback(
    async (replace = false) => {
      if (!sessionId) return;
      setState((s) => ({ ...s, status: "generating", error: null }));
      try {
        const res = await fetch(`/api/bbip/sessions/${sessionId}/care`, {
          method: "POST",
          headers: JSON_HEADERS,
          body: JSON.stringify({ replace }),
        });
        const data = await res.json().catch(() => ({}));
        if (sessionRef.current !== sessionId) return;
        if (!res.ok || !data.order) {
          setState((s) => ({ ...s, status: s.order ? "ready" : "failed", error: data.error ?? "오더 작성에 실패했습니다." }));
          return;
        }
        setState({ sessionId, order: data.order, status: "ready", error: null });
      } catch {
        if (sessionRef.current === sessionId) {
          setState((s) => ({ ...s, status: s.order ? "ready" : "failed", error: "네트워크 오류로 오더를 작성하지 못했습니다." }));
        }
      }
    },
    [sessionId]
  );

  const saveItems = useCallback((items: CareItem[]): Promise<void> => {
    const order = orderRef.current;
    if (!order) return Promise.resolve();
    setState((s) => (s.order ? { ...s, order: { ...s.order, items }, error: null } : s));
    queued.current = { orderId: order.id, items };
    if (inflight.current) return inflight.current;
    setSaving(true);
    inflight.current = (async () => {
      while (queued.current) {
        const next = queued.current;
        queued.current = null;
        try {
          const res = await fetch(`/api/bbip/care/${next.orderId}`, {
            method: "PATCH",
            headers: JSON_HEADERS,
            body: JSON.stringify({ items: next.items }),
          });
          const data = await res.json().catch(() => ({}));
          if (queued.current) continue; // newer rows are already queued
          if (!res.ok || !data.order) {
            setState((s) => ({ ...s, error: data.error ?? "저장하지 못했습니다. 다시 시도해 주세요." }));
            continue;
          }
          setState((s) => (s.order?.id === data.order.id ? { ...s, order: data.order } : s));
        } catch {
          if (!queued.current) setState((s) => ({ ...s, error: "네트워크 오류로 저장하지 못했습니다." }));
        }
      }
    })().finally(() => {
      inflight.current = null;
      setSaving(false);
    });
    return inflight.current;
  }, []);

  const saveSet = useCallback(async (procedure: string): Promise<string | null> => {
    const order = orderRef.current;
    if (!order) return "오더가 없습니다.";
    try {
      const res = await fetch(`/api/bbip/care/${order.id}/sets`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ procedure }),
      });
      const data = await res.json().catch(() => ({}));
      return res.ok ? null : (data.error ?? "세트를 저장하지 못했습니다.");
    } catch {
      return "네트워크 오류로 세트를 저장하지 못했습니다.";
    }
  }, []);

  return { order: current.order, status: current.status, error: current.error, generate, saveItems, saving, saveSet };
}
