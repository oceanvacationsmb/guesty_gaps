import { createServer } from "node:http";
import { loadConfig } from "./config.js";
import { GuestyClient } from "./guestyClient.js";
import { scanActiveListings } from "./scanner.js";
import { SettingsStore } from "./settingsStore.js";
import { propertiesPage, scanPage } from "./settingsPage.js";
import { ScanJob } from "./scanJob.js";

const config = loadConfig();
const client = new GuestyClient(config);
const store = new SettingsStore({
  path: config.settingsPath,
  githubToken: config.githubConfigToken,
  githubOwner: config.githubConfigOwner,
  githubRepo: config.githubConfigRepo,
  githubBranch: config.githubConfigBranch
});

function sendJson(response, status, body) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) body += chunk;
  return body ? JSON.parse(body) : {};
}

function authorized(request) {
  return Boolean(config.adminKey) && request.headers["x-admin-key"] === config.adminKey;
}

async function runScan() {
  const settings = await store.load();
  return scanActiveListings({ client, config, ...settings });
}

const scanJob = new ScanJob(runScan);

const server = createServer(async (request, response) => {
  try {
    if (
      request.method === "GET" &&
      ["/", "/properties"].includes(request.url)
    ) {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(propertiesPage);
      return;
    }
    if (request.method === "GET" && request.url === "/scan") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(scanPage);
      return;
    }
    if (request.method === "GET" && request.url === "/health") {
      sendJson(response, 200, { ok: true, dryRun: config.dryRun });
      return;
    }
    if (!authorized(request)) {
      sendJson(response, 401, {
        error: config.adminKey
          ? "Invalid settings admin key"
          : "Set SETTINGS_ADMIN_KEY in Render before using the settings API"
      });
      return;
    }
    if (request.method === "GET" && request.url === "/api/listings") {
      const settings = await store.load();
      const activeIds = new Set(settings.activeListingIds);
      const listings = (await client.getListings()).map((listing) => ({
        id: listing._id || listing.id,
        title:
          listing.title ||
          listing.nickname ||
          listing.nicknameForOwner ||
          listing.name,
        active: activeIds.has(listing._id || listing.id),
        minNightsFloor: settings.minNightsFloors?.[listing._id || listing.id] || 1,
        generalMinNights: settings.generalMinNights?.[listing._id || listing.id] || 3,
        eventMinNights: settings.propertyEventMinNights?.[listing._id || listing.id] || {},
        stepDownByGap: Boolean(settings.stepDownByGap?.[listing._id || listing.id])
      }));
      sendJson(response, 200, {
        listings,
        eventRules: settings.eventRules || [],
        activeCount: listings.filter((listing) => listing.active).length
      });
      return;
    }
    if (request.method === "GET" && request.url === "/api/enabled-listings") {
      const settings = await store.load();
      const activeIds = new Set(settings.activeListingIds);
      const listings = (await client.getListings())
        .map((listing) => ({
          id: listing._id || listing.id,
          title:
            listing.title ||
            listing.nickname ||
            listing.nicknameForOwner ||
            listing.name
        }))
        .filter((listing) => activeIds.has(listing.id))
        .map((listing) => ({
          ...listing,
          minNightsFloor: settings.minNightsFloors?.[listing.id] || 1,
          generalMinNights: settings.generalMinNights?.[listing.id] || 3,
          eventMinNights: settings.propertyEventMinNights?.[listing.id] || {},
          stepDownByGap: Boolean(settings.stepDownByGap?.[listing.id])
        }));
      sendJson(response, 200, { listings, eventRules: settings.eventRules || [] });
      return;
    }
    if (request.method === "PUT" && request.url === "/api/settings") {
      const body = await readJson(request);
      const settings = await store.save({
        activeListingIds: Array.isArray(body.activeListingIds)
          ? body.activeListingIds
          : [],
        minNightsFloors: body.minNightsFloors || {},
        generalMinNights: body.generalMinNights || {},
        eventRules: body.eventRules || [],
        propertyEventMinNights: body.propertyEventMinNights || {},
        stepDownByGap: body.stepDownByGap || {}
      });
      sendJson(response, 200, settings);
      return;
    }
    if (request.method === "POST" && request.url === "/api/scan") {
      sendJson(response, 202, scanJob.start());
      return;
    }
    if (request.method === "GET" && request.url === "/api/scan-status") {
      sendJson(response, 200, scanJob.getStatus());
      return;
    }
    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    console.error(error.message);
    sendJson(response, 500, { error: error.message });
  }
});

server.listen(config.port, () => {
  console.log(`Guesty gaps settings server listening on port ${config.port}`);
  if (!config.adminKey) {
    console.warn("SETTINGS_ADMIN_KEY is missing. Settings API is disabled.");
  }
});
