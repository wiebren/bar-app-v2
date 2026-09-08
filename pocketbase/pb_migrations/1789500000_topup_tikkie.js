/// <reference path="../pb_data/types.d.ts" />
/**
 * Second top-up route: ask the treasurer for a Tikkie over WhatsApp.
 *
 * Scanning the QR code needs a second device, and most members open the app
 * on the same phone their banking app lives on. The phone number stays empty
 * so the Tikkie option only appears once an admin fills it in.
 */
migrate(
	(app) => {
		const settings = app.findCollectionByNameOrId('settings');
		settings.fields.add(new Field({ type: 'text', name: 'tikkie_phone' }));
		settings.fields.add(new Field({ type: 'text', name: 'tikkie_template' }));
		app.save(settings);

		const record = app.findFirstRecordByFilter('settings', "id != ''");
		record.set('tikkie_template', 'Hoi! Kun je mij een Tikkie sturen voor {bedrag}? Groet, {naam}');
		app.save(record);
	},
	(app) => {
		const settings = app.findCollectionByNameOrId('settings');
		settings.fields.removeByName('tikkie_phone');
		settings.fields.removeByName('tikkie_template');
		app.save(settings);
	}
);
