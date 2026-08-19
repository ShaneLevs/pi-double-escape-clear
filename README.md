# pi-double-escape-clear

为 pi coding agent 提供 **双击 ESC 快速清空输入** + **`/restore` 找回历史消息** 的扩展插件。
<br>An extension for the pi coding agent: **double-ESC to clear the input** + **`/restore` to bring back past messages**.

## 安装 / Install

```bash
pi install npm:pi-double-escape-clear
```

安装后在 pi 内执行 `/reload` 生效（首次安装会自动发现）。
<br>Then run `/reload` in pi (auto-discovered on first install).

## 功能 / Features

### 双击 ESC 清空编辑器 / Double-ESC to Clear the Editor

| 编辑器状态 State | 操作 Action | 效果 Effect |
|-----------|------|------|
| 有内容<br>With content | 快速连按两次 ESC（≤300ms）<br>Double-tap ESC (≤300ms) | 清空输入，内容存入历史，`↑`/`↓` 可找回<br>Clears input, keeps text in history (`↑`/`↓` retrieves it) |
| 为空<br>Empty | 快速连按两次 ESC<br>Double-tap ESC | 打开 session tree（原生行为）<br>Opens the session tree (native behavior) |

**任务运行中也安全 / Safe while a task is running**

单次 ESC 是 pi 原生「终止任务」快捷键（`app.interrupt`）。插件在输入框有内容时会拦截第一次 ESC 并等待第二次：双击 ESC 只清空输入，**不会中断正在运行的任务**；若 300ms 内没有第二次 ESC，则照常转发给原生逻辑，单次 ESC 终止任务的能力不受影响。
<br>A single ESC is pi's native "cancel / abort" shortcut (`app.interrupt`). When the editor has content, this extension intercepts the first ESC and waits for a second: double-ESC only clears the input and **never interrupts a running task**. If no second ESC arrives within 300ms, the held ESC is forwarded to the native handler, so single-ESC abort still works.

> 双击检测窗口默认 300ms。<br>The double-press window defaults to 300ms.

**典型场景 / Typical use case**

输入了一段长文本想整体修改，不必 `Ctrl+C` 重来或用方向键逐字回退：**双击 ESC 清空 → `↑` 找回 → 修改后重新发送**。
<br>Typing a long message and want to rework it? Skip `Ctrl+C` and cursor-poking: **double-ESC to clear → `↑` to retrieve → edit and resend**.

### `/restore` 找回历史消息 / Restore Past Messages

从当前 session 的用户消息中恢复任意一条到输入框，便于修改后重发。
<br>Restore any previous user message from the current session into the editor for editing and resending.

```
/restore
```

- 列出最近 20 条用户消息（倒序，最新在前），每条显示前 60 字符预览。<br>Lists the 20 most recent user messages (newest first) with a 60-character preview each.
- 选中后自动填入输入框，可直接修改再发送。<br>Selecting one fills the editor so you can edit and resend it.

**适用场景 / Use cases**

- 上一条消息发了不满意，想基于原文修改重发。<br>Not happy with the last message? Edit and resend from the original text.
- 写过一段长提示词想复用，但忘了内容。<br>Reuse a long prompt you no longer remember.
- 想回看之前的输入。<br>Look back at what you previously typed.

## 许可证 / License

MIT
