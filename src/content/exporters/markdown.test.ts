import { describe, expect, it } from 'vitest';
import type { TweetData } from '../../common/types/tweet';
import { generateMarkdown } from './markdown';

const baseTweet = (): TweetData => ({
  tweetId: '1',
  authorName: 'Alice',
  authorHandle: 'alice',
  avatarUrl: 'https://example.com/avatar.jpg',
  timestamp: '2025-02-14T12:00:00.000Z',
  textContentHtml: '<p>Hello <strong>World</strong></p>',
  imageUrls: [],
  stats: {
    likes: 10,
    retweets: 2,
    replies: 3,
    bookmarks: 5
  },
  tweetUrl: 'https://x.com/alice/status/1',
  quotedTweet: undefined,
  isThreadStart: false
});

describe('generateMarkdown', () => {
  it('renders single tweet with YAML frontmatter', () => {
    const markdown = generateMarkdown(baseTweet());

    // Check YAML frontmatter
    expect(markdown).toMatch(/^---/);
    expect(markdown).toMatch(/title: "Tweet by Alice"/);
    expect(markdown).toMatch(/author: "Alice"/);
    expect(markdown).toMatch(/handle: "@alice"/);
    expect(markdown).toMatch(/source: "X \(Twitter\)"/);
    expect(markdown).toMatch(/tweet_id: "1"/);
    expect(markdown).toMatch(/url: "https:\/\/x\.com\/alice\/status\/1"/);
    expect(markdown).toMatch(/created: "2025-02-14T12:00:00\.000Z"/);
    expect(markdown).toMatch(/exported:/);
    expect(markdown).toMatch(/likes: 10/);
    expect(markdown).toMatch(/retweets: 2/);
    expect(markdown).toMatch(/tags:/);
    expect(markdown).toMatch(/- twitter/);
    expect(markdown).toMatch(/- x-exporter/);

    // Check markdown body
    expect(markdown).toMatch(/\*\*World\*\*/);

    // Check footer
    expect(markdown).toMatch(/Exported with \[X-Exporter\]/);
  });

  it('renders thread with YAML frontmatter and section headers', () => {
    const first = baseTweet();
    const second: TweetData = {
      ...baseTweet(),
      tweetId: '2',
      textContentHtml: '<p>Second tweet</p>',
      timestamp: '2025-02-14T12:05:00.000Z',
      stats: {
        likes: 5,
        retweets: 1,
        replies: 2,
        bookmarks: 4
      },
      tweetUrl: 'https://x.com/alice/status/2'
    };

    const markdown = generateMarkdown([first, second]);

    // Check YAML frontmatter for first tweet
    expect(markdown).toMatch(/^---/);
    expect(markdown).toMatch(/title: "Tweet by Alice"/);
    expect(markdown).toMatch(/author: "Alice"/);
    expect(markdown).toMatch(/source: "X \(Twitter\)"/);

    // Check thread header
    expect(markdown).toMatch(/# Thread \(2 tweets\)/);

    // Check second tweet header (new format)
    expect(markdown).toMatch(/## Tweet 2/);
    expect(markdown).toMatch(/Second tweet/);

    // Check footer
    expect(markdown).toMatch(/Exported with \[X-Exporter\]/);

    // Should have multiple separators
    expect(markdown.split('---').length).toBeGreaterThan(2);
  });
});
