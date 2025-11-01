# 回退到重构前的方案

## 变更说明

用户要求回退到重构前的工作版本,使用 html2canvas 直接导出 PNG,而不是使用 Canvas 2D API 手动绘制。

## 主要变更

### 1. 整合代码到 `PosterModal.tsx`

**删除的文件**:
- `src/content/components/PosterCard.tsx`
- `src/content/utils/renderPosterImage.tsx`

**原因**: 重构前所有逻辑都在一个文件中,更简单直接。

### 2. 使用 `useRef` 直接引用海报元素

```typescript
const posterRef = useRef<HTMLElement>(null);

// 在 JSX 中:
<article ref={posterRef} className="x-exporter-poster" data-x-exporter-poster-card>
  {/* 海报内容 */}
</article>
```

### 3. `handleDownload` 函数简化

直接对 `posterRef.current` 使用 html2canvas:

```typescript
const canvas = await html2canvas(posterRef.current, {
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
    // 强制应用所有样式
  }
});
```

### 4. 保留所有关键修复

虽然回退到重构前的架构,但保留了所有之前的修复:

✅ **固定宽度** (360px)
```typescript
clonedElement.style.width = `${POSTER_WIDTH}px`;
clonedElement.style.maxWidth = `${POSTER_WIDTH}px`;
clonedElement.style.minWidth = `${POSTER_WIDTH}px`;
```

✅ **高度自适应**
```typescript
clonedElement.style.height = 'auto';
```

✅ **视觉样式**
```typescript
clonedElement.style.border = '1px solid rgba(15, 20, 25, 0.05)';
clonedElement.style.boxShadow = '0 20px 40px rgba(15, 20, 25, 0.18)';
clonedElement.style.backgroundImage = 'linear-gradient(180deg, rgba(249, 250, 252, 0.9) 0%, #ffffff 24%)';
clonedElement.style.borderRadius = '24px';
```

✅ **完整的样式复制**
- 30+ CSS 属性
- 过滤 viewport 单位 (vw/vh)
- 单独的 border 属性 (borderTop, borderRight, borderBottom, borderLeft)

✅ **日期格式**
```typescript
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
```
输出: `Dec 4, 2023 · 04:18`

## 移除的代码

### Canvas 手动绘制方案

移除了以下代码:
- 阴影手动绘制 (ctx.shadowColor/shadowBlur)
- 渐变背景手动绘制 (ctx.createLinearGradient)
- 边框手动绘制 (ctx.strokeStyle)
- 圆角手动绘制和裁剪 (ctx.quadraticCurveTo + ctx.clip)
- 离屏渲染容器创建
- React createRoot 管理

**原因**: 这些方案过于复杂,而 html2canvas 的默认行为已经足够好。

## 架构对比

### 重构后 (已移除)
```
PosterModal.tsx
  ├─ PosterCard.tsx (独立组件)
  └─ renderPosterImage.tsx (工具函数)
      ├─ 离屏渲染
      ├─ React createRoot
      ├─ html2canvas 生成原始 canvas
      └─ Canvas 2D API 手动绘制效果
```

### 重构前 (当前)
```
PosterModal.tsx
  ├─ 直接渲染海报内容 (JSX)
  ├─ useRef 引用海报元素
  └─ html2canvas 直接导出
      └─ onclone 强制应用样式
```

## 优势

1. **简单**: 所有代码在一个文件中
2. **直接**: 直接引用 DOM 元素,无需创建离屏容器
3. **可靠**: html2canvas 的 onclone 已经过验证
4. **轻量**: 包大小减少约 3KB (267.96 KB → 265.05 KB)

## html2canvas 配置说明

### 基础配置
```typescript
{
  backgroundColor: '#ffffff',  // 白色背景
  scale: 3,                    // 3倍分辨率 (360px → 1080px)
  useCORS: true,               // 支持跨域图片
  allowTaint: true,            // 允许跨域污染 canvas
  logging: false,              // 关闭日志
  x: 0, y: 0,                  // 从元素左上角开始
  scrollX: 0, scrollY: 0       // 不考虑滚动偏移
}
```

### onclone 回调
```typescript
onclone: (clonedDoc) => {
  const clonedElement = clonedDoc.querySelector('[data-x-exporter-poster-card]');

  // 1. 强制固定宽度
  clonedElement.style.width = `${POSTER_WIDTH}px`;
  clonedElement.style.maxWidth = `${POSTER_WIDTH}px`;
  clonedElement.style.minWidth = `${POSTER_WIDTH}px`;

  // 2. 高度自适应
  clonedElement.style.height = 'auto';

  // 3. 视觉装饰
  clonedElement.style.borderRadius = '24px';
  clonedElement.style.border = '1px solid rgba(15, 20, 25, 0.05)';
  clonedElement.style.boxShadow = '0 20px 40px rgba(15, 20, 25, 0.18)';
  clonedElement.style.backgroundImage = 'linear-gradient(...)';

  // 4. 复制所有子元素样式
  applyStyles(original, cloned);
}
```

## 已知限制

### html2canvas 的局限性

1. **圆角**: 虽然设置了 `borderRadius: '24px'`,但 canvas 本身是矩形的,所以导出的 PNG 会有直角
2. **阴影**: `box-shadow` 可能渲染不完美,效果可能比 CSS 预览略淡
3. **渐变**: `background-image: linear-gradient()` 可能略有色差

### 为什么接受这些限制?

相比 Canvas 手动绘制的复杂性和维护成本,这些细微的视觉差异是可以接受的:
- 用户主要关注内容,而非像素级完美
- html2canvas 方案已经被广泛验证
- 代码更简单,更容易维护

## 测试

✅ **TypeScript 类型检查**: 通过
✅ **构建**: 成功
✅ **包大小**: 265.05 KB

## 后续改进建议

如果将来需要完美的圆角,可以考虑:

1. **后处理裁剪**: 导出后用 Canvas API 裁剪成圆角
2. **SVG 滤镜**: 使用 SVG filter 应用圆角
3. **服务端处理**: 使用 Node.js + Puppeteer 生成完美海报

但目前 html2canvas 直接导出已经满足需求。

## 总结

回退到重构前的方案,保留所有关键修复,移除过度复杂的 Canvas 手动绘制代码。

**核心原则**: Keep it simple, stupid (KISS)
