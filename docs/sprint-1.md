# Sprint 1 — 单条推文导出

## 完成内容
- 推文类型识别：实现 `classifyTweet` 初版逻辑，识别引用 & Thread 起始推文，为上下文菜单做准备。
- 推文抓取：`scrapeTweetData` 支持作者、时间、互动数据、图片、引用推文递归抓取。
- Markdown 导出：构建 `generateMarkdown`，提供元数据头、引用块、图片 `![]()`，并在内容菜单中提供导出入口。
- Markdown 交互：弹出模态框可预览、复制、下载 `.md` 文件。
- 海报导出：新增海报预览模态，使用内置字体排版、二维码生成、最多 4 张图片排版，并用 `html2canvas` 导出 PNG。
- 内容脚本 UI：导出按钮支持上下文菜单、外部点击关闭、未完成功能（Thread 导出）禁用提示。
- 依赖治理：引入 `@types/*`、`clsx`、`qrcode`，以及海报/Markdown 所需工具。

## Smoke Test

命令：`npm run smoke`

包含步骤：`lint` → `typecheck` → `vitest run`

执行时间：2025-02-14 — ✅ 已通过

## 后续建议
- Sprint 2 聚焦 Thread 自动抓取与 Markdown 批量导出。
- 在 Poster 导出前增加图片跨域预取（与 background service worker 集成）。
- 扩大 Vitest 覆盖：为 `tweetScraper`、`generateMarkdown` 编写 DOM fixture 测试。
