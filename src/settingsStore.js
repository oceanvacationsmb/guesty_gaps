import { readFile } from "node:fs/promises";

const LISTING_ID_PATTERN = /^[0-9a-fA-F]{24}$/;
const EVENT_ID_PATTERN = /^[a-z0-9-]+$/;
const DATE_PART_PATTERN = /^\d{2}-\d{2}$/;
const DEFAULT_EVENT_RULES = [
  { id: "off-season", name: "Off Season", start: "09-02", end: "02-28" },
  { id: "bike-week", name: "Bike Week", start: "05-08", end: "05-17" },
  { id: "easter", name: "Easter", start: "03-20", end: "04-20" },
  { id: "memorial", name: "Memorial", start: "05-20", end: "05-31" },
  { id: "summer", name: "Summer", start: "05-25", end: "09-04" },
  { id: "thanksgiving", name: "Thanksgiving", start: "11-24", end: "11-30" },
  { id: "christmas", name: "Christmas/New Year", start: "12-23", end: "12-31" }
];

function normalizeEventRules(input) {
  const rawRules = Array.isArray(input) ? [] : input?.eventRules || [];
  const byId = new Map(DEFAULT_EVENT_RULES.map((rule) => [rule.id, rule]));

  for (const rawRule of rawRules) {
    const id = String(rawRule?.id || "").trim();
    if (!EVENT_ID_PATTERN.test(id)) continue;
    const fallback = byId.get(id) || {
      id,
      name: id,
      start: "01-01",
      end: "12-31"
    };
    byId.set(id, {
      id,
      name: String(rawRule?.name || fallback.name).trim() || fallback.name,
      start: DATE_PART_PATTERN.test(String(rawRule?.start || ""))
        ? String(rawRule.start)
        : fallback.start,
      end: DATE_PART_PATTERN.test(String(rawRule?.end || ""))
        ? String(rawRule.end)
        : fallback.end
    });
  }

  return [...byId.values()];
}

function normalize(input) {
  const activeListingIds = Array.isArray(input)
    ? input
    : input?.activeListingIds || [];
  const rawFloors = Array.isArray(input) ? {} : input?.minNightsFloors || {};
  const rawGeneral = Array.isArray(input) ? {} : input?.generalMinNights || {};
  const rawStepDown = Array.isArray(input) ? {} : input?.stepDownByGap || {};
  const rawPropertyEvents = Array.isArray(input)
    ? {}
    : input?.propertyEventMinNights || {};
  const eventRules = normalizeEventRules(input);
  const eventIds = new Set(eventRules.map((rule) => rule.id));
  const normalizedIds = [
    ...new Set(activeListingIds.map(String).filter((id) => LISTING_ID_PATTERN.test(id)))
  ].sort();
  const minNightsFloors = {};
  const generalMinNights = {};
  const stepDownByGap = {};
  const propertyEventMinNights = {};

  for (const id of normalizedIds) {
    const floorValue = Number(rawFloors[id] || 1);
    const floor =
      Number.isInteger(floorValue) && floorValue > 0 ? floorValue : 1;
    const generalValue = Number(rawGeneral[id] || 3);
    const general =
      Number.isInteger(generalValue) && generalValue > 0 ? generalValue : 3;
    minNightsFloors[id] = floor;
    generalMinNights[id] = Math.max(floor, general);
    stepDownByGap[id] = Boolean(rawStepDown[id]);
    propertyEventMinNights[id] = {};
    for (const eventId of eventIds) {
      const value = Number(rawPropertyEvents[id]?.[eventId] || 0);
      if (Number.isInteger(value) && value > 0) {
        propertyEventMinNights[id][eventId] = value;
      }
    }
  }

  return {
    activeListingIds: normalizedIds,
    minNightsFloors,
    generalMinNights,
    eventRules,
    propertyEventMinNights,
    stepDownByGap
  };
}

function decodeContent(content) {
  return JSON.parse(Buffer.from(content, "base64").toString("utf8"));
}

export class SettingsStore {
  constructor({
    path,
    githubToken = "",
    githubOwner = "",
    githubRepo = "",
    githubBranch = "main",
    fetchImpl = fetch
  }) {
    this.path = path;
    this.githubToken = githubToken;
    this.githubOwner = githubOwner;
    this.githubRepo = githubRepo;
    this.githubBranch = githubBranch;
    this.fetch = fetchImpl;
    this.cachedSettings = null;
  }

  githubUrl() {
    return `https://api.github.com/repos/${this.githubOwner}/${this.githubRepo}/contents/${this.path}`;
  }

  githubHeaders() {
    return {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${this.githubToken}`,
      "x-github-api-version": "2022-11-28"
    };
  }

  async readGithubFile() {
    const response = await this.fetch(
      `${this.githubUrl()}?ref=${encodeURIComponent(this.githubBranch)}`,
      { headers: this.githubHeaders() }
    );
    if (!response.ok) {
      throw new Error(`GitHub settings read failed (${response.status})`);
    }
    return response.json();
  }

  async load() {
    if (this.cachedSettings) return this.cachedSettings;

    if (this.githubToken) {
      try {
        const file = await this.readGithubFile();
        this.cachedSettings = normalize(decodeContent(file.content));
        return this.cachedSettings;
      } catch (error) {
        console.warn(`${error.message}. Loading committed local settings instead.`);
      }
    }

    const saved = JSON.parse(await readFile(this.path, "utf8"));
    this.cachedSettings = normalize(saved);
    return this.cachedSettings;
  }

  async save(settingsInput) {
    if (!this.githubToken) {
      throw new Error(
        "Set GITHUB_CONFIG_TOKEN in Render before saving property settings"
      );
    }

    const settings = normalize(settingsInput);
    const currentFile = await this.readGithubFile();
    const response = await this.fetch(this.githubUrl(), {
      method: "PUT",
      headers: {
        ...this.githubHeaders(),
        "content-type": "application/json"
      },
      body: JSON.stringify({
        message: "Update active Guesty gap properties",
        content: Buffer.from(`${JSON.stringify(settings, null, 2)}\n`).toString(
          "base64"
        ),
        sha: currentFile.sha,
        branch: this.githubBranch
      })
    });
    if (!response.ok) {
      throw new Error(`GitHub settings save failed (${response.status})`);
    }

    this.cachedSettings = settings;
    return settings;
  }
}
