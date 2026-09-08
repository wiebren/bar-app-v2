/// <reference path="../pb_data/types.d.ts" />
/**
 * OTP login mail: code only, no direct-login button.
 *
 * The button linked to /login?otpId=...&code=..., but mail clients open
 * links in the default browser — never in the docked PWA — so the session
 * landed in the wrong place and the (single-use) code was consumed. Showing
 * only the code keeps the login inside whichever app requested it, and lets
 * Apple Mail's code detection offer the code above the keyboard (iOS 17+).
 */
migrate(
	(app) => {
		const users = app.findCollectionByNameOrId('users');
		users.otp.emailTemplate.subject = 'Je inlogcode voor {APP_NAME}';
		users.otp.emailTemplate.body = [
			'<p>Hallo,</p>',
			'<p>Je inlogcode voor {APP_NAME} is:</p>',
			'<p style="font-size:28px;font-weight:700;letter-spacing:3px;">{OTP}</p>',
			'<p>Vul deze code in op het inlogscherm van de app.</p>',
			'<p>Heb je dit niet zelf aangevraagd? Dan kun je deze e-mail negeren.</p>'
		].join('');
		app.save(users);
	},
	() => {
		// down: keep the customized template — nothing to restore
	}
);
