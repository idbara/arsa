import Papa from 'papaparse';

export interface BankTransaction {
	date: string;
	amount: number;
	description: string;
}

function parseIndonesianNumber(str: string): number {
	if (!str || str.trim() === '' || str.trim() === '0.00' || str.trim() === '0') return 0;
	return parseFloat(str.replace(/,/g, ''));
}

function parseDateDDMMYYYY(str: string): string {
	const parts = str.trim().split('/');
	if (parts.length === 3) {
		return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
	}
	if (parts.length === 2) {
		const year = new Date().getFullYear();
		return `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
	}
	return str;
}

interface BcaRow {
	'Tanggal Transaksi'?: string;
	Tanggal?: string;
	Keterangan: string;
	'Mutasi Debet'?: string;
	'Mutasi Kredit'?: string;
	Jumlah?: string;
	Mutasi?: string;
}

function parseBcaRow(row: BcaRow): BankTransaction | null {
	const dateStr = row['Tanggal Transaksi'] || row['Tanggal'];
	if (!dateStr) return null;

	const date = parseDateDDMMYYYY(dateStr);
	const description = (row.Keterangan || '').trim();

	let amount: number;

	if (row['Mutasi Debet'] !== undefined && row['Mutasi Kredit'] !== undefined) {
		const debit = parseIndonesianNumber(row['Mutasi Debet']);
		const credit = parseIndonesianNumber(row['Mutasi Kredit']);
		amount = credit > 0 ? credit : -debit;
	} else if (row.Jumlah !== undefined && row.Mutasi !== undefined) {
		const value = parseIndonesianNumber(row.Jumlah);
		amount = row.Mutasi.trim() === 'CR' ? value : -value;
	} else {
		return null;
	}

	return { date, amount, description };
}

interface MandiriRow {
	Tanggal: string;
	Keterangan: string;
	Debet: string;
	Kredit: string;
}

function parseMandiriRow(row: MandiriRow): BankTransaction | null {
	const dateStr = row.Tanggal;
	if (!dateStr) return null;

	const date = parseDateDDMMYYYY(dateStr);
	const description = (row.Keterangan || '').trim();

	const debit = parseIndonesianNumber(row.Debet);
	const credit = parseIndonesianNumber(row.Kredit);
	const amount = credit > 0 ? credit : -debit;

	return { date, amount, description };
}

export type BankType = 'bca' | 'mandiri';

export function parseBankCsv(file: File, bank: BankType): Promise<BankTransaction[]> {
	return new Promise((resolve, reject) => {
		Papa.parse(file, {
			header: true,
			skipEmptyLines: true,
			dynamicTyping: false,
			complete(results) {
				const transactions: BankTransaction[] = [];

				for (const row of results.data as Record<string, string>[]) {
					let parsed: BankTransaction | null = null;

					if (bank === 'bca') {
						parsed = parseBcaRow(row as unknown as BcaRow);
					} else if (bank === 'mandiri') {
						parsed = parseMandiriRow(row as unknown as MandiriRow);
					}

					if (parsed && parsed.amount !== 0) {
						transactions.push(parsed);
					}
				}

				resolve(transactions);
			},
			error(err) {
				reject(new Error(err.message));
			}
		});
	});
}
