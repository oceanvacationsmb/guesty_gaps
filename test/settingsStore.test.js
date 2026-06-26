import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SettingsStore } from "../src/settingsStore.js";

test("loads the committed property selection JSON locally", async () => {
  const path = join("config", "properties.json");
  const store = new SettingsStore({ path });
  const committed = JSON.parse(await readFile(path, "utf8"));
  const expectedIds = [...new Set(committed.activeListingIds.map(String))].sort();
  const expectedFloors = Object.fromEntries(
    expectedIds.map((id) => [id, Number(committed.minNightsFloors?.[id] || 1)])
  );
  const expectedStepDown = Object.fromEntries(
    expectedIds.map((id) => [id, Boolean(committed.stepDownByGap?.[id])])
  );

  assert.deepEqual(await store.load(), {
    activeListingIds: expectedIds,
    minNightsFloors: expectedFloors,
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
    activeListingIds: ["listing-b", "listing-a"],
    minNightsFloors: { "listing-a": 2, "listing-b": 1 },
    stepDownByGap: { "listing-a": true, "listing-b": false }
  });
  const update = JSON.parse(requests[1].options.body);

  assert.deepEqual(saved, {
    activeListingIds: ["listing-a", "listing-b"],
    minNightsFloors: { "listing-a": 2, "listing-b": 1 },
    stepDownByGap: { "listing-a": true, "listing-b": false }
  });
  assert.equal(requests[1].options.method, "PUT");
  assert.equal(update.sha, "current-sha");
  assert.equal(
    Buffer.from(update.content, "base64").toString("utf8"),
    '{\n  "activeListingIds": [\n    "listing-a",\n    "listing-b"\n  ],\n  "minNightsFloors": {\n    "listing-a": 2,\n    "listing-b": 1\n  },\n  "stepDownByGap": {\n    "listing-a": true,\n    "listing-b": false\n  }\n}\n'
  );
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
