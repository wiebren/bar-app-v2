#!/usr/bin/env node
// One-time migration: legacy PHP/MySQL bar-app -> PocketBase.
//
//   node migrate.mjs export --mysql-password=secret --out=dump.json
//   node migrate.mjs import --in=dump.json --db=../../pocketbase/pb_data/data.db --dry-run
//   node migrate.mjs import --in=dump.json --db=../../pocketbase/pb_data/data.db
//
// See README.md for the full runbook.

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { importSnapshot } from './lib/import-pocketbase.mjs';

const USAGE = `
Usage: node migrate.mjs <command> [options]

Commands
  export    read the legacy MySQL database into a JSON snapshot
  import    load a snapshot into a PocketBase pb_data/data.db
  all       export followed by import

Export options
  --mysql-host=HOST        default 127.0.0.1
  --mysql-port=PORT        default 3306
  --mysql-user=USER        default root
  --mysql-password=PASS    default empty (or set MYSQL_PASSWORD)
  --mysql-database=NAME    default bar_app
  --mysql-charset=CHARSET  connection charset, default utf8mb4
  --out=FILE               snapshot path, default ./legacy-dump.json

Import options
  --in=FILE                snapshot path, default ./legacy-dump.json
  --db=FILE                PocketBase data.db, default ../../pocketbase/pb_data/data.db
  --dry-run                run the whole import, report, then roll back
  --wipe                   delete existing app records first (superusers are kept)
  --fix-mojibake           repair latin1/utf8 double-encoded text while importing
  --tz=ZONE                timezone the legacy timestamps were written in,
                           default Europe/Amsterdam
  --no-backup              skip the pre-migration copy of data.db
  --report=FILE            also write the full report as JSON
`;

function parseArgs(argv) {
	const opts = {};
	const positional = [];
	for (const arg of argv) {
		if (arg.startsWith('--')) {
			const [key, ...rest] = arg.slice(2).split('=');
			opts[key] = rest.length ? rest.join('=') : true;
		} else {
			positional.push(arg);
		}
	}
	return { command: positional[0], opts };
}

const log = (msg = '') => console.log(msg);

// ---------------------------------------------------------------------------

async function runExport(opts) {
	const { exportMysql } = await import('./lib/export-mysql.mjs');
	const out = path.resolve(opts.out ?? 'legacy-dump.json');

	log(`Reading MySQL ${opts['mysql-database'] ?? 'bar_app'} ...`);
	const snapshot = await exportMysql({
		host: opts['mysql-host'] ?? '127.0.0.1',
		port: Number(opts['mysql-port'] ?? 3306),
		user: opts['mysql-user'] ?? 'root',
		password: opts['mysql-password'] ?? process.env.MYSQL_PASSWORD ?? '',
		database: opts['mysql-database'] ?? 'bar_app',
		charset: opts['mysql-charset'] ?? 'utf8mb4',
		log
	});

	fs.writeFileSync(out, JSON.stringify(snapshot, null, '\t'));
	log(`\nSnapshot written to ${out}`);

	if (snapshot.encoding_warnings.length) {
		log(`\n!  ${snapshot.encoding_warnings.length} value(s) look double-encoded, for example:`);
		for (const w of snapshot.encoding_warnings.slice(0, 5)) {
			log(`     ${w.table}.${w.column}: ${JSON.stringify(w.value)}`);
		}
		log('   Import with --fix-mojibake, or re-export with --mysql-charset=latin1.');
	}
	return out;
}

// ---------------------------------------------------------------------------

function backup(dbPath) {
	const stamp = new Date().toISOString().replace(/[:.]/g, '-');
	const target = `${dbPath}.pre-migration-${stamp}`;
	// VACUUM INTO writes a consistent copy including anything still in the WAL,
	// which a plain file copy would miss
	const db = new DatabaseSync(dbPath, { readOnly: true });
	try {
		db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
	} finally {
		db.close();
	}
	return target;
}

/**
 * Refuse to touch a database another process still has open.
 *
 * The `-shm`/`-wal` files are no help here: they survive a clean shutdown, and
 * merely opening the database recreates them. An exclusive locking-mode write,
 * on the other hand, can only be taken when nothing else holds the database —
 * exactly the question being asked.
 */
function assertNotRunning(dbPath) {
	const db = new DatabaseSync(dbPath);
	try {
		db.exec('PRAGMA locking_mode = EXCLUSIVE');
		db.exec('BEGIN IMMEDIATE');
		db.exec('ROLLBACK');
	} catch (err) {
		if (!/locked|busy/i.test(err.message)) throw err;
		throw new Error(
			`${dbPath} is locked by another process — PocketBase is probably still running. ` +
				'Stop it first: importing under a live server risks a corrupt database.'
		);
	} finally {
		db.close();
	}
}

function runImport(opts) {
	const dbPath = path.resolve(opts.db ?? '../../pocketbase/pb_data/data.db');
	const input = path.resolve(opts.in ?? 'legacy-dump.json');

	if (!fs.existsSync(dbPath)) throw new Error(`no PocketBase database at ${dbPath}`);
	if (!fs.existsSync(input)) throw new Error(`no snapshot at ${input}`);

	assertNotRunning(dbPath);

	const snapshot = JSON.parse(fs.readFileSync(input, 'utf8'));
	log(`Snapshot ${input} (exported ${snapshot.exported_at})`);
	for (const [table, n] of Object.entries(snapshot.counts ?? {})) {
		log(`  ${table.padEnd(12)} ${String(n).padStart(7)} rows`);
	}

	if (!opts['dry-run'] && !opts['no-backup']) {
		log(`\nBacking up ${dbPath} ...`);
		log(`  -> ${backup(dbPath)}`);
	}

	log(opts['dry-run'] ? '\nImporting (dry run) ...' : '\nImporting ...');
	const report = importSnapshot(snapshot, {
		dbPath,
		wipe: Boolean(opts.wipe),
		dryRun: Boolean(opts['dry-run']),
		fixMojibake: Boolean(opts['fix-mojibake']),
		tz: opts.tz ?? 'Europe/Amsterdam',
		log
	});

	printReport(report);
	if (opts.report) {
		fs.writeFileSync(path.resolve(opts.report), JSON.stringify(report, null, '\t'));
		log(`\nFull report written to ${path.resolve(opts.report)}`);
	}
	return report;
}

function printReport(report) {
	log('\nImported');
	for (const [collection, n] of Object.entries(report.counts)) {
		log(`  ${collection.padEnd(14)} ${String(n).padStart(7)}`);
	}

	if (report.admins.length) {
		log('\nAdmins (legacy `beheerders` -> role on users)');
		for (const a of report.admins) {
			log(`  ${a.username.padEnd(15)} -> ${a.name || '(no name)'} [matched by ${a.matched_by}]`);
		}
	}

	const ghostUsers = report.placeholders.users.length;
	const ghostProducts = report.placeholders.products.length;
	if (ghostUsers || ghostProducts) {
		log(`\nRebuilt from history: ${ghostUsers} user(s), ${ghostProducts} product(s)`);
		for (const p of [...report.placeholders.users, ...report.placeholders.products].slice(0, 10)) {
			log(`  ${p.name} (legacy id ${p.legacy_id})`);
		}
		if (ghostUsers + ghostProducts > 10) log(`  ... and ${ghostUsers + ghostProducts - 10} more`);
	}

	if (report.notes.length) {
		log('\nNotes');
		for (const note of report.notes) log(`  - ${note}`);
	}

	if (report.warnings.length) {
		log(`\nWarnings (${report.warnings.length})`);
		for (const w of report.warnings.slice(0, 25)) log(`  ! ${w}`);
		if (report.warnings.length > 25) log(`  ... and ${report.warnings.length - 25} more`);
	}

	if (report.reconciliation.length) {
		log(`\nBalances not fully explained by the imported history (${report.reconciliation.length})`);
		log('  Balances themselves are correct - they are copied from gebruikers.Saldo.');
		log('  A difference just means the tab predates the sale/payment tables.');
		log(`  ${'member'.padEnd(30)} ${'balance'.padStart(10)} ${'history'.padStart(10)} ${'diff'.padStart(10)}`);
		for (const r of report.reconciliation.slice(0, 10)) {
			log(
				`  ${r.name.slice(0, 30).padEnd(30)} ${r.balance.toFixed(2).padStart(10)} ` +
					`${r.from_history.toFixed(2).padStart(10)} ${r.difference.toFixed(2).padStart(10)}`
			);
		}
		if (report.reconciliation.length > 10) {
			log(`  ... and ${report.reconciliation.length - 10} more (use --report to see them all)`);
		}
	} else {
		log('\nEvery balance is fully explained by the imported history.');
	}
}

// ---------------------------------------------------------------------------

const { command, opts } = parseArgs(process.argv.slice(2));

try {
	if (command === 'export') {
		await runExport(opts);
	} else if (command === 'import') {
		runImport(opts);
	} else if (command === 'all') {
		const out = await runExport(opts);
		log('');
		runImport({ ...opts, in: out });
	} else {
		log(USAGE.trim());
		process.exit(command ? 1 : 0);
	}
} catch (err) {
	console.error(`\nmigrate: ${err.message}`);
	process.exit(1);
}
