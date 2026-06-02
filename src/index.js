import { loadConfig } from "./config.js";
import { formatDate, addDays } from "./dates.js";
import { findOpenableGaps } from "./gapFinder.js";
import { GuestyClient } from "./guestyClient.js";

function calendarDays(payload) {
  const candidates = [
    payload,
    payload?.data,
    payload?.results,
    payload?.calendar,
    payload?.days,
    payload?.data?.days,
    payload?.data?.calendar,
    payload?.data?.results
  ];
  return candidates.find(Array.isArray) || [];
}

async function run() {
  const config = loadConfig();
  const client = new GuestyClient(config);
  const startDate = formatDate(new Date());
  const endDate = addDays(startDate, config.scanDays);
  const listings = config.listingIds.length
    ? config.listingIds.map((id) => ({ _id: id, title: id }))
    : await client.getListings();

  console.log(
    `${config.dryRun ? "DRY RUN: " : ""}Scanning ${listings.length} listings from ${startDate} to ${endDate}`
  );

  let gapCount = 0;
  for (const listing of listings) {
    const listingId = listing._id || listing.id;
    const days = calendarDays(await client.getCalendar(listingId, startDate, endDate));
    const gaps = findOpenableGaps(days, config);

    for (const gap of gaps) {
      gapCount += 1;
      console.log(
        `${config.dryRun ? "Would open" : "Opening"} ${listing.title || listingId}: ${gap.startDate} to ${gap.endDate} (${gap.nights} nights)`
      );
      if (!config.dryRun) {
        await client.openCalendarRange(listingId, gap.startDate, gap.endDate);
      }
    }
  }

  console.log(`${config.dryRun ? "Proposed" : "Completed"} openings: ${gapCount}`);
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
