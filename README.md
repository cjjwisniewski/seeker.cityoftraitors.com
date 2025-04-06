# Seeker Site

A web application built with SvelteKit for searching and managing card information, likely related to trading card games. It features user authentication via Discord and interacts with various backend Azure Functions.

## Features

*   User Authentication (Login via Discord, Profile Management)
*   Card Search Functionality
*   Display Card Lists (`CardList.svelte`)
*   "Seeking" Feature (Add/View/Delete items from a seeking list)
*   Language detection for cards (via Scryfall API)
*   Role-based access control (inferred from `roleCache.js`)
*   Admin Section (`/admin`)
*   User Account Deletion

## Tech Stack

*   **Framework:** SvelteKit
*   **Language:** TypeScript, JavaScript
*   **Styling:** CSS (potentially with Prettier for formatting)
*   **API Interaction:** Fetch API, Scryfall API, Azure Functions
*   **Authentication:** Discord OAuth 2.0
*   **Linting:** ESLint
*   **Package Manager:** npm
*   **Deployment:** Azure Blob Storage & Azure CDN via GitHub Actions

## Getting Started

### Prerequisites

*   Node.js (version 20 recommended, based on `deploy.yml`) and npm installed.
*   Access to the required Azure Functions and Discord application credentials.

### Installation

1.  Clone the repository:
    ```bash
    git clone <repository-url>
    cd seeker_site
    ```
2.  Install dependencies:
    ```bash
    npm ci
    ```

### Environment Variables

This project relies heavily on environment variables passed during the build process (see `.github/workflows/deploy.yml`). For local development, create a `.env` file in the root directory and populate it with the necessary `VITE_` prefixed variables.

Essential variables for local development likely include:

```env
# Publicly accessible variables (prefixed with VITE_)
VITE_PUBLIC_VERSION=local-dev
VITE_PUBLIC_DISCORD_CLIENT_ID=your_discord_client_id
VITE_PUBLIC_DISCORD_REDIRECT_URI=http://localhost:5173/callback # Or your local dev callback URL
VITE_PUBLIC_USER_TABLE_FUNCTION_URL=your_azure_function_url
VITE_PUBLIC_ADD_TO_SEEKING_FUNCTION_URL=your_azure_function_url
VITE_PUBLIC_GET_SEEKING_LIST_FUNCTION_URL=your_azure_function_url
VITE_PUBLIC_DELETE_FROM_SEEKING_FUNCTION_URL=your_azure_function_url
VITE_PUBLIC_DELETE_USER_ACCOUNT_FUNCTION_URL=your_azure_function_url
VITE_PUBLIC_GET_USER_TABLES_FUNCTION_URL=your_azure_function_url
VITE_PUBLIC_GET_SYSTEM_STATUS_FUNCTION_URL=your_azure_function_url
VITE_PUBLIC_AUTH_ENDPOINT=your_azure_function_url # Likely handles the start of the auth flow
VITE_PUBLIC_LOGIN_ENDPOINT=your_azure_function_url # Might be the same as AUTH_ENDPOINT
VITE_PUBLIC_LOGOUT_ENDPOINT=your_azure_function_url # Endpoint to call for logout
VITE_LOGIN_URL=your_login_initiation_url # URL the user is redirected to for login (likely Discord)
VITE_USER_INFO_URL=your_user_info_api_endpoint # Endpoint to fetch user details after login

# Add any other VITE_ prefixed variables needed by your specific setup
```

*Note: Variables prefixed with `VITE_` are exposed to the client-side code. Non-prefixed variables are typically used server-side or during the build process.*

### Running the Development Server

```bash
npm run dev
```

This will start the development server, usually available at `http://localhost:5173`. Ensure your Discord application is configured with the correct redirect URI for local development.

### Building for Production

```bash
npm run build
```

This command compiles the application into the `build` directory, ready for deployment. The build process requires specific environment variables to be set, as shown in the `deploy.yml` workflow.

## Deployment

Deployment is automated via the GitHub Actions workflow defined in `.github/workflows/deploy.yml`. Pushing to the `main` branch triggers the following steps:

1.  Checkout code.
2.  Set up Node.js.
3.  Install dependencies (`npm ci`).
4.  Build the SvelteKit application (`npm run build`), injecting secrets and variables.
5.  Log in to Azure.
6.  Clean the `$web` container in the specified Azure Storage Account.
7.  Upload the contents of the `build` directory to the `$web` container.
8.  Purge the Azure CDN endpoint to ensure users get the latest version.
9.  Log out of Azure.

## Linting and Formatting

*   **Linting:** Run `npm run lint` to check for code style issues using ESLint (`eslint.config.js`).
*   **Formatting:** Run `npm run format` to format the code using Prettier (`.prettierrc`, `.prettierignore`).

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.
