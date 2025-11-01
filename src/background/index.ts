import { logger } from '../common/utils/logger';

logger.info('Background service worker loaded');

const CACHE_LIMIT = 50;
const MAX_CACHE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
const imageCache = new Map<string, string>();
const cacheOrder: string[] = [];
let currentCacheSize = 0;

const runtime = globalThis.chrome?.runtime;
const storage = globalThis.chrome?.storage?.local;

const readFromStorage = async (url: string): Promise<string | undefined> =>
  new Promise((resolve) => {
    if (!storage) {
      resolve(undefined);
      return;
    }

    storage.get(url, (items) => {
      if (runtime?.lastError) {
        logger.warn('读取图片缓存失败', runtime.lastError.message);
        resolve(undefined);
        return;
      }

      const value = items?.[url];
      resolve(typeof value === 'string' ? value : undefined);
    });
  });

const writeToStorage = (url: string, dataUrl: string): void => {
  if (!storage) {
    return;
  }

  storage.set({ [url]: dataUrl }, () => {
    if (runtime?.lastError) {
      logger.warn('写入图片缓存失败', runtime.lastError.message);
    }
  });
};

const removeFromStorage = (url: string): void => {
  if (!storage) {
    return;
  }

  storage.remove(url, () => {
    if (runtime?.lastError) {
      logger.warn('移除图片缓存失败', runtime.lastError.message);
    }
  });
};

const estimateDataUrlSize = (dataUrl: string): number => {
  // Base64 data URLs are roughly 4/3 the size of the original binary data
  // Format: "data:image/png;base64,..."
  const base64Data = dataUrl.split(',')[1] || '';
  return Math.ceil(base64Data.length * 0.75);
};

const evictIfNeeded = (newDataUrl: string): void => {
  const newSize = estimateDataUrlSize(newDataUrl);

  // Evict oldest entries if we exceed size limit or count limit
  while (
    (currentCacheSize + newSize > MAX_CACHE_SIZE_BYTES || cacheOrder.length >= CACHE_LIMIT) &&
    cacheOrder.length > 0
  ) {
    const oldest = cacheOrder.shift();
    if (oldest) {
      const cachedData = imageCache.get(oldest);
      if (cachedData) {
        currentCacheSize -= estimateDataUrlSize(cachedData);
        imageCache.delete(oldest);
        removeFromStorage(oldest);
        logger.debug('Evicted image from cache', { url: oldest, remainingSize: currentCacheSize });
      }
    }
  }
};

const rememberCacheOrder = (url: string, dataUrl: string): void => {
  // If already cached, move to end (LRU)
  const existingIndex = cacheOrder.indexOf(url);
  if (existingIndex !== -1) {
    cacheOrder.splice(existingIndex, 1);
  }

  evictIfNeeded(dataUrl);

  cacheOrder.push(url);
  currentCacheSize += estimateDataUrlSize(dataUrl);

  logger.debug('Cache stats', {
    entries: cacheOrder.length,
    sizeBytes: currentCacheSize,
    sizeMB: (currentCacheSize / (1024 * 1024)).toFixed(2)
  });
};

const fetchImageAsDataUrl = async (url: string): Promise<string> => {
  // Check memory cache first
  if (imageCache.has(url)) {
    const cached = imageCache.get(url)!;
    // Move to end (LRU refresh)
    const existingIndex = cacheOrder.indexOf(url);
    if (existingIndex !== -1) {
      cacheOrder.splice(existingIndex, 1);
      cacheOrder.push(url);
    }
    return cached;
  }

  // Check storage cache
  const stored = await readFromStorage(url);
  if (stored) {
    imageCache.set(url, stored);
    rememberCacheOrder(url, stored);
    return stored;
  }

  // Fetch from network
  const response = await fetch(url, {
    mode: 'cors',
    credentials: 'omit'
  });

  if (!response.ok) {
    throw new Error(`图片请求失败: ${response.status}`);
  }

  const blob = await response.blob();

  // Check blob size before processing
  if (blob.size > 10 * 1024 * 1024) {
    logger.warn('Image too large, skipping cache', { url, size: blob.size });
    // Convert to data URL but don't cache
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('无法解析图片数据'));
        }
      };
      reader.onerror = () => reject(reader.error ?? new Error('图片数据读取失败'));
      reader.readAsDataURL(blob);
    });
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('无法解析图片数据'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('图片数据读取失败'));
    reader.readAsDataURL(blob);
  });

  imageCache.set(url, dataUrl);
  rememberCacheOrder(url, dataUrl);
  writeToStorage(url, dataUrl);
  return dataUrl;
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  logger.debug('Received message in background', { message, sender });

  if (message?.type === 'PING') {
    sendResponse({ ok: true, received: Date.now() });
    return true;
  }

  if (message?.type === 'FETCH_IMAGE' && typeof message.url === 'string') {
    fetchImageAsDataUrl(message.url)
      .then((dataUrl) => {
        sendResponse({ ok: true, dataUrl });
      })
      .catch((error) => {
        logger.error('图片代理失败', error);
        sendResponse({ ok: false, error: (error as Error).message });
      });

    return true;
  }

  return false;
});
