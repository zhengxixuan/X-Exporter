import { getSelector } from '../../common/selectors';
import type { TweetData } from '../../common/types/tweet';
import { logger } from '../../common/utils/logger';
import { scrapeTweetData } from './tweetScraper';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface ThreadHarvestOptions {
  maxTweets: number;
  maxScrollAttempts: number;
  waitForLoadMs: number;
  scrollDelta: number;
}

export interface ThreadProgressState {
  count: number;
  scrollAttempts: number;
  maxTweets: number;
  maxScrollAttempts: number;
  complete: boolean;
}

export interface ThreadHarvestConfig extends ThreadHarvestOptions {
  onProgress?: (state: ThreadProgressState) => void;
}

const computeDefaultScrollDelta = (): number => {
  const height = window.innerHeight || document.documentElement.clientHeight || 800;
  return Math.max(height - 200, 400);
};

const DEFAULT_OPTIONS: ThreadHarvestOptions = {
  maxTweets: 30,
  maxScrollAttempts: 8,
  waitForLoadMs: 600,
  scrollDelta: 0
};

const isLikelyThreadTweet = (candidate: TweetData, anchor: TweetData): boolean => {
  // Must be from the same author
  if (candidate.authorHandle !== anchor.authorHandle) {
    return false;
  }

  // Same tweet ID is definitely part of thread
  if (candidate.tweetId === anchor.tweetId) {
    return true;
  }

  // Check tweet ID ordering (tweets in thread should have IDs >= anchor)
  try {
    const candidateId = BigInt(candidate.tweetId);
    const anchorId = BigInt(anchor.tweetId);

    if (candidateId < anchorId) {
      return false;
    }
  } catch (error) {
    logger.debug('无法比较 tweetId，使用时间戳判断', error);
  }

  // Verify temporal ordering - tweets should be after or same time as anchor
  try {
    const candidateTime = new Date(candidate.timestamp).getTime();
    const anchorTime = new Date(anchor.timestamp).getTime();

    // Allow tweets within reasonable time window (24 hours for a thread)
    const timeDiff = candidateTime - anchorTime;
    const MAX_THREAD_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

    if (timeDiff < 0 || timeDiff > MAX_THREAD_DURATION_MS) {
      return false;
    }
  } catch (error) {
    logger.warn('时间戳比较失败，仅依赖 ID 判断', error);
  }

  return true;
};

const collectFromDom = (
  authorHandle: string,
  collected: Map<string, TweetData>
): void => {
  const articles = document.querySelectorAll(getSelector('tweetArticle'));

  articles.forEach((article) => {
    if (!(article instanceof HTMLElement)) {
      return;
    }

    try {
      const data = scrapeTweetData(article);
      if (data.authorHandle !== authorHandle) {
        return;
      }

      if (!collected.has(data.tweetId)) {
        collected.set(data.tweetId, data);
      }
    } catch (error) {
      logger.warn('抓取 Thread 中的推文失败，忽略当前节点', error);
    }
  });
};

export interface ThreadHarvestResult {
  tweets: TweetData[];
  complete: boolean;
}

export const collectThreadTweets = async (
  startTweetElement: Element,
  options: Partial<ThreadHarvestConfig> = {}
): Promise<ThreadHarvestResult> => {
  const { onProgress, ...rest } = options;
  const opts: ThreadHarvestConfig = {
    ...DEFAULT_OPTIONS,
    scrollDelta: computeDefaultScrollDelta(),
    ...rest,
    onProgress
  };

  const startTweet = scrapeTweetData(startTweetElement);
  const collected = new Map<string, TweetData>();
  collected.set(startTweet.tweetId, startTweet);

  let scrollAttempts = 0;
  let lastCount = collected.size;

  let lastProgressCount = -1;

  const emitProgress = (complete: boolean) => {
    if (!complete && collected.size === lastProgressCount) {
      return;
    }

    lastProgressCount = collected.size;
    opts.onProgress?.({
      count: collected.size,
      scrollAttempts,
      maxTweets: opts.maxTweets,
      maxScrollAttempts: opts.maxScrollAttempts,
      complete
    });
  };

  emitProgress(false);

  while (collected.size < opts.maxTweets && scrollAttempts <= opts.maxScrollAttempts) {
    collectFromDom(startTweet.authorHandle, collected);

    emitProgress(false);

    if (collected.size >= opts.maxTweets) {
      break;
    }

    if (collected.size > lastCount) {
      lastCount = collected.size;
      scrollAttempts = 0;
      continue;
    }

    window.scrollBy({ top: opts.scrollDelta, behavior: 'smooth' });
    scrollAttempts += 1;
    await wait(opts.waitForLoadMs);
  }

  const tweets = Array.from(collected.values())
    .filter((tweet) => isLikelyThreadTweet(tweet, startTweet))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const complete = collected.size < opts.maxTweets && scrollAttempts <= opts.maxScrollAttempts;

  emitProgress(complete);

  return {
    tweets,
    complete
  };
};
