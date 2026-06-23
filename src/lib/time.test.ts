import { describe, expect, it } from "vitest";
import { greeting } from "./time";

// Phase 0 smoke test — proves the Vitest harness runs green. The handicap /
// stroke-allocation engine tests (build prompt §7) arrive in Phase 1.
describe("greeting", () => {
  it("says morning before noon", () => {
    expect(greeting(new Date(2026, 5, 22, 8, 0))).toBe("Good morning");
  });
  it("says afternoon between noon and 6pm", () => {
    expect(greeting(new Date(2026, 5, 22, 14, 0))).toBe("Good afternoon");
  });
  it("says evening after 6pm", () => {
    expect(greeting(new Date(2026, 5, 22, 20, 0))).toBe("Good evening");
  });
});
