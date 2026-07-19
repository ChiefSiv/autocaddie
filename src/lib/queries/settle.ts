"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseEnv } from "@/lib/env";
import { queryKeys } from "./keys";
import { buildLedgerRows, type LedgerNet } from "@/lib/ledger/ledger";

export interface SettleInput {
  eventId: string;
  /** null for a crewless one-off → NO ledger entry is written (structural) */
  crewId: string | null;
  /** combined net per DURABLE player id */
  nets: LedgerNet[];
}

/**
 * Settle the round (also used for end-early): mark the event completed and, when
 * it belongs to a crew, write one LedgerEntry per player. Idempotent — upserts on
 * UNIQUE(event_id, player_id) with the paid-flag policy applied in buildLedgerRows,
 * so a re-settle or settle-after-end-early replaces rather than doubles. A crewless
 * one-off writes nothing to the ledger.
 */
export function useSettleRound() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SettleInput): Promise<{ ledgerWritten: boolean }> => {
      const supabase = createClient();

      const { error: statusErr } = await supabase
        .from("events")
        .update({ status: "completed" })
        .eq("id", input.eventId);
      if (statusErr) throw new Error(statusErr.message);

      if (!input.crewId) return { ledgerWritten: false }; // crewless → no ledger

      const { data: existingRaw } = await supabase
        .from("ledger_entries")
        .select("player_id, amount, paid")
        .eq("event_id", input.eventId);
      const existing = (existingRaw ?? []).map((e) => ({
        player_id: e.player_id,
        amount: Number(e.amount), // numeric can arrive as string — coerce for the policy compare
        paid: e.paid,
      }));

      const rows = buildLedgerRows(input.crewId, input.eventId, input.nets, existing);
      const { error } = await supabase
        .from("ledger_entries")
        .upsert(rows, { onConflict: "event_id,player_id" });
      if (error) throw new Error(error.message);

      return { ledgerWritten: true };
    },
    onSuccess: (_r, input) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.event(input.eventId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.recentEvents });
      queryClient.invalidateQueries({ queryKey: ["event-ledger", input.eventId] });
      if (input.crewId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.seasonToDate(input.crewId),
        });
      }
    },
  });
}

export interface EventLedger {
  /** durable playerId → paid flag (settled this event) */
  paidByPlayer: Record<string, boolean>;
  /** durable playerId → signed amount */
  amountByPlayer: Record<string, number>;
  hasLedger: boolean;
}

/** Durable per-player ledger for one event — the SOURCE OF TRUTH for paid state. */
export function useEventLedger(eventId: string) {
  return useQuery({
    queryKey: ["event-ledger", eventId],
    enabled: !!eventId && hasSupabaseEnv(),
    queryFn: async (): Promise<EventLedger> => {
      const supabase = createClient();
      const { data } = await supabase
        .from("ledger_entries")
        .select("player_id, amount, paid")
        .eq("event_id", eventId);
      const paidByPlayer: Record<string, boolean> = {};
      const amountByPlayer: Record<string, number> = {};
      for (const e of data ?? []) {
        paidByPlayer[e.player_id] = e.paid;
        amountByPlayer[e.player_id] = Number(e.amount);
      }
      return { paidByPlayer, amountByPlayer, hasLedger: (data ?? []).length > 0 };
    },
    staleTime: 10_000,
  });
}

/** Write per-player paid flags to the durable ledger (Mark Paid). */
export function useMarkLedgerPaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      eventId: string;
      crewId: string | null;
      updates: { playerId: string; paid: boolean }[];
    }): Promise<void> => {
      const supabase = createClient();
      for (const u of input.updates) {
        const { error } = await supabase
          .from("ledger_entries")
          .update({ paid: u.paid })
          .eq("event_id", input.eventId)
          .eq("player_id", u.playerId);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: (_r, input) => {
      queryClient.invalidateQueries({ queryKey: ["event-ledger", input.eventId] });
    },
  });
}
