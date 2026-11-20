"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { actionScopes, describeAction, type AppliedAction, type CoachAction } from "@/lib/domain";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui";
import { useCoach } from "./CoachProvider";
import { notifyDataChanged, parseActions } from "./actions";

/** Quick prompts that change with the page the user is on. */
export const QUICK_PROMPTS: Record<string, string[]> = {
  Today: ["What should I focus on today?", "I only have 30 minutes. What should I cut?"],
  "Live workout": ["This felt too heavy. What now?", "Can I swap this exercise for something easier on my joints?"],
  "Workout summary": ["How did this workout go?", "What should I change next time?"],
  "Exercise detail": ["Show me a knee-friendly alternative", "How heavy should I go next time?"],
  "Exercise library": ["Which exercises fit my plan and injuries?"],
  Progress: ["Why has my progress stalled?", "Am I losing weight at a good pace?"],
  "Daily check-in": ["I slept badly. Should I still train?"],
  Plan: ["Swap anything in my plan that conflicts with my injuries.", "Make this week easier, I'm short on time."],
  Profile: ["Are my rest times right for my goal?"],
  default: ["How did my week go?", "What weights should I use next week?"],
};

export function Bubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  return (
    <div className={`flex ${role === "user" ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${role === "user" ? "bg-volt font-medium text-on-accent" : "border border-ink-700 bg-ink-800"}`}>
        {role === "assistant" ? (
          <div className="prose-chat">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        ) : (
          <p className="whitespace-pre-wrap">{content}</p>
        )}
      </div>
    </div>
  );
}

/** One proposed change: nothing happens until the user taps Apply. */
export function ActionCard({ action }: { action: CoachAction }) {
  const router = useRouter();
  const [applied, setApplied] = useState<AppliedAction | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "dismissed" | "undone">("idle");
  const [error, setError] = useState<string | null>(null);

  if (state === "dismissed") return null;

  const run = async (scope: "today" | "plan") => {
    setError(null);
    if (action.type === "start_workout") {
      router.push(`/workout/live?day=${action.day ?? ""}`);
      return;
    }
    setState("busy");
    try {
      setApplied(await api.applyAction(action, scope));
      notifyDataChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not apply");
    } finally {
      setState("idle");
    }
  };

  const undo = async () => {
    if (!applied) return;
    setState("busy");
    try {
      await api.undoAction(applied.id);
      setState("undone");
      notifyDataChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not undo");
      setState("idle");
    }
  };

  const scopes = actionScopes(action);
  return (
    <div className="rounded-xl border border-volt/40 bg-volt/5 p-3 text-sm">
      <p className="font-medium text-fg">{describeAction(action)}</p>
      {action.reason && <p className="mt-0.5 text-xs text-ink-400">{action.reason}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {state === "undone" ? (
          <span className="text-xs text-ink-400">Undone</span>
        ) : applied ? (
          <>
            <span className="text-xs text-good">Applied{applied.scope === "plan" ? " to plan" : " today"} ✓</span>
            <button className="text-xs link" onClick={undo} disabled={state === "busy"}>
              Undo
            </button>
          </>
        ) : (
          <>
            {action.type === "start_workout" ? (
              <button className="btn btn-primary px-3 py-1 text-xs" onClick={() => run("today")}>
                Start
              </button>
            ) : (
              scopes.map((s) => (
                <button key={s} className="btn btn-primary px-3 py-1 text-xs" onClick={() => run(s)} disabled={state === "busy"}>
                  {state === "busy" && <Spinner />} {action.type === "set_rest" || action.type === "add_note" ? "Apply" : s === "today" ? "Apply today" : "Apply to plan"}
                </button>
              ))
            )}
            <button className="btn btn-ghost px-3 py-1 text-xs" onClick={() => setState("dismissed")}>
              Dismiss
            </button>
          </>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-bad">{error}</p>}
    </div>
  );
}

function AssistantMessage({ content }: { content: string }) {
  const { clean, actions } = parseActions(content);
  return (
    <div className="space-y-2">
      {clean && <Bubble role="assistant" content={clean} />}
      {actions.map((a, i) => (
        <div key={i} className="max-w-[88%]">
          <ActionCard action={a} />
        </div>
      ))}
    </div>
  );
}

/**
 * Shown instead of a reply when there's no AI key: copy the prompt into Claude,
 * then optionally paste the reply back to get the same Apply cards.
 */
export function PromptBox({ text, title = "No AI key yet. Ask Claude instead" }: { text: string; title?: string }) {
  const [copied, setCopied] = useState(false);
  const [reply, setReply] = useState("");
  const [showReply, setShowReply] = useState(false);
  const [projectUrl, setProjectUrl] = useState<string | null>(null);

  useEffect(() => {
    api.profile().then((p) => setProjectUrl(p.claudeProjectUrl || null)).catch(() => {});
  }, []);

  const copy = async () => setCopied(await navigator.clipboard.writeText(text).then(() => true, () => false));
  const openClaude = async () => {
    await copy();
    window.open(projectUrl || "https://claude.ai/new", "_blank", "noopener");
  };

  return (
    <div className="rounded-xl border border-warn/40 bg-warn/5 p-3 text-sm">
      <p className="font-medium text-fg">{title}</p>
      <p className="mt-0.5 text-xs text-ink-400">
        Copy this prompt (it includes your plan, logs and scores) and paste it into Claude. Or add a key under{" "}
        <a href="/profile#ai" className="link">Profile → AI coach</a>.
      </p>
      <textarea readOnly className="input mt-2 h-24 w-full resize-none font-mono text-[11px]" value={text} onFocus={(e) => e.currentTarget.select()} />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button className="btn btn-primary px-3 py-1 text-xs" onClick={copy}>
          {copied ? "Copied ✓" : "Copy prompt"}
        </button>
        <button className="btn btn-ghost px-3 py-1 text-xs" onClick={openClaude}>
          Copy & open Claude
        </button>
        <button className="btn btn-ghost px-3 py-1 text-xs" onClick={() => setShowReply((s) => !s)}>
          Paste reply back
        </button>
      </div>
      {showReply && (
        <div className="mt-2 space-y-2">
          <textarea className="input h-24 w-full text-xs" placeholder="Paste Claude's reply here" value={reply} onChange={(e) => setReply(e.target.value)} />
          {reply.trim() && <AssistantMessage content={reply} />}
        </div>
      )}
    </div>
  );
}

/** The conversation: messages, action cards, no-key prompts, and quick prompts when empty. */
export function ChatThread({ compact = false }: { compact?: boolean }) {
  const { messages, streaming, prompts, page, send } = useCoach();
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, streaming, prompts.length]);

  const quick = QUICK_PROMPTS[page?.page ?? ""] ?? QUICK_PROMPTS.default;
  const empty = messages.length === 0 && streaming === null && prompts.length === 0;

  return (
    <div className="space-y-3">
      {empty && (
        <div className={`grid gap-2 ${compact ? "" : "sm:grid-cols-2"}`}>
          {quick.map((q) => (
            <button key={q} className="rounded-xl border border-ink-600 p-3 text-left text-sm hover:border-volt" onClick={() => send(q)}>
              {q}
            </button>
          ))}
        </div>
      )}
      {messages.map((m) =>
        m.role === "assistant" ? <AssistantMessage key={m.id} content={m.content} /> : <Bubble key={m.id} role="user" content={m.content} />,
      )}
      {prompts.map((p) => (
        <div key={p.id} className="space-y-2">
          <Bubble role="user" content={p.question} />
          <PromptBox text={p.text} />
        </div>
      ))}
      {streaming !== null &&
        (parseActions(streaming).clean ? (
          <div aria-live="polite">
            <Bubble role="assistant" content={parseActions(streaming).clean} />
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-ink-400">
            <Spinner /> Coach is thinking…
          </div>
        ))}
      {!empty && !compact && streaming === null && (
        <div className="flex flex-wrap gap-2 pt-1">
          {quick.map((q) => (
            <button key={q} className="rounded-full border border-ink-700 px-3 py-1 text-xs text-ink-400 hover:border-volt hover:text-fg" onClick={() => send(q)}>
              {q}
            </button>
          ))}
        </div>
      )}
      <div ref={bottom} />
    </div>
  );
}

/** Message box shared by the dock and the /chat page. */
export function ChatInput({ autoFocus = false, placeholder = "Ask your coach…" }: { autoFocus?: boolean; placeholder?: string }) {
  const { send, streaming } = useCoach();
  const [input, setInput] = useState("");
  const submit = () => {
    if (!input.trim()) return;
    send(input);
    setInput("");
  };
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <textarea
        autoFocus={autoFocus}
        aria-label="Message your coach"
        className="input h-12 flex-1 resize-none text-sm"
        placeholder={placeholder}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <button className="btn btn-primary px-5" disabled={!input.trim() || streaming !== null}>
        Send
      </button>
    </form>
  );
}
