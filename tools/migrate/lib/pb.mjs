// PocketBase storage primitives.
//
// The importer writes straight into pb_data/data.db instead of going through
// the REST API, for one reason: `created` is an autodate field, and PocketBase
// stamps it with the current time on every create. Ten years of order history
// would all land on the migration date. At the SQLite level we control it.

import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const TOKEN_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function randomString(length, alphabet) {
	// 256 % alphabet.length is non-zero, so a plain modulo biases the low
	// characters; reject the tail of the byte range instead.
	const limit = Math.floor(256 / alphabet.length) * alphabet.length;
	let out = '';
	while (out.length < length) {
		for (const byte of crypto.randomBytes(length)) {
			if (byte >= limit) continue;
			out += alphabet[byte % alphabet.length];
			if (out.length === length) break;
		}
	}
	return out;
}

/** A record id in PocketBase's own shape: 15 lowercase alphanumerics. */
export function pbId() {
	return randomString(15, ID_ALPHABET);
}

/** Per-record token salt. Unique-indexed, so it must be random per user. */
export function pbTokenKey() {
	return randomString(50, TOKEN_ALPHABET);
}

/**
 * A bcrypt hash of a random string that is immediately discarded.
 *
 * v2 logs in with email OTP and has password auth switched off, so no password
 * carries over and none is wanted. It still cannot be left blank: PocketBase
 * validates `password` as required on every save of an auth record, so a user
 * with an empty one blows up the first time a hook books an order against
 * their balance. Hashing a throwaway secret per user keeps the record
 * indistinguishable from a normally created one, and unusable for login.
 */
export function pbPasswordHash() {
	return bcrypt.hashSync(crypto.randomBytes(24).toString('base64'), 10);
}

/** PocketBase datetime column format: "2006-01-02 15:04:05.000Z" (always UTC). */
export function pbDate(date) {
	if (!date) return '';
	return date.toISOString().replace('T', ' ');
}

/**
 * Offset of `tz` from UTC at instant `ts`, in milliseconds.
 * Intl is the only DST-correct source we get without a dependency.
 */
function tzOffset(tz, ts) {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: tz,
		hour12: false,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	}).formatToParts(new Date(ts));
	const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
	const asUtc = Date.UTC(
		Number(p.year),
		Number(p.month) - 1,
		Number(p.day),
		Number(p.hour) % 24,
		Number(p.minute),
		Number(p.second)
	);
	return asUtc - ts;
}

/**
 * Wall-clock time in `tz` -> the UTC instant it happened.
 *
 * The legacy app ran `date_default_timezone_set('Europe/Amsterdam')` and stored
 * bare DATE + TIME columns, so every timestamp in MySQL is Amsterdam local.
 * PocketBase stores UTC. Two passes converge because the offset moves by at
 * most an hour: guess using the UTC offset, then re-read the offset at the guess.
 */
export function localToUtc(y, mo, d, h = 0, mi = 0, s = 0, tz = 'Europe/Amsterdam') {
	const naive = Date.UTC(y, mo - 1, d, h, mi, s);
	let ts = naive;
	for (let i = 0; i < 2; i++) ts = naive - tzOffset(tz, ts);
	return new Date(ts);
}

/**
 * Parse a legacy MySQL DATE ("YYYY-MM-DD") plus TIME ("HH:MM:SS") into the UTC
 * instant. Both columns are read as strings (mysql2 `dateStrings`), so the
 * driver's own timezone never touches them.
 *
 * Rows with a date but no time (the stock ledger) land at midday local, which
 * keeps them on the same calendar day in UTC and in any European display zone.
 */
export function legacyTimestamp(dateStr, timeStr, tz) {
	if (!dateStr) return null;
	const d = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr));
	if (!d) return null;
	const [year, month, day] = [Number(d[1]), Number(d[2]), Number(d[3])];
	// MySQL happily stores '0000-00-00' in a NOT NULL DATE column, and feeding
	// that to Date.UTC rolls it back to 1899 instead of failing. Callers treat
	// null as "unusable date" and skip the row with a warning.
	if (year < 1970 || month < 1 || month > 12 || day < 1 || day > 31) return null;

	const t = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(String(timeStr ?? '')) ?? [];
	return localToUtc(
		year,
		month,
		day,
		t.length ? Number(t[1]) : 12,
		Number(t[2] ?? 0),
		Number(t[3] ?? 0),
		tz
	);
}

/**
 * Legacy money columns are VARCHARs filled by PHP string concatenation, so they
 * hold anything from "12.50" to "12,50" to "". Returns null when the value
 * cannot be read as a number, so callers can report it instead of silently
 * booking a zero.
 */
export function money(value) {
	if (value === null || value === undefined) return null;
	let s = String(value).trim().replace(/[€\s]/g, '');
	if (!s) return null;
	// "1.234,56" -> "1234.56"; "12,50" -> "12.50"
	if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
	else s = s.replace(/,/g, '');
	const n = Number(s);
	return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

export function round2(n) {
	return Math.round(n * 100) / 100;
}

/**
 * Undo the classic latin1/utf8 double-encoding ("Bj" + C3 83 C2 B6 + "rn").
 * Only rewrites when the bytes really do decode as UTF-8, so ASCII and
 * correctly-stored text pass through untouched.
 */
export function fixMojibake(text) {
	if (typeof text !== 'string' || !/[ÂÃ]/.test(text)) return text;
	const decoded = new TextDecoder('utf-8', { fatal: false }).decode(Buffer.from(text, 'latin1'));
	return decoded.includes('�') ? text : decoded;
}

/** Heuristic: does this string look like it was double-encoded? */
export function looksMojibake(text) {
	return typeof text === 'string' && /[Ã][-¿]|[Â][-¿]/.test(text);
}
