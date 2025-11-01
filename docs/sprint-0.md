# Sprint 0 — Project Scaffold

## Objectives
- Establish Manifest V3 + Vite + React + TypeScript project foundation.
- Prepare directory structure for background, content script, UI, and shared modules.
- Install baseline runtime dependencies (`react`, `turndown`, `html2canvas`, `file-saver`, `qrcode`).
- Configure developer tooling (ESLint, Prettier, Vitest, TypeScript strict mode).
- Stub key extension entry points and shared types in alignment with PRD expectations.

## Deliverables
- `manifest.config.ts` describing MV3 capabilities and resource access.
- Content script bootstrap that injects an "导出" button into tweet action bars.
- Background service worker scaffold with message handling placeholder.
- Popup/options React shell (`src/ui`) for future configuration surfaces.
- Shared `TweetData` model, selectors registry, and logger utility.
- Placeholder font + icon assets with instructions for replacement.

## Smoke Test

Command: `npm run smoke`

Composition:
1. `npm run lint` — ESLint over `src/**/*.{ts,tsx}` using TypeScript + React rules.
2. `npm run typecheck` — TypeScript `--noEmit` verification across the project.
3. `npm run test:ci` — Vitest run with `jsdom` environment, currently covering UI stubs.

Result (2025-02-14): ✅ Passed locally.

## Next Sprint Preview
- Implement thread detection heuristics and context menu logic.
- Build Markdown generation pipeline and clipboard/download flows.
- Expand test coverage with DOM scraping unit tests and messaging integration harness.
