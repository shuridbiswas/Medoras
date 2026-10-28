# Medoras

**Connect. Learn. Grow. Belong.** | _More than a career. A community that cares._

Medoras is a professional and social network exclusively for the healthcare and social services ecosystem: students, recent graduates, professionals, educators, researchers, mentors, employers and organizations. This is a long-term startup product, not a demo.

## Product vision

Combines LinkedIn-style professional identity, Reddit-style communities and forums, student-to-professional mentorship, research and knowledge sharing, careers and internships, personal stories, local communities, and peer emotional support. Core belief: no one should navigate their education, career or personal challenges alone.

Audience: nursing, medicine, psychology, social work, pharmacy, physiotherapy, occupational therapy, speech-language pathology, audiology, public health and related disciplines, at every career stage.

### Product principles

- Trust first: verified professionals and employers, clear moderation, zero tolerance for harassment.
- Privacy by design: anonymous options, optional and coarse location, patient-confidentiality rules (de-identified cases only).
- Honest limits: community advice does not replace professional care; peer support is not therapy or crisis intervention; AI moderation is not guaranteed to catch everything. Say so in the UI.
- Success should inspire, not breed competition.

### Brand and design

Credible, modern, welcoming and elegant; professional without being cold. Warm paper neutrals, deep teal ink, one clay accent. Fraunces (display) + Public Sans (body). Avoid generic SaaS-landing aesthetics, heavy gradients, glassmorphism, large emojis, stock medical imagery, and copying any existing network's look. Illustrative UI must be labelled as illustrative, never presented as live activity.

## Stack

Next.js (App Router) 16, React 19, TypeScript strict, Tailwind CSS v4, shadcn/ui (base-nova style, Base UI primitives), Lucide icons, Supabase (auth, Postgres, storage; Phase 2+), Vitest + Testing Library, ESLint. Vercel-compatible.

Note: this Next.js version has breaking changes. `AGENTS.md` points at the bundled docs in `node_modules/next/dist/docs/`; read the relevant guide before using an unfamiliar API. Known gotchas: `new Date()` in a prerendered component fails the build; `searchParams` is a Promise; use the global `LayoutProps<"/">` helper types.

## Architecture

```
src/
  app/                 Routes only: layouts, pages, metadata, SEO files
  components/
    ui/                shadcn primitives (do not hand-edit casually)
    layout/            Header, footer, mobile nav, page shell, section primitives
    brand/             Logo and wordmark
  features/<name>/     Feature-oriented code (landing now; auth, profiles, mentorship, etc. later)
  lib/
    site.ts            Site config, navigation and footer links
    supabase/          Typed browser/server clients (not used until Phase 2)
    utils.ts           cn()
```

Conventions:

- Server Components by default; add `"use client"` only for interaction (e.g. `mobile-nav.tsx`).
- Design tokens live in `src/app/globals.css` (`--ink`, `--canvas`, `--surface`, `--sand`, `--clay`, `--teal-50..900`, mapped to shadcn variables). Use token classes (`text-teal-900`, `bg-sand`), not raw hex, in components.
- shadcn components here use Base UI: compose links with `render={<Link href="..." />}`, not `asChild`.
- Keep copy and structured content in `features/<name>/content.ts`, not buried in JSX.
- Accessibility is a requirement: semantic landmarks, labelled sections, visible focus, 4.5:1 contrast, reduced-motion support.

## Coding standards

- TypeScript strict; no `any`. Prefer small readable components over speculative abstractions.
- Never invent credentials. Secrets only via `.env.local` (see `.env.example`); never commit real values.
- Before finishing work: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

## Current scope: Phase 1 (done)

Public welcome page at `/` plus informative placeholder routes: `/login` (no real auth), `/about`, `/community-guidelines`, `/privacy`, `/terms`, `/contact`. Legal pages are explicit placeholders, not real policies. Supabase utilities and `.env.example` are prepared but unused.

Out of scope until later phases: authentication, profiles, mentorship, forums, messaging, jobs, AI features.

## Roadmap

1. **Phase 2:** Supabase auth (sign up, sign in, sessions, middleware), `/login`, onboarding, profile basics, RLS from day one.
2. **Phase 3:** Professional profiles, connections, communities, home feed.
3. **Phase 4:** Mentorship matching, forums (anonymous option), verification badges.
4. **Phase 5:** Careers and employer profiles, articles/research, stories.
5. **Phase 6:** Nearby communities and events, mental-health and peer-support space with human + AI-assisted moderation, reporting/blocking/muting.

Open product questions: professional verification method, anonymity vs. safety design, launch regions (privacy law and crisis resources), handling of minors, MVP cut line.
