import {
  db,
  type LocalHoleScore,
  type OutboxItem,
  type KeyValue,
} from "./dexie";

export { db };
export type { LocalHoleScore, OutboxItem, KeyValue };

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
