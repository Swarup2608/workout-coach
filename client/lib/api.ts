import type {
  ApiStatus,
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
} from "@workout/shared";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(API_URL + path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
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
  const res = await fetch(API_URL + "/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
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
