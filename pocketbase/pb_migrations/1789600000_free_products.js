/// <reference path="../pb_data/types.d.ts" />
/**
 * Allow products that cost nothing (tap water, a free birthday round).
 *
 * PocketBase's `required` check rejects a number field's zero value with
 * "Cannot be blank", so a €0,00 price could not be saved. Dropping `required`
 * keeps `min: 0` doing the real work — negative prices stay rejected, and the
 * field still defaults to 0 when omitted. The order lines a free product
 * writes carry a 0 unit_price and total, so those lose `required` too.
 */
migrate(
	(app) => {
		const products = app.findCollectionByNameOrId('products');
		products.fields.getByName('price').required = false;
		app.save(products);

		const orders = app.findCollectionByNameOrId('orders');
		for (const name of ['unit_price', 'total']) {
			orders.fields.getByName(name).required = false;
		}
		app.save(orders);
	},
	(app) => {
		const products = app.findCollectionByNameOrId('products');
		products.fields.getByName('price').required = true;
		app.save(products);

		const orders = app.findCollectionByNameOrId('orders');
		for (const name of ['unit_price', 'total']) {
			orders.fields.getByName(name).required = true;
		}
		app.save(orders);
	}
);
