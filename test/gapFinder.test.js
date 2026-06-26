import test from "node:test";
import assert from "node:assert/strict";
import { findMinNightAdjustments } from "../src/gapFinder.js";

function day(date, status, minNights, blocks = {}) {
  return { date, status, minNights, blocks };
}

test("reduces minimum nights in reverse before the next reservation", () => {
  const adjustments = findMinNightAdjustments([
    day("2026-01-26", "booked", 3, { b: true }),
    day("2026-01-27", "available", 4),
    day("2026-01-28", "available", 3),
    day("2026-01-29", "available", 3),
    day("2026-01-30", "available", 3),
    day("2026-01-31", "booked", 3, { b: true })
  ]);

  assert.deepEqual(adjustments, [
    { date: "2026-01-29", fromMinNights: 3, toMinNights: 2 },
    { date: "2026-01-30", fromMinNights: 3, toMinNights: 1 }
  ]);
});

test("adjusts a day-zero gap before the next reservation", () => {
  const adjustments = findMinNightAdjustments([
    day("2026-01-28", "available", 3),
    day("2026-01-29", "available", 3),
    day("2026-01-30", "available", 3),
    day("2026-01-31", "booked", 3, { b: true })
  ]);

  assert.deepEqual(adjustments, [
    { date: "2026-01-29", fromMinNights: 3, toMinNights: 2 },
    { date: "2026-01-30", fromMinNights: 3, toMinNights: 1 }
  ]);
});

test("does not adjust a later gap without a prior reservation", () => {
  const adjustments = findMinNightAdjustments([
    day("2026-01-27", "unavailable", 3, { m: true }),
    day("2026-01-28", "available", 3),
    day("2026-01-29", "available", 3),
    day("2026-01-30", "available", 3),
    day("2026-01-31", "booked", 3, { b: true })
  ]);

  assert.deepEqual(adjustments, []);
});

test("adjusts tomorrow when today is blocked and the next stay bounds the first opening", () => {
  const adjustments = findMinNightAdjustments([
    day("2026-06-02", "unavailable", 3, { an: true }),
    day("2026-06-03", "available", 3),
    day("2026-06-04", "available", 3),
    day("2026-06-05", "booked", 3, { b: true })
  ]);

  assert.deepEqual(adjustments, [
    { date: "2026-06-03", fromMinNights: 3, toMinNights: 2 },
    { date: "2026-06-04", fromMinNights: 3, toMinNights: 1 }
  ]);
});

test("never changes unavailable calendar days", () => {
  const adjustments = findMinNightAdjustments([
    day("2026-01-28", "booked", 3, { b: true }),
    day("2026-01-29", "unavailable", 3, { m: true }),
    day("2026-01-30", "available", 3),
    day("2026-01-31", "booked", 3, { b: true })
  ]);

  assert.deepEqual(adjustments, []);
});

test("opens a two-night gap down to the configured gap floor", () => {
  const adjustments = findMinNightAdjustments(
    [
      day("2026-01-26", "booked", 3, { b: true }),
      day("2026-01-27", "available", 3),
      day("2026-01-28", "available", 3),
      day("2026-01-29", "booked", 3, { b: true })
    ],
    { minNightsFloor: 2 }
  );

  assert.deepEqual(adjustments, [
    { date: "2026-01-27", fromMinNights: 3, toMinNights: 2 },
    { date: "2026-01-28", fromMinNights: 3, toMinNights: 2 }
  ]);
});

test("raises existing one-night minimums to the configured floor", () => {
  const adjustments = findMinNightAdjustments(
    [
      day("2026-01-26", "booked", 3, { b: true }),
      day("2026-01-27", "available", 1),
      day("2026-01-28", "available", 1),
      day("2026-01-29", "booked", 3, { b: true })
    ],
    { minNightsFloor: 2 }
  );

  assert.deepEqual(adjustments, [
    { date: "2026-01-27", fromMinNights: 1, toMinNights: 2 },
    { date: "2026-01-28", fromMinNights: 1, toMinNights: 2 }
  ]);
});

test("opens the tail of an all-three gap down to the configured gap floor", () => {
  const adjustments = findMinNightAdjustments(
    [
      day("2026-01-26", "booked", 3, { b: true }),
      day("2026-01-27", "available", 3),
      day("2026-01-28", "available", 3),
      day("2026-01-29", "available", 3),
      day("2026-01-30", "available", 3),
      day("2026-01-31", "booked", 3, { b: true })
    ],
    { minNightsFloor: 2 }
  );

  assert.deepEqual(adjustments, [
    { date: "2026-01-29", fromMinNights: 3, toMinNights: 2 },
    { date: "2026-01-30", fromMinNights: 3, toMinNights: 2 }
  ]);
});

test("steps down a four-night gap to 4,3,2,2 when enabled", () => {
  const adjustments = findMinNightAdjustments(
    [
      day("2026-01-26", "booked", 3, { b: true }),
      day("2026-01-27", "available", 5),
      day("2026-01-28", "available", 5),
      day("2026-01-29", "available", 5),
      day("2026-01-30", "available", 5),
      day("2026-01-31", "booked", 3, { b: true })
    ],
    { minNightsFloor: 2, generalMinNights: 4, stepDownByGap: true }
  );

  assert.deepEqual(adjustments, [
    { date: "2026-01-27", fromMinNights: 5, toMinNights: 4 },
    { date: "2026-01-28", fromMinNights: 5, toMinNights: 3 },
    { date: "2026-01-29", fromMinNights: 5, toMinNights: 2 },
    { date: "2026-01-30", fromMinNights: 5, toMinNights: 2 }
  ]);
});

test("raises the first night when step-down target is higher than current minimum", () => {
  const adjustments = findMinNightAdjustments(
    [
      day("2026-01-26", "booked", 3, { b: true }),
      day("2026-01-27", "available", 3),
      day("2026-01-28", "available", 2),
      day("2026-01-29", "available", 2),
      day("2026-01-30", "available", 2),
      day("2026-01-31", "booked", 3, { b: true })
    ],
    { minNightsFloor: 2, generalMinNights: 4, stepDownByGap: true }
  );

  assert.deepEqual(adjustments, [
    { date: "2026-01-27", fromMinNights: 3, toMinNights: 4 },
    { date: "2026-01-28", fromMinNights: 2, toMinNights: 3 }
  ]);
});

test("caps long step-down gaps at the configured general minimum", () => {
  const adjustments = findMinNightAdjustments(
    [
      day("2026-01-26", "booked", 3, { b: true }),
      day("2026-01-27", "available", 3),
      day("2026-01-28", "available", 3),
      day("2026-01-29", "available", 3),
      day("2026-01-30", "available", 3),
      day("2026-01-31", "available", 3),
      day("2026-02-01", "available", 3),
      day("2026-02-02", "booked", 3, { b: true })
    ],
    { minNightsFloor: 2, generalMinNights: 4, stepDownByGap: true }
  );

  assert.deepEqual(adjustments, [
    { date: "2026-01-27", fromMinNights: 3, toMinNights: 4 },
    { date: "2026-01-28", fromMinNights: 3, toMinNights: 4 },
    { date: "2026-01-29", fromMinNights: 3, toMinNights: 4 },
    { date: "2026-01-31", fromMinNights: 3, toMinNights: 2 },
    { date: "2026-02-01", fromMinNights: 3, toMinNights: 2 }
  ]);
});

test("event minimums cap the step-down pattern without becoming the gap floor", () => {
  const adjustments = findMinNightAdjustments(
    [
      day("2026-05-29", "booked", 3, { b: true }),
      day("2026-05-30", "available", 3),
      day("2026-05-31", "available", 3),
      day("2026-06-01", "available", 3),
      day("2026-06-02", "available", 3),
      day("2026-06-03", "booked", 3, { b: true })
    ],
    {
      minNightsFloor: 2,
      generalMinNights: 4,
      stepDownByGap: true,
      eventRules: [{ id: "summer", name: "Summer", start: "05-25", end: "09-04" }],
      eventMinNights: { summer: 7 }
    }
  );

  assert.deepEqual(adjustments, [
    { date: "2026-05-30", fromMinNights: 3, toMinNights: 4 },
    { date: "2026-06-01", fromMinNights: 3, toMinNights: 2 },
    { date: "2026-06-02", fromMinNights: 3, toMinNights: 2 }
  ]);
});

test("event minimums cap long step-down gaps at the event value", () => {
  const adjustments = findMinNightAdjustments(
    [
      day("2026-05-29", "booked", 3, { b: true }),
      day("2026-05-30", "available", 3),
      day("2026-05-31", "available", 3),
      day("2026-06-01", "available", 3),
      day("2026-06-02", "available", 3),
      day("2026-06-03", "available", 3),
      day("2026-06-04", "available", 3),
      day("2026-06-05", "available", 3),
      day("2026-06-06", "booked", 3, { b: true })
    ],
    {
      minNightsFloor: 2,
      generalMinNights: 4,
      stepDownByGap: true,
      eventRules: [{ id: "summer", name: "Summer", start: "05-25", end: "09-04" }],
      eventMinNights: { summer: 7 }
    }
  );

  assert.deepEqual(adjustments, [
    { date: "2026-05-30", fromMinNights: 3, toMinNights: 7 },
    { date: "2026-05-31", fromMinNights: 3, toMinNights: 6 },
    { date: "2026-06-01", fromMinNights: 3, toMinNights: 5 },
    { date: "2026-06-02", fromMinNights: 3, toMinNights: 4 },
    { date: "2026-06-04", fromMinNights: 3, toMinNights: 2 },
    { date: "2026-06-05", fromMinNights: 3, toMinNights: 2 }
  ]);
});

test("non-step-down gaps ignore event minimum floors and open backward", () => {
  const adjustments = findMinNightAdjustments(
    [
      day("2026-06-26", "booked", 3, { b: true }),
      day("2026-06-27", "available", 3),
      day("2026-06-28", "available", 3),
      day("2026-06-29", "available", 3),
      day("2026-06-30", "booked", 3, { b: true })
    ],
    {
      minNightsFloor: 1,
      generalMinNights: 3,
      stepDownByGap: false,
      eventRules: [{ id: "summer", name: "Summer", start: "06-03", end: "09-03" }],
      eventMinNights: { summer: 3 }
    }
  );

  assert.deepEqual(adjustments, [
    { date: "2026-06-28", fromMinNights: 3, toMinNights: 2 },
    { date: "2026-06-29", fromMinNights: 3, toMinNights: 1 }
  ]);
});

test("general minimum applies to available dates outside reservation gaps", () => {
  const adjustments = findMinNightAdjustments(
    [
      day("2026-09-10", "available", 4),
      day("2026-09-11", "available", 4),
      day("2026-09-12", "unavailable", 3, { m: true })
    ],
    { minNightsFloor: 1, generalMinNights: 3 }
  );

  assert.deepEqual(adjustments, [
    { date: "2026-09-10", fromMinNights: 4, toMinNights: 3 },
    { date: "2026-09-11", fromMinNights: 4, toMinNights: 3 }
  ]);
});

test("event minimum applies to available dates outside reservation gaps", () => {
  const adjustments = findMinNightAdjustments(
    [
      day("2026-12-24", "available", 3),
      day("2026-12-25", "available", 3)
    ],
    {
      minNightsFloor: 1,
      generalMinNights: 3,
      eventRules: [{ id: "christmas", name: "Christmas", start: "12-22", end: "12-31" }],
      eventMinNights: { christmas: 4 }
    }
  );

  assert.deepEqual(adjustments, [
    { date: "2026-12-24", fromMinNights: 3, toMinNights: 4 },
    { date: "2026-12-25", fromMinNights: 3, toMinNights: 4 }
  ]);
});

test("last-minute minimum overrides general and event rules for the first ten days", () => {
  const adjustments = findMinNightAdjustments(
    [
      day("2026-12-24", "available", 4),
      day("2026-12-25", "available", 4),
      day("2027-01-04", "available", 4)
    ],
    {
      startDate: "2026-12-24",
      minNightsFloor: 1,
      generalMinNights: 3,
      lastMinuteMinNights: 2,
      eventRules: [{ id: "christmas", name: "Christmas", start: "12-22", end: "12-31" }],
      eventMinNights: { christmas: 4 }
    }
  );

  assert.deepEqual(adjustments, [
    { date: "2026-12-24", fromMinNights: 4, toMinNights: 2 },
    { date: "2026-12-25", fromMinNights: 4, toMinNights: 2 },
    { date: "2027-01-04", fromMinNights: 4, toMinNights: 3 }
  ]);
});

test("labor day event covers Thursday through Sunday before the first Monday in September", () => {
  const adjustments = findMinNightAdjustments(
    [
      day("2027-09-01", "booked", 3, { b: true }),
      day("2027-09-02", "available", 3),
      day("2027-09-03", "available", 3),
      day("2027-09-04", "available", 3),
      day("2027-09-05", "available", 3),
      day("2027-09-06", "booked", 3, { b: true })
    ],
    {
      minNightsFloor: 2,
      generalMinNights: 4,
      stepDownByGap: true,
      eventRules: [{ id: "labor-day", name: "Labor Day", type: "labor-day" }],
      eventMinNights: { "labor-day": 4 }
    }
  );

  assert.deepEqual(adjustments, [
    { date: "2027-09-02", fromMinNights: 3, toMinNights: 4 },
    { date: "2027-09-04", fromMinNights: 3, toMinNights: 2 },
    { date: "2027-09-05", fromMinNights: 3, toMinNights: 2 }
  ]);
});
