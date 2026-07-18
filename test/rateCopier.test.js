import test from "node:test";
import assert from "node:assert/strict";
import { copyRatesForEnabledTargets } from "../src/rateCopier.js";

function day(listingId, date, price, status = "available") {
  return { listingId, date, price, status };
}

test("copies rates only for enabled copy targets", async () => {
  const writes = [];
  let requestedListingIds = [];
  const result = await copyRatesForEnabledTargets({
    client: {
      getListings: async () => [
        { _id: "master-1", title: "1BR Master" },
        { _id: "target-1", title: "1BR Target" },
        { _id: "target-2", title: "Disabled Target" }
      ],
      getCalendars: async (listingIds) => {
        requestedListingIds = listingIds;
        return [
          day("master-1", "2026-07-20", 200),
          day("master-1", "2026-07-21", 250),
          day("target-1", "2026-07-20", 100),
          day("target-1", "2026-07-21", 275),
          day("target-2", "2026-07-20", 100)
        ];
      },
      setRatesBulk: async (...args) => writes.push(args)
    },
    config: { scanDays: 180, timeZone: "America/New_York" },
    activeListingIds: ["master-1", "target-1", "target-2"],
    rateCopySettings: {
      "master-1": {
        bedroomCategory: "1BR",
        role: "master",
        enabled: false,
        masterListingId: "",
        adjustmentPercent: 0
      },
      "target-1": {
        bedroomCategory: "1BR",
        role: "copy",
        enabled: true,
        masterListingId: "master-1",
        adjustmentPercent: 10
      },
      "target-2": {
        bedroomCategory: "1BR",
        role: "copy",
        enabled: false,
        masterListingId: "master-1",
        adjustmentPercent: 10
      }
    },
    dryRun: false
  });

  assert.deepEqual(requestedListingIds.sort(), ["master-1", "target-1"]);
  assert.deepEqual(writes, [
    [
      "target-1",
      [
        { date: "2026-07-20", fromPrice: 100, toPrice: 220, masterPrice: 200 }
      ]
    ]
  ]);
  assert.equal(result.adjustmentCount, 1);
  assert.equal(result.appliedCount, 1);
});

test("preview does not write rate changes", async () => {
  const writes = [];
  const result = await copyRatesForEnabledTargets({
    client: {
      getListings: async () => [
        { _id: "master-1", title: "1BR Master" },
        { _id: "target-1", title: "1BR Target" }
      ],
      getCalendars: async () => [
        day("master-1", "2026-07-20", 200),
        day("target-1", "2026-07-20", 100)
      ],
      setRatesBulk: async (...args) => writes.push(args)
    },
    config: { scanDays: 180, timeZone: "America/New_York" },
    activeListingIds: ["master-1", "target-1"],
    rateCopySettings: {
      "target-1": {
        bedroomCategory: "1BR",
        role: "copy",
        enabled: true,
        masterListingId: "master-1",
        adjustmentPercent: 0
      }
    },
    dryRun: true
  });

  assert.deepEqual(writes, []);
  assert.equal(result.adjustmentCount, 1);
  assert.equal(result.appliedCount, 0);
});
