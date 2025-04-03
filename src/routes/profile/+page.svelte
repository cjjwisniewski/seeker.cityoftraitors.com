<script>
    import { onMount } from 'svelte'; // Import onMount
    import { page } from '$app/stores';
    import { PUBLIC_DELETE_USER_ACCOUNT_FUNCTION_URL } from '$env/static/public';

    export let data; // User data from load function (e.g., +page.server.js)

    // State variables
    let showConfirmDialog = false;
    let deleteError = null;
    let accessToken = null; // To store the auth token

    // Format the user ID with spaces for readability (using data passed from server)
    $: formattedUserId = data.user?.id?.match(/.{1,4}/g)?.join(' ') || data.user?.id || 'N/A';

    // --- Helper function to read a specific cookie ---
    function getCookie(name) {
        if (typeof document === 'undefined') return null; // Check if running client-side
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) {
            try {
                // Decode the cookie value
                return decodeURIComponent(parts.pop().split(';').shift());
            } catch(e) {
                console.error("Error decoding cookie", e);
                return null;
            }
        }
        return null;
    }

    // --- Lifecycle: Read token onMount ---
    onMount(() => {
        accessToken = getCookie('discord_token'); // Read the token
        if (!accessToken) {
            console.error("Profile Page: Authentication token not found in cookie.");
            // Consider disabling the delete button or showing a persistent error
             deleteError = "Cannot perform actions: Authentication token missing."; // Show error immediately if no token
        }
    });

    // --- Delete Account Logic ---
    async function handleDeleteAccount() {
        deleteError = null; // Clear previous errors

        if (!accessToken) {
            deleteError = "Action failed: Authentication token is missing.";
            console.error("Delete attempt failed: accessToken is null.");
            showConfirmDialog = false; // Close dialog
            return;
        }

        const userIdToDelete = data.user?.id;
        console.log(`Attempting to delete account for user ID: ${userIdToDelete}`); // Log line 58

        try {
            // *** UPDATED FETCH CALL for Invalid JSON format error ***
            const response = await fetch(PUBLIC_DELETE_USER_ACCOUNT_FUNCTION_URL, { // Log line 62 is the start of this fetch
                method: 'DELETE',
                headers: {
                    // ADD Content-Type back
                    'Content-Type': 'application/json',
                    // Keep the Authorization header
                    'Authorization': `Bearer ${accessToken}`
                },
                // ADD an empty JSON object as the body
                body: JSON.stringify({})
            });

            if (!response.ok) {
                 let errorText = await response.text();
                try {
                    // Attempt to parse as JSON for structured errors
                    const errorJson = JSON.parse(errorText);
                    errorText = errorJson.message || errorJson.error || JSON.stringify(errorJson);
                } catch (e) {
                    // Ignore parse error, use raw text
                }
                // This is where the error logged at line 96 is constructed
                throw new Error(`Failed to delete account (Status: ${response.status}): ${errorText}`); // Log line 84 reference points inside this throw path
            }

            console.log("Account deletion request successful.");
            // Use the server-side logout endpoint for proper session/cookie cleanup
            window.location.href = '/auth/logout';

        } catch (e) {
            // This catch block logs the error at line 96
            deleteError = e.message;
            console.error('Error deleting account:', e);
        } finally {
            // Ensure dialog is closed even if logout redirect fails for some reason
            showConfirmDialog = false;
        }
    }
</script>

<div class="profile-container">
    <div class="profile-header">
        {#if data.user?.id && data.user?.avatar}
            <img
                src="https://cdn.discordapp.com/avatars/{data.user.id}/{data.user.avatar}.png?size=128"
                alt="{data.user.username}'s avatar"
                class="profile-avatar"
                loading="lazy"
            />
        {:else}
            <div class="profile-avatar placeholder-avatar">
                <i class="fa-solid fa-user"></i>
            </div>
        {/if}
        <div class="profile-title">
            <h1>{data.user?.global_name || data.user?.username || 'User'}</h1>
        </div>
    </div>

    <div class="profile-content">
        <section class="profile-section">
            <h2>Profile Information</h2>
            <div class="info-grid">
                <div class="info-item">
                    <span class="label">Username</span>
                    <span class="value">{data.user?.username || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="label">User ID</span>
                    <span class="value user-id">{formattedUserId}</span>
                </div>
                {#if data.user?.global_name}
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
                {#if data.isAdmin !== undefined } <div class="status-item">
                        <span class="label">Admin Status</span>
                        <span class="value status {data.isAdmin ? 'active' : 'inactive'}">
                            <i class="fa-solid {data.isAdmin ? 'fa-shield' : 'fa-user'}"></i> {data.isAdmin ? 'Admin' : 'Not Admin'}
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
                        <span class="description">Permanently remove your account and all associated data from this application.</span>
                    </div>
                    <button
                        class="delete-btn"
                        on:click={() => showConfirmDialog = true}
                        disabled={!accessToken}
                        title={!accessToken ? "Cannot delete account: Authentication token missing." : "Delete your account"}
                    >
                        Delete Account
                    </button>
                </div>
            </div>
        </section>
        {#if deleteError}
            <div class="error-message" role="alert">
                <strong>Error:</strong> {deleteError}
            </div>
        {/if}
    </div>
</div>

{#if showConfirmDialog}
    <div class="modal-overlay" on:click={() => showConfirmDialog = false} role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <div class="modal" on:click|stopPropagation>
            <h3 id="dialog-title">Confirm Account Deletion</h3>
            <p>Are you sure you want to delete your account? This action cannot be undone.</p>
            <p>All your seeking list data within this application will be permanently deleted.</p>

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
        gap: 1rem; /* Reduced gap slightly */
        margin-bottom: 2rem;
        flex-wrap: wrap; /* Allow wrapping on smaller screens */
    }

    .profile-avatar {
        width: 80px; /* Reduced size */
        height: 80px;
        border-radius: 50%;
        border: 3px solid var(--color-bg-elevated);
        box-shadow: var(--shadow-md);
        object-fit: cover; /* Ensure image covers the area */
    }
    .placeholder-avatar {
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: var(--color-bg-secondary);
        color: var(--color-text-secondary);
        font-size: 2rem;
        width: 80px; /* Match size */
        height: 80px; /* Match size */
    }


    .profile-title {
        display: flex;
        flex-direction: column;
        gap: 0.25rem; /* Reduced gap */
    }

    h1 {
        margin: 0;
        color: var(--color-text-primary);
        font-size: 1.75rem; /* Adjusted size */
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
        gap: 1rem 1.5rem; /* Row gap, Column gap */
    }

    .info-item, .status-item {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .label {
        color: var(--color-text-secondary);
        font-size: 0.875rem; /* Slightly smaller */
        text-transform: uppercase; /* Added for distinction */
        font-weight: 500;
    }

    .value {
        color: var(--color-text-primary);
        font-weight: 500;
        word-break: break-word; /* Prevent long values overflowing */
    }

    .status {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .status .fa-solid {
         width: 1em; /* Ensure icons align well */
         text-align: center;
    }

    .status.active {
        color: #10b981; /* Use a success color variable if available */
    }

    .status.inactive {
        color: #ef4444; /* Use an error color variable if available */
    }

    @media (min-width: 640px) {
        .info-grid, .status-grid {
            grid-template-columns: repeat(2, 1fr);
        }
    }

    .danger-zone {
        border: 1px solid var(--color-error, #ef4444);
        background: var(--color-bg-error-light, #fef2f2); /* Light background for contrast */
    }

    .danger-zone h2 {
        color: var(--color-error, #b91c1c); /* Darker error color for heading */
    }

    .danger-content {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .danger-item {
        display: flex;
        flex-wrap: wrap; /* Allow wrapping */
        justify-content: space-between;
        align-items: center;
        gap: 1rem; /* Gap between text and button */
    }

    .danger-info {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        flex-grow: 1; /* Allow text block to grow */
    }

     .danger-info .label {
        color: var(--color-error, #b91c1c); /* Match heading color */
        font-size: 1rem;
        text-transform: none;
    }

    .danger-info .description {
        color: var(--color-text-secondary);
        font-size: 0.9rem;
    }

    .delete-btn {
        background-color: var(--color-error, #ef4444);
        color: white;
        border: none;
        padding: 0.6rem 1.2rem; /* Slightly larger */
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.2s ease-in-out;
        white-space: nowrap; /* Prevent button text wrapping */
    }

    .delete-btn:hover:not(:disabled) {
        background-color: #b91c1c; /* Darker shade */
    }

    .delete-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }


    .modal-overlay {
        position: fixed;
        z-index: 50; /* Ensure it's on top */
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.6); /* Darker overlay */
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .modal {
        background: var(--color-bg-elevated);
        padding: 2rem;
        border-radius: 8px;
        box-shadow: var(--shadow-lg);
        max-width: 450px; /* Slightly wider */
        width: 90%;
    }

     .modal h3 {
        margin: 0 0 1rem 0;
        color: var(--color-text-primary);
    }
     .modal p {
        margin: 0.5rem 0;
        color: var(--color-text-secondary);
    }

    .modal-buttons {
        display: flex;
        gap: 1rem;
        margin-top: 1.5rem;
        justify-content: flex-end; /* Align buttons to the right */
    }

    .cancel-btn {
        background: var(--color-bg-secondary);
        color: var(--color-text-primary);
        border: 1px solid var(--color-border);
        padding: 0.5rem 1rem;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.2s;
    }
    .cancel-btn:hover {
        background-color: var(--color-border);
    }


    .confirm-btn {
        background: var(--color-error);
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.2s;
    }
    .confirm-btn:hover {
         background-color: #b91c1c;
    }

    .error-message {
        color: var(--color-error, #b91c1c);
        background-color: var(--color-bg-error-light, #fef2f2);
        margin-top: 1rem; /* Ensure spacing if error appears */
        padding: 1rem;
        border: 1px solid var(--color-error, #ef4444);
        border-radius: 4px;
        word-break: break-word; /* Break long error messages */
    }
</style>