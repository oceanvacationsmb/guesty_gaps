import { addDays, diffDays } from "./dates.js";

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

function laborDayWeekendDateParts(year) {
  const laborDay = new Date(Date.UTC(year, 8, 1));
  while (laborDay.getUTCDay() !== 1) {
    laborDay.setUTCDate(laborDay.getUTCDate() + 1);
  }
  const dates = [];
  for (let offset = -4; offset <= -1; offset += 1) {
    const date = new Date(laborDay);
    date.setUTCDate(laborDay.getUTCDate() + offset);
    dates.push(date.toISOString().slice(5, 10));
  }
  return dates;
}

function isDateInEvent(dateText, rule) {
  if (rule.type === "labor-day") {
    const year = Number(String(dateText).slice(0, 4));
    return laborDayWeekendDateParts(year).includes(datePart(dateText));
  }
  return datePartInRange(datePart(dateText), rule.start, rule.end);
}

function eventMinimumForDate(dateText, eventRules = [], eventMinNights = {}) {
  let minimum = 0;
  for (const rule of eventRules) {
    const eventMinimum = Number(eventMinNights[rule.id] || 0);
    if (
      Number.isInteger(eventMinimum) &&
      eventMinimum > minimum &&
      isDateInEvent(dateText, rule)
    ) {
      minimum = eventMinimum;
    }
  }
  return minimum;
}

function baselineMinNightsForDate(dateText, options) {
  const eventMinimum = eventMinimumForDate(
    dateText,
    options.eventRules,
    options.eventMinNights
  );
  const seasonalMinimum = eventMinimum || options.generalMinNights;
  const daysFromStart = diffDays(options.startDate, dateText);
  if (
    Number.isInteger(options.lastMinuteMinNights) &&
    options.lastMinuteMinNights > 0 &&
    daysFromStart >= 0 &&
    daysFromStart < options.lastMinuteDays
  ) {
    return options.lastMinuteMinNights;
  }
  return seasonalMinimum;
}

function gapFloorForDate(dateText, options) {
  const daysFromStart = diffDays(options.startDate, dateText);
  if (
    Number.isInteger(options.lastMinuteMinNights) &&
    options.lastMinuteMinNights > 0 &&
    daysFromStart >= 0 &&
    daysFromStart < options.lastMinuteDays
  ) {
    return options.lastMinuteMinNights;
  }
  return options.minNightsFloor;
}

function setAdjustment(adjustments, day, toMinNights) {
  const currentMinNights = Number(day.minNights);
  if (!Number.isInteger(currentMinNights) || currentMinNights === toMinNights) {
    adjustments.delete(day.date);
    return;
  }
  adjustments.set(day.date, {
    date: day.date,
    fromMinNights: currentMinNights,
    toMinNights
  });
}

export function findMinNightAdjustments(days, options = {}) {
  const minNightsFloor = Math.max(1, Number(options.minNightsFloor || 1));
  const generalMinNights = Math.max(
    minNightsFloor,
    Number(options.generalMinNights || 3)
  );
  const startDate = options.startDate || days.find((day) => day?.date)?.date || "";
  const lastMinuteValue = Number(options.lastMinuteMinNights || 0);
  const eventRules = Array.isArray(options.eventRules) ? options.eventRules : [];
  const rules = {
    minNightsFloor,
    generalMinNights,
    eventRules,
    eventMinNights: options.eventMinNights || {},
    lastMinuteMinNights:
      Number.isInteger(lastMinuteValue) && lastMinuteValue > 0
        ? lastMinuteValue
        : 0,
    lastMinuteDays: Math.max(1, Number(options.lastMinuteDays || 10)),
    startDate
  };
  const stepDownByGap = Boolean(options.stepDownByGap);
  const sortedDays = [...days]
    .filter((day) => day?.date)
    .sort((a, b) => a.date.localeCompare(b.date));
  const adjustments = new Map();

  for (const day of sortedDays) {
    if (!isAvailable(day)) continue;
    setAdjustment(adjustments, day, baselineMinNightsForDate(day.date, rules));
  }

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
      const nightsUntilNextStay = endIndex - dayIndex + 1;
      const effectiveFloor = gapFloorForDate(day.date, rules);
      const effectiveGeneralMinNights = Math.max(
        baselineMinNightsForDate(day.date, rules),
        effectiveFloor
      );
      const uncappedTargetMinNights = Math.max(nightsUntilNextStay, effectiveFloor);
      const cappedTargetMinNights = Math.max(
        Math.min(nightsUntilNextStay, effectiveGeneralMinNights),
        effectiveFloor
      );
      const targetMinNights = stepDownByGap
        ? cappedTargetMinNights
        : uncappedTargetMinNights;

      if (
        stepDownByGap ||
        effectiveFloor === 1 ||
        targetMinNights < baselineMinNightsForDate(day.date, rules)
      ) {
        setAdjustment(adjustments, day, targetMinNights);
      }
    }
  }

  return [...adjustments.values()].sort((a, b) => a.date.localeCompare(b.date));
}
