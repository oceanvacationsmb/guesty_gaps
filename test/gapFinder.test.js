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

test("respects a configured minimum-night floor", () => {
  const adjustments = findMinNightAdjustments(
    [
      day("2026-01-26", "booked", 3, { b: true }),
      day("2026-01-27", "available", 3),
      day("2026-01-28", "available", 3),
      day("2026-01-29", "booked", 3, { b: true })
    ],
    { minNightsFloor: 2 }
  );

  assert.deepEqual(adjustments, []);
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

test("does not raise an existing all-three minimum above the configured floor", () => {
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

  assert.deepEqual(adjustments, []);
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
