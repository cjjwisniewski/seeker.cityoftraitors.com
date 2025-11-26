<script>
	import { PUBLIC_VERSION } from '$env/static/public';
</script>

<footer>
	<div class="footer-content">
		<p>&copy; {new Date().getFullYear()} Seeker. All rights reserved.</p>
		<p class="sub-text">Part of the City of Traitors community.</p>
	</div>
	<div class="version">
		<p>v{PUBLIC_VERSION}</p>
	</div>
</footer>

<style>
	footer {
		margin-top: auto;
		padding: 1.5rem 1rem;
		background: transparent;
		color: var(--color-text-muted);
		text-align: center;
		font-size: 0.85rem;
		position: relative;
		border-top: 1px solid transparent; /* Placeholder for potential border */
		transition: color var(--transition-normal);
	}

	.footer-content {
		margin: 0 auto;
		text-align: center;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.sub-text {
		font-size: 0.75rem;
		opacity: 0.8;
	}

	.version {
		position: absolute;
		bottom: 0.5rem;
		right: 1rem;
		font-size: 0.7rem;
		opacity: 0.5;
		font-family: monospace;
	}

	p {
		margin: 0;
	}
</style>
