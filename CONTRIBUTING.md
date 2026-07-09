# Contributing to Emy

Thanks for your interest in improving Emy! Emy is a small, focused YouTube
anti-adblock project built by a single Italian developer. Contributions are
welcome, but please follow these guidelines to keep the codebase clean.

## Ways to contribute

- **Report bugs.** Open an issue with a clear reproduction, the YouTube URL,
  the output of `__emy_debug()` in the console, and your Chromium version.
- **Suggest new ad-key / URL patterns.** Many users notice patterns before we
  do. Open an issue or a PR against `filters/scriptlets.js` /
  `filters/rules_static.json`.
- **Improve the popup UI.** Keep it dependency-free and < 300 px wide.
- **Refactor the background service worker.** Manifest V3 has many
  constraints; please don't break alarms, dynamic DNR, or the scriptlet
  injection path.

## Development workflow

1. Clone the repository:
   ```bash
   git clone https://github.com/anto0102/Emy.git
   cd Emy
   ```
2. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**,
   and select the project folder.
3. Edit the source files. After most changes you can hit the **Reload** button
   on the extension card. For changes to the service worker (`background.js`)
   you must click **Update** (or remove + re-add) the extension.

## Code style

- 2-space indentation, single quotes, no semicolons in popup scripts (matches
  the existing files).
- No external dependencies. Everything is plain ES2018+ JavaScript.
- Avoid new `permissions` in `manifest.json` unless absolutely necessary.
  Each additional permission is a privacy regression for the end user.

## Pull requests

- One feature per PR.
- Include a short description of the *why* (which anti-adblock it bypasses,
  which selector, which URL pattern).
- Update `CHANGELOG.md` under the "Unreleased" section.

## Code of conduct

Be respectful. This is a free-time project — there's no SLA, no bounty, and
no obligation to merge anything. Quality over speed.
