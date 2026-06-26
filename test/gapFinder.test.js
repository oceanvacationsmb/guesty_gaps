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

  assert.deepEqual(adjustments, [
    { date: "2026-01-27", fromMinNights: 3, toMinNights: 2 },
    { date: "2026-01-28", fromMinNights: 3, toMinNights: 2 }
  ]);
});
