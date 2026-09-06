# Bar-app v2

PocketBase + SvelteKit rebuild of the bar-app, per `bar-app-spec.md`
(feature decisions in `bar-app-inventory.md`; the legacy PHP app lives in the old `bar-app` repo).

```
├── pocketbase/       # backend: migrations (schema) + hooks (server logic)
│   ├── pb_migrations/
│   └── pb_hooks/
└── app/              # SvelteKit PWA (till + admin)
```

## Backend

1. Fetch the pinned PocketBase binary (not committed) into `pocketbase/`:
   `./deploy/get-pocketbase.sh` — verifies the release checksum and detects OS/arch.
   Upgrades later: `cd pocketbase && ./pocketbase update`, then restart the service.
2. First run: `cd pocketbase && ./pocketbase serve` — migrations create all collections
   and seed the settings record. Create a superuser with the link it prints
   (the superuser is only for the PocketBase admin UI at `/_/`).
3. In the admin UI:
   - **Settings → Mail settings**: point SMTP at a relay (Brevo, Resend, or the club's
     provider). Without this, mail uses the host sendmail — spam-folder territory.
   - Create the first app users in the `users` collection; give at least one
     `role = admin` and `active = true`. Fill IBAN/account holder in `settings`
     to enable the top-up QR.

## Frontend

```sh
cd app
npm install
npm run dev        # against PUBLIC_PB_URL from .env (default http://127.0.0.1:8090)
```

Production: `npm run build` produces a static SPA in `build/`. Either serve it from
any static host, or copy it into `pocketbase/pb_public/` so the single PocketBase
process serves both API and app:

```sh
npm run build && rm -rf ../pocketbase/pb_public && cp -r build ../pocketbase/pb_public
```

## Server endpoints (pb_hooks)

- `POST /api/bar/order` `{user, product, qty}` — transactional order + stock + balance; sends the red-alert mail on crossing the threshold.
- `POST /api/bar/topup` `{user, amount}` — admin-only; payment record + balance.
- `POST /api/bar/stock-count` `{product, counted}` — admin-only; books the correction delta.
- `GET/POST /api/bar/mail-debtors/{red|yellow}` — admin-only; GET previews recipients, POST sends.
- Cron `daily-digest` (21:30 UTC ≈ 23:30 NL in summer) — per-user summary of the day's orders, flagging orders booked by someone else.

## Notes

- Login is email-OTP only; auth tokens last 1 year (the old "cookie" behaviour).
- PocketBase still requires a password when *creating* a user record — generate a
  random one (it can never be used to log in, since password auth is disabled).
- `app/.env` is gitignored; copy `app/.env.example` and adjust `PUBLIC_PB_URL`.
- `users.balance` is server-managed: API rules reject any client write to it.
- Admin screens under `/admin` are stubs except the menu — next build step.
