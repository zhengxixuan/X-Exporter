export const SELECTORS = {
  tweetArticle: [
    'article[data-testid="tweet"]',
    'article[role="article"]',
    'div[data-tweet-id]'
  ] as string[],
  tweetText: [
    'div[data-testid="tweetText"]',
    'div[lang][dir="auto"]'
  ] as string[],
  tweetUserNames: [
    'div[data-testid="User-Name"]',
    'div[data-testid="User-Names"]'
  ] as string[],
  tweetTimestamp: [
    'a time',
    'time[datetime]'
  ] as string[],
  tweetStatsLikes: [
    'button[data-testid="like"]',
    'button[aria-label*="Like"]',
    'div[role="button"][aria-label*="Like"]'
  ] as string[],
  tweetStatsRetweets: [
    'button[data-testid="retweet"]',
    'button[aria-label*="Repost"]',
    'button[aria-label*="Retweet"]'
  ] as string[],
  tweetStatsReplies: [
    'button[data-testid="reply"]',
    'button[aria-label*="Reply"]',
    'button[aria-label*="replies"]'
  ] as string[],
  tweetStatsBookmarks: [
    'button[data-testid="bookmark"]',
    'button[aria-label*="Bookmark"]'
  ] as string[],
  tweetQuoteArticle: [
    'div[data-testid="tweet"] article',
    'div[role="link"] article'
  ] as string[],
  tweetImage: [
    'div[data-testid="tweetPhoto"] img',
    'div[data-testid="card.layoutLarge.media"] img',
    'a[href*="/photo/"] img'
  ] as string[],
  tweetAvatar: [
    'div[data-testid="Tweet-User-Avatar"] img',
    'img[alt*="profile"]',
    'a[role="link"] img[src*="profile"]'
  ] as string[]
};

export type SelectorKey = keyof typeof SELECTORS;

export const getSelector = (key: SelectorKey): string => {
  const selectors = SELECTORS[key];
  return Array.isArray(selectors) ? selectors.join(', ') : selectors;
};

export const querySelectorWithFallback = <T extends Element = Element>(
  root: ParentNode,
  key: SelectorKey
): T | null => {
  const selectors = SELECTORS[key];
  const selectorList = Array.isArray(selectors) ? selectors : [selectors];

  for (const selector of selectorList) {
    const element = root.querySelector<T>(selector);
    if (element) {
      return element;
    }
  }

  return null;
};

export const querySelectorAllWithFallback = <T extends Element = Element>(
  root: ParentNode,
  key: SelectorKey
): T[] => {
  const selectors = SELECTORS[key];
  const selectorList = Array.isArray(selectors) ? selectors : [selectors];

  for (const selector of selectorList) {
    const elements = Array.from(root.querySelectorAll<T>(selector));
    if (elements.length > 0) {
      return elements;
    }
  }

  return [];
};
