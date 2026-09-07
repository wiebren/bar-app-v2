/// <reference path="../pb_data/types.d.ts" />
/** Rebrand: the generic orange "Sinas" becomes Fanta (with a real logo). */
migrate(
	(app) => {
		app.db().newQuery("UPDATE products SET brand = 'fanta' WHERE brand = 'sinas'").execute();

		const products = app.findCollectionByNameOrId('products');
		const brand = products.fields.getByName('brand');
		brand.values = ['hertog_jan', 'grolsch', 'amstel', 'lidl_cola', 'coca_cola', 'fanta'];
		app.save(products);
	},
	(app) => {
		app.db().newQuery("UPDATE products SET brand = 'sinas' WHERE brand = 'fanta'").execute();

		const products = app.findCollectionByNameOrId('products');
		const brand = products.fields.getByName('brand');
		brand.values = ['hertog_jan', 'grolsch', 'amstel', 'lidl_cola', 'coca_cola', 'sinas'];
		app.save(products);
	}
);
