import { defineManifest } from '@crxjs/vite-plugin';

const version = process.env.npm_package_version ?? '0.0.0';

export default defineManifest(() => ({
  manifest_version: 3,
  name: 'X-Exporter',
  description: 'Export X.com content to Markdown notes or shareable posters.',
  version,
  action: {
    default_popup: 'src/ui/index.html'
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module'
  },
  permissions: ['downloads', 'storage', 'scripting'],
  host_permissions: ['https://x.com/*', 'https://twitter.com/*', 'https://pbs.twimg.com/*'],
  content_scripts: [
    {
      matches: ['https://x.com/*', 'https://twitter.com/*'],
      js: ['src/content/index.tsx'],
      css: ['src/content/style.css']
    }
  ],
  icons: {
    '16': 'src/icons/icon-16.png',
    '32': 'src/icons/icon-32.png',
    '48': 'src/icons/icon-48.png',
    '128': 'src/icons/icon-128.png'
  },
  web_accessible_resources: [
    {
      resources: [
        'src/assets/fonts/*.woff2',
        'src/assets/fonts/Inter-Regular.woff2',
        'src/assets/fonts/Inter-SemiBold.woff2',
        'src/assets/fonts/Inter-Bold.woff2',
        'src/assets/fonts/NotoSansSC-Regular.woff2',
        'src/assets/fonts/NotoSansSC-Bold.woff2',
        'src/content/style.css'
      ],
      matches: ['<all_urls>']
    }
  ],
  options_page: 'src/ui/index.html'
}));
