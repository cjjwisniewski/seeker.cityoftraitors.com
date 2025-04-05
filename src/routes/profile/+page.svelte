<script>
    import { auth } from '$lib/stores/auth'; // Import the auth store
    import { fetchWithAuth } from '$lib/utils/api'; // Import fetch helper
    import { PUBLIC_DELETE_USER_ACCOUNT_FUNCTION_URL } from '$env/static/public';
    import { browser } from '$app/environment'; // To ensure code runs client-side

    // Define Role IDs (ensure these match your Discord setup)
    const REQUIRED_ROLE_ID = '1352632428342280212'; // Seeker Role
    const ADMIN_ROLE_ID = '1352632325640294411'; // Admin Role

    // State variables
    let showConfirmDialog = false;
    let deleteError = null;

    // Reactive declarations based on the auth store
    // These will run client-side due to ssr=false in layout
    $: user = $auth.user; // Directly access store value
    $: token = $auth.token; // Directly access store value
    $: isLoading = $auth.isLoading; // Directly access store value

    // Format the user ID with spaces for readability
    // Use $auth.user directly and add optional chaining for safety during initial render cycles
    $: formattedUserId = $auth.user?.id?.match(/.{1,4}/g)?.join(' ') || $auth.user?.id || 'N/A';

    // Derive status from user roles (assuming roles are fetched by auth store)
    // Use $auth.user directly here too for consistency
    // Note: 'guildMember' might be implicitly true if roles are present.
    // Adjust logic if your /api/userinfo provides explicit guild membership.
    $: guildMember = !!$auth.user?.roles; // Assumes roles array exists only if they are a member
    $: hasRole = $auth.user?.roles?.includes(REQUIRED_ROLE_ID) ?? false;
    $: isAdmin = $auth.user?.roles?.includes(ADMIN_ROLE_ID) ?? false;

    // --- Delete Account Logic ---
    async function handleDeleteAccount() {
        deleteError = null; // Clear previous errors

        if (!token) {
            deleteError = "Action failed: Authentication token is missing.";
            console.error("Delete attempt failed: token is null.");
            showConfirmDialog = false; // Close dialog
            return;
        }

        const userIdToDelete = user?.id;
        if (!userIdToDelete) {
             deleteError = "Action failed: User ID is missing.";
             console.error("Delete attempt failed: user ID is null.");
             showConfirmDialog = false; // Close dialog
             return;
        }

        console.log(`Attempting to delete account for user ID: ${userIdToDelete}`);

        try {
            // Use fetchWithAuth - it adds the Authorization header automatically
            const response = await fetchWithAuth(PUBLIC_DELETE_USER_ACCOUNT_FUNCTION_URL, {
                method: 'DELETE',
                headers: {
                    // Add Content-Type if required by your Azure Function
                    'Content-Type': 'application/json',
                },
                // Add body if required by your Azure Function
                 body: JSON.stringify({}) // Sending empty JSON object as before
            });

            // fetchWithAuth returns undefined if it redirects (e.g., on 401)
            if (!response) {
                // Error/redirect is handled by fetchWithAuth (logged to console, triggers login)
                // We might want to set a local error state here too.
                deleteError = "Authentication failed. Please log in again.";
                console.error("Delete account fetch failed or was redirected by fetchWithAuth.");
                showConfirmDialog = false;
                return; // Stop execution
            }

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
            // Call the auth store's logout method for proper cleanup and redirect
            await auth.logout();

        } catch (e) {
            // This catch block handles errors from fetchWithAuth or response processing
            deleteError = e.message;
            console.error('Error deleting account:', e);
        } finally {
            // Ensure dialog is closed even if logout redirect fails for some reason
            showConfirmDialog = false;
        }
    }
    // --- Keyboard handler for modal ---
    function handleKeydown(event) {
        if (event.key === 'Escape') {
            showConfirmDialog = false;
        }
    }
</script>

<!-- Listen for keydown events when the modal is shown -->
<svelte:window on:keydown={showConfirmDialog ? handleKeydown : null}/>

{#if isLoading}
    <div class="loading-container">
        <p>Loading profile...</p>
        <!-- Add a spinner or other loading indicator here -->
    </div>
{:else if !user}
     <div class="error-container">
        <p>Could not load user profile. You may need to log in again.</p>
         <button on:click={() => auth.login()}>Login</button>
     </div>
{:else}
<div class="profile-container">
    <div class="profile-header">
        {#if user.id && user.avatar}
            <img
                src="https://cdn.discordapp.com/avatars/{user.id}/{user.avatar}.png?size=128"
                alt="{user.username}'s avatar"
                class="profile-avatar"
                loading="lazy"
            />
        {:else}
            <div class="profile-avatar placeholder-avatar">
                <i class="fa-solid fa-user"></i>
            </div>
        {/if}
        <div class="profile-title">
            <h1>{user.global_name || user.username || 'User'}</h1>
        </div>
    </div>

    <div class="profile-content">
        <section class="profile-section">
            <h2>Profile Information</h2>
            <div class="info-grid">
                <div class="info-item">
                    <span class="label">Username</span>
                    <span class="value">{user.username || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="label">User ID</span>
                    <span class="value user-id">{formattedUserId}</span>
                </div>
                {#if user.global_name}
                    <div class="info-item">
                        <span class="label">Display Name</span>
                        <span class="value">{user.global_name}</span>
                    </div>
                {/if}
            </div>
        </section>

        <section class="profile-section">
            <h2>City of Traitors Status</h2>
            <div class="status-grid">
                 <!-- Display derived status -->
                <div class="status-item">
                    <span class="label">Server Member</span>
                     <span class="value status {guildMember ? 'active' : 'inactive'}">
                        <i class="fa-solid {guildMember ? 'fa-check' : 'fa-xmark'}"></i>
                        {guildMember ? 'Assumed Member (has roles)' : 'Not Detected'}
                    </span>
                </div>
                <div class="status-item">
                    <span class="label">Seeker Role</span>
                    <span class="value status {hasRole ? 'active' : 'inactive'}">
                        <i class="fa-solid {hasRole ? 'fa-check' : 'fa-xmark'}"></i>
                        {hasRole ? 'Has Role' : 'No Role'}
                    </span>
                </div>
                 <div class="status-item">
                        <span class="label">Admin Status</span>
                        <span class="value status {isAdmin ? 'active' : 'inactive'}">
                            <i class="fa-solid {isAdmin ? 'fa-shield' : 'fa-user'}"></i> {isAdmin ? 'Admin' : 'Not Admin'}
                        </span>
                    </div>
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
                        disabled={!token || !user}
                        title={!token || !user ? "Cannot delete account: Authentication missing." : "Delete your account"}
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
    <!-- Added keydown handler to the overlay -->
    <div
        class="modal-overlay"
        on:click={() => showConfirmDialog = false}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
    >
        <div class="modal" on:click|stopPropagation role="document"> <!-- Added role="document" to inner modal -->
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
{/if} <!-- Closing the modal #if block -->
{/if} <!-- Closing the main #if isLoading / !user / else block -->

<style>
     .loading-container, .error-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 200px; /* Ensure it takes some space */
        text-align: center;
        padding: 2rem;
    }
     .error-container button {
        margin-top: 1rem;
        padding: 0.5rem 1rem;
    }

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
