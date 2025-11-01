import { describe, expect, it, beforeEach } from 'vitest';
import { classifyTweet, scrapeTweetData } from './tweetScraper';

const buildTweetArticle = () => {
  const template = document.createElement('div');
  template.innerHTML = `
    <article data-testid="tweet" data-tweet-id="123">
      <div data-testid="User-Name">
        <span>Alice</span>
        <span>@alice</span>
      </div>
      <a href="https://x.com/alice/status/123">
        <time datetime="2025-02-14T12:00:00.000Z"></time>
      </a>
      <div data-testid="tweetText">
        <span>Hello <strong>World</strong></span>
      </div>
      <button data-testid="reply" aria-label="3 Replies"></button>
      <button data-testid="bookmark" aria-label="4 Bookmarks"></button>
      <div data-testid="tweetPhoto">
        <img src="https://pbs.twimg.com/media/123.jpg" />
      </div>
      <div data-testid="tweet">
        <article data-testid="tweet" data-tweet-id="456">
          <div data-testid="User-Name">
            <span>Bob</span>
            <span>@bob</span>
          </div>
          <a href="https://x.com/bob/status/456">
            <time datetime="2025-02-14T11:58:00.000Z"></time>
          </a>
          <div data-testid="tweetText">Quoted content</div>
          <button data-testid="like" aria-label="5 Likes"></button>
          <button data-testid="retweet" aria-label="1 Retweet"></button>
          <a href="https://x.com/bob/status/456/analytics" aria-label="10 Views"></a>
        </article>
      </div>
      <button data-testid="like" aria-label="10 Likes"></button>
      <button data-testid="retweet" aria-label="2 Retweets"></button>
      <button data-testid="reply" aria-label="3 Replies"></button>
      <button data-testid="bookmark" aria-label="4 Bookmarks"></button>
    </article>
  `;

  return template.querySelector('article[data-testid="tweet"]') as HTMLElement;
};

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('scrapeTweetData', () => {
  it('extracts core fields and quoted tweet', () => {
    const article = buildTweetArticle();
    document.body.appendChild(article);

    const data = scrapeTweetData(article);

    expect(data.authorName).toBe('Alice');
    expect(data.authorHandle).toBe('alice');
    expect(data.stats.likes).toBe(10);
    expect(data.imageUrls).toHaveLength(1);
    expect(data.quotedTweet?.authorHandle).toBe('bob');
    expect(data.stats.replies).toBe(3);
    expect(data.stats.bookmarks).toBe(4);
  });
});

describe('classifyTweet', () => {
  it('detects quotes and non-thread tweets', () => {
    const article = buildTweetArticle();
    document.body.appendChild(article);

    const classification = classifyTweet(article);
    expect(classification.hasQuote).toBe(true);
    expect(classification.isThreadStart).toBe(false);
  });
});
