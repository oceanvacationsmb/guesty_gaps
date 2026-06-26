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

test("live scan leaves existing all-three values for a floor-two property", async () => {
  const calls = [];
  const result = await scanActiveListings({
    client: {
      getListings: async () => [
        { _id: "test-listing", title: "Ocean View Condo" }
      ],
      getCalendars: async () =>
        calendar.map((calendarDay) => ({
          ...calendarDay,
          listingId: "test-listing"
        })),
      setMinNightsBulk: async (...args) => calls.push(args)
    },
    config: { dryRun: false, scanDays: 180 },
    activeListingIds: ["test-listing"],
    minNightsFloors: { "test-listing": 2 }
  });

  assert.deepEqual(calls, []);
  assert.equal(result.listings[0].minNightsFloor, 2);
  assert.equal(result.listings[0].title, "Ocean View Condo");
  assert.equal(result.adjustmentCount, 0);
  assert.equal(result.appliedCount, 0);
});

test("live scan raises existing one-night values to a floor of two", async () => {
  const calls = [];
  const result = await scanActiveListings({
    client: {
      getListings: async () => [
        { _id: "test-listing", title: "Ocean View Condo" }
      ],
      getCalendars: async () =>
        [
          day("2026-06-08", "booked", 3, { b: true }),
          day("2026-06-09", "available", 1),
          day("2026-06-10", "available", 1),
          day("2026-06-11", "booked", 3, { b: true })
        ].map((calendarDay) => ({
          ...calendarDay,
          listingId: "test-listing"
        })),
      setMinNightsBulk: async (...args) => calls.push(args)
    },
    config: { dryRun: false, scanDays: 180 },
    activeListingIds: ["test-listing"],
    minNightsFloors: { "test-listing": 2 }
  });

  assert.deepEqual(calls, [
    [
      "test-listing",
      [
        { date: "2026-06-09", fromMinNights: 1, toMinNights: 2 },
        { date: "2026-06-10", fromMinNights: 1, toMinNights: 2 }
      ]
    ]
  ]);
  assert.equal(result.adjustmentCount, 2);
  assert.equal(result.appliedCount, 2);
});

test("dry-run reports every adjustment without writing", async () => {
  const calls = [];
  const result = await scanActiveListings({
    client: {
      getListings: async () => [
        { _id: "test-listing", nickname: "Ocean View Condo" }
      ],
      getCalendars: async () =>
        calendar.map((calendarDay) => ({
          ...calendarDay,
          listingId: "test-listing"
        })),
      setMinNightsBulk: async (...args) => calls.push(args)
    },
    config: { dryRun: true, scanDays: 180 },
    activeListingIds: ["test-listing"],
    minNightsFloors: { "test-listing": 1 }
  });

  assert.deepEqual(calls, []);
  assert.equal(result.adjustmentCount, 2);
  assert.equal(result.appliedCount, 0);
});
