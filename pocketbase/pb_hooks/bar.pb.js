/// <reference path="../pb_data/types.d.ts" />
// Server-side logic for the bar-app.

// ---------------------------------------------------------------------------
// 5.1 Order processing — one transaction: order + stock ledger + balance.
// ---------------------------------------------------------------------------
routerAdd(
	'POST',
	'/api/bar/order',
	(e) => {
		const utils = require(`${__hooks}/bar_utils.js`);
		utils.requireActive(e);

		const data = new DynamicModel({ user: '', product: '', qty: 0, party: '' });
		e.bindBody(data);
		const qty = Number(data.qty);
		if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
			throw new BadRequestError('Ongeldig aantal.');
		}

		let result = {};
		let crossedRed = false;
		let lowStock = null; // { name, stock, level } when the notify level was crossed
		let chargedUser = data.user;

		e.app.runInTransaction((tx) => {
			const product = tx.findRecordById('products', data.product);
			if (!product.getBool('sellable')) throw new BadRequestError('Product niet beschikbaar.');

			// party order: the host's tab is charged and the drinks count
			// against the optional cap
			if (data.party) {
				const party = tx.findRecordById('parties', data.party);
				if (new Date(party.getString('ends').replace(' ', 'T')) <= new Date()) {
					throw new BadRequestError('De traktatie is voorbij.');
				}
				const cap = party.getInt('cap');
				const used = party.getInt('used');
				if (cap > 0 && used + qty > cap) throw new BadRequestError('De traktatie is op.');
				party.set('used', used + qty);
				tx.save(party);
				chargedUser = party.getString('host');
			}

			const tabUser = tx.findRecordById('users', chargedUser);
			if (!tabUser.getBool('active')) throw new BadRequestError('Rekening niet actief.');

			const price = product.getFloat('price');
			const total = utils.round2(price * qty);
			const oldBalance = tabUser.getFloat('balance');
			const newBalance = utils.round2(oldBalance - total);

			const order = new Record(tx.findCollectionByNameOrId('orders'));
			order.set('user', tabUser.id);
			order.set('booked_by', e.auth.id);
			order.set('product', product.id);
			order.set('product_name', product.getString('name'));
			order.set('unit_price', price);
			order.set('qty', qty);
			order.set('total', total);
			tx.save(order);

			if (product.getBool('stock_tracked')) {
				const entry = new Record(tx.findCollectionByNameOrId('stock_entries'));
				entry.set('type', 'sale');
				entry.set('product', product.id);
				entry.set('qty', -qty);
				entry.set('date', new DateTime());
				entry.set('order', order.id);
				entry.set('actor', e.auth.id);
				tx.save(entry);

				// low-stock alert: crossing-only, like the red alert below
				const level = product.getInt('notify_level');
				if (level > 0) {
					// float zero value: qty is NUMERIC and deliveries can be fractional, and
					// an int-typed field fails to scan a fractional SUM (see /api/bar/topup)
					const row = new DynamicModel({ total: 0.1 });
					tx.db()
						.newQuery('SELECT COALESCE(SUM(qty), 0) AS total FROM stock_entries WHERE product = {:p}')
						.bind({ p: product.id })
						.one(row);
					const newStock = Number(row.total); // sale entry included
					if (newStock < level && newStock + qty >= level) {
						lowStock = { name: product.getString('name'), stock: newStock, level };
					}
				}
			}

			tabUser.set('balance', newBalance);
			tx.save(tabUser);

			const settings = utils.getSettings(tx);
			const threshold = settings.getFloat('red_alert_threshold');
			// crossing-only, so one alert mail — not one per subsequent order
			crossedRed = oldBalance >= threshold && newBalance < threshold;
			result = { oldBalance, newBalance, total };
		});

		if (crossedRed) {
			try {
				const settings = utils.getSettings(e.app);
				const tabUser = e.app.findRecordById('users', chargedUser);
				utils.sendBalanceMail(e.app, settings, 'red', tabUser);
			} catch (err) {
				console.log('red-alert mail failed:', err);
			}
		}

		if (lowStock) {
			try {
				utils.sendLowStockMail(e.app, lowStock);
			} catch (err) {
				console.log('low-stock mail failed:', err);
			}
		}

		return e.json(200, result);
	},
	$apis.requireAuth()
);

// ---------------------------------------------------------------------------
// 5.2 Top-up (admin): payment record + balance, transactional.
// ---------------------------------------------------------------------------
routerAdd(
	'POST',
	'/api/bar/topup',
	(e) => {
		const utils = require(`${__hooks}/bar_utils.js`);
		utils.requireActiveAdmin(e);

		// 0.1, not 0: DynamicModel takes the Go field type from the zero value it
		// is handed, so an integer literal makes `amount` an int — a top-up of
		// 12.50 then fails to bind and 400s while whole euros go through. Any
		// non-integer works; bindBody overwrites the value itself.
		const data = new DynamicModel({ user: '', amount: 0.1 });
		e.bindBody(data);
		const amount = utils.round2(Number(data.amount));
		if (!amount || !isFinite(amount)) throw new BadRequestError('Ongeldig bedrag.');

		let result = {};
		e.app.runInTransaction((tx) => {
			const user = tx.findRecordById('users', data.user);
			const oldBalance = user.getFloat('balance');
			const newBalance = utils.round2(oldBalance + amount);

			const payment = new Record(tx.findCollectionByNameOrId('payments'));
			payment.set('user', user.id);
			payment.set('admin', e.auth.id);
			payment.set('amount', amount);
			payment.set('balance_old', oldBalance);
			payment.set('balance_new', newBalance);
			tx.save(payment);

			user.set('balance', newBalance);
			tx.save(user);

			result = { oldBalance, newBalance };
		});
		return e.json(200, result);
	},
	$apis.requireAuth()
);

// ---------------------------------------------------------------------------
// Change a user's email (admin). PocketBase only allows auth-record email
// changes for superusers via the records API, so the admin UI goes through
// this server-side route instead.
// ---------------------------------------------------------------------------
routerAdd(
	'POST',
	'/api/bar/set-email',
	(e) => {
		require(`${__hooks}/bar_utils.js`).requireActiveAdmin(e);

		const data = new DynamicModel({ user: '', email: '' });
		e.bindBody(data);
		if (!data.email || !data.email.includes('@')) throw new BadRequestError('Ongeldig e-mailadres.');

		const user = e.app.findRecordById('users', data.user);
		user.setEmail(data.email);
		e.app.save(user);
		return e.json(200, { email: data.email });
	},
	$apis.requireAuth()
);

// ---------------------------------------------------------------------------
// 5.3 Stock count (admin): books the correction delta, always dated now.
// ---------------------------------------------------------------------------
routerAdd(
	'POST',
	'/api/bar/stock-count',
	(e) => {
		const utils = require(`${__hooks}/bar_utils.js`);
		utils.requireActiveAdmin(e);

		const data = new DynamicModel({ product: '', counted: 0 });
		e.bindBody(data);
		const counted = Number(data.counted);
		if (!isFinite(counted) || counted < 0) throw new BadRequestError('Ongeldige telling.');

		let result = {};
		let lowStock = null;
		e.app.runInTransaction((tx) => {
			const product = tx.findRecordById('products', data.product);
			// float zero value: qty is NUMERIC and deliveries can be fractional, and
			// an int-typed field fails to scan a fractional SUM (see /api/bar/topup)
			const row = new DynamicModel({ total: 0.1 });
			tx.db()
				.newQuery('SELECT COALESCE(SUM(qty), 0) AS total FROM stock_entries WHERE product = {:p}')
				.bind({ p: product.id })
				.one(row);
			const delta = counted - Number(row.total);

			if (delta !== 0) {
				const entry = new Record(tx.findCollectionByNameOrId('stock_entries'));
				entry.set('type', 'count');
				entry.set('product', product.id);
				entry.set('qty', delta);
				entry.set('date', new DateTime());
				entry.set('actor', e.auth.id);
				tx.save(entry);
			}

			const level = product.getInt('notify_level');
			if (level > 0 && Number(row.total) >= level && counted < level) {
				lowStock = { name: product.getString('name'), stock: counted, level };
			}
			result = { previous: Number(row.total), counted, delta };
		});

		if (lowStock) {
			try {
				utils.sendLowStockMail(e.app, lowStock);
			} catch (err) {
				console.log('low-stock mail failed:', err);
			}
		}
		return e.json(200, result);
	},
	$apis.requireAuth()
);

// ---------------------------------------------------------------------------
// Party mode ("Ik trakteer"): any user can start one; drinks ordered "op
// rekening van" the host are charged to the host and count against the cap.
// pbNow(): dates in the PB storage format ("2006-01-02 15:04:05.000Z") so
// string comparison in filters works.
// ---------------------------------------------------------------------------
routerAdd(
	'POST',
	'/api/bar/party',
	(e) => {
		require(`${__hooks}/bar_utils.js`).requireActive(e);

		const data = new DynamicModel({ message: '', cap: 0, hours: 0 });
		e.bindBody(data);
		const hours = Number(data.hours);
		const cap = Number(data.cap);
		if (!Number.isInteger(hours) || hours < 1 || hours > 24) {
			throw new BadRequestError('Ongeldige duur (1-24 uur).');
		}
		if (!Number.isInteger(cap) || cap < 0) throw new BadRequestError('Ongeldig maximum.');

		// multiple parties may run at once, but one per host at a time
		const now = new Date().toISOString().replace('T', ' ');
		const own = e.app.findRecordsByFilter('parties', 'ends > {:now} && host = {:host}', '', 1, 0, {
			now: now,
			host: e.auth.id
		});
		if (own.length) throw new BadRequestError('Je hebt al een traktatie lopen.');

		const party = new Record(e.app.findCollectionByNameOrId('parties'));
		party.set('host', e.auth.id);
		party.set('message', String(data.message ?? '').slice(0, 100));
		party.set('cap', cap);
		party.set('used', 0);
		party.set('ends', new Date(Date.now() + hours * 3600e3).toISOString());
		e.app.save(party);
		return e.json(200, { id: party.id });
	},
	$apis.requireAuth()
);

routerAdd(
	'POST',
	'/api/bar/party-stop',
	(e) => {
		require(`${__hooks}/bar_utils.js`).requireActive(e);

		const data = new DynamicModel({ party: '' });
		e.bindBody(data);
		if (!data.party) throw new BadRequestError('Geen traktatie opgegeven.');
		const party = e.app.findRecordById('parties', data.party);
		if (new Date(party.getString('ends').replace(' ', 'T')) <= new Date()) {
			throw new BadRequestError('Deze traktatie is al voorbij.');
		}
		if (party.getString('host') !== e.auth.id && e.auth.getString('role') !== 'admin') {
			throw new ForbiddenError('Alleen de trakterende of een beheerder kan stoppen.');
		}
		party.set('ends', new Date().toISOString());
		e.app.save(party);
		return e.json(200, {});
	},
	$apis.requireAuth()
);

// ---------------------------------------------------------------------------
// 5.4 Mail debtors (admin): GET previews the recipients, POST sends.
// ---------------------------------------------------------------------------
routerAdd(
	'GET',
	'/api/bar/mail-debtors/{group}',
	(e) => {
		const utils = require(`${__hooks}/bar_utils.js`);
		utils.requireActiveAdmin(e);
		const users = utils.findDebtorGroup(e.app, e.request.pathValue('group'));
		return e.json(
			200,
			users.map((u) => ({ id: u.id, name: utils.fullName(u), balance: u.getFloat('balance'), email: u.email() }))
		);
	},
	$apis.requireAuth()
);

routerAdd(
	'POST',
	'/api/bar/mail-debtors/{group}',
	(e) => {
		const utils = require(`${__hooks}/bar_utils.js`);
		utils.requireActiveAdmin(e);
		const group = e.request.pathValue('group');
		const settings = utils.getSettings(e.app);
		let mailed = 0;
		for (const u of utils.findDebtorGroup(e.app, group)) {
			if (utils.sendBalanceMail(e.app, settings, group, u)) mailed++;
		}
		return e.json(200, { mailed });
	},
	$apis.requireAuth()
);

// ---------------------------------------------------------------------------
// 5.5 Daily digest: each user with orders today gets a summary mail.
//     On the 1st of the month it also runs the shelf-life check.
// ---------------------------------------------------------------------------
cronAdd('daily-digest', '30 21 * * *', () => {
	const utils = require(`${__hooks}/bar_utils.js`);

	// Monthly shelf-life check (1st only): stock above what was added the
	// past 3 months means the surplus predates that window (FIFO) — mail
	// the admins one expiry warning per product. Runs regardless of the
	// digest toggle; that switch only covers the user digest below.
	if (new Date().getUTCDate() === 1) {
		const since = new Date();
		since.setUTCMonth(since.getUTCMonth() - 3);
		const sinceStr = since.toISOString().replace('T', ' ');

		// float zero values: a fractional SUM will not scan into an int field
		const rows = arrayOf(new DynamicModel({ product: '', total: 0.1, added: 0.1 }));
		$app
			.db()
			.newQuery(
				`SELECT product,
				        COALESCE(SUM(qty), 0) AS total,
				        COALESCE(SUM(CASE WHEN qty > 0 AND date >= {:since} THEN qty ELSE 0 END), 0) AS added
				 FROM stock_entries GROUP BY product`
			)
			.bind({ since: sinceStr })
			.all(rows);

		for (const row of rows) {
			try {
				const total = Number(row.total);
				const added = Number(row.added);
				if (total <= 0 || total <= added) continue;
				const product = $app.findRecordById('products', row.product);
				if (!product.getBool('stock_tracked')) continue;
				utils.sendStockAgeMail($app, { name: product.getString('name'), total, added });
			} catch (err) {
				console.log('stock-age mail failed for', row.product, err);
			}
		}
	}

	const settings = utils.getSettings($app);
	if (!settings.getBool('digest_enabled')) return;

	// "today" in UTC — close enough for an end-of-day digest; created is stored UTC
	const start = new Date();
	start.setUTCHours(0, 0, 0, 0);
	const startStr = start.toISOString().replace('T', ' ');

	const orders = $app.findRecordsByFilter('orders', `created >= "${startStr}"`, 'created', 0, 0);
	const byUser = {};
	for (const o of orders) {
		(byUser[o.getString('user')] ??= []).push(o);
	}

	for (const userId in byUser) {
		try {
			const user = $app.findRecordById('users', userId);
			if (!user.email() || !user.getBool('active')) continue;

			const lines = byUser[userId].map((o) => {
				let line = `${o.getInt('qty')}x ${o.getString('product_name')} — €${o.getFloat('total').toFixed(2)}`;
				if (o.getString('booked_by') !== userId) {
					const booker = $app.findRecordById('users', o.getString('booked_by'));
					line += ` (door ${utils.fullName(booker)})`;
				}
				return line;
			});

			const message = new MailerMessage({
				from: {
					address: settings.getString('sender_address') || $app.settings().meta.senderAddress,
					name: settings.getString('app_title') || 'Bar-app'
				},
				to: [{ address: user.email() }],
				subject: 'Je consumpties van vandaag',
				text:
					`Beste ${user.getString('first_name')},\n\nVandaag is er op jouw rekening gestreept:\n\n` +
					lines.join('\n') +
					`\n\nHuidig saldo: €${user.getFloat('balance').toFixed(2)}\n\nKlopt er iets niet? Meld het bij de barcommissie.`
			});
			$app.newMailClient().send(message);
		} catch (err) {
			console.log('digest mail failed for', userId, err);
		}
	}
});

// ---------------------------------------------------------------------------
// Deactivated accounts must not authenticate at all — neither a fresh OTP
// login nor a refresh of an existing year-long token. The login screen also
// checks `active`, but only cosmetically; this is the actual boundary.
// ---------------------------------------------------------------------------
onRecordAuthRequest((e) => {
	if (!e.record.getBool('active')) {
		throw new ForbiddenError('Je bent niet meer actief binnen de bar-app.');
	}
	e.next();
}, 'users');

// ---------------------------------------------------------------------------
// §6 guard: you can't demote/deactivate yourself, and never the last admin.
// ---------------------------------------------------------------------------
onRecordUpdateRequest((e) => {
	const original = e.app.findRecordById('users', e.record.id);
	const wasAdmin = original.getString('role') === 'admin';
	const losesAdmin =
		wasAdmin && (e.record.getString('role') !== 'admin' || !e.record.getBool('active'));

	if (losesAdmin) {
		if (e.auth && e.auth.id === e.record.id) {
			throw new BadRequestError('Je kunt jezelf niet degraderen of deactiveren.');
		}
		const others = e.app.findRecordsByFilter(
			'users',
			`role = "admin" && active = true && id != "${e.record.id}"`,
			'',
			1,
			0
		);
		if (others.length === 0) {
			throw new BadRequestError('Er moet minstens één actieve beheerder overblijven.');
		}
	}
	e.next();
}, 'users');
