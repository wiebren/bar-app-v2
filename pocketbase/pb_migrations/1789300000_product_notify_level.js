/// <reference path="../pb_data/types.d.ts" />
/** Optional per-product low-stock alert level (0/empty = no alert). */
migrate(
	(app) => {
		const products = app.findCollectionByNameOrId('products');
		products.fields.add(new Field({ type: 'number', name: 'notify_level', onlyInt: true, min: 0 }));
		app.save(products);
	},
	(app) => {
		const products = app.findCollectionByNameOrId('products');
		products.fields.removeByName('notify_level');
		app.save(products);
	}
);
