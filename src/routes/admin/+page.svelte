<script>
    export let data;
</script>

<div class="admin-container">
    <div class="admin-header">
        <h1>Admin Panel</h1>
        <p class="admin-subtitle">Logged in as {data.user.username}</p>
    </div>

    <div class="admin-content">
        <section class="admin-section">
            <h2>User Management</h2>
            <!-- Add user management features here -->
        </section>

        <section class="admin-section">
            <h2>System Status</h2>
            <!-- Add system status information here -->
        </section>
    </div>
</div>

<style>
    .admin-container {
        max-width: 1200px;
        margin: 2rem auto;
        padding: 0 1rem;
    }

    .admin-header {
        margin-bottom: 2rem;
    }

    .admin-subtitle {
        color: var(--color-text-secondary);
    }

    .admin-content {
        display: grid;
        gap: 2rem;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    }

    .admin-section {
        background: var(--color-bg-elevated);
        border-radius: 8px;
        padding: 1.5rem;
        box-shadow: var(--shadow-sm);
    }

    h1 {
        margin: 0;
        color: var(--color-text-primary);
    }

    h2 {
        margin: 0 0 1rem 0;
        color: var(--color-text-primary);
        font-size: 1.25rem;
    }
</style>