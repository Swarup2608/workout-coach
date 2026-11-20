"use client";

import { ErrorNote } from "@/components/ui";
import { useCoach, useCoachContext } from "@/components/coach/CoachProvider";
import { ChatInput, ChatThread } from "@/components/coach/ChatThread";

/** Full-page view of the same coach conversation the dock shows on every page. */
export default function ChatPage() {
  useCoachContext("Coach chat");
  const { messages, prompts, error, clear, aiConnected } = useCoach();

  return (
    <div className="flex h-[calc(100dvh-14rem)] min-h-[420px] flex-col md:h-[calc(100vh-10rem)]">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-sm text-ink-400">
            Your coach sees your plan, logs, scores and constraints{aiConnected === false ? ". No AI key: you'll get a prompt to paste into Claude" : ""}
          </p>
          <h1 className="t-workout text-fg text-4xl">Coach chat</h1>
        </div>
        {(messages.length > 0 || prompts.length > 0) && (
          <button className="btn btn-ghost" onClick={clear}>
            Clear chat
          </button>
        )}
      </div>

      <div className="card flex-1 overflow-y-auto">
        <ChatThread />
      </div>

      <ErrorNote error={error} />
      <div className="mt-4">
        <ChatInput placeholder="Ask about your plan, weights, recovery…" />
      </div>
    </div>
  );
}
