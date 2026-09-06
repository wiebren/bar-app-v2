/**
 * Build an EPC069-12 "SCT" payload (the SEPA credit-transfer QR that Dutch
 * banking apps scan). Version 002 — BIC may be left empty.
 */
export function epcPayload(opts: {
	accountHolder: string;
	iban: string;
	amount: number;
	remittance: string;
}): string {
	return [
		'BCD',
		'002',
		'1', // UTF-8
		'SCT',
		'', // BIC (optional in v002)
		opts.accountHolder.slice(0, 70),
		opts.iban.replace(/\s+/g, ''),
		'EUR' + opts.amount.toFixed(2),
		'', // purpose
		'', // structured reference
		opts.remittance.slice(0, 140)
	].join('\n');
}
