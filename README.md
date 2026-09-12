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
- **Personal tab** — product grid with brand accents. Picking one opens a
  single order screen: product, amount bar, and confirmation together, showing
  old → new balance with yellow/red warning thresholds.
- **Strepen voor een ander** — the order screen carries a first-letter name
  grid under the confirmation: pick the drink and the amount on your own tab,
  then charge someone else without losing what you picked. Your login stays
  your own; the order records who booked it and you return to your own tab
  afterwards. An account can switch this off for itself (admin screen), which
  hides it from the grid and makes the server refuse the order — treat rounds
  ignore the switch.
- **Ik trakteer (party mode)** — anyone can start a treat round with an
  optional message, drink cap, and duration (1–24h). While rounds run, the
  order confirmation offers "on <host>'s tab" per active round; multiple
  rounds can run at once (one per host). The host or an admin can stop early,
  and an admin can open a round on a member's tab from that member's account
  screen.
- **Top-up** — pick an amount, then use whichever route the admin configured.
  *Vraag Tikkie* opens WhatsApp with a prefilled message to the treasurer's
  number, which works on the phone the app already runs on; the EPC069-12
  (SEPA credit transfer) QR code, built from the club's IBAN and a fixed
  remittance text, is there for scanning from a second device. Each route
  hides itself when unconfigured, and the menu entry disappears when neither
  is set. An admin books the payment when reconciling the bank statement.
- **Balance emails** — a red-alert mail when a tab crosses the configured
  threshold, admin-triggered debtor mails (with preview), and an optional
  daily digest of each member's orders — flagging ones booked by someone else.
- **Admin** — products (with stock tracking), users, top-up booking, stock
  deliveries and counts, sales reports, mail templates, and app settings
  (title, thresholds, top-up routes, digest) — all in-app; the PocketBase admin UI is
  only needed for initial setup.
- **Light or dark** — a warm dark palette next to the cream one, picked per
  device from the header menu: *Auto* (follow the phone, the default), *Licht*
  or *Donker*. The choice lives in `localStorage`, is applied before the first
  paint so nothing flashes, and moves the PWA status-bar colour with it.
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
├── deploy/             # example nginx + supervisor configs, PB fetch script
└── tools/migrate/      # one-time importer for the legacy PHP/MySQL bar-app
```

### Migrating from the old PHP/MySQL bar-app

`tools/migrate/` lifts an existing `bar_app` MySQL database into PocketBase —
members and balances, products, the full sale and payment history, and the
stock ledger, with original timestamps preserved. It exports to a JSON
snapshot first, has a `--dry-run` that reports before it commits, and backs up
`data.db` before writing. See [tools/migrate/README.md](tools/migrate/README.md)
for the runbook and the mapping decisions.

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
   top-up QR, WhatsApp number for Tikkie requests, mail templates).

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
