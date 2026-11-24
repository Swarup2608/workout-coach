import type {
  AiProviderId,
  AiSettings,
  ApiStatus,
  AppliedAction,
  CoachAction,
  ExerciseInfo,
  PageContext,
  ProgressData,
  TodayData,
  WorkoutSummary,
  AuthResponse,
  ChatMessage,
  Checkin,
  ConstraintFlag,
  DayMealPlan,
  Diet,
  FoodItem,
  GeneratedPlan,
  Meal,
  MealSuggestions,
  NutritionDay,
  NutritionWeekDay,
  PhotoResult,
  RecentFood,
  ReshuffleSuggestion,
  WeekMove,
  Equipment,
  ExperienceLevel,
  Profile,
  PlannedExercise,
  RepUnit,
  ScoreReport,
  WeekMetrics,
  Weekday,
  WorkoutPlan,
  WorkoutSession,
} from "@/lib/domain";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

// ── Auth plumbing ────────────────────────────────────────────
// Tokens live in httpOnly cookies the browser sends automatically (JS can't read them).
// The CSRF token is kept in memory only and echoed in a header on every write.
let csrfToken: string | null = null;
export const setCsrf = (t: string | null) => (csrfToken = t);

/** Fired when the session can't be refreshed; AuthProvider sends the user to /login. */
export const AUTH_LOST = "starkfitiq:auth-lost";

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

let refreshing: Promise<boolean> | null = null;

/** One refresh at a time, shared by every request that hit an expired token. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= fetch(API_URL + "/auth/refresh", { method: "POST", credentials: "include", cache: "no-store" })
    .then(async (r) => {
      if (!r.ok) return false;
      const body = (await r.json()) as AuthResponse;
      setCsrf(body.csrfToken);
      return true;
    })
    .catch(() => false)
    .finally(() => setTimeout(() => (refreshing = null), 0));
  return refreshing;
}

const SAFE = new Set(["GET", "HEAD"]);
/** Public auth endpoints: a 401 here is an answer, not an expired session. */
const NO_REFRESH = ["/auth/login", "/auth/register", "/auth/verify-email", "/auth/forgot-password", "/auth/reset-password"];

/** fetch with cookies + CSRF header; on an expired access token, refreshes once and retries. */
export async function authFetch(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = { ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}), ...((init.headers as Record<string, string>) ?? {}) };
  if (!SAFE.has(method) && csrfToken) headers["X-CSRF-Token"] = csrfToken;
  const res = await fetch(API_URL + path, { ...init, method, headers, credentials: "include", cache: "no-store" });
  if (res.status === 401 && retry && !NO_REFRESH.some((p) => path.startsWith(p))) {
    if (await refreshSession()) return authFetch(path, init, false);
    if (typeof window !== "undefined") window.dispatchEvent(new Event(AUTH_LOST));
  }
  // CSRF token missing (e.g. after a reload before /me ran): refresh issues a new one, then retry.
  if (res.status === 403 && retry) {
    const body = await res.clone().json().catch(() => ({}));
    if (body.code === "CSRF" && (await refreshSession())) return authFetch(path, init, false);
  }
  return res;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(path, init);
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? `Request failed (${res.status})`, res.status, body.code);
  return body as T;
}

const json = (method: string, data?: unknown): RequestInit => ({ method, body: data === undefined ? undefined : JSON.stringify(data) });

/** Food and water are left out: they live in the food log (/nutrition) and the server keeps what's stored. */
export type SessionInput = Omit<WorkoutSession, "id" | "planId" | "day" | "createdAt" | "updatedAt" | "exercises" | "kcalApp" | "kcalClaude" | "food" | "waterL"> & {
  exercises: {
    plannedId: string | null;
    name: string;
    unit: RepUnit;
    equipment: Equipment;
    perSide: boolean;
    notes: string;
    sets: WorkoutSession["exercises"][number]["sets"];
  }[];
};

export interface DeviceSession {
  id: string;
  userAgent: string;
  ip: string;
  lastActiveAt: string;
  expiresAt: string;
  current: boolean;
}

/** Onboarding answers the server accepts (each optional; validated per field). */
export type OnboardingAnswers = Partial<
  Pick<Profile, "age" | "sex" | "heightCm" | "startBodyweightKg" | "targetBodyweightKg" | "units" | "goalKey" | "daysPerWeek" | "sessionMinutes" | "equipmentSetup" | "injuries" | "diet">
> & { experience?: ExperienceLevel };

export type OnboardingRequest = { step: number; answers: OnboardingAnswers } | { complete: true } | { skip: true } | { restart: true };

export const authApi = {
  register: (name: string, email: string, password: string, age: number) => req<AuthResponse>("/auth/register", json("POST", { name, email, password, age })),
  login: (email: string, password: string) => req<AuthResponse>("/auth/login", json("POST", { email, password })),
  me: () => req<AuthResponse>("/auth/me"),
  updateMe: (name: string) => req<AuthResponse>("/auth/me", json("PATCH", { name })),
  logout: () => req<void>("/auth/logout", json("POST")),
  logoutAll: () => req<void>("/auth/logout-all", json("POST")),
  changePassword: (currentPassword: string, newPassword: string) => req<AuthResponse>("/auth/change-password", json("POST", { currentPassword, newPassword })),
  sessions: () => req<DeviceSession[]>("/auth/sessions"),
  revokeSession: (id: string) => req<void>(`/auth/sessions/${encodeURIComponent(id)}`, json("DELETE")),
  deleteAccount: (password: string) => req<void>("/auth/me", json("DELETE", { password })),
  verifyEmail: (token: string) => req<{ ok: true }>("/auth/verify-email", json("POST", { token })),
  resendVerification: () => req<{ ok: true; alreadyVerified?: boolean }>("/auth/resend-verification", json("POST")),
  forgotPassword: (email: string) => req<{ ok: true; message: string }>("/auth/forgot-password", json("POST", { email })),
  resetPassword: (token: string, newPassword: string) => req<{ ok: true }>("/auth/reset-password", json("POST", { token, newPassword })),
};

export const settingsApi = {
  ai: () => req<AiSettings>("/settings/ai"),
  saveAi: (body: { provider: AiProviderId; model: string; baseUrl?: string; apiKey?: string }) => req<AiSettings>("/settings/ai", json("PUT", body)),
  testAi: () => req<{ ok: boolean; label: string; reply: string }>("/settings/ai/test", json("POST")),
  removeAi: () => req<void>("/settings/ai", json("DELETE")),
};

export const api = {
  status: () => req<ApiStatus>("/status"),
  profile: () => req<Profile>("/profile"),
  saveProfile: (p: Profile) => req<Profile>("/profile", json("PUT", p)),
  onboarding: (body: OnboardingRequest) => req<{ profile: Profile; plan?: WorkoutPlan }>("/profile/onboarding", json("PATCH", body)),
  checkin: (date: string) => req<Checkin | null>(`/checkins/${date}`),
  saveCheckin: (date: string, body: Partial<Pick<Checkin, "weightKg" | "mood" | "sleep" | "soreness" | "energy" | "stress">>) =>
    req<Checkin>(`/checkins/${date}`, json("PUT", body)),
  checkins: (from: string, to: string) => req<Checkin[]>(`/checkins?from=${from}&to=${to}`),

  today: (date: string) => req<TodayData>(`/today?date=${date}`),
  reshuffle: (date: string) => req<ReshuffleSuggestion>(`/reshuffle?date=${date}`),
  /** Replaces this week's moves; an empty list clears them. */
  applyReshuffle: (date: string, moves: WeekMove[]) => req<ReshuffleSuggestion>("/reshuffle", json("PUT", { date, moves })),
  progress: (range: number, date: string) => req<ProgressData>(`/progress?range=${range}&date=${date}`),
  exercises: () => req<ExerciseInfo[]>("/exercises"),
  exercise: (slug: string) =>
    req<{
      exercise: ExerciseInfo;
      history: { date: string; sets: WorkoutSession["exercises"][number]["sets"]; unit: RepUnit }[];
      series: { date: string; e1rm: number; best: string }[];
      alternatives: ExerciseInfo[];
      injuryWarning: string[];
      restSec: number;
    }>(`/exercises/${encodeURIComponent(slug)}`),

  // ── Live workout ──
  liveSession: () => req<{ session: WorkoutSession | null; stale: boolean; lastActivityAt: string | null }>("/sessions/live"),
  startWorkout: (date: string, planDay: Weekday | "custom", title?: string) =>
    req<{ session: WorkoutSession; resumed: boolean }>("/sessions/start", json("POST", { date, planDay, title })),
  patchSession: (id: string, body: Partial<Pick<WorkoutSession, "title" | "notes" | "restEndsAt" | "sessionRpe" | "durationMin">> & { exercises?: SessionInput["exercises"] }) =>
    req<WorkoutSession>(`/sessions/${id}`, json("PATCH", body)),
  pauseWorkout: (id: string) => req<WorkoutSession>(`/sessions/${id}/pause`, json("POST")),
  resumeWorkout: (id: string) => req<WorkoutSession>(`/sessions/${id}/resume`, json("POST")),
  finishWorkout: (id: string, endedAt?: string) => req<WorkoutSession>(`/sessions/${id}/finish`, json("POST", endedAt ? { endedAt } : {})),
  discardWorkout: (id: string) => req<void>(`/sessions/${id}/discard`, json("POST")),
  summary: (id: string) => req<WorkoutSummary>(`/sessions/${id}/summary`),
  coachNote: (id: string) =>
    req<{ note: WorkoutSession["coachNote"]; prompt: string | null }>(`/sessions/${id}/coach-note`, json("POST")),

  // ── Coach ──
  coachPrompt: (body: { kind: "chat" | "coach-note"; message?: string; page?: PageContext; sessionId?: string }) =>
    req<{ text: string }>("/coach/prompt", json("POST", body)),
  applyAction: (action: CoachAction, scope: "today" | "plan") => req<AppliedAction>("/coach/actions/apply", json("POST", { action, scope, date: today() })),
  undoAction: (id: string) => req<{ ok: true }>(`/coach/actions/${id}/undo`, json("POST")),

  plans: () => req<WorkoutPlan[]>("/plans"),
  activePlan: () => req<WorkoutPlan | null>("/plans/active"),
  uploadPlan: (name: string, text: string) => req<WorkoutPlan>("/plans", json("POST", { name, text })),
  /** AI plan preview (nothing saved). 409 code "no_ai" without a key, 422 code "setup" before onboarding. */
  generatePlan: (notes: string) => req<GeneratedPlan>("/plans/generate", json("POST", { notes })),
  planPrompt: (notes: string) => req<{ text: string }>("/plans/generate/prompt", json("POST", { notes })),
  /** Checks a plan pasted back from Claude with the generator's rules. */
  checkPlan: (text: string) => req<GeneratedPlan>("/plans/generate/check", json("POST", { text })),
  updatePlanDay: (
    id: string,
    day: Weekday,
    body: { title: string; notes: string[]; exercises: Pick<PlannedExercise, "id" | "name" | "sets" | "repMin" | "repMax">[] },
  ) => req<WorkoutPlan>(`/plans/${id}/days/${day}`, json("PUT", body)),
  activatePlan: (id: string) => req<WorkoutPlan>(`/plans/${id}/activate`, json("POST")),
  deletePlan: (id: string) => req<void>(`/plans/${id}`, json("DELETE")),

  sessions: (q: { week?: string; date?: string } = {}) => req<WorkoutSession[]>(`/sessions?${new URLSearchParams(q as Record<string, string>)}`),
  previous: (before: string) =>
    req<Record<string, { date: string; sets: { weightKg: number | null; reps: number | null; negatives?: number | null; rir?: number | null }[] }>>(`/sessions/previous?before=${before}`),
  saveSession: (s: SessionInput) => req<WorkoutSession>("/sessions", json("PUT", s)),
  dayPrompt: (date: string) => req<{ text: string }>(`/day-import/prompt?date=${date}`),
  importDay: (text: string, date: string) => req<{ session: WorkoutSession; summary: string }>("/day-import", json("POST", { text, date })),
  deleteSession: (id: string) => req<void>(`/sessions/${id}`, json("DELETE")),

  scores: (kind?: "plan" | "week") => req<ScoreReport[]>(`/scores${kind ? `?kind=${kind}` : ""}`),
  weekMetrics: (date: string) => req<{ metrics: WeekMetrics; flags: ConstraintFlag[] }>(`/metrics/week?date=${date}`),
  scorePlan: () => req<ScoreReport>("/scores/plan", json("POST", {})),
  scoreWeek: (date: string) => req<ScoreReport>("/scores/week", json("POST", { date })),

  handoff: (kind: "week" | "plan" | "context", date?: string) =>
    req<{ filename: string; markdown: string }>(`/handoff/${kind}${date ? `?date=${date}` : ""}`),
  importReply: (kind: "week" | "plan", text: string, date?: string) =>
    req<ScoreReport>(`/scores/import${date ? `?date=${date}` : ""}`, json("POST", { kind, text })),

  chat: () => req<ChatMessage[]>("/chat"),
  clearChat: () => req<void>("/chat", json("DELETE")),

  // ── Nutrition ──
  nutritionDay: (date: string) => req<NutritionDay>(`/nutrition/day/${date}`),
  nutritionWeek: (date: string) => req<{ days: NutritionWeekDay[] }>(`/nutrition/week?date=${date}`),
  addFood: (
    date: string,
    body:
      | { meal: Meal; foodId: string; servings: number }
      | { meal: Meal; name: string; kcal: number; proteinG?: number; carbsG?: number; fatG?: number; servings?: number; serving?: string; source?: "quick" | "photo" },
  ) => req<NutritionDay>(`/nutrition/day/${date}/entries`, json("POST", body)),
  /** Calories and macros are for one serving; totals follow servings. */
  updateFood: (date: string, id: string, body: { servings?: number; meal?: Meal; name?: string; kcal?: number; proteinG?: number; carbsG?: number; fatG?: number }) =>
    req<NutritionDay>(`/nutrition/day/${date}/entries/${id}`, json("PATCH", body)),
  /** Ideas for the next meal from what's left today (rule-based). */
  suggestMeal: (date: string, meal: Meal, seed = 0) => req<MealSuggestions>(`/nutrition/suggest?${new URLSearchParams({ date, meal, seed: String(seed) })}`),
  mealPlan: (date: string, seed = 0) => req<DayMealPlan>(`/nutrition/plan?date=${date}&seed=${seed}`),
  /** Adds several database foods to one meal at once. */
  addMeal: (date: string, meal: Meal, items: { foodId: string; servings: number }[]) => req<NutritionDay>(`/nutrition/day/${date}/entries/bulk`, json("POST", { meal, items })),
  /** `image` is a data: URL (JPEG/PNG/WebP). Nothing is saved; returns a draft. */
  foodPhoto: (image: string) => req<PhotoResult>("/nutrition/photo", json("POST", { image })),
  removeFood: (date: string, id: string) => req<NutritionDay>(`/nutrition/day/${date}/entries/${id}`, json("DELETE")),
  setWater: (date: string, waterMl: number) => req<NutritionDay>(`/nutrition/day/${date}/water`, json("PUT", { waterMl })),
  searchFoods: (q: string, all = false) => req<{ foods: FoodItem[]; diet: Diet | null }>(`/nutrition/foods?${new URLSearchParams({ q, ...(all ? { all: "1" } : {}) })}`),
  foodLibrary: (date: string) => req<{ recent: RecentFood[]; favourites: FoodItem[]; custom: FoodItem[] }>(`/nutrition/library?date=${date}`),
  favourite: (foodId: string, on: boolean) => req<{ favourites: string[] }>(`/nutrition/favourites/${encodeURIComponent(foodId)}`, json(on ? "PUT" : "DELETE")),
  createFood: (body: { name: string; serving?: string; grams?: number; kcal: number; proteinG?: number; carbsG?: number; fatG?: number }) =>
    req<FoodItem>("/nutrition/custom-foods", json("POST", body)),
  deleteFood: (id: string) => req<void>(`/nutrition/custom-foods/${encodeURIComponent(id)}`, json("DELETE")),
};

/** Streams a chat reply from the SSE endpoint. */
export async function streamChat(message: string, onDelta: (text: string) => void, page?: PageContext): Promise<ChatMessage> {
  const res = await authFetch("/chat", { method: "POST", body: JSON.stringify({ message, page }) });
  if (!res.ok || !res.body) throw new Error(`Chat failed (${res.status})`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let final: ChatMessage | null = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const events = buf.split("\n\n");
    buf = events.pop() ?? "";
    for (const ev of events) {
      const type = ev.match(/^event: (.+)$/m)?.[1];
      const data = ev.match(/^data: (.+)$/m)?.[1];
      if (!type || !data) continue;
      const parsed = JSON.parse(data);
      if (type === "delta") onDelta(parsed as string);
      else if (type === "done") final = parsed as ChatMessage;
      else if (type === "error") throw new Error(parsed.error);
    }
  }
  if (!final) throw new Error("Chat stream ended unexpectedly");
  return final;
}

export const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

/** Mirrors the server's constraint keyword check for instant warnings on the log screen. */
export function constraintHit(name: string, profile: Profile | null) {
  if (!profile) return null;
  const n = name.toLowerCase();
  return profile.constraints.find((c) => c.keywords.some((k) => k && n.includes(k.toLowerCase()))) ?? null;
}
