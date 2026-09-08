// Step 2: turn the legacy snapshot into PocketBase records.
//
// Writes go straight into pb_data/data.db (see lib/pb.mjs for why), inside one
// transaction: either the whole legacy history lands, or nothing does.

import { DatabaseSync } from 'node:sqlite';
import {
	pbId,
	pbTokenKey,
	pbPasswordHash,
	pbDate,
	legacyTimestamp,
	money,
	round2,
	fixMojibake as unmangle
} from './pb.mjs';

const USERS_COLLECTION = '_pb_users_auth_';

/** legacy voorraad.transactietype -> stock_entries.type */
const STOCK_TYPES = { inkoop: 'purchase', verkoop: 'sale', telling: 'count' };

/**
 * Legacy tables the importer writes into. `settings` is absent on purpose: it
 * holds a single seeded record that is updated, never replaced.
 */
const TARGET_TABLES = ['orders', 'payments', 'stock_entries', 'parties', 'products', 'users'];

export function importSnapshot(snapshot, opts) {
	const log = opts.log ?? (() => {});
	const tz = opts.tz ?? 'Europe/Amsterdam';
	const clean = opts.fixMojibake ? (v) => (typeof v === 'string' ? unmangle(v) : v) : (v) => v;
	const text = (v) => (v === null || v === undefined ? '' : clean(String(v)).trim());

	const legacy = snapshot.tables;
	const report = {
		counts: {},
		warnings: [],
		notes: [],
		placeholders: { users: [], products: [] },
		admins: [],
		reconciliation: []
	};
	const warn = (msg) => report.warnings.push(msg);

	const db = new DatabaseSync(opts.dbPath);
	try {
		db.exec('PRAGMA foreign_keys = OFF');
		// hold the database for the whole import, so a PocketBase that gets
		// started halfway through cannot interleave with it
		db.exec('PRAGMA locking_mode = EXCLUSIVE');
		assertSchema(db);
		const existing = countExisting(db);
		if (existing.total > 0 && !opts.wipe) {
			throw new Error(
				`target is not empty (${JSON.stringify(existing.byTable)}). ` +
					'Re-run with --wipe to replace its contents, or point --db at a fresh pb_data.'
			);
		}

		db.exec('BEGIN IMMEDIATE');
		try {
			if (opts.wipe && existing.total > 0) {
				wipe(db);
				log(`  wiped ${existing.total} existing records`);
			}

			// ---- pass 1: when did each legacy user / product last matter? --------
			// gebruikers and producten carry no timestamps, so a record's `created`
			// is backdated to its first appearance in the history tables.
			const firstSeen = collectFirstSeen(legacy, tz);

			// ---- users --------------------------------------------------------
			const users = buildUsers({ legacy, text, firstSeen, report, warn });
			// ---- admins (legacy `beheerders` become a role on users) -----------
			const adminByNr = buildAdmins({ legacy, text, users, report, warn });
			// ---- products -----------------------------------------------------
			const products = buildProducts({ legacy, text, firstSeen, report, warn });

			// ---- history ------------------------------------------------------
			const orders = buildOrders({ legacy, text, tz, users, products, report, warn });
			const payments = buildPayments({ legacy, text, tz, users, adminByNr, report, warn });
			const stock = buildStock({ legacy, text, tz, users, products, adminByNr, report, warn });

			// products only get a stock ledger in v2 when `stock_tracked` is on;
			// the legacy app logged every sale, so anything with a ledger entry
			// keeps being tracked
			for (const entry of stock) products.byPbId.get(entry.product).stock_tracked = 1;

			// ---- write --------------------------------------------------------
			insertUsers(db, users.rows);
			insertProducts(db, products.rows);
			insertOrders(db, orders);
			insertPayments(db, payments);
			insertStock(db, stock);
			const settingsNote = importSettings(db, legacy.settings?.[0], text);
			if (settingsNote) report.notes.push(settingsNote);

			report.counts = {
				users: users.rows.length,
				products: products.rows.length,
				orders: orders.length,
				payments: payments.length,
				stock_entries: stock.length
			};
			report.reconciliation = reconcile(users, orders, payments);

			if (opts.dryRun) {
				db.exec('ROLLBACK');
				report.notes.push('dry run: every change was rolled back.');
			} else {
				db.exec('COMMIT');
			}
		} catch (err) {
			db.exec('ROLLBACK');
			throw err;
		}
	} finally {
		db.close();
	}

	return report;
}

// ---------------------------------------------------------------------------
// target checks
// ---------------------------------------------------------------------------

function assertSchema(db) {
	const names = db
		.prepare('SELECT name FROM _collections')
		.all()
		.map((r) => r.name);
	const missing = ['users', 'products', 'orders', 'payments', 'stock_entries', 'settings'].filter(
		(n) => !names.includes(n)
	);
	if (missing.length) {
		throw new Error(
			`pb_data is missing collections: ${missing.join(', ')}. ` +
				'Run `./pocketbase migrate up` first so the schema exists.'
		);
	}
}

function countExisting(db) {
	const byTable = {};
	let total = 0;
	for (const table of TARGET_TABLES) {
		const n = db.prepare(`SELECT COUNT(*) AS n FROM \`${table}\``).get().n;
		if (n > 0) byTable[table] = n;
		total += n;
	}
	return { byTable, total };
}

function wipe(db) {
	for (const table of TARGET_TABLES) db.exec(`DELETE FROM \`${table}\``);
	// sessions, OTP codes and MFA challenges point at the users we just removed
	for (const table of ['_otps', '_authOrigins', '_mfas', '_externalAuths']) {
		db.prepare(`DELETE FROM \`${table}\` WHERE collectionRef = ?`).run(USERS_COLLECTION);
	}
}

// ---------------------------------------------------------------------------
// pass 1: backdating
// ---------------------------------------------------------------------------

function collectFirstSeen(legacy, tz) {
	const users = new Map();
	const products = new Map();
	const keep = (map, key, date) => {
		if (key === null || key === undefined || !date) return;
		const k = String(key);
		if (!map.has(k) || date < map.get(k)) map.set(k, date);
	};

	for (const row of legacy.verkoop ?? []) {
		const at = legacyTimestamp(row.datum, row.tijd, tz);
		keep(users, row.userNr, at);
		keep(products, row.productNr, at);
	}
	for (const row of legacy.betalingen ?? []) {
		keep(users, row.userNr, legacyTimestamp(row.datum, row.tijd, tz));
	}
	for (const row of legacy.voorraad ?? []) {
		const at = legacyTimestamp(row.datum, null, tz);
		keep(products, row.Productnr, at);
		keep(users, row.GebruikersNr, at);
	}
	return { users, products };
}

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------

function newUserRow(fields) {
	return {
		id: pbId(),
		email: '',
		emailVisibility: 0,
		verified: 0,
		name: '',
		avatar: '',
		// no password carries over (v2 is email-OTP only), but the column cannot
		// be blank -- see pbPasswordHash(). tokenKey salts the user's session
		// tokens and is unique-indexed, so it has to be random per record.
		password: pbPasswordHash(),
		tokenKey: pbTokenKey(),
		first_name: '',
		infix: '',
		last_name: '',
		phone: '',
		active: 0,
		role: 'user',
		balance: 0,
		created: '',
		updated: '',
		...fields
	};
}

function buildUsers({ legacy, text, firstSeen, report, warn }) {
	const rows = [];
	const byLegacyId = new Map(); // gebruikers.GebruikersNr -> row
	const byPbId = new Map();
	const byEmail = new Map();
	const byName = new Map();
	const now = pbDate(new Date());

	const nameKey = (first, infix, last) =>
		[first, infix, last].filter(Boolean).join(' ').toLowerCase().replace(/\s+/g, ' ');

	const register = (row, legacyId) => {
		rows.push(row);
		byPbId.set(row.id, row);
		if (legacyId !== null) byLegacyId.set(String(legacyId), row);
		if (row.email) byEmail.set(row.email, row);
		const key = nameKey(row.first_name, row.infix, row.last_name);
		if (key && !byName.has(key)) byName.set(key, row);
		return row;
	};

	let missingLastName = 0;
	for (const g of legacy.gebruikers ?? []) {
		const legacyId = String(g.GebruikersNr);
		const email = text(g.Emailadres).toLowerCase();
		const balance = money(g.Saldo);
		if (balance === null && text(g.Saldo)) {
			warn(`user ${legacyId}: unreadable Saldo ${JSON.stringify(g.Saldo)}, imported as 0.00`);
		}
		if (!text(g.Achternaam)) missingLastName++;

		let finalEmail = email;
		if (email && byEmail.has(email)) {
			warn(
				`user ${legacyId} (${text(g.Voornaam)} ${text(g.Achternaam)}): duplicate email ${email}, ` +
					'cleared here so the account can still be found and repaired by hand'
			);
			finalEmail = '';
		}

		const created = pbDate(firstSeen.users.get(legacyId)) || now;
		register(
			newUserRow({
				email: finalEmail,
				verified: finalEmail ? 1 : 0,
				first_name: text(g.Voornaam),
				infix: text(g.Tussenvoegsel),
				last_name: text(g.Achternaam),
				phone: text(g.Telefoonnummer),
				active: Number(g.Actief) === 1 ? 1 : 0,
				balance: balance ?? 0,
				created,
				updated: now
			}),
			legacyId
		);
	}

	if (missingLastName) {
		warn(
			`${missingLastName} user(s) have an empty last name; PocketBase marks the field required, ` +
				'so those records must be completed before they can be edited in the admin UI'
		);
	}

	const withoutEmail = rows.filter((r) => r.active && !r.email).length;
	if (withoutEmail) {
		report.notes.push(
			`${withoutEmail} active member(s) have no email address. Login is email-OTP only, ` +
				'so they cannot sign in until one is filled in.'
		);
	}

	/**
	 * The legacy app hard-deletes members but denormalises their name onto every
	 * sale and payment, so history rows can outlive the account. Rebuild the
	 * member from those columns instead of dropping the financial record.
	 */
	const placeholder = (legacyId, first, infix, last, origin) => {
		const existing = byLegacyId.get(String(legacyId));
		if (existing) return existing;
		const row = register(
			newUserRow({
				first_name: first || 'Onbekend',
				infix,
				last_name: last,
				active: 0,
				created: pbDate(firstSeen.users.get(String(legacyId))) || now,
				updated: now
			}),
			legacyId
		);
		report.placeholders.users.push({
			legacy_id: legacyId,
			name: [row.first_name, row.infix, row.last_name].filter(Boolean).join(' '),
			origin
		});
		return row;
	};

	return { rows, byLegacyId, byPbId, byEmail, byName, nameKey, placeholder, now };
}

// ---------------------------------------------------------------------------
// admins: legacy `beheerders` are separate accounts; in v2 admin is a role
// ---------------------------------------------------------------------------

function buildAdmins({ legacy, text, users, report, warn }) {
	const byNr = new Map();

	for (const b of legacy.beheerders ?? []) {
		const nr = String(b.beheerdernr);
		const email = text(b.emailadres).toLowerCase();
		const first = text(b.voornaam);
		const infix = text(b.tussenvoegsel);
		const last = text(b.achternaam);

		let match = email ? users.byEmail.get(email) : undefined;
		let how = match ? 'email' : '';
		if (!match) {
			match = users.byName.get(users.nameKey(first, infix, last));
			if (match) how = 'name';
		}

		if (!match) {
			// no member account to promote: keep the admin as an inactive user so
			// the payments they booked still point at a real record
			match = newUserRow({
				email: email && !users.byEmail.has(email) ? email : '',
				first_name: first || text(b.gebruikersnaam) || 'Beheerder',
				infix,
				last_name: last,
				active: 0,
				created: users.now,
				updated: users.now
			});
			users.rows.push(match);
			users.byPbId.set(match.id, match);
			if (match.email) users.byEmail.set(match.email, match);
			how = 'placeholder';
			report.placeholders.users.push({
				legacy_id: `beheerder:${nr}`,
				name: [match.first_name, match.infix, match.last_name].filter(Boolean).join(' '),
				origin: 'beheerders (no matching member account)'
			});
		}

		match.role = 'admin';
		byNr.set(nr, match);
		report.admins.push({
			legacy_id: nr,
			username: text(b.gebruikersnaam),
			name: [match.first_name, match.infix, match.last_name].filter(Boolean).join(' '),
			matched_by: how,
			active: Boolean(match.active)
		});

		if (how === 'placeholder') {
			warn(
				`admin "${text(b.gebruikersnaam)}" has no matching member account; imported as an ` +
					'inactive user with role=admin. Activate it (and set an email) or reassign it by hand.'
			);
		}
	}

	if (!report.admins.some((a) => a.active)) {
		report.notes.push(
			'No imported admin is active. Set active=true and an email on at least one ' +
				'user with role=admin, or nobody can reach the admin section.'
		);
	}
	return byNr;
}

// ---------------------------------------------------------------------------
// products
// ---------------------------------------------------------------------------

function buildProducts({ legacy, text, firstSeen, report, warn }) {
	const rows = [];
	const byLegacyId = new Map();
	const byPbId = new Map();
	const now = pbDate(new Date());

	const register = (row, legacyId) => {
		rows.push(row);
		byPbId.set(row.id, row);
		byLegacyId.set(String(legacyId), row);
		return row;
	};

	for (const p of legacy.producten ?? []) {
		const legacyId = String(p.Productnr);
		const price = money(p.Prijs);
		if (price === null) {
			warn(`product ${legacyId} (${text(p.Productnaam)}): unreadable Prijs, imported as 0.00`);
		} else if (/,/.test(String(p.Prijs ?? ''))) {
			// PHP's string-to-number cast stops at the comma, so the legacy app has
			// been charging 1.00 for a price written as "1,10". Reading it as 1.10
			// is almost certainly what whoever typed it meant, but it changes the
			// price from what members were actually paying -- so say so.
			warn(
				`product ${legacyId} (${text(p.Productnaam)}): Prijs ${JSON.stringify(p.Prijs)} uses a ` +
					`decimal comma; imported as ${price.toFixed(2)}, where the old app charged ` +
					`${Math.trunc(price).toFixed(2)}. Confirm the price.`
			);
		}
		register(
			{
				id: pbId(),
				name: text(p.Productnaam),
				price: price ?? 0,
				sellable: Number(p.Beschikbaar) === 1 ? 1 : 0,
				sort_order: Number.isFinite(Number(p.Volgorde)) ? Number(p.Volgorde) : 1000,
				stock_tracked: 0, // switched on below for anything with a stock ledger
				brand: '', // no legacy equivalent; set per product in the admin UI
				notify_level: 0,
				created: pbDate(firstSeen.products.get(legacyId)) || now,
				updated: now
			},
			legacyId
		);
	}

	/** Same story as deleted members: rebuild from the denormalised sale row. */
	const placeholder = (legacyId, name, origin) => {
		const existing = byLegacyId.get(String(legacyId));
		if (existing) return existing;
		const row = register(
			{
				id: pbId(),
				name: name || `Verwijderd product ${legacyId}`,
				price: 0,
				sellable: 0,
				sort_order: 9999,
				stock_tracked: 0,
				brand: '',
				notify_level: 0,
				created: pbDate(firstSeen.products.get(String(legacyId))) || now,
				updated: now
			},
			legacyId
		);
		report.placeholders.products.push({ legacy_id: legacyId, name: row.name, origin });
		return row;
	};

	return { rows, byLegacyId, byPbId, placeholder };
}

// ---------------------------------------------------------------------------
// orders (legacy `verkoop`)
// ---------------------------------------------------------------------------

function buildOrders({ legacy, text, tz, users, products, report, warn }) {
	const orders = [];
	let fined = 0;
	let finesTotal = 0;
	let bookedByFallback = 0;
	let skipped = 0;

	for (const v of legacy.verkoop ?? []) {
		const at = legacyTimestamp(v.datum, v.tijd, tz);
		if (!at) {
			skipped++;
			warn(`sale ${v.transactieNr}: unusable date ${JSON.stringify(v.datum)}, skipped`);
			continue;
		}

		const user = users.placeholder(
			v.userNr,
			text(v.userVoornaam),
			text(v.userTussenvoegsel),
			text(v.userAchternaam),
			'verkoop (member deleted from the legacy app)'
		);
		const product = products.placeholder(
			v.productNr,
			text(v.productNaam),
			'verkoop (product deleted from the legacy app)'
		);

		let bookedBy = users.byLegacyId.get(String(v.authNr));
		if (!bookedBy) {
			// pre-cookie-auth rows, or the till user was deleted; the tab holder is
			// the only defensible stand-in
			bookedBy = user;
			bookedByFallback++;
		}

		const qty = Math.trunc(Number(v.productAantal)) || 0;
		const unitPrice = money(v.productStukprijs) ?? 0;
		// transactieTotaal is what actually came off the tab, fines included, so
		// it is the number the balance history has to agree with
		const total = money(v.transactieTotaal) ?? round2(unitPrice * qty);
		const fine = money(v.boetebedrag) ?? 0;
		if (fine) {
			fined++;
			finesTotal = round2(finesTotal + fine);
		}

		orders.push({
			id: pbId(),
			user: user.id,
			booked_by: bookedBy.id,
			product: product.id,
			product_name: text(v.productNaam),
			unit_price: unitPrice,
			qty,
			total,
			created: pbDate(at)
		});
	}

	if (fined) {
		report.notes.push(
			`${fined} order(s) carried a fine ("boete", dropped in v2), ${finesTotal.toFixed(2)} EUR in ` +
				'total. The fine stays folded into orders.total so balances still reconcile, which ' +
				'means total > unit_price x qty on those rows.'
		);
	}
	if (bookedByFallback) {
		report.notes.push(
			`${bookedByFallback} order(s) had no usable authNr; booked_by was set to the tab holder.`
		);
	}
	if (skipped) warn(`${skipped} sale row(s) skipped for an unusable date`);
	return orders;
}

// ---------------------------------------------------------------------------
// payments (legacy `betalingen`)
// ---------------------------------------------------------------------------

function buildPayments({ legacy, text, tz, users, adminByNr, report, warn }) {
	const payments = [];
	let unapproved = 0;
	let adminFallback = 0;
	let skipped = 0;
	let fallbackAdmin = null;

	for (const b of legacy.betalingen ?? []) {
		const at = legacyTimestamp(b.datum, b.tijd, tz);
		if (!at) {
			skipped++;
			warn(`payment ${b.betalingsnr}: unusable date ${JSON.stringify(b.datum)}, skipped`);
			continue;
		}
		const amount = money(b.saldoBijschrijving);
		if (amount === null) {
			skipped++;
			warn(
				`payment ${b.betalingsnr}: unreadable saldoBijschrijving ` +
					`${JSON.stringify(b.saldoBijschrijving)}, skipped`
			);
			continue;
		}
		if (b.voldaan !== null && Number(b.voldaan) === 0) unapproved++;

		const user = users.placeholder(
			b.userNr,
			text(b.userVoornaam),
			text(b.userTussenvoegsel),
			text(b.userAchternaam),
			'betalingen (member deleted from the legacy app)'
		);

		let admin = adminByNr.get(String(b.beheerderNr));
		if (!admin) {
			// the admin account was deleted; keep one shared stand-in rather than
			// one per row, and name it from the payment's own columns
			if (!fallbackAdmin) {
				fallbackAdmin = newUserRow({
					first_name: text(b.beheerderVoornaam) || 'Verwijderde',
					infix: text(b.beheerderTussenvoegsel),
					last_name: text(b.beheerderAchternaam) || 'beheerder',
					role: 'admin',
					active: 0,
					created: users.now,
					updated: users.now
				});
				users.rows.push(fallbackAdmin);
				users.byPbId.set(fallbackAdmin.id, fallbackAdmin);
				report.placeholders.users.push({
					legacy_id: 'beheerder:deleted',
					name: [fallbackAdmin.first_name, fallbackAdmin.infix, fallbackAdmin.last_name]
						.filter(Boolean)
						.join(' '),
					origin: 'betalingen (admin deleted from the legacy app)'
				});
			}
			admin = fallbackAdmin;
			adminFallback++;
		}

		payments.push({
			id: pbId(),
			user: user.id,
			admin: admin.id,
			amount,
			balance_old: money(b.saldoOud) ?? 0,
			balance_new: money(b.saldoNieuw) ?? 0,
			created: pbDate(at)
		});
	}

	if (unapproved) {
		report.notes.push(
			`${unapproved} payment(s) were never approved in the legacy "betalingen goedkeuren" queue. ` +
				'That queue is gone in v2 and the legacy app credited the balance on entry anyway, ' +
				'so they were imported like the rest.'
		);
	}
	if (adminFallback) {
		report.notes.push(
			`${adminFallback} payment(s) referenced a deleted admin; they point at one shared ` +
				'placeholder user so the audit trail stays intact.'
		);
	}
	if (skipped) warn(`${skipped} payment row(s) skipped`);
	return payments;
}

// ---------------------------------------------------------------------------
// stock ledger (legacy `voorraad`)
// ---------------------------------------------------------------------------

function buildStock({ legacy, text, tz, users, products, adminByNr, report, warn }) {
	const entries = [];
	const unknownTypes = new Map();
	let skipped = 0;

	for (const v of legacy.voorraad ?? []) {
		const type = STOCK_TYPES[String(v.transactietype ?? '').toLowerCase()];
		if (!type) {
			unknownTypes.set(v.transactietype, (unknownTypes.get(v.transactietype) ?? 0) + 1);
			skipped++;
			continue;
		}
		const at = legacyTimestamp(v.datum, null, tz);
		if (!at) {
			skipped++;
			warn(`stock row ${v.ID}: unusable date ${JSON.stringify(v.datum)}, skipped`);
			continue;
		}

		// voorraad carries no product name, so a deleted product can only be
		// rebuilt under a generated one
		const product = products.placeholder(
			v.Productnr,
			'',
			'voorraad (product deleted from the legacy app)'
		);

		// the ledger records either a member (sales) or an admin (deliveries and
		// counts); either way the v2 field is one optional relation to users
		let actor = users.byLegacyId.get(String(v.GebruikersNr));
		if (!actor && v.beheerdernr !== null && v.beheerdernr !== undefined) {
			actor = adminByNr.get(String(v.beheerdernr));
		}

		const created = v.syscreated
			? legacyTimestamp(String(v.syscreated).slice(0, 10), String(v.syscreated).slice(11), tz)
			: at;

		entries.push({
			id: pbId(),
			type,
			product: product.id,
			qty: Number(v.aantal) || 0,
			date: pbDate(at),
			// the legacy schema has no link from voorraad back to verkoop, so sale
			// entries stay unlinked; stock totals are unaffected
			order: '',
			actor: actor?.id ?? '',
			created: pbDate(created ?? at)
		});
	}

	for (const [type, n] of unknownTypes) {
		warn(`${n} stock row(s) with unknown transactietype ${JSON.stringify(type)}, skipped`);
	}
	if (entries.length) {
		report.notes.push(
			'Stock "sale" entries are not linked back to their order (stock_entries.order is empty): ' +
				'the legacy voorraad table has no reference to verkoop. Stock levels and reports are ' +
				'unaffected.'
		);
	}
	if (skipped) warn(`${skipped} stock row(s) skipped in total`);
	return entries;
}

// ---------------------------------------------------------------------------
// settings (single seeded record, updated in place)
// ---------------------------------------------------------------------------

function importSettings(db, row, text) {
	if (!row) return 'No legacy settings row found; the seeded v2 defaults were kept.';

	const current = db.prepare('SELECT id FROM settings LIMIT 1').get();
	if (!current) {
		return 'No settings record in pb_data; run `./pocketbase migrate up` first. Settings were skipped.';
	}

	const yellow = Number(row.AlgemeenGeelVanaf);
	db.prepare(
		`UPDATE settings SET
			app_title = ?, yellow_threshold = ?, sender_address = ?,
			mail_red_subject = ?, mail_red_salutation = ?, mail_red_text_before = ?, mail_red_text_after = ?,
			mail_yellow_subject = ?, mail_yellow_salutation = ?, mail_yellow_text_before = ?, mail_yellow_text_after = ?
		WHERE id = ?`
	).run(
		text(row.AlgemeenNaam) || 'Bar-app',
		Number.isFinite(yellow) ? yellow : 0,
		text(row.mailAfzendadres),
		text(row.mailRoodOnderwerp),
		text(row.mailRoodAanhef),
		text(row.mailRoodTekstVoorSaldo),
		text(row.mailRoodTekstNaSaldo),
		text(row.mailGeelOnderwerp),
		text(row.mailGeelAanhef),
		text(row.mailGeelTekstVoorSaldo),
		text(row.mailGeelTekstNaSaldo),
		current.id
	);

	// red_alert_threshold is deliberately left at the seeded -100: the legacy app
	// hard-coded that number in bestellingverwerkt.php rather than storing it.
	// boete*, refresh* and footer* have no v2 equivalent and are dropped.
	return 'Settings: title, yellow threshold, sender address and both mail templates were imported. IBAN, account holder and the red-alert threshold keep their v2 values.';
}

// ---------------------------------------------------------------------------
// writes
// ---------------------------------------------------------------------------

function bulkInsert(db, table, columns, rows) {
	if (!rows.length) return;
	const sql =
		`INSERT INTO \`${table}\` (${columns.map((c) => `\`${c}\``).join(', ')}) ` +
		`VALUES (${columns.map(() => '?').join(', ')})`;
	const stmt = db.prepare(sql);
	for (const row of rows) stmt.run(...columns.map((c) => row[c]));
}

const insertUsers = (db, rows) =>
	bulkInsert(
		db,
		'users',
		[
			'id', 'email', 'emailVisibility', 'verified', 'name', 'avatar', 'password', 'tokenKey',
			'first_name', 'infix', 'last_name', 'phone', 'active', 'role', 'balance', 'created', 'updated'
		],
		rows
	);

const insertProducts = (db, rows) =>
	bulkInsert(
		db,
		'products',
		['id', 'name', 'price', 'sellable', 'sort_order', 'stock_tracked', 'brand', 'notify_level', 'created', 'updated'],
		rows
	);

const insertOrders = (db, rows) =>
	bulkInsert(
		db,
		'orders',
		['id', 'user', 'booked_by', 'product', 'product_name', 'unit_price', 'qty', 'total', 'created'],
		rows
	);

const insertPayments = (db, rows) =>
	bulkInsert(db, 'payments', ['id', 'user', 'admin', 'amount', 'balance_old', 'balance_new', 'created'], rows);

const insertStock = (db, rows) =>
	bulkInsert(db, 'stock_entries', ['id', 'type', 'product', 'qty', 'date', 'order', 'actor', 'created'], rows);

// ---------------------------------------------------------------------------
// reconciliation
// ---------------------------------------------------------------------------

/**
 * The imported balance is the legacy `Saldo` column, which is authoritative.
 * This compares it against what the imported history alone would produce, so a
 * member whose ledger no longer explains their balance shows up before members
 * start noticing. Drift is expected for anyone who predates the history tables.
 */
function reconcile(users, orders, payments) {
	const movement = new Map();
	const add = (userId, delta) => movement.set(userId, round2((movement.get(userId) ?? 0) + delta));
	for (const o of orders) add(o.user, -o.total);
	for (const p of payments) add(p.user, p.amount);

	const drifted = [];
	for (const user of users.rows) {
		const fromHistory = movement.get(user.id) ?? 0;
		const diff = round2(user.balance - fromHistory);
		if (Math.abs(diff) >= 0.01) {
			drifted.push({
				name: [user.first_name, user.infix, user.last_name].filter(Boolean).join(' '),
				balance: user.balance,
				from_history: fromHistory,
				difference: diff
			});
		}
	}
	drifted.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
	return drifted;
}
