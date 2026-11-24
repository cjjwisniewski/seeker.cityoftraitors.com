<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { focusTrap } from '$lib/actions/focusTrap';
	import { sanitizeExternalUrl } from '$lib/utils/seekingUtils';

	const DEFAULT_DISCORD_INVITE = 'https://discord.gg/a5Kyrfekxd';
	export let open = false;
	export let inviteUrl = DEFAULT_DISCORD_INVITE;

	$: safeInviteUrl =
		sanitizeExternalUrl(inviteUrl, DEFAULT_DISCORD_INVITE) || DEFAULT_DISCORD_INVITE;

	const dispatch = createEventDispatcher<{ close: void }>();

	function close() {
		dispatch('close');
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && open) {
			close();
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
	<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
	<div
		class="modal-backdrop"
		role="dialog"
		aria-modal="true"
		aria-labelledby="seeker-discord-modal-title"
		on:click={(e) => {
			if (e.target === e.currentTarget) close();
		}}
	>
		<div class="modal-card" use:focusTrap>
			<button type="button" class="modal-close" aria-label="Close dialog" on:click={close}>
				<i class="fa-solid fa-xmark"></i>
			</button>

			<div class="modal-badge">
				<i class="fa-brands fa-discord"></i>
				<span>Temporary Invite</span>
			</div>

			<h2 id="seeker-discord-modal-title">Join the City of Traitors Discord</h2>
			<p class="modal-body">
				This link is a <strong>temporary invite</strong> to the City of Traitors Discord server
				(home of Seeker). Once you arrive, please <strong>select a role</strong> in the server so your
				membership sticks permanently.
			</p>

			<div class="modal-actions">
				<button type="button" class="btn-secondary" on:click={close}>Cancel</button>
				<a
					href={safeInviteUrl}
					class="btn-primary"
					target="_blank"
					rel="noopener noreferrer"
					on:click={close}
				>
					<i class="fa-brands fa-discord"></i>
					<span>Continue to Discord</span>
				</a>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 2000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		background: rgba(2, 6, 23, 0.72);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
	}

	.modal-card {
		position: relative;
		width: 100%;
		max-width: 460px;
		background: var(--color-bg-elevated);
		border: 1px solid var(--color-border);
		border-radius: 14px;
		padding: 1.75rem;
		box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		text-align: left;
	}

	.modal-close {
		position: absolute;
		top: 0.85rem;
		right: 0.85rem;
		width: 34px;
		height: 34px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: 1px solid transparent;
		border-radius: 8px;
		color: var(--color-text-muted);
		cursor: pointer;
		transition:
			color var(--transition-fast),
			background-color var(--transition-fast),
			border-color var(--transition-fast);
	}

	.modal-close:hover {
		color: var(--color-text-primary);
		background: var(--color-bg-hover);
		border-color: var(--color-border);
	}

	.modal-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		width: fit-content;
		padding: 0.25rem 0.65rem;
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-primary);
		background: var(--color-primary-alpha);
	}

	h2 {
		margin: 0;
		font-size: 1.25rem;
		color: var(--color-text-primary);
	}

	.modal-body {
		margin: 0;
		font-size: 0.94rem;
		line-height: 1.6;
		color: var(--color-text-secondary);
	}

	.modal-body strong {
		color: var(--color-text-primary);
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		margin-top: 0.5rem;
	}

	.btn-primary,
	.btn-secondary {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.45rem;
		padding: 0.6rem 1.15rem;
		border-radius: 8px;
		font-size: 0.9rem;
		font-weight: 600;
		text-decoration: none;
		cursor: pointer;
		transition:
			background-color var(--transition-fast),
			border-color var(--transition-fast),
			color var(--transition-fast);
	}

	.btn-primary {
		background: var(--color-primary);
		color: #ffffff;
		border: 1px solid var(--color-primary);
	}

	.btn-primary:hover {
		background: var(--color-primary-dark);
		border-color: var(--color-primary-dark);
	}

	.btn-secondary {
		background: var(--color-bg-secondary);
		color: var(--color-text-primary);
		border: 1px solid var(--color-border);
	}

	.btn-secondary:hover {
		background: var(--color-bg-hover);
		border-color: var(--color-border-hover);
	}

	@media (max-width: 640px) {
		.modal-card {
			padding: 1.35rem;
		}

		.modal-actions {
			flex-direction: column-reverse;
		}

		.btn-primary,
		.btn-secondary {
			width: 100%;
			min-height: 44px;
		}
	}
</style>
