/// <reference path="../pb_data/types.d.ts" />
/**
 * Enforce the `active` flag server-side. Auth tokens last a year, so
 * deactivating a member must revoke API access, not just hide the login
 * button: every rule now requires an active account. Also restores the
 * create-time balance guard that auto-generated migration 1788724858
 * dropped (creating a user with a balance would bypass the payments
 * audit trail).
 */

const ACTIVE = '@request.auth.id != "" && @request.auth.active = true';
const ADMIN = '@request.auth.role = "admin" && @request.auth.active = true';

migrate(
	(app) => {
		const users = app.findCollectionByNameOrId('users');
		users.listRule = ACTIVE;
		users.viewRule = ACTIVE;
		users.createRule = `${ADMIN} && @request.body.balance:isset = false`;
		users.updateRule = `${ADMIN} && @request.body.balance:isset = false`;
		users.deleteRule = `${ADMIN} && active = false`;
		app.save(users);

		for (const name of ['products', 'orders', 'payments', 'parties']) {
			const c = app.findCollectionByNameOrId(name);
			c.listRule = ACTIVE;
			c.viewRule = ACTIVE;
			app.save(c);
		}

		const settings = app.findCollectionByNameOrId('settings');
		settings.listRule = ACTIVE;
		settings.viewRule = ACTIVE;
		settings.updateRule = ADMIN;
		app.save(settings);

		const stock = app.findCollectionByNameOrId('stock_entries');
		stock.listRule = ADMIN;
		stock.viewRule = ADMIN;
		stock.createRule = `${ADMIN} && @request.body.type = "purchase" && @request.body.qty > 0 && @request.body.actor = @request.auth.id && @request.body.order:isset = false`;
		app.save(stock);
	},
	(app) => {
		const AUTHED = '@request.auth.id != ""';
		const OLD_ADMIN = '@request.auth.role = "admin"';

		const users = app.findCollectionByNameOrId('users');
		users.listRule = AUTHED;
		users.viewRule = AUTHED;
		users.createRule = OLD_ADMIN;
		users.updateRule = `${OLD_ADMIN} && @request.body.balance:isset = false`;
		users.deleteRule = `${OLD_ADMIN} && active = false`;
		app.save(users);

		for (const name of ['products', 'orders', 'payments', 'parties']) {
			const c = app.findCollectionByNameOrId(name);
			c.listRule = AUTHED;
			c.viewRule = AUTHED;
			app.save(c);
		}

		const settings = app.findCollectionByNameOrId('settings');
		settings.listRule = AUTHED;
		settings.viewRule = AUTHED;
		settings.updateRule = OLD_ADMIN;
		app.save(settings);

		const stock = app.findCollectionByNameOrId('stock_entries');
		stock.listRule = OLD_ADMIN;
		stock.viewRule = OLD_ADMIN;
		stock.createRule = `${OLD_ADMIN} && @request.body.type = "purchase" && @request.body.qty > 0 && @request.body.actor = @request.auth.id && @request.body.order:isset = false`;
		app.save(stock);
	}
);
