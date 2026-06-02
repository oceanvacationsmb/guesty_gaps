import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { SettingsStore } from "../src/settingsStore.js";

test("loads the committed property selection JSON locally", async () => {
  const store = new SettingsStore({
    path: join("config", "properties.json")
  });

  assert.deepEqual(await store.load(), { activeListingIds: [] });
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
          content: Buffer.from('{"activeListingIds":[]}').toString("base64")
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

  const saved = await store.save(["listing-b", "listing-a"]);
  const update = JSON.parse(requests[1].options.body);

  assert.deepEqual(saved.activeListingIds, ["listing-a", "listing-b"]);
  assert.equal(requests[1].options.method, "PUT");
  assert.equal(update.sha, "current-sha");
  assert.equal(
    Buffer.from(update.content, "base64").toString("utf8"),
    '{\n  "activeListingIds": [\n    "listing-a",\n    "listing-b"\n  ]\n}\n'
  );
});
