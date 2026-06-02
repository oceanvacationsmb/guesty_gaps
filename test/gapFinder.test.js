import test from "node:test";
import assert from "node:assert/strict";
import { findOpenableGaps } from "../src/gapFinder.js";

const options = { maxGapNights: 3, openableBlockTypes: new Set(["m"]) };

function day(date, status, blocks = {}) {
  return { date, status, blocks };
}

test("opens a short manual gap bounded by bookings", () => {
  const gaps = findOpenableGaps(
    [
      day("2026-06-01", "booked", { b: true }),
      day("2026-06-02", "unavailable", { m: true }),
      day("2026-06-03", "unavailable", { m: true }),
      day("2026-06-04", "reserved", { r: true })
    ],
    options
  );

  assert.deepEqual(gaps, [
    { startDate: "2026-06-02", endDate: "2026-06-03", nights: 2 }
  ]);
});

test("does not open gaps containing protected blocks", () => {
  const gaps = findOpenableGaps(
    [
      day("2026-06-01", "booked", { b: true }),
      day("2026-06-02", "unavailable", { m: true, pt: true }),
      day("2026-06-03", "booked", { b: true })
    ],
    options
  );

  assert.deepEqual(gaps, []);
});

test("does not open unbounded or oversized manual blocks", () => {
  const gaps = findOpenableGaps(
    [
      day("2026-06-01", "booked", { b: true }),
      day("2026-06-02", "unavailable", { m: true }),
      day("2026-06-03", "unavailable", { m: true }),
      day("2026-06-04", "unavailable", { m: true }),
      day("2026-06-05", "unavailable", { m: true }),
      day("2026-06-06", "booked", { b: true })
    ],
    options
  );

  assert.deepEqual(gaps, []);
});
