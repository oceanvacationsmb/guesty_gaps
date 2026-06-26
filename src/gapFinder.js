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

function datePart(dateText) {
  return String(dateText || "").slice(5, 10);
}

function datePartInRange(value, start, end) {
  if (!value || !start || !end) return false;
  if (start <= end) return value >= start && value <= end;
  return value >= start || value <= end;
}

function eventMinimumForDate(dateText, eventRules = [], eventMinNights = {}) {
  const value = datePart(dateText);
  let minimum = 0;
  for (const rule of eventRules) {
    const eventMinimum = Number(eventMinNights[rule.id] || 0);
    if (
      Number.isInteger(eventMinimum) &&
      eventMinimum > minimum &&
      datePartInRange(value, rule.start, rule.end)
    ) {
      minimum = eventMinimum;
    }
  }
  return minimum;
}

export function findMinNightAdjustments(days, options = {}) {
  const minNightsFloor = Math.max(1, Number(options.minNightsFloor || 1));
  const generalMinNights = Math.max(
    minNightsFloor,
    Number(options.generalMinNights || 3)
  );
  const eventRules = Array.isArray(options.eventRules) ? options.eventRules : [];
  const eventMinNights = options.eventMinNights || {};
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
      const effectiveFloor = Math.max(
        minNightsFloor,
        eventMinimumForDate(day.date, eventRules, eventMinNights)
      );
      const effectiveGeneralMinNights = Math.max(generalMinNights, effectiveFloor);
      const uncappedTargetMinNights = Math.max(nightsUntilNextStay, effectiveFloor);
      const cappedTargetMinNights = Math.max(
        Math.min(nightsUntilNextStay, effectiveGeneralMinNights),
        effectiveFloor
      );
      const targetMinNights = stepDownByGap
        ? cappedTargetMinNights
        : uncappedTargetMinNights;

      if (!Number.isInteger(currentMinNights)) continue;

      if (stepDownByGap && currentMinNights !== targetMinNights) {
        adjustments.push({
          date: day.date,
          fromMinNights: currentMinNights,
          toMinNights: targetMinNights
        });
      } else if (currentMinNights < effectiveFloor) {
        adjustments.push({
          date: day.date,
          fromMinNights: currentMinNights,
          toMinNights: effectiveFloor
        });
      } else if (
        (effectiveFloor === 1 || stepDownByGap) &&
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
