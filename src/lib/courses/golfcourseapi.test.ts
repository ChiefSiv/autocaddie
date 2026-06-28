import { describe, expect, it } from "vitest";
import { mapCourse, mapSearchResult } from "./providers/golfcourseapi";
import { mapGolfApiCourse } from "./providers/golfapi";
import { teeHasFullStrokeIndex } from "./types";
import { FIXTURE_COURSE, FIXTURE_HOLES } from "./fixture";
import graywolfCourse from "./__fixtures__/graywolf-course.json";
import graywolfSearch from "./__fixtures__/graywolf-search.json";

// Typed loosely — these are real captured API responses.
const courseRaw = (graywolfCourse as { course: unknown }).course;
const searchRaw = graywolfSearch as { courses: unknown[] };

describe("GolfCourseAPI mapping (real Graywolf data)", () => {
  const c = mapCourse(courseRaw as Parameters<typeof mapCourse>[0]);

  it("maps identity + location", () => {
    expect(c.provider).toBe("golfcourseapi");
    expect(c.providerId).toBe("7028");
    expect(c.name).toBe("Graywolf Golf Club");
    expect(c.city).toBe("Clayton");
    expect(c.state).toBe("OH");
    expect(c.lat).toBeCloseTo(39.82831, 4);
  });

  it("flattens male + female tees (3 + 2 = 5), male first", () => {
    expect(c.tees).toHaveLength(5);
    expect(c.tees[0].gender).toBe("male");
    expect(c.tees.filter((t) => t.gender === "female")).toHaveLength(2);
  });

  it("maps the Gold tee's rating/slope/par and 18 holes", () => {
    const gold = c.tees.find((t) => t.name === "Gold");
    expect(gold).toBeDefined();
    expect(gold!.rating).toBe(73.8);
    expect(gold!.slope).toBe(135);
    expect(gold!.par).toBe(72);
    expect(gold!.holes).toHaveLength(18);
    expect(gold!.holes[0]).toMatchObject({ number: 1, par: 5, yardage: 509 });
  });

  it("documents the stroke-index GAP: Graywolf has none, so strokeIndex is null", () => {
    const gold = c.tees.find((t) => t.name === "Gold")!;
    expect(gold.holes.every((h) => h.strokeIndex === null)).toBe(true);
    expect(teeHasFullStrokeIndex(gold)).toBe(false);
  });

  it("maps search results", () => {
    const r = mapSearchResult(
      searchRaw.courses[0] as Parameters<typeof mapSearchResult>[0],
    );
    expect(r.providerId).toBe("7028");
    expect(r.name).toBe("Graywolf Golf Club");
    expect(r.provider).toBe("golfcourseapi");
  });
});

describe("golfapi.io mapping (synthetic — provider unverified)", () => {
  it("builds tees from parallel par/index arrays + tee boxes", () => {
    const raw = {
      courseID: 42,
      clubName: "Test GC",
      numHoles: 2,
      parsMen: [4, 3],
      indexesMen: [1, 18],
      teeBoxes: [
        { teeName: "Blue", courseRating: 70.1, slopeRating: 124, lengths: [400, 150] },
      ],
    };
    const c = mapGolfApiCourse(raw);
    expect(c.provider).toBe("golfapi");
    expect(c.providerId).toBe("42");
    expect(c.tees).toHaveLength(1);
    expect(c.tees[0].holes).toEqual([
      { number: 1, par: 4, strokeIndex: 1, yardage: 400 },
      { number: 2, par: 3, strokeIndex: 18, yardage: 150 },
    ]);
  });
});

describe("fixture course", () => {
  it("is par 72 with a full 1..18 stroke-index permutation", () => {
    expect(FIXTURE_HOLES).toHaveLength(18);
    expect(FIXTURE_HOLES.reduce((s, h) => s + h.par, 0)).toBe(72);
    const sis = FIXTURE_HOLES.map((h) => h.strokeIndex).sort((a, b) => a! - b!);
    expect(sis).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
    expect(teeHasFullStrokeIndex(FIXTURE_COURSE.tees[0])).toBe(true);
  });
});
