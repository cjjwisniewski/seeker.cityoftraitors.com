<script>
    import { invalidate, goto } from '$app/navigation';
    export let data;
    const logout = async () => {
        document.cookie = 'discord_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        await invalidate('/');
        goto('/login');
    };
</script>

<link rel="stylesheet" href="/global.css">
<nav>
    <a href="/">Home</a>
    {#if data.user}
        <button on:click={logout}>Logout</button>
    {/if}
</nav>
<slot/>
