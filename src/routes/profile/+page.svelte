<script>
    export let data;
    
    // Format the user ID with spaces for readability
    $: formattedUserId = data.user.id.match(/.{1,4}/g)?.join(' ') || data.user.id;
</script>

<div class="profile-container">
    <div class="profile-header">
        <img 
            src="https://cdn.discordapp.com/avatars/{data.user.id}/{data.user.avatar}.png" 
            alt="{data.user.username}'s avatar"
            class="profile-avatar"
        />
        <div class="profile-title">
            <h1>{data.user.username}</h1>
        </div>
    </div>
    
    <div class="profile-content">
        <section class="profile-section">
            <h2>Profile Information</h2>
            <div class="info-grid">
                <div class="info-item">
                    <span class="label">Username</span>
                    <span class="value">{data.user.username}</span>
                </div>
                <div class="info-item">
                    <span class="label">User ID</span>
                    <span class="value user-id">{formattedUserId}</span>
                </div>
                {#if data.user.global_name}
                    <div class="info-item">
                        <span class="label">Display Name</span>
                        <span class="value">{data.user.global_name}</span>
                    </div>
                {/if}
            </div>
        </section>

        <section class="profile-section">
            <h2>City of Traitors Status</h2>
            <div class="status-grid">
                <div class="status-item">
                    <span class="label">Server Member</span>
                    <span class="value status {data.guildMember ? 'active' : 'inactive'}">
                        <i class="fa-solid {data.guildMember ? 'fa-check' : 'fa-xmark'}"></i>
                        {data.guildMember ? 'Active Member' : 'Not a Member'}
                    </span>
                </div>
                <div class="status-item">
                    <span class="label">Seeker Role</span>
                    <span class="value status {data.hasRole ? 'active' : 'inactive'}">
                        <i class="fa-solid {data.hasRole ? 'fa-check' : 'fa-xmark'}"></i>
                        {data.hasRole ? 'Has Role' : 'No Role'}
                    </span>
                </div>
                {#if data.isAdmin}
                    <div class="status-item">
                        <span class="label">Admin Status</span>
                        <span class="value status {data.isAdmin ? 'active' : 'inactive'}">
                            <i class="fa-solid {data.isAdmin ? 'fa-shield' : 'fa-xmark'}"></i>
                            {data.isAdmin ? 'Admin' : 'Not Admin'}
                        </span>
                    </div>
                {/if}
            </div>
        </section>
    </div>
</div>

<style>
    .profile-container {
        max-width: 800px;
        margin: 2rem auto;
        padding: 0 1rem;
    }

    .profile-header {
        display: flex;
        align-items: center;
        gap: 2rem;
        margin-bottom: 2rem;
    }

    .profile-avatar {
        width: 128px;
        height: 128px;
        border-radius: 50%;
        border: 4px solid var(--color-bg-elevated);
        box-shadow: var(--shadow-md);
    }

    .profile-title {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    h1 {
        margin: 0;
        color: var(--color-text-primary);
    }

    .user-id {
        font-family: monospace;
        font-size: 0.9rem;
        font-weight: normal;
    }

    .profile-content {
        display: flex;
        flex-direction: column;
        gap: 2rem;
    }

    .profile-section {
        background: var(--color-bg-elevated);
        border-radius: 8px;
        padding: 1.5rem;
        box-shadow: var(--shadow-sm);
    }

    h2 {
        margin: 0 0 1.5rem 0;
        color: var(--color-text-primary);
        font-size: 1.25rem;
    }

    .info-grid, .status-grid {
        display: grid;
        gap: 1rem;
    }

    .info-item, .status-item {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .label {
        color: var(--color-text-secondary);
        font-size: 0.9rem;
    }

    .value {
        color: var(--color-text-primary);
        font-weight: 500;
    }

    .status {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .status.active {
        color: #10b981;
    }

    .status.inactive {
        color: #ef4444;
    }

    @media (min-width: 640px) {
        .info-grid, .status-grid {
            grid-template-columns: repeat(2, 1fr);
        }
    }
</style>