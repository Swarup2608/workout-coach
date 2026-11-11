import type {
  AiProviderId,
  AiSettings,
  ApiStatus,
  AuthResponse,
  ChatMessage,
  ConstraintFlag,
  Equipment,
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

export type SessionInput = Omit<WorkoutSession, "id" | "planId" | "day" | "createdAt" | "updatedAt" | "exercises" | "kcalApp" | "kcalClaude"> & {
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

export const authApi = {
  register: (name: string, email: string, password: string) => req<AuthResponse>("/auth/register", json("POST", { name, email, password })),
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

  plans: () => req<WorkoutPlan[]>("/plans"),
  activePlan: () => req<WorkoutPlan | null>("/plans/active"),
  uploadPlan: (name: string, text: string) => req<WorkoutPlan>("/plans", json("POST", { name, text })),
  updatePlanDay: (
    id: string,
    day: Weekday,
    body: { title: string; notes: string[]; exercises: Pick<PlannedExercise, "id" | "name" | "sets" | "repMin" | "repMax">[] },
  ) => req<WorkoutPlan>(`/plans/${id}/days/${day}`, json("PUT", body)),
  activatePlan: (id: string) => req<WorkoutPlan>(`/plans/${id}/activate`, json("POST")),
  deletePlan: (id: string) => req<void>(`/plans/${id}`, json("DELETE")),

  sessions: (q: { week?: string; date?: string } = {}) => req<WorkoutSession[]>(`/sessions?${new URLSearchParams(q as Record<string, string>)}`),
  previous: (before: string) =>
    req<Record<string, { date: string; sets: { weightKg: number | null; reps: number | null; negatives?: number | null }[] }>>(`/sessions/previous?before=${before}`),
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
};

/** Streams a chat reply from the SSE endpoint. */
export async function streamChat(message: string, onDelta: (text: string) => void): Promise<ChatMessage> {
  const res = await authFetch("/chat", { method: "POST", body: JSON.stringify({ message }) });
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
