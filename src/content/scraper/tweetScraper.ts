import { getSelector } from '../../common/selectors';
import type { TweetClassification, TweetData } from '../../common/types/tweet';
import { logger } from '../../common/utils/logger';

const numberPattern = /[0-9,.]+/;

const parseStatNumber = (input: string | null | undefined): number => {
  if (!input) {
    return 0;
  }

  const match = input.match(numberPattern);
  if (!match) {
    return 0;
  }

  const normalized = match[0].replace(/,/g, '');
  const value = Number.parseInt(normalized, 10);
  return Number.isNaN(value) ? 0 : value;
};

const isWithinArticle = (root: Element, node: Element | null): boolean => {
  if (!node) {
    return false;
  }

  const closestArticle = node.closest(getSelector('tweetArticle'));
  return closestArticle === root;
};

const queryWithinArticle = <T extends Element>(root: Element, selector: string): T | null => {
  const nodes = root.querySelectorAll<T>(selector);
  for (const node of nodes) {
    if (isWithinArticle(root, node)) {
      return node;
    }
  }

  return null;
};

const queryAllWithinArticle = <T extends Element>(root: Element, selector: string): T[] => {
  const nodes = root.querySelectorAll<T>(selector);
  return Array.from(nodes).filter((node) => isWithinArticle(root, node));
};

const extractHandle = (rawHandle: string | null | undefined): string => {
  if (!rawHandle) {
    return 'unknown';
  }

  if (rawHandle.startsWith('@')) {
    return rawHandle.slice(1);
  }

  return rawHandle;
};

const getTweetUrl = (tweetElement: Element | null): string => {
  const link = tweetElement?.querySelector('a[href*="/status/"]');
  if (!link) {
    return window.location.href;
  }

  const href = link.getAttribute('href') ?? window.location.href;
  try {
    return new URL(href, window.location.origin).toString();
  } catch (error) {
    logger.warn('Failed to build tweet URL', error);
    return href;
  }
};

const extractImageUrls = (tweetElement: Element): string[] => {
  const images = queryAllWithinArticle<HTMLImageElement>(
    tweetElement,
    getSelector('tweetImage')
  );
  const avatarSrc = queryWithinArticle<HTMLImageElement>(
    tweetElement,
    getSelector('tweetAvatar')
  )?.src;

  return Array.from(images)
    .map((img) => img.src)
    .filter((src) => src && src !== avatarSrc);
};

const extractQuoteTweet = (tweetElement: Element): Element | null => {
  const quoteArticle = tweetElement.querySelector(getSelector('tweetQuoteArticle'));
  return quoteArticle;
};

export const classifyTweet = (tweetElement: Element): TweetClassification => {
  const hasQuote = Boolean(extractQuoteTweet(tweetElement));

  const replyBadge = tweetElement.querySelector('[data-testid="reply"]');
  const authorNameSpans = tweetElement.querySelectorAll(`${getSelector('tweetUserNames')} span`);
  const handleOccurrences = new Set(
    Array.from(authorNameSpans)
      .map((node) => node.textContent)
      .filter(Boolean)
      .map((text) => text!.trim())
      .filter((text) => text.startsWith('@'))
  );

  const isThreadStart = Boolean(!replyBadge && handleOccurrences.size === 1);
  const isSingle = !hasQuote && !isThreadStart;

  return {
    isSingle,
    isThreadStart,
    hasQuote
  };
};

const extractAuthor = (tweetElement: Element): { name: string; handle: string; avatarUrl: string } => {
  const namesContainer = queryWithinArticle(tweetElement, getSelector('tweetUserNames'));
  const spans = namesContainer ? Array.from(namesContainer.querySelectorAll('span')) : [];

  const displayNode = spans.find((span) => span.textContent?.trim() && !span.textContent.trim().startsWith('@'));
  const handleNode = spans.find((span) => span.textContent?.trim()?.startsWith('@'));

  const authorName = displayNode?.textContent?.trim() ?? '未知作者';
  const authorHandle = extractHandle(handleNode?.textContent?.trim());
  const avatarUrl =
    queryWithinArticle<HTMLImageElement>(tweetElement, getSelector('tweetAvatar'))?.src ?? '';

  return {
    name: authorName,
    handle: authorHandle,
    avatarUrl
  };
};

const extractTimestamp = (tweetElement: Element): string => {
  const timeElement = queryWithinArticle<HTMLTimeElement>(
    tweetElement,
    getSelector('tweetTimestamp')
  );
  const dateTime = timeElement?.getAttribute('datetime');
  if (dateTime) {
    return dateTime;
  }
  return new Date().toISOString();
};

const extractStats = (tweetElement: Element) => ({
  likes: parseStatNumber(
    queryWithinArticle<HTMLElement>(tweetElement, getSelector('tweetStatsLikes'))?.getAttribute(
      'aria-label'
    ),
  ),
  retweets: parseStatNumber(
    queryWithinArticle<HTMLElement>(
      tweetElement,
      getSelector('tweetStatsRetweets')
    )?.getAttribute('aria-label'),
  ),
  replies: parseStatNumber(
    queryWithinArticle<HTMLElement>(tweetElement, getSelector('tweetStatsReplies'))?.getAttribute(
      'aria-label'
    ),
  ),
  bookmarks: parseStatNumber(
    queryWithinArticle<HTMLElement>(tweetElement, getSelector('tweetStatsBookmarks'))?.getAttribute(
      'aria-label'
    ),
  ),
});

const extractTextHtml = (tweetElement: Element): string => {
  const textContainer = queryWithinArticle(tweetElement, getSelector('tweetText'));
  return textContainer?.innerHTML ?? '';
};

export const scrapeTweetData = (tweetElement: Element): TweetData => {
  const { name, handle, avatarUrl } = extractAuthor(tweetElement);
  const timestamp = extractTimestamp(tweetElement);
  const tweetUrl = getTweetUrl(tweetElement);
  const classification = classifyTweet(tweetElement);
  const imageUrls = extractImageUrls(tweetElement);

  const quoteElement = extractQuoteTweet(tweetElement);
  const quotedTweet = quoteElement ? scrapeTweetData(quoteElement) : undefined;

  return {
    tweetId: tweetElement.getAttribute('data-tweet-id') ?? tweetUrl.split('/').pop() ?? 'unknown',
    authorName: name,
    authorHandle: handle,
    avatarUrl,
    timestamp,
    textContentHtml: extractTextHtml(tweetElement),
    imageUrls,
    stats: extractStats(tweetElement),
    tweetUrl,
    quotedTweet,
    isThreadStart: classification.isThreadStart,
  };
};
