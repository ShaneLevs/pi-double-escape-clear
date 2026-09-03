/**
 * Double-Escape to Clear Editor + /restore command
 *
 * Features:
 *   - Double-escape (within a configurable window, default 300ms) while the
 *     editor has content → clear editor, saving the text to editor history
 *     so ↑/↓ can still retrieve it.
 *   - Double-escape with empty editor → session tree (native behavior).
 *   - Terminal key auto-repeat (holding ESC) is swallowed, so it can never
 *     be mistaken for a genuine double-tap.
 *   - /restore [keyword] — list recent user messages from the current
 *     session (newest first), optionally filtered by keyword(s), and restore
 *     the picked one into the editor for editing & resubmission.
 *   - /dce-config [ms] — view or set the double-press window (100–1000ms),
 *     persisted to ~/.pi/agent/double-escape-clear/config.json.
 *   - /dce-help — show a quick usage summary.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { CustomEditor, type ExtensionAPI, type SessionMessageEntry } from "@earendil-works/pi-coding-agent";
import { contentText } from "@earendil-works/pi-ai";
import { matchesKey, Key } from "@earendil-works/pi-tui";

/* ── Config (persisted to ~/.pi/agent/double-escape-clear/config.json) ──── */

const CONFIG_DIR = process.env.DCE_CONFIG_DIR ?? join(homedir(), ".pi", "agent", "double-escape-clear");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");
const DEFAULT_WINDOW_MS = 300;
const MIN_WINDOW_MS = 100;
const MAX_WINDOW_MS = 1000;
/** Terminal auto-repeat emits key bytes ~30ms apart while a key is held;
 *  escape presses closer than this are treated as repeats, not double-taps. */
const REPEAT_IGNORE_MS = 50;

const config = { windowMs: DEFAULT_WINDOW_MS };

export { config as extensionConfig, DEFAULT_WINDOW_MS, MIN_WINDOW_MS, MAX_WINDOW_MS, REPEAT_IGNORE_MS };

function clampWindow(n: number): number {
  return Math.min(MAX_WINDOW_MS, Math.max(MIN_WINDOW_MS, Math.round(n)));
}

function loadConfig(): void {
  try {
    const raw = JSON.parse(readFileSync(CONFIG_FILE, "utf8")) as { windowMs?: unknown };
    if (typeof raw.windowMs === "number" && Number.isFinite(raw.windowMs)) {
      config.windowMs = clampWindow(raw.windowMs);
    }
  } catch {
    // Missing or invalid config file: keep defaults.
  }
}

function saveConfig(): void {
  try {
    mkdirSync(CONFIG_DIR, { recursive: true });
    // Write to a temp file then rename for atomicity.
    const tmp = `${CONFIG_FILE}.tmp`;
    writeFileSync(tmp, `${JSON.stringify(config, null, 2)}\n`, "utf8");
    renameSync(tmp, CONFIG_FILE);
  } catch {
    // Best-effort persistence; the extension still works with in-memory defaults.
  }
}

loadConfig();

/* ── Double-escape clear editor ─────────────────────────────────────────── */

export class DoubleEscapeClearEditor extends CustomEditor {
  private lastEscapeTime = 0;
  private pendingEscapeTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingEscapeData: string | null = null;

  handleInput(data: string): void {
    if (matchesKey(data, Key.escape)) {
      const now = Date.now();
      const timeSinceLast = now - this.lastEscapeTime;
      const currentText = this.getText().trim();

      // Terminal auto-repeat sends ESC bytes ~30ms apart while the key is
      // held. Swallow those so holding ESC is never mistaken for a genuine
      // double-tap; lastEscapeTime still advances so repeats can't chain
      // into a fake press once the 50ms window lapses between events.
      if (this.lastEscapeTime !== 0 && timeSinceLast < REPEAT_IGNORE_MS) {
        this.lastEscapeTime = now;
        return;
      }

      // Double-escape while editor has content: save to history, then clear.
      // Neither escape is forwarded to super here: forwarding the first escape
      // triggers pi's native `app.interrupt` binding (Escape = cancel/abort),
      // which terminates a running task before the second escape can arrive.
      if (
        timeSinceLast < config.windowMs &&
        this.lastEscapeTime !== 0 &&
        currentText.length > 0
      ) {
        this.cancelPendingEscape();
        this.lastEscapeTime = 0;
        this.addToHistory(currentText);
        this.setText("");
        return;
      }

      this.lastEscapeTime = now;

      if (currentText.length > 0) {
        // First escape with content: hold it for the double-press window. If a
        // second escape arrives we clear above and never forward; if not, the
        // held escape is forwarded after the window so native behavior (abort
        // a running task, session tree on empty editor, etc.) still works.
        this.holdEscape(data);
      } else {
        // Empty editor: forward immediately so native double-escape
        // (session tree / fork) works untouched.
        super.handleInput(data);
      }
      return;
    }

    // Any other key cancels a pending first-escape hold.
    this.cancelPendingEscape();
    this.lastEscapeTime = 0;
    super.handleInput(data);
  }

  private holdEscape(data: string): void {
    this.cancelPendingEscape();
    this.pendingEscapeData = data;
    this.pendingEscapeTimer = setTimeout(() => {
      this.pendingEscapeTimer = null;
      const escaped = this.pendingEscapeData;
      this.pendingEscapeData = null;
      if (escaped !== null) {
        super.handleInput(escaped);
      }
    }, config.windowMs);
  }

  private cancelPendingEscape(): void {
    if (this.pendingEscapeTimer !== null) {
      clearTimeout(this.pendingEscapeTimer);
      this.pendingEscapeTimer = null;
    }
    this.pendingEscapeData = null;
  }
}

/* ── /restore helpers ───────────────────────────────────────────────────── */

function getUserMessages(entries: SessionMessageEntry[]): Array<{ id: string; text: string }> {
  const results: Array<{ id: string; text: string }> = [];
  for (const entry of entries) {
    const msg = entry.message as { role?: string; content?: unknown };
    if (msg.role !== "user") continue;
    const text = contentText(msg.content as Parameters<typeof contentText>[0], "\n");
    if (!text.trim()) continue;
    results.push({ id: entry.id, text });
  }
  return results;
}

function previewOf(text: string, max = 60): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine;
}

function isSubsequence(needle: string, haystack: string): boolean {
  let i = 0;
  for (const ch of haystack) {
    if (ch === needle[i]) {
      i++;
      if (i === needle.length) return true;
    }
  }
  return needle.length === 0;
}

function matchesQuery(text: string, tokens: string[], fuzzy: boolean): boolean {
  const hay = text.toLowerCase();
  return tokens.every((t) => (fuzzy ? isSubsequence(t, hay) : hay.includes(t)));
}

export { matchesQuery, isSubsequence, previewOf };

/**
 * Build the /restore selection list: newest-first, keyword-filtered,
 * number-prefixed (so duplicate previews can never resolve to the wrong
 * message), capped at `limit` entries.
 */
export function buildRestoreList(
  messages: Array<{ id: string; text: string }>,
  query: string,
  limit = 20,
): { title: string; items: string[]; resolve: (choice: string | undefined) => string | null } {
  // Entries arrive oldest-first; show newest first.
  let pool = [...messages].reverse();

  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length > 0) {
    // Substring match first; fall back to subsequence (fuzzy) matching.
    const substring = pool.filter((m) => matchesQuery(m.text, tokens, false));
    pool = substring.length > 0 ? substring : pool.filter((m) => matchesQuery(m.text, tokens, true));
  }

  const recent = pool.slice(0, limit);
  const items = recent.map((m, i) => `${i + 1}. ${previewOf(m.text)}`);
  return {
    title: tokens.length > 0 ? `Restore (filter: ${query}):` : "Restore a previous message:",
    items,
    resolve: (choice) => {
      if (choice == null) return null;
      const idx = items.indexOf(choice);
      return idx < 0 ? null : recent[idx].text;
    },
  };
}

/* ── Extension entry point ──────────────────────────────────────────────── */

export default function (pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    ctx.ui.setEditorComponent((tui, theme, kb) =>
      new DoubleEscapeClearEditor(tui, theme, kb)
    );
  });

  pi.registerCommand("restore", {
    description: "Restore a previous user message into the editor (optional filter: /restore <keyword>)",
    handler: async (args, ctx) => {
      if (ctx.mode !== "tui") return;

      const allEntries = ctx.sessionManager.getEntries();
      const msgEntries = allEntries.filter(
        (e): e is SessionMessageEntry & { type: "message" } => e.type === "message",
      );

      const messages = getUserMessages(msgEntries);
      if (messages.length === 0) {
        ctx.ui.notify("No previous user messages found in this session.", "warning");
        return;
      }

      const query = args.trim();
      const list = buildRestoreList(messages, query);
      if (list.items.length === 0) {
        ctx.ui.notify(`No user messages matching "${query}".`, "warning");
        return;
      }

      const choice = await ctx.ui.select(list.title, list.items);
      const text = list.resolve(choice);
      if (text == null) return;

      ctx.ui.setEditorText(text);
    },
  });

  pi.registerCommand("dce-config", {
    description: "View or set the double-ESC window in ms (100–1000): /dce-config 300",
    handler: async (args, ctx) => {
      if (ctx.mode !== "tui") return;

      const raw = args.trim();
      if (!raw) {
        ctx.ui.notify(
          `Double-ESC window: ${config.windowMs}ms — usage: /dce-config <${MIN_WINDOW_MS}-${MAX_WINDOW_MS}>`,
          "info",
        );
        return;
      }

      const n = Number(raw);
      if (!Number.isFinite(n) || n < MIN_WINDOW_MS || n > MAX_WINDOW_MS) {
        ctx.ui.notify(
          `Invalid value "${raw}". Use an integer between ${MIN_WINDOW_MS} and ${MAX_WINDOW_MS}.`,
          "error",
        );
        return;
      }

      config.windowMs = Math.round(n);
      saveConfig();
      ctx.ui.notify(`Double-ESC window set to ${config.windowMs}ms.`, "info");
    },
  });

  pi.registerCommand("dce-help", {
    description: "Show double-escape-clear usage",
    handler: async (_args, ctx) => {
      if (ctx.mode !== "tui") return;
      ctx.ui.notify(
        [
          "double-escape-clear",
          `• Double-ESC (≤${config.windowMs}ms) with content: clear editor, ↑/↓ retrieves it`,
          "• Single ESC: native behavior (idle: clear editor; streaming: abort task)",
          "• Holding ESC: treated as key repeat, never triggers a double-tap",
          "• /restore [keyword] — restore a past user message into the editor",
          `• /dce-config <ms> — set the double-ESC window (${MIN_WINDOW_MS}–${MAX_WINDOW_MS})`,
        ].join("\n"),
        "info",
      );
    },
  });
}
