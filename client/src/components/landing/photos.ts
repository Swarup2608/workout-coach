/* ---------------------------------------------------------------------------
   Stock photos served from public/media/ (Unsplash License).
   Kept out of lib.tsx on purpose: lib.tsx is a "use client" module, and its exports
   are client references (not values) when a server component imports them — the
   /disciplines/[slug] page reads these on the server, where they came through as undefined.
   --------------------------------------------------------------------------- */
export const media = (file: string) => `/media/${file}`;

export const PHOTOS = {
  barbellFloor: media("barbell-floor.jpg"),
  womanLift: media("woman-lift.jpg"),
  sprintStart: media("sprint-start.jpg"),
  kettlebell: media("kettlebell.jpg"),
  womanCarry: media("woman-carry.jpg"),
  courtDark: media("court-dark.jpg"),
  womanBarbell: media("woman-barbell.jpg"),
  monoAthlete: media("mono-athlete.jpg"),
  bowl: media("bowl.jpg"),
  roadRun: media("road-run.jpg"),
  gymInterior: media("gym-interior.jpg"),
  orangeTank: media("orange-tank.jpg"),
  runningField: media("running-field.jpg"),
  floorMobility: media("floor-mobility.jpg"),
};
