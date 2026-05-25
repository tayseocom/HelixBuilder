# Deploying to Cloudflare Pages

This project's frontend is a static Vite + React SPA and can be deployed to Cloudflare Pages. The Express server in `server/` is not required in production — the app stores all state in browser `localStorage` and makes no calls to `/api/*`.

## Cloudflare Pages build settings

| Setting | Value |
| --- | --- |
| Framework preset | None (or "Vite") |
| Build command | `npm run build` |
| Build output directory | `dist/public` |
| Root directory | (leave empty — repo root) |
| Node version | `20` (set env var `NODE_VERSION=20`) |

`npm run build` runs `vite build` (which produces the static SPA in `dist/public`) followed by an `esbuild` step that bundles the unused server. The server bundle is harmless and can be ignored — Cloudflare Pages only serves the contents of `dist/public`.

## SPA routing

`client/public/_redirects` ships a catch-all rewrite so that client-side routes handled by `wouter` resolve correctly on hard reloads:

```
/*    /index.html   200
```

Vite copies this file into `dist/public/_redirects` at build time.

## Local verification

```bash
npm run build
npx serve dist/public      # or any static file server
```

Open the served URL and confirm the preset generator loads with no network requests to `/api/*`.
