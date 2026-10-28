# Medoras

**Connect. Learn. Grow. Belong.**

A professional and social network for the healthcare and social services community. This repository currently contains Phase 1: the public welcome page and the technical foundation. See [CLAUDE.md](CLAUDE.md) for the product vision, architecture and roadmap.

## Requirements

- Node.js 20.19+ (24 LTS recommended)
- npm

## Run locally

```bash
npm install
cp .env.example .env.local   # optional for Phase 1; no secrets are required
npm run dev
```

Then open http://localhost:3000.

## Scripts

| Command              | Purpose                      |
| -------------------- | ---------------------------- |
| `npm run dev`        | Start the dev server         |
| `npm run build`      | Production build             |
| `npm run start`      | Serve the production build   |
| `npm run lint`       | ESLint                       |
| `npm run typecheck`  | TypeScript (strict) check    |
| `npm test`           | Vitest unit/component tests  |

## Environment variables

See `.env.example`. `NEXT_PUBLIC_SITE_URL` sets the canonical URL for metadata and the sitemap. The Supabase variables are only needed from Phase 2.

## Routes

`/` welcome page, `/login` (placeholder, no authentication yet), `/about`, `/community-guidelines`, `/privacy`, `/terms`, `/contact` (placeholders), plus `/sitemap.xml`, `/robots.txt` and a generated Open Graph image.

## Deploying

Vercel-compatible. Set `NEXT_PUBLIC_SITE_URL` to the production URL.
