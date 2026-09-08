# Bar-app

A self-hosted bar tab ("strepen") app for clubhouses: members mark their own
drinks on their phone, balances update instantly, and settling up happens by
bank transfer via a QR code. Built for a Dutch scouting group's bar, so the UI
is in Dutch; the code and docs are in English.

**Stack:** [PocketBase](https://pocketbase.io) (single binary, SQLite,
migrations + server hooks in JS) serving a [SvelteKit](https://svelte.dev)
PWA from `pb_public/`. One process, no Node on the server, deploys are
`git pull`.

## Features

- **Passwordless login** — email OTP code, sessions last a year. No passwords
  exist anywhere.
- **Personal tab** — product grid with brand accents, tap → quantity →
  confirm; shows old → new balance with yellow/red warning thresholds.
- **Strepen voor een ander** — a one-time "I'm marking for…" flow via a
  first-letter name grid. Your login stays your own; the order records who
  booked it and you return to your own tab afterwards.
- **Ik trakteer (party mode)** — anyone can start a treat round with an
  optional message, drink cap, and duration (1–24h). While rounds run, the
  order confirmation offers "on <host>'s tab" per active round; multiple
  rounds can run at once (one per host). The host or an admin can stop early.
- **Top-up by QR** — the app renders an EPC069-12 (SEPA credit transfer) QR
  code with the club's IBAN and a fixed remittance text; members scan it with
  their banking app. An admin books the payment when reconciling the bank
  statement.
- **Balance emails** — a red-alert mail when a tab crosses the configured
  threshold, admin-triggered debtor mails (with preview), and an optional
  daily digest of each member's orders — flagging ones booked by someone else.
- **Admin** — products (with stock tracking), users, top-up booking, stock
  deliveries and counts, sales reports, mail templates, and app settings
  (title, thresholds, IBAN, digest) — all in-app; the PocketBase admin UI is
  only needed for initial setup.
- **Installable PWA** — add-to-homescreen till behaviour, including a
  stale-build reload check when iOS resumes a docked app.

All money-touching operations (orders, top-ups, stock) run in a single
database transaction server-side (`pb_hooks/`), and `users.balance` is
server-managed — API rules reject client writes.

## Repository layout

```
├── pocketbase/         # backend + production artifact
│   ├── pb_migrations/  #   schema + seed (creates everything on first run)
│   ├── pb_hooks/       #   server logic: routes, cron, guards
│   └── pb_public/      #   committed SvelteKit build (served by PocketBase)
├── app/                # SvelteKit PWA source
└── deploy/             # example nginx + supervisor configs, PB fetch script
```

## Installing

1. Fetch the pinned PocketBase binary (not committed) into `pocketbase/`:

   ```sh
   ./deploy/get-pocketbase.sh   # verifies the release checksum, detects OS/arch
   ```

2. First run:

   ```sh
   cd pocketbase && ./pocketbase serve
   ```

   Migrations create all collections and seed the settings record. Create a
   superuser with the link it prints (only used for the PocketBase admin UI
   at `/_/`).

3. In the PocketBase admin UI:
   - **Settings → Mail settings** — point SMTP at a relay (Brevo, Resend,
     your provider). Without this, mail goes through host sendmail —
     spam-folder territory.
   - Create the first app users in the `users` collection; give at least one
     `role = admin` and `active = true`. PocketBase requires a password when
     creating a user record — generate a random one; it can never be used to
     log in, since password auth is disabled.

4. Log in to the app with that admin account and finish configuration under
   **Beheer → Instellingen** (title, thresholds, IBAN + account holder for the
   top-up QR, mail templates).

### Production

See `deploy/` for an example nginx vhost (reverse proxy with SSE support) and
supervisor program. PocketBase serves both the API and the committed frontend
build, so a deploy is:

```sh
git pull                      # + ./pocketbase migrate up and a service
                              #   restart when backend files changed
```

## Development

```sh
cd app
npm install
npm run dev     # against PUBLIC_PB_URL from .env (default http://127.0.0.1:8090)
```

`app/.env` is gitignored; copy `app/.env.example` and adjust `PUBLIC_PB_URL`
if your PocketBase runs elsewhere. Run a local PocketBase alongside
(`cd pocketbase && ./pocketbase serve`).

After frontend changes, refresh the committed build:

```sh
npm run build && rm -rf ../pocketbase/pb_public && cp -r build ../pocketbase/pb_public
```

(`app/.env.production` pins `PUBLIC_PB_URL=/`, so the committed build is
domain-independent.)

Checks: `npm run check` (svelte-check / TypeScript).

## Server endpoints (pb_hooks)

- `POST /api/bar/order` `{user, product, qty, party?}` — transactional order +
  stock + balance; charges the party host when a party id is given; sends the
  red-alert mail on crossing the threshold.
- `POST /api/bar/party` `{message?, cap?, hours}` — start a treat round (one
  active per host).
- `POST /api/bar/party-stop` `{party}` — host or admin ends a round early.
- `POST /api/bar/topup` `{user, amount}` — admin-only; payment record + balance.
- `POST /api/bar/set-email` `{user, email}` — admin-only auth-email change.
- `POST /api/bar/stock-count` `{product, counted}` — admin-only; books the
  correction delta.
- `GET/POST /api/bar/mail-debtors/{red|yellow}` — admin-only; GET previews
  recipients, POST sends.
- Cron `daily-digest` (21:30 UTC) — per-user summary of the day's orders.

## License

[MIT](LICENSE).

The brand logos in `app/static/brands/` are trademarks of their respective
owners, included solely to identify the products sold; they are **not**
covered by the MIT license. Replace them with your own bar's product set.
