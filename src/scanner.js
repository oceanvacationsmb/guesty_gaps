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

function calendarDaysByListing(payload) {
  const grouped = new Map();
  for (const day of calendarDays(payload)) {
    const listingId = String(day.listingId || "");
    if (!listingId) continue;
    if (!grouped.has(listingId)) grouped.set(listingId, []);
    grouped.get(listingId).push(day);
  }
  return grouped;
}

function listingName(listing) {
  return (
    listing?.title ||
    listing?.nickname ||
    listing?.nicknameForOwner ||
    listing?.name ||
    listing?._id ||
    listing?.id
  );
}

export async function scanActiveListings({
  client,
  config,
  activeListingIds,
  minNightsFloors = {}
}) {
  const startDate = formatDateInTimeZone(new Date(), config.timeZone);
  const endDate = addDays(startDate, config.scanDays);
  const listingMetadata = new Map(
    (await client.getListings()).map((listing) => [
      String(listing._id || listing.id),
      listing
    ])
  );
  const listings = activeListingIds.map((id) => {
    const metadata = listingMetadata.get(String(id));
    return {
      id,
      title: listingName(metadata) || id,
      minNightsFloor: minNightsFloors[id] || 1
    };
  });
  const result = { dryRun: config.dryRun, startDate, endDate, listings: [] };
  let appliedCount = 0;

  console.log(
    `${config.dryRun ? "DRY RUN: " : ""}Scanning ${listings.length} enabled listings from ${startDate} to ${endDate}`
  );

  const calendars = calendarDaysByListing(
    await client.getCalendars(activeListingIds, startDate, endDate)
  );

  for (const listing of listings) {
    const days = calendars.get(listing.id) || [];
    const adjustments = findMinNightAdjustments(days, {
      minNightsFloor: listing.minNightsFloor
    });

    for (const adjustment of adjustments) {
      console.log(
        `${config.dryRun ? "Would set" : "Setting"} ${listing.id} ${adjustment.date}: min nights ${adjustment.fromMinNights} -> ${adjustment.toMinNights}`
      );
    }
    if (!config.dryRun && adjustments.length) {
      await client.setMinNightsBulk(listing.id, adjustments);
      appliedCount += adjustments.length;
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
