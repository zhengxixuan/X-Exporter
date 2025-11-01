# 海报宽度问题修复（关键修复）

## 问题现象

导出的海报宽度与预览不一致，表现为：
- 预览：宽度适中，布局美观
- 导出：宽度过窄，高度被拉长，文字重新换行，布局混乱

## 根本原因

之前的代码同时强制设置了 html2canvas 的 `width` 和 `height` 参数：

```typescript
// ❌ 错误的做法
const canvas = await html2canvas(posterElement, {
  width: POSTER_WIDTH,      // 360px
  height: rect.height,      // 基于预览时的高度
  windowWidth: POSTER_WIDTH,
  windowHeight: rect.height,
});
```

**问题**：
1. `rect.height` 是预览时（可能是不同宽度下）的高度
2. 当强制宽度为 360px 时，内容会重新换行
3. 重新换行后，实际需要的高度与 `rect.height` 不同
4. html2canvas 被迫将内容塞进预设的尺寸，导致压缩或拉伸
5. 结果：布局完全混乱

## 解决方案

**核心思想**：只控制宽度，让高度自然适应内容

```typescript
// ✅ 正确的做法
const POSTER_WIDTH = 360;

const rawCanvas = await html2canvas(posterElement, {
  backgroundColor: '#ffffff',
  scale: 3,
  useCORS: true,
  allowTaint: true,
  logging: false,
  // 关键：不设置 width/height/windowWidth/windowHeight 参数
  x: 0,
  y: 0,
  scrollX: 0,
  scrollY: 0,
  onclone: (clonedDoc) => {
    const clonedElement = clonedDoc.querySelector('[data-x-exporter-poster-card]');
    if (!clonedElement) return;

    // 强制固定宽度
    clonedElement.style.width = `${POSTER_WIDTH}px`;
    clonedElement.style.maxWidth = `${POSTER_WIDTH}px`;
    clonedElement.style.minWidth = `${POSTER_WIDTH}px`;

    // 关键：让高度自动计算
    clonedElement.style.height = 'auto';

    // ... 其他样式
  }
});
```

## 工作原理

### 渲染流程

1. **onclone 执行**
   - html2canvas 克隆 DOM 元素
   - 在克隆的文档中应用样式修改
   - 设置 `width: 360px` 和 `height: auto`

2. **浏览器布局计算**
   - 浏览器根据固定宽度重新布局内容
   - 文字自动换行
   - 计算出正确的高度（可能是 800px, 900px, 1000px...）

3. **html2canvas 渲染**
   - 读取元素的实际渲染尺寸（360px × 自动计算的高度）
   - 生成完全匹配的 canvas
   - 布局完美还原

### 为什么不能用 width/height 参数？

html2canvas 的 `width/height` 参数是**强制尺寸**，而不是**建议尺寸**：

| 参数 | 作用 | 问题 |
|-----|------|------|
| `width: 360` | 强制 canvas 宽度为 360 | ✅ 符合预期 |
| `height: 800` | 强制 canvas 高度为 800 | ❌ 实际内容可能需要 900px |
| 结果 | 内容被塞进 360×800 | ❌ 压缩、拉伸、混乱 |

**正确做法**：
- 不设置 `width/height` 参数
- 在 onclone 中设置 CSS 样式
- 让浏览器自然布局
- html2canvas 读取实际尺寸

## 技术对比

### 方法 1：强制宽高（错误）

```typescript
html2canvas(element, {
  width: 360,
  height: 800,
})
```

- ❌ 宽度固定为 360px
- ❌ 高度强制为 800px（无论内容实际需要多少）
- ❌ 内容被压缩或拉伸
- ❌ 布局混乱

### 方法 2：只设置宽度（部分正确）

```typescript
html2canvas(element, {
  width: 360,
  // 不设置 height
})
```

- ✅ 宽度固定为 360px
- ⚠️ 高度基于原始元素（可能不是 360px 宽时的高度）
- ⚠️ 仍可能有布局问题

### 方法 3：onclone + auto（完美）

```typescript
html2canvas(element, {
  // 不设置任何尺寸参数
  onclone: (doc) => {
    const el = doc.querySelector('[target]');
    el.style.width = '360px';
    el.style.height = 'auto';
    el.style.maxWidth = '360px';
    el.style.minWidth = '360px';
  }
})
```

- ✅ 宽度严格固定为 360px（min/max 确保）
- ✅ 高度完全自适应内容
- ✅ 浏览器正确计算布局
- ✅ html2canvas 获取正确尺寸
- ✅ **完美还原预览效果**

## 修改文件

- `src/content/components/PosterModal.tsx`
  - 移除 html2canvas 的 `width/height/windowWidth/windowHeight` 参数
  - 添加 `maxWidth` 和 `minWidth` 确保宽度固定
  - 设置 `height: 'auto'` 让高度自适应

## 验证结果

✅ **TypeScript 类型检查**：通过
✅ **构建测试**：成功
✅ **包大小**：265.44 KB
✅ **布局**：完美匹配预览

## 关键要点

### 记住这个原则

> **只控制宽度，让高度自适应**

这不仅适用于 html2canvas，也适用于所有需要固定宽度但内容高度不确定的场景。

### 三个关键样式

```css
width: 360px;      /* 固定宽度 */
height: auto;      /* 自适应高度 - 关键！*/
max-width: 360px;  /* 防止拉伸 */
min-width: 360px;  /* 防止压缩 */
```

### html2canvas 最佳实践

1. **不要** 使用 `width/height` 参数来控制输出尺寸
2. **要** 使用 onclone 设置 CSS 样式
3. **要** 让浏览器自然计算布局
4. **要** 让 html2canvas 读取实际渲染尺寸

## 总结

这是一个经典的 html2canvas 使用误区。核心教训是：

- **强制尺寸** ≠ **正确尺寸**
- **CSS 样式** > **canvas 参数**
- **自适应高度** 是关键

通过这次修复，海报导出功能终于实现了与预览的完美一致。
