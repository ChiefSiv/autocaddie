import { describe, expect, it } from "vitest";
import { liveStandings, type LiveGameConfig } from "./live";
import type { HoleScores } from "./types";

const players = ["A", "B"];
function net(rows: Array<Record<string, number | null>>): HoleScores[] {
  return rows.map((n, i) => ({ hole: i + 1, net: n }));
}

describe("liveStandings — skins pot (stakes ON must be NON-zero)", () => {
  const skins = (stakesEnabled: boolean, stake: number | null): LiveGameConfig => ({
    id: "s",
    type: "skins",
    stakesEnabled,
    stake,
    carryover: true,
  });

  it("after an outright win the pot is one hole's ante — NOT $0 (regression)", () => {
    // 2 players, $5. Hole 1 A wins outright → carry 0 → pot on next hole = 5×2×1 = $10.
    const r = liveStandings([skins(true, 5)], players, net([{ A: 3, B: 4 }]), 18);
    const s = r[0];
    expect(s.type === "skins" && s.potValue).toBe(10); // was $0 with the old metric
    expect(s.type === "skins" && s.potValue).toBeGreaterThan(0);
    expect(s.type === "skins" && s.skinsWon.A).toBe(1);
    expect(s.type === "skins" && s.nets.A).toBe(5); // won $10 pot − $5 ante
    expect(s.type === "skins" && s.nets.B).toBe(-5);
  });

  it("pot grows on a tie (carry)", () => {
    // Hole 1 tie → carry 1 → pot = 5×2×(1+1) = $20.
    const r = liveStandings([skins(true, 5)], players, net([{ A: 4, B: 4 }]), 18);
    const s = r[0];
    expect(s.type === "skins" && s.potValue).toBe(20);
    expect(s.type === "skins" && s.carry).toBe(1);
  });

  it("stakes OFF → pot 0", () => {
    const r = liveStandings([skins(false, 5)], players, net([{ A: 3, B: 4 }]), 18);
    expect(r[0].type === "skins" && r[0].potValue).toBe(0);
  });
});

describe("liveStandings — skins 'won so far' (gross) is MONOTONIC across pick-ups", () => {
  const g: LiveGameConfig = {
    id: "s",
    type: "skins",
    stakesEnabled: true,
    stake: 5,
    carryover: true,
  };
  // Pick-ups on BOTH sides. Pots (2 players × $5 = $10/hole):
  //  h1 A wins $10 · h2 B wins $10 (A picked up) · h3 carry · h4 A wins $20
  //  (covers h3+h4) · h5 A wins $10 (B picked up)
  const full = net([
    { A: 4, B: 5 },
    { A: null, B: 4 },
    { A: 4, B: 4 },
    { A: 4, B: 5 },
    { A: 5, B: null },
  ]);
  const wonAt = (n: number) => {
    const r = liveStandings([g], players, full.slice(0, n), 18)[0];
    if (r.type !== "skins") throw new Error("not skins");
    return r.won;
  };

  it("each player's gross won never decreases hole to hole", () => {
    let prevA = -1;
    let prevB = -1;
    for (let n = 1; n <= 5; n++) {
      const w = wonAt(n);
      expect(w.A).toBeGreaterThanOrEqual(prevA);
      expect(w.B).toBeGreaterThanOrEqual(prevB);
      prevA = w.A;
      prevB = w.B;
    }
  });

  it("per-hole won deltas equal the pots awarded that hole", () => {
    const seq = [1, 2, 3, 4, 5].map(wonAt);
    const delta = (k: "A" | "B", i: number) =>
      seq[i][k] - (i === 0 ? 0 : seq[i - 1][k]);
    expect([0, 1, 2, 3, 4].map((i) => delta("A", i))).toEqual([10, 0, 0, 20, 10]);
    expect([0, 1, 2, 3, 4].map((i) => delta("B", i))).toEqual([0, 10, 0, 0, 0]);
  });

  it("settlement net stays correct (A +15 / B −15) and is distinct from gross won", () => {
    const r = liveStandings([g], players, full, 18)[0];
    if (r.type !== "skins") throw new Error("not skins");
    expect(r.nets.A).toBe(15); // (4 − 1 skins) × $5
    expect(r.nets.B).toBe(-15);
    expect(r.nets.A + r.nets.B).toBe(0);
    expect(r.won.A).toBe(40); // gross pots collected — the monotonic accrual
    expect(r.won.B).toBe(10);
  });
});

describe("liveStandings — match (live 'thru N', not closed)", () => {
  it("reads '2 up' thru 2 of 18, not a closeout", () => {
    const g: LiveGameConfig = {
      id: "m",
      type: "match",
      stakesEnabled: true,
      stake: 20,
      sides: { a: "A", b: "B" },
    };
    // A wins holes 1 & 2; 16 still to play → 2 up, NOT decided
    const r = liveStandings([g], players, net([{ A: 4, B: 5 }, { A: 4, B: 5 }]), 18);
    const m = r[0];
    expect(m.type).toBe("match");
    expect(m.type === "match" && m.text).toBe("2 up");
    expect(m.type === "match" && m.thru).toBe(2);
    expect(m.type === "match" && m.leaderId).toBe("A");
  });
});

describe("liveStandings — nassau segments", () => {
  it("shows current front-9 leader", () => {
    const g: LiveGameConfig = {
      id: "n",
      type: "nassau",
      stakesEnabled: true,
      stake: 10,
      sides: { a: "A", b: "B" },
    };
    const r = liveStandings([g], players, net([{ A: 4, B: 5 }, { A: 4, B: 5 }]), 18);
    const n = r[0];
    expect(n.type).toBe("nassau");
    if (n.type === "nassau") {
      const front = n.segments.find((s) => s.key === "front")!;
      expect(front.leaderId).toBe("A");
      expect(front.text).toBe("2 up");
    }
  });
});
