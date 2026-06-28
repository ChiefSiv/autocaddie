import type { NormalizedCourse, NormalizedHole } from "./types";

// Hard-coded fixture course (build prompt §8) so the handicap engine and Phase 1
// UI are testable WITHOUT live API calls. Par 72; stroke indexes are a full
// permutation of 1..18 (odds on the front, evens on the back — a common layout),
// so net-scoring/stroke-allocation tests have real, complete data.

const FRONT: Array<[par: number, si: number, yds: number]> = [
  [4, 5, 410],
  [4, 11, 395],
  [3, 17, 175],
  [5, 1, 540],
  [4, 7, 430],
  [4, 13, 380],
  [3, 15, 165],
  [4, 3, 450],
  [5, 9, 510],
];
const BACK: Array<[par: number, si: number, yds: number]> = [
  [4, 6, 415],
  [5, 2, 555],
  [4, 12, 385],
  [3, 18, 150],
  [4, 8, 425],
  [4, 4, 440],
  [5, 10, 505],
  [3, 16, 160],
  [4, 14, 390],
];

export const FIXTURE_HOLES: NormalizedHole[] = [...FRONT, ...BACK].map(
  ([par, si, yds], i) => ({
    number: i + 1,
    par,
    strokeIndex: si,
    yardage: yds,
  }),
);

/** "Autocaddie Test Links" — par 72, rating 71.5 / slope 128, full SI data. */
export const FIXTURE_COURSE: NormalizedCourse = {
  provider: "fixture",
  providerId: "fixture-test-links",
  name: "Autocaddie Test Links",
  location: "Kitchen Table",
  city: null,
  state: null,
  country: null,
  lat: null,
  lng: null,
  tees: [
    {
      name: "Blue",
      gender: null,
      rating: 71.5,
      slope: 128,
      par: 72,
      holes: FIXTURE_HOLES,
    },
  ],
};
