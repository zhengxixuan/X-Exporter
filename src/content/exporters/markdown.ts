import TurndownService from 'turndown';
import type { TweetData } from '../../common/types/tweet';
import { logger } from '../../common/utils/logger';

const turndown = new TurndownService({ codeBlockStyle: 'fenced' });

const formatTimestamp = (iso: string): string => {
  try {
    const formatter = new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    return formatter.format(new Date(iso));
  } catch (error) {
    logger.debug('格式化时间失败，使用原始值', error);
    return iso;
  }
};

const renderImages = (tweet: TweetData): string => {
  if (!tweet.imageUrls.length) {
    return '';
  }

  return tweet.imageUrls.map((url) => `![](${url})`).join('\n');
};

const indentQuote = (markdown: string): string =>
  markdown
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');

const renderTweetMarkdown = (tweet: TweetData): string => {
  const content = turndown.turndown(tweet.textContentHtml || '');
  const images = renderImages(tweet);

  let result = content;
  if (images) {
    result = `${result}\n\n${images}`;
  }

  if (tweet.quotedTweet) {
    const quotedMarkdown = renderTweetMarkdown(tweet.quotedTweet);
    result = `${result}\n\n${indentQuote(quotedMarkdown)}`;
  }

  return result;
};

const buildYamlFrontmatter = (tweet: TweetData): string => {
  const yaml = [
    '---',
    `title: "Tweet by ${tweet.authorName}"`,
    `author: "${tweet.authorName.replace(/"/g, '\\"')}"`,
    `handle: "@${tweet.authorHandle}"`,
    `source: "X (Twitter)"`,
    `tweet_id: "${tweet.tweetId}"`,
    `url: "${tweet.tweetUrl}"`,
    `created: "${tweet.timestamp}"`,
    `exported: "${new Date().toISOString()}"`,
    'stats:',
    `  likes: ${tweet.stats.likes}`,
    `  retweets: ${tweet.stats.retweets}`,
    `  replies: ${tweet.stats.replies}`,
    `  bookmarks: ${tweet.stats.bookmarks}`,
    'tags:',
    '  - twitter',
    '  - x-exporter',
    '---'
  ];

  return yaml.join('\n');
};

const buildThreadTweetHeader = (tweet: TweetData, index: number): string => {
  return [
    `## Tweet ${index + 1}`,
    '',
    `**Author:** ${tweet.authorName} (@${tweet.authorHandle})`,
    `**Time:** ${formatTimestamp(tweet.timestamp)}`,
    `**URL:** ${tweet.tweetUrl}`,
    `**Stats:** ❤️ ${tweet.stats.likes} | 🔁 ${tweet.stats.retweets} | 💬 ${tweet.stats.replies} | 🔖 ${tweet.stats.bookmarks}`,
    ''
  ].join('\n');
};

export const generateMarkdown = (input: TweetData | TweetData[]): string => {
  const tweets = Array.isArray(input) ? input : [input];

  if (tweets.length === 1) {
    // Single tweet: use YAML frontmatter
    const frontmatter = buildYamlFrontmatter(tweets[0]);
    const body = renderTweetMarkdown(tweets[0]);

    return `${frontmatter}\n\n${body}\n\n---\n\n*Exported with [X-Exporter](https://github.com/zhengxixuan/X-Exporter)*\n`;
  }

  // Thread: use YAML frontmatter for first tweet, then headers for subsequent tweets
  const sections: string[] = [];

  // First tweet with frontmatter
  const frontmatter = buildYamlFrontmatter(tweets[0]);
  const firstBody = renderTweetMarkdown(tweets[0]);
  sections.push(`${frontmatter}\n\n# Thread (${tweets.length} tweets)\n\n${firstBody}`);

  // Subsequent tweets with headers
  for (let i = 1; i < tweets.length; i++) {
    const header = buildThreadTweetHeader(tweets[i], i);
    const body = renderTweetMarkdown(tweets[i]);
    sections.push(`${header}${body}`);
  }

  sections.push('\n---\n\n*Exported with [X-Exporter](https://github.com/zhengxixuan/X-Exporter*');

  return sections.join('\n\n---\n\n');
};
