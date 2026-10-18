"use client";

import { useEffect, useState } from "react";
import type { BbipSession } from "../../lib/bbip/types";

/** Most recent sessions (newest first), refetched whenever the active
 * session changes so a freshly opened case shows up in the list. */
export function useRecentSessions(activeId: string | null): BbipSession[] {
  const [sessions, setSessions] = useState<BbipSession[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/bbip/sessions")
      .then((res) => (res.ok ? res.json() : { sessions: [] }))
      .then((data: { sessions: BbipSession[] }) => {
        if (!cancelled) setSessions(data.sessions);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  return sessions;
}
