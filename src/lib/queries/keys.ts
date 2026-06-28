// Centralized TanStack Query keys so invalidation stays consistent.
export const queryKeys = {
  profile: ["profile"] as const,
  crews: ["crews"] as const,
  roundTemplates: ["round-templates"] as const,
  recentEvents: ["events", "recent"] as const,
};
