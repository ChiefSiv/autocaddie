import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  db,
  type LocalHoleScore,
  type OutboxItem,
  type KeyValue,
} from "./dexie";

export { db };
export type { LocalHoleScore, OutboxItem, KeyValue };

type Db = SupabaseClient<Database>;

/** True only in the browser — IndexedDB does not exist on the server. */
export const isClientDbAvailable = typeof indexedDB !== "undefined";

function holeScoreId(
  groupId: string,
  roundPlayerId: string,
  holeNumber: number,
): string {
  return `${groupId}:${roundPlayerId}:${holeNumber}`;
}

/**
 * Local-first write of a single hole score. Stamps updatedAt + bumps version,
 * marks it unsynced, and enqueues an outbox item for the sync layer (Phase 2).
 */
export async function putHoleScore(
  input: Omit<LocalHoleScore, "id" | "updatedAt" | "version" | "synced"> & {
    version?: number;
  },
): Promise<LocalHoleScore> {
  const id = holeScoreId(input.groupId, input.roundPlayerId, input.holeNumber);
  const existing = await db.holeScores.get(id);
  const record: LocalHoleScore = {
    id,
    groupId: input.groupId,
    roundPlayerId: input.roundPlayerId,
    holeNumber: input.holeNumber,
    strokes: input.strokes,
    enteredBy: input.enteredBy,
    updatedAt: new Date().toISOString(),
    version: (existing?.version ?? 0) + 1,
    synced: false,
  };

  await db.transaction("rw", db.holeScores, db.outbox, async () => {
    await db.holeScores.put(record);
    await db.outbox.add({
      table: "hole_scores",
      op: "upsert",
      payload: record,
      createdAt: record.updatedAt,
      attempts: 0,
    } satisfies Omit<OutboxItem, "id">);
  });

  return record;
}

/** Read all hole scores for a group (e.g. to hydrate the scorecard). */
export function getGroupHoleScores(groupId: string) {
  return db.holeScores.where("groupId").equals(groupId).toArray();
}

/** Items still waiting to sync — the flush queue drains these (Phase 2). */
export function getPendingOutbox() {
  return db.outbox.orderBy("createdAt").toArray();
}

/** Simple namespaced kv get/set for drafts and last-used selections. */
export async function kvGet<T>(key: string): Promise<T | undefined> {
  const row = await db.kv.get(key);
  return row?.value as T | undefined;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  await db.kv.put({ key, value, updatedAt: new Date().toISOString() });
}

// ── Sync (Phase 2) ────────────────────────────────────────────────────────────
// Local IndexedDB is the source of truth for the UI (offline-safe, survives
// restart). The outbox flushes to Supabase when online; hydration pulls remote
// rows the first time / on a fresh device. Last-write-wins on updatedAt+version.

/**
 * Drain the outbox to Supabase. Hole scores upsert on the natural key
 * (group_id, round_player_id, hole_number). On success the local row is marked
 * synced (only if no newer local edit superseded the queued version) and the
 * outbox item removed; on failure it's left for retry. Returns # flushed.
 */
export async function flushOutbox(supabase: Db): Promise<number> {
  if (!isClientDbAvailable) return 0;
  const items = await db.outbox.orderBy("createdAt").toArray();
  let flushed = 0;
  for (const item of items) {
    if (item.id == null) continue;
    if (item.table !== "hole_scores") {
      await db.outbox.delete(item.id);
      continue;
    }
    const p = item.payload as LocalHoleScore;
    const { error } = await supabase.from("hole_scores").upsert(
      {
        group_id: p.groupId,
        round_player_id: p.roundPlayerId,
        hole_number: p.holeNumber,
        strokes: p.strokes, // null = pick-up, preserved through sync
        entered_by: p.enteredBy || null,
        version: p.version,
        updated_at: p.updatedAt,
      },
      { onConflict: "group_id,round_player_id,hole_number" },
    );
    if (error) {
      await db.outbox.update(item.id, { attempts: item.attempts + 1 });
      continue; // keep queued for retry
    }
    await db.outbox.delete(item.id);
    const local = await db.holeScores.get(p.id);
    if (local && local.version === p.version) {
      await db.holeScores.update(p.id, { synced: true });
    }
    flushed++;
  }
  return flushed;
}

/**
 * Pull remote hole scores for a group into the local store — used on load and a
 * fresh device. Only overwrites a local row when it's already synced (no pending
 * local edit) AND the remote is strictly newer, or when no local row exists; this
 * preserves offline edits awaiting flush.
 */
export async function hydrateHoleScores(
  supabase: Db,
  groupId: string,
): Promise<void> {
  if (!isClientDbAvailable) return;
  const { data } = await supabase
    .from("hole_scores")
    .select("group_id, round_player_id, hole_number, strokes, entered_by, version, updated_at")
    .eq("group_id", groupId);
  for (const row of data ?? []) {
    const id = `${row.group_id}:${row.round_player_id}:${row.hole_number}`;
    const local = await db.holeScores.get(id);
    const remoteUpdated = row.updated_at ?? "";
    const takeRemote = !local || (local.synced && remoteUpdated > local.updatedAt);
    if (takeRemote) {
      await db.holeScores.put({
        id,
        groupId: row.group_id,
        roundPlayerId: row.round_player_id,
        holeNumber: row.hole_number,
        strokes: row.strokes,
        enteredBy: row.entered_by ?? "",
        updatedAt: remoteUpdated,
        version: row.version,
        synced: true,
      });
    }
  }
}
