# Getting started

## Requirements

- Node.js 20+
- npm

## Setup

```bash
git clone https://github.com/Gjusev/new_nexary.git
cd new_nexary
npm ci
npm run dev
```

Open [localhost:3000/de](http://localhost:3000/de), `/en` or `/es`. German
is the default locale when none is chosen.

## Connect the platform handoff

Login and registration CTAs point to one configurable base URL. Create
`.env.local` in the project root:

```dotenv
NEXT_PUBLIC_APP_URL=https://app.example.com
```

`NEXT_PUBLIC_APP_URL` is a public, build-time variable: it is bundled into
the frontend when `next build` runs, so changing it requires a rebuild.

## Checks

```bash
npm run lint
npm run typecheck
npm run build
```

## Production

```bash
npm run build
npm run start
```

The current deployment uses `next build` + `next start`, including locale
middleware and the response headers configured in `next.config.ts`. A plain
static export is not configured.
