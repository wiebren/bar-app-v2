/// <reference path="../pb_data/types.d.ts" />
/**
 * Initial schema for the bar-app rebuild (see bar-app-spec.md §3).
 * Run automatically on `./pocketbase serve` / `./pocketbase migrate`.
 */

const ADMIN = '@request.auth.role = "admin"';
const AUTHED = '@request.auth.id != ""';

migrate(
	(app) => {
		// ---- users (extend the default auth collection) ----
		const users = app.findCollectionByNameOrId('users');
		users.fields.add(new Field({ type: 'text', name: 'first_name', required: true, max: 50 }));
		users.fields.add(new Field({ type: 'text', name: 'infix', max: 25 }));
		users.fields.add(new Field({ type: 'text', name: 'last_name', required: true, max: 50 }));
		users.fields.add(new Field({ type: 'text', name: 'phone', max: 20 }));
		users.fields.add(new Field({ type: 'bool', name: 'active' }));
		users.fields.add(
			new Field({ type: 'select', name: 'role', values: ['user', 'admin'], maxSelect: 1 })
		);
		users.fields.add(new Field({ type: 'number', name: 'balance' }));

		// passwordless: email OTP only, sessions last a year (the old cookie behaviour)
		users.passwordAuth.enabled = false;
		users.otp.enabled = true;
		users.authToken.duration = 60 * 60 * 24 * 365;

		// everyone logged in sees users + balances (needed on the till);
		// balance is server-managed and never accepted from a client
		users.listRule = AUTHED;
		users.viewRule = AUTHED;
		users.createRule = `${ADMIN} && @request.body.balance:isset = false`;
		users.updateRule = `${ADMIN} && @request.body.balance:isset = false`;
		users.deleteRule = `${ADMIN} && active = false`;
		app.save(users);

		// ---- products ----
		const products = new Collection({
			type: 'base',
			name: 'products',
			listRule: AUTHED,
			viewRule: AUTHED,
			createRule: ADMIN,
			updateRule: ADMIN,
			deleteRule: null, // products are retired via flags, never hard-deleted
			fields: [
				{ type: 'text', name: 'name', required: true, max: 50 },
				{ type: 'number', name: 'price', required: true, min: 0 },
				{ type: 'number', name: 'sort_order', onlyInt: true },
				{ type: 'bool', name: 'sellable' },
				{ type: 'bool', name: 'stock_tracked' },
				{ type: 'autodate', name: 'created', onCreate: true },
				{ type: 'autodate', name: 'updated', onCreate: true, onUpdate: true }
			]
		});
		app.save(products);

		// ---- orders (immutable; written only by the /api/bar/order hook) ----
		const orders = new Collection({
			type: 'base',
			name: 'orders',
			listRule: AUTHED,
			viewRule: AUTHED,
			createRule: null,
			updateRule: null,
			deleteRule: null,
			fields: [
				{ type: 'relation', name: 'user', required: true, collectionId: users.id, maxSelect: 1 },
				{ type: 'relation', name: 'booked_by', required: true, collectionId: users.id, maxSelect: 1 },
				{ type: 'relation', name: 'product', required: true, collectionId: products.id, maxSelect: 1 },
				{ type: 'text', name: 'product_name', required: true },
				{ type: 'number', name: 'unit_price', required: true },
				{ type: 'number', name: 'qty', required: true, onlyInt: true },
				{ type: 'number', name: 'total', required: true },
				{ type: 'autodate', name: 'created', onCreate: true }
			]
		});
		app.save(orders);

		// ---- payments (immutable; written only by the /api/bar/topup hook) ----
		const payments = new Collection({
			type: 'base',
			name: 'payments',
			listRule: AUTHED, // the till shows any tab's last top-up
			viewRule: AUTHED,
			createRule: null,
			updateRule: null,
			deleteRule: null,
			fields: [
				{ type: 'relation', name: 'user', required: true, collectionId: users.id, maxSelect: 1 },
				{ type: 'relation', name: 'admin', required: true, collectionId: users.id, maxSelect: 1 },
				{ type: 'number', name: 'amount', required: true },
				{ type: 'number', name: 'balance_old' },
				{ type: 'number', name: 'balance_new' },
				{ type: 'autodate', name: 'created', onCreate: true }
			]
		});
		app.save(payments);

		// ---- stock_entries (append-only ledger) ----
		// sales and counts are written by hooks; purchases may be booked directly
		// by an admin, but only as themselves and only with a positive quantity
		const stock = new Collection({
			type: 'base',
			name: 'stock_entries',
			listRule: ADMIN,
			viewRule: ADMIN,
			createRule: `${ADMIN} && @request.body.type = "purchase" && @request.body.qty > 0 && @request.body.actor = @request.auth.id && @request.body.order:isset = false`,
			updateRule: null,
			deleteRule: null,
			fields: [
				{ type: 'select', name: 'type', required: true, values: ['purchase', 'sale', 'count'], maxSelect: 1 },
				{ type: 'relation', name: 'product', required: true, collectionId: products.id, maxSelect: 1 },
				{ type: 'number', name: 'qty', required: true },
				{ type: 'date', name: 'date', required: true },
				{ type: 'relation', name: 'order', collectionId: orders.id, maxSelect: 1 },
				{ type: 'relation', name: 'actor', collectionId: users.id, maxSelect: 1 },
				{ type: 'autodate', name: 'created', onCreate: true }
			]
		});
		app.save(stock);

		// ---- settings (single record) ----
		const settings = new Collection({
			type: 'base',
			name: 'settings',
			listRule: AUTHED, // till needs app_title, yellow_threshold, top-up fields
			viewRule: AUTHED,
			createRule: null,
			updateRule: ADMIN,
			deleteRule: null,
			fields: [
				{ type: 'text', name: 'app_title' },
				{ type: 'number', name: 'yellow_threshold' },
				{ type: 'number', name: 'red_alert_threshold' },
				{ type: 'text', name: 'sender_address' },
				{ type: 'text', name: 'mail_red_subject' },
				{ type: 'text', name: 'mail_red_salutation' },
				{ type: 'text', name: 'mail_red_text_before' },
				{ type: 'text', name: 'mail_red_text_after' },
				{ type: 'text', name: 'mail_yellow_subject' },
				{ type: 'text', name: 'mail_yellow_salutation' },
				{ type: 'text', name: 'mail_yellow_text_before' },
				{ type: 'text', name: 'mail_yellow_text_after' },
				{ type: 'bool', name: 'digest_enabled' },
				{ type: 'text', name: 'iban' },
				{ type: 'text', name: 'account_holder' },
				{ type: 'text', name: 'remittance_template' }
			]
		});
		app.save(settings);

		// seed the single settings record with sensible defaults
		const record = new Record(settings);
		record.set('app_title', 'Bar-app');
		record.set('yellow_threshold', 10);
		record.set('red_alert_threshold', -100);
		record.set('mail_red_subject', 'Je barsaldo staat rood');
		record.set('mail_red_salutation', 'Beste');
		record.set('mail_red_text_before', 'Je saldo is momenteel');
		record.set('mail_red_text_after', 'Graag zo snel mogelijk aanvullen.');
		record.set('mail_yellow_subject', 'Je barsaldo raakt op');
		record.set('mail_yellow_salutation', 'Beste');
		record.set('mail_yellow_text_before', 'Je saldo is momenteel');
		record.set('mail_yellow_text_after', 'Denk aan het opwaarderen van je saldo.');
		record.set('digest_enabled', true);
		record.set('remittance_template', 'Bartegoed {naam}');
		app.save(record);
	},
	(app) => {
		for (const name of ['stock_entries', 'payments', 'orders', 'products', 'settings']) {
			app.delete(app.findCollectionByNameOrId(name));
		}
		const users = app.findCollectionByNameOrId('users');
		for (const f of ['first_name', 'infix', 'last_name', 'phone', 'active', 'role', 'balance']) {
			users.fields.removeByName(f);
		}
		app.save(users);
	}
);
