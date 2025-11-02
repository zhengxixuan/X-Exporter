# X-Exporter Extension - Claude Context

> 本文档为 AI 助手提供项目上下文，帮助快速理解架构、设计决策和开发约束。

## 项目概述

**X-Exporter** 是一个 Chrome Manifest V3 扩展，用于将 X.com (Twitter) 推文导出为 Markdown 文档或精美海报图片。

- **版本**: 0.1.0
- **技术栈**: React 19 + Vite 7 + TypeScript 5
- **目标用户**: 知识工作者、研究者、内容创作者
- **核心价值**: 高效内容存档与美观分享

## 核心功能

1. **Markdown 导出**
   - 单条推文 / Thread 完整抓取
   - YAML frontmatter 元数据（作者、时间、统计数据）
   - 引用推文使用 Markdown 块引用格式
   - 支持复制到剪贴板或下载 `.md` 文件

2. **海报导出**
   - 精美设计，中英混排友好，适合移动端分享
   - 包含作者信息、正文、图片、引用推文、二维码、统计数据
   - 使用 `html-to-image` 库（已从 `html2canvas` 切换）
   - 3倍像素密度（pixelRatio: 3）确保高清输出

3. **上下文感知**
   - 自动检测推文类型（单条/Thread起始/含引用）
   - 根据类型动态显示导出选项
   - 在每条推文操作栏注入"Export"按钮

## 项目结构

```
src/
├── background/          # Service Worker
│   └── index.ts         # 图片跨域代理 + LRU缓存
├── content/             # Content Script
│   ├── index.tsx        # 主入口，DOM监听，按钮注入
│   ├── components/      # React组件
│   │   ├── MarkdownModal.tsx  # Markdown预览/导出弹窗
│   │   └── PosterModal.tsx    # 海报预览/导出弹窗
│   ├── exporters/       # 导出逻辑
│   │   └── markdown.ts  # Markdown生成器
│   ├── injection/       # UI注入
│   │   └── ExportButton.tsx   # 导出按钮组件
│   ├── scraper/         # 数据抓取
│   │   ├── tweetScraper.ts    # 单条推文解析
│   │   └── threadCollector.ts # Thread抓取逻辑
│   └── style.css        # 样式文件
├── common/              # 共享模块
│   ├── types/tweet.ts   # TypeScript类型定义
│   ├── selectors.ts     # DOM选择器（多层fallback）
│   └── utils/           # 工具函数
│       ├── logger.ts
│       ├── errorHandler.ts
│       ├── debounce.ts
│       └── fontLoader.ts
├── ui/                  # 扩展UI页面
│   ├── index.html       # Popup页面
│   ├── main.tsx
│   └── App.tsx
└── assets/              # 静态资源
    └── fonts/           # 内置字体文件（确保海报字体一致性）
        ├── Inter-*.woff2
        └── NotoSansSC-*.woff2
```

## 关键技术决策

### 1. DOM 选择器策略

**挑战**: X.com 的 CSS 类名动态生成（如 `css-1qaijid`），不可靠。

**解决方案**:
- 严格依赖 `data-testid` 和 `aria-label` 属性
- 多层 fallback 机制（2-3个备选方案）
- 集中管理在 `src/common/selectors.ts`

```typescript
// 示例：推文元素选择器
tweetArticle: [
  'article[data-testid="tweet"]',      // 主选择器
  'article[role="article"]',            // 备选方案1
  'div[data-tweet-id]'                 // 备选方案2
]
```

**重要**: 修改选择器时，务必保持多层 fallback 模式。

### 2. Thread 抓取机制

**挑战**: X.com 动态加载，需自动滚动获取完整对话串。

**实现逻辑** (`src/content/scraper/threadCollector.ts`):
1. 扫描当前页面推文
2. 未找到完整 Thread → 滚动到底部
3. 等待 `MutationObserver` 报告新推文
4. 重复步骤 1-3
5. **终止条件**: 滚动到底且 24 小时内无新推文

**关键优化**:
- 时间戳验证（防止误抓取其他用户回复）
- 作者 Handle 匹配
- 进度提示（如"Thread 抓取中... 已收集 5 条"）

### 3. 海报字体一致性

**挑战**: 不同操作系统默认字体不同（Windows 宋体 vs Mac 苹方），影响海报美观度。

**解决方案**:
1. **内置字体**: 打包 Inter（英文）+ Noto Sans SC（中文）
2. **Manifest 配置**: `web_accessible_resources` 声明字体
3. **CSS 强制加载**:
   ```css
   @font-face {
     font-family: 'XExporter';
     src: url('chrome-extension://.../Inter-Regular.woff2') format('woff2');
   }
   ```
4. **预加载**: `ensureFontsLoaded()` 确保字体就绪

**重要**: 不要移除 `src/assets/fonts/` 目录，不要修改字体加载逻辑。

### 4. 跨域图片处理

**挑战**: `html-to-image` 无法直接处理 `pbs.twimg.com` 图片（CORS 限制）。

**解决方案** (`src/background/index.ts`):
1. Content Script 发送图片 URL 到 Background
2. Background 通过 `fetch()` 下载图片（无 CORS 限制）
3. 转换为 `data:URL`（Base64）
4. 返回给 Content Script 填充到 `<img>` 标签
5. **LRU 缓存**: 最多 50 张图片，总大小 50MB

**重要**: 不要绕过 Background 直接处理图片，会触发 CORS 错误。

### 5. MutationObserver 性能优化

**挑战**: Twitter 频繁 DOM 变化导致 CPU 占用高、页面卡顿。

**解决方案** (`src/content/index.tsx`):
- **节流处理**: 300ms 内多次变化只触发一次
- **批量处理**: 收集所有待处理节点，统一扫描
- **空闲调度**: 使用 `requestIdleCallback` 在浏览器空闲时处理
- **队列机制**: 避免阻塞主线程

```typescript
const throttledSchedule = throttle(scheduleProcessing, 300);
requestIdleCallback(() => processPendingNodes(), { timeout: 1000 });
```

**重要**: 不要移除节流逻辑，否则会导致严重性能问题。

### 6. 从 html2canvas 切换到 html-to-image

**原因**:
- 包体积减少 72%（200KB → 56KB）
- 更好的 CSS 支持（圆角、阴影、渐变）
- 文本布局 100% 一致（浏览器原生渲染）

**导出参数** (`src/content/components/PosterModal.tsx`):
```typescript
htmlToImage.toPng(element, {
  quality: 1,          // PNG 最高质量
  pixelRatio: 3,       // 3 倍清晰度（适合移动端）
  cacheBust: true,     // 避免浏览器缓存
  backgroundColor: '#ffffff'
})
```

**重要**: 不要切换回 `html2canvas`，会重新引入文本换行问题。

## 数据模型

### 核心类型：TweetData

```typescript
interface TweetData {
  tweetId: string;
  authorName: string;
  authorHandle: string;
  avatarUrl: string;
  timestamp: string;           // ISO 8601 格式
  textContentHtml: string;     // 带 <br> 和 <a> 标签
  imageUrls: string[];
  videoThumbnailUrl?: string;
  stats: {
    likes: number;
    retweets: number;
    replies: number;
    bookmarks: number;
  };
  tweetUrl: string;
  quotedTweet?: TweetData;     // 递归引用
  isThreadStart: boolean;
}
```

**位置**: `src/common/types/tweet.ts`

## 开发约束与最佳实践

### 1. 选择器修改

- **必须**: 保持多层 fallback 机制
- **必须**: 在 `src/common/selectors.ts` 中集中管理
- **必须**: 依赖 `data-testid` 和 `aria-label`，不要依赖 CSS 类名
- **建议**: 修改后在实际 X.com 页面测试

### 2. 性能优化

- **必须**: 保留节流（throttle）逻辑
- **必须**: 使用 `requestIdleCallback` 处理批量操作
- **禁止**: 在 `MutationObserver` 回调中执行耗时操作
- **禁止**: 同步阻塞主线程

### 3. 错误处理

- **必须**: 使用 `src/common/utils/errorHandler.ts` 统一处理错误
- **必须**: 显示用户友好的 Toast 提示（不要用 `alert()`）
- **必须**: 记录详细错误日志（使用 `logger.ts`）
- **建议**: 提供降级方案（如抓取失败时提示手动操作）

### 4. 代码风格

- **必须**: TypeScript 严格模式（`strict: true`）
- **必须**: ESLint + Prettier 通过（`npm run lint`）
- **必须**: 类型检查通过（`npm run typecheck`）
- **建议**: 在提交前运行 `npm run smoke`（lint + typecheck + test）

### 5. 测试

- **必须**: 为核心逻辑添加单元测试（Vitest）
- **重点测试**:
  - `tweetScraper.ts`（推文解析）
  - `threadCollector.ts`（Thread 抓取）
  - `markdown.ts`（Markdown 生成）
- **禁止**: 破坏现有测试用例

## 常见任务指引

### 修改推文抓取逻辑

1. 查看 `src/content/scraper/tweetScraper.ts`
2. 修改 `scrapeTweetData()` 函数
3. 更新 `src/common/selectors.ts` 中的选择器（如需要）
4. 运行测试：`npm run test -- tweetScraper.test.ts`
5. 在实际 X.com 页面验证

### 修改 Markdown 格式

1. 查看 `src/content/exporters/markdown.ts`
2. 修改 `formatTweetAsMarkdown()` 或 `formatThreadAsMarkdown()`
3. 运行测试：`npm run test -- markdown.test.ts`
4. 验证输出格式

### 修改海报样式

1. 查看 `src/content/components/PosterModal.tsx`
2. 修改 `PosterPreview` 组件的 JSX 或 CSS
3. **注意**: 保留 `fontFamily` 强制加载逻辑
4. **注意**: 不要修改 `htmlToImage.toPng()` 的参数
5. 在浏览器中预览效果

### 添加新功能

1. 查看 `PRD.md` 确认功能范围
2. 更新 `TweetData` 类型（如需要）
3. 实现功能逻辑
4. 添加单元测试
5. 更新文档（`README.md` 或本文件）

## 已知问题与限制

### 已修复

- ✅ 海报文本换行问题（切换到 `html-to-image`）
- ✅ 圆角裁剪问题（`html-to-image` 原生支持）
- ✅ Thread 抓取不完整（添加时间验证）

### 当前限制

1. **Thread 海报**: V1 仅支持单条推文导出为海报，不支持 Thread 导出为长图
2. **视频处理**: 仅显示视频缩略图，不支持视频下载
3. **选择器依赖**: 依赖 X.com 的 `data-testid` 属性，若 X.com 更新可能失效
4. **抓取速度**: Thread 抓取依赖自动滚动，速度较慢

### 未来改进方向

1. E2E 测试（Playwright）
2. 配置化（将硬编码参数移到 options 页面）
3. 国际化（支持多语言）
4. 选择器健康检查（定期验证 DOM 结构）

## 性能指标

| 指标 | 数据 |
|------|------|
| 包体积 | ~73KB（主逻辑）+ 70KB（字体）= 143KB |
| 字体文件 | 5 个 woff2 文件，总计 ~70KB |
| 缓存策略 | 最多 50 张图片，总大小 ≤50MB |
| 单张图片限制 | 10MB |
| 海报输出 | 宽度 366px × pixelRatio 3 = 1098px |
| DOM 监听节流 | 300ms |
| 空闲回调超时 | 1000ms |

## 构建与调试

### 开发模式

```bash
npm install
npm run dev         # Vite 监听模式，实时编译到 dist/
```

### 生产构建

```bash
npm run build       # 输出到 dist/ 目录
```

### 加载扩展

1. 打开 Chrome → `chrome://extensions/`
2. 开启"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `dist` 目录

### 调试技巧

1. **Content Script 调试**: 在 X.com 页面按 F12，查看 Console
2. **Background 调试**: 在 `chrome://extensions/` 点击扩展的"Service Worker"
3. **DOM 检查**: 使用 Elements 面板查看注入的按钮和模态框
4. **性能分析**: Performance 面板分析 `MutationObserver` 性能

## 重要文件路径

- **核心配置**: `manifest.config.ts`, `vite.config.ts`, `tsconfig.json`
- **Content 入口**: `src/content/index.tsx`
- **Background 入口**: `src/background/index.ts`
- **推文抓取**: `src/content/scraper/tweetScraper.ts`
- **Thread 抓取**: `src/content/scraper/threadCollector.ts`
- **Markdown 导出**: `src/content/exporters/markdown.ts`
- **海报组件**: `src/content/components/PosterModal.tsx`
- **选择器配置**: `src/common/selectors.ts`
- **类型定义**: `src/common/types/tweet.ts`
- **产品需求**: `PRD.md`
- **改进记录**: `IMPROVEMENTS.md`

## 联系与反馈

- **GitHub**: [项目仓库 URL]
- **问题反馈**: 请创建 GitHub Issue
- **开发文档**: 见 `docs/` 目录下的 sprint 笔记

---

**最后更新**: 2025-11-02
**当前版本**: 0.1.0
**维护者**: [作者信息]
