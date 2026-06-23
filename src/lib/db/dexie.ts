import Dexie, { type EntityTable } from "dexie";

/**
 * Local-first IndexedDB store (§ offline-first). This is the Phase 0 scaffold:
 * it establishes the DB, a versioned schema, and a sync-queue table so Phase 2
 * scoring can write locally first and flush to Supabase on reconnect.
 *
 * Design notes (see KNOWN_ISSUES.md → offline conflict model):
 *  - One HoleScore row per player per hole keeps the conflict surface small.
 *  - Conflicts resolve last-write-wins on (updated_at, version).
 *  - `outbox` is the queue of local mutations awaiting sync.
 */

/** A locally-cached hole score (mirrors the future Supabase HoleScore row). */
export interface LocalHoleScore {
  /** Stable client id: `${groupId}:${roundPlayerId}:${holeNumber}`. */
  id: string;
  groupId: string;
  roundPlayerId: string;
  holeNumber: number;
  /** null = picked up / no score (engine handles separately). */
  strokes: number | null;
  enteredBy: string;
  updatedAt: string; // ISO timestamp — drives last-write-wins
  version: number;
  /** false until the row has been confirmed synced to Supabase. */
  synced: boolean;
}

/** A queued local mutation awaiting flush to Supabase. */
export interface OutboxItem {
  id?: number; // auto-increment
  table: string;
  op: "upsert" | "delete";
  payload: unknown;
  createdAt: string;
  attempts: number;
}

/** Small generic key/value cache (e.g. last-used course, draft round setup). */
export interface KeyValue {
  key: string;
  value: unknown;
  updatedAt: string;
}

const db = new Dexie("autocaddie") as Dexie & {
  holeScores: EntityTable<LocalHoleScore, "id">;
  outbox: EntityTable<OutboxItem, "id">;
  kv: EntityTable<KeyValue, "key">;
};

// v1 — Phase 0 scaffold. Bump the version (never edit a shipped store) as the
// schema grows in later phases.
db.version(1).stores({
  holeScores: "id, groupId, roundPlayerId, holeNumber, synced, updatedAt",
  outbox: "++id, table, createdAt",
  kv: "key, updatedAt",
});

export { db };
