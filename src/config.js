function numberFromEnv(name, fallback) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

export function loadConfig() {
  const clientId = String(process.env.GUESTY_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.GUESTY_CLIENT_SECRET || "").trim();

  if (!clientId || !clientSecret) {
    throw new Error("Set GUESTY_CLIENT_ID and GUESTY_CLIENT_SECRET");
  }

  return {
    clientId,
    clientSecret,
    dryRun: String(process.env.DRY_RUN || "true").toLowerCase() !== "false",
    scanDays: numberFromEnv("SCAN_DAYS", 180),
    timeZone: String(process.env.APP_TIME_ZONE || "America/New_York").trim(),
    maxLiveUpdates: numberFromEnv("MAX_LIVE_UPDATES", 1),
    adminKey: String(process.env.SETTINGS_ADMIN_KEY || "").trim(),
    settingsPath: String(
      process.env.SETTINGS_PATH || "config/properties.json"
    ).trim(),
    githubConfigToken: String(process.env.GITHUB_CONFIG_TOKEN || "").trim(),
    githubConfigOwner: String(
      process.env.GITHUB_CONFIG_OWNER || "oceanvacationsmb"
    ).trim(),
    githubConfigRepo: String(
      process.env.GITHUB_CONFIG_REPO || "guesty_gaps"
    ).trim(),
    githubConfigBranch: String(
      process.env.GITHUB_CONFIG_BRANCH || "main"
    ).trim(),
    port: Number(process.env.PORT || 3000)
  };
}
