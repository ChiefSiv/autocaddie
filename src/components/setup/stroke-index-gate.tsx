"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSaveStrokeIndexes } from "@/lib/queries/courses";
import type { CourseTee } from "@/lib/queries/courses";

/**
 * MANDATORY round-setup gate (build prompt §8 addition). GolfCourseAPI frequently
 * returns no per-hole stroke index (verified: Graywolf) — and allocateStrokes
 * THROWS until every hole has one. So whenever the chosen tee is missing any
 * stroke index, this step BLOCKS starting the round until the scorekeeper
 * confirms/enters a complete 1..N permutation. SI is course-wide, so we collect
 * it for all of the tee's holes (reusable next round).
 */
export function StrokeIndexGate({
  courseId,
  tee,
  onComplete,
}: {
  courseId: string;
  tee: CourseTee;
  onComplete: () => void;
}) {
  const save = useSaveStrokeIndexes();
  const n = tee.holes.length;

  const [values, setValues] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      tee.holes.map((h) => [h.number, h.strokeIndex != null ? String(h.strokeIndex) : ""]),
    ),
  );

  const parsed = useMemo(() => {
    const out: Record<number, number> = {};
    for (const h of tee.holes) {
      const v = values[h.number];
      const num = v === "" ? NaN : Number(v);
      if (Number.isInteger(num)) out[h.number] = num;
    }
    return out;
  }, [values, tee.holes]);

  const error = useMemo(() => {
    const nums = tee.holes.map((h) => parsed[h.number]);
    if (nums.some((x) => x == null || Number.isNaN(x))) return "Every hole needs a stroke index.";
    if (nums.some((x) => x < 1 || x > n)) return `Stroke indexes must be between 1 and ${n}.`;
    if (new Set(nums).size !== n) return `Each number 1–${n} must be used exactly once.`;
    return null;
  }, [parsed, tee.holes, n]);

  const fillHoleOrder = () =>
    setValues(Object.fromEntries(tee.holes.map((h) => [h.number, String(h.number)])));

  const onSave = async () => {
    if (error) return;
    await save.mutateAsync({
      courseId,
      teeSetId: tee.id,
      strokeIndexByHole: parsed,
    });
    onComplete();
  };

  return (
    <div className="rounded-lg border border-flare bg-flare-soft/40 p-4">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 size-5 flex-none text-flare" aria-hidden />
        <div>
          <h3 className="font-display text-lg font-extrabold uppercase">
            Confirm stroke indexes
          </h3>
          <p className="mt-1 text-sm text-muted">
            This tee has no stroke index from the course provider — enter it once
            (1 = hardest hole). Scoring stays locked until it&rsquo;s complete.
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tee.holes.map((h) => (
          <label
            key={h.number}
            className="flex items-center justify-between gap-2 rounded-md border border-line bg-card px-3 py-2"
          >
            <span className="font-label text-xs uppercase tracking-[0.06em] text-muted">
              Hole {h.number}
              <span className="ml-1 text-[10px]">· par {h.par}</span>
            </span>
            <input
              inputMode="numeric"
              aria-label={`Stroke index for hole ${h.number}`}
              value={values[h.number] ?? ""}
              onChange={(e) =>
                setValues((v) => ({ ...v, [h.number]: e.target.value.replace(/[^0-9]/g, "") }))
              }
              className="font-display w-12 rounded-md border border-line bg-field px-2 py-1 text-center text-lg font-extrabold outline-none focus:border-fairway"
            />
          </label>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={fillHoleOrder}
          className="font-label text-xs font-semibold uppercase tracking-[0.06em] text-fairway"
        >
          Fill 1–{n} in hole order
        </button>
        {error ? (
          <span className="text-xs text-down">{error}</span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-up">
            <Check className="size-3.5" aria-hidden /> Valid
          </span>
        )}
      </div>

      {save.error && (
        <p className="mt-2 text-xs text-down">{(save.error as Error).message}</p>
      )}

      <Button
        onClick={onSave}
        disabled={!!error || save.isPending}
        className="mt-3 h-11 w-full bg-fairway text-white"
      >
        {save.isPending ? "Saving…" : "Save stroke indexes"}
      </Button>
    </div>
  );
}
