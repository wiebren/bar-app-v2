/// <reference path="../pb_data/types.d.ts" />
/** New brand option: Amstel Radler. */
migrate(
	(app) => {
		const products = app.findCollectionByNameOrId('products');
		const brand = products.fields.getByName('brand');
		brand.values = ['hertog_jan', 'grolsch', 'amstel', 'amstel_radler', 'lidl_cola', 'coca_cola', 'fanta'];
		app.save(products);
	},
	(app) => {
		app.db().newQuery("UPDATE products SET brand = '' WHERE brand = 'amstel_radler'").execute();

		const products = app.findCollectionByNameOrId('products');
		const brand = products.fields.getByName('brand');
		brand.values = ['hertog_jan', 'grolsch', 'amstel', 'lidl_cola', 'coca_cola', 'fanta'];
		app.save(products);
	}
);
