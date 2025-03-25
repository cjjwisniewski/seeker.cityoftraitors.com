<script>
    export let data;
    
    // Format the user ID with spaces for readability
    $: formattedUserId = data.user.id.match(/.{1,4}/g)?.join(' ') || data.user.id;

    import { page } from '$app/stores';
    import { PUBLIC_DELETE_USER_ACCOUNT_FUNCTION_URL } from '$env/static/public';

    let showConfirmDialog = false;
    let deleteError = null;

    async function handleDeleteAccount() {
        try {
            const response = await fetch(PUBLIC_DELETE_USER_ACCOUNT_FUNCTION_URL, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'x-ms-client-principal-id': `user${$page.data.user?.id}`
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to delete account: ${errorText}`);
            }

            // Use the server-side logout endpoint instead of client-side cookie deletion
            window.location.href = '/auth/logout';
        } catch (e) {
            deleteError = e.message;
            console.error('Error deleting account:', e);
        } finally {
            showConfirmDialog = false;
        }
    }
</script>

<div class="profile-container">
    <div class="profile-header">
        <img 
            src="https://cdn.discordapp.com/avatars/{data.user.id}/{data.user.avatar}.png" 
            alt="{data.user.username}'s avatar"
            class="profile-avatar"
        />
        <div class="profile-title">
            <h1>{data.user.global_name}</h1>
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

        <section class="profile-section danger-zone">
            <h2>Danger Zone</h2>
            <div class="danger-content">
                <div class="danger-item">
                    <div class="danger-info">
                        <span class="label">Delete Account</span>
                        <span class="description">Permanently remove your account and all associated data</span>
                    </div>
                    <button class="delete-btn" on:click={() => showConfirmDialog = true}>
                        Delete Account
                    </button>
                </div>
            </div>
        </section>
        {#if deleteError}
            <div class="error-message">
                {deleteError}
            </div>
        {/if}
    </div>
</div>

{#if showConfirmDialog}
    <div class="modal-overlay">
        <div class="modal">
            <h3>Confirm Account Deletion</h3>
            <p>Are you sure you want to delete your account? This action cannot be undone.</p>
            <p>All your seeking list data will be permanently deleted.</p>
            
            <div class="modal-buttons">
                <button class="cancel-btn" on:click={() => showConfirmDialog = false}>
                    Cancel
                </button>
                <button class="confirm-btn" on:click={handleDeleteAccount}>
                    Yes, Delete My Account
                </button>
            </div>
        </div>
    </div>
{/if}

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

    .danger-zone {
        margin-top: 2rem;
        border: 1px solid var(--color-error);
    }

    .danger-zone h2 {
        color: var(--color-error);
    }

    .danger-content {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .danger-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.5rem 0;
    }

    .danger-info {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .danger-info .description {
        color: var(--color-text-secondary);
        font-size: 0.9rem;
    }

    .delete-btn {
        background-color: var(--color-error);
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.2s;
    }

    .delete-btn:hover {
        background-color: #b91c1c;
    }

    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .modal {
        background: var(--color-bg-elevated);
        padding: 2rem;
        border-radius: 8px;
        max-width: 400px;
        width: 90%;
    }

    .modal-buttons {
        display: flex;
        gap: 1rem;
        margin-top: 1.5rem;
    }

    .cancel-btn {
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border);
        padding: 0.5rem 1rem;
        border-radius: 4px;
        cursor: pointer;
    }

    .confirm-btn {
        background: var(--color-error);
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 4px;
        cursor: pointer;
    }

    .error-message {
        color: var(--color-error);
        margin-top: 1rem;
        padding: 1rem;
        border: 1px solid var(--color-error);
        border-radius: 4px;
    }
</style>