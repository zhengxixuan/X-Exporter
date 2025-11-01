import { beforeEach, describe, expect, it, vi } from 'vitest';
import { collectThreadTweets } from './threadCollector';

const buildTweetArticle = (id: string, timestamp: string) => {
  const template = document.createElement('div');
  template.innerHTML = `
    <article data-testid="tweet" data-tweet-id="${id}">
      <div data-testid="User-Name">
        <span>Alice</span>
        <span>@alice</span>
      </div>
      <a href="https://x.com/alice/status/${id}">
        <time datetime="${timestamp}"></time>
      </a>
      <div data-testid="tweetText">
        <span>Tweet ${id}</span>
      </div>
      <button data-testid="like" aria-label="${Number(id) * 2} Likes"></button>
      <button data-testid="retweet" aria-label="${Number(id)} Retweets"></button>
      <a href="https://x.com/alice/status/${id}/analytics" aria-label="${Number(id) * 10} Views"></a>
    </article>
  `;

  return template.querySelector('article[data-testid="tweet"]') as HTMLElement;
};

beforeEach(() => {
  document.body.innerHTML = '';
  const scrollMock = vi.fn();
  Object.defineProperty(window, 'scrollBy', {
    value: scrollMock,
    writable: true
  });
});

describe('collectThreadTweets', () => {
  it('collects tweets from the same author and emits progress updates', async () => {
    const start = buildTweetArticle('1', '2025-02-14T12:00:00.000Z');
    const second = buildTweetArticle('2', '2025-02-14T12:05:00.000Z');
    const otherAuthor = document.createElement('article');
    otherAuthor.setAttribute('data-testid', 'tweet');
    otherAuthor.setAttribute('data-tweet-id', '99');
    otherAuthor.innerHTML = `
      <div data-testid="User-Name">
        <span>Bob</span>
        <span>@bob</span>
      </div>
      <a href="https://x.com/bob/status/99">
        <time datetime="2025-02-14T11:00:00.000Z"></time>
      </a>
      <div data-testid="tweetText">Other author</div>
      <button data-testid="like" aria-label="1 Like"></button>
      <button data-testid="retweet" aria-label="0 Retweets"></button>
      <a href="https://x.com/bob/status/99/analytics" aria-label="5 Views"></a>
    `;

    document.body.appendChild(start);
    document.body.appendChild(second);
    document.body.appendChild(otherAuthor);

    const progressSnapshots: number[] = [];

    const result = await collectThreadTweets(start, {
      maxTweets: 5,
      maxScrollAttempts: 1,
      waitForLoadMs: 0,
      scrollDelta: 0,
      onProgress: ({ count, complete }) => {
        if (!complete) {
          progressSnapshots.push(count);
        }
      }
    });

    expect(result.tweets).toHaveLength(2);
    expect(result.tweets[0].tweetId).toBe('1');
    expect(result.tweets[1].tweetId).toBe('2');
    expect(progressSnapshots[0]).toBeGreaterThanOrEqual(1);
    expect(progressSnapshots).toContain(2);
  });
});
