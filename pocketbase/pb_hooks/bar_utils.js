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
	sendBalanceMail,
	findDebtorGroup
};
