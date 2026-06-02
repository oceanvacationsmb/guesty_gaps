import { addDays } from "./dates.js";

function enabledBlocks(day) {
  return Object.entries(day.blocks || {})
    .filter(([, enabled]) => enabled)
    .map(([type]) => type);
}

function isReservationBoundary(day) {
  const status = String(day?.status || "").toLowerCase();
  const blocks = enabledBlocks(day || {});
  return (
    ["booked", "reserved"].includes(status) ||
    blocks.some((block) => ["b", "r", "o"].includes(block))
  );
}

function isAvailable(day) {
  return String(day?.status || "").toLowerCase() === "available";
}

export function findMinNightAdjustments(days) {
  const sortedDays = [...days]
    .filter((day) => day?.date)
    .sort((a, b) => a.date.localeCompare(b.date));
  const adjustments = [];

  for (let index = 0; index < sortedDays.length; index += 1) {
    if (!isAvailable(sortedDays[index])) continue;

    const startIndex = index;
    while (
      index + 1 < sortedDays.length &&
      addDays(sortedDays[index].date, 1) === sortedDays[index + 1].date &&
      isAvailable(sortedDays[index + 1])
    ) {
      index += 1;
    }

    const endIndex = index;
    const previousDay = sortedDays[startIndex - 1];
    const nextDay = sortedDays[endIndex + 1];
    const startsOnDayZero = startIndex === 0;
    if (
      (!startsOnDayZero && !isReservationBoundary(previousDay)) ||
      !isReservationBoundary(nextDay)
    ) {
      continue;
    }

    for (let dayIndex = startIndex; dayIndex <= endIndex; dayIndex += 1) {
      const day = sortedDays[dayIndex];
      const currentMinNights = Number(day.minNights);
      const nightsUntilNextStay = endIndex - dayIndex + 1;

      if (
        Number.isInteger(currentMinNights) &&
        currentMinNights > nightsUntilNextStay
      ) {
        adjustments.push({
          date: day.date,
          fromMinNights: currentMinNights,
          toMinNights: nightsUntilNextStay
        });
      }
    }
  }

  return adjustments;
}
