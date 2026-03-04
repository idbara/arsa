import { vi } from 'vitest';

type MockResponse<T = Record<string, unknown>> = {
	data: T | null;
	error: { message: string; code?: string } | null;
};

export function createMockSupabase(responses: Record<string, MockResponse> = {}) {
	const defaultResponse: MockResponse = { data: null, error: null };

	function createChain(tableName: string) {
		const response = responses[tableName] ?? defaultResponse;

		const chain = new Proxy(
			{
				select: vi.fn(),
				insert: vi.fn(),
				update: vi.fn(),
				delete: vi.fn(),
				upsert: vi.fn(),
				eq: vi.fn(),
				neq: vi.fn(),
				in: vi.fn(),
				gte: vi.fn(),
				lte: vi.fn(),
				lt: vi.fn(),
				order: vi.fn(),
				limit: vi.fn(),
				single: vi.fn().mockResolvedValue(response),
			},
			{
				get(target, prop) {
					if (prop === 'then') {
						return (resolve: (value: MockResponse) => void) => resolve(response);
					}
					if (prop === 'single') {
						return target.single;
					}
					const fn = (target as Record<string | symbol, unknown>)[prop];
					if (typeof fn === 'function') {
						return (..._args: unknown[]) => chain;
					}
					return fn;
				},
			}
		);

		return chain;
	}

	return {
		from: vi.fn((table: string) => createChain(table)),
		auth: {
			getSession: vi.fn().mockResolvedValue({
				data: { session: null },
				error: null,
			}),
			admin: {
				getUserById: vi.fn().mockResolvedValue({
					data: { user: null },
					error: null,
				}),
			},
		},
	};
}

export function createMockLocals(
	options: {
		session?: { user: { id: string; email: string } } | null;
		supabase?: ReturnType<typeof createMockSupabase>;
	} = {}
) {
	const supabase = options.supabase ?? createMockSupabase();
	return {
		supabase,
		safeGetSession: vi.fn().mockResolvedValue({
			session: options.session ? { user: options.session.user } : null,
		}),
	};
}
