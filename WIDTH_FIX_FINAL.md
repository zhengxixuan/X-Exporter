# 海报宽度最终修复

## 问题回顾

1. ✅ **圆角问题**: 已通过 Canvas 裁剪解决
2. ❌ **宽度问题**: 导出的海报宽度与预览不一致

## 根本原因分析

### 为什么宽度会不一致？

**可能原因 1: 容器宽度限制**
```html
<div class="x-exporter-poster-preview">  <!-- 容器 -->
  <article class="x-exporter-poster">    <!-- 海报: 360px -->
    ...
  </article>
</div>
```

如果容器宽度小于 360px，即使海报设置了 `width: 360px`，也可能被压缩。

**可能原因 2: 样式优先级不够**
```typescript
// 普通赋值，可能被其他样式覆盖
clonedElement.style.width = '360px';

// vs

// 使用 !important，优先级最高
clonedElement.style.setProperty('width', '360px', 'important');
```

**可能原因 3: viewport 单位影响**
如果有任何地方使用了 `max-width: 92vw` 这样的样式，在小屏幕上会限制宽度。

## 解决方案

### 1. 强制设置容器宽度

在 `onclone` 回调中，首先设置容器宽度：

```typescript
// Force wrapper width to prevent viewport unit constraints
const clonedWrapper = clonedDoc.querySelector('[data-x-exporter-poster-wrapper]') as HTMLElement;
if (clonedWrapper) {
  clonedWrapper.style.width = '600px';      // 足够容纳 360px 海报
  clonedWrapper.style.minWidth = '600px';
  clonedWrapper.style.maxWidth = 'none';    // 移除任何最大宽度限制
}
```

**为什么是 600px？**
- 海报宽度: 360px
- 额外空间: 240px (防止任何 padding/margin 影响)
- 600px 足够大，确保海报不会被压缩

### 2. 使用 `!important` 强制宽度

```typescript
// 使用 setProperty() 并带 'important' 标志
clonedElement.style.setProperty('width', `${POSTER_WIDTH}px`, 'important');
clonedElement.style.setProperty('max-width', `${POSTER_WIDTH}px`, 'important');
clonedElement.style.setProperty('min-width', `${POSTER_WIDTH}px`, 'important');
```

**对比普通赋值**:
```typescript
// ❌ 可能被其他样式覆盖
clonedElement.style.width = '360px';

// ✅ !important 优先级最高，不会被覆盖
clonedElement.style.setProperty('width', '360px', 'important');
```

### 3. 修复元素引用问题

之前的代码错误地使用了 `posterRef.current`，现在使用正确的元素引用：

```typescript
onclone: (clonedDoc, originalDoc) => {
  // ✅ 正确：从原始文档中查找元素
  const originalElement = originalDoc.querySelector('[data-x-exporter-poster-card]');

  // ❌ 错误：posterRef.current 在 onclone 中可能不可用
  // const originalElements = Array.from(posterRef.current!.querySelectorAll('*'));

  // ✅ 正确：从 originalElement 查找子元素
  const originalElements = Array.from(originalElement.querySelectorAll('*'));
}
```

## 样式优先级详解

CSS 样式优先级（从高到低）：

1. **内联样式 + !important**
   ```typescript
   element.style.setProperty('width', '360px', 'important');
   ```

2. **内联样式**
   ```typescript
   element.style.width = '360px';
   ```

3. **CSS 规则 + !important**
   ```css
   .x-exporter-poster {
     width: 360px !important;
   }
   ```

4. **CSS 规则**
   ```css
   .x-exporter-poster {
     width: 360px;
   }
   ```

我们的修复使用了最高优先级的方式 (#1)，确保宽度设置一定生效。

## 调试日志

添加了三个关键日志点：

### 日志 1: 预览元素尺寸
```typescript
const rect = posterRef.current.getBoundingClientRect();
console.log('Poster element dimensions before html2canvas:', {
  width: rect.width,
  height: rect.height,
  computedWidth: window.getComputedStyle(posterRef.current).width,
  computedMaxWidth: window.getComputedStyle(posterRef.current).maxWidth
});
```

**作用**: 查看预览时的实际渲染尺寸

### 日志 2: onclone 中的原始元素尺寸
```typescript
const originalRect = originalElement.getBoundingClientRect();
console.log('Original element in onclone:', {
  width: originalRect.width,
  height: originalRect.height,
  computedWidth: window.getComputedStyle(originalElement).width
});
```

**作用**: 查看 html2canvas 克隆前的元素尺寸

### 日志 3: 生成的 canvas 尺寸
```typescript
console.log('Raw canvas dimensions:', {
  width: rawCanvas.width,
  height: rawCanvas.height,
  expectedWidth: POSTER_WIDTH * 3,  // 1080
  widthMatch: rawCanvas.width === POSTER_WIDTH * 3
});
```

**作用**: 验证 html2canvas 生成的 canvas 是否为预期的 1080px 宽度

## 测试方法

1. **重新加载扩展**
   - 访问 `chrome://extensions/`
   - 找到 X-Exporter
   - 点击刷新按钮

2. **打开开发者工具**
   - 按 F12
   - 切换到 Console 标签

3. **导出海报**
   - 访问 Twitter/X
   - 点击推文的导出按钮
   - 选择"海报"
   - 点击"下载海报"

4. **查看日志**
   - 在 Console 中查看三个日志输出
   - 确认所有宽度都是 360px（或 1080px 对于 canvas）

5. **验证导出的图片**
   - 右键点击导出的 PNG 文件
   - 选择"属性"或"Get Info"
   - 查看图片尺寸
   - 宽度应该是 1080px (360px × 3)

## 预期结果

### 控制台日志
```
Poster element dimensions before html2canvas: {
  width: 360,
  height: XXX,
  computedWidth: "360px",
  computedMaxWidth: "none"
}

Original element in onclone: {
  width: 360,
  height: XXX,
  computedWidth: "360px"
}

Raw canvas dimensions: {
  width: 1080,
  height: XXX,
  expectedWidth: 1080,
  widthMatch: true  ← 这个应该是 true
}
```

### 导出的 PNG 文件
- **宽度**: 1080px (360px × scale 3)
- **高度**: 自适应（取决于内容）
- **圆角**: 24px × 3 = 72px
- **格式**: PNG

## 如果仍然有问题

如果宽度仍然不对，请提供：

1. **控制台日志截图或文本**
   - 三个日志的完整输出

2. **导出的图片属性**
   - 实际宽度和高度

3. **浏览器信息**
   - 浏览器类型和版本
   - 屏幕分辨率
   - 浏览器缩放比例（在地址栏右侧查看，通常是 100%）

4. **预览截图**
   - 海报预览模态框的截图

有了这些信息，我可以进一步诊断问题。

## 技术要点总结

1. **容器宽度**: 设置为 600px，确保足够容纳 360px 海报
2. **强制宽度**: 使用 `setProperty()` 并带 `'important'` 标志
3. **正确引用**: 使用 `originalDoc` 中的元素，而不是 `posterRef.current`
4. **圆角裁剪**: 使用 Canvas 2D API 的 `clip()` 方法
5. **调试日志**: 三个关键点的尺寸日志

## 修改文件

### `src/content/components/PosterModal.tsx`

**195-201 行**: 设置容器宽度
```typescript
const clonedWrapper = clonedDoc.querySelector('[data-x-exporter-poster-wrapper]') as HTMLElement;
if (clonedWrapper) {
  clonedWrapper.style.width = '600px';
  clonedWrapper.style.minWidth = '600px';
  clonedWrapper.style.maxWidth = 'none';
}
```

**204-206 行**: 强制设置宽度
```typescript
clonedElement.style.setProperty('width', `${POSTER_WIDTH}px`, 'important');
clonedElement.style.setProperty('max-width', `${POSTER_WIDTH}px`, 'important');
clonedElement.style.setProperty('min-width', `${POSTER_WIDTH}px`, 'important');
```

**267 行**: 正确的元素引用
```typescript
const originalElements = Array.from(originalElement.querySelectorAll('*'));
```

## 构建结果

✅ **TypeScript 类型检查**: 通过
✅ **构建**: 成功
✅ **包大小**: 266.43 KB

现在请重新加载扩展并测试海报导出功能！
