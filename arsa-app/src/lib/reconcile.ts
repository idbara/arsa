import type { BankTransaction } from './bank-parsers';

export interface ArsaTransaction {
	id: string;
	date: string;
	amount: number;
	type: string;
	merchant: string | null;
	is_reconciled: boolean;
	categories: { name: string } | null;
	accounts: { name: string } | null;
}

export interface ReconcileMatch {
	bankTx: BankTransaction;
	candidates: ArsaTransaction[];
	selectedId: string | null;
	status: 'matched' | 'unmatched' | 'skipped';
}

export function reconcile(
	bankTransactions: BankTransaction[],
	arsaTransactions: ArsaTransaction[]
): ReconcileMatch[] {
	return bankTransactions.map((bankTx) => {
		const bankAmount = Math.abs(bankTx.amount);
		const bankIsExpense = bankTx.amount < 0;

		const candidates = arsaTransactions.filter((arsa) => {
			if (arsa.is_reconciled) return false;
			if (arsa.date !== bankTx.date) return false;

			const arsaAmount = Math.abs(Number(arsa.amount));
			if (Math.abs(arsaAmount - bankAmount) > 0.01) return false;

			if (bankIsExpense && arsa.type !== 'out') return false;
			if (!bankIsExpense && arsa.type !== 'in') return false;

			return true;
		});

		if (candidates.length === 1) {
			return {
				bankTx,
				candidates,
				selectedId: candidates[0].id,
				status: 'matched' as const
			};
		}

		return {
			bankTx,
			candidates,
			selectedId: null,
			status: 'unmatched' as const
		};
	});
}
