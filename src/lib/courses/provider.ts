import "server-only";
import { serverEnv } from "@/lib/env";
import { GolfCourseApiProvider } from "./providers/golfcourseapi";
import { GolfApiIoProvider } from "./providers/golfapi";
import type { CourseDataProvider } from "./types";

/**
 * Resolves the active CourseDataProvider from config (COURSE_DATA_PROVIDER).
 * Server-only — the API keys never reach the client. GolfCourseAPI is primary;
 * golfapi.io is the fallback/upgrade behind the same interface.
 */
export function getCourseProvider(): CourseDataProvider {
  const env = serverEnv();
  if (env.courseDataProvider === "golfapi") {
    if (!env.golfApiKey) throw new Error("GOLFAPI_KEY is not configured");
    return new GolfApiIoProvider(env.golfApiKey);
  }
  if (!env.courseApiKey) throw new Error("COURSE_API_KEY is not configured");
  return new GolfCourseApiProvider(env.courseApiKey);
}
