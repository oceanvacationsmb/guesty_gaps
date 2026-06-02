import { readFile } from "node:fs/promises";

function normalize(activeListingIds) {
  return {
    activeListingIds: [...new Set(activeListingIds.map(String))].sort()
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
      const file = await this.readGithubFile();
      this.cachedSettings = normalize(decodeContent(file.content).activeListingIds || []);
      return this.cachedSettings;
    }

    const saved = JSON.parse(await readFile(this.path, "utf8"));
    this.cachedSettings = normalize(saved.activeListingIds || []);
    return this.cachedSettings;
  }

  async save(activeListingIds) {
    if (!this.githubToken) {
      throw new Error(
        "Set GITHUB_CONFIG_TOKEN in Render before saving property settings"
      );
    }

    const settings = normalize(activeListingIds);
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
