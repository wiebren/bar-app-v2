/// <reference path="../pb_data/types.d.ts" />
/** Optional brand on products, for visual indicators on the till buttons. */
migrate(
	(app) => {
		const products = app.findCollectionByNameOrId('products');
		products.fields.add(
			new Field({
				type: 'select',
				name: 'brand',
				maxSelect: 1,
				values: ['hertog_jan', 'grolsch', 'amstel', 'lidl_cola', 'coca_cola', 'sinas']
			})
		);
		app.save(products);
	},
	(app) => {
		const products = app.findCollectionByNameOrId('products');
		products.fields.removeByName('brand');
		app.save(products);
	}
);
