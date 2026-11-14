# Seeker UI Guidelines

## Git Commit & Push Policy
- **Always commit and push changes** to the remote repository (`git push`) after completing a logical change.
- **Always use the Conventional Commits format** (e.g., `feat(ui): ...`, `fix(ui): ...`, `perf(search): ...`, `chore: ...`).

## UI Style Guide
- Follow [`STYLE_GUIDE.md`](./STYLE_GUIDE.md) for all frontend styling, CSS theme tokens, layout/responsive rules, semantic status colors, and Svelte/security conventions.

## Testing
- **DO NOT run local unit tests (pytest)**. The local tests on the backend are not supported in this environment and must not be run.
