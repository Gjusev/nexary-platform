# Contributing

Thanks for your interest. This repository is a portfolio export of a
client-deployed platform — issues and discussions are welcome, but feature
development happens on the private deployment.

## Ground rules

- **No secrets, ever.** Env vars only. A PR that hardcodes a key, token,
  host or password will be closed.
- **No client-identifying material.** Real names, hostnames, IPs, documents
  and screenshots from the deployment do not belong here.
- Match the existing stack: Next.js App Router, TypeScript strict mode,
  server actions for mutations.

## Development

```bash
bun install
cp .env.example .env    # fill in local service endpoints
bun run dev
```

Gates: `bun run lint` · `bun run typecheck` · tests where configured.
