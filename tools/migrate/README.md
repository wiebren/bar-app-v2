# Legacy migration: MySQL to PocketBase

A one-time importer that lifts the old PHP bar-app's MySQL database
(`bar_app`) into this app's PocketBase database — members, balances, products,
the full sale and payment history, and the stock ledger.

It runs in two steps, and each can run on a different machine:

```
MySQL  --(export)-->  legacy-dump.json  --(import)-->  pb_data/data.db
```

Splitting them means the production database is read exactly once, and any
mapping problem can be fixed and re-run against the snapshot rather than
against the live server.

## Requirements

- Node 22.5 or newer (the importer uses the built-in `node:sqlite`).
- `npm install` in this directory.
- Network access to the legacy MySQL for the export step, and the PocketBase
  `pb_data` directory for the import step.

## Runbook

```sh
cd tools/migrate
npm install
```

**1. Snapshot the legacy database.**

```sh
node migrate.mjs export \
  --mysql-host=127.0.0.1 --mysql-user=barapp --mysql-password=secret \
  --mysql-database=bar_app --out=legacy-dump.json
```

Read-only. It prints a row count per table and flags text that looks
double-encoded (see [Character encoding](#character-encoding)).

**2. Prepare the target.** The importer writes records, never schema, so the
collections have to exist first:

```sh
cd ../../pocketbase && ./pocketbase migrate up
```

**3. Stop PocketBase.** The importer writes straight into `data.db` and takes
an exclusive lock; it refuses to start while another process holds the
database.

**4. Dry run.** Runs the entire import inside a transaction, prints the full
report, then rolls back:

```sh
cd ../tools/migrate
node migrate.mjs import --in=legacy-dump.json \
  --db=../../pocketbase/pb_data/data.db --dry-run --wipe
```

Read the report. The warnings are the point of this step: unreadable amounts,
duplicate email addresses, admins with no matching member account.

**5. Import for real.** Drop `--dry-run`. A copy of `data.db` is written
alongside it as `data.db.pre-migration-<timestamp>` first.

```sh
node migrate.mjs import --in=legacy-dump.json \
  --db=../../pocketbase/pb_data/data.db --wipe --report=migration-report.json
```

**6. Start PocketBase and finish by hand.** See [After the
import](#after-the-import).

`--wipe` clears the app collections (`users`, `products`, `orders`,
`payments`, `stock_entries`, `parties`) before importing, along with any
sessions and OTP codes pointing at the removed users. PocketBase superusers
and the mail/SMTP configuration are never touched. Without `--wipe` the
importer refuses to run against a non-empty database, so a half-finished
migration can never silently double up.

## What maps to what

| Legacy MySQL | PocketBase | Notes |
| --- | --- | --- |
| `gebruikers` | `users` | `Saldo` becomes `balance` verbatim; `Actief` becomes `active` |
| `beheerders` | `users.role = "admin"` | v2 has no separate admin accounts |
| `producten` | `products` | `Beschikbaar` becomes `sellable`, `Volgorde` becomes `sort_order` |
| `verkoop` | `orders` | `datum` + `tijd` become `created` |
| `betalingen` | `payments` | `datum` + `tijd` become `created` |
| `voorraad` | `stock_entries` | `inkoop`/`verkoop`/`telling` become `purchase`/`sale`/`count` |
| `settings` | `settings` | single record, updated in place |

Dropped, because v2 has no equivalent: `gebruikers.wachtwoord` and
`beheerders.wachtwoord` (login is email OTP now), `gebruikers.Boetes` and
`settings.boete*` (fines), `settings.refresh*` and `settings.footer*` (kiosk
timers and footers), and the `extra2`/`Extra2` scratch columns.

### Decisions worth knowing about

**Balances are copied, not replayed.** `users.balance` comes from
`gebruikers.Saldo`, which is the number members have been looking at. The
importer additionally replays the imported orders and payments and reports
every member whose history does not add up to their balance. That drift is
normal — the legacy tables do not go back to the beginning — but a member with
a large unexplained difference is worth a look before go-live.

**Fines stay folded into the order total.** The old app added a "boete" to
`transactieTotaal` when a member ordered while in the red. v2 has no fines, but
the money did leave the tab, so `orders.total` keeps the amount that was
actually charged. On those rows `total` is larger than `unit_price * qty`; the
report says how many and for how much.

**Deleted members and products come back as placeholders.** The old app hard-
deletes from `gebruikers`, `producten` and `beheerders` while leaving the names
denormalised on every sale and payment row. Rather than drop that history, the
importer rebuilds the missing record from those columns and marks it inactive
(products: not sellable). They are listed in the report.

**Admins are matched to members.** Each `beheerders` row is matched to a member
by email, then by full name; the match is promoted to `role = "admin"`. An
admin with no matching member becomes an inactive user with `role = "admin"`,
so the payments they booked still point somewhere. Check this section of the
report — it decides who can reach the admin section.

**Timestamps are converted, not copied.** The legacy app ran on
`Europe/Amsterdam` and stored bare `DATE`/`TIME` columns; PocketBase stores
UTC. The importer converts using the offset in force on each date, so
summer and winter orders both keep their wall-clock time. Use `--tz` if the old
server ran somewhere else. Stock rows have a date but no time and are placed at
midday local, which keeps them on the right calendar day in any European zone.

**Stock sales are not linked back to their order.** `stock_entries.order` stays
empty for imported sales: the legacy `voorraad` table has no reference to
`verkoop` to migrate. Stock levels, transaction lists and reports do not use
that link.

**Passwords do not carry over.** v2 logs in with an email OTP and has password
auth disabled, so each imported user gets a bcrypt hash of a random string that
is thrown away. The column cannot be left empty: PocketBase validates
`password` as required on *every* save of an auth record, so a blank one breaks
the first order booked against that member's balance.

## Character encoding

The legacy schema is `DEFAULT CHARSET=latin1` while the PHP pages served UTF-8
— the classic setup for double-encoded text, where `ö` is stored as the two
characters `Ã¶`. Whether a given database is actually affected depends on how
each row was written, and both kinds can coexist in one table.

The export step reports values that look double-encoded. If it finds any:

- `--fix-mojibake` on the import repairs them. It only rewrites a value when
  the bytes genuinely decode as UTF-8, so correctly-stored text is left alone.
- Or re-export with `--mysql-charset=latin1` if *everything* is double-encoded.

Either way, check a few names with diacritics in the app afterwards.

## After the import

Things the importer cannot decide for you, in the order they matter:

1. **Make sure an admin can log in.** At least one user needs `role = "admin"`,
   `active = true` and an email address. The report lists every admin it
   created and how it matched them.
2. **Fill in missing email addresses.** Login is email-OTP only, so a member
   without one cannot sign in. The report counts them.
3. **Complete empty last names.** PocketBase marks `last_name` required, so a
   member imported without one cannot be saved from the admin UI until it is
   filled in.
4. **Set product brands.** `products.brand` drives the logos on the till
   buttons and has no legacy equivalent, so every product starts without one.
5. **Check `stock_tracked`.** It is switched on for any product that had stock
   ledger rows. Correct it for products the bar no longer counts.
6. **Configure the top-up routes and thresholds.** IBAN, account holder,
   Tikkie number and `red_alert_threshold` are not in the legacy schema and
   keep their v2 defaults — the old app hard-coded the red threshold at -100 in
   `bestellingverwerkt.php`, which is what v2 is seeded with.

## Re-running

The import is repeatable: fix the mapping, then run again with `--wipe`. Every
record is created fresh, so PocketBase ids change on each run — do not import
twice into a database that has already been used for real orders, or those
orders will be wiped along with the imported ones. Restore
`data.db.pre-migration-<timestamp>` to get back to where you started.

## Options

Run `node migrate.mjs` with no arguments for the full list.
