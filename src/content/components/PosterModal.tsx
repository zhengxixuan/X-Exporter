import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';
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

      const POSTER_WIDTH = 366;

      const canvas = await html2canvas(posterRef.current, {
        backgroundColor: '#ffffff',
        scale: 3,
        useCORS: true,
        allowTaint: true,
        logging: false,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDoc) => {
          const clonedElement = clonedDoc.querySelector('[data-x-exporter-poster-card]') as HTMLElement;
          if (!clonedElement) return;

          // Force all critical styles with fixed values
          clonedElement.style.width = `${POSTER_WIDTH}px`;
          clonedElement.style.maxWidth = `${POSTER_WIDTH}px`;
          clonedElement.style.minWidth = `${POSTER_WIDTH}px`;
          clonedElement.style.height = 'auto';
          clonedElement.style.margin = '0';
          clonedElement.style.padding = '24px 20px';
          clonedElement.style.boxSizing = 'border-box';
          clonedElement.style.backgroundColor = '#ffffff';
          clonedElement.style.borderRadius = '24px';
          clonedElement.style.border = '1px solid rgba(15, 20, 25, 0.05)';
          clonedElement.style.boxShadow = '0 20px 40px rgba(15, 20, 25, 0.18)';
          clonedElement.style.backgroundImage = 'linear-gradient(180deg, rgba(249, 250, 252, 0.9) 0%, #ffffff 24%)';
          clonedElement.style.fontFamily = 'Inter, Noto Sans SC, system-ui, sans-serif';
          clonedElement.style.color = '#0f1419';
          clonedElement.style.display = 'flex';
          clonedElement.style.flexDirection = 'column';
          clonedElement.style.gap = '20px';
          clonedElement.style.position = 'relative';

          // Apply styles to all child elements
          const applyStyles = (original: HTMLElement, cloned: HTMLElement) => {
            const originalStyle = window.getComputedStyle(original);

            cloned.style.fontFamily = originalStyle.fontFamily;
            cloned.style.fontSize = originalStyle.fontSize;
            cloned.style.fontWeight = originalStyle.fontWeight;
            cloned.style.lineHeight = originalStyle.lineHeight;
            cloned.style.color = originalStyle.color;
            cloned.style.backgroundColor = originalStyle.backgroundColor;
            cloned.style.padding = originalStyle.padding;
            cloned.style.margin = originalStyle.margin;
            cloned.style.borderRadius = originalStyle.borderRadius;
            cloned.style.border = originalStyle.border;
            cloned.style.borderTop = originalStyle.borderTop;
            cloned.style.borderRight = originalStyle.borderRight;
            cloned.style.borderBottom = originalStyle.borderBottom;
            cloned.style.borderLeft = originalStyle.borderLeft;
            cloned.style.display = originalStyle.display;
            cloned.style.flexDirection = originalStyle.flexDirection;
            cloned.style.gap = originalStyle.gap;
            cloned.style.alignItems = originalStyle.alignItems;
            cloned.style.justifyContent = originalStyle.justifyContent;
            cloned.style.whiteSpace = originalStyle.whiteSpace;
            cloned.style.wordBreak = originalStyle.wordBreak;
            cloned.style.overflowWrap = originalStyle.overflowWrap;
            cloned.style.textAlign = originalStyle.textAlign;

            // Copy size properties, but avoid viewport-relative units
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

            cloned.style.height = originalStyle.height;
            cloned.style.maxHeight = originalStyle.maxHeight;
            cloned.style.minHeight = originalStyle.minHeight;
            cloned.style.objectFit = originalStyle.objectFit;
            cloned.style.gridTemplateColumns = originalStyle.gridTemplateColumns;
            cloned.style.gridColumn = originalStyle.gridColumn;
          };

          const originalElements = Array.from(posterRef.current!.querySelectorAll('*'));
          const clonedElements = Array.from(clonedElement.querySelectorAll('*'));

          originalElements.forEach((original, index) => {
            const cloned = clonedElements[index];
            if (original instanceof HTMLElement && cloned instanceof HTMLElement) {
              applyStyles(original, cloned);
            }
          });
        }
      });

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) {
        throw new Error('生成图片失败');
      }

      const filename = `${normalizedTimestamp}-${tweet.authorHandle || 'unknown'}-poster.png`;
      saveAs(blob, filename);
      setFeedback('已开始下载海报');
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
