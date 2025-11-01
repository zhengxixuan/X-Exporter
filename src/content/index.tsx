import { createRoot, Root } from 'react-dom/client';
import { logger } from '../common/utils/logger';
import { getSelector } from '../common/selectors';
import { throttle, requestIdleCallbackPolyfill, cancelIdleCallbackPolyfill } from '../common/utils/debounce';
import { ExportButton } from './injection/ExportButton';

const ROOT_ATTRIBUTE = 'data-x-exporter-root';
const ROOT_CLASS = 'x-exporter-root';

type RootCache = Map<Element, Root>;

const roots: RootCache = new Map();

function ensureRoot(tweetElement: Element): Root {
  const existingRoot = roots.get(tweetElement);
  if (existingRoot) {
    return existingRoot;
  }

  const container = document.createElement('div');
  container.setAttribute(ROOT_ATTRIBUTE, '');
  container.className = `${ROOT_CLASS} x-exporter-floating-action`;
  tweetElement.appendChild(container);
  const root = createRoot(container);
  roots.set(tweetElement, root);
  return root;
}

function deriveTweetId(tweet: Element | null): string {
  if (!tweet) {
    return 'unknown';
  }

  const attributeId = tweet.getAttribute('data-tweet-id');
  if (attributeId) {
    return attributeId;
  }

  const anchor = tweet.querySelector('a[href*="/status/"]');
  if (!anchor) {
    return 'unknown';
  }

  const match = anchor.getAttribute('href')?.match(/status\/([0-9]+)/);
  return match?.[1] ?? 'unknown';
}

function mountButton(tweetElement: Element): void {
  const tweetId = deriveTweetId(tweetElement);
  const root = ensureRoot(tweetElement);

  root.render(<ExportButton tweetId={tweetId} tweetElement={tweetElement} />);
}

function scanAndMount(context: ParentNode = document): void {
  const tweets = context.querySelectorAll(getSelector('tweetArticle'));
  tweets.forEach((tweet) => {
    const article = tweet as HTMLElement;
    if (article.dataset.xExporterMounted === 'true') {
      return;
    }
    article.dataset.xExporterMounted = 'true';
    mountButton(article);
  });
}

function bootstrap(): void {
  logger.info('Initializing content script');
  scanAndMount();

  let pendingIdleCallback: number | null = null;
  const pendingNodes: Set<HTMLElement> = new Set();

  const processPendingNodes = () => {
    if (pendingNodes.size === 0) {
      return;
    }

    const nodesToProcess = Array.from(pendingNodes);
    pendingNodes.clear();

    for (const node of nodesToProcess) {
      scanAndMount(node);
    }
  };

  const scheduleProcessing = () => {
    if (pendingIdleCallback !== null) {
      cancelIdleCallbackPolyfill(pendingIdleCallback);
    }

    pendingIdleCallback = requestIdleCallbackPolyfill(() => {
      processPendingNodes();
      pendingIdleCallback = null;
    }, { timeout: 1000 });
  };

  const throttledSchedule = throttle(scheduleProcessing, 300);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) {
          return;
        }
        pendingNodes.add(node);
      });
    }

    if (pendingNodes.size > 0) {
      throttledSchedule();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}
