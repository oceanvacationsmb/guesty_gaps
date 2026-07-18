# guesty_gaps

`guesty_gaps` is a small Render Web Service that adjusts Guesty minimum-night
rules for enabled property calendars.

It does not change availability status. If the next stay begins on January 31,
the app can reduce the minimum stay on January 30 to one night, January 29 to two
nights, and January 28 to three nights. Earlier dates keep their existing rules
when they already fit inside the remaining gap.

Every listing starts inactive. Use the settings page to enable only the
properties that the scanner may update and set each property's general minimum,
lowest allowed gap minimum, and optional last-minute minimum.

The scanner applies rules in this order:

1. General min nights applies to every available calendar date in the scan
   window.
2. Event min nights override the general value for matching yearly windows such
   as Thanksgiving, Christmas/New Year, Labor Day, and Summer.
3. Last min gap overrides general and event values for the first 10 scan days
   only. Use `0` to disable it for a property.
4. Reservation-bounded gaps can override the date value so short openings can
   still be booked backward toward the next stay, while never going below the
   property's gap min nights.

For selected properties, enable **Step down gaps** to lower open gaps by the
remaining nights before the next reservation. The target is capped by the
property's general minimum and floored by its gap minimum. For example, with
general min nights set to `4` and gap min nights set to `2`, a long opening is
capped like `4, 4, 4, ... 4, 3, 2, 2` instead of becoming huge values such as
`25, 24, 23`.

The settings page also supports yearly event windows such as Off Season,
Thanksgiving, Christmas/New Year, Memorial, Summer, Labor Day, Easter, and Bike
Week. Fixed events have repeatable `MM-DD` start and end dates. Labor Day is
automatic each year: Thursday through Sunday before the first Monday in
September. Each active property can opt into each event with its own
minimum-night value. Event minimums also apply to available dates when there is
no reservation gap. Inside a reservation-bounded gap, event minimums cap the
seasonal step-down pattern, but the property's gap minimum remains the lowest
allowed gap value. For example, a summer `7`-night minimum will not force a 3-
or 4-night gap to `7`; short gaps still follow the normal step-down pattern such
as `4, 3, 2, 2`.

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
GUESTY_REQUEST_DELAY_MS=800
```

Keep `DRY_RUN=true` while testing. Open the Render service URL, enter the
`SETTINGS_ADMIN_KEY`, load listings, enable one test property, save, and run a
scan. The result and Render logs will show each proposed minimum-night change.

When `DRY_RUN=false`, clicking **SCAN & ADJUST NIGHTS** updates every eligible
calendar date for the enabled properties.

## Rate copy setup

Rate copying is kept separate from minimum-night scanning:

- `/rate-settings` chooses bedroom category, master/copy role, master property,
  percentage adjustment, and whether that copy target is active for rate
  updates.
- `/rates` previews the configured copy plan and has a separate button to send
  enabled price-only changes to Guesty.

Only properties already active in the scanner are available on the rate settings
page. Existing rate-copy settings are preserved when scanner settings are saved.
When no rate active/inactive setting exists yet, only `Studio` and `1BR` copy
targets start active for rate updates; all other categories start inactive.

Guesty limits Open API traffic. The scanner spaces calls by `800ms` and
automatically waits and retries if Guesty returns `429 Too Many Requests`.
Calendar reads for enabled properties are batched into one Guesty request.
Calendar writes are batched into one request per enabled property.

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
