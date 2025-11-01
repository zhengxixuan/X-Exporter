# 《"X-Exporter" 浏览器插件项目开发设计文档 (PDD)》

## 1\. 项目概述

  * **项目名称：** X-Exporter
  * **项目愿景：** 成为 x.com (Twitter) 上最高效、最优质的内容导出工具，服务于知识工作者、研究者和创作者的内容存档与分享需求。
  * **核心功能：**
    1.  **Markdown 导出：** 将推文内容（单条、Thread、引用）快速保存为结构化的 `.md` 文件，用于知识库沉淀。
    2.  **海报导出：** 将推文生成为“清晰简洁、中英混排友好、适合移动端”的精美图片，用于社交媒体分享。

## 2\. 详细功能需求 (Functional Requirements)

#### F-01：上下文感知导出 (Context-Aware Export)

  * **F-01.1 (注入):** 插件将通过 `content-script` 动态注入一个“导出”图标按钮到每条推文的操作栏中（与回复、转推、喜欢按钮并列）。
  * **F-01.2 (检测):** 点击“导出”按钮时，插件必须**立刻**在后台分析当前推文的类型。
      * `isSingle`: 简单的单条推文。
      * `isThreadStart`: 是一个Thread（主题帖）的起始推文。
      * `hasQuote`: 包含一条引用推文。
  * **F-01.3 (UI):** 根据检测结果，弹出一个上下文菜单，提供不同选项。

#### F-02：导出UI流程 (Export UI Flow)

**场景A：点击“导出”按钮 (在推文 A 上)**

1.  **检测开始：**
      * 插件检测到推文 A `hasQuote` (引用了推文 B)。
      * 插件检测到推文 A `isThreadStart` (推文 A 之后有来自同一作者的回复)。
2.  **弹出菜单显示：**
      * **导出为 Markdown**
          * 子选项 1: 仅导出本条 (推文 A + 引用 B)
          * 子选项 2: 导出完整 Thread (推文 A、A的回复、A的回复的回复... + 引用 B)
      * **导出为海报**
          * 子选项 1: 仅导出本条 (推文 A + 引用 B)
          * *（V1 暂不提供 Thread 导出海报，见 F-04.3）*

#### F-03：功能：Markdown 导出

  * **F-03.1 (内容 - 必选):** 导出的 `.md` 文件必须包含以下元数据（按你要求）：
      * 作者 (昵称)
      * 作者 Handle (@username)
      * 时间戳 (格式: YYYY-MM-DD HH:mm)
      * 喜欢数
      * 转推数
      * 浏览量
  * **F-03.2 (正文):**
      * 推文正文（HTML 转为 Markdown）。
      * 推文中的图片 (转为 `![]()` 格式)。
      * 推文中的链接保持原样。
  * **F-03.3 (引用):** 引用推文 (Quote Tweet) 必须使用 Markdown 的 `>` 块引用格式嵌套在主推文内容中。
  * **F-03.4 (Thread):** 如果导出 Thread，多条推文将按时间顺序排列，并使用 `---` (水平分割线) 或 `## 2.` (二级标题) 来分隔每条推文。
  * **F-03.5 (交付):** 提供“复制到剪贴板”和“下载 .md 文件”两个选项。

#### F-04：功能：海报导出

  * **F-04.1 (设计原则):** 严格遵守“清晰简洁、中英混排友好、适合手机浏览”。
      * **版式：** 采用上图下文或上文下图的卡片式设计，留白充足。
      * **字体：** (关键) 必须强制使用我们**打包在插件内**的开源字体（如 `Inter` + `Noto Sans SC`），以确保在任何设备上中英混排都美观，解决 `html2canvas` 的字体渲染问题。
  * **F-04.2 (海报元素):**
      * 作者头像、昵称、Handle。
      * 推文正文（保留换行）。
      * 推文中的图片（最多4张，https://www.google.com/search?q=%E6%8C%89x.com布局排列）。
      * 被引用的推文（以“嵌套卡片”形式展示）。
      * 一个指向原推文的二维码。
      * *（注意：根据“清晰简洁”原则，默认不显示 喜欢/转推 等统计数据，避免视觉干扰。这可以作为V1.5的自定义选项）。*
  * **F-04.3 (Thread 限制):** **V1 限制**。导出 Thread 为海报是一个复杂的设计问题（是生成长图，还是多图？）。
      * **建议：** V1 的“导出海报”功能**仅适用于“单条推文”**（`F-02` 流程中，即使用户在Thread上点击，也只导出“本条”）。这能极大加快V1的上线速度。

## 3\. 技术架构 (Technical Architecture)

#### 3.1. 技术栈

  * **插件标准：** Manifest V3
  * **核心逻辑：** TypeScript
  * **UI 框架：** React + Vite (用于构建注入的按钮、上下文菜单、海报预览模态框)
  * **Markdown 转换：** `turndown` (HTML to Markdown)
  * **海报生成：** `html2canvas` (DOM to Canvas)
  * **文件保存：** `FileSaver.js` (触发浏览器下载)

#### 3.2. 核心组件

1.  **`content-script` (侦察兵)**
      * **职责：** 监听DOM变化 (`MutationObserver`)，识别新的推文元素。
      * **挑战：** 依赖 `data-testid` 和 `aria-label` 来定位推文和操作栏，这是唯一的稳定锚点。
      * **实现：** 找到推文后，使用 React Portal 在该位置渲染我们的“导出”按钮。
2.  **`ui-app` (交互界面)**
      * **职责：** 这是一个在 `content-script` 中运行的独立 React 应用，负责渲染“导出菜单”和“海报预览模态框”。
      * **流程：**
          * 用户点击“导出海报”。
          * `ui-app` 弹出一个模态框 (Modal)。
          * 模态框中是一个用 HTML/CSS 实时渲染的海报预览 (Poster Preview DOM)。
          * 用户在模态框中点击“确认下载”。
3.  **`background` (后勤官 / Service Worker)**
      * **职责 1 (下载)：** 接收 `content-script` 发来的数据（Markdown 字符串或海报的 Base64 DataURL），并调用 `chrome.downloads.download()` API。
      * **职责 2 (跨域)：** (海报功能核心) 解决 `html2canvas` 的跨域图片问题。`content-script` 会把推文中的图片URL (如 `pbs.twimg.com/...`) 发给 `background`，`background` 去 `fetch` 这些图片，转成 `data:URL` (Base64)，再发回给 `content-script` 填充到海报预览的 `<img>` 标签中。

## 4\. 关键数据模型 (Data Models)

```typescript
// 定义我们抓取的数据结构
interface TweetData {
  tweetId: string;
  authorName: string;
  authorHandle: string;
  avatarUrl: string;
  timestamp: string;      // ISO 8601 格式
  textContentHtml: string;  // 带 <br> 和 <a> 标签的原文
  
  // 媒体
  imageUrls: string[];
  videoThumbnailUrl?: string;
  
  // 元数据 (按你要求)
  stats: {
    likes: number;
    retweets: number;
    views: number;
  };

  // 关系
  tweetUrl: string;
  quotedTweet?: TweetData; // 递归引用
  isThreadStart: boolean;
}
```

## 5\. 关键挑战与解决方案 (Challenges & Mitigations)

#### C-01：【最难】Thread (主题帖) 抓取

  * **挑战：** 用户点击“导出完整 Thread”后，我们必须自动获取该 Thread 的所有推文，而 x.com 是动态加载的。
  * **解决方案 (V1)：** **“自动滚动抓取”**。
    1.  `content-script` 向用户显示一个“抓取中... (1/?)”的加载提示。
    2.  `content-script` 开始循环执行：
        a.  扫描当前页面所有推文，找到属于该 Thread 的下一条（通过“作者 Handle”和“回复给...”的 `aria-label` 属性）。
        b.  如果找到，抓取数据并存储。
        c.  如果没有找到，模拟 `window.scrollTo(0, document.body.scrollHeight)` 滚动到底部。
        d.  等待 `MutationObserver` 报告新的推文加载进来。
        e.  重复 a 步骤。
    3.  **终止条件：** 当滚动到底部，且新加载的推文里再也找不到来自同一作者的、衔接上一条的回复时，抓取结束。
  * **风险：** 较慢，且如果 x.com 的 DOM 结构在“回复”标识上发生变化，容易失效。

#### C-02：X.com 的 DOM 和 CSS 混淆

  * **挑战：** x.com 的 CSS 类名 (如 `css-1qaijid`) 是动态生成的，不可靠。
  * **解决方案：** **严格依赖 `data-testid` 和 `aria-label`**。
      * `article[data-testid="tweet"]` -\> 定位推文容器。
      * `div[aria-label*="Likes"]` -\> 定位“喜欢”按钮（并从中提取数字）。
      * `div[data-testid="tweetText"]` -\> 定位推文正文。
      * *我们将维护一个专门的 `selectors.ts` 文件来管理这些“锚点”，以便未来 x.com 更新时，我们只需修改这一个文件。*

#### C-03：海报字体的中英混排

  * **挑战：** 你要求“中英混排友好”。如果直接用 `html2canvas` 截图，它会使用用户系统上的默认字体，在 Windows 上可能是宋体，在 Mac 上是苹方，效果不可控且通常很丑。
  * **解决方案：**
    1.  在插件包中**内置字体文件**（.woff2 格式），例如 `Inter` (英文) 和 `Noto Sans SC` (简体中文)。
    2.  在 `manifest.json` 的 `web_accessible_resources` 中声明这些字体文件。
    3.  在我们的海报预览 DOM 的 CSS 中，使用 `@font-face` 强制加载这些字体。
    4.  这样，`html2canvas` 渲染的就是我们指定的、美观的字体。

## 6\. 开发里程碑 (Milestones)

**M-01：核心功能 - 单条推文 (Sprint 1)**

  * [ ] 搭建 Manifest V3 + React + Vite + TS 项目框架。
  * [ ] 实现 `content-script` 注入“导出”按钮。
  * [ ] 实现 `scrapeTweetData` 函数，能抓取单条推文（包含引用推文）。
  * [ ] 实现 F-03 (Markdown 导出) - 仅限单条。
  * [ ] 实现 C-03 (字体方案)，搭建海报预览模态框。
  * [ ] 实现 F-04 (海报导出) - 仅限单条（含引用）。

**M-02：核心功能 - Thread (Sprint 2)**

  * [ ] 实现 C-01 (Thread 抓取) 逻辑。
  * [ ] 扩展 F-03 (Markdown 导出) 以支持 `TweetData[]` 数组，实现 Thread 导出。
  * [ ] 实现 F-01.2 和 F-01.3 (上下文菜单)，根据推文类型显示不同选项。

**M-03：抛光与测试 (Sprint 3)**

  * [ ] 完善所有错误处理（抓取失败、网络错误）。
  * [ ] 优化 `MutationObserver` 性能，减少卡顿。
  * [ ] 在 Chrome Web Store 发布 Beta 版。

-----

这份 PDD 涵盖了我们从需求到实现的所有关键路径。复杂度最高的部分在于 **C-01 (Thread 抓取)**，这将是我们的攻坚重点。
