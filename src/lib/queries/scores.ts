"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseEnv } from "@/lib/env";
import {
  getGroupHoleScores,
  putHoleScore,
  flushOutbox,
  hydrateHoleScores,
  isClientDbAvailable,
  type LocalHoleScore,
} from "@/lib/db";
import { scoreKey } from "@/lib/games/scoring";

export interface UseRoundScores {
  /** key `${roundPlayerId}:${holeNumber}` → local row (strokes: number=score, null=pick-up) */
  scores: Record<string, LocalHoleScore>;
  setScore: (
    roundPlayerId: string,
    holeNumber: number,
    strokes: number | null,
  ) => Promise<void>;
  ready: boolean;
  syncing: boolean;
  /** rows not yet confirmed synced to Supabase */
  pendingCount: number;
}

/**
 * Local-first hole scores (build prompt §9). Reads/writes IndexedDB (Dexie) so an
 * in-progress round survives going offline AND an app restart; flushes to Supabase
 * via the outbox when online, and hydrates from Supabase on load / a fresh device.
 * Single-device single-writer keeps the conflict surface tiny.
 */
export function useRoundScores(
  groupId: string | null,
  userId: string,
): UseRoundScores {
  const [scores, setScores] = useState<Record<string, LocalHoleScore>>({});
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!groupId || !isClientDbAvailable) {
      setReady(true);
      return;
    }
    const rows = await getGroupHoleScores(groupId);
    const map: Record<string, LocalHoleScore> = {};
    for (const r of rows) map[scoreKey(r.roundPlayerId, r.holeNumber)] = r;
    setScores(map);
    setPendingCount(rows.filter((r) => !r.synced).length);
    setReady(true);
  }, [groupId]);

  const sync = useCallback(async () => {
    if (
      !groupId ||
      !isClientDbAvailable ||
      !hasSupabaseEnv() ||
      typeof navigator !== "undefined" && !navigator.onLine
    ) {
      return;
    }
    setSyncing(true);
    try {
      await flushOutbox(createClient());
    } catch {
      // best-effort; rows stay queued for the next attempt
    } finally {
      setSyncing(false);
      await refresh();
    }
  }, [groupId, refresh]);

  // Hydrate from remote (if online), load local, then flush any pending.
  useEffect(() => {
    let active = true;
    (async () => {
      if (!groupId || !isClientDbAvailable) {
        setReady(true);
        return;
      }
      if (hasSupabaseEnv() && navigator.onLine) {
        try {
          await hydrateHoleScores(createClient(), groupId);
        } catch {
          // offline / transient — local store still drives the UI
        }
      }
      if (!active) return;
      await refresh();
      void sync();
    })();
    return () => {
      active = false;
    };
  }, [groupId, refresh, sync]);

  // Flush when connectivity returns.
  useEffect(() => {
    const onOnline = () => void sync();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [sync]);

  const setScore = useCallback(
    async (roundPlayerId: string, holeNumber: number, strokes: number | null) => {
      if (!groupId) return;
      // Optimistic local write first (offline-safe); sync is best-effort after.
      await putHoleScore({
        groupId,
        roundPlayerId,
        holeNumber,
        strokes, // null = pick-up, never 0
        enteredBy: userId,
      });
      await refresh();
      void sync();
    },
    [groupId, userId, refresh, sync],
  );

  return { scores, setScore, ready, syncing, pendingCount };
}
