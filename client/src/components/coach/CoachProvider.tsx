"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { ChatMessage, PageContext } from "@/lib/domain";
import { api, streamChat } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";

/** A question asked without an AI key: the prompt to paste into Claude instead of a reply. */
export interface PendingPrompt {
  id: string;
  question: string;
  text: string;
}

interface CoachState {
  messages: ChatMessage[];
  /** null = not streaming; "" = waiting for the first token */
  streaming: string | null;
  error: string | null;
  aiConnected: boolean | null;
  prompts: PendingPrompt[];
  page: PageContext | null;
  open: boolean;
  unread: boolean;
  setOpen: (o: boolean) => void;
  setPage: (p: PageContext | null) => void;
  send: (text: string) => Promise<void>;
  clear: () => Promise<void>;
}

const Ctx = createContext<CoachState | null>(null);

export const useCoach = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCoach must be used inside CoachProvider");
  return c;
};

/** Pages call this to tell the coach what the user is looking at. */
export function useCoachContext(page: string, detail?: string) {
  const c = useContext(Ctx);
  const setPage = c?.setPage;
  useEffect(() => {
    setPage?.({ page, detail });
    return () => setPage?.(null);
  }, [setPage, page, detail]);
}

/**
 * One coach conversation for the whole signed-in app. The dock and the /chat page both read it,
 * so they never drift apart. The dock closes on navigation; the thread stays the same.
 */
export function CoachProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  // AuthProvider only renders the app once the user is signed in (and verified, when that's required).
  const ready = !!user;
  const path = usePathname();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiConnected, setAiConnected] = useState<boolean | null>(null);
  const [prompts, setPrompts] = useState<PendingPrompt[]>([]);
  const [page, setPage] = useState<PageContext | null>(null);
  const [open, setOpenState] = useState(false);
  const [unread, setUnread] = useState(false);
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    if (!ready) {
      setMessages([]);
      setPrompts([]);
      return;
    }
    api.chat().then(setMessages).catch(() => {});
    api.status().then((s) => setAiConnected(s.aiConnected)).catch(() => setAiConnected(false));
  }, [ready, user?.id]);

  // Re-check the key when the user may have just added one (profile page).
  useEffect(() => {
    if (ready && path.startsWith("/profile")) api.status().then((s) => setAiConnected(s.aiConnected)).catch(() => {});
  }, [ready, path]);

  // Closed on every page change; the conversation carries on.
  useEffect(() => setOpenState(false), [path]);

  const setOpen = useCallback((o: boolean) => {
    setOpenState(o);
    if (o) setUnread(false);
  }, []);

  const send = useCallback(
    async (text: string) => {
      const msg = text.trim();
      if (!msg || streaming !== null) return;
      setError(null);
      if (!aiConnected) {
        try {
          const { text: prompt } = await api.coachPrompt({ kind: "chat", message: msg, page: page ?? undefined });
          setPrompts((p) => [...p, { id: "p-" + Date.now(), question: msg, text: prompt }]);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not build the prompt");
        }
        return;
      }
      setMessages((m) => [...m, { id: "tmp-" + Date.now(), role: "user", content: msg, createdAt: new Date().toISOString() }]);
      setStreaming("");
      try {
        const final = await streamChat(msg, (t) => setStreaming((s) => (s ?? "") + t), page ?? undefined);
        setMessages((m) => [...m, final]);
        if (!openRef.current) setUnread(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Chat failed");
      } finally {
        setStreaming(null);
      }
    },
    [streaming, aiConnected, page],
  );

  const clear = useCallback(async () => {
    await api.clearChat();
    setMessages([]);
    setPrompts([]);
  }, []);

  return (
    <Ctx.Provider value={{ messages, streaming, error, aiConnected, prompts, page, open, unread, setOpen, setPage, send, clear }}>
      {children}
    </Ctx.Provider>
  );
}
