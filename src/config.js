function numberFromEnv(name, fallback) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function csv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
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
    maxGapNights: numberFromEnv("MAX_GAP_NIGHTS", 14),
    listingIds: csv(process.env.LISTING_IDS),
    openableBlockTypes: new Set(csv(process.env.OPENABLE_BLOCK_TYPES || "m"))
  };
}
