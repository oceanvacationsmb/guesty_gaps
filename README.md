# guesty_gaps

`guesty_gaps` scans Guesty calendars whenever it starts and opens eligible short
gaps between reservations.

The initial policy is intentionally narrow: a gap must be bounded by reservations,
must be no longer than `MAX_GAP_NIGHTS`, and every day must be a manual block
(`m`). Reservation, owner, preparation-time, imported-calendar, advance-notice,
booking-window, smart-rule, allotment, and annual-limit blocks are never opened.

## Set up

1. Create a Guesty OAuth application in Guesty under **Integrations > OAuth applications**.
2. Copy `.env.example` to `.env` and fill in the Guesty client ID and secret.
3. Run `npm start`.
4. Review the dry-run output.
5. Set `DRY_RUN=false` only when the proposed openings match your policy.

Guesty limits token creation, so this app caches its OAuth token in
`.guesty-token-cache.json`. Both the token cache and `.env` are ignored by Git.

## Configure

| Variable | Default | Purpose |
| --- | --- | --- |
| `DRY_RUN` | `true` | Report changes without updating Guesty. |
| `SCAN_DAYS` | `180` | Number of future calendar days to inspect. |
| `MAX_GAP_NIGHTS` | `14` | Longest manual-block gap to reopen. |
| `LISTING_IDS` | blank | Comma-separated Guesty listing IDs; blank scans all active listed properties. |
| `OPENABLE_BLOCK_TYPES` | `m` | Guesty block types eligible for reopening. Expand only after reviewing Guesty's calendar block documentation. |

## Run tests

```powershell
npm test
```

## Create the GitHub repository

This folder is ready to publish as a standalone repository named `guesty_gaps`:

```powershell
git init
git add .
git commit -m "Build Guesty calendar gap opener"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/guesty_gaps.git
git push -u origin main
```

## Guesty documentation

- [Authentication](https://open-api-docs.guesty.com/docs/authentication)
- [Calendar block types](https://open-api-docs.guesty.com/docs/calendar-block-types)
- [Update a listing calendar](https://open-api-docs.guesty.com/reference/put_availability-pricing-api-calendar-listings-id)
