/** Client-side CSV download — semicolon-separated with BOM so Dutch Excel opens it directly. */
export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
	const csv = rows
		.map((r) =>
			r
				.map((v) => {
					const s = String(v ?? '');
					return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
				})
				.join(';')
		)
		.join('\r\n');
	const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
	const a = document.createElement('a');
	a.href = URL.createObjectURL(blob);
	a.download = filename;
	a.click();
	URL.revokeObjectURL(a.href);
}
