<script>
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';

    onMount(() => {
        const redirectTo = $page.data?.redirect || '/';
        console.log('Attempting redirect to:', redirectTo);
        window.location.href = redirectTo;
    });
</script>

<div class="callback-container">
    <p>Completing authentication...</p>
    <p class="small">You will be redirected automatically.</p>
</div>

<style>
    .callback-container {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        height: 100vh;
        font-family: system-ui, -apple-system, sans-serif;
    }
    .small {
        font-size: 0.8em;
        color: #666;
    }
</style>