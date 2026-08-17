# pi-double-escape-clear

Double-escape to clear the editor + `/restore` command to recover previous messages.

## 安装

```bash
pi install npm:pi-double-escape-clear
```

## 功能

- **双击 ESC**（编辑器有内容时）→ 清空编辑器，文本存入历史，↑/↓ 仍可找回
- **双击 ESC**（编辑器为空时）→ 打开 session tree（原生行为不变）
- **`/restore`** → 列出当前 session 最近 20 条用户消息，选中后填入编辑器
