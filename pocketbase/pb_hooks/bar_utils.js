/// <reference path="../pb_data/types.d.ts" />
// Shared helpers for the bar hooks. PocketBase handlers run in isolated
// contexts, so they pull these in with require(`${__hooks}/bar_utils.js`).

function getSettings(app) {
	return app.findFirstRecordByFilter('settings', "id != ''");
}

/**
 * Auth tokens last a year, so deactivation must be re-checked on every
 * custom route — requireAuth() alone would keep serving an ex-member.
 */
function requireActive(e) {
	if (!e.auth || !e.auth.getBool('active')) {
		throw new ForbiddenError('Je account is niet actief.');
	}
}

function requireActiveAdmin(e) {
	requireActive(e);
	if (e.auth.getString('role') !== 'admin') throw new ForbiddenError();
}

function fullName(user) {
	return [user.getString('first_name'), user.getString('infix'), user.getString('last_name')]
		.filter(Boolean)
		.join(' ');
}

function round2(n) {
	return Math.round(n * 100) / 100;
}

/**
 * Hours the Netherlands is ahead of UTC at the given moment: 2 during EU
 * summer time (last Sunday of March 01:00 UTC to last Sunday of October
 * 01:00 UTC), else 1. Computed by hand — cron runs in UTC and the JSVM has
 * no time zone database.
 */
function nlUtcOffset(date) {
	const lastSunday = (month) => {
		const d = new Date(Date.UTC(date.getUTCFullYear(), month + 1, 0, 1));
		d.setUTCDate(d.getUTCDate() - d.getUTCDay());
		return d;
	};
	return date >= lastSunday(2) && date < lastSunday(9) ? 2 : 1;
}

/**
 * Send one of the templated balance mails ("red" | "yellow") to a user.
 * Body layout matches the old app: salutation + first name, text, balance, text.
 */
function sendBalanceMail(app, settings, prefix, user) {
	if (!user.email()) return false;
	const body =
		settings.getString('mail_' + prefix + '_salutation') +
		' ' +
		user.getString('first_name') +
		',\n\n' +
		settings.getString('mail_' + prefix + '_text_before') +
		' €' +
		user.getFloat('balance').toFixed(2) +
		'\n\n' +
		settings.getString('mail_' + prefix + '_text_after');

	const message = new MailerMessage({
		from: {
			address: settings.getString('sender_address') || app.settings().meta.senderAddress,
			name: settings.getString('app_title') || 'Bar-app'
		},
		to: [{ address: user.email() }],
		subject: settings.getString('mail_' + prefix + '_subject'),
		text: body
	});
	app.newMailClient().send(message);
	return true;
}

/** Send one mail to all active admins with an email, as joint recipients. */
function sendAdminMail(app, subject, text) {
	const admins = app.findRecordsByFilter(
		'users',
		"role = 'admin' && active = true && email != ''",
		'last_name',
		0,
		0
	);
	if (!admins.length) return false;

	const settings = getSettings(app);
	const message = new MailerMessage({
		from: {
			address: settings.getString('sender_address') || app.settings().meta.senderAddress,
			name: settings.getString('app_title') || 'Bar-app'
		},
		to: admins.map((a) => ({ address: a.email() })),
		subject,
		text
	});
	app.newMailClient().send(message);
	return true;
}

/** Mail the admins that a product's stock dropped under its notify level. */
function sendLowStockMail(app, info) {
	return sendAdminMail(
		app,
		`Voorraad laag: ${info.name}`,
		`Beste barcommissie,\n\n` +
			`De voorraad van ${info.name} is gezakt naar ${info.stock} (meldgrens: ${info.level}).\n\n` +
			`Tijd om bij te bestellen.`
	);
}

/**
 * Mail the admins that part of a product's stock has been on the shelf
 * for over 3 months (stock exceeds what was added in that period).
 */
function sendStockAgeMail(app, info) {
	return sendAdminMail(
		app,
		`Houdbaarheid: ${info.name}`,
		`Beste barcommissie,\n\n` +
			`Van ${info.name} liggen er ${info.total} op voorraad, terwijl er de afgelopen 3 maanden ` +
			`${info.added} zijn bijgeboekt.\n\n` +
			`Minstens ${info.total - info.added} stuks liggen er dus al langer dan 3 maanden — ` +
			`controleer de houdbaarheidsdatum.`
	);
}

/** Active users with an email in the "red" (balance < 0) or "yellow" (0..threshold) group. */
function findDebtorGroup(app, group) {
	let filter;
	if (group === 'red') {
		filter = "active = true && email != '' && balance < 0";
	} else if (group === 'yellow') {
		const yellow = getSettings(app).getFloat('yellow_threshold');
		filter = `active = true && email != '' && balance >= 0 && balance < ${yellow}`;
	} else {
		throw new BadRequestError('Onbekende groep.');
	}
	return app.findRecordsByFilter('users', filter, 'last_name', 0, 0);
}

module.exports = {
	getSettings,
	requireActive,
	requireActiveAdmin,
	fullName,
	round2,
	nlUtcOffset,
	sendBalanceMail,
	sendAdminMail,
	sendLowStockMail,
	sendStockAgeMail,
	findDebtorGroup
};
