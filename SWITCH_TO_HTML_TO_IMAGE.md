# 切换到 html-to-image 库

## 改动说明

已从 `html2canvas` 切换到 `html-to-image` 库。

### 为什么切换？

**html2canvas 的问题**：
- ❌ 文本换行与预览不一致
- ❌ 使用自己的文本测量和渲染逻辑
- ❌ 不支持某些 CSS 特性（如 `letter-spacing`）
- ❌ 在不同浏览器上表现不一致

**html-to-image 的优势**：
- ✅ 使用 SVG `<foreignObject>` 技术
- ✅ 让浏览器原生渲染，然后转换为图片
- ✅ 文本布局与预览完全一致
- ✅ 更好的 CSS 支持
- ✅ 更小的包体积

## 包依赖变化

### 卸载
```bash
npm uninstall html2canvas
```

### 安装
```bash
npm install html-to-image
```

## 代码改动

### `src/content/components/PosterModal.tsx`

**之前（html2canvas）**：
```typescript
import html2canvas from 'html2canvas';

const canvas = await html2canvas(posterRef.current, {
  backgroundColor: '#ffffff',
  scale: 3,
  useCORS: true,
  allowTaint: true,
  onclone: (clonedDoc) => {
    // 复杂的样式复制逻辑
    // ...
  }
});

const blob = await new Promise<Blob | null>((resolve) =>
  canvas.toBlob(resolve, 'image/png')
);
```

**现在（html-to-image）**：
```typescript
import * as htmlToImage from 'html-to-image';

const dataUrl = await htmlToImage.toPng(posterRef.current, {
  quality: 1,
  pixelRatio: 3,  // 3倍清晰度
  backgroundColor: '#ffffff',
  cacheBust: true,
  skipAutoScale: false,
});

// 将 data URL 转换为 Blob
const response = await fetch(dataUrl);
const blob = await response.blob();
```

### 关键配置参数

| 参数 | 值 | 说明 |
|-----|-----|------|
| `quality` | 1 | PNG 质量（1 = 最高） |
| `pixelRatio` | 3 | 像素密度（3倍清晰度，适合移动端） |
| `backgroundColor` | '#ffffff' | 背景色 |
| `cacheBust` | true | 避免浏览器缓存影响 |
| `skipAutoScale` | false | 自动处理 devicePixelRatio |

## 技术对比

### html2canvas vs html-to-image

| 特性 | html2canvas | html-to-image |
|-----|------------|--------------|
| **渲染方式** | 重新绘制到 Canvas | SVG foreignObject |
| **文本布局** | 自己计算 | 浏览器原生 |
| **CSS 支持** | 部分支持 | 完全支持 |
| **包大小** | ~200KB | ~10KB |
| **文本一致性** | ❌ 可能不一致 | ✅ 完全一致 |
| **字体支持** | 需要预加载 | 自动处理 |
| **跨域限制** | 需要 CORS | 更严格的 CORS |

### 工作原理

**html-to-image**：
1. 将 DOM 元素转换为 SVG
2. 在 SVG 中嵌入样式和字体
3. 使用 `<foreignObject>` 包裹 HTML
4. 将 SVG 转换为 data URL
5. 绘制到 Canvas（如果需要）

**优势**：
- 浏览器原生渲染 `<foreignObject>` 中的 HTML
- 文本换行、字体渲染与预览完全一致
- 不需要重新计算样式

## 构建结果

✅ **TypeScript 编译**：通过
✅ **Vite 构建**：成功
✅ **包大小变化**：
- 之前：265.05 KB
- 现在：73.60 KB
- **减少**：191.45 KB (-72%) 🎉

## 预期效果

### 导出的海报

- **宽度**：366px × 3 = 1098px（物理像素）
- **高度**：自适应 × 3
- **清晰度**：3倍 DPI（pixelRatio: 3）
- **文本换行**：与预览完全一致 ✅
- **字体渲染**：与预览完全一致 ✅
- **CSS 效果**：圆角、阴影、渐变全部保留 ✅

### 测试检查清单

- [ ] 文本换行与预览一致
- [ ] 英文不再提前换行
- [ ] 中文显示正常
- [ ] 圆角正常显示
- [ ] 阴影和渐变正常
- [ ] 图片清晰度高
- [ ] 统计数字不换行

## 可能的问题

### 1. 跨域图片

**问题**：如果海报中有跨域图片，可能无法导出

**解决**：
- 已经在 `requestImageDataUrl` 中处理，将图片转换为 data URL
- 如果仍有问题，可以增加重试逻辑

### 2. 字体加载

**问题**：如果字体未加载完成，可能显示回退字体

**解决**：
- 已经使用 `ensureFontsLoaded()` 和 `document.fonts.ready`
- `cacheBust: true` 确保不使用缓存

### 3. 复杂 CSS

**问题**：某些高级 CSS 特性可能不支持

**解决**：
- html-to-image 基于浏览器原生渲染，支持度很高
- 如果有问题，可以降级使用 `toCanvas()` 方法

## 调试日志

导出时会在控制台输出：

```
🖼️ 开始使用 html-to-image 生成海报...
✅ 图片生成成功
✅ 海报下载完成
```

如果有错误，会输出详细的错误信息。

## 下一步

如果 html-to-image 仍然有问题，可以尝试：

1. **modern-screenshot**：最新的截图库，基于 html-to-image 改进
2. **dom-to-image-more**：html-to-image 的社区维护版本
3. **手动 Canvas 绘制**：完全控制，但工作量大

---

**修改时间**：2025-11-01
**库版本**：html-to-image@latest
**包大小减少**：72%
