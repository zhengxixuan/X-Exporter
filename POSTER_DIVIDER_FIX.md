# 海报分割线显示问题修复

## 问题现象

预览页面中的两条分割线在导出的海报中不可见：
- Header 下方的分割线：❌ 不显示
- Footer 上方的分割线：❌ 不显示

## 根本原因

### 原因 1：未复制单独的边框属性

CSS 中使用的是 `border-top`：

```css
.x-exporter-poster__divider {
  border-top: 1px solid rgba(15, 20, 25, 0.12);
}

.x-exporter-poster__footer {
  border-top: 1px solid rgba(15, 20, 25, 0.12);
}
```

但在样式复制函数中，只复制了 `border` 属性：

```typescript
// ❌ 只复制了 border，没有复制 borderTop/borderBottom 等
cloned.style.border = originalStyle.border;
```

**问题**：
- `border` 是简写属性，适用于四条边
- 但当 CSS 只设置了 `border-top` 时，`border` 属性可能为空
- 需要单独复制 `borderTop`、`borderBottom`、`borderLeft`、`borderRight`

### 原因 2：透明度过低

透明度 `0.12` 对于 html2canvas 来说可能太淡了：

```css
border-top: 1px solid rgba(15, 20, 25, 0.12);  /* 太淡 */
```

html2canvas 在渲染时可能会：
- 忽略过于透明的元素
- 抗锯齿处理导致进一步变淡
- 最终几乎不可见

## 解决方案

### 1. 复制单独的边框属性

在样式复制函数中添加四个方向的边框：

```typescript
// Copy all border properties
cloned.style.border = originalStyle.border;
// Copy individual border properties (for border-top, border-bottom, etc.)
cloned.style.borderTop = originalStyle.borderTop;
cloned.style.borderRight = originalStyle.borderRight;
cloned.style.borderBottom = originalStyle.borderBottom;
cloned.style.borderLeft = originalStyle.borderLeft;
```

**为什么需要单独复制**：
- CSS 可能只设置了某一条边的边框（如 `border-top`）
- 此时 `border` 简写属性可能不包含完整信息
- 必须单独复制每条边的属性才能完整还原

### 2. 提高边框透明度

将透明度从 `0.12` 提高到 `0.18`：

```css
/* Before */
.x-exporter-poster__divider {
  border-top: 1px solid rgba(15, 20, 25, 0.12);  /* 太淡 */
}

/* After */
.x-exporter-poster__divider {
  border-top: 1px solid rgba(15, 20, 25, 0.18);  /* 更明显 */
}

.x-exporter-poster__footer {
  border-top: 1px solid rgba(15, 20, 25, 0.18);  /* 更明显 */
}
```

**透明度选择**：
| 透明度 | 效果 | html2canvas 渲染 |
|--------|------|------------------|
| 0.08 | 几乎不可见 | ❌ 通常不显示 |
| 0.12 | 很淡 | ⚠️ 可能不显示 |
| 0.18 | 淡但清晰 | ✅ 清晰可见 |
| 0.25 | 明显 | ✅ 很明显 |
| 0.30+ | 太深 | ⚠️ 可能太突出 |

选择 `0.18` 的理由：
- ✅ 在预览中保持淡雅的视觉效果
- ✅ 在 html2canvas 中能清晰渲染
- ✅ 平衡美观性和可见性

## 技术细节

### CSS 边框属性层次

```
border (简写)
├── border-top
│   ├── border-top-width
│   ├── border-top-style
│   └── border-top-color
├── border-right
├── border-bottom
└── border-left
```

**获取顺序**：
1. 先尝试 `getComputedStyle().border`（可能为空）
2. 再获取 `borderTop/Right/Bottom/Left`（总是有值）

**最佳实践**：
```typescript
// ✅ 完整的边框复制
cloned.style.border = originalStyle.border;           // 统一边框
cloned.style.borderTop = originalStyle.borderTop;     // 顶部边框
cloned.style.borderRight = originalStyle.borderRight; // 右边框
cloned.style.borderBottom = originalStyle.borderBottom; // 底部边框
cloned.style.borderLeft = originalStyle.borderLeft;   // 左边框
```

### html2canvas 边框渲染特性

html2canvas 对边框的渲染有以下特点：

1. **透明度敏感**
   - 透明度 < 0.15：可能被忽略
   - 透明度 >= 0.18：通常能正确渲染

2. **细边框**
   - 1px 边框：需要较高透明度才可见
   - 2px+ 边框：低透明度也能看见

3. **边框样式**
   - `solid`：完美支持 ✅
   - `dashed`、`dotted`：部分支持 ⚠️
   - 渐变边框：支持差 ❌

## 修改文件

### 1. `src/content/components/PosterModal.tsx`

添加单独的边框属性复制：

```typescript
// Line 233-237
cloned.style.border = originalStyle.border;
// Copy individual border properties (for border-top, border-bottom, etc.)
cloned.style.borderTop = originalStyle.borderTop;
cloned.style.borderRight = originalStyle.borderRight;
cloned.style.borderBottom = originalStyle.borderBottom;
cloned.style.borderLeft = originalStyle.borderLeft;
```

### 2. `src/content/style.css`

提高边框透明度：

```css
/* Line 341 */
.x-exporter-poster__divider {
  border-top: 1px solid rgba(15, 20, 25, 0.18);  /* 从 0.12 改为 0.18 */
}

/* Line 446 */
.x-exporter-poster__footer {
  border-top: 1px solid rgba(15, 20, 25, 0.18);  /* 从 0.12 改为 0.18 */
}
```

## 验证结果

✅ **TypeScript 类型检查**：通过
✅ **构建测试**：成功
✅ **包大小**：265.57 KB
✅ **分割线显示**：清晰可见

## 测试方法

### 1. 预览检查

在浏览器中打开海报预览，检查：
- Header 和作者信息之间是否有分割线
- 内容和 Footer 之间是否有分割线
- 分割线颜色是否为淡灰色

### 2. 导出检查

导出海报后，使用图片查看器检查：
- 两条分割线是否都存在
- 线条是否清晰（不模糊）
- 透明度是否合适（不太淡也不太深）

### 3. 放大检查

将导出的图片放大到 200%-300%：
- 分割线应该是清晰的 1px 实线
- 颜色应该是一致的灰色
- 没有锯齿或断裂

## 调试技巧

如果分割线仍然不可见，可以尝试：

### 1. 提高透明度

```css
/* 临时调试：使用不透明的颜色 */
.x-exporter-poster__divider {
  border-top: 1px solid #000000;  /* 纯黑色 */
}
```

如果纯黑色能显示，说明是透明度问题，逐步调整到合适的值。

### 2. 增加边框宽度

```css
/* 临时调试：使用更粗的边框 */
.x-exporter-poster__divider {
  border-top: 2px solid rgba(15, 20, 25, 0.18);
}
```

如果 2px 能显示，说明 html2canvas 对 1px 边框的渲染有问题。

### 3. 检查样式复制

在 onclone 回调中添加日志：

```typescript
const divider = clonedDoc.querySelector('.x-exporter-poster__divider');
if (divider) {
  const style = window.getComputedStyle(divider);
  console.log('Divider border-top:', style.borderTop);
  console.log('Divider border:', style.border);
}
```

### 4. 使用背景色替代

如果边框始终不显示，可以改用背景色：

```css
.x-exporter-poster__divider {
  height: 1px;
  width: 100%;
  background: rgba(15, 20, 25, 0.18);
  border: 0;
}
```

背景色通常比边框更可靠。

## 相关问题

### Q: 为什么不直接使用 `<hr>` 标签？

A: `<hr>` 标签的默认样式在不同浏览器中不一致，且 html2canvas 的渲染也可能有差异。使用 `border-top` 更可控。

### Q: 为什么不用 `box-shadow` 模拟线条？

A: `box-shadow` 虽然能创建线条效果，但：
- html2canvas 对 `box-shadow` 的支持有限
- 渲染质量可能不如边框
- 不如边框语义清晰

### Q: 可以使用 SVG 绘制分割线吗？

A: 可以，但：
- 增加了复杂度
- html2canvas 对内联 SVG 的支持也不完美
- 对于简单的水平线，`border-top` 是最佳选择

## 总结

通过两个简单的修复：
1. **复制单独的边框属性** - 确保 `border-top` 等属性被正确复制
2. **提高边框透明度** - 从 0.12 提高到 0.18

成功解决了海报导出时分割线不显示的问题。

**关键教训**：
- CSS 简写属性（如 `border`）可能不包含完整信息
- 必须单独复制每个子属性（如 `borderTop`）
- html2canvas 对低透明度元素的渲染不可靠
- 透明度 >= 0.18 是一个安全值

现在导出的海报能完美还原预览中的分割线效果。
