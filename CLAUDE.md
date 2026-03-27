# FormPilot

AI-powered form assistant that parses PDF/Word/web forms, explains fields in plain language, and auto-fills from user profile data.

## Tech Stack

- **Framework**: Next.js 15 (App Router) + React 19
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Prisma ORM (PostgreSQL)
- **Auth**: NextAuth v5 (beta)
- **AI**: Anthropic Claude SDK
- **PDF**: pdf-parse (reading), pdf-lib (writing)
- **Word**: mammoth
- **Validation**: Zod

## Architecture

```
src/
├── app/
│   ├── api/          # API routes (Next.js route handlers)
│   ├── dashboard/    # Authenticated dashboard pages
│   ├── login/        # Auth pages
│   ├── layout.tsx    # Root layout
│   └── page.tsx      # Landing page
├── components/
│   └── forms/        # Form-related UI components
├── lib/
│   ├── ai/           # Claude AI integration (field analysis, autofill)
│   ├── auth/         # NextAuth config
│   ├── pdf/          # PDF parsing and generation
│   └── prisma.ts     # Prisma client singleton
├── proxy.ts           # Auth proxy (Next.js 16 convention, replaces middleware.ts)
└── types/            # Shared TypeScript types
prisma/
├── schema.prisma     # Database schema
└── seed.ts           # Seed data
```

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to DB (no migration)
npm run db:migrate   # Create and apply migration
npm run db:studio    # Open Prisma Studio
npm run db:seed      # Seed database
```

## Product Goal

Help users fill complex forms (tax, legal, government, immigration, HR) by:
1. Parsing uploaded PDF/Word forms or detecting web form fields
2. Explaining what each field means with examples
3. Auto-filling from a stored user profile with confidence scores
4. Guided step-by-step fill mode

## Anti-Goals

- No e-signature or notarization
- No multi-party / collaborative filling
- No custom form builder
- No real-time government database lookups

## Key Decisions

- Monorepo (single Next.js app handles both frontend and API)
- Local-first PDF processing where possible (privacy-sensitive form data)
- Claude for field intelligence — not for OCR

## Deploy

- Frontend + API: Vercel
- Database: Railway (PostgreSQL)

## Project Board

GitHub Project #6 — https://github.com/users/wkliwk/projects/6

## Context Log

Append non-obvious decisions to `decisions.jsonl` in the repo root:
```json
{"date":"2026-03-27","decision":"description","why":"reasoning"}
```
