# guesty_gaps

`guesty_gaps` is a small Render Web Service that adjusts Guesty minimum-night
rules inside open calendar gaps between reservations.

It does not change availability status. If the next stay begins on January 31,
the app can reduce the minimum stay on January 30 to one night, January 29 to two
nights, and January 28 to three nights. Earlier dates keep their existing rules
when they already fit inside the remaining gap.

Every listing starts inactive. Use the settings page to enable only the
properties that the scanner may update.

## Render setup

Create a Render Web Service connected to this repository:

```text
Build Command: npm install
Start Command: npm start
```

Add these environment variables:

```text
GUESTY_CLIENT_ID=<Guesty OAuth client ID>
GUESTY_CLIENT_SECRET=<Guesty OAuth client secret>
SETTINGS_ADMIN_KEY=<private password for the settings page>
GITHUB_CONFIG_TOKEN=<fine-grained GitHub token>
DRY_RUN=true
SCAN_DAYS=180
APP_TIME_ZONE=America/New_York
MAX_LIVE_UPDATES=1
```

Keep `DRY_RUN=true` while testing. Open the Render service URL, enter the
`SETTINGS_ADMIN_KEY`, load listings, enable one test property, save, and run a
scan. The result and Render logs will show each proposed minimum-night change.

For the first live test, keep `MAX_LIVE_UPDATES=1`. When `DRY_RUN=false`, the
scanner will update only the first eligible calendar date and report the
remaining proposals as skipped. Increase this limit only after reviewing the
result in Guesty.

## Saving selected listings

The settings page saves enabled listings to `config/properties.json` in this
GitHub repository. Render reads that committed JSON file, so the selection
survives refreshes, restarts, and redeploys.

Create a fine-grained GitHub personal access token restricted to the
`oceanvacationsmb/guesty_gaps` repository with **Contents: Read and write**
permission. Add it to Render:

```text
GITHUB_CONFIG_TOKEN=<fine-grained GitHub token>
```

The token stays in Render. It is never committed to GitHub and is used only when
the settings page saves the selected listing IDs.

## Local development

Copy `.env.example` to `.env`, fill in the values, then run:

```powershell
npm start
```

Run the unit tests with:

```powershell
npm test
```

## Guesty documentation

- [Authentication](https://open-api-docs.guesty.com/docs/authentication)
- [Calendar block types](https://open-api-docs.guesty.com/docs/calendar-block-types)
- [Update a listing calendar](https://open-api-docs.guesty.com/reference/put_availability-pricing-api-calendar-listings-id)
