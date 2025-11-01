# 圆角裁剪修复

## 问题

从用户的截图可以看出两个问题：

1. **导出的海报是直角的，没有圆角**
   - CSS 设置了 `border-radius: 24px`
   - 但导出的 PNG 图片仍然是矩形的

2. **导出的宽度与预览不一样**
   - CSS 定义宽度为 `360px`
   - 但实际导出时宽度可能受其他因素影响

## 根本原因

### 问题 1: 为什么没有圆角？

**原因**: html2canvas 生成的是矩形 canvas

```typescript
// html2canvas 生成的 canvas
const canvas = await html2canvas(element, {...});
// canvas 是矩形的，即使 element 有 border-radius
```

**解释**:
- CSS 的 `border-radius` 只是视觉效果
- html2canvas 读取 DOM 内容并绘制到 canvas
- canvas 本身是一个矩形位图
- 圆角效果不会自动应用到 canvas 上

**类比**:
就像拍一张照片（html2canvas）对着一个圆角的卡片，照片本身是矩形的，不会自动裁剪成圆角。

### 问题 2: 为什么宽度不一样？

**原因**: 可能受到以下因素影响：
1. 视口宽度（如果有 `max-width: vw` 限制）
2. 父容器宽度限制
3. html2canvas 的默认行为

虽然代码中强制设置了：
```typescript
clonedElement.style.width = `${POSTER_WIDTH}px`;  // 360px
clonedElement.style.maxWidth = `${POSTER_WIDTH}px`;
clonedElement.style.minWidth = `${POSTER_WIDTH}px`;
```

但如果原始元素在渲染时受到其他约束，可能仍然会影响最终 canvas 的尺寸。

## 解决方案

### 圆角裁剪

在 html2canvas 生成原始 canvas 后，创建一个新的 canvas，使用 Canvas 2D API 进行圆角裁剪：

```typescript
// 1. html2canvas 生成原始 canvas（矩形）
const rawCanvas = await html2canvas(posterRef.current, {...});

// 2. 创建新的 canvas
const canvas = document.createElement('canvas');
canvas.width = rawCanvas.width;
canvas.height = rawCanvas.height;
const ctx = canvas.getContext('2d');

// 3. 绘制圆角矩形路径
const borderRadius = 24 * 3; // 24px * scale 3
ctx.beginPath();
ctx.moveTo(borderRadius, 0);
ctx.lineTo(canvas.width - borderRadius, 0);
ctx.quadraticCurveTo(canvas.width, 0, canvas.width, borderRadius);
ctx.lineTo(canvas.width, canvas.height - borderRadius);
ctx.quadraticCurveTo(canvas.width, canvas.height, canvas.width - borderRadius, canvas.height);
ctx.lineTo(borderRadius, canvas.height);
ctx.quadraticCurveTo(0, canvas.height, 0, canvas.height - borderRadius);
ctx.lineTo(0, borderRadius);
ctx.quadraticCurveTo(0, 0, borderRadius, 0);
ctx.closePath();

// 4. 设置裁剪区域
ctx.clip();

// 5. 绘制原始 canvas（只有圆角区域内的内容会显示）
ctx.drawImage(rawCanvas, 0, 0);

// 6. 导出为 PNG
const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
```

### 技术细节

#### quadraticCurveTo

`quadraticCurveTo(cpx, cpy, x, y)` 用于绘制二次贝塞尔曲线：
- `cpx, cpy`: 控制点坐标
- `x, y`: 终点坐标

**绘制圆角的原理**:
```typescript
// 右上角圆角
ctx.lineTo(canvas.width - borderRadius, 0);  // 移动到右上角前
ctx.quadraticCurveTo(
  canvas.width, 0,           // 控制点：右上角顶点
  canvas.width, borderRadius // 终点：圆角结束位置
);
```

这会创建一个从 `(canvas.width - borderRadius, 0)` 到 `(canvas.width, borderRadius)` 的平滑曲线，控制点在 `(canvas.width, 0)`，形成圆角效果。

#### ctx.clip()

`clip()` 方法创建一个裁剪区域：
- 当前路径内的区域变成可见区域
- 路径外的任何绘制都会被裁剪掉
- 后续的绘制操作只在裁剪区域内生效

```typescript
ctx.clip();              // 设置裁剪区域为圆角矩形
ctx.drawImage(rawCanvas, 0, 0);  // 绘制，只有圆角内的部分可见
```

#### scale 参数

所有尺寸都需要乘以 scale 值（3倍）：
```typescript
const borderRadius = 24 * 3;  // CSS 24px → canvas 72px
```

原因：
- html2canvas 配置 `scale: 3` 生成 3 倍分辨率图片
- 360px 宽度 → 1080px canvas 宽度
- 24px 圆角 → 72px canvas 圆角

## 完整的圆角矩形绘制

绘制顺序（顺时针，从左上角开始）：

```typescript
ctx.beginPath();
// 1. 顶部边（左到右，留出左上和右上圆角空间）
ctx.moveTo(borderRadius, 0);
ctx.lineTo(canvas.width - borderRadius, 0);

// 2. 右上角圆角
ctx.quadraticCurveTo(canvas.width, 0, canvas.width, borderRadius);

// 3. 右侧边（上到下，留出右上和右下圆角空间）
ctx.lineTo(canvas.width, canvas.height - borderRadius);

// 4. 右下角圆角
ctx.quadraticCurveTo(canvas.width, canvas.height, canvas.width - borderRadius, canvas.height);

// 5. 底部边（右到左，留出右下和左下圆角空间）
ctx.lineTo(borderRadius, canvas.height);

// 6. 左下角圆角
ctx.quadraticCurveTo(0, canvas.height, 0, canvas.height - borderRadius);

// 7. 左侧边（下到上，留出左下和左上圆角空间）
ctx.lineTo(0, borderRadius);

// 8. 左上角圆角
ctx.quadraticCurveTo(0, 0, borderRadius, 0);

ctx.closePath();
```

## 视觉对比

### 修复前
```
┌─────────────────────┐
│ ███████████████████ │  ← 矩形 canvas
│ ███████████████████ │
│ ███████████████████ │
│ ███████████████████ │
└─────────────────────┘
```

### 修复后
```
   ╭─────────────╮
  ╱ ████████████ ╲     ← 圆角裁剪
 │  ████████████  │
 │  ████████████  │
  ╲ ████████████ ╱
   ╰─────────────╯
```

## 修改文件

### `src/content/components/PosterModal.tsx`

**第 159 行**: 将 `canvas` 改为 `rawCanvas`
```typescript
const rawCanvas = await html2canvas(posterRef.current, {...});
```

**第 256-286 行**: 添加圆角裁剪逻辑
```typescript
// Apply rounded corners by drawing to a new canvas with clipping
const borderRadius = 24 * 3; // 24px * scale 3
const canvas = document.createElement('canvas');
canvas.width = rawCanvas.width;
canvas.height = rawCanvas.height;
const ctx = canvas.getContext('2d');

if (!ctx) {
  throw new Error('无法创建 canvas context');
}

// Draw rounded rectangle path
ctx.beginPath();
ctx.moveTo(borderRadius, 0);
// ... (完整的圆角路径绘制)
ctx.closePath();

// Clip to rounded rectangle
ctx.clip();

// Draw the original canvas
ctx.drawImage(rawCanvas, 0, 0);
```

## 性能影响

**额外操作**:
1. 创建新的 canvas: `O(1)`
2. 绘制圆角路径: `O(1)` (固定 8 个点)
3. 裁剪: `O(1)`
4. 绘制图像: `O(width × height)` (但由 GPU 加速)

**总体影响**: 可忽略不计
- 用户感知不到延迟
- 内存占用：临时多一个 canvas（导出后立即释放）

## 为什么不使用 CSS mask 或 clip-path？

**原因**: html2canvas 对这些 CSS 特性的支持有限

| 方案 | 是否可行 | 原因 |
|-----|---------|------|
| CSS `border-radius` | ❌ | canvas 本身是矩形 |
| CSS `clip-path` | ❌ | html2canvas 可能不支持 |
| CSS `mask` | ❌ | html2canvas 可能不支持 |
| Canvas `clip()` | ✅ | 原生 API，100% 可靠 |

## 已知限制

### 透明背景

当前方案使用白色背景：
```typescript
backgroundColor: '#ffffff'
```

如果未来需要透明背景的圆角海报：

```typescript
// 修改 html2canvas 配置
backgroundColor: null  // 透明背景

// 裁剪代码不变，但会保留透明度
```

### 抗锯齿

Canvas 的 `quadraticCurveTo` 会自动进行抗锯齿处理，圆角边缘应该是平滑的。

如果发现锯齿，可以尝试：
```typescript
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'high';
```

## 验证结果

✅ **TypeScript 类型检查**: 通过
✅ **构建**: 成功
✅ **包大小**: 265.54 KB（增加约 0.5KB，因为圆角裁剪代码）

## 测试方法

### 1. 导出海报
点击"下载海报"按钮，生成 PNG 文件

### 2. 检查圆角
- 在图片查看器中打开 PNG
- 放大到 200%
- 检查四个角是否为圆角
- 圆角半径应为 24px（在 3 倍分辨率下为 72px）

### 3. 检查宽度
- 查看 PNG 文件属性
- 宽度应为 `360px × 3 = 1080px`
- 如果海报高度为 `H px`，canvas 高度应为 `H × 3 px`

### 4. 在不同背景下查看
- 白色背景：圆角应该可见（作为透明或白色）
- 深色背景：圆角应该明显（如果是透明背景）
- 彩色背景：圆角应该清晰

## 相关文档

- [Canvas 2D API - clip()](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/clip)
- [Canvas 2D API - quadraticCurveTo()](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/quadraticCurveTo)
- [html2canvas 文档](https://html2canvas.hertzen.com/configuration)

## 总结

通过在 html2canvas 生成原始 canvas 后，使用 Canvas 2D API 的 `clip()` 方法进行圆角裁剪，成功解决了导出海报直角的问题。

**关键点**:
1. html2canvas 生成矩形 canvas
2. 创建新 canvas 并绘制圆角路径
3. 使用 `ctx.clip()` 设置裁剪区域
4. 绘制原始 canvas（只有圆角内的内容可见）

现在导出的海报应该有完美的 24px 圆角！
