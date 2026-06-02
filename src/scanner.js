import { addDays, formatDateInTimeZone } from "./dates.js";
import { findMinNightAdjustments } from "./gapFinder.js";

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

export async function scanActiveListings({ client, config, activeListingIds }) {
  const startDate = formatDateInTimeZone(new Date(), config.timeZone);
  const endDate = addDays(startDate, config.scanDays);
  const listings = activeListingIds.map((id) => ({ id, title: id }));
  const result = { dryRun: config.dryRun, startDate, endDate, listings: [] };
  let appliedCount = 0;

  console.log(
    `${config.dryRun ? "DRY RUN: " : ""}Scanning ${listings.length} enabled listings from ${startDate} to ${endDate}`
  );

  for (const listing of listings) {
    const days = calendarDays(await client.getCalendar(listing.id, startDate, endDate));
    const adjustments = findMinNightAdjustments(days);

    for (const adjustment of adjustments) {
      console.log(
        `${config.dryRun ? "Would set" : "Setting"} ${listing.id} ${adjustment.date}: min nights ${adjustment.fromMinNights} -> ${adjustment.toMinNights}`
      );
      if (!config.dryRun) {
        await client.setMinNights(
          listing.id,
          adjustment.date,
          adjustment.toMinNights
        );
        appliedCount += 1;
      }
    }
    result.listings.push({ ...listing, adjustments });
  }

  const count = result.listings.reduce(
    (total, listing) => total + listing.adjustments.length,
    0
  );
  console.log(`${config.dryRun ? "Proposed" : "Completed"} adjustments: ${config.dryRun ? count : appliedCount}`);
  return {
    ...result,
    adjustmentCount: count,
    appliedCount
  };
}
