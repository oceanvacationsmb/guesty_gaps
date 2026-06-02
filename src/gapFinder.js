import { addDays, diffDays } from "./dates.js";

const NEVER_OPEN_BLOCKS = new Set([
  "r", // Reserved
  "b", // Booked
  "o", // Owner reservation
  "pt", // Preparation time
  "ic", // Imported calendar event
  "an", // Advance notice
  "bw", // Booking window
  "sr", // Smart calendar rule
  "a", // Allotment block
  "abl" // Annual booking limit
]);

function enabledBlocks(day) {
  return Object.entries(day.blocks || {})
    .filter(([, enabled]) => enabled)
    .map(([type]) => type);
}

function isHardBoundary(day) {
  const blocks = enabledBlocks(day);
  return (
    ["booked", "reserved"].includes(String(day.status || "").toLowerCase()) ||
    blocks.some((block) => ["b", "r", "o"].includes(block))
  );
}

function isOpenable(day, openableBlockTypes) {
  if (String(day.status || "").toLowerCase() !== "unavailable") return false;

  const blocks = enabledBlocks(day);
  return (
    blocks.length > 0 &&
    !blocks.some((block) => NEVER_OPEN_BLOCKS.has(block)) &&
    blocks.every((block) => openableBlockTypes.has(block))
  );
}

export function findOpenableGaps(days, options) {
  const sortedDays = [...days]
    .filter((day) => day?.date)
    .sort((a, b) => a.date.localeCompare(b.date));
  const gaps = [];

  for (let index = 0; index < sortedDays.length; index += 1) {
    if (!isOpenable(sortedDays[index], options.openableBlockTypes)) continue;

    const startIndex = index;
    while (
      index + 1 < sortedDays.length &&
      addDays(sortedDays[index].date, 1) === sortedDays[index + 1].date &&
      isOpenable(sortedDays[index + 1], options.openableBlockTypes)
    ) {
      index += 1;
    }

    const endIndex = index;
    const previousDay = sortedDays[startIndex - 1];
    const nextDay = sortedDays[endIndex + 1];
    const startDate = sortedDays[startIndex].date;
    const endDate = sortedDays[endIndex].date;
    const nights = diffDays(startDate, addDays(endDate, 1));

    if (
      nights <= options.maxGapNights &&
      previousDay &&
      nextDay &&
      isHardBoundary(previousDay) &&
      isHardBoundary(nextDay)
    ) {
      gaps.push({ startDate, endDate, nights });
    }
  }

  return gaps;
}
