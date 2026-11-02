# Seeker - Frontend Web Application

`seeker.cityoftraitors.com` is the user-facing frontend dashboard for **Seeker**, a comprehensive trading card stock tracking and notification platform. It is built as a Single Page Application (SPA) using SvelteKit, styled with custom Vanilla CSS, and compiled using `@sveltejs/adapter-static` for static hosting.

---

## 🧭 The Seeker Ecosystem

This repository acts as the frontend client. The complete Seeker platform is divided across several sister projects located in the `~/seeker*` directories:

*   **[seeker_functions](https://github.com/cjjwisniewski/seeker_functions)**: The Azure Functions Python backend. It handles Discord OAuth2 authentication, signs and verifies custom JWTs, performs user settings management, and runs background timers/queues to monitor card availability (CardTrader, eBay, Mana Pool).
*   **[seeker_checkTCGPlayerStock](https://github.com/cjjwisniewski/seeker_checkTCGPlayerStock)**: A queue-driven containerized Python scraping worker using Selenium and `undetected-chromedriver`. It processes TCGPlayer check requests from Azure Storage Queues without triggering bot detection, updating stocks and dispatching new alerts.
*   **[seeker_infra](https://github.com/cjjwisniewski/seeker_infra)**: The Terraform infrastructure configurations. This defines the security architecture, including the Azure API Management (APIM) gateway proxy, Function App IP firewalls, storage tables, queue configurations, and DNS settings.

---

## ✨ Features

*   **Discord OAuth2 Authentication**: Sign-in via Discord, storing authentication tokens and caching user profile info for instant loading.
*   **Seeking List Manager**: Add, view, update, and remove cards you are looking to buy or collect.
*   **Multi-Marketplace Integration**: Custom tracking toggles for major marketplaces:
    *   **CardTrader** (standard user tier)
    *   **TCGPlayer** (Premium/Legacy tier)
    *   **eBay** (Premium/Legacy tier)
    *   **Mana Pool** (Premium/Legacy tier)
*   **Granular Settings & Alerts**:
    *   Toggle immediate Direct Message alerts for stock findings or price drops.
    *   Configure percentage-based price drop alert thresholds.
    *   Set default preferred card language (detects via Scryfall API) and finish (foil vs. non-foil).
*   **Dynamic Notification Banner**: Shows system announcements or alerts fetched dynamically from the backend function.
*   **Role-Based Access Control (RBAC)**: Custom layout access and features tailored for user membership tiers (Basic, Premium, Legacy) and Admin dashboard roles.
*   **Dark Mode & Responsive UI**: Curated theme system with smooth transitions and full accessibility adjustments (Escape-key modal closures, focus rings, etc.).

---

## 🛠️ Tech Stack

*   **Framework**: SvelteKit
*   **Language**: TypeScript / JavaScript
*   **Styling**: Vanilla CSS (CSS Variables theme design system)
*   **Marketplace APIs**: Direct Scryfall integration for card language lookup; APIM proxy routes for CardTrader and other backend resources.
*   **Hosting/CDN**: Azure Blob Storage static website hosting & Azure CDN.

---

## 🚀 Getting Started

### 📋 Prerequisites

*   Node.js (v20 recommended)
*   npm

### ⚙️ Installation

1.  Navigate to the project directory:
    ```bash
    cd ~/seeker.cityoftraitors.com
    ```
2.  Install dependencies:
    ```bash
    npm ci
    ```

### 🔑 Environment Variables

To run the client locally, configure a `.env` file in the root directory. Variables prefixed with `VITE_` are automatically exposed to SvelteKit at build/dev runtime.

```env
VITE_PUBLIC_VERSION=local-dev
VITE_PUBLIC_DISCORD_CLIENT_ID=your_discord_client_id
VITE_PUBLIC_DISCORD_REDIRECT_URI=http://localhost:5173/callback

# Backend Azure APIM / Function Endpoints
VITE_LOGIN_URL=https://seeker.azure-api.net/api/login
VITE_USER_INFO_URL=https://seeker.azure-api.net/api/userinfo
PUBLIC_GET_BANNER_FUNCTION_URL=https://seeker.azure-api.net/api/getBanner
PUBLIC_UPDATE_USER_SETTING_FUNCTION_URL=https://seeker.azure-api.net/api/updateUserSetting
PUBLIC_ADD_TO_SEEKING_FUNCTION_URL=https://seeker.azure-api.net/api/addToSeeking
PUBLIC_GET_SEEKING_LIST_FUNCTION_URL=https://seeker.azure-api.net/api/getSeekingList
PUBLIC_DELETE_FROM_SEEKING_FUNCTION_URL=https://seeker.azure-api.net/api/deleteFromSeeking
PUBLIC_DELETE_USER_ACCOUNT_FUNCTION_URL=https://seeker.azure-api.net/api/deleteUserAccount
PUBLIC_UPDATE_SEEKING_CARD_FUNCTION_URL=https://seeker.azure-api.net/api/updateSeekingCard
PUBLIC_GET_SYSTEM_STATUS_FUNCTION_URL=https://seeker.azure-api.net/api/getSystemStatus
```

### 💻 Local Development

Run the SvelteKit development server:
```bash
npm run dev
```
The application will start at `http://localhost:5173`. Make sure your Discord developer settings contain this Redirect URI for local callbacks.

### 🔍 Linting and Code Quality

Validate TypeScript compilation, formatting, and linting rules before committing:
```bash
# Type-check and sync Svelte files
npm run check

# Check formatting and run ESLint
npm run lint
```

---

## 📦 Build & Deployment

The project is built as a static site:
```bash
npm run build
```
This compiles the SPA into the `./build` directory.

### 🌐 Azure Deployment Workflow
Deployment is automated via GitHub Actions in [.github/workflows/deploy.yml](file:///home/cwisniewski/seeker.cityoftraitors.com/.github/workflows/deploy.yml). When a push is made to the `main` branch:
1.  **Version Increment**: Increments the patch version dynamically in the repository's action variables.
2.  **Asset Compilation**: Compiles the project using `npm run build` injecting necessary production environment keys.
3.  **Clean Batch**: Authenticates with Azure and clears the existing static contents from the `$web` storage container.
4.  **Upload**: Uploads the static bundle from `./build` to the `$web` Azure Storage account container.
5.  **CDN Purge**: Purges the Azure CDN endpoints to deliver the latest release to users.
