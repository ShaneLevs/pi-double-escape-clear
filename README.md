# pi-double-escape-clear

[![npm version](https://img.shields.io/npm/v/pi-double-escape-clear.svg)](https://www.npmjs.com/package/pi-double-escape-clear)
[![pi package](https://img.shields.io/badge/pi-package-8A2BE2.svg)](https://pi.dev/packages/pi-double-escape-clear)

为 pi coding agent 提供 **双击 ESC 快速清空输入** + **`/restore` 找回历史消息** 的扩展插件。

---

## 中文

### 功能

#### 双击 ESC 清空编辑器

| 编辑器状态 | 操作 | 效果 |
|-----------|------|------|
| 有内容 | 快速连按两次 ESC（≤300ms） | 清空输入，内容存入历史，`↑`/`↓` 可找回 |
| 为空 | 快速连按两次 ESC | 打开 session tree（原生行为） |

**任务运行中也安全**

单次 ESC 是 pi 原生「终止任务」快捷键（`app.interrupt`）。插件在输入框有内容时会拦截第一次 ESC 并等待第二次：双击 ESC 只清空输入，**不会中断正在运行的任务**；若 300ms 内没有第二次 ESC，则照常转发给原生逻辑，单次 ESC 终止任务的能力不受影响。

> 双击检测窗口默认 300ms，可用 `/dce-config` 调整（100–1000ms）。

**按住 ESC 不会误触**

终端按住按键会以约 30ms 间隔连发键码：插件会把间隔小于 50ms 的 ESC 视为按键重复并忽略，长按 ESC 不会触发清空，也不会卡住单次 ESC 的原生行为。

#### `/restore` 找回历史消息

输入了一段长文本想整体修改，不必 `Ctrl+C` 重来或用方向键逐字回退：**双击 ESC 清空 → `↑` 找回 → 修改后重新发送**。

#### `/restore` 找回历史消息

从当前 session 的用户消息中恢复任意一条到输入框，便于修改后重发。

```
/restore            列出最近 20 条
/restore <关键词>   按关键词过滤后再选
```

- 列出最近 20 条用户消息（**最新在前**），每条带序号，显示 60 字符预览。
- 支持关键词过滤：多个关键词用空格分隔（AND 关系）；先按子串匹配，无结果时自动降级为模糊（子序列）匹配。
- 序号保证了预览相同的消息也不会选错条目。
- 选中后自动填入输入框，可直接修改再发送。

**适用场景**

- 上一条消息发了不满意，想基于原文修改重发。
- 写过一段长提示词想复用，但忘了内容。
- 想回看之前的输入。

#### `/dce-config` 与 `/dce-help`

```
/dce-config          查看当前双击窗口
/dce-config 250      设置双击窗口为 250ms（100–1000）
/dce-help            显示插件用法速览
```

窗口设置持久化到 `~/.pi/agent/double-escape-clear/config.json`。

### 安装

```bash
pi install npm:pi-double-escape-clear
```

安装后在 pi 内执行 `/reload` 生效（首次安装会自动发现）。

### 许可证

MIT

---

## English

### Features

#### Double-ESC to Clear the Editor

| Editor state | Action | Effect |
|-----------|------|------|
| Has content | Double-tap ESC (≤300ms) | Clears input, keeps text in history (`↑`/`↓` retrieves it) |
| Empty | Double-tap ESC | Opens the session tree (native behavior) |

**Safe while a task is running**

A single ESC is pi's native "cancel / abort" shortcut (`app.interrupt`). When the editor has content, this extension intercepts the first ESC and waits for a second: double-ESC only clears the input and **never interrupts a running task**. If no second ESC arrives within 300ms, the held ESC is forwarded to the native handler, so single-ESC abort still works.

> The double-press window defaults to 300ms; adjust it with `/dce-config` (100–1000ms).

**Holding ESC is safe**

Terminals auto-repeat held keys at ~30ms intervals: the extension treats ESC presses less than 50ms apart as key repeats and ignores them, so holding ESC never triggers a clear nor breaks the native single-ESC behavior.

**Typical use case**

Typing a long message and want to rework it? Skip `Ctrl+C` and cursor-poking: **double-ESC to clear → `↑` to retrieve → edit and resend**.

#### `/restore` — Bring Back Past Messages

Restore any previous user message from the current session into the editor for editing and resending.

```
/restore                list the 20 most recent
/restore <keyword(s)>   filter before selecting
```

- Lists the 20 most recent user messages (**newest first**), numbered, with a 60-character preview each.
- Keyword filtering: multiple keywords are space-separated (AND); substring match first, automatic fallback to fuzzy (subsequence) matching.
- Numbering guarantees identical-looking previews can never select the wrong entry.
- Selecting one fills the editor so you can edit and resend it.

**Use cases**

- Not happy with the last message? Edit and resend from the original text.
- Reuse a long prompt you no longer remember.
- Look back at what you previously typed.

#### `/dce-config` and `/dce-help`

```
/dce-config          view the current double-press window
/dce-config 250      set the window to 250ms (100–1000)
/dce-help            show a quick usage summary
```

The window is persisted to `~/.pi/agent/double-escape-clear/config.json`.

### Installation

```bash
pi install npm:pi-double-escape-clear
```

Then run `/reload` in pi (auto-discovered on first install).

### License

MIT
