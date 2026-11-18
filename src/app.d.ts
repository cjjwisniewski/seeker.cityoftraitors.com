// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

declare module 'node:test' {
	export function describe(name: string, fn: () => void | Promise<void>): void;
	export function it(name: string, fn: () => void | Promise<void>): void;
	export function beforeEach(fn: () => void | Promise<void>): void;
}

declare module 'node:assert/strict' {
	const assert: {
		ok(value: unknown, message?: string): asserts value;
		equal(actual: unknown, expected: unknown, message?: string): void;
		deepEqual(actual: unknown, expected: unknown, message?: string): void;
	};
	export default assert;
}

export {};
