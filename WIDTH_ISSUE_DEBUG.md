# 海报宽度问题调试

## 问题

导出的海报宽度与预览时不一致。

## 已添加的调试日志

### 1. 预览元素实际尺寸
```typescript
const rect = posterRef.current.getBoundingClientRect();
console.log('Poster element dimensions before html2canvas:', {
  width: rect.width,
  height: rect.height,
  computedWidth: window.getComputedStyle(posterRef.current).width,
  computedMaxWidth: window.getComputedStyle(posterRef.current).maxWidth
});
```

**作用**: 查看预览时海报元素在浏览器中的实际渲染尺寸

### 2. onclone 中的原始元素尺寸
```typescript
const originalRect = originalElement.getBoundingClientRect();
console.log('Original element in onclone:', {
  width: originalRect.width,
  height: originalRect.height,
  computedWidth: window.getComputedStyle(originalElement).width
});
```

**作用**: 查看 html2canvas 在克隆前读取到的原始元素尺寸

### 3. 生成的 canvas 尺寸
```typescript
console.log('Raw canvas dimensions:', {
  width: rawCanvas.width,
  height: rawCanvas.height,
  expectedWidth: POSTER_WIDTH * 3,  // 360 * 3 = 1080
  widthMatch: rawCanvas.width === POSTER_WIDTH * 3
});
```

**作用**: 查看 html2canvas 生成的 canvas 实际尺寸

## 测试步骤

1. **重新加载扩展**
   - Chrome 扩展管理页面
   - 点击刷新按钮

2. **打开海报预览**
   - 访问 Twitter/X
   - 点击推文的导出按钮
   - 选择"海报"

3. **查看控制台日志**
   - 打开开发者工具 (F12)
   - 切换到 Console 标签

4. **点击下载海报**
   - 点击"下载海报"按钮
   - **立即查看控制台输出**

## 预期日志输出

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
  widthMatch: true
}
```

## 可能的问题场景

### 场景 1: 预览元素本身宽度不是 360px

**日志表现**:
```
Poster element dimensions before html2canvas: {
  width: 320,  // ❌ 不是 360
  ...
}
```

**原因**:
- Modal 容器太小
- 屏幕宽度限制
- CSS 媒体查询影响

**解决方案**:
需要在 CSS 中确保 `.x-exporter-poster` 始终为 360px，不受容器影响：
```css
.x-exporter-poster {
  width: 360px !important;
  min-width: 360px !important;
  max-width: 360px !important;
}
```

### 场景 2: onclone 中读取的宽度不对

**日志表现**:
```
Poster element dimensions before html2canvas: {
  width: 360,  // ✅ 正确
  ...
}

Original element in onclone: {
  width: 320,  // ❌ 不一致
  ...
}
```

**原因**:
- html2canvas 在克隆时应用了不同的样式
- 克隆文档的渲染环境不同

**解决方案**:
在 onclone 中更强制地设置宽度，并检查容器：
```typescript
// 检查并设置容器宽度
const clonedWrapper = clonedDoc.querySelector('[data-x-exporter-poster-wrapper]') as HTMLElement;
if (clonedWrapper) {
  clonedWrapper.style.width = '500px';
  clonedWrapper.style.minWidth = '500px';
}

// 更强制地设置海报宽度
clonedElement.style.setProperty('width', `${POSTER_WIDTH}px`, 'important');
clonedElement.style.setProperty('max-width', `${POSTER_WIDTH}px`, 'important');
clonedElement.style.setProperty('min-width', `${POSTER_WIDTH}px`, 'important');
```

### 场景 3: canvas 宽度不是 1080px

**日志表现**:
```
Original element in onclone: {
  width: 360,  // ✅ 正确
  ...
}

Raw canvas dimensions: {
  width: 960,  // ❌ 不是 1080
  expectedWidth: 1080,
  widthMatch: false
}
```

**原因**:
- html2canvas 的 scale 参数没有正确应用
- 元素在渲染时被缩放了

**解决方案**:
检查 html2canvas 配置，确保 scale: 3 生效：
```typescript
const rawCanvas = await html2canvas(posterRef.current, {
  backgroundColor: '#ffffff',
  scale: 3,  // 确保这里是 3
  width: POSTER_WIDTH,  // 添加明确的宽度参数
  // ...
});
```

### 场景 4: 浏览器缩放影响

**日志表现**:
```
Poster element dimensions before html2canvas: {
  width: 450,  // ❌ 360 * 1.25 = 450 (125% 缩放)
  ...
}
```

**原因**:
- 用户浏览器设置了缩放 (Zoom)
- devicePixelRatio 影响

**解决方案**:
使用 `offsetWidth` 而不是 `getBoundingClientRect()`：
```typescript
const actualWidth = posterRef.current.offsetWidth;
console.log('offsetWidth:', actualWidth);  // 应该是 360，不受 zoom 影响
```

## 分析工具

### 检查元素实际尺寸
```typescript
const element = posterRef.current;

console.log('尺寸信息:', {
  // 视觉尺寸（受 zoom 影响）
  boundingRect: element.getBoundingClientRect().width,

  // 实际尺寸（不受 zoom 影响）
  offsetWidth: element.offsetWidth,
  clientWidth: element.clientWidth,
  scrollWidth: element.scrollWidth,

  // CSS 计算值
  computedWidth: window.getComputedStyle(element).width,
  computedMaxWidth: window.getComputedStyle(element).maxWidth,
  computedMinWidth: window.getComputedStyle(element).minWidth,

  // 缩放相关
  devicePixelRatio: window.devicePixelRatio,
  zoom: window.getComputedStyle(element).zoom
});
```

### 检查容器限制
```typescript
const wrapper = posterRef.current.parentElement;
console.log('容器宽度:', {
  wrapperWidth: wrapper?.getBoundingClientRect().width,
  wrapperComputedWidth: wrapper ? window.getComputedStyle(wrapper).width : null
});
```

## 潜在问题清单

- [ ] CSS 宽度定义是否正确？
- [ ] 是否有 max-width 限制？
- [ ] Modal 容器是否足够宽？
- [ ] 是否有响应式 CSS 影响？
- [ ] 浏览器缩放是否影响？
- [ ] transform 或 scale CSS 属性？
- [ ] html2canvas 的 scale 参数是否生效？
- [ ] onclone 回调是否正确设置宽度？
- [ ] 是否有其他 JavaScript 动态修改宽度？

## 下一步行动

根据控制台日志输出，确定具体是哪个场景，然后应用对应的解决方案。

**请在测试后提供控制台日志截图或复制日志内容，我会据此分析具体原因。**
