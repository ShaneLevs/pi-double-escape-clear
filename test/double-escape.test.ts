/**
 * Behavioral tests for pi-double-escape-clear.
 * Run: bun test
 *
 * The module is imported AFTER pointing HOME at a temp dir so config loading
 * (and clamping) can be exercised without touching the real config file.
 */
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ESC = "\x1b";

type ExtensionModule = typeof import("../extensions/index.ts");

let mod: ExtensionModule;
let fakeHome: string;
let clampedWindowMs = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeAll(async () => {
  fakeHome = join(tmpdir(), `dce-test-home-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const cfgDir = join(fakeHome, ".pi", "agent", "double-escape-clear");
  mkdirSync(cfgDir, { recursive: true });
  // Out-of-range value on purpose: must be clamped to MAX_WINDOW_MS (1000).
  writeFileSync(join(cfgDir, "config.json"), JSON.stringify({ windowMs: 5000 }));

  // bun caches os.homedir() at startup, so point the module at the temp dir
  // via the DCE_CONFIG_DIR override instead.
  process.env.DCE_CONFIG_DIR = cfgDir;
  mod = await import("../extensions/index.ts");

  clampedWindowMs = mod.extensionConfig.windowMs;
  // Shorten the window for fast behavioral tests.
  mod.extensionConfig.windowMs = 120;
});

afterAll(() => {
  rmSync(fakeHome, { recursive: true, force: true });
});

function makeEditor(text = "") {
  const forwards: string[] = [];
  const ed = new mod.DoubleEscapeClearEditor(
    {} as never,
    { borderColor: "#000000" } as never,
    // Only app.interrupt (ESC) is bound; everything else falls through to the editor.
    { matches: (data: string, action: string) => action === "app.interrupt" && data === ESC } as never,
  );
  ed.onEscape = () => {
    forwards.push(ESC);
  };
  if (text) ed.setText(text);
  return { ed, forwards };
}

describe("config loading", () => {
  test("clamps out-of-range windowMs from config.json", () => {
    expect(clampedWindowMs).toBe(mod.MAX_WINDOW_MS);
  });
});

describe("double-escape editor", () => {
  test("empty editor: single ESC forwarded immediately (native behavior)", () => {
    const { ed, forwards } = makeEditor("");
    ed.handleInput(ESC);
    expect(forwards.length).toBe(1);
  });

  test("content editor: single ESC held, then forwarded after the window", async () => {
    const { ed, forwards } = makeEditor("hello");
    ed.handleInput(ESC);
    expect(forwards.length).toBe(0);
    await sleep(230);
    expect(forwards.length).toBe(1);
    expect(ed.getText()).toBe("hello"); // forward must not clear the editor
  });

  test("double-tap with content clears without forwarding", async () => {
    const { ed, forwards } = makeEditor("hello");
    ed.handleInput(ESC);
    await sleep(70);
    ed.handleInput(ESC);
    expect(ed.getText()).toBe("");
    await sleep(230);
    expect(forwards.length).toBe(0);
  });

  test("key auto-repeat (holding ESC) is swallowed: one forward, no clear", async () => {
    const { ed, forwards } = makeEditor("hello");
    ed.handleInput(ESC); // t=0: held
    await sleep(10);
    ed.handleInput(ESC); // repeat
    await sleep(10);
    ed.handleInput(ESC); // repeat
    await sleep(10);
    ed.handleInput(ESC); // repeat
    expect(ed.getText()).toBe("hello"); // repeats must not trigger the clear
    await sleep(230);
    expect(forwards.length).toBe(1); // only the original held ESC is forwarded
  });

  test("non-ESC key cancels a pending hold", async () => {
    const { ed, forwards } = makeEditor("abc");
    ed.handleInput(ESC);
    await sleep(10);
    ed.handleInput("x");
    await sleep(230);
    expect(forwards.length).toBe(0);
    expect(ed.getText()).toBe("abcx");
  });

  test("triple-tap: clear, then next ESC forwards on the now-empty editor", async () => {
    const { ed, forwards } = makeEditor("hello");
    ed.handleInput(ESC); // held
    ed.handleInput(ESC); // <50ms → treated as repeat, swallowed
    await sleep(70);
    ed.handleInput(ESC); // genuine second press → clears
    expect(ed.getText()).toBe("");
    ed.handleInput(ESC); // editor now empty → forwarded synchronously
    expect(forwards.length).toBe(1);
  });

  test("empty editor: double-tap forwards both ESC presses (native session tree)", async () => {
    const { ed, forwards } = makeEditor("");
    ed.handleInput(ESC);
    await sleep(70);
    ed.handleInput(ESC);
    expect(forwards.length).toBe(2);
  });
});

describe("buildRestoreList", () => {
  const msgs = [
    { id: "1", text: "first message" },
    { id: "2", text: "remember the memory config" },
    { id: "3", text: "ok" },
    { id: "4", text: "ok\n" },
  ];

  test("lists newest first with number prefixes", () => {
    const list = mod.buildRestoreList(msgs, "");
    expect(list.items[0]).toContain("ok"); // id 4 (newest) first
    expect(list.items[3]).toContain("first message");
    expect(list.items[0].startsWith("1. ")).toBe(true);
  });

  test("number prefixes keep duplicate previews resolvable", () => {
    const list = mod.buildRestoreList(msgs, "");
    expect(list.items[0]).toBe("1. ok");
    expect(list.items[1]).toBe("2. ok");
    expect(list.resolve("1. ok")).toBe("ok\n"); // exactly the newest entry
    expect(list.resolve("2. ok")).toBe("ok");
  });

  test("resolve returns null for cancel / unknown choice", () => {
    const list = mod.buildRestoreList(msgs, "");
    expect(list.resolve(undefined)).toBe(null);
    expect(list.resolve("99. nope")).toBe(null);
  });

  test("substring filter (case-insensitive, multi-token AND)", () => {
    const list = mod.buildRestoreList(msgs, "MEMORY config");
    expect(list.items.length).toBe(1);
    expect(list.resolve(list.items[0])).toBe("remember the memory config");
    expect(list.title).toContain("MEMORY config");
  });

  test("falls back to fuzzy subsequence matching", () => {
    const list = mod.buildRestoreList(msgs, "mmry"); // subsequence of "memory"
    expect(list.items.length).toBe(1);
    expect(list.resolve(list.items[0])).toBe("remember the memory config");
  });

  test("no match yields empty items", () => {
    expect(mod.buildRestoreList(msgs, "zzz").items.length).toBe(0);
  });

  test("caps the list at 20 entries", () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ id: String(i), text: `msg ${i}` }));
    const list = mod.buildRestoreList(many, "");
    expect(list.items.length).toBe(20);
    expect(list.items[0]).toContain("msg 24"); // newest first
  });
});

describe("helpers", () => {
  test("previewOf collapses whitespace and truncates", () => {
    expect(mod.previewOf("  a \n  b  ")).toBe("a b");
    const long = "x".repeat(70);
    expect(mod.previewOf(long)).toBe("x".repeat(60) + "…");
    expect(mod.previewOf("short")).toBe("short");
  });

  test("isSubsequence", () => {
    expect(mod.isSubsequence("mmry", "remember the memory config")).toBe(true);
    expect(mod.isSubsequence("zzz", "memory")).toBe(false);
    expect(mod.isSubsequence("", "anything")).toBe(true);
  });

  test("matchesQuery requires every token (AND)", () => {
    const text = "clear the editor";
    expect(mod.matchesQuery(text, ["clear", "editor"], false)).toBe(true);
    expect(mod.matchesQuery(text, ["clear", "missing"], false)).toBe(false);
  });
});
