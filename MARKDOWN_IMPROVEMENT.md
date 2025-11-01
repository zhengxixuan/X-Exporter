# Markdown 导出格式改进

## 问题描述

用户反馈导出的 Markdown 文件字体显示不佳，元数据和正文字体混乱，阅读体验差。

## 改进方案

### 1. 优化 YAML Frontmatter 格式

**改进前**：
```yaml
---
author: "Heptabase"
handle: "@Heptabase"
timestamp: "2025-10-31T11:15:06.000Z"
date: "2025/10/31 19:15"
url: "https://x.com/Heptabase/status/..."
stats:
  likes: 38
  retweets: 4
  replies: 2
  bookmarks: 11
---
```

**改进后**：
```yaml
---
title: "Tweet by Heptabase"
author: "Heptabase"
handle: "@Heptabase"
source: "X (Twitter)"
tweet_id: "1984217561400226027"
url: "https://x.com/Heptabase/status/1984217561400226027"
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
```

**改进点**：
- ✅ 添加 `title` 字段，便于 Obsidian 等工具识别
- ✅ 添加 `source` 字段，标明来源
- ✅ 使用 `created` 和 `exported` 明确时间语义
- ✅ 添加 `tags` 方便分类和搜索
- ✅ 更规范的 YAML 格式，兼容各种 Markdown 编辑器

### 2. 增强正文格式

**改进**：
- 在文件末尾添加导出标识：`*Exported with [X-Exporter](https://github.com/your-repo/x-exporter)*`
- Thread 标题显示推文数量：`# Thread (3 tweets)`
- 使用标准的 Markdown 分隔符 `---`

**示例输出**：

```markdown
---
title: "Tweet by Heptabase"
author: "Heptabase"
handle: "@Heptabase"
source: "X (Twitter)"
tweet_id: "1984217561400226027"
url: "https://x.com/Heptabase/status/1984217561400226027"
created: "2025-10-31T11:15:06.000Z"
exported: "2025-10-31T12:30:45.123Z"
stats:
  likes: 38
  retweets: 4
  replies: 2
  bookmarks: 11
tags:
  - twitter
  - x-exporter
---

We've launched Web Tab in Heptabase! You can now search Google, YouTube, or open any website directly inside Heptabase — take notes side by side, see AI-suggested related cards, or even chat with the page you're browsing.

我们已在 Heptabase 中推出网页标签页！

您现在可以直接在 Heptabase 中搜索 Google、YouTube 或打开任何网站——可以并排记笔记、查看 AI 建议的相关卡片，甚至可以与您正在浏览的页面聊天。

---

*Exported with [X-Exporter](https://github.com/your-repo/x-exporter)*
```

### 3. 字体配置指南

创建了详细的字体配置文档：`docs/markdown-styling.md`

包含以下编辑器的配置说明：
- ✅ **VS Code**：settings.json 配置
- ✅ **Obsidian**：自定义 CSS 片段
- ✅ **Typora**：主题 CSS 配置
- ✅ **MacDown**：偏好设置
- ✅ **iA Writer**：字体选择

**推荐字体方案**：

| 内容类型 | 推荐字体 |
|---------|---------|
| YAML 元数据 | `JetBrains Mono`, `Fira Code`, `Menlo` |
| 正文内容 | `Inter`, `PingFang SC`, `Hiragino Sans GB` |
| 标题 | `Inter`, `PingFang SC` (加粗) |
| 代码 | `JetBrains Mono`, `Fira Code` |

## 修改文件清单

### 修改文件
- ✅ `src/content/exporters/markdown.ts`
  - 优化 YAML frontmatter 结构
  - 添加更多元数据字段
  - 添加文件尾部标识
  - Thread 标题显示推文数量

- ✅ `src/content/exporters/markdown.test.ts`
  - 更新测试用例匹配新格式
  - 验证新增的元数据字段

### 新增文件
- ✅ `docs/markdown-styling.md` - 详细的字体配置指南
- ✅ `MARKDOWN_IMPROVEMENT.md` - 本文档

## 验证结果

✅ **类型检查**：通过
✅ **代码规范**：通过
✅ **单元测试**：全部通过（6 个测试）
✅ **构建测试**：成功

## 使用建议

### 快速配置（VS Code）

在 VS Code 中打开 Markdown 文件后，按 `Cmd/Ctrl + ,` 打开设置，搜索 "markdown font"，添加：

```json
{
  "markdown.preview.fontFamily": "'Inter', 'PingFang SC', sans-serif",
  "editor.fontFamily": "'JetBrains Mono', Menlo, monospace"
}
```

### Obsidian 用户

1. 下载推荐字体（JetBrains Mono, Inter）
2. 在 Obsidian 设置中配置字体
3. 或使用提供的 CSS 片段（见 `docs/markdown-styling.md`）

### 字体获取

**免费开源字体**：
- JetBrains Mono: https://www.jetbrains.com/lp/mono/
- Inter: https://rsms.me/inter/
- Fira Code: https://github.com/tonsky/FiraCode

## 兼容性

新的 YAML frontmatter 格式完全兼容：
- ✅ Obsidian
- ✅ Logseq
- ✅ Notion（导入）
- ✅ GitHub/GitLab
- ✅ Jekyll/Hugo 等静态站点生成器
- ✅ 所有标准 Markdown 编辑器

## 附加功能

### 1. 更好的 Obsidian 集成

新格式可以更好地与 Obsidian 集成：
- `title` 字段会显示在文件列表
- `tags` 可以用于搜索和过滤
- `created` 和 `exported` 时间戳可用于排序

### 2. 便于搜索

添加的标签和元数据使得搜索更方便：
```
tag:#twitter
tag:#x-exporter
author:"Heptabase"
```

### 3. 自动化处理

标准化的 YAML frontmatter 便于后续脚本处理：
```python
import yaml

with open('tweet.md') as f:
    content = f.read()
    # 提取 frontmatter
    frontmatter = yaml.safe_load(content.split('---')[1])
    print(f"Author: {frontmatter['author']}")
    print(f"Likes: {frontmatter['stats']['likes']}")
```

## 后续优化方向

可以考虑的进一步改进：

1. **自定义模板**：允许用户自定义 Markdown 导出模板
2. **样式预设**：提供多种预设样式（学术、博客、笔记等）
3. **元数据扩展**：添加更多可选元数据（话题、地理位置等）
4. **批量导出**：支持批量导出时的自动分类和组织

## 总结

通过优化 YAML frontmatter 格式和提供详细的字体配置指南，显著提升了导出 Markdown 文件的可读性和实用性。新格式更加标准化，兼容性更好，便于后续处理和集成。
