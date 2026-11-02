# Seeker - Frontend Web Application

`seeker.cityoftraitors.com` is the modern, user-facing web dashboard for **Seeker**, a comprehensive Magic: The Gathering (MTG) trading card stock tracking and price alert platform. Built as a Single Page Application (SPA) using SvelteKit, TypeScript, and a custom glassmorphic CSS design system, it provides collectors and players with real-time card discovery, customizable marketplace monitors, and automated alerts.

---

## 🧭 The Seeker Ecosystem

This repository houses the frontend client application. The complete Seeker platform is divided across several sister projects:

*   **[seeker_functions](https://github.com/cjjwisniewski/seeker_functions)**: The Azure Functions Python backend. Handles Discord OAuth2 authentication, signs and verifies custom JWTs, manages user account settings, and runs background timers/queues to monitor card availability across CardTrader, eBay, and Mana Pool.
*   **[seeker_checkTCGPlayerStock](https://github.com/cjjwisniewski/seeker_checkTCGPlayerStock)**: A queue-driven containerized Python worker using Selenium and `undetected-chromedriver`. It processes TCGPlayer check requests from Azure Storage Queues without triggering bot detection, updating stock records and dispatching alerts.
*   **[seeker_infra](https://github.com/cjjwisniewski/seeker_infra)**: The Terraform infrastructure configurations. Manages the Azure API Management (APIM) gateway proxy, Function App IP firewalls, storage tables, queue configurations, and DNS settings.
*   **[seeker.cityoftraitors.com](https://github.com/cjjwisniewski/seeker.cityoftraitors.com)**: The SvelteKit frontend client application (this repository).

---

## ✨ Features & Highlights

### 🔍 Card Discovery & Scryfall Integration
*   **Instant Autocomplete & Search**: Scryfall-backed search engine with debounced typing, keyboard navigation (Arrow keys, Enter, Escape), and fallback resolution for exact and fuzzy card queries.
*   **Multi-Face & Transform Support**: Full support for double-faced cards (Transform, MDFC), split cards, and adventures, featuring an interactive face-flipping button (`Front` / `Transform`) and multi-face oracle text parsing.
*   **Edition & Printing Selector**: Displays card set and collector number with lazy-loading for sets and printings to maximize performance.
*   **Multilingual Support**: Automatically detects available foreign language prints for the active card, respects the user's preferred language setting, and fetches localized images, printed names, and rules text.
*   **Finish Selector**: Choose between Nonfoil, Foil, and Etched finishes, automatically defaulting to user preferences.

### 🔮 Official MTG Symbology
*   **Vector Symbology**: Parses mana costs and rules text using official Scryfall SVG symbology.
*   **Inline Rules Rendering**: Dynamically replaces mana symbols (`{W}`, `{U}`, `{B}`, `{R}`, `{G}`, `{C}`, hybrid, Phyrexian) and action symbols (`{T}`, `{Q}`, `{E}`, `{PW}`) with crisp vector icons inside oracle text.

### 📋 Sought Cards Workspace
*   **Unified Glassmorphic Toolbar**: Real-time card search, sorting controls (Name, Date Added, Stock Status, Price), and instant filter pills (All, In Stock, Out of Stock, Tracking Enabled/Disabled).
*   **Tracking Limit Indicator**: Live capacity pill showing currently tracked cards against the user's membership tier limit (e.g., `12 / 25 Cards`).
*   **Multi-Card Selection & Bulk Actions**: Select individual cards, use `Shift + Click` for range selection, or `Ctrl/Cmd + Click` for toggling items. Floating action bar provides one-click bulk removal and notification toggles.
*   **Per-Card Management**: Set maximum target price caps, toggle individual marketplace tracking, view current in-stock prices, and jump straight to marketplace listings via direct links.

### 👤 Account & Preferences
*   **Discord OAuth2 Authentication**: Secure Discord sign-in with cached user profile details and automatic JWT session renewal.
*   **Monospace User ID Pill**: Formats Discord User IDs into 4-character visual segments inside a single styled pill with one-click clipboard copying.
*   **Tier Status**: Visual membership badges highlighting user tiers (Basic, Premium, Legacy).
*   **Granular Notification Toggles**: Enable or disable alerts per marketplace:
    *   **CardTrader** (Standard user tier)
    *   **TCGPlayer** (Premium/Legacy tier)
    *   **eBay** (Premium/Legacy tier)
    *   **Mana Pool** (Premium/Legacy tier)
*   **Alert Configuration**: Customize percentage thresholds for price drop alerts and default card finishes/languages.
*   **Account Deletion**: Self-service account removal with safety confirmation modal.

### 🛡️ Admin Operations
*   **System & Queue Health**: Live health monitoring for Azure Storage queues, tracking message counts and processing rates.
*   **User Management Table**: Searchable directory of all users with membership tier breakdowns, tracking counts, and marketplace activity.
*   **CSV Data Export**: One-click complete CSV export of user and tracking data for reporting.
*   **Announcement Banner Manager**: Create, preview, update, and clear system-wide notification banners across the site in real time.

---

## 🛠️ Tech Stack

*   **Framework**: [SvelteKit](https://kit.svelte.dev/) (SPA mode with `@sveltejs/adapter-static`)
*   **Language**: [TypeScript](https://www.typescriptlang.org/) / JavaScript
*   **Styling**: Custom Vanilla CSS with CSS Variables design system (Elevated Glassmorphism, Dark Mode)
*   **APIs & Data**:
    *   [Scryfall API](https://scryfall.com/docs/api): Card search, prints, foreign language editions, and SVG symbology.
    *   Azure APIM Gateway: Secure backend proxy for Seeker Python functions and OAuth endpoints.
*   **Icons**: [FontAwesome 6 Free](https://fontawesome.com/) & Scryfall SVG Symbology
*   **Hosting**: Azure Blob Storage static website hosting & Azure CDN

---

## 📁 Project Structure

```
src/
├── app.html                  # HTML entry template with meta tags & FontAwesome
├── lib/
│   ├── components/           # Reusable UI components
│   │   ├── Banner.svelte     # Dynamic announcement banner
│   │   ├── CardList.svelte   # Card search results list & interactive actions
│   │   ├── CardSearchForm.svelte # Search input with autocomplete & print resolution
│   │   ├── CardText.svelte   # Scryfall vector symbol renderer for oracle text
│   │   ├── Footer.svelte     # Application footer with build version
│   │   ├── Header.svelte     # Glassmorphic top navigation bar
│   │   ├── NotificationModal.svelte # Accessible notification dialog
│   │   └── UserStatus.svelte # Auth state and login/logout button
│   ├── stores/
│   │   └── auth.ts           # Authentication store, token lifecycle, and session cache
│   └── utils/
│       ├── api.ts            # Fetch wrapper injecting JWT Bearer tokens
│       ├── cardSymbols.ts    # Scryfall mana & action symbol parser and SVG registry
│       └── languageUtils.js  # Card language mapping and multilingual print discovery
└── routes/
    ├── +layout.svelte        # Root layout with banner, header, footer, and theme shell
    ├── +page.svelte          # Home / Card Search page
    ├── about/                # Project overview and about page
    ├── account/              # User profile, notification settings, and preferences
    ├── admin/                # Admin operations, queue health, user table, banner controls
    ├── callback/             # Discord OAuth2 callback handler & token exchange
    ├── login/                # Sign-in landing route
    └── seeking/              # Sought Cards workspace (search, filters, bulk actions)
```

---

## 🚀 Getting Started

### 📋 Prerequisites

*   **Node.js**: v20 or higher recommended
*   **npm**: v9 or higher

### ⚙️ Installation

1. Clone the repository and navigate into the project directory:
   ```bash
   git clone https://github.com/cjjwisniewski/seeker.cityoftraitors.com.git
   cd seeker.cityoftraitors.com
   ```

2. Install dependencies:
   ```bash
   npm ci
   ```

### 🔑 Environment Variables

Create a `.env` file in the project root. Variables prefixed with `PUBLIC_` or `VITE_` are exposed to the client application:

```env
# Application Version
PUBLIC_VERSION=1.0.0-dev

# Discord OAuth2
PUBLIC_DISCORD_CLIENT_ID=your_discord_client_id
PUBLIC_DISCORD_REDIRECT_URI=http://localhost:5173/callback
VITE_LOGIN_URL=https://seeker.azure-api.net/api/login
VITE_USER_INFO_URL=https://seeker.azure-api.net/api/userinfo

# Backend Azure APIM / Function Endpoints
PUBLIC_GET_BANNER_FUNCTION_URL=https://seeker.azure-api.net/api/getBanner
PUBLIC_UPDATE_BANNER_FUNCTION_URL=https://seeker.azure-api.net/api/updateBanner
PUBLIC_UPDATE_USER_SETTING_FUNCTION_URL=https://seeker.azure-api.net/api/updateUserSetting
PUBLIC_ADD_TO_SEEKING_FUNCTION_URL=https://seeker.azure-api.net/api/addToSeeking
PUBLIC_GET_SEEKING_LIST_FUNCTION_URL=https://seeker.azure-api.net/api/getSeekingList
PUBLIC_UPDATE_SEEKING_CARD_FUNCTION_URL=https://seeker.azure-api.net/api/updateSeekingCard
PUBLIC_DELETE_FROM_SEEKING_FUNCTION_URL=https://seeker.azure-api.net/api/deleteFromSeeking
PUBLIC_DELETE_USER_ACCOUNT_FUNCTION_URL=https://seeker.azure-api.net/api/deleteUserAccount
PUBLIC_GET_USER_TABLES_FUNCTION_URL=https://seeker.azure-api.net/api/getUserTables
PUBLIC_GET_SYSTEM_STATUS_FUNCTION_URL=https://seeker.azure-api.net/api/getSystemStatus
```

> [!NOTE]
> Ensure your Discord Application Developer Portal has `http://localhost:5173/callback` listed under **Redirects** for local development authentication.

### 💻 Local Development Server

Start the development server with live reload:
```bash
npm run dev
```
The app will be available at `http://localhost:5173`.

### 🔍 Code Quality & Type Checking

Validate TypeScript and Svelte components:
```bash
# SvelteKit sync and type-check
npm run check

# Code style and ESLint check
npm run lint
```

---

## 📦 Build & Deployment

### 🏗️ Compiling the Static Build

Compile the SPA into static production assets:
```bash
npm run build
```
This generates the pre-rendered static website inside the `./build` directory.

### 🌐 Continuous Deployment (GitHub Actions)

Deployments are automated via GitHub Actions in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) on pushes to `main`:

1.  **Version Increment**: Bumps the repository's patch version automatically.
2.  **Asset Compilation**: Runs `npm run build` with production environment keys.
3.  **Storage Sync**: Authenticates to Azure and deploys compiled static files into the `$web` Azure Storage container.
4.  **CDN Purge**: Purges Azure CDN edge endpoints to instantly propagate changes worldwide.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
