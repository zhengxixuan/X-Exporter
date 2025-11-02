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
      setFeedback('Poster element not found');
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

      console.log('🖼️ Starting poster generation with html-to-image...');

      // 🔑 Fix: Convert all external images to data URLs first
      // This prevents html-to-image from failing on CORS images
      const allImages = posterRef.current.querySelectorAll('img');
      const imagePromises: Promise<void>[] = [];

      allImages.forEach((img) => {
        if (img.src && !img.src.startsWith('data:')) {
          const promise = (async () => {
            try {
              const dataUrl = await requestImageDataUrl(img.src);
              img.src = dataUrl;
              console.log('✅ Image converted to data URL');
            } catch (err) {
              console.warn('⚠️ Image conversion failed, skipping:', img.src, err);
              // Hide failed images
              img.style.display = 'none';
            }
          })();
          imagePromises.push(promise);
        }
      });

      // Wait for all images to be converted
      await Promise.all(imagePromises);
      console.log(`✅ Processed ${imagePromises.length} images`);

      try {
        // 🔑 Export parent element with CSS background
        const parent = posterRef.current.parentElement;
        if (!parent) {
          throw new Error('Parent element not found');
        }

        console.log('🎨 Preparing export, parent width:', parent.offsetWidth, 'px');

        // Use html-to-image toPng method
        const dataUrl = await htmlToImage.toPng(parent, {
          quality: 1,
          pixelRatio: 3,
          cacheBust: true,
        });

        console.log('✅ Image generated, data URL length:', dataUrl.length);

        // Convert data URL to Blob
        const response = await fetch(dataUrl);
        const blob = await response.blob();

        console.log('✅ Blob created, size:', blob.size);

        const filename = `${normalizedTimestamp}-${tweet.authorHandle || 'unknown'}-poster.png`;
        saveAs(blob, filename);
        setFeedback('Poster download started');
        console.log('✅ Poster download complete');
      } catch (innerError) {
        console.error('❌ html-to-image generation failed:', innerError);
        throw innerError;
      }
    } catch (error) {
      logger.error('Poster export failed', error);
      setFeedback('Export failed, please try again');
    } finally {
      setDownloading(false);
    }
  }, [imagesLoading, normalizedTimestamp, qrDataUrl, resolvedImages, tweet]);

  const portalRoot = ensurePortalRoot(ROOT_ID);

  return createPortal(
    <div className="x-exporter-modal-backdrop" role="dialog" aria-modal="true">
      <div className="x-exporter-modal x-exporter-modal--wide">
        <header className="x-exporter-modal__header">
          <h2>Poster Preview</h2>
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
                    alt={tweet.authorName || 'Author avatar'}
                    className="x-exporter-poster__avatar"
                  />
                ) : (
                  <div className="x-exporter-poster__avatar x-exporter-poster__avatar--placeholder" aria-hidden="true">
                    {tweet.authorName?.[0]?.toUpperCase() ?? 'X'}
                  </div>
                )}
                <div className="x-exporter-poster__header-text">
                  <p className="x-exporter-poster__author">{tweet.authorName || 'Unknown'}</p>
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
                      <span className="x-exporter-poster__images-loading">Loading images...</span>
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
                  {qrDataUrl ? <img src={qrDataUrl} alt="QR Code" /> : <span>Generating QR...</span>}
                  <span className="x-exporter-poster__qr-caption" lang="en">Scan for original</span>
                </div>
                <div className="x-exporter-poster__brand" translate="no">
                  <div className="x-exporter-poster__brand-header">
                    <img
                      src={`chrome-extension://${chrome.runtime.id}/src/icons/icon-48.png`}
                      alt="X-Exporter"
                      className="x-exporter-poster__brand-icon"
                    />
                    <span className="x-exporter-poster__brand-name" lang="en">
                      X-Exporter
                    </span>
                  </div>
                  <span className="x-exporter-poster__brand-author" lang="en">
                    @NicoAIstudio
                  </span>
                </div>
                <div className="x-exporter-poster__stats" translate="no" lang="en">
                  {statsLine}
                </div>
              </footer>
            </article>
          </div>
        </section>
        <footer className="x-exporter-modal__footer">
          <button type="button" className="x-exporter-secondary" onClick={onClose} disabled={downloading}>
            Cancel
          </button>
          <button
            type="button"
            className="x-exporter-primary"
            onClick={handleDownload}
            disabled={downloading || imagesLoading}
          >
            {downloading ? 'Exporting...' : 'Download Poster'}
          </button>
        </footer>
        {feedback ? <p className="x-exporter-feedback">{feedback}</p> : null}
      </div>
    </div>,
    portalRoot,
  );
}
