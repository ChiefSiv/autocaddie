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
