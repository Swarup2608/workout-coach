import { exerciseSlug, type ExerciseInfo, type Injury, type MuscleGroup, type WorkoutPlan, type WorkoutSession } from "../domain.js";
import { classifyMuscle } from "./muscles.js";
import { LIBRARY, type LibraryExercise, type Pattern } from "./starterPlan.js";

/**
 * The exercise library: the 82 exercises in seed/workouts.json, with how-to text per movement
 * pattern, plus any exercise from the user's own plans and logs. Images: an optional per-exercise
 * `image` in workouts.json, else a stock photo from client/public/media picked by pattern.
 */

interface Guide {
  secondary: string[];
  steps: string[];
  cues: string[];
  mistakes: string[];
  image: string;
  compound: boolean;
}

const GUIDES: Record<Pattern | "other", Guide> = {
  squat: {
    secondary: ["glutes", "adductors", "core"],
    steps: ["Set your feet about shoulder-width, toes slightly out.", "Brace your core and take a breath in.", "Sit down and back between your hips until your thighs are at least parallel, or as deep as you control.", "Drive up through your whole foot, breathing out at the top."],
    cues: ["Knees track over toes", "Chest proud, ribs down", "Whole foot stays planted", "Same speed down every rep"],
    mistakes: ["Knees caving in", "Heels lifting", "Bouncing out of the bottom", "Rounding the lower back at depth"],
    image: "/media/woman-barbell.jpg",
    compound: true,
  },
  hinge: {
    secondary: ["glutes", "lower back", "forearms"],
    steps: ["Stand with feet hip-width, weight in the middle of the foot.", "Push your hips back with a soft bend in the knees.", "Lower until you feel a strong hamstring stretch with a flat back.", "Squeeze your glutes to stand tall."],
    cues: ["Hips back, not down", "Flat back, neck neutral", "Keep the weight close to your legs", "Finish with glutes, not by leaning back"],
    mistakes: ["Rounding the back", "Turning it into a squat", "Over-extending at the top", "Letting the weight drift forward"],
    image: "/media/barbell-floor.jpg",
    compound: true,
  },
  lunge: {
    secondary: ["glutes", "adductors", "core"],
    steps: ["Stand tall and step into a long stance.", "Lower straight down until the back knee is just above the floor.", "Keep most of the weight on the front foot.", "Push through the front heel to come back up."],
    cues: ["Torso tall", "Front knee over mid-foot", "Control the way down", "Even reps each side"],
    mistakes: ["Stance too narrow (wobbling)", "Front heel lifting", "Pushing off the back foot", "Rushing the reps"],
    image: "/media/mono-athlete.jpg",
    compound: true,
  },
  horizontal_push: {
    secondary: ["triceps", "shoulders"],
    steps: ["Set your shoulder blades back and down.", "Lower the weight to mid-chest with elbows about 45° from your body.", "Pause lightly without bouncing.", "Press up and slightly back until arms are straight."],
    cues: ["Shoulder blades pinned", "Elbows 45°, not flared", "Wrists stacked over elbows", "Feet planted"],
    mistakes: ["Flaring elbows to 90°", "Bouncing off the chest", "Lifting hips off the bench", "Half reps"],
    image: "/media/woman-lift.jpg",
    compound: true,
  },
  vertical_push: {
    secondary: ["triceps", "traps", "core"],
    steps: ["Start with the weight at shoulder height, forearms vertical.", "Brace your core and squeeze your glutes.", "Press straight up, moving your head back then through.", "Lower under control to the start."],
    cues: ["Ribs down, don't arch", "Bar path straight up", "Head through at the top", "Squeeze glutes"],
    mistakes: ["Leaning back to press", "Pressing forward instead of up", "Elbows flaring wide", "Shrugging early"],
    image: "/media/orange-tank.jpg",
    compound: true,
  },
  horizontal_pull: {
    secondary: ["rear delts", "biceps", "traps"],
    steps: ["Set a stable position with a flat back.", "Start the pull by drawing your shoulder blades back.", "Pull your elbows toward your hips.", "Pause, then lower slowly to a full stretch."],
    cues: ["Lead with the elbows", "Squeeze shoulder blades together", "No torso swing", "Full stretch each rep"],
    mistakes: ["Yanking with momentum", "Shrugging shoulders to ears", "Cutting the stretch short", "Rounding the back"],
    image: "/media/gym-interior.jpg",
    compound: true,
  },
  vertical_pull: {
    secondary: ["biceps", "rear delts", "core"],
    steps: ["Grip slightly wider than shoulders.", "Start by pulling your shoulders down, away from your ears.", "Pull your elbows down toward your ribs.", "Lower all the way to straight arms under control."],
    cues: ["Chest up to the bar", "Elbows down and in", "No kipping", "Full hang at the bottom"],
    mistakes: ["Half reps", "Swinging", "Pulling with the arms only", "Craning the neck"],
    image: "/media/gym-interior.jpg",
    compound: true,
  },
  biceps: {
    secondary: ["forearms"],
    steps: ["Stand tall with elbows by your sides.", "Curl the weight up without moving the elbows forward.", "Squeeze at the top.", "Lower slowly to straight arms."],
    cues: ["Elbows pinned", "No swinging", "Slow on the way down", "Full range"],
    mistakes: ["Using the back to swing", "Elbows drifting forward", "Dropping the weight", "Partial reps"],
    image: "/media/woman-carry.jpg",
    compound: false,
  },
  triceps: {
    secondary: ["shoulders"],
    steps: ["Set your elbows in place.", "Straighten your arms fully.", "Squeeze the triceps at lockout.", "Return slowly to a deep bend."],
    cues: ["Elbows stay still", "Full lockout", "Control the stretch", "Shoulders down"],
    mistakes: ["Elbows flaring", "Leaning into it", "Short range", "Going too heavy to lock out"],
    image: "/media/woman-lift.jpg",
    compound: false,
  },
  shoulders_iso: {
    secondary: ["traps", "rear delts"],
    steps: ["Stand with a slight forward lean and soft elbows.", "Raise the weight out to the side or back, leading with the elbows.", "Stop around shoulder height.", "Lower slowly."],
    cues: ["Light weight, strict form", "Lead with elbows", "Shoulders away from ears", "Pause at the top"],
    mistakes: ["Swinging", "Shrugging", "Going too heavy", "Lifting above shoulder height with pain"],
    image: "/media/orange-tank.jpg",
    compound: false,
  },
  calves: {
    secondary: ["shins"],
    steps: ["Stand on the edge of a step or flat floor.", "Rise onto the balls of your feet as high as you can.", "Pause at the top.", "Lower slowly to a full stretch."],
    cues: ["Full stretch at the bottom", "Pause at the top", "Knees soft but still", "Slow tempo"],
    mistakes: ["Bouncing", "Tiny range of motion", "Rolling onto the outer foot", "Rushing"],
    image: "/media/sprint-start.jpg",
    compound: false,
  },
  core: {
    secondary: ["glutes", "shoulders"],
    steps: ["Set up with a neutral spine.", "Brace like you're about to be poked in the stomach.", "Hold or move slowly while keeping the brace.", "Breathe behind the brace; stop when form slips."],
    cues: ["Ribs down", "Lower back stays neutral", "Slow and controlled", "Quality over time"],
    mistakes: ["Arching the lower back", "Holding your breath", "Hips sagging", "Rushing the reps"],
    image: "/media/floor-mobility.jpg",
    compound: false,
  },
  other: {
    secondary: [],
    steps: ["Set up in a stable position.", "Move through the full range you control.", "Keep a steady tempo.", "Stop the set when form breaks."],
    cues: ["Control every rep", "Full range", "Breathe steadily"],
    mistakes: ["Using momentum", "Partial reps", "Going too heavy too soon"],
    image: "/media/gym-interior.jpg",
    compound: false,
  },
};

type Override = Partial<Pick<Guide, "steps" | "cues" | "mistakes" | "secondary">> & { restSec?: number };

/**
 * Exercises whose pattern in workouts.json is only a slot for plan building (e.g. glute bridge
 * fills a "squat" slot for bad knees), so the pattern's how-to text would be wrong for them.
 */
const OVERRIDES: Record<string, Override> = {
  "Glute bridge": {
    steps: ["Lie on your back, knees bent, feet flat and hip-width apart.", "Brace your core and press through your heels.", "Lift your hips until shoulders, hips and knees line up.", "Squeeze your glutes for a second, then lower slowly."],
    cues: ["Drive through the heels", "Ribs down, don't arch", "Squeeze at the top", "Knees stay hip-width"],
    mistakes: ["Arching the lower back at the top", "Pushing through the toes", "Rushing the reps", "Knees falling in"],
    restSec: 60,
  },
  "Single-leg glute bridge": {
    steps: ["Lie on your back with one foot flat and the other leg straight or held up.", "Press through the planted heel and lift your hips.", "Keep your hips level at the top.", "Lower slowly; do all reps, then switch sides."],
    cues: ["Hips stay level", "Drive through the heel", "Squeeze the working glute"],
    mistakes: ["Hips twisting", "Arching the back", "Using the free leg to swing"],
    restSec: 60,
  },
  "Hip thrust": {
    steps: ["Sit with your upper back against a bench, weight across your hips.", "Feet flat, shins vertical at the top.", "Drive your hips up until your body is flat from shoulders to knees.", "Pause, then lower under control."],
    cues: ["Chin tucked, eyes forward", "Shins vertical at the top", "Squeeze glutes, don't arch"],
    mistakes: ["Hyperextending the lower back", "Feet too far forward or back", "Half reps"],
  },
  "Bird dog": {
    steps: ["Start on hands and knees, hands under shoulders, knees under hips.", "Brace your core.", "Reach one arm forward and the opposite leg back until both are level with your body.", "Hold for a breath, return, and switch sides."],
    cues: ["Hips stay square to the floor", "Move slowly", "Long through fingertips and heel"],
    mistakes: ["Rotating the hips", "Arching the back", "Rushing side to side"],
    restSec: 45,
  },
  "Bodyweight good morning": {
    steps: ["Stand tall, hands behind your head, knees soft.", "Push your hips back and tip your chest forward with a flat back.", "Go until you feel the hamstrings stretch.", "Squeeze your glutes to stand up."],
    restSec: 60,
  },
  "Side-lying leg raise": {
    steps: ["Lie on your side with legs straight and stacked.", "Lift the top leg slowly, toes pointing forward.", "Stop around hip height.", "Lower under control; finish the set, then switch sides."],
    cues: ["Toes point forward, not up", "Body stays in a straight line", "Slow on the way down"],
    mistakes: ["Rolling backwards", "Swinging the leg", "Lifting too high with the hip hitched"],
    secondary: ["core"],
    restSec: 45,
  },
  "Fist wall press": {
    steps: ["Stand an arm's length from a wall and place your fists on it at chest height.", "Lean in, bending your elbows, keeping your body straight.", "Press back to straight arms.", "Keep wrists straight the whole time."],
    restSec: 60,
  },
  "Isometric chest squeeze": {
    steps: ["Stand or sit tall and press your palms together in front of your chest.", "Squeeze as hard as you can without pain.", "Hold for the set time, breathing steadily.", "Relax and repeat."],
    cues: ["Elbows slightly below shoulders", "Breathe, don't hold your breath", "Shoulders down"],
    mistakes: ["Holding your breath", "Shrugging", "Squeezing so hard it hurts"],
    restSec: 45,
  },
  "Pike hold": {
    steps: ["Start in a push-up position and walk your feet in so your hips go high.", "Push the floor away so your shoulders are by your ears.", "Hold with straight arms and a long back.", "Lower your knees to rest."],
    restSec: 60,
  },
  "Wall slide": {
    steps: ["Stand with your back, head and arms against a wall, elbows bent like a goalpost.", "Slide your arms up the wall as far as you can keep contact.", "Slide back down, squeezing shoulder blades together.", "Move slowly."],
    cues: ["Lower back stays near the wall", "Wrists and elbows touch the wall", "Slow and controlled"],
    mistakes: ["Arching off the wall", "Shrugging", "Going past the range you control"],
    restSec: 45,
  },
  "Scapular squeeze": {
    steps: ["Sit or stand tall with arms by your sides.", "Pull your shoulder blades back and down as if pinching a pencil.", "Hold for 2–3 seconds.", "Relax fully and repeat."],
    cues: ["Back and down, not up", "Neck relaxed", "Hold the squeeze"],
    mistakes: ["Shrugging", "Arching the lower back", "Rushing"],
    restSec: 45,
  },
};

const youtube = (name: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} proper form`)}`;

function fromLibrary(e: LibraryExercise & { image?: string; youtubeId?: string }): ExerciseInfo {
  const g = { ...(GUIDES[e.pattern] ?? GUIDES.other), ...OVERRIDES[e.name] };
  const restSec = OVERRIDES[e.name]?.restSec ?? (g.compound ? 90 : 60);
  const muscle = classifyMuscle(e.name);
  return {
    slug: exerciseSlug(e.name),
    name: e.name,
    pattern: e.pattern,
    muscle,
    secondary: g.secondary.filter((m) => m !== muscle),
    equipment: e.equipment,
    stresses: e.stresses,
    level: e.level,
    unit: e.unit,
    steps: g.steps,
    cues: g.cues,
    mistakes: g.mistakes,
    restSec,
    image: e.image ?? g.image,
    youtubeUrl: e.youtubeId ? `https://www.youtube.com/watch?v=${e.youtubeId}` : youtube(e.name),
    builtIn: true,
  };
}

/** Patterns that count as compound (longer default rest). */
export const isCompound = (pattern: string) => (GUIDES[pattern as Pattern] ?? GUIDES.other).compound;

const BUILT_IN: ExerciseInfo[] = LIBRARY.exercises.map(fromLibrary);
const BY_SLUG = new Map(BUILT_IN.map((e) => [e.slug, e]));

function custom(name: string, muscle?: MuscleGroup): ExerciseInfo {
  const g = GUIDES.other;
  return {
    slug: exerciseSlug(name),
    name,
    pattern: "other",
    muscle: muscle ?? classifyMuscle(name),
    secondary: [],
    equipment: [],
    stresses: [],
    level: null,
    unit: "reps",
    steps: g.steps,
    cues: g.cues,
    mistakes: g.mistakes,
    restSec: /squat|deadlift|press|row|pull-?up|lunge/i.test(name) ? 90 : 60,
    image: g.image,
    youtubeUrl: youtube(name),
    builtIn: false,
  };
}

/** Library + the user's own exercises, each marked with inPlan and lastDone. */
export function exerciseList(plan: WorkoutPlan | null, sessions: WorkoutSession[]): ExerciseInfo[] {
  const planNames = new Set((plan?.days ?? []).flatMap((d) => d.exercises.map((e) => exerciseSlug(e.name))));
  const lastDone = new Map<string, string>();
  for (const s of sessions)
    for (const e of s.exercises)
      if (e.sets.some((x) => x.done)) {
        const k = exerciseSlug(e.name);
        if ((lastDone.get(k) ?? "") < s.date) lastDone.set(k, s.date);
      }
  const extra = new Map<string, ExerciseInfo>();
  const addCustom = (name: string, muscle?: MuscleGroup) => {
    const slug = exerciseSlug(name);
    if (slug && !BY_SLUG.has(slug) && !extra.has(slug)) extra.set(slug, custom(name, muscle));
  };
  for (const d of plan?.days ?? []) for (const e of d.exercises) addCustom(e.name, e.muscle);
  for (const s of sessions) for (const e of s.exercises) addCustom(e.name, e.muscle);

  return [...BUILT_IN, ...extra.values()].map((e) => ({ ...e, inPlan: planNames.has(e.slug), lastDone: lastDone.get(e.slug) ?? null }));
}

export function findExercise(slugOrName: string, plan: WorkoutPlan | null, sessions: WorkoutSession[]): ExerciseInfo | null {
  const slug = exerciseSlug(slugOrName);
  return exerciseList(plan, sessions).find((e) => e.slug === slug) ?? null;
}

/** Same-pattern alternatives that fit the user's equipment and avoid their injuries. */
export function alternativesFor(e: ExerciseInfo, opts: { equipment?: string | null; injuries?: Injury[] }): ExerciseInfo[] {
  const pattern = e.pattern === "other" ? null : e.pattern;
  return BUILT_IN.filter(
    (x) =>
      x.slug !== e.slug &&
      (pattern ? x.pattern === pattern : x.muscle === e.muscle) &&
      (!opts.equipment || x.equipment.includes(opts.equipment as never)) &&
      !(opts.injuries ?? []).some((i) => x.stresses.includes(i)),
  ).slice(0, 6);
}

/** Rest seconds for an exercise: user's override, then their default for compound/isolation. */
export function restFor(name: string, profile: { restOverrides?: Record<string, number>; restDefaults?: { compound: number; isolation: number } }) {
  const o = profile.restOverrides?.[name.toLowerCase()];
  if (o) return o;
  const info = BY_SLUG.get(exerciseSlug(name)) ?? custom(name);
  const d = profile.restDefaults ?? { compound: 90, isolation: 60 };
  return info.restSec >= 90 ? d.compound : d.isolation;
}
