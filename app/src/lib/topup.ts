/**
 * Top-up helpers. Two routes exist and each is optional: an EPC QR code
 * (needs an IBAN) and a Tikkie request over WhatsApp (needs a phone number).
 */
export const TIKKIE_TEMPLATE = 'Hoi! Kun je mij een Tikkie sturen voor {bedrag}? Groet, {naam}';

export type TopupSettings = {
	iban?: string;
	account_holder?: string;
	remittance_template?: string;
	tikkie_phone?: string;
	tikkie_template?: string;
	// settings records carry many unrelated fields; keep them assignable
	[key: string]: unknown;
};

export const hasQrTopup = (s: TopupSettings | null | undefined) =>
	!!(s && s.iban && s.account_holder);

export const hasTikkieTopup = (s: TopupSettings | null | undefined) => !!s?.tikkie_phone;

/**
 * wa.me wants the number in international format, digits only. Admins tend to
 * type a Dutch mobile as 06…, so a single leading zero becomes +31.
 */
export function waNumber(raw: string, countryCode = '31'): string {
	const trimmed = (raw ?? '').trim();
	const international = trimmed.startsWith('+') || trimmed.startsWith('00');
	const digits = trimmed.replace(/\D/g, '');
	if (international) return digits.replace(/^00/, '');
	return digits.startsWith('0') ? countryCode + digits.slice(1) : digits;
}

export function waLink(phone: string, text: string): string {
	return `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(text)}`;
}

export function tikkieMessage(template: string, name: string, amount: string): string {
	return (template || TIKKIE_TEMPLATE).replaceAll('{naam}', name).replaceAll('{bedrag}', amount);
}
