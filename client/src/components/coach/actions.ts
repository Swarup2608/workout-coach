import type { CoachAction } from "@/lib/domain";

const TYPES = new Set(["swap_exercise", "change_sets_reps", "move_workout", "set_rest", "start_workout", "add_note"]);
const BLOCK = /```coach-action\s*\n?([\s\S]*?)```/g;

/**
 * Pulls ```coach-action``` blocks out of a coach reply. Returns the text without them and the
 * actions that parse. While a reply is still streaming, an unclosed block is hidden too.
 * The server validates every action again before applying it.
 */
export function parseActions(text: string): { clean: string; actions: CoachAction[] } {
  const actions: CoachAction[] = [];
  let clean = text.replace(BLOCK, (_, body: string) => {
    try {
      const a = JSON.parse(body.trim());
      if (a && typeof a === "object" && TYPES.has(a.type)) actions.push(a as CoachAction);
    } catch {
      // ignore malformed blocks
    }
    return "";
  });
  const open = clean.indexOf("```coach-action");
  if (open >= 0) clean = clean.slice(0, open);
  return { clean: clean.trim(), actions: actions.slice(0, 3) };
}

/** Pages listen for this to reload after a coach action changes their data. */
export const DATA_CHANGED = "starkfitiq:data-changed";
export const notifyDataChanged = () => window.dispatchEvent(new Event(DATA_CHANGED));
