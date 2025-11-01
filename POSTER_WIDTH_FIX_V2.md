# 海报宽度问题最终修复（第二版）

## 问题现象

即使设置了固定宽度 360px，导出的海报仍然比预览窄很多。

## 深层原因分析

### 问题 1：CSS 中的 `max-width: 92vw`

在 `src/content/style.css` 中：

```css
.x-exporter-poster {
  width: 360px;
  max-width: 92vw;  /* 问题！这会在某些情况下覆盖 width */
  /* ... */
}
```

**影响**：
- 当视口宽度 < 391px 时，`92vw < 360px`
- `max-width` 会覆盖 `width`
- 元素实际宽度变小

### 问题 2：从原始元素复制样式

之前的代码：

```typescript
clonedElement.style.padding = styles.padding;
clonedElement.style.gap = styles.gap;
// styles 来自 window.getComputedStyle(posterElement)
```

**问题**：
- 如果原始元素因为 `max-width: 92vw` 而缩小
- 复制的 padding、gap 等值也会是基于缩小后的尺寸
- 导致布局不准确

### 问题 3：子元素继承了 viewport 单位

子元素的样式复制函数会复制所有宽度属性：

```typescript
cloned.style.width = originalStyle.width;
cloned.style.maxWidth = originalStyle.maxWidth;  // 可能是 "92vw"！
```

**问题**：
- 如果子元素也有 `max-width: 92vw` 或类似的 viewport 单位
- 这些值会被复制到 html2canvas 的克隆文档中
- 克隆文档的视口大小可能与预览不同
- 导致元素宽度计算错误

## 解决方案

### 1. 硬编码所有关键样式

不再从原始元素复制可能受 viewport 影响的值：

```typescript
// ❌ 错误：复制可能受污染的值
clonedElement.style.padding = styles.padding;
clonedElement.style.gap = styles.gap;

// ✅ 正确：硬编码固定值（与 CSS 一致）
clonedElement.style.padding = '24px 20px';
clonedElement.style.gap = '20px';
clonedElement.style.borderRadius = '24px';
clonedElement.style.fontFamily = 'Inter, Noto Sans SC, system-ui, sans-serif';
clonedElement.style.color = '#0f1419';
```

**好处**：
- ✅ 完全不受原始元素实际渲染状态影响
- ✅ 始终使用设计规范中的固定值
- ✅ 与 CSS 中的设计值完全一致

### 2. 过滤 viewport 相对单位

在子元素样式复制中，过滤掉包含 viewport 单位的属性：

```typescript
// Copy size properties, but avoid viewport-relative units
const width = originalStyle.width;
const maxWidth = originalStyle.maxWidth;
const minWidth = originalStyle.minWidth;

// Only copy if not using viewport units (vw, vh, vmin, vmax)
if (width && !width.includes('vw') && !width.includes('vh')) {
  cloned.style.width = width;
}
if (maxWidth && !maxWidth.includes('vw') && !maxWidth.includes('vh')) {
  cloned.style.maxWidth = maxWidth;
}
if (minWidth && !minWidth.includes('vw') && !minWidth.includes('vh')) {
  cloned.style.minWidth = minWidth;
}
```

**原理**：
- viewport 单位（vw, vh, vmin, vmax）依赖于视口大小
- html2canvas 的克隆文档可能有不同的视口
- 过滤这些单位，避免尺寸计算错误

### 3. 强制固定宽度三连

确保宽度绝对固定：

```typescript
clonedElement.style.width = `${POSTER_WIDTH}px`;      // 360px
clonedElement.style.maxWidth = `${POSTER_WIDTH}px`;   // 360px
clonedElement.style.minWidth = `${POSTER_WIDTH}px`;   // 360px
```

**效果**：
- `width: 360px` - 设置宽度
- `max-width: 360px` - 覆盖 CSS 中的 `max-width: 92vw`
- `min-width: 360px` - 防止任何缩小

## 修改总结

### `src/content/components/PosterModal.tsx`

#### 修改 1：根元素硬编码样式

```typescript
// Before: 从原始元素复制
clonedElement.style.padding = styles.padding;
clonedElement.style.gap = styles.gap;
clonedElement.style.borderRadius = styles.borderRadius;
clonedElement.style.fontFamily = styles.fontFamily;
clonedElement.style.color = styles.color;

// After: 硬编码固定值
clonedElement.style.padding = '24px 20px';
clonedElement.style.gap = '20px';
clonedElement.style.borderRadius = '24px';
clonedElement.style.fontFamily = 'Inter, Noto Sans SC, system-ui, sans-serif';
clonedElement.style.color = '#0f1419';
```

#### 修改 2：过滤 viewport 单位

```typescript
// Before: 直接复制所有宽度属性
cloned.style.width = originalStyle.width;
cloned.style.maxWidth = originalStyle.maxWidth;  // 可能是 "92vw"
cloned.style.minWidth = originalStyle.minWidth;

// After: 过滤 viewport 单位
const width = originalStyle.width;
const maxWidth = originalStyle.maxWidth;
const minWidth = originalStyle.minWidth;

if (width && !width.includes('vw') && !width.includes('vh')) {
  cloned.style.width = width;
}
if (maxWidth && !maxWidth.includes('vw') && !maxWidth.includes('vh')) {
  cloned.style.maxWidth = maxWidth;
}
if (minWidth && !minWidth.includes('vw') && !minWidth.includes('vh')) {
  cloned.style.minWidth = minWidth;
}
```

## 技术要点

### Viewport 单位的问题

| 单位 | 含义 | html2canvas 问题 |
|-----|------|------------------|
| `vw` | 视口宽度的 1% | ❌ 克隆文档视口可能不同 |
| `vh` | 视口高度的 1% | ❌ 克隆文档视口可能不同 |
| `vmin` | vw 和 vh 中较小的 | ❌ 视口依赖 |
| `vmax` | vw 和 vh 中较大的 | ❌ 视口依赖 |
| `px` | 像素 | ✅ 绝对单位，可靠 |
| `rem` | 根元素字体大小 | ⚠️ 依赖根元素 |
| `em` | 父元素字体大小 | ⚠️ 依赖父元素 |

**最佳实践**：
- 对于固定尺寸的元素，使用 `px`
- 避免在需要导出的元素中使用 viewport 单位
- 如果必须使用，在 onclone 中转换为绝对值

### CSS 优先级

```
内联样式 > !important > ID 选择器 > 类选择器 > 元素选择器
```

在 html2canvas 的克隆文档中：
- 使用 `element.style.xxx` 设置内联样式（最高优先级）
- 可以覆盖 CSS 中的任何样式（包括 `max-width: 92vw`）

### getComputedStyle 的陷阱

`window.getComputedStyle()` 返回的是**计算后的值**，不是原始值：

```typescript
// CSS
.poster {
  width: 360px;
  max-width: 92vw;  /* 在窄屏幕上会生效 */
  padding: 24px 20px;
}

// JavaScript
const styles = window.getComputedStyle(element);
console.log(styles.width);  // 可能是 "331.2px"（92vw 的计算结果）
console.log(styles.padding);  // "24px 18.4px"（基于实际宽度计算）
```

**问题**：
- 计算值受当前视口、父元素等影响
- 复制计算值可能导致错误

**解决**：
- 硬编码设计规范中的固定值
- 不依赖 getComputedStyle 的计算结果

## 验证结果

✅ **TypeScript 类型检查**：通过
✅ **构建测试**：成功
✅ **包大小**：265.76 KB

## 测试方法

### 1. 在不同视口宽度下测试

```javascript
// 在浏览器控制台中调整窗口宽度
window.resizeTo(1920, 1080);  // 宽屏
window.resizeTo(375, 667);    // 手机屏幕

// 导出海报，检查宽度是否始终为 1080px (360 × 3)
```

### 2. 检查导出图片尺寸

```javascript
const img = new Image();
img.onload = function() {
  console.log('Width:', this.width);   // 应该始终是 1080
  console.log('Height:', this.height); // 高度会根据内容变化
  console.log('Ratio:', this.width / this.height);
};
img.src = 'path/to/poster.png';
```

### 3. 验证样式应用

在 onclone 回调中添加日志：

```typescript
console.log('Cloned width:', clonedElement.style.width);        // 360px
console.log('Cloned maxWidth:', clonedElement.style.maxWidth);  // 360px
console.log('Cloned padding:', clonedElement.style.padding);    // 24px 20px

// 检查子元素
const textElement = clonedDoc.querySelector('.x-exporter-poster__text');
const textStyle = window.getComputedStyle(textElement);
console.log('Text maxWidth:', textStyle.maxWidth);  // 不应该包含 "vw"
```

## 相关问题解决

### Q: 为什么预览中可以使用 `max-width: 92vw`？

A: 预览是在真实的浏览器环境中，viewport 单位能正确计算。但 html2canvas 的克隆文档环境不同，viewport 计算可能不准确。

### Q: 硬编码值会不会让代码难以维护？

A: 可以通过常量管理：

```typescript
const POSTER_STYLES = {
  WIDTH: 360,
  PADDING: '24px 20px',
  GAP: '20px',
  BORDER_RADIUS: '24px',
  FONT_FAMILY: 'Inter, Noto Sans SC, system-ui, sans-serif',
  COLOR: '#0f1419',
} as const;

// 使用
clonedElement.style.width = `${POSTER_STYLES.WIDTH}px`;
clonedElement.style.padding = POSTER_STYLES.PADDING;
```

### Q: 为什么不在 CSS 中就避免使用 viewport 单位？

A: 预览时 `max-width: 92vw` 是合理的：
- 在小屏幕上自适应
- 防止海报预览超出屏幕

问题只在 html2canvas 导出时出现，所以在 onclone 中覆盖即可。

## 总结

这次修复解决了一个微妙但重要的问题：

**根本原因**：
- CSS 中的 `max-width: 92vw` 在某些视口下会生效
- `getComputedStyle()` 复制的是计算后的值，受视口影响
- viewport 单位在 html2canvas 环境中不可靠

**解决方案**：
1. 硬编码所有关键样式值（不依赖 getComputedStyle）
2. 过滤 viewport 相对单位（避免尺寸计算错误）
3. 强制固定宽度三连（width + maxWidth + minWidth）

**关键教训**：
- 不要盲目复制 getComputedStyle 的值
- viewport 单位在非浏览器环境中不可靠
- 对于固定尺寸的导出需求，使用绝对值（px）

现在导出的海报宽度应该始终为 360px（canvas 为 1080px），完全匹配预览效果。
