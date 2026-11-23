import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { get } from 'svelte/store';
import { auth } from '$lib/stores/auth';
import { fetchWithAuth } from '$lib/utils/api';

describe('auth store and fetchWithAuth fail-closed Demo Mode interception', () => {
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		globalThis.localStorage.clear();
		auth.clearAuthData();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it('enters Demo Mode with token: null, isAdmin: false, and Cardmarket disabled', () => {
		auth.enterDemoMode(true);
		const state = get(auth);
		assert.equal(state.isAuthenticated, true);
		assert.equal(state.isDemo, true);
		assert.equal(state.token, null);
		assert.equal(state.user?.isAdmin, false);
		assert.equal(state.user?.settings?.marketplaceCardmarketEnabled, false);
	});

	it('short-circuits fetchWithAuth in Demo Mode with zero outbound network calls', async () => {
		auth.enterDemoMode(true);

		let networkCalls = 0;
		globalThis.fetch = async () => {
			networkCalls++;
			throw new Error('Unexpected live network fetch during Demo Mode!');
		};

		// 1. Valid Seeking list fetch succeeds locally from virtual store
		const listRes = await fetchWithAuth('https://seeker.azure-api.net/seeker/getSeekingList');
		if (!listRes) {
			throw new Error('Expected Demo Mode response for getSeekingList');
		}
		assert.equal(listRes.status, 200);
		const listBody = await listRes.json();
		assert.equal(Array.isArray(listBody.cards), true);
		assert.equal(listBody.cards.length, 12);

		// 2. Admin, account deletion, cross-user targetUserId, and live Moxfield proxy return 403
		const adminRes = await fetchWithAuth('https://seeker.azure-api.net/seeker/getSystemStatus');
		assert.equal(adminRes?.status, 403);

		const delAcctRes = await fetchWithAuth('https://seeker.azure-api.net/seeker/deleteUserAccount', {
			method: 'POST'
		});
		assert.equal(delAcctRes?.status, 403);

		const crossUserRes = await fetchWithAuth(
			'https://seeker.azure-api.net/seeker/updateUserSetting',
			{
				method: 'POST',
				body: JSON.stringify({
					targetUserId: 'user999',
					settingName: 'stockAlertEnabled',
					settingValue: false
				})
			}
		);
		assert.equal(crossUserRes?.status, 403);

		const moxRes = await fetchWithAuth('https://seeker.azure-api.net/seeker/fetchMoxfieldDeck', {
			method: 'POST',
			body: JSON.stringify({ publicId: 'abc123XYZ' })
		});
		assert.equal(moxRes?.status, 403);

		// Zero live fetch calls were executed
		assert.equal(networkCalls, 0);
	});

	it('attaches Bearer token for authenticated sessions and clears auth on 401', async () => {
		auth.setAuthData('signed-jwt-token', {
			id: '12345',
			username: 'Karn',
			roles: ['1352632325640294411']
		});
		assert.equal(get(auth).user?.isAdmin, true);

		let capturedAuthHeader: string | null = null;
		globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
			const hdrs = new Headers(init?.headers);
			capturedAuthHeader = hdrs.get('Authorization');
			return new Response(JSON.stringify({ error: 'expired' }), { status: 401 });
		};

		const res = await fetchWithAuth('https://seeker.azure-api.net/seeker/getSeekingList');
		assert.equal(capturedAuthHeader, 'Bearer signed-jwt-token');
		assert.equal(res, undefined);
		assert.equal(get(auth).isAuthenticated, false);
		assert.equal(get(auth).token, null);
		assert.equal(get(auth).intendedPath, '/seeking');
	});
});
