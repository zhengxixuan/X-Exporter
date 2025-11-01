# 代码重构后的修复

## 问题背景

代码被重构，将海报生成逻辑拆分为：
- `PosterCard.tsx` - 海报卡片组件
- `renderPosterImage.tsx` - 海报图片渲染工具函数

重构后，导出的海报变成了空白图片，且缺少了我们之前所有的修复。

## 发现的问题

### 1. 渲染逻辑丢失

原始的 `renderPosterImage.tsx`：

```typescript
// ❌ 错误：直接截图整个 container
const canvas = await html2canvas(container, {
  backgroundColor: wrapperStyles.backgroundColor || '#f5fbff',
  scale: 3,
  useCORS: true,
  logging: false
});
```

**问题**：
- 截图的是整个 container，不是 poster 卡片本身
- 没有应用任何样式强制设置
- 没有固定宽度
- 没有圆角裁剪
- 所有之前的修复都丢失了

### 2. 日期格式回退

`PosterCard.tsx` 使用了中文日期格式：

```typescript
// ❌ 错误：使用中文格式
{new Intl.DateTimeFormat('zh-CN', {
  dateStyle: 'medium',
  timeStyle: 'short'
}).format(new Date(tweet.timestamp))}
```

输出：`2023年12月4日 04:18`

我们之前修复为国际标准格式：`Dec 4, 2023 · 04:18`

## 修复方案

### 1. 恢复完整的渲染逻辑

在 `renderPosterImage.tsx` 中重新实现所有修复：

```typescript
export async function renderPosterImage({
  tweet,
  qrDataUrl,
  resolvedImages,
  statsLine
}: RenderPosterOptions): Promise<HTMLCanvasElement> {
  // 1. 加载字体
  await ensureFontsLoaded();
  if (document.fonts && 'ready' in document.fonts) {
    await document.fonts.ready;
  }

  // 2. 创建离屏容器
  const container = document.createElement('div');
  container.className = 'x-exporter-poster-preview';
  container.setAttribute('data-x-exporter-poster-wrapper', '');
  container.style.position = 'fixed';
  container.style.top = '-10000px';
  container.style.left = '-10000px';
  container.style.opacity = '0';
  container.style.pointerEvents = 'none';
  document.body.appendChild(container);

  // 3. 渲染 React 组件
  const root = createRoot(container);
  await new Promise<void>((resolve) => {
    root.render(
      <PosterCard
        tweet={tweet}
        qrDataUrl={qrDataUrl}
        resolvedImages={resolvedImages}
        imagesLoading={false}
        statsLine={statsLine}
      />
    );
    requestAnimationFrame(() => resolve());
  });

  // 4. 等待图片加载
  await waitForImages(container);
  await new Promise(resolve => setTimeout(resolve, 300));

  // 5. 找到海报卡片元素（关键！）
  const posterElement = container.querySelector('[data-x-exporter-poster-card]') as HTMLElement;
  if (!posterElement) {
    throw new Error('Poster card element not found');
  }

  // 6. 固定宽度常量
  const POSTER_WIDTH = 360;

  // 7. 使用 html2canvas 生成原始 canvas
  const rawCanvas = await html2canvas(posterElement, {
    backgroundColor: '#ffffff',
    scale: 3,
    useCORS: true,
    allowTaint: true,
    logging: false,
    x: 0,
    y: 0,
    scrollX: 0,
    scrollY: 0,
    onclone: (clonedDoc) => {
      // 强制应用所有样式（之前的修复）
      const clonedElement = clonedDoc.querySelector('[data-x-exporter-poster-card]') as HTMLElement;
      if (!clonedElement) return;

      // 硬编码关键样式
      clonedElement.style.width = `${POSTER_WIDTH}px`;
      clonedElement.style.maxWidth = `${POSTER_WIDTH}px`;
      clonedElement.style.minWidth = `${POSTER_WIDTH}px`;
      clonedElement.style.height = 'auto';
      clonedElement.style.padding = '24px 20px';
      // ... 更多样式

      // 复制子元素样式，过滤 viewport 单位
      const applyStyles = (original: HTMLElement, cloned: HTMLElement) => {
        // ... 样式复制逻辑
      };

      // 递归应用
      originalElements.forEach((original, index) => {
        applyStyles(original, clonedElements[index]);
      });
    }
  });

  // 8. 应用圆角裁剪
  const canvas = document.createElement('canvas');
  canvas.width = rawCanvas.width;
  canvas.height = rawCanvas.height;
  const ctx = canvas.getContext('2d')!;

  const borderRadius = 24 * 3;
  ctx.beginPath();
  // ... 绘制圆角路径
  ctx.clip();
  ctx.drawImage(rawCanvas, 0, 0);

  // 9. 清理
  root.unmount();
  document.body.removeChild(container);

  return canvas;
}
```

**关键改进**：
1. ✅ 找到正确的 poster 元素（`[data-x-exporter-poster-card]`）
2. ✅ 使用 html2canvas 的 onclone 回调强制应用样式
3. ✅ 硬编码所有关键样式值（360px 宽度、padding、gap 等）
4. ✅ 过滤 viewport 单位（避免 `max-width: 92vw` 问题）
5. ✅ 应用圆角裁剪（Canvas 2D API）
6. ✅ 等待 300ms 确保渲染完成

### 2. 修复日期格式

在 `PosterCard.tsx` 中使用国际标准格式：

```typescript
<p className="x-exporter-poster__time">
  {(() => {
    try {
      const date = new Date(tweet.timestamp);
      const dateStr = new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(date);
      const timeStr = new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(date);
      return `${dateStr} · ${timeStr}`;
    } catch (error) {
      return tweet.timestamp;
    }
  })()}
</p>
```

**输出**：`Dec 4, 2023 · 04:18`

## 修改文件

### 1. `src/content/utils/renderPosterImage.tsx`

**完全重写**，添加了所有之前的修复：
- 固定宽度控制（360px）
- 完整的样式复制系统（30+ 属性）
- viewport 单位过滤
- 圆角裁剪
- 300ms 渲染延迟
- 正确的元素选择（poster card）

### 2. `src/content/components/PosterCard.tsx`

修改日期格式：
- 从 `zh-CN` 改为 `en-US`
- 使用标准格式：`Dec 4, 2023 · 04:18`

## 技术要点

### 离屏渲染技术

```typescript
// 创建离屏容器
const container = document.createElement('div');
container.style.position = 'fixed';
container.style.top = '-10000px';  // 移出视口
container.style.left = '-10000px';
container.style.opacity = '0';      // 完全透明
container.style.pointerEvents = 'none';  // 不响应交互
document.body.appendChild(container);

// 渲染 React 组件到离屏容器
const root = createRoot(container);
root.render(<PosterCard ... />);

// 使用完后清理
root.unmount();
document.body.removeChild(container);
```

**优点**：
- ✅ 不影响页面可见内容
- ✅ 可以使用完整的 DOM API
- ✅ 样式计算准确
- ✅ html2canvas 能正确工作

### React 18 并发渲染

```typescript
await new Promise<void>((resolve) => {
  root.render(<Component />);
  requestAnimationFrame(() => resolve());
});
```

**原因**：
- React 18 使用并发渲染
- 渲染不是立即完成的
- 需要等待下一帧确保渲染完成

### 正确的元素选择

```typescript
// ❌ 错误：截图整个容器
const canvas = await html2canvas(container, {...});

// ✅ 正确：找到海报卡片元素
const posterElement = container.querySelector('[data-x-exporter-poster-card]');
const canvas = await html2canvas(posterElement, {...});
```

**原因**：
- container 可能有额外的包装层
- posterElement 是实际的海报卡片
- 截图正确的元素才能得到正确的结果

## 验证结果

✅ **TypeScript 类型检查**：通过
✅ **构建测试**：成功
✅ **包大小**：266.89 KB（增加约 1KB，因为重复的样式应用逻辑）

## 为什么会出现空白图片？

原始代码的问题：

```typescript
// 1. 截图了错误的元素
const canvas = await html2canvas(container, {...});

// 2. container 可能包含空的包装 div
<div className="x-exporter-poster-preview">
  <PosterCard ... />  <!-- 这才是真正的内容 -->
</div>

// 3. 没有等待足够的渲染时间
// 4. 没有应用任何样式强制设置
```

**结果**：截图到了空的或不完整的内容。

## 重构建议

如果将来再次重构，建议：

1. **保留核心渲染逻辑**
   - 不要简化 html2canvas 的配置
   - 保留所有 onclone 回调逻辑
   - 保留圆角裁剪代码

2. **使用常量管理样式**
   ```typescript
   const POSTER_STYLES = {
     WIDTH: 360,
     PADDING: '24px 20px',
     GAP: '20px',
     // ...
   } as const;
   ```

3. **添加完整的测试**
   - 测试导出的图片尺寸
   - 测试圆角是否存在
   - 测试日期格式
   - 测试宽度一致性

4. **文档化关键逻辑**
   - 为什么需要 300ms 延迟
   - 为什么要过滤 viewport 单位
   - 为什么要硬编码样式值

## 总结

重构虽然提高了代码组织性，但不小心移除了所有关键的修复。通过这次修复：

1. ✅ 恢复了所有之前的修复
2. ✅ 保持了重构后的代码结构
3. ✅ 将修复逻辑正确地应用到新的架构中

**关键教训**：
- 重构前要充分理解每一行代码的作用
- 不要删除看起来"冗余"的代码（可能是关键修复）
- 重构后要进行完整的功能测试

现在海报导出功能应该恢复正常了！
