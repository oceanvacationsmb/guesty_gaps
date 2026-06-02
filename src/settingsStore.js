import { readFile, writeFile } from "node:fs/promises";

export class SettingsStore {
  constructor(path, fallbackListingIds = []) {
    this.path = path;
    this.fallbackListingIds = fallbackListingIds;
  }

  async load() {
    try {
      const saved = JSON.parse(await readFile(this.path, "utf8"));
      return {
        activeListingIds: Array.isArray(saved.activeListingIds)
          ? saved.activeListingIds.map(String)
          : []
      };
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      return { activeListingIds: [...this.fallbackListingIds] };
    }
  }

  async save(activeListingIds) {
    const settings = {
      activeListingIds: [...new Set(activeListingIds.map(String))].sort()
    };
    await writeFile(this.path, JSON.stringify(settings, null, 2), "utf8");
    return settings;
  }
}
