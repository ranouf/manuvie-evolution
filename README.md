# Manuvie Evolution

Local Chrome extension that adds an **Evolution** button to the Manulife Wealth portal. The panel displays cumulative gains, yearly returns, and directly charged fees.

## Local installation

1. Open `chrome://extensions/` in Chrome.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder.
5. Reload `https://manulifewealth.myinvestorportal.ca/overview`.

Folder to load in Chrome: `C:\Users\cedric\Documents\Sources\Manuvie`

## Commands

```text
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:visual
npm run build
```

The build creates two archives:

- `dist/manuvie-evolution-{version}.zip` for local testing and local releases;
- `dist/manuvie-evolution-{version}-chrome-store.zip` for the Chrome Web Store.

## Chrome Web Store publication

Publication follows the same process as the UglyPadlet extension through the **Deploy Chrome Extension** GitHub Actions workflow.

Required GitHub secrets:

- `CHROME_EXTENSION_ID`
- `CHROME_PUBLISHER_ID`
- `CHROME_CLIENT_ID`
- `CHROME_CLIENT_SECRET`
- `CHROME_REFRESH_TOKEN`

Local credential validation, if `.codex/secretkeys.txt` contains these values:

```text
npm run chrome-store:dry-run
```

Publication from GitHub:

1. Open **Actions**.
2. Run **Deploy Chrome Extension** with **Run workflow**.
3. Keep `dry_run=true` to validate secrets without publishing.
4. Set `dry_run=false` and `publish_to_chrome_store=true` to upload and publish to the Chrome Web Store.
5. Optionally set `create_github_release=true` to create the GitHub release with the Chrome Store zip.

## Portal data sources

- `/portfoliosummary/performance/v3/fr?rangeType=sinceInception`: global history.
- `/account/chart/account/{account}/language/fr?rangeType=sinceInception`: account history.
- `/transactions/investorId/{investor}/language/fr`: Manulife fees, GST, and QST.

The displayed gain is calculated as `market value - net invested capital`. Deposits and withdrawals are therefore not counted as gains or losses.

## Local cache

The extension keeps already loaded data in Chrome local storage, per investor. Closed years are reused on the next load, and the extension requests only the current year again to refresh charts and fees.
