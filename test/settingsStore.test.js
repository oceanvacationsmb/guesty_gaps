import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SettingsStore } from "../src/settingsStore.js";

const DEFAULT_EVENT_RULES = [
  { id: "off-season", name: "Off Season", start: "09-02", end: "02-28" },
  { id: "bike-week", name: "Bike Week", start: "05-08", end: "05-17" },
  { id: "easter", name: "Easter", start: "03-20", end: "04-20" },
  { id: "memorial", name: "Memorial", start: "05-20", end: "05-31" },
  { id: "summer", name: "Summer", start: "05-25", end: "09-04" },
  { id: "thanksgiving", name: "Thanksgiving", start: "11-24", end: "11-30" },
  { id: "christmas", name: "Christmas/New Year", start: "12-23", end: "12-31" }
];

test("loads the committed property selection JSON locally", async () => {
  const path = join("config", "properties.json");
  const store = new SettingsStore({ path });
  const committed = JSON.parse(await readFile(path, "utf8"));
  const expectedIds = [...new Set(committed.activeListingIds.map(String))].sort();
  const expectedFloors = Object.fromEntries(
    expectedIds.map((id) => [id, Number(committed.minNightsFloors?.[id] || 1)])
  );
  const expectedGeneral = Object.fromEntries(
    expectedIds.map((id) => [
      id,
      Math.max(
        Number(committed.minNightsFloors?.[id] || 1),
        Number(committed.generalMinNights?.[id] || 3)
      )
    ])
  );
  const expectedStepDown = Object.fromEntries(
    expectedIds.map((id) => [id, Boolean(committed.stepDownByGap?.[id])])
  );
  const expectedPropertyEvents = Object.fromEntries(
    expectedIds.map((id) => [id, committed.propertyEventMinNights?.[id] || {}])
  );

  assert.deepEqual(await store.load(), {
    activeListingIds: expectedIds,
    minNightsFloors: expectedFloors,
    generalMinNights: expectedGeneral,
    eventRules: committed.eventRules || DEFAULT_EVENT_RULES,
    propertyEventMinNights: expectedPropertyEvents,
    stepDownByGap: expectedStepDown
  });
});

test("saves property selection to GitHub contents API", async () => {
  const requests = [];
  const fetchImpl = async (url, options = {}) => {
    requests.push({ url, options });
    if (!options.method) {
      return {
        ok: true,
        json: async () => ({
          sha: "current-sha",
          content: Buffer.from(
            '{"activeListingIds":[],"minNightsFloors":{}}'
          ).toString("base64")
        })
      };
    }
    return { ok: true, json: async () => ({}) };
  };
  const store = new SettingsStore({
    path: "config/properties.json",
    githubToken: "token",
    githubOwner: "owner",
    githubRepo: "repo",
    fetchImpl
  });

  const saved = await store.save({
    activeListingIds: ["68db1a47ccc0790022ab80c6", "68db1a857335e2001983e6d5"],
    minNightsFloors: {
      "68db1a857335e2001983e6d5": 2,
      "68db1a47ccc0790022ab80c6": 1
    },
    generalMinNights: {
      "68db1a857335e2001983e6d5": 4,
      "68db1a47ccc0790022ab80c6": 3
    },
    eventRules: [
      { id: "summer", name: "Summer", start: "05-25", end: "09-04" },
      { id: "thanksgiving", name: "Thanksgiving", start: "11-24", end: "11-30" }
    ],
    propertyEventMinNights: {
      "68db1a857335e2001983e6d5": { summer: 7 },
      "68db1a47ccc0790022ab80c6": { thanksgiving: 4 }
    },
    stepDownByGap: {
      "68db1a857335e2001983e6d5": true,
      "68db1a47ccc0790022ab80c6": false
    }
  });
  const update = JSON.parse(requests[1].options.body);

  assert.deepEqual(saved, {
    activeListingIds: ["68db1a47ccc0790022ab80c6", "68db1a857335e2001983e6d5"],
    minNightsFloors: {
      "68db1a47ccc0790022ab80c6": 1,
      "68db1a857335e2001983e6d5": 2
    },
    generalMinNights: {
      "68db1a47ccc0790022ab80c6": 3,
      "68db1a857335e2001983e6d5": 4
    },
    eventRules: [
      ...DEFAULT_EVENT_RULES
    ],
    propertyEventMinNights: {
      "68db1a47ccc0790022ab80c6": { thanksgiving: 4 },
      "68db1a857335e2001983e6d5": { summer: 7 }
    },
    stepDownByGap: {
      "68db1a47ccc0790022ab80c6": false,
      "68db1a857335e2001983e6d5": true
    }
  });
  assert.equal(requests[1].options.method, "PUT");
  assert.equal(update.sha, "current-sha");
  assert.deepEqual(JSON.parse(Buffer.from(update.content, "base64").toString("utf8")), saved);
});

test("ignores checkbox values that are not Guesty listing ids", async () => {
  const requests = [];
  const fetchImpl = async (url, options = {}) => {
    requests.push({ url, options });
    if (!options.method) {
      return {
        ok: true,
        json: async () => ({
          sha: "current-sha",
          content: Buffer.from(
            '{"activeListingIds":["on","68db1a857335e2001983e6d5"],"minNightsFloors":{"on":2,"68db1a857335e2001983e6d5":2},"generalMinNights":{"on":4,"68db1a857335e2001983e6d5":4},"stepDownByGap":{"on":true,"68db1a857335e2001983e6d5":true}}'
          ).toString("base64")
        })
      };
    }
    return { ok: true, json: async () => ({}) };
  };
  const store = new SettingsStore({
    path: "config/properties.json",
    githubToken: "token",
    githubOwner: "owner",
    githubRepo: "repo",
    fetchImpl
  });

  assert.deepEqual(await store.load(), {
    activeListingIds: ["68db1a857335e2001983e6d5"],
    minNightsFloors: { "68db1a857335e2001983e6d5": 2 },
    generalMinNights: { "68db1a857335e2001983e6d5": 4 },
    eventRules: DEFAULT_EVENT_RULES,
    propertyEventMinNights: { "68db1a857335e2001983e6d5": {} },
    stepDownByGap: { "68db1a857335e2001983e6d5": true }
  });
});

test("falls back to committed JSON when GitHub settings read is unauthorized", async () => {
  const store = new SettingsStore({
    path: join("config", "properties.json"),
    githubToken: "invalid-token",
    githubOwner: "owner",
    githubRepo: "repo",
    fetchImpl: async () => ({ ok: false, status: 401 })
  });
  const settings = await store.load();

  assert.ok(Array.isArray(settings.activeListingIds));
});
