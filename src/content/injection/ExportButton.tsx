import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { logger } from '../../common/utils/logger';
import { registerToastHandler, handleError, handleSuccess, handleInfo } from '../../common/utils/errorHandler';
import type { TweetData } from '../../common/types/tweet';
import { classifyTweet, scrapeTweetData } from '../scraper/tweetScraper';
import { collectThreadTweets } from '../scraper/threadCollector';
import { MarkdownModal } from '../components/MarkdownModal';
import { PosterModal } from '../components/PosterModal';
import { generateMarkdown } from '../exporters/markdown';
import { ensurePortalRoot } from '../utils/dom';

export interface ExportButtonProps {
  tweetId: string;
  tweetElement: Element | null;
}

export const EXPORT_BUTTON_CLASS = 'x-exporter-action-button';

const defaultClassification = {
  isSingle: true,
  isThreadStart: false,
  hasQuote: false
};

interface MarkdownState {
  tweets: TweetData[];
  markdown: string;
}

const TOAST_ROOT_ID = 'x-exporter-toast-root';

export function ExportButton({ tweetId, tweetElement }: ExportButtonProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [markdownState, setMarkdownState] = useState<MarkdownState | null>(null);
  const [posterTweet, setPosterTweet] = useState<TweetData | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const statusTimerRef = useRef<number | null>(null);
  const [processing, setProcessing] = useState<'thread' | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const classification = useMemo(() => {
    if (!tweetElement) {
      return defaultClassification;
    }
    try {
      return classifyTweet(tweetElement);
    } catch (error) {
      logger.warn('Tweet classification failed', error);
      return defaultClassification;
    }
  }, [tweetElement]);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const updateStatus = useCallback((message: string | null, persist = false) => {
    if (statusTimerRef.current) {
      window.clearTimeout(statusTimerRef.current);
      statusTimerRef.current = null;
    }

    setStatusMessage(message);

    if (message && !persist) {
      statusTimerRef.current = window.setTimeout(() => {
        setStatusMessage(null);
        statusTimerRef.current = null;
      }, 3500);
    }
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current) {
        return;
      }

      if (!menuRef.current.contains(event.target as Node)) {
        closeMenu();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen, closeMenu]);

  useEffect(() => {
    // Register toast handler
    registerToastHandler(({ message, persist = false }) => {
      updateStatus(message, persist);
    });

    return () => {
      if (statusTimerRef.current) {
        window.clearTimeout(statusTimerRef.current);
      }
    };
  }, [updateStatus]);

  const handleMarkdownExport = useCallback(() => {
    if (!tweetElement) {
      handleError(new Error('无法定位推文元素'), 'Markdown 导出失败');
      return;
    }
    try {
      const tweet = scrapeTweetData(tweetElement);
      const markdown = generateMarkdown(tweet);
      logger.info('Prepared Markdown export', { tweetId });
      setMarkdownState({ tweets: [tweet], markdown });
      closeMenu();
    } catch (error) {
      handleError(error, 'Markdown 导出失败，请重试');
    }
  }, [tweetElement, closeMenu, tweetId]);

  const handlePosterExport = useCallback(() => {
    if (!tweetElement) {
      handleError(new Error('无法定位推文元素'), '海报导出失败');
      return;
    }
    try {
      const tweet = scrapeTweetData(tweetElement);
      logger.info('Prepared poster export', { tweetId });
      setPosterTweet(tweet);
      closeMenu();
    } catch (error) {
      handleError(error, '海报生成失败，请重试');
    }
  }, [tweetElement, closeMenu, tweetId]);

  const handleThreadExport = useCallback(async () => {
    if (!tweetElement) {
      handleError(new Error('无法定位推文元素'), 'Thread 导出失败');
      return;
    }

    closeMenu();
    handleInfo('正在抓取 Thread...', { persist: true });
    setProcessing('thread');

    try {
      const { tweets, complete } = await collectThreadTweets(tweetElement, {
        onProgress: ({ count, scrollAttempts, maxScrollAttempts, complete: progressComplete }) => {
          if (progressComplete) {
            return;
          }

          handleInfo(
            `Thread 抓取中... 已收集 ${count} 条（尝试 ${scrollAttempts}/${maxScrollAttempts}）`,
            { persist: true }
          );
        }
      });
      if (!tweets.length) {
        throw new Error('未抓取到 Thread 推文');
      }

      const markdown = generateMarkdown(tweets);
      logger.info('Prepared Thread Markdown export', {
        tweetId,
        tweetCount: tweets.length,
        complete
      });
      setMarkdownState({ tweets, markdown });

      const completionMessage = complete
        ? `Thread 抓取完成，共 ${tweets.length} 条`
        : `Thread 抓取部分完成（共 ${tweets.length} 条），建议手动加载更多后重试`;

      handleSuccess(completionMessage);
    } catch (error) {
      handleError(error, 'Thread 导出失败，请检查网络或手动滚动加载更多推文后重试');
    } finally {
      setProcessing(null);
    }
  }, [tweetElement, tweetId, closeMenu]);

  return (
    <>
      <div className="x-exporter-action">
        <button
          className={EXPORT_BUTTON_CLASS}
          type="button"
          aria-label="Export"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <img
            src={`chrome-extension://${chrome.runtime.id}/src/icons/icon-48.png`}
            alt="Export"
            className="x-exporter-action-icon"
          />
        </button>
        {menuOpen ? (
          <div className="x-exporter-menu" ref={menuRef}>
            <p className="x-exporter-menu__title">Select export format</p>
            <button type="button" onClick={handlePosterExport} className="x-exporter-menu__item">
              Export Poster
            </button>
            <button type="button" onClick={handleMarkdownExport} className="x-exporter-menu__item">
              Markdown · Single
            </button>
            <button
              type="button"
              className="x-exporter-menu__item"
              onClick={handleThreadExport}
              disabled={!classification.isThreadStart || processing === 'thread'}
              title={
                classification.isThreadStart
                  ? processing === 'thread'
                    ? 'Harvesting thread...'
                    : 'Export full thread'
                  : 'Not a thread start'
              }
            >
              Markdown · Thread
            </button>
            <button type="button" onClick={closeMenu} className="x-exporter-menu__cancel">
              Cancel
            </button>
          </div>
        ) : null}
      </div>
      {markdownState ? (
        <MarkdownModal
          tweets={markdownState.tweets}
          markdown={markdownState.markdown}
          onClose={() => setMarkdownState(null)}
        />
      ) : null}
      {posterTweet ? <PosterModal tweet={posterTweet} onClose={() => setPosterTweet(null)} /> : null}
      {statusMessage
        ? createPortal(
            <div className="x-exporter-toast">{statusMessage}</div>,
            ensurePortalRoot(TOAST_ROOT_ID)
          )
        : null}
    </>
  );
}
