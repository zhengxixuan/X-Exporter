import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { saveAs } from 'file-saver';
import * as htmlToImage from 'html-to-image';
import type { TweetData } from '../../common/types/tweet';
import { ensurePortalRoot } from '../utils/dom';
import { logger } from '../../common/utils/logger';
import { ensureFontsLoaded } from '../../common/utils/fontLoader';

const requestImageDataUrl = async (url: string): Promise<string> => {
  if (url.startsWith('data:')) {
    return url;
  }

  const runtime = (globalThis.chrome && globalThis.chrome.runtime) || undefined;
  if (!runtime?.sendMessage) {
    return url;
  }

  return new Promise((resolve) => {
    try {
      runtime.sendMessage({ type: 'FETCH_IMAGE', url }, (response) => {
        if (runtime.lastError) {
          logger.warn('背景图片代理失败，使用原始地址', runtime.lastError.message);
          resolve(url);
          return;
        }

        if (response?.ok && response.dataUrl) {
          resolve(response.dataUrl as string);
        } else {
          logger.warn('背景图片代理返回异常，使用原始地址', response);
          resolve(url);
        }
      });
    } catch (error) {
      logger.warn('调用背景图片代理失败，使用原始地址', error);
      resolve(url);
    }
  });
};

interface PosterModalProps {
  tweet: TweetData;
  onClose: () => void;
}

const ROOT_ID = 'x-exporter-poster-modal-root';

export function PosterModal({ tweet, onClose }: PosterModalProps) {
  const posterRef = useRef<HTMLElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [downloading, setDownloading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [resolvedImages, setResolvedImages] = useState<string[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);

  // Preload fonts when modal opens
  useEffect(() => {
    ensureFontsLoaded().catch((error) => {
      logger.warn('Failed to preload fonts', error);
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    QRCode.toDataURL(tweet.tweetUrl, { width: 200 })
      .then((dataUrl) => {
        if (mounted) {
          setQrDataUrl(dataUrl);
        }
      })
      .catch((error) => {
        logger.error('QR code generation failed', error);
      });

    return () => {
      mounted = false;
    };
  }, [tweet.tweetUrl]);

  useEffect(() => {
    let active = true;

    if (!tweet.imageUrls.length) {
      setResolvedImages([]);
      return () => {
        active = false;
      };
    }

    setImagesLoading(true);
    Promise.all(tweet.imageUrls.map((url) => requestImageDataUrl(url)))
      .then((images) => {
        if (!active) {
          return;
        }
        setResolvedImages(images);
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        logger.warn('图片代理加载失败，使用原始地址', error);
        setResolvedImages(tweet.imageUrls);
      })
      .finally(() => {
        if (active) {
          setImagesLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [tweet.imageUrls]);

  const normalizedTimestamp = useMemo(() => {
    try {
      return new Date(tweet.timestamp).toISOString().slice(0, 16).replace(/[:T]/g, '-');
    } catch (error) {
      logger.warn('Failed to normalise timestamp for filename', error);
      return 'tweet';
    }
  }, [tweet.timestamp]);

  const statsLine = useMemo(
    () => `❤ ${tweet.stats.likes}   🔁 ${tweet.stats.retweets}   💬 ${tweet.stats.replies}   🔖 ${tweet.stats.bookmarks}`,
    [tweet.stats.likes, tweet.stats.retweets, tweet.stats.replies, tweet.stats.bookmarks]
  );

  const handleDownload = useCallback(async () => {
    if (imagesLoading) {
      setFeedback('Images are still loading, please wait.');
      return;
    }

    if (!posterRef.current) {
      setFeedback('海报元素未找到');
      return;
    }

    setDownloading(true);
    setFeedback(null);

    try {
      // Wait for fonts to be loaded
      await ensureFontsLoaded();
      if (document.fonts && 'ready' in document.fonts) {
        await document.fonts.ready;
      }

      // Wait a bit for any pending renders
      await new Promise(resolve => setTimeout(resolve, 200));

      console.log('🖼️ 开始使用 html-to-image 生成海报...');

      // 🔑 关键修复：预先将所有外部图片转换为 data URL
      // 避免 html-to-image 在处理跨域图片时失败
      const allImages = posterRef.current.querySelectorAll('img');
      const imagePromises: Promise<void>[] = [];

      allImages.forEach((img) => {
        if (img.src && !img.src.startsWith('data:')) {
          const promise = (async () => {
            try {
              const dataUrl = await requestImageDataUrl(img.src);
              img.src = dataUrl;
              console.log('✅ 图片已转换为 data URL');
            } catch (err) {
              console.warn('⚠️ 图片转换失败，将跳过:', img.src, err);
              // 失败时使用占位符或移除
              img.style.display = 'none';
            }
          })();
          imagePromises.push(promise);
        }
      });

      // 等待所有图片转换完成
      await Promise.all(imagePromises);
      console.log(`✅ 已处理 ${imagePromises.length} 个图片`);

      try {
        // 🔑 新方案：直接导出已经有背景样式的父元素（来自 CSS）
        const parent = posterRef.current.parentElement;
        if (!parent) {
          throw new Error('无法找到父元素');
        }

        console.log('🎨 准备导出，父元素实际宽度:', parent.offsetWidth, 'px');

        // 使用 html-to-image 的 toPng 方法，直接导出父元素
        const dataUrl = await htmlToImage.toPng(parent, {
          quality: 1,
          pixelRatio: 3,
          cacheBust: true,
        });

        console.log('✅ 图片生成成功，data URL 长度:', dataUrl.length);

        // 将 data URL 转换为 Blob
        const response = await fetch(dataUrl);
        const blob = await response.blob();

        console.log('✅ Blob 创建成功，大小:', blob.size);

        const filename = `${normalizedTimestamp}-${tweet.authorHandle || 'unknown'}-poster.png`;
        saveAs(blob, filename);
        setFeedback('已开始下载海报');
        console.log('✅ 海报下载完成');
      } catch (innerError) {
        console.error('❌ html-to-image 生成失败:', innerError);
        throw innerError;
      }
    } catch (error) {
      logger.error('海报导出失败', error);
      setFeedback('导出失败,请重试');
    } finally {
      setDownloading(false);
    }
  }, [imagesLoading, normalizedTimestamp, qrDataUrl, resolvedImages, tweet]);

  const portalRoot = ensurePortalRoot(ROOT_ID);

  return createPortal(
    <div className="x-exporter-modal-backdrop" role="dialog" aria-modal="true">
      <div className="x-exporter-modal x-exporter-modal--wide">
        <header className="x-exporter-modal__header">
          <h2>海报预览</h2>
          <button type="button" onClick={onClose} className="x-exporter-modal__close">
            ✕
          </button>
        </header>
        <section className="x-exporter-modal__content">
          <div className="x-exporter-poster-preview" data-x-exporter-poster-wrapper>
            <article ref={posterRef} className="x-exporter-poster" data-x-exporter-poster-card translate="no">
              <header className="x-exporter-poster__header" translate="no">
                {tweet.avatarUrl ? (
                  <img
                    src={tweet.avatarUrl}
                    alt={tweet.authorName || '作者头像'}
                    className="x-exporter-poster__avatar"
                  />
                ) : (
                  <div className="x-exporter-poster__avatar x-exporter-poster__avatar--placeholder" aria-hidden="true">
                    {tweet.authorName?.[0]?.toUpperCase() ?? 'X'}
                  </div>
                )}
                <div className="x-exporter-poster__header-text">
                  <p className="x-exporter-poster__author">{tweet.authorName || '未知作者'}</p>
                  <p className="x-exporter-poster__handle">@{tweet.authorHandle || 'unknown'}</p>
                  <p className="x-exporter-poster__time">
                    {(() => {
                      try {
                        const date = new Date(tweet.timestamp);
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
                      } catch (error) {
                        return tweet.timestamp;
                      }
                    })()}
                  </p>
                </div>
              </header>
              <div className="x-exporter-poster__divider" />
              <section className="x-exporter-poster__content">
                {tweet.textContentHtml ? (
                  <div className="x-exporter-poster__text" dangerouslySetInnerHTML={{ __html: tweet.textContentHtml }} />
                ) : null}
                {resolvedImages.length ? (
                  <div className={`x-exporter-poster__images count-${Math.min(resolvedImages.length, 4)}`}>
                    {imagesLoading ? (
                      <span className="x-exporter-poster__images-loading">图片加载中...</span>
                    ) : (
                      resolvedImages.slice(0, 4).map((url, index) => <img key={`${url}-${index}`} src={url} alt="tweet attachment" />)
                    )}
                  </div>
                ) : null}
                {tweet.quotedTweet ? (
                  <blockquote className="x-exporter-poster__quote">
                    <p className="x-exporter-poster__quote-author">
                      {tweet.quotedTweet.authorName} (@{tweet.quotedTweet.authorHandle})
                    </p>
                    <div
                      className="x-exporter-poster__quote-text"
                      dangerouslySetInnerHTML={{ __html: tweet.quotedTweet.textContentHtml }}
                    />
                  </blockquote>
                ) : null}
              </section>
              <footer className="x-exporter-poster__footer" translate="no">
                <div className="x-exporter-poster__qr">
                  {qrDataUrl ? <img src={qrDataUrl} alt="原文二维码" /> : <span>二维码生成中...</span>}
                  <span className="x-exporter-poster__qr-caption">扫码查看原文</span>
                </div>
                <div className="x-exporter-poster__brand" translate="no">
                  <span className="x-exporter-poster__brand-name" lang="en">
                    X-Exporter
                  </span>
                  <span className="x-exporter-poster__brand-meta" lang="en">
                    {statsLine}
                  </span>
                </div>
              </footer>
            </article>
          </div>
        </section>
        <footer className="x-exporter-modal__footer">
          <button type="button" className="x-exporter-secondary" onClick={onClose} disabled={downloading}>
            取消
          </button>
          <button
            type="button"
            className="x-exporter-primary"
            onClick={handleDownload}
            disabled={downloading || imagesLoading}
          >
            {downloading ? '导出中...' : '下载海报'}
          </button>
        </footer>
        {feedback ? <p className="x-exporter-feedback">{feedback}</p> : null}
      </div>
    </div>,
    portalRoot,
  );
}
