// Step 1: read the legacy `bar_app` MySQL database into a JSON snapshot.
//
// The snapshot keeps the legacy column names verbatim. Mapping decisions all
// live in the import step, so a mapping bug can be fixed and re-run without
// touching the production database again.

import mysql from 'mysql2/promise';
import { looksMojibake } from './pb.mjs';

/** Legacy tables, in the order they are written to the snapshot. */
const TABLES = {
	beheerders: 'SELECT * FROM beheerders ORDER BY beheerdernr',
	gebruikers: 'SELECT * FROM gebruikers ORDER BY GebruikersNr',
	producten: 'SELECT * FROM producten ORDER BY Productnr',
	verkoop: 'SELECT * FROM verkoop ORDER BY transactieNr',
	betalingen: 'SELECT * FROM betalingen ORDER BY betalingsnr',
	voorraad: 'SELECT * FROM voorraad ORDER BY ID',
	settings: 'SELECT * FROM settings ORDER BY settingsnr'
};

/**
 * @param {object} opts
 * @param {string} opts.host
 * @param {number} opts.port
 * @param {string} opts.user
 * @param {string} opts.password
 * @param {string} opts.database
 * @param {string} opts.charset  connection charset; see README on latin1 dumps
 * @param {(msg: string) => void} opts.log
 */
export async function exportMysql(opts) {
	const log = opts.log ?? (() => {});

	const conn = await mysql.createConnection({
		host: opts.host,
		port: opts.port,
		user: opts.user,
		password: opts.password,
		database: opts.database,
		charset: opts.charset,
		// keep DATE/TIME/DATETIME as strings: the legacy columns hold Amsterdam
		// wall-clock time, and letting the driver build JS Dates in the machine's
		// own timezone would shift every historical order
		dateStrings: true,
		supportBigNumbers: true,
		bigNumberStrings: true
	});

	const snapshot = {
		exported_at: new Date().toISOString(),
		source: { host: opts.host, port: opts.port, database: opts.database, charset: opts.charset },
		counts: {},
		tables: {}
	};

	try {
		for (const [table, sql] of Object.entries(TABLES)) {
			const [rows] = await conn.query(sql);
			snapshot.tables[table] = rows;
			snapshot.counts[table] = rows.length;
			log(`  ${table.padEnd(12)} ${String(rows.length).padStart(7)} rows`);
		}
	} finally {
		await conn.end();
	}

	snapshot.encoding_warnings = findEncodingWarnings(snapshot.tables);
	return snapshot;
}

/**
 * The legacy schema is `DEFAULT CHARSET=latin1` while the PHP pages served
 * UTF-8, which is exactly the setup that stores double-encoded text. Flag it
 * here so the operator can decide between re-exporting with --charset=latin1
 * and repairing on import with --fix-mojibake.
 */
function findEncodingWarnings(tables) {
	const samples = [];
	for (const [table, rows] of Object.entries(tables)) {
		for (const row of rows) {
			for (const [column, value] of Object.entries(row)) {
				if (looksMojibake(value)) {
					samples.push({ table, column, value });
					if (samples.length >= 20) return samples;
				}
			}
		}
	}
	return samples;
}
