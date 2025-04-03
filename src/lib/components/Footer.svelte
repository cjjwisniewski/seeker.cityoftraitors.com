<script>
    import { PUBLIC_VERSION } from '$env/static/public';
</script>

<footer>
    <div class="footer-content">
        <p>&copy; {new Date().getFullYear()} Seeker. All rights reserved.</p>
        <p>Part of the City of Traitors community.</p>
    </div>
    <div class="version">
        <p>v{PUBLIC_VERSION}</p>
    </div>
</footer>

<style>
    footer {
        margin-top: auto;
        padding: 0.2em;
        background: transparent;
        color: --color-text-secondary;
        text-align: center;
        font-size: 0.8rem;
        position: relative;
    }

    .footer-content {
        margin: 0 auto;
        text-align: center;
    }

    .version {
        position: absolute;
        bottom: 0.5em;
        right: 1em;
        opacity: 0.7;
    }

    p {
        margin: 0.5em 0;
    }
</style>