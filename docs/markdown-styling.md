# Markdown 文件字体配置指南

导出的 Markdown 文件包含 YAML frontmatter 元数据和正文内容。为了获得最佳阅读体验，建议为不同编辑器配置合适的字体。

## 推荐字体配置

### 元数据（YAML frontmatter）
- **等宽字体**：适合显示结构化数据
- 推荐字体：
  - `JetBrains Mono`
  - `Fira Code`
  - `Source Code Pro`
  - `Consolas`（Windows）
  - `Menlo`（macOS）

### 正文内容
- **无衬线字体**：适合中英混排
- 推荐字体：
  - 英文：`Inter`、`Helvetica Neue`、`San Francisco`
  - 中文：`思源黑体`、`苹方`、`微软雅黑`

## 编辑器配置

### VS Code

1. 打开设置（`Cmd/Ctrl + ,`）
2. 搜索 "markdown font"
3. 编辑 `settings.json`：

```json
{
  "editor.fontFamily": "'JetBrains Mono', 'Fira Code', Menlo, Monaco, 'Courier New', monospace",
  "markdown.preview.fontFamily": "'Inter', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
  "editor.fontSize": 14,
  "markdown.preview.fontSize": 15,
  "markdown.preview.lineHeight": 1.6
}
```

### Obsidian

1. 进入设置 → 外观 → 字体
2. 配置：
   - **文本字体**：`Inter, PingFang SC, sans-serif`
   - **等宽字体**：`JetBrains Mono, Menlo, monospace`

或者创建自定义 CSS 片段（`.obsidian/snippets/custom-fonts.css`）：

```css
/* YAML frontmatter 字体 */
.language-yaml,
.frontmatter-container {
  font-family: 'JetBrains Mono', 'Fira Code', Menlo, monospace !important;
  font-size: 13px;
  line-height: 1.5;
}

/* 正文字体 */
.markdown-preview-view {
  font-family: 'Inter', 'PingFang SC', 'Hiragino Sans GB', sans-serif !important;
  font-size: 15px;
  line-height: 1.6;
}

/* 标题字体 */
.markdown-preview-view h1,
.markdown-preview-view h2,
.markdown-preview-view h3 {
  font-family: 'Inter', 'PingFang SC', 'Hiragino Sans GB', sans-serif !important;
  font-weight: 600;
}

/* 代码块字体 */
.markdown-preview-view code,
.markdown-preview-view pre {
  font-family: 'JetBrains Mono', 'Fira Code', Menlo, monospace !important;
  font-size: 13px;
}
```

### Typora

1. 打开 **偏好设置** → **外观**
2. 点击 **打开主题文件夹**
3. 创建或编辑 CSS 文件（如 `custom.css`）：

```css
/* YAML frontmatter */
#write pre.md-meta-block {
  font-family: 'JetBrains Mono', 'Fira Code', Menlo, monospace;
  font-size: 13px;
  line-height: 1.5;
  background: #f6f8fa;
  border-radius: 6px;
  padding: 12px;
}

/* 正文 */
#write {
  font-family: 'Inter', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  font-size: 15px;
  line-height: 1.6;
}

/* 标题 */
#write h1, #write h2, #write h3 {
  font-weight: 600;
}

/* 代码 */
#write code, #write pre {
  font-family: 'JetBrains Mono', 'Fira Code', Menlo, monospace;
}
```

### MacDown

1. 打开 **Preferences** → **Rendering**
2. 设置：
   - **Editor Font**: `JetBrains Mono` 或 `Menlo`
   - **Preview Font**: `Inter` 或 `San Francisco`

### iA Writer

1. 打开 **Preferences** → **Editor**
2. 选择：
   - **Mono**: 用于代码和元数据
   - **Sans**: 用于正文

## Markdown 文件结构说明

导出的文件结构：

```markdown
---
title: "Tweet by Author Name"
author: "Author Name"
handle: "@username"
source: "X (Twitter)"
tweet_id: "123456789"
url: "https://x.com/username/status/123456789"
created: "2025-10-31T11:15:06.000Z"
exported: "2025-10-31T12:00:00.000Z"
stats:
  likes: 38
  retweets: 4
  replies: 2
  bookmarks: 11
tags:
  - twitter
  - x-exporter
---

正文内容...
```

## 字体下载

- **JetBrains Mono**: https://www.jetbrains.com/lp/mono/
- **Fira Code**: https://github.com/tonsky/FiraCode
- **Inter**: https://rsms.me/inter/
- **Source Code Pro**: https://adobe-fonts.github.io/source-code-pro/
- **思源黑体**: https://github.com/adobe-fonts/source-han-sans

## 在线预览

如果使用 GitHub 或其他平台查看 Markdown，它们通常会自动应用美观的字体样式。

## 自定义导出模板

如果需要自定义 Markdown 导出格式，可以修改插件源代码中的：
- `src/content/exporters/markdown.ts`

例如，可以添加自定义的元数据字段、调整格式等。
