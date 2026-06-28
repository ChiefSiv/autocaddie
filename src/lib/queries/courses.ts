"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseEnv } from "@/lib/env";
import { queryKeys } from "./keys";
import type { CourseSearchResult } from "@/lib/courses/types";

// Client-side course shapes (read directly from the cache tables; course-data
// RLS allows authenticated select/write — see migration 0002). The server-only
// cache.ts owns provider fetches; these hooks read what's already cached and let
// the setup flow confirm/enter stroke indexes.

export interface CourseTeeHole {
  number: number;
  par: number;
  strokeIndex: number | null;
  yardage: number | null;
}
export interface CourseTee {
  id: string;
  name: string;
  gender: string | null;
  rating: number | null;
  slope: number | null;
  par: number | null;
  holes: CourseTeeHole[];
}
export interface CourseDetail {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  tees: CourseTee[];
}

export interface CachedCourseSummary {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
}

/** Already-cached courses to pick from (e.g. the Graywolf test course). */
export function useCachedCourses() {
  return useQuery({
    queryKey: queryKeys.cachedCourses,
    queryFn: async (): Promise<CachedCourseSummary[]> => {
      if (!hasSupabaseEnv()) return [];
      const supabase = createClient();
      const { data } = await supabase
        .from("courses")
        .select("id, name, city, state")
        .order("name");
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

/** Full tees + holes for one cached course. */
export function useCourseDetail(courseId: string | null) {
  return useQuery({
    queryKey: courseId ? queryKeys.courseDetail(courseId) : ["courses", "detail", "none"],
    enabled: !!courseId && hasSupabaseEnv(),
    queryFn: async (): Promise<CourseDetail | null> => {
      if (!courseId) return null;
      const supabase = createClient();
      const { data: course } = await supabase
        .from("courses")
        .select("id, name, city, state")
        .eq("id", courseId)
        .single();
      if (!course) return null;
      const { data: teeRows } = await supabase
        .from("tee_sets")
        .select("*")
        .eq("course_id", courseId)
        .order("name");
      const tees: CourseTee[] = [];
      for (const tee of teeRows ?? []) {
        const { data: holeRows } = await supabase
          .from("holes")
          .select("number, par, stroke_index, yardage")
          .eq("tee_set_id", tee.id)
          .order("number");
        tees.push({
          id: tee.id,
          name: tee.name,
          gender: tee.gender,
          rating: tee.rating,
          slope: tee.slope,
          par: tee.par,
          holes: (holeRows ?? []).map((h) => ({
            number: h.number,
            par: h.par,
            strokeIndex: h.stroke_index,
            yardage: h.yardage,
          })),
        });
      }
      return {
        id: course.id,
        name: course.name,
        city: course.city,
        state: course.state,
        tees,
      };
    },
    staleTime: 30_000,
  });
}

/** Provider search (server route keeps the API key off the client). */
export function useSearchCourses(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: queryKeys.courseSearch(q),
    enabled: q.length >= 2 && hasSupabaseEnv(),
    queryFn: async (): Promise<CourseSearchResult[]> => {
      const res = await fetch(`/api/courses/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error("Search failed");
      const json = await res.json();
      return json.results ?? [];
    },
    staleTime: 60_000,
  });
}

/** Fetch-and-cache a provider course on first use; returns the new course id. */
export function useCacheCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      providerId: string;
      provider: string;
    }): Promise<string> => {
      const res = await fetch(
        `/api/courses/${encodeURIComponent(input.providerId)}?provider=${encodeURIComponent(input.provider)}`,
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not load course");
      return json.course.id as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cachedCourses });
    },
  });
}

/**
 * Persist confirmed/entered stroke indexes for a tee's holes. This is the write
 * behind the MANDATORY stroke-index gate — net scoring is blocked until every
 * hole has one (allocateStrokes throws otherwise).
 */
export function useSaveStrokeIndexes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      courseId: string;
      teeSetId: string;
      strokeIndexByHole: Record<number, number>;
    }): Promise<void> => {
      const supabase = createClient();
      // One UPDATE per hole (small N ≤ 18); keeps it simple and RLS-safe.
      for (const [holeNumber, si] of Object.entries(input.strokeIndexByHole)) {
        const { error } = await supabase
          .from("holes")
          .update({ stroke_index: si })
          .eq("tee_set_id", input.teeSetId)
          .eq("number", Number(holeNumber));
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: (_void, input) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.courseDetail(input.courseId),
      });
    },
  });
}
