import { describe, expect, it } from "vitest";
import { liveStandings, type LiveGameConfig } from "./live";
import type { HoleScores } from "./types";

const players = ["A", "B"];
function net(rows: Array<Record<string, number | null>>): HoleScores[] {
  return rows.map((n, i) => ({ hole: i + 1, net: n }));
}

describe("liveStandings — skins", () => {
  it("reports the carried pot mid-round", () => {
    const g: LiveGameConfig = { id: "s", type: "skins", stakesEnabled: true, stake: 5, carryover: true };
    // hole 1 tie → carry; pot riding = 2 players × $5 × 1 = $10
    const r = liveStandings([g], players, net([{ A: 4, B: 4 }]), 18);
    expect(r[0]).toMatchObject({ type: "skins", potValue: 10, carry: 1 });
  });

  it("clears the pot after an outright win and credits the skin", () => {
    const g: LiveGameConfig = { id: "s", type: "skins", stakesEnabled: true, stake: 5, carryover: true };
    const r = liveStandings([g], players, net([{ A: 3, B: 4 }]), 18);
    const s = r[0];
    expect(s.type === "skins" && s.potValue).toBe(0);
    expect(s.type === "skins" && s.skinsWon.A).toBe(1);
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
