# Chrome Extension State Management & Local Sync Rules

## 1. Local Server & Peer-to-Peer State Synchronization
- **Pull-First Background Polling:** Periodic background polling intervals (e.g., 1-3 second heartbeat loops) MUST NOT POST stale local master lists (like completed/pibpeb arrays) to the server. Background sync MUST be read-only for master lists, fetching server state to update local storage.
- **Respect Deletions on User Save:** When a user explicitly saves state (`isSave: true`), the server must treat the incoming payload as the authoritative state for that date/key. Do NOT force-append existing server items (`Set([...existing, ...incoming])`), as this prevents users from deleting items and causes deleted items to reappear.
- **Date-Scoped Keys with Robust Fallback:** Date-isolated storage keys (`key_YYYY-MM-DD`) must check for `.length > 0` before ignoring global fallback state, ensuring fallback lists are evaluated properly when date keys are uninitialized.

## 2. Chrome Extension Manifest & Content Script Lifecycle
- **Manifest Dependency Order:** All utility files (e.g. `sync.js`, `utils.js`) consumed by `content.js` MUST be explicitly declared in `manifest.json` under `content_scripts.js` in dependency order:
  ```json
  "content_scripts": [
    {
      "matches": ["https://portal.beacukai.go.id/*"],
      "js": ["sync.js", "content.js"],
      "run_at": "document_start"
    }
  ]
  ```
- **Automatic Lifecycle Rendering:** Content scripts MUST NOT rely on extension popup clicks (`popup.html`) to trigger UI updates or recoloring. Always attach `DOMContentLoaded`, `window.onload`, and unconstrained `MutationObserver` listeners to color and render UI automatically on initial page load and SPA DOM updates.

## 3. Data Retention & Scoped Input Auto-Detection
- **No Artificial Pruning:** Do not implement arbitrary date-cutoff cache pruning (e.g. 3-day expiration) unless explicitly directed by the user. Historic records must retain full formatting/coloring across all past dates.
- **Scoped Input Detection:** Auto-detection logic for page state (e.g. active dates) must strictly target explicit filter inputs (`input[type="date"]` or designated class/id names) and user interaction events (`change`/`input`). Never iterate through all generic `<input>` fields on a page.
