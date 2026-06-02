import test from "node:test";
import assert from "node:assert/strict";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SettingsStore } from "../src/settingsStore.js";

test("saved property selection is loaded by a fresh settings store", async () => {
  const path = join(tmpdir(), `guesty-gaps-settings-${Date.now()}.json`);

  try {
    await new SettingsStore(path).save(["listing-b", "listing-a"]);
    const settings = await new SettingsStore(path).load();

    assert.deepEqual(settings.activeListingIds, ["listing-a", "listing-b"]);
  } finally {
    await unlink(path).catch(() => {});
  }
});
