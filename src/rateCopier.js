import { addDays, formatDateInTimeZone } from "./dates.js";

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

function isAvailableForRateUpdate(day) {
  if (Number.isFinite(Number(day?.allotment))) return Number(day.allotment) > 0;
  return String(day?.status || "").toLowerCase() === "available";
}

function priceFromDay(day) {
  const price = Number(day?.price);
  return Number.isFinite(price) && price > 0 ? price : null;
}

function adjustedPrice(price, adjustmentPercent) {
  return Math.max(1, Math.round(price * (1 + Number(adjustmentPercent || 0) / 100)));
}

function rateCopyTargets(settings) {
  return Object.entries(settings.rateCopySettings || {})
    .filter(([, setting]) => setting.enabled && setting.role === "copy" && setting.masterListingId)
    .map(([id, setting]) => ({ id, ...setting }));
}

export async function copyRatesForEnabledTargets({
  client,
  config,
  activeListingIds = [],
  rateCopySettings = {},
  dryRun = true
}) {
  const startDate = formatDateInTimeZone(new Date(), config.timeZone);
  const endDate = addDays(startDate, config.scanDays);
  const activeIds = new Set(activeListingIds);
  const settings = { rateCopySettings };
  const targets = rateCopyTargets(settings)
    .filter((target) => activeIds.has(target.id) && activeIds.has(target.masterListingId));

  const listingMetadata = new Map(
    (await client.getListings()).map((listing) => [
      String(listing._id || listing.id),
      listing
    ])
  );
  const listingIds = [
    ...new Set(targets.flatMap((target) => [target.id, target.masterListingId]))
  ];
  const calendars = calendarDaysByListing(
    await client.getCalendars(listingIds, startDate, endDate)
  );
  const result = {
    dryRun,
    startDate,
    endDate,
    listings: [],
    adjustmentCount: 0,
    appliedCount: 0
  };

  for (const target of targets) {
    const masterDays = new Map(
      (calendars.get(target.masterListingId) || []).map((day) => [day.date, day])
    );
    const targetDays = calendars.get(target.id) || [];
    const adjustments = [];

    for (const targetDay of targetDays) {
      if (!targetDay?.date || !isAvailableForRateUpdate(targetDay)) continue;
      const masterPrice = priceFromDay(masterDays.get(targetDay.date));
      const currentPrice = priceFromDay(targetDay);
      if (!masterPrice || !currentPrice) continue;
      const toPrice = adjustedPrice(masterPrice, target.adjustmentPercent);
      if (currentPrice === toPrice) continue;
      adjustments.push({
        date: targetDay.date,
        fromPrice: currentPrice,
        toPrice,
        masterPrice
      });
    }

    if (!dryRun && adjustments.length) {
      await client.setRatesBulk(target.id, adjustments);
      result.appliedCount += adjustments.length;
    }
    result.adjustmentCount += adjustments.length;
    result.listings.push({
      id: target.id,
      title: listingName(listingMetadata.get(target.id)) || target.id,
      bedroomCategory: target.bedroomCategory,
      masterListingId: target.masterListingId,
      masterTitle:
        listingName(listingMetadata.get(target.masterListingId)) ||
        target.masterListingId,
      adjustmentPercent: target.adjustmentPercent,
      adjustments
    });
  }

  return result;
}
