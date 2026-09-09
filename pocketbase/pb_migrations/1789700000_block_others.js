/// <reference path="../pb_data/types.d.ts" />
/**
 * Per-account switch for "strepen voor een ander".
 *
 * Stored inverted — `block_others` rather than `allow_others` — because a
 * PocketBase bool defaults to false: with the negative name every existing
 * account, and every account created outside the admin form, keeps the
 * intended default of *allowing* others without a backfill.
 *
 * Treat rounds ignore the flag: the host invited everyone by starting one.
 */
migrate(
	(app) => {
		const users = app.findCollectionByNameOrId('users');
		users.fields.add(new Field({ type: 'bool', name: 'block_others' }));
		app.save(users);
	},
	(app) => {
		const users = app.findCollectionByNameOrId('users');
		users.fields.removeByName('block_others');
		app.save(users);
	}
);
