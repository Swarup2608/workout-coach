import { PHOTOS } from "./photos";

/* ---------------------------------------------------------------------------
   One article per training discipline. Used by the landing gallery cards,
   the /disciplines index and each /disciplines/[slug] article page.
   --------------------------------------------------------------------------- */

export type Discipline = {
  slug: string;
  tag: string;
  title: string;
  /** One line on the gallery card. */
  note: string;
  img: string;
  /** CSS object-position for the hero crop (photos are cropped to a wide band). Default "center 45%". */
  focus?: string;
  /** Article intro (index card + article lead). */
  excerpt: string;
  readMins: number;
  body: { heading: string; paragraphs: string[] }[];
  /** "How StarkFitIQ tracks it" checklist. */
  tracks: string[];
};

export const DISCIPLINES: Discipline[] = [
  {
    slug: "strength",
    tag: "STRENGTH",
    title: "Heavy days, dialled in",
    note: "Overload tracked set by set",
    img: PHOTOS.barbellFloor,
    excerpt: "Getting stronger comes down to one habit: doing a little more than last time, and knowing exactly what last time was.",
    readMins: 4,
    body: [
      {
        heading: "Progressive overload, without the spreadsheet",
        paragraphs: [
          "Strength is built by asking your body for slightly more over time — more load, more reps, or better quality at the same weight. The hard part isn't the idea, it's remembering what you lifted three sessions ago.",
          "When you open a training day in StarkFitIQ, your planned lifts are already there. Each set shows last week's numbers next to it, so the decision to add 2.5 kg is made on evidence, not memory.",
        ],
      },
      {
        heading: "Plan heavy days around recovery",
        paragraphs: [
          "Two heavy lower days back to back will bury most lifters. Write your week in the plan editor with heavy, light and rest days where they make sense for you, and the weekly score checks whether you actually trained the way you planned.",
          "If your sleep dips or a session runs short, the AI coach can suggest keeping the next heavy day lighter instead of forcing it.",
        ],
      },
    ],
    tracks: ["Reps, load and RPE for every set", "Last week's numbers beside each lift", "Overload trend in your weekly score", "Lift progress in History"],
  },
  {
    slug: "technique",
    tag: "TECHNIQUE",
    title: "Reps in the right range",
    note: "Rep-range quality scored weekly",
    img: PHOTOS.womanLift,
    excerpt: "A set of eight that should have been five isn't extra credit. Staying in the right rep range is how good training stays good.",
    readMins: 3,
    body: [
      {
        heading: "Why rep ranges matter",
        paragraphs: [
          "Every exercise in your plan has a target range for a reason: heavy compounds in lower ranges for strength, accessories in higher ranges for volume. Drifting out of range — too many easy reps or too few grinding ones — quietly changes what the session trains.",
          "StarkFitIQ compares the reps you log against the range you planned, and rolls that into rep-range quality in your weekly score.",
        ],
      },
      {
        heading: "Top of the range means it's time",
        paragraphs: [
          "Once you hit the top of the range with good form across your sets, that's the cue to add load. The weekly review flags those lifts so you don't leave progress on the table.",
          "Use RPE and notes on each set to record how it felt. The coach reads those too, so a grinding top-of-range set isn't treated the same as an easy one.",
        ],
      },
    ],
    tracks: ["Target rep range per exercise", "Rep-range quality in the weekly score", "RPE and notes per set", "Lifts flagged for more load"],
  },
  {
    slug: "cardio",
    tag: "CARDIO",
    title: "Every session counts",
    note: "Cardio logged with calorie estimates",
    img: PHOTOS.sprintStart,
    excerpt: "Runs, rides and intervals belong in the same week as your lifting — planned, logged and scored together.",
    readMins: 3,
    body: [
      {
        heading: "One week, not two separate plans",
        paragraphs: [
          "Most people track lifting in one place and cardio somewhere else, then wonder why their legs are wrecked on squat day. Put both in the same weekly plan and you can see the whole load at once.",
          "Add cardio to any day — a zone 2 ride, a track session, an incline walk — and log duration and distance alongside your sets.",
        ],
      },
      {
        heading: "Burn estimated for you",
        paragraphs: [
          "StarkFitIQ estimates the calories each cardio session burns from what you log and your profile, and adds it to your daily stats. That makes the food side of the picture far easier to read.",
          "Prefer to type it? Quick Add understands \"30 min bike\" or \"5 km easy run\" and turns it into a saved entry.",
        ],
      },
    ],
    tracks: ["Cardio sessions in your weekly plan", "Duration and distance logging", "Estimated calorie burn", "Quick Add from plain words"],
  },
  {
    slug: "mobility",
    tag: "MOBILITY",
    title: "Move without limits",
    note: "Mobility days built into your plan",
    img: PHOTOS.floorMobility,
    focus: "center 64%",
    excerpt: "Mobility work is the session everyone skips. Putting it in the plan — and in the score — is how it actually happens.",
    readMins: 3,
    body: [
      {
        heading: "Make it a real training day",
        paragraphs: [
          "Hip and shoulder mobility, stability work and stretching pay off in every other session, but they rarely feel urgent. Writing them into your weekly plan gives them the same status as a heavy day.",
          "Log a mobility flow the same way you log sets, and it counts toward adherence in your weekly score.",
        ],
      },
      {
        heading: "Recovery feeds the score",
        paragraphs: [
          "Sleep, steps and rest days are part of your daily stats. The weekly score includes recovery, so a week with good mobility and sleep reads differently from one where you trained hard on four hours a night.",
          "The AI coach uses that context to suggest when to ease off and when you're ready to push.",
        ],
      },
    ],
    tracks: ["Mobility days in the plan editor", "Adherence counted in the weekly score", "Sleep and steps in daily stats", "Recovery-aware coaching"],
  },
  {
    slug: "sport",
    tag: "SPORT",
    title: "Train for your game",
    note: "Write the plan your sport needs",
    img: PHOTOS.courtDark,
    excerpt: "Your sport sets the schedule. Your gym work should fit around it, not fight it.",
    readMins: 3,
    body: [
      {
        heading: "Plan around practice and match days",
        paragraphs: [
          "Basketball, football, climbing, tennis — every sport has its own rhythm of practice, games and recovery. StarkFitIQ doesn't force a template on you: write the week your sport needs in the plan editor.",
          "Put heavy lifting away from game day, add conditioning where it helps, and keep a light day before competition.",
        ],
      },
      {
        heading: "A coach that knows your context",
        paragraphs: [
          "Tell the AI coach about your sport in your profile. It sees your plan, recent logs and scores, so you can ask things like \"I have a match Saturday — what should Thursday look like?\" and get an answer that fits your week.",
          "It uses your own AI key — Claude, OpenAI, Gemini or another provider — so you stay in control of cost and data.",
        ],
      },
    ],
    tracks: ["Fully custom weekly plans", "Sport and goals in your profile", "Coach chat with your plan and logs", "Bring your own AI key"],
  },
  {
    slug: "consistency",
    tag: "CONSISTENCY",
    title: "Show up. It handles the rest.",
    note: "Plans that fit your week",
    img: PHOTOS.womanCarry,
    excerpt: "The best programme is the one you actually follow. StarkFitIQ is built to make showing up the easy part.",
    readMins: 3,
    body: [
      {
        heading: "One number for the week",
        paragraphs: [
          "Adherence, rep-range quality, overload, muscle balance and recovery roll into a single weekly score. It's counted only up to today, so planned workouts later in the week never show as missed.",
          "Seeing the number move is a surprisingly strong reason to log the session you were about to skip.",
        ],
      },
      {
        heading: "Fewer decisions, more training",
        paragraphs: [
          "Your plan is waiting when you open the day. Logging takes seconds, and Quick Add handles whole days from a sentence. At the end of the week, the AI review tells you what to change next — so you never start Monday wondering what to do.",
        ],
      },
    ],
    tracks: ["Weekly score counted up to today", "Planned workouts ready each day", "Quick Add for fast logging", "AI weekly review and next steps"],
  },
];

export const getDiscipline = (slug: string) => DISCIPLINES.find((d) => d.slug === slug);
