/**
 * Double-Escape to Clear Editor + /restore command
 *
 * Features:
 *   - Double-escape (within 300ms) while editor has content → clear editor,
 *     save text to editor history so ↑/↓ can still retrieve it.
 *   - Double-escape with empty editor → opens session tree (native behavior).
 *   - /restore  — list recent user messages from current session, pick one
 *     to restore into the editor for editing & resubmission.
 *
 * Install: ~/.pi/agent/extensions/double-escape-clear.ts
 * Then run /reload in pi to activate.
 */
import { CustomEditor, type ExtensionAPI, type SessionMessageEntry } from "@earendil-works/pi-coding-agent";
import { contentText } from "@earendil-works/pi-ai";
import { matchesKey, Key } from "@earendil-works/pi-tui";

const CLEAR_TIMEOUT_MS = 300;

/* ── Double-escape clear editor ─────────────────────────────────────────── */

class DoubleEscapeClearEditor extends CustomEditor {
  private lastEscapeTime = 0;
  private pendingEscapeTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingEscapeData: string | null = null;

  handleInput(data: string): void {
    if (matchesKey(data, Key.escape)) {
      const now = Date.now();
      const timeSinceLast = now - this.lastEscapeTime;
      const currentText = this.getText().trim();

      // Double-escape while editor has content: save to history, then clear.
      // Neither escape is forwarded to super here: forwarding the first escape
      // triggers pi's native `app.interrupt` binding (Escape = cancel/abort),
      // which terminates a running task before the second escape can arrive
      // (this was the Windows behavior).
      if (
        timeSinceLast < CLEAR_TIMEOUT_MS &&
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
    }, CLEAR_TIMEOUT_MS);
  }

  private cancelPendingEscape(): void {
    if (this.pendingEscapeTimer !== null) {
      clearTimeout(this.pendingEscapeTimer);
      this.pendingEscapeTimer = null;
    }
    this.pendingEscapeData = null;
  }
}

/* ── /restore helper ────────────────────────────────────────────────────── */

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

/* ── Extension entry point ──────────────────────────────────────────────── */

export default function (pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    ctx.ui.setEditorComponent((tui, theme, kb) =>
      new DoubleEscapeClearEditor(tui, theme, kb)
    );
  });

  pi.registerCommand("restore", {
    description: "Restore a previous user message into the editor for editing",
    handler: async (_args, ctx) => {
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

      // Show the most recent 20 messages (newest first)
      const recent = messages.slice(0, 20);
      const displayItems = recent.map((m) => {
        const preview = m.text.length > 60 ? m.text.slice(0, 60) + "…" : m.text;
        return preview.replace(/\n/g, " ");
      });

      const choice = await ctx.ui.select(
        "Restore a previous message:",
        displayItems,
      );
      if (choice == null) return;

      const idx = displayItems.indexOf(choice);
      if (idx < 0) return;

      ctx.ui.setEditorText(recent[idx].text);
    },
  });
}
