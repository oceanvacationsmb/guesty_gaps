import test from "node:test";
import assert from "node:assert/strict";
import { scanActiveListings } from "../src/scanner.js";

function day(date, status, minNights, blocks = {}) {
  return { date, status, minNights, blocks };
}

const calendar = [
  day("2026-06-08", "booked", 3, { b: true }),
  day("2026-06-09", "available", 3),
  day("2026-06-10", "available", 3),
  day("2026-06-11", "booked", 3, { b: true })
];

test("live scan applies only one adjustment when the safety cap is one", async () => {
  const calls = [];
  const result = await scanActiveListings({
    client: {
      getCalendar: async () => calendar,
      setMinNights: async (...args) => calls.push(args)
    },
    config: { dryRun: false, scanDays: 180, maxLiveUpdates: 1 },
    activeListingIds: ["test-listing"]
  });

  assert.deepEqual(calls, [["test-listing", "2026-06-09", 2]]);
  assert.equal(result.adjustmentCount, 2);
  assert.equal(result.appliedCount, 1);
  assert.equal(result.skippedByLiveCap, 1);
});

test("dry-run reports every adjustment without writing", async () => {
  const calls = [];
  const result = await scanActiveListings({
    client: {
      getCalendar: async () => calendar,
      setMinNights: async (...args) => calls.push(args)
    },
    config: { dryRun: true, scanDays: 180, maxLiveUpdates: 1 },
    activeListingIds: ["test-listing"]
  });

  assert.deepEqual(calls, []);
  assert.equal(result.adjustmentCount, 2);
  assert.equal(result.appliedCount, 0);
  assert.equal(result.skippedByLiveCap, 0);
});
