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

export function findMinNightAdjustments(days, options = {}) {
  const minNightsFloor = Math.max(1, Number(options.minNightsFloor || 1));
  const stepDownByGap = Boolean(options.stepDownByGap);
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
    const leadingDays = sortedDays.slice(0, startIndex);
    const followsOnlyAdvanceNotice =
      leadingDays.length > 0 &&
      leadingDays.every((day) => {
        const blocks = enabledBlocks(day);
        return blocks.length > 0 && blocks.every((block) => block === "an");
      });
    const isInitialBookableSpan = startIndex === 0 || followsOnlyAdvanceNotice;
    if (
      (!isInitialBookableSpan && !isReservationBoundary(previousDay)) ||
      !isReservationBoundary(nextDay)
    ) {
      continue;
    }

    for (let dayIndex = startIndex; dayIndex <= endIndex; dayIndex += 1) {
      const day = sortedDays[dayIndex];
      const currentMinNights = Number(day.minNights);
      const nightsUntilNextStay = endIndex - dayIndex + 1;
      const targetMinNights = Math.max(nightsUntilNextStay, minNightsFloor);

      if (!Number.isInteger(currentMinNights)) continue;

      if (stepDownByGap && currentMinNights !== targetMinNights) {
        adjustments.push({
          date: day.date,
          fromMinNights: currentMinNights,
          toMinNights: targetMinNights
        });
      } else if (currentMinNights < minNightsFloor) {
        adjustments.push({
          date: day.date,
          fromMinNights: currentMinNights,
          toMinNights: minNightsFloor
        });
      } else if (
        (minNightsFloor === 1 || stepDownByGap) &&
        currentMinNights > targetMinNights
      ) {
        adjustments.push({
          date: day.date,
          fromMinNights: currentMinNights,
          toMinNights: targetMinNights
        });
      }
    }
  }

  return adjustments;
}
