<script>
    import { onMount } from 'svelte';
    import {
        PUBLIC_GET_USER_TABLES_FUNCTION_URL,
        PUBLIC_GET_SEEKING_LIST_FUNCTION_URL,
        PUBLIC_DELETE_USER_ACCOUNT_FUNCTION_URL,
        PUBLIC_GET_SYSTEM_STATUS_FUNCTION_URL
    } from '$env/static/public';

    export let data; // Receives data prop (contains admin user info like data.user.username)

    // State variables
    let userTables = [];
    let expandedTable = null;
    let expandedTableData = [];
    let loading = true; // Loading state for user tables list
    let tableDataLoading = false; // Separate loading state for expanded table data
    let statusLoading = true; // Loading state for system status
    let error = null; // General error display
    let statusError = null; // Error display for system status
    let systemStatus = null;

    let accessToken = null; // Store the admin's access token

    // --- Helper function to read a specific cookie ---
    function getCookie(name) {
        if (typeof document === 'undefined') return null; // Check if running client-side
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) {
            try {
                // Decode the cookie value in case it contains special characters
                return decodeURIComponent(parts.pop().split(';').shift());
            } catch(e) {
                console.error("Error decoding cookie", e);
                return null;
            }
        }
        return null;
    }

    // --- Helper function to format date ---
    function formatLocalDate(utcTimestamp) {
        const date = new Date(utcTimestamp);
        return date.toLocaleString(undefined, { /* Formatting options */ });
    }

    // --- Helper function to wrap fetch with Authentication ---
    async function fetchWithAuth(url, options = {}) {
        if (!accessToken) {
             throw new Error("Authentication token not available.");
        }
        const headers = {
            ...options.headers,
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': options.headers?.['Content-Type'] || 'application/json',
            // Ensure x-ms-client-principal-id is NEVER sent from client
        };
         // Remove Content-Type for GET/HEAD requests if no body is intended
        if (!options.body && (!options.method || ['GET', 'HEAD'].includes(options.method.toUpperCase()))) {
            delete headers['Content-Type'];
        }

        console.log(`WorkspaceWithAuth: Calling ${options.method || 'GET'} ${url}`); // Debug log
        return fetch(url, { ...options, headers });
    }

    // --- API Call Functions ---

    async function loadUserTables() {
        loading = true;
        error = null;
        try {
            // Use fetchWithAuth (adds admin's Authorization header)
            const response = await fetchWithAuth(PUBLIC_GET_USER_TABLES_FUNCTION_URL);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to load user tables (Status: ${response.status}): ${errorText}`);
            }
            userTables = await response.json();
        } catch (e) {
            error = e.message;
            console.error("Error loading user tables:", e);
        } finally {
            loading = false;
        }
    }

    async function loadTableData(targetUserId) {
        tableDataLoading = true;
        error = null; // Clear general error when loading specific table data
        expandedTableData = [];
        try {
            // ***** IMPORTANT BACKEND NOTE *****
            // The backend function at PUBLIC_GET_SEEKING_LIST_FUNCTION_URL now receives
            // the ADMIN's identity via the APIM-injected x-ms-client-principal-id.
            // It MUST be modified to:
            // 1. Accept the 'targetUserId' (e.g., via query param as shown below).
            // 2. Verify the ADMIN is authorized to view this target user's data.
            // 3. Use the 'targetUserId' to fetch the correct data, NOT the admin's ID.
            // **********************************

            // Example: Pass targetUserId as a query parameter
            const urlWithQuery = `${PUBLIC_GET_SEEKING_LIST_FUNCTION_URL}?targetUserId=${encodeURIComponent(targetUserId)}`;

            // Use fetchWithAuth (adds admin's Authorization header)
            const response = await fetchWithAuth(urlWithQuery, {
                // REMOVE the manual x-ms-client-principal-id header
            });

            if (!response.ok) {
                 const errorText = await response.text();
                 throw new Error(`Failed to load seeking list for ${targetUserId} (Status: ${response.status}): ${errorText}`);
            }
            const responseData = await response.json();
            expandedTableData = responseData.cards || [];
        } catch (e) {
            console.error(`Error loading table data for ${targetUserId}:`, e);
            error = e.message; // Display the error
            expandedTableData = []; // Ensure it's reset on error
        } finally {
             tableDataLoading = false;
        }
    }

    async function handleDeleteAccount(targetUserId) {
        // Consider using your dialog variables 'showConfirmDialog' and 'tableToDelete'
        // for a better confirmation experience instead of the basic confirm().
        if (!confirm(`Are you sure you want to delete user account ${targetUserId}? This action cannot be undone.`)) {
             return;
        }

        error = null; // Clear error before attempt
        try {
             // ***** IMPORTANT BACKEND NOTE *****
            // The backend function at PUBLIC_DELETE_USER_ACCOUNT_FUNCTION_URL now receives
            // the ADMIN's identity via the APIM-injected x-ms-client-principal-id.
            // It MUST be modified to:
            // 1. Accept the 'targetUserId' (e.g., via request body as shown below).
            // 2. Verify the ADMIN is authorized to delete this target user.
            // 3. Use the 'targetUserId' to perform the deletion.
            // **********************************

            // Example: Pass targetUserId in the request body
            const requestBody = { targetUserIdToDelete: targetUserId };

            // Use fetchWithAuth (adds admin's Authorization header)
            const response = await fetchWithAuth(PUBLIC_DELETE_USER_ACCOUNT_FUNCTION_URL, {
                method: 'DELETE',
                // REMOVE the manual x-ms-client-principal-id header
                body: JSON.stringify(requestBody) // Send target ID in body
            });

            if (!response.ok) {
                 const errorText = await response.text();
                 throw new Error(`Failed to delete account ${targetUserId} (Status: ${response.status}): ${errorText}`);
            }

            // Refresh user tables list after successful deletion
            await loadUserTables();
            // Reset expansion state if the deleted user was expanded
            if (expandedTable === targetUserId) {
                expandedTable = null;
                expandedTableData = [];
            }
        } catch (e) {
            error = e.message;
            console.error(`Error deleting account ${targetUserId}:`, e);
        }
    }

    async function loadSystemStatus() {
        statusLoading = true;
        statusError = null;
        try {
            // Assuming system status requires admin authentication
            // Use fetchWithAuth (adds admin's Authorization header)
            const response = await fetchWithAuth(PUBLIC_GET_SYSTEM_STATUS_FUNCTION_URL);
            if (!response.ok) {
                 const errorText = await response.text();
                 throw new Error(`Failed to load system status (Status: ${response.status}): ${errorText}`);
            }
            systemStatus = await response.json();
        } catch (e) {
            statusError = e.message;
             console.error("Error loading system status:", e);
        } finally {
            statusLoading = false;
        }
    }

    // --- Lifecycle ---
    onMount(() => {
        accessToken = getCookie('discord_token'); // Read the admin's token cookie
        if (accessToken) {
            // Token found, load initial data
            loadUserTables();
            loadSystemStatus();
        } else {
            // No token found - handle appropriately
            error = "Authentication token not found. Please log in.";
            loading = false; // Ensure loading states are updated
            statusLoading = false;
            console.error(error);
            // Optional: Redirect to login
            // import { goto } from '$app/navigation';
            // goto('/login');
        }
    });
</script>

<div class="admin-container">
    <div class="admin-header">
        <h1>Admin Panel</h1>
        <p class="admin-subtitle">Logged in as {data.user.username}. With great power comes great responsibility.</p>
    </div>

    <div class="admin-content">
        <section class="admin-section">
            <h2>User Management</h2>
            {#if loading}
                <p>Loading user data...</p>
            {:else if error}
                <p class="error">{error}</p>
            {:else}
                <div class="user-tables">
                    {#each userTables as table}
                        <div class="user-table">
                            <div class="table-header">
                                <h3>{table.userId}</h3>
                                <span class="item-count">{table.itemCount} items</span>
                                <div class="table-actions">
                                    <button 
                                        class="expand-btn"
                                        on:click={() => {
                                            if (expandedTable === table.userId) {
                                                expandedTable = null;
                                                expandedTableData = null;
                                            } else {
                                                expandedTable = table.userId;
                                                loadTableData(table.userId);
                                            }
                                        }}
                                    >
                                        {expandedTable === table.userId ? 'Collapse' : 'Expand'}
                                    </button>
                                    <button 
                                        class="delete-btn"
                                        on:click={() => handleDeleteAccount(table.userId)}
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                            {#if expandedTable === table.userId}
                                <div class="table-content">
                                    {#if error}
                                        <p class="error">{error}</p>
                                    {:else if expandedTableData.length === 0}
                                        <p>No cards found in seeking list.</p>
                                    {:else}
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Name</th>
                                                    <th>Set</th>
                                                    <th>Number</th>
                                                    <th>Language</th>
                                                    <th>Finish</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {#each expandedTableData as card}
                                                    <tr>
                                                        <td data-label="Name">{card.name}</td>
                                                        <td data-label="Set">{card.set_code}</td>
                                                        <td data-label="Number">{card.collector_number}</td>
                                                        <td data-label="Language">{card.language}</td>
                                                        <td data-label="Finish">{card.finish}</td>
                                                    </tr>
                                                {/each}
                                            </tbody>
                                        </table>
                                    {/if}
                                </div>
                            {/if}
                        </div>
                    {/each}
                </div>
            {/if}
        </section>

        <section class="admin-section">
            <div class="section-header">
                <h2>System Status</h2>
                <button 
                    class="refresh-btn" 
                    on:click={loadSystemStatus}
                    disabled={statusLoading}
                >
                <i class="fa-solid fa-arrows-rotate"></i>
                </button>
            </div>
            {#if statusLoading}
                <p>Loading system status...</p>
            {:else if statusError}
                <p class="error">{statusError}</p>
            {:else if systemStatus}
                <div class="status-grid">
                    <div class="status-item">
                        <h3>State</h3>
                        <span class="status-badge {systemStatus.state.toLowerCase()}">
                            {systemStatus.state}
                        </span>
                    </div>
                    <div class="status-item">
                        <h3>Availability</h3>
                        <span class="status-badge {systemStatus.availability.toLowerCase()}">
                            {systemStatus.availability}
                        </span>
                    </div>
                    <div class="status-item">
                        <h3>Last Checked</h3>
                        <span>{formatLocalDate(systemStatus.last_checked)}</span>
                    </div>

                    {#if systemStatus.metrics}
                        <div class="status-item metrics">
                            <h3>Metrics</h3>
                            <ul>
                                {#each systemStatus.metrics as metric}
                                    <li>{metric.name}: {metric.value}</li>
                                {/each}
                            </ul>
                        </div>
                    {/if}

                    {#if systemStatus.functions}
                        <div class="status-item functions">
                            <h3>Function Status</h3>
                            <div class="function-grid">
                                {#each systemStatus.functions as func}
                                    <div class="function-status">
                                        <div class="function-header">
                                            <span class="function-name">{func.name}</span>
                                            <span class="status-badge {func.status}">
                                                {func.status}
                                            </span>
                                        </div>
                                        <div class="function-details">
                                            {#if func.response_time}
                                                <span class="response-time">
                                                    <i class="fa-solid fa-clock"></i>
                                                    {func.response_time}
                                                </span>
                                            {/if}
                                            {#if func.status_code}
                                                <span class="status-code">
                                                    <i class="fa-solid fa-signal"></i>
                                                    {func.status_code}
                                                </span>
                                            {/if}
                                            {#if func.error}
                                                <span class="error-message">
                                                    <i class="fa-solid fa-triangle-exclamation"></i>
                                                    {func.error}
                                                </span>
                                            {/if}
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        </div>
                    {/if}
                </div>
            {/if}
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
        text-align: center;
    }

    .admin-subtitle {
        color: var(--color-text-secondary);
        margin: 0.5rem 0;
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

    .user-tables {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .user-table {
        border: 1px solid var(--color-border);
        border-radius: 4px;
        padding: 1rem;
    }

    .table-header {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 1rem;
    }

    .table-header h3 {
        flex: 1 1 auto;
        margin: 0;
        min-width: 150px;
    }

    .item-count {
        flex: 0 1 auto;
        color: var(--color-text-secondary);
        font-size: 0.9rem;
        white-space: nowrap;
    }

    .table-actions {
        display: flex;
        gap: 0.5rem;
        margin-left: auto;
    }

    .expand-btn {
        background: var(--color-bg-button);
        color: var(--color-text);
    }

    .delete-btn {
        background: var(--color-error);
        color: white;
    }

    button {
        padding: 0.5rem 1rem;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        transition: opacity 0.2s;
    }

    button:hover {
        opacity: 0.8;
    }

    table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 1rem;
    }

    th, td {
        padding: 0.5rem;
        text-align: left;
        border-bottom: 1px solid var(--color-border);
    }

    th {
        background: var(--color-bg-elevated);
        font-weight: 600;
    }

    .error {
        color: var(--color-error);
    }

    .status-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
    }

    .status-item {
        padding: 1rem;
        background: var(--color-bg-elevated);
        border-radius: 4px;
        border: 1px solid var(--color-border);
        overflow-wrap: break-word;
        word-wrap: break-word;
        word-break: break-word;
    }

    .status-item ul {
        margin: 0;
        padding: 0;
        list-style: none;
    }

    .status-item li {
        overflow-wrap: break-word;
        word-wrap: break-word;
        word-break: break-word;
        font-size: 0.875rem;
    }

    .status-item h3 {
        margin: 0 0 0.5rem 0;
        font-size: 1rem;
    }

    .status-badge {
        padding: 0.25rem 0.5rem;
        border-radius: 999px;
        font-size: 0.875rem;
    }

    .status-badge.running {
        background: var(--color-success);
        color: white;
    }

    .status-badge.stopped {
        background: var(--color-error);
        color: white;
    }

    .status-badge.normal {
        background: var(--color-success);
        color: white;
    }

    .status-badge.limited {
        background: var(--color-warning);
        color: white;
    }

    .metrics {
        grid-column: 1 / -1;
    }

    .metrics ul {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 0.5rem;
        margin: 0;
        padding: 0;
        list-style: none;
    }

    .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
    }

    .refresh-btn {
        background: var(--color-bg-button);
        color: var(--color-text);
        font-size: 0.875rem;
    }

    .refresh-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .functions {
        grid-column: 1 / -1;
    }

    .function-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 1rem;
        margin-top: 0.5rem;
    }

    .function-status {
        padding: 0.75rem;
        background: var(--color-bg);
        border-radius: 4px;
        border: 1px solid var(--color-border);
    }

    .function-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
    }

    .function-name {
        font-family: monospace;
        font-size: 0.875rem;
    }

    .function-details {
        display: flex;
        gap: 1rem;
        font-size: 0.75rem;
        color: var(--color-text-secondary);
    }

    .response-time,
    .status-code,
    .error-message {
        display: flex;
        align-items: center;
        gap: 0.25rem;
    }

    .error-message {
        color: var(--color-error);
    }

    .status-badge.error {
        background: var(--color-error);
        color: white;
    }

    .status-badge.degraded {
        background: var(--color-warning);
        color: white;
    }

    .status-badge {
        padding: 0.25rem 0.5rem;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 500;
    }

    @media (max-width: 480px) {
        .table-header {
            flex-direction: column;
            align-items: flex-start;
        }

        .table-actions {
            width: 100%;
            justify-content: flex-end;
        }

        .user-table {
            padding: 0.75rem;
        }

        table {
            display: block;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
        }

        td, th {
            min-width: 120px;
            white-space: nowrap;
        }
    }

    .table-content {
        margin-top: 1rem;
    }

    @media (max-width: 768px) {
        .table-content table {
            display: block;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
        }

        .table-content table tbody tr {
            display: grid;
            grid-template-columns: 1fr;
            padding: 0.5rem;
            border: 1px solid var(--color-border);
            margin-bottom: 0.5rem;
            border-radius: 4px;
        }

        .table-content table tbody td {
            display: grid;
            grid-template-columns: minmax(100px, auto) 1fr;
            gap: 0.5rem;
            padding: 0.25rem 0.5rem;
            border: none;
        }

        .table-content table tbody td::before {
            content: attr(data-label);
            font-weight: 600;
            color: var(--color-text-secondary);
        }

        .table-content table thead {
            display: none;
        }
    }

    @media (max-width: 480px) {
        .table-content table tbody td {
            font-size: 0.875rem;
        }
    }
</style>