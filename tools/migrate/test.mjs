// Checks for the conversions that are easy to get quietly wrong.
// Run with: node --test

import test from 'node:test';
import assert from 'node:assert/strict';
import { money, legacyTimestamp, pbDate, fixMojibake, looksMojibake, pbId, pbTokenKey } from './lib/pb.mjs';

test('money reads the shapes PHP left in the VARCHAR columns', () => {
	assert.equal(money('12.50'), 12.5);
	assert.equal(money('12,50'), 12.5); // Dutch decimal comma
	assert.equal(money('1.234,56'), 1234.56); // thousands separator
	assert.equal(money('-3.45'), -3.45);
	assert.equal(money('0.00'), 0);
	assert.equal(money(' 7.20 '), 7.2);
	assert.equal(money(0), 0);
	// unreadable values must be distinguishable from a real zero, so the
	// importer can warn instead of silently booking 0.00
	assert.equal(money('n.v.t.'), null);
	assert.equal(money(''), null);
	assert.equal(money(null), null);
});

test('legacy timestamps convert from Amsterdam wall-clock to UTC', () => {
	// summer: CEST is UTC+2
	assert.equal(pbDate(legacyTimestamp('2024-06-21', '21:30:00')), '2024-06-21 19:30:00.000Z');
	// winter: CET is UTC+1, and just after midnight this moves the date back
	assert.equal(pbDate(legacyTimestamp('2024-01-15', '00:30:00')), '2024-01-14 23:30:00.000Z');
	// the DST switch itself (03:00 CEST on 2024-03-31)
	assert.equal(pbDate(legacyTimestamp('2024-03-31', '04:00:00')), '2024-03-31 02:00:00.000Z');
	// a date with no time lands at midday, so it keeps its calendar day
	assert.equal(pbDate(legacyTimestamp('2024-06-01', null)), '2024-06-01 10:00:00.000Z');
	assert.equal(legacyTimestamp('', '12:00:00'), null);
	assert.equal(legacyTimestamp('0000-00-00', '12:00:00'), null);
});

test('mojibake repair only touches genuinely double-encoded text', () => {
	assert.equal(fixMojibake('RenÃ©e'), 'Renée');
	assert.equal(fixMojibake('BjÃ¶rn'), 'Björn');
	// already correct, and plain ASCII, must survive untouched
	assert.equal(fixMojibake('Björn'), 'Björn');
	assert.equal(fixMojibake('Jan'), 'Jan');

	assert.equal(looksMojibake('RenÃ©e'), true);
	assert.equal(looksMojibake('Björn'), false);
	assert.equal(looksMojibake('Jan'), false);
});

test('generated identifiers match what PocketBase produces', () => {
	assert.match(pbId(), /^[a-z0-9]{15}$/);
	assert.match(pbTokenKey(), /^[A-Za-z0-9]{50}$/);
	// tokenKey is unique-indexed, so collisions would abort the import
	assert.equal(new Set(Array.from({ length: 500 }, pbTokenKey)).size, 500);
});
