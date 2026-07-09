# Changelog

All notable changes to **Emy** are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1] - 2026-07-09

### Changed
- All inline comments stripped to the minimum — shorter, more readable code.
- Extension auto-release via GitHub Actions (`git tag v* && git push origin v*`).
- `version.json` now served from the same repo (`anto0102/Emy` instead of `emy-filters`).
- `LOCAL_SCRIPTLET_VERSION` bumped to `2.1.1`.

## [1.1.0] - 2026-07-09

### Added
- Orange `!` badge on the action icon when a newer scriptlet version is available remotely.
- Remote `version.json` check (hosted on GitHub raw) on every periodic update and on install.
- `update-banner` in the popup to inform the user when a newer scriptlet is available.
- YouTube SPA navigation handling: re-injects the scriptlet on `yt-navigate-finish` and `popstate`.
- Cleanup bridge: when the extension is disabled, every YouTube tab receives a `disableScriptlet` message that resets the MAIN-world marker.
- `getStatus` message in the background to feed the popup's status box.
- 32/64 px icon variants referenced in the action manifest.

### Changed
- Popup fully translated to English.
- Popup width bumped to 280 px to fit the new status box.
- Improved `XHR.send` hook to use `configurable: true` property definitions (avoids edge-case crashes).
- `JSON.parse` / `fetch` toString overrides are now wrapped in try/catch.
- Dynamic-rules ETag is now stored separately from the version ETag.

### Fixed
- `content.js` no longer throws when the `chrome.tabs.query` is invoked without a sender tab.
- `scriptlets.js` DOM observer now silently recovers when `MutationObserver` is unavailable.

## [1.0.0] - 2026-06-XX

### Added
- Initial release.
- Static DNR rules (`filters/rules_static.json`) for the most common ad endpoints.
- Dynamic DNR rules fetched from a user-configurable GitHub raw URL.
- Static `scriptlets.js` (JSON.parse / fetch / XHR hooks + DOM observer + auto-skip + video speed-up).
- ISOLATED-world `content.js` bridge that asks the background to inject the scriptlet into the MAIN world.
- Popup with on/off toggle, manual update button, debug log viewer, and scriptlet status inspector.
- In-page `window.__emy_debug()` helper.
