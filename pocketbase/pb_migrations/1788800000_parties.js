/// <reference path="../pb_data/types.d.ts" />
/**
 * Party mode ("Ik trakteer"): any user can treat everyone for a while.
 * Written only by the /api/bar/party* hooks; `used` counts drinks against
 * the optional cap.
 */

const AUTHED = '@request.auth.id != ""';

migrate(
	(app) => {
		const users = app.findCollectionByNameOrId('users');
		const parties = new Collection({
			type: 'base',
			name: 'parties',
			listRule: AUTHED,
			viewRule: AUTHED,
			createRule: null,
			updateRule: null,
			deleteRule: null,
			fields: [
				{ type: 'relation', name: 'host', required: true, collectionId: users.id, maxSelect: 1 },
				{ type: 'text', name: 'message', max: 100 },
				{ type: 'number', name: 'cap', onlyInt: true, min: 0 }, // 0 = no cap
				{ type: 'number', name: 'used', onlyInt: true },
				{ type: 'date', name: 'ends', required: true },
				{ type: 'autodate', name: 'created', onCreate: true }
			]
		});
		app.save(parties);
	},
	(app) => {
		app.delete(app.findCollectionByNameOrId('parties'));
	}
);
