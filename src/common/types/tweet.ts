export interface TweetStats {
  likes: number;
  retweets: number;
  replies: number;
  bookmarks: number;
}

export interface TweetData {
  tweetId: string;
  authorName: string;
  authorHandle: string;
  avatarUrl: string;
  timestamp: string; // ISO 8601
  textContentHtml: string;
  imageUrls: string[];
  videoThumbnailUrl?: string;
  stats: TweetStats;
  tweetUrl: string;
  quotedTweet?: TweetData;
  isThreadStart: boolean;
}

export type TweetClassification = {
  isSingle: boolean;
  isThreadStart: boolean;
  hasQuote: boolean;
};
