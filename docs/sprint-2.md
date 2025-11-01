# Sprint 2 — Thread 支持

## 完成内容
- Thread 抓取：实现 `collectThreadTweets`，支持自动滚动抓取同一作者的 Thread 推文并保证顺序输出。
- Markdown Thread 导出：`generateMarkdown` 支持 `TweetData[]`，并在导出菜单提供 Thread 选项，成功后在模态中预览与下载完整 Thread Markdown。
- 状态提示：新增 toast 提示 Thread 抓取进度与结果，避免导出期间的无反馈状态。
- 海报图片代理：background service worker 负责跨域拉取图片并缓存，content 端通过消息获取 data URL，确保 `html2canvas` 输出稳定。
- 样式与 UI：内容脚本新增菜单 toast 样式、海报图片加载态提示。
- 单元测试：补充 `generateMarkdown` 与 `scrapeTweetData` 的 Vitest 覆盖，验证 Markdown 结构与 DOM 解析逻辑。

## Smoke Test

命令：`npm run smoke`

包含步骤：`lint` → `typecheck` → `vitest run`

执行时间：2025-02-14 — ✅ 已通过

## 后续建议
- 增加 Thread 抓取的加载提示条，提示当前抓取数量/最大值。
- 将图片代理缓存持久化到 `chrome.storage`，减少重复拉取。
- 扩展测试覆盖 Thread 生成逻辑（模拟滚动与 DOM 更新）。
