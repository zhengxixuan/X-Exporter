# X-Exporter Extension

Manifest V3 extension that injects export capabilities into X.com (Twitter) timelines. Built with Vite, React, and TypeScript.

## Current Capabilities

- Context-aware export button per tweet with Markdown (single or thread) and poster options.
- Markdown export includes required metadata, quote blocks, and image handling with copy/download actions.
- Poster preview enforces bundled fonts, QR code, and image proxying for consistent sharing output.

## Getting Started

```bash
npm install
npm run dev
```

- `npm run dev`: launches Vite in watch mode for extension assets.
- `npm run build`: produces a production build in `dist/`.
- `npm run smoke`: runs linting, type checking, and the Vitest suite.

Load the unpacked extension from the `dist` directory via Chrome's extensions page after running `npm run build`.

## Project Structure

- `src/background`: service worker entry point for downloads and cross-origin tasks.
- `src/content`: content script that injects UI into tweets.
- `src/ui`: React application used for popup/options surfaces.
- `src/common`: shared utilities, types, and selectors.
- `src/assets/fonts`: bundle fonts to guarantee poster typography.

Refer to `PRD.md` for functional specification and roadmap.

Additional sprint notes and smoke test outcomes are tracked in `docs/`.
