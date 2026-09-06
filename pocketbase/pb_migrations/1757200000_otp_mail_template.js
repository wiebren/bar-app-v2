/// <reference path="../pb_data/types.d.ts" />
/**
 * OTP login mail: direct-login button first, code below as fallback.
 * The button links to /login?otpId=...&code=..., which the login page
 * exchanges for a session automatically.
 *
 * NOTE: {APP_URL} comes from the PocketBase dashboard — set
 * Settings → Application → Application URL to the public domain.
 */
migrate(
	(app) => {
		const users = app.findCollectionByNameOrId('users');
		users.otp.emailTemplate.subject = 'Inloggen bij {APP_NAME}';
		users.otp.emailTemplate.body = [
			'<p>Hallo,</p>',
			'<p>Klik op de knop om direct in te loggen:</p>',
			'<p>',
			'<a href="{APP_URL}/login?otpId={OTP_ID}&amp;code={OTP}" target="_blank" rel="noopener" ',
			'style="display:inline-block;padding:12px 28px;background:#211d18;color:#ffffff;',
			'text-decoration:none;border-radius:8px;font-weight:600;">Inloggen bij {APP_NAME}</a>',
			'</p>',
			'<p>Werkt de knop niet? Vul dan deze code in op het inlogscherm:</p>',
			'<p style="font-size:24px;font-weight:700;letter-spacing:3px;">{OTP}</p>',
			'<p>Heb je dit niet zelf aangevraagd? Dan kun je deze e-mail negeren.</p>'
		].join('');
		app.save(users);
	},
	() => {
		// down: keep the customized template — nothing to restore
	}
);
