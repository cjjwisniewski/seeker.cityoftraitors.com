# Seeker UI Guidelines

## Git Commit & Push Policy
- **Always commit and push changes** to the remote repository (`git push`) after completing a logical change.
- **Always use the Conventional Commits format** (e.g., `feat(ui): ...`, `fix(ui): ...`, `perf(search): ...`, `chore: ...`).

## UI Style Guide
- Follow [`STYLE_GUIDE.md`](./STYLE_GUIDE.md) for all frontend styling, CSS theme tokens, layout/responsive rules, semantic status colors, and Svelte/security conventions.

## Testing (CI-Only Execution)
- **DO NOT run unit tests locally (`vitest` / `npm test` / `pytest`)**.
- Automated frontend tests (`vitest`) execute **exclusively inside GitHub Actions CI (`GITHUB_ACTIONS=true`)**. Agents may create and edit test files and CI workflows, but must **NEVER execute test runners locally**.
