// Centralized TanStack Query keys so invalidation stays consistent.
//
// HARDENING: this is a concrete `as const` factory with NO catch-all index
// signature. That means `queryKeys.<name>` for a name that doesn't exist is a
// COMPILE error (not a runtime "is not a function"), and calling a non-function
// key — e.g. `queryKeys.crews()` — is also a compile error. Do NOT annotate this
// object with a `Record<string, ...>`/index-signature type: that would reopen the
// hole by making every property access type-check even when it doesn't exist.
export const queryKeys = {
  profile: ["profile"],
  crews: ["crews"],
  crewPlayers: (crewId: string | null) => ["crews", crewId, "players"] as const,
  seasonToDate: (crewId: string | null) => ["crews", crewId, "season"] as const,
  roundTemplates: ["round-templates"],
  recentEvents: ["events", "recent"],
  cachedCourses: ["courses", "cached"],
  courseDetail: (courseId: string) => ["courses", "detail", courseId] as const,
  courseSearch: (q: string) => ["courses", "search", q] as const,
  event: (eventId: string) => ["event", eventId] as const,
} as const;
