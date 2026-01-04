# Repository Guidelines

## Project Structure & Module Organization
- `index.html` is the entry point and wires scripts/styles.
- Core logic lives in `app.js`, with helpers in `helpers.js`, DOM caching in `dom.js`, XML generation in `xml.js`, validation in `validation.js`, and summary rendering in `summary.js`.
- Theme and layout styling live in `styles.css`.
- Preset data lives under `data/` (`app-presets.json`, `pin-presets.json`).
- Importable example configs are in `configs/` (`*.aaxb.json`).
- Assets are in `assets/` (logo and mascot).

## Build, Test, and Development Commands
This is a static app with no build step.
- Run locally (required for `fetch()` presets):
  - `python -m http.server` then open `http://localhost:8000`.

## Coding Style & Naming Conventions
- JavaScript is plain ES6 in a single file model; keep functions focused and named by intent (`updatePreview`, `renderPinList`).
- Indentation is 4 spaces in HTML/CSS/JS.
- Use the existing CSS variable system in `styles.css` and prefer theme variables over hard-coded colors.
- Naming patterns:
  - DOM IDs in `camelCase` (e.g., `fileExplorerAccess`).
  - Data hooks use `data-action` and `data-change`.

## Testing Guidelines
- No automated test framework is currently configured.
- Manual validation: load locally, switch kiosk modes, generate XML, and verify downloads.
- If you add tests, document the runner and how to execute them.

## Commit & Pull Request Guidelines
- Commit style in history is short, imperative, and descriptive:
  - Examples: `Bump build to 1.0.6`, `Add Fluent theme toggle`.
- PRs should include:
  - Short summary of UX changes.
  - Screenshots for UI updates.
  - Notes about cache-busting/version bumps when assets change.

## Deployment & Caching Notes
- The hosted app is static; update cache-busting query strings in `index.html` when shipping UI or JS changes.
- Cloudflare Pages may cache assets; purge cache on deploy if changes do not appear.
