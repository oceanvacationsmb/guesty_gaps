import { createServer } from "node:http";
import { loadConfig } from "./config.js";
import { GuestyClient } from "./guestyClient.js";
import { scanActiveListings } from "./scanner.js";
import { SettingsStore } from "./settingsStore.js";
import { propertiesPage, rateSettingsPage, ratesPage, scanPage } from "./settingsPage.js";
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

function listingTitle(listing) {
  return (
    listing.title ||
    listing.nickname ||
    listing.nicknameForOwner ||
    listing.name ||
    listing._id ||
    listing.id
  );
}

function publicListing(listing) {
  return {
    id: listing._id || listing.id,
    title: listingTitle(listing)
  };
}

async function activeListingsWithRateSettings() {
  const settings = await store.load();
  const activeIds = new Set(settings.activeListingIds);
  const listings = (await client.getListings())
    .map(publicListing)
    .filter((listing) => activeIds.has(listing.id))
    .map((listing) => ({
      ...listing,
      rateCopy: settings.rateCopySettings?.[listing.id] || {
        bedroomCategory: "",
        role: "disabled",
        masterListingId: "",
        adjustmentPercent: 0
      }
    }));
  return { settings, listings };
}

function rateCopyPlan(listings) {
  const byId = new Map(listings.map((listing) => [listing.id, listing]));
  return listings
    .filter((listing) => listing.rateCopy.role === "copy")
    .map((listing) => {
      const master = byId.get(listing.rateCopy.masterListingId);
      return {
        listingId: listing.id,
        listingTitle: listing.title,
        bedroomCategory: listing.rateCopy.bedroomCategory,
        masterListingId: listing.rateCopy.masterListingId,
        masterTitle: master?.title || listing.rateCopy.masterListingId || "",
        adjustmentPercent: listing.rateCopy.adjustmentPercent,
        ready: Boolean(master)
      };
    });
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
    if (request.method === "GET" && request.url === "/rate-settings") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(rateSettingsPage);
      return;
    }
    if (request.method === "GET" && request.url === "/rates") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(ratesPage);
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
        ...publicListing(listing),
        active: activeIds.has(listing._id || listing.id),
        minNightsFloor: settings.minNightsFloors?.[listing._id || listing.id] || 1,
        generalMinNights: settings.generalMinNights?.[listing._id || listing.id] || 3,
        lastMinuteMinNights: settings.lastMinuteMinNights?.[listing._id || listing.id] || 0,
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
        .map(publicListing)
        .filter((listing) => activeIds.has(listing.id))
        .map((listing) => ({
          ...listing,
          minNightsFloor: settings.minNightsFloors?.[listing.id] || 1,
          generalMinNights: settings.generalMinNights?.[listing.id] || 3,
          lastMinuteMinNights: settings.lastMinuteMinNights?.[listing.id] || 0,
          eventMinNights: settings.propertyEventMinNights?.[listing.id] || {},
          stepDownByGap: Boolean(settings.stepDownByGap?.[listing.id])
        }));
      sendJson(response, 200, { listings, eventRules: settings.eventRules || [] });
      return;
    }
    if (request.method === "PUT" && request.url === "/api/settings") {
      const body = await readJson(request);
      const current = await store.load();
      const settings = await store.save({
        activeListingIds: Array.isArray(body.activeListingIds)
          ? body.activeListingIds
          : [],
        minNightsFloors: body.minNightsFloors || {},
        generalMinNights: body.generalMinNights || {},
        lastMinuteMinNights: body.lastMinuteMinNights || {},
        eventRules: body.eventRules || [],
        propertyEventMinNights: body.propertyEventMinNights || {},
        rateCopySettings: current.rateCopySettings || {},
        stepDownByGap: body.stepDownByGap || {}
      });
      sendJson(response, 200, settings);
      return;
    }
    if (request.method === "GET" && request.url === "/api/rate-settings") {
      const { listings } = await activeListingsWithRateSettings();
      sendJson(response, 200, { listings, plan: rateCopyPlan(listings) });
      return;
    }
    if (request.method === "PUT" && request.url === "/api/rate-settings") {
      const body = await readJson(request);
      const current = await store.load();
      const settings = await store.save({
        ...current,
        rateCopySettings: body.rateCopySettings || {}
      });
      const { listings } = await activeListingsWithRateSettings();
      sendJson(response, 200, {
        rateCopySettings: settings.rateCopySettings,
        listings,
        plan: rateCopyPlan(listings)
      });
      return;
    }
    if (request.method === "POST" && request.url === "/api/rates/preview") {
      const { listings } = await activeListingsWithRateSettings();
      sendJson(response, 200, {
        dryRun: true,
        message: "Rate copy is preview only. No Guesty rates were changed.",
        plan: rateCopyPlan(listings)
      });
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
