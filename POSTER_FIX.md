# 海报导出格式问题修复

## 问题描述

用户报告海报预览和导出后的图片格式完全不同：

- **预览界面**：格式正确，布局美观，文字正常换行
- **导出图片**：格式错乱，文字全部挤在一行，布局混乱

## 问题分析

通过对比两张截图和代码分析，发现了以下根本原因：

### 1. 字体加载问题

**问题**：CSS 中使用的字体 URL 格式不正确
```css
src: url(chrome-extension://__MSG_@@extension_id__/src/assets/fonts/Inter-Regular.woff2)
```

`__MSG_@@extension_id__` 是一个占位符，`html2canvas` 无法解析这个路径，导致：
- 字体无法正确加载
- 回退到系统默认字体
- 布局计算错误

### 2. html2canvas 渲染问题

**问题**：`html2canvas` 在克隆 DOM 时：
- 无法正确继承计算后的样式
- 文本换行属性丢失
- 布局属性未正确应用

## 解决方案

### 1. 动态字体加载系统

创建 `src/common/utils/fontLoader.ts`：

```typescript
export const loadFonts = async (): Promise<void> => {
  const runtime = globalThis.chrome?.runtime;

  for (const { name, file, weight } of FONT_FILES) {
    const fontUrl = runtime.getURL(`src/assets/fonts/${file}`);
    const fontFace = new FontFace(name, `url(${fontUrl})`, { weight });
    await fontFace.load();
    document.fonts.add(fontFace);
  }
};
```

**优势**：
- 使用 `chrome.runtime.getURL()` 获取正确的扩展资源 URL
- 使用 FontFace API 动态加载字体
- 确保字体在截图前完全加载

### 2. 增强 html2canvas 配置

**改进点**：

#### A. 预加载字体
```typescript
await ensureFontsLoaded();
await document.fonts.ready;
await new Promise(resolve => setTimeout(resolve, 200)); // 额外延迟确保渲染完成
```

#### B. 添加 onclone 回调
```typescript
onclone: (clonedDoc) => {
  const clonedElement = clonedDoc.querySelector('[data-x-exporter-poster-card]');

  // 复制所有计算后的样式
  textElements.forEach((element, index) => {
    const computedStyle = window.getComputedStyle(originalElement);
    element.style.fontFamily = computedStyle.fontFamily;
    element.style.fontSize = computedStyle.fontSize;
    element.style.fontWeight = computedStyle.fontWeight;
    element.style.lineHeight = computedStyle.lineHeight;
    element.style.whiteSpace = computedStyle.whiteSpace;
    element.style.wordBreak = computedStyle.wordBreak;
  });
}
```

#### C. 固定尺寸
```typescript
width: posterElement.offsetWidth,
height: posterElement.offsetHeight,
windowWidth: posterElement.offsetWidth,
windowHeight: posterElement.offsetHeight,
```

### 3. CSS 样式增强

**改进**：
```css
.x-exporter-poster {
  width: 360px;  /* 固定宽度，而不是 min(360px, 92vw) */
  box-sizing: border-box;
  position: relative;
}

.x-exporter-poster__text {
  word-wrap: break-word;
  overflow-wrap: break-word;
  white-space: normal;  /* 确保文字换行 */
}
```

## 修改文件清单

### 新增文件
- ✅ `src/common/utils/fontLoader.ts` - 字体动态加载工具

### 修改文件
- ✅ `src/content/components/PosterModal.tsx` - 海报导出逻辑
  - 添加字体预加载
  - 增强 html2canvas 配置
  - 添加 onclone 回调处理样式

- ✅ `src/content/style.css` - 海报样式
  - 固定海报宽度
  - 添加文本换行属性
  - 增强布局稳定性

## 技术细节

### 字体加载流程

1. **模态框打开时**：预加载所有字体
   ```typescript
   useEffect(() => {
     ensureFontsLoaded().catch(error => logger.warn('Failed to preload fonts', error));
   }, []);
   ```

2. **点击下载时**：确保字体完全加载
   ```typescript
   await ensureFontsLoaded();
   await document.fonts.ready;
   await new Promise(resolve => setTimeout(resolve, 200));
   ```

3. **html2canvas 渲染时**：应用所有计算后的样式

### html2canvas 配置选项

| 选项 | 值 | 作用 |
|------|-----|------|
| `scale` | 2 | 高清输出（2倍分辨率） |
| `useCORS` | true | 允许跨域图片 |
| `allowTaint` | true | 允许污染的 canvas |
| `logging` | false | 禁用调试日志 |
| `width/height` | offsetWidth/Height | 固定尺寸 |
| `onclone` | 回调函数 | 应用计算后的样式 |

## 验证结果

✅ **类型检查**：通过
✅ **构建测试**：成功
✅ **字体文件**：5 个字体文件正确打包（~70KB）

## 预期效果

修复后的海报导出应该：

1. ✅ **字体一致**：预览和导出使用相同的 Inter + Noto Sans SC 字体
2. ✅ **布局正确**：文字正常换行，卡片布局完整
3. ✅ **样式完整**：所有 CSS 样式正确应用
4. ✅ **高清输出**：2倍分辨率，清晰锐利

## 测试建议

在 Chrome 扩展环境中测试以下场景：

1. **纯文本推文**：验证文字换行和字体显示
2. **含图片推文**：验证图片布局（1-4 张）
3. **含引用推文**：验证嵌套布局
4. **长文本推文**：验证文字溢出和换行
5. **中英混排**：验证字体回退和混排效果

## 故障排查

如果问题仍然存在：

1. **检查字体加载**：
   ```javascript
   console.log(Array.from(document.fonts.values()).map(f => f.family));
   ```

2. **检查 html2canvas 输出**：
   ```typescript
   logging: true  // 启用调试日志
   ```

3. **检查计算样式**：
   ```javascript
   const element = document.querySelector('[data-x-exporter-poster-card]');
   console.log(window.getComputedStyle(element).fontFamily);
   ```

## 相关资源

- [FontFace API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/FontFace)
- [html2canvas Documentation](https://html2canvas.hertzen.com/configuration)
- [Chrome Extension - chrome.runtime.getURL](https://developer.chrome.com/docs/extensions/reference/runtime/#method-getURL)
