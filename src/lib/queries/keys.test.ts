import { describe, expect, it } from "vitest";
import { queryKeys } from "./keys";

// Regression guard for the "queryKeys.crewPlayers is not a function" class of
// crash: every factory key must actually be a callable function at RUNTIME (not
// just typecheck), and every static key an array. This runs through the same
// module resolution the app uses, so it proves the EXPORTED object's shape.
describe("queryKeys runtime shape", () => {
  it("exposes the factory keys as callable functions", () => {
    expect(typeof queryKeys.crewPlayers).toBe("function");
    expect(typeof queryKeys.seasonToDate).toBe("function");
    expect(typeof queryKeys.courseDetail).toBe("function");
    expect(typeof queryKeys.courseSearch).toBe("function");
    expect(typeof queryKeys.event).toBe("function");
  });

  it("crewPlayers returns a stable key array", () => {
    expect(queryKeys.crewPlayers("abc")).toEqual(["crews", "abc", "players"]);
    expect(queryKeys.crewPlayers(null)).toEqual(["crews", null, "players"]);
  });

  it("exposes the static keys as arrays", () => {
    expect(Array.isArray(queryKeys.profile)).toBe(true);
    expect(Array.isArray(queryKeys.crews)).toBe(true);
    expect(Array.isArray(queryKeys.cachedCourses)).toBe(true);
  });
});
