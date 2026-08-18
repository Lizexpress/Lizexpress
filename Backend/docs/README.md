# API Documentation

The OpenAPI contract lives here as YAML — **not** as annotations inside
application code. That was a deliberate requirement: the contract can be
reviewed, diffed, and handed to the mobile team without reading the
implementation.

## Layout

```
docs/
├── openapi.yaml              root document: info, servers, tags, security
├── openapi.bundled.yaml      generated — do not edit by hand
├── REALTIME.md               WebSocket + Web Push guide
├── components/
│   ├── schemas.yaml          29 shared schemas
│   ├── responses.yaml        reusable error responses
│   └── parameters.yaml       pagination and path params
└── paths/
    ├── _index.yaml           aggregator, referenced by openapi.yaml
    ├── auth.yaml             11 endpoints
    ├── users.yaml            4
    ├── items.yaml            8
    ├── chats.yaml            7
    ├── verifications.yaml    3
    ├── payments.yaml         6
    ├── notifications.yaml    8
    ├── admin.yaml            25
    └── system.yaml           3
```

**84 documented operations across 75 paths.**

## Working with it

```bash
npm run docs:bundle   # resolve into openapi.bundled.yaml
npm run dev           # bundles, then serves Swagger UI at /docs
```

Browse the live docs at `https://api.lizexpressltd.com/docs`, or fetch the raw
spec from `/openapi.json` to generate a client:

```bash
# Example: a Dart client for the mobile app
openapi-generator-cli generate -i https://api.lizexpressltd.com/openapi.json -g dart-dio -o ./mobile-client
```

## Adding an endpoint

1. Add the operation to the relevant file in `paths/`.
2. Register its path in `paths/_index.yaml` (JSON-pointer escaping: `/` is `~1`).
3. Reference shared shapes with `$ref: '#/components/schemas/...'` rather than
   inlining a new object — the mobile team generates types from these.
4. Run `npm run docs:bundle` to confirm it resolves.

The bundler fails loudly on a dangling reference, so a broken spec cannot reach
production.
