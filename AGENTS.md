# Seeker UI Guidelines

## Git Commit & Push Policy
- **Always commit and push changes** to the remote repository (`git push`) after completing a logical change.
- **Always use the Conventional Commits format** (e.g., `feat(ui): ...`, `fix(ui): ...`, `perf(search): ...`, `chore: ...`).

## UI Style Guide
- Follow [`STYLE_GUIDE.md`](./STYLE_GUIDE.md) for all frontend styling, CSS theme tokens, layout/responsive rules, semantic status colors, and Svelte/security conventions.

## Testing (CI-Only Execution)
- **DO NOT run unit tests locally (`vitest` / `npm test` / `pytest`)**.
- Automated frontend tests (`vitest`) execute **exclusively inside GitHub Actions CI (`GITHUB_ACTIONS=true`)**. Agents may create and edit test files and CI workflows, but must **NEVER execute test runners locally**.

## Privacy & GDPR Compliance
- **Self-Host Fonts, Icons & Static Assets**: Do not load fonts, icons, stylesheets, or scripts from third-party CDNs (e.g., `fonts.googleapis.com`, `fonts.gstatic.com`, `cdnjs.cloudflare.com`, `unpkg.com`, `jsdelivr.net`). Keep `Montserrat` (`@fontsource-variable/montserrat`) and FontAwesome (`@fortawesome/fontawesome-free`) bundled locally so visitor IP addresses are not leaked to third-party asset CDNs.
- **Minimize Third-Party Requests**: Do not add third-party analytics, ad trackers, or non-essential cookies. Only allow strictly necessary functional external origins (Scryfall card imagery/API, Discord avatars/OAuth, FX rates) as explicitly permitted in `seeker_infra/dns/main.tf`.
- **Keep CSP Tight**: Keep `style-src` and `font-src` restricted to `'self'` (plus `'unsafe-inline'` / `data:` where required) in `seeker_infra/dns/main.tf`.
