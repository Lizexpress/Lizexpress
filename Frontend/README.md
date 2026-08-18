# LizExpress Web

React 18 + Vite frontend for the LizExpress swap marketplace. Pure JavaScript
(JSX), no TypeScript. Consumes the same API as the forthcoming mobile app.

```bash
cp .env.example .env    # fill in the values
npm install
npm run dev             # http://localhost:5173
```

`npm run dev` proxies `/api` to `http://localhost:8080`, so run the backend
alongside it and leave `VITE_API_URL` at its relative default.

---

## Brand tokens (locked)

Carried over from v1 unchanged. `tailwind.config.js` derives every tint and
shade from these two hexes so hover, disabled, and surface states stop being
invented per component.

| Token | Hex | Role |
|---|---|---|
| `purple-600` | `#4A0E67` | Primary — structure, headers, nav |
| `purple-700` | `#3A0B50` | Primary pressed |
| `orange-500` | `#F7941D` | Accent — **actions only** |
| `orange-600` | `#E68A1C` | Accent pressed |
| `orange-50` | `#FFF5E6` | Warm surface |

The discipline that keeps it from looking generic: purple carries structure,
orange is reserved strictly for the one action that moves a user forward. If
two orange buttons appear on a screen, one of them is wrong.

**Type:** Clash Display for headings, Satoshi for body — both from Fontshare,
loaded async via the print/onload swap so they never block first paint.

**Brand assets:** the logo, favicons, and the nine hero banners all come from
the v1 repo. See `../brand-assets/README.md` — the masters are kept out of
`public/` on purpose.

**Signature element:** the swap pair. Every listing renders *what you have* ↔
*what you want*, joined by a hand-drawn exchange glyph (`SwapGlyph.jsx`). A
barter listing is not a product listing, and the card is built to say so.

---

## Structure

```
src/
├── lib/          api client, realtime loader, formatters
├── context/      AuthContext (state machine), ToastContext
├── hooks/        realtime, notifications, push, debounce
├── components/
│   ├── ui/       Button, Input, Card, Modal, Badge, Avatar, Skeleton…
│   ├── layout/   Header, Footer, MobileNav, AppLayout
│   └── items/    SwapGlyph, ItemCard, ItemGrid
├── pages/        public, auth, dashboard
├── admin/        console — layout, DataTable, 9 screens
└── routes/       RequireAuth / RequireVerified / RequireStaff
```

### The API client

`lib/api.js` is the only file that talks HTTP. It unwraps the
`{ success, data, meta }` envelope, converts errors into an `ApiError` exposing
`fieldErrors` ready to drop into a form, and refreshes an expired access token
then replays the request once. Concurrent 401s share a single refresh promise —
otherwise five parallel requests would fire five refreshes and invalidate each
other.

Screens import from the `endpoints` map rather than writing URL strings, so
renaming a route is one edit.

### Auth state

`AuthContext` exposes `status` as `'loading' | 'authenticated' | 'anonymous'`
rather than a pair of booleans. Guards render a loader while loading instead of
redirecting, which is what removes the flash of the login screen before a
signed-in user's page appears.

---

## Routing

All 36 routes resolve, and every internal link target was verified against the
route tree — no link renders and then 404s. `routes/routeMap.js` owns the lazy
loaders, and both `App.jsx` and the prefetcher import the same functions, so a
prefetch and the later navigation share one module promise.

**Loading delay is handled in two layers:**

1. **Intent prefetch.** `SmartLink` warms the destination chunk on
   `mouseEnter`, `focus`, and `touchStart`. That buys 100–300ms on desktop and
   ~80ms on a tap — usually enough that the route is already in memory and the
   loading fallback never renders.
2. **Idle prefetch.** Once the browser is idle, `prefetchLikelyRoutes` warms
   the next likely destinations (browse/login/register when signed out;
   browse/dashboard/chats when signed in). Waiting for idle keeps it from
   competing with the current page's own work.

`/payment/callback` and `/404` are deliberately excluded — they are reached by
redirect, never by a hovered link, so a prefetch entry would buy nothing.

## Design system

One token set drives both the marketplace and the admin console, so they cannot
drift into two different products.

| Decision | Why |
|---|---|
| Ink softened `#1A1420` → `#241C2C`, body copy at `ink-soft` | Near-black at body size reads as a heavy slab. Headings keep full-strength ink; running it everywhere flattens hierarchy |
| Headings at weight 600, not 700 | 700 everywhere removes the difference between a page title and a card title |
| Layered low-opacity shadows (`card` / `hover` / `lift`) | A single dark drop shadow reads as a smudge; layered ones read as elevation |
| `.card` / `.card-interactive` in the base layer | Hover lift only where the whole surface is a link. A lift on a static panel is noise |
| Display fallback is system sans, never Georgia | If Fontshare is slow or blocked, headings degrade to sans — a serif fallback changes the page's whole character |
| No raw hex in components | Every colour goes through a token, so a palette change is one edit |

## Hero sizing

The nine banners are finished artwork with the headline baked into the image,
so they can never be cropped — a crop cuts the message off. They are a fixed
1600x900 (16:9), and that constrains what "full width" can mean:

| Viewport | True 16:9 height | Cropped away if forced to 600px tall |
|---|---|---|
| 1280 | 719px | 17% |
| 1440 | 809px | 26% |
| 1920 | 1079px | 44% |

Genuine edge-to-edge at 1920 would be a 1080px-tall hero, taller than the
viewport. So the section is full-bleed, but the *artwork* is not stretched to
fill it:

- The slide keeps its exact 16:9 ratio, capped at 1280px wide — effectively
  full width on a laptop, and 720px tall at most.
- The full-width band behind it carries a blurred, scaled copy of the current
  slide, so the colour runs edge to edge and changes with the slide.
- The slide's left and right edges are feathered into that backdrop with a mask,
  so there is no visible seam between artwork and band.

An earlier version clamped `max-h` instead, which let the frame stretch to
2.4:1 at 1440 and 3.2:1 at 1920 while `object-cover` sliced the top and bottom
off every slide — the headline was being cut out on desktop. Below the cap
nothing changed, which is why phones always looked right.

`object-contain` is the safety net: a future slide that is not exactly 16:9
letterboxes rather than silently losing artwork. The backdrop renders only from
`lg` upward, since below the cap there is no band to fill.

## Performance

Measured on the production build:

| | Raw | Gzipped |
|---|---|---|
| Initial JS | 235 KB | **75 KB** |
| Hero LCP image | 74 KB | — (already compressed) |
| CSS | 41 KB | 8 KB |

Three decisions do most of that work:

1. **Every route is lazy.** The landing page does not carry the admin console or
   the chat client.
2. **Recharts is not manually chunked.** Naming it as a manual chunk pulled it
   into the entry's preload graph — every shopper was downloading 380KB of
   charting for an admin screen they never open. Left to Vite, it lands in the
   `AdminDashboard` chunk where it belongs.
3. **Supabase loads on demand.** The realtime SDK is ~215KB and is only needed
   once a signed-in user subscribes to a channel, so it sits behind a dynamic
   import. Anonymous visitors never download it.

Fonts load async with `display=swap`; hashed assets are cached for a year while
`index.html` and `sw.js` are never cached.

---

## Realtime and push

Clients hold one WebSocket to Supabase Realtime; the API broadcasts into
channels over HTTP. See `../backend/docs/REALTIME.md` for why a `ws` server on
a serverless platform is not possible.

Web Push is a **free browser standard** — no AWS, no third-party service, no
billing. You generate a VAPID keypair once (`npx web-push generate-vapid-keys`)
and the browser vendor's push service delivers the message. Everything degrades
safely: if the SDK fails, push is unconfigured, or the user denies permission,
notifications still arrive in-app and by email.

---

## Deploying to Vercel

```bash
npm i -g vercel
vercel login
vercel link
vercel env add VITE_API_URL production      # https://api.lizexpressltd.com/api/v1
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_ANON_KEY production
vercel --prod
```

`vercel.json` sets the Vite framework preset, the SPA rewrite, cache headers,
and security headers. Add the web origin to `CORS_ORIGINS` on the API.

**Vite env vars are baked in at build time, not read at runtime.** Changing
`VITE_API_URL` in the dashboard does nothing until you redeploy. If the app
starts calling the wrong API after an env change, that is why.

Only `VITE_`-prefixed variables reach the browser, and everything with that
prefix is public by definition — the Supabase anon key is fine there, the
service-role key never is.

### The SPA rewrite

```
/((?!assets/|.*\.[a-zA-Z0-9]+$).*)   →   /index.html
```

A blanket `/(.*)` rewrite would swallow real files and serve HTML for
`/sw.js`, breaking push registration with a MIME-type error. The negative
lookahead excludes `/assets/*` and anything with a file extension, so hashed
bundles, the service worker, the manifest, and icons pass straight through
while every application route still resolves on a hard refresh or shared link.

### Assets still needed

Drop these into `public/` before going live — they are referenced by
`index.html` and `manifest.json`:

`favicon.ico` · `favicon-32x32.png` · `apple-touch-icon.png` ·
`android-chrome-192x192.png` · `android-chrome-512x512.png` · `preview.png` (OG image)

The backend separately needs hosted email images at `{APP_URL}/email-assets/`:
`logo-white.png` and `social-{instagram,facebook,x,linkedin,whatsapp}.png`.
Outlook will not render inline SVG, which is why these must be PNGs.

---

## Accessibility floor

Not optional, and already in place: visible keyboard focus everywhere, a skip
link, focus trapped and restored in modals, `aria-live` toasts, labelled form
fields wired to their errors via `aria-describedby`, 44px minimum tap targets,
and `prefers-reduced-motion` respected globally.
