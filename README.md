# pi-double-escape-clear

为 pi coding agent 提供双击 ESC 快速清空编辑器 + `/restore` 命令找回历史消息的扩展插件。

## 安装

```bash
pi install npm:pi-double-escape-clear
```

安装后在 pi 内执行 `/reload` 生效（首次加载会自动发现）。

---

## 功能

### 双击 ESC 清空编辑器

| 编辑器状态 | 操作 | 效果 |
|-----------|------|------|
| **有内容** | 快速连按两次 ESC（间隔 ≤300ms）| 清空编辑器，文本自动存入历史记录，`↑`/`↓` 仍可找回 |
| **为空** | 快速连按两次 ESC | 打开 session tree（与原行为完全一致，无冲突）|

> 默认检测窗口为 300ms，可根据需要修改源码中的 `CLEAR_TIMEOUT_MS` 常量调整灵敏度。

#### 为什么需要这个功能？

在没有此插件时，如果你想中途修改已输入的一段长文字，只能：
- 按 `Ctrl+C` 取消并重输
- 或用方向键慢慢回到要修改的位置逐个字符编辑

有了双击 ESC，只需两步：**双击 ESC 清空 → `↑` 找回内容 → 修改后重新发送**。

---

### `/restore` 命令

从当前 session 的历史用户消息中恢复任意一条到编辑器，方便重新编辑和发送。

**使用方式：**

```
/restore
```

执行后会弹出选择列表，显示当前 session 最近 20 条用户消息（按时间倒序，最新在前），每条显示前 60 个字符预览。选中后自动填入编辑器，可继续编辑或修改后再发送。

**适用场景：**

- 上一条消息发了但不满意，想基于原文修改重发
- 之前写过一段长提示词，想复用但忘了内容
- 想回看之前的输入内容

---

## 依赖

此插件依赖以下 pi 核心包，安装时会自动通过 peer dependency 解析：

- `@earendil-works/pi-coding-agent`
- `@earendil-works/pi-ai`
- `@earendil-works/pi-tui`

---

## 开发

```bash
# 本地试用（不安装）
pi -e ./extensions/index.ts

# 本地构建检查
npm run build

# 发布新版本
npm version patch   # 或 minor / major
npm publish --access public
git tag v1.x.x main && git push origin main --tags
```

---

## 许可证

MIT
