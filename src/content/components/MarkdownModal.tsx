import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { saveAs } from 'file-saver';
import type { TweetData } from '../../common/types/tweet';
import { ensurePortalRoot } from '../utils/dom';
import { logger } from '../../common/utils/logger';

interface MarkdownModalProps {
  tweets: TweetData[];
  markdown: string;
  onClose: () => void;
}

const ROOT_ID = 'x-exporter-markdown-modal-root';

export function MarkdownModal({ tweets, markdown, onClose }: MarkdownModalProps) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const primaryTweet = tweets[0];
  const isThread = tweets.length > 1;

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setFeedback('Copied to clipboard');
    } catch (error) {
      logger.error('Clipboard write failed', error);
      setFeedback('Copy failed, please check permissions');
    }
  }, [markdown]);

  const handleDownload = useCallback(() => {
    try {
      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
      let timestamp = 'tweet';
      try {
        timestamp = new Date(primaryTweet.timestamp).toISOString().slice(0, 16).replace(/[:T]/g, '-');
      } catch (error) {
        logger.warn('Failed to format timestamp for filename', error);
      }

      const suffix = isThread ? 'thread' : 'single';
      const filename = `${timestamp}-${primaryTweet.authorHandle || 'unknown'}-${suffix}.md`;
      saveAs(blob, filename);
      setFeedback('Download started');
    } catch (error) {
      logger.error('Markdown download failed', error);
      setFeedback('Download failed, please try again');
    }
  }, [isThread, markdown, primaryTweet.authorHandle, primaryTweet.timestamp]);

  const portalRoot = ensurePortalRoot(ROOT_ID);

  return createPortal(
    <div className="x-exporter-modal-backdrop" role="dialog" aria-modal="true">
      <div className="x-exporter-modal x-exporter-modal--panel">
        <header className="x-exporter-modal__header x-exporter-modal__header--panel">
          <div>
            <h2>Export Markdown</h2>
            <p className="x-exporter-modal__subtitle">Copy or download the generated note</p>
          </div>
          <button type="button" onClick={onClose} className="x-exporter-modal__close" aria-label="Close">
            ✕
          </button>
        </header>
        <section className="x-exporter-modal__content">
          <p>
            Tweet by {primaryTweet.authorName} (@{primaryTweet.authorHandle}) ·{' '}
            {new Date(primaryTweet.timestamp).toLocaleString()} {isThread ? `· ${tweets.length} posts` : ''}
          </p>
          <textarea
            className="x-exporter-modal__textarea"
            readOnly
            value={markdown}
            aria-label="Markdown 预览"
          />
        </section>
        <footer className="x-exporter-modal__footer">
          <button type="button" className="x-exporter-secondary" onClick={handleCopy}>
            Copy to clipboard
          </button>
          <button type="button" className="x-exporter-primary" onClick={handleDownload}>
            Download .md file
          </button>
        </footer>
        {feedback ? <p className="x-exporter-feedback">{feedback}</p> : null}
      </div>
    </div>,
    portalRoot,
  );
}
