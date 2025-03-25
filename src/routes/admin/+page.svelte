<script>
    import { onMount } from 'svelte';
    import { 
        PUBLIC_GET_USER_TABLES_FUNCTION_URL,
        PUBLIC_GET_SEEKING_LIST_FUNCTION_URL,
        PUBLIC_DELETE_USER_ACCOUNT_FUNCTION_URL,
        PUBLIC_GET_SYSTEM_STATUS_FUNCTION_URL
    } from '$env/static/public';
    
    export let data; // Add this line to receive the data prop

    let userTables = [];
    let expandedTable = null;
    let expandedTableData = []; // Initialize as empty array
    let showConfirmDialog = false;
    let tableToDelete = null;
    let loading = true;
    let error = null;
    let systemStatus = null;
    let statusLoading = true;
    let statusError = null;

    async function loadUserTables() {
        try {
            const response = await fetch(PUBLIC_GET_USER_TABLES_FUNCTION_URL);
            if (!response.ok) throw new Error('Failed to load user tables');
            userTables = await response.json();
        } catch (e) {
            error = e.message;
        } finally {
            loading = false;
        }
    }

    async function loadTableData(userId) {
        try {
            expandedTableData = []; // Reset to empty array while loading
            const response = await fetch(PUBLIC_GET_SEEKING_LIST_FUNCTION_URL, {
                headers: {
                    'x-ms-client-principal-id': userId
                }
            });
            
            if (!response.ok) throw new Error('Failed to load seeking list');
            const data = await response.json();
            expandedTableData = data.cards || []; // Extract the cards array from the response
        } catch (e) {
            console.error('Error loading table data:', e);
            error = e.message;
            expandedTableData = []; // Reset on error
        }
    }

    async function handleDeleteAccount(userId) {
        if (confirm('Are you sure you want to delete this user account? This action cannot be undone.')) {
            try {
                const response = await fetch(PUBLIC_DELETE_USER_ACCOUNT_FUNCTION_URL, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-ms-client-principal-id': userId
                    }
                });

                if (!response.ok) throw new Error('Failed to delete account');
                
                // Refresh user tables list
                await loadUserTables();
                expandedTable = null;
                expandedTableData = null;
            } catch (e) {
                error = e.message;
            }
        }
    }

    async function loadSystemStatus() {
        try {
            const response = await fetch(PUBLIC_GET_SYSTEM_STATUS_FUNCTION_URL);
            if (!response.ok) throw new Error('Failed to load system status');
            systemStatus = await response.json();
        } catch (e) {
            statusError = e.message;
        } finally {
            statusLoading = false;
        }
    }

    onMount(() => {
        loadUserTables();
        loadSystemStatus();
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
                        <span>{new Date(systemStatus.last_checked).toLocaleString()}</span>
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