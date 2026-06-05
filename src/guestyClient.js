import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const BASE_URL = "https://open-api.guesty.com/v1";
const TOKEN_URL = "https://open-api.guesty.com/oauth2/token";
const TOKEN_CACHE_PATH = resolve(".guesty-token-cache.json");
const MAX_RATE_LIMIT_RETRIES = 5;

function sleep(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

function retryAfterMs(response, attempt) {
  const retryAfter = response.headers.get("retry-after");
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;

  const retryDate = Date.parse(retryAfter);
  if (Number.isFinite(retryDate)) return Math.max(0, retryDate - Date.now());

  return Math.min(30_000, 1000 * 2 ** attempt);
}

async function readCachedToken() {
  try {
    const cache = JSON.parse(await readFile(TOKEN_CACHE_PATH, "utf8"));
    return cache.expiresAt > Date.now() + 5 * 60_000 ? cache.accessToken : null;
  } catch {
    return null;
  }
}

export class GuestyClient {
  constructor({
    clientId,
    clientSecret,
    guestyRequestDelayMs = 800,
    fetchImpl = fetch,
    sleepImpl = sleep
  }) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.requestDelayMs = guestyRequestDelayMs;
    this.fetch = fetchImpl;
    this.sleep = sleepImpl;
    this.accessToken = null;
    this.lastRequestAt = 0;
    this.requestQueue = Promise.resolve();
  }

  async getToken() {
    if (this.accessToken) return this.accessToken;

    this.accessToken = await readCachedToken();
    if (this.accessToken) return this.accessToken;

    const response = await this.fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        scope: "open-api",
        client_id: this.clientId,
        client_secret: this.clientSecret
      })
    });
    const text = await response.text();
    let data = {};
    try {
      data = JSON.parse(text);
    } catch {
      // Keep the raw response available in the error below.
    }
    if (!response.ok || !data.access_token) {
      throw new Error(
        `Guesty authentication failed (${response.status}): ${text || "empty response"}`
      );
    }

    this.accessToken = data.access_token;
    await writeFile(
      TOKEN_CACHE_PATH,
      JSON.stringify({
        accessToken: this.accessToken,
        expiresAt: Date.now() + Number(data.expires_in || 86_400) * 1000
      }),
      { encoding: "utf8", mode: 0o600 }
    );
    return this.accessToken;
  }

  async request(path, options = {}) {
    const task = this.requestQueue.then(() => this.sendRequest(path, options));
    this.requestQueue = task.catch(() => {});
    return task;
  }

  async paceRequest() {
    const waitMs = this.requestDelayMs - (Date.now() - this.lastRequestAt);
    if (waitMs > 0) await this.sleep(waitMs);
  }

  async sendRequest(path, options = {}) {
    const token = await this.getToken();
    for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt += 1) {
      await this.paceRequest();
      const response = await this.fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: {
          accept: "application/json",
          authorization: `Bearer ${token}`,
          ...(options.body ? { "content-type": "application/json" } : {}),
          ...options.headers
        }
      });
      this.lastRequestAt = Date.now();
      const text = await response.text();
      let data = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }
      if (response.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
        const waitMs = retryAfterMs(response, attempt);
        console.warn(`Guesty rate limit reached. Retrying in ${waitMs}ms.`);
        await this.sleep(waitMs);
        continue;
      }
      if (!response.ok) {
        throw new Error(`Guesty request failed (${response.status}): ${text}`);
      }
      return data;
    }
  }

  async getListings() {
    const listings = [];
    const limit = 100;

    for (let skip = 0; ; skip += limit) {
      const page = await this.request(
        `/listings?active=true&listed=true&limit=${limit}&skip=${skip}&fields=_id%20id%20title%20nickname%20nicknameForOwner%20name`
      );
      const results = page.results || [];
      listings.push(...results);
      if (results.length < limit) return listings;
    }
  }

  async getCalendar(listingId, startDate, endDate) {
    const query = new URLSearchParams({ startDate, endDate, includeAllotment: "true" });
    return this.request(
      `/availability-pricing/api/calendar/listings/${listingId}?${query}`
    );
  }

  async getCalendars(listingIds, startDate, endDate) {
    if (!listingIds.length) return [];

    const query = new URLSearchParams({
      listingIds: listingIds.join(","),
      startDate,
      endDate,
      ignoreInactiveChildAllotment: "true",
      useChildValues: "true"
    });
    return this.request(`/availability-pricing/api/calendar/listings?${query}`);
  }

  async setMinNights(listingId, date, minNights) {
    return this.request(`/availability-pricing/api/calendar/listings/${listingId}`, {
      method: "PUT",
      body: JSON.stringify({ startDate: date, endDate: date, minNights })
    });
  }

  async setMinNightsBulk(listingId, adjustments) {
    if (!adjustments.length) return null;

    return this.request("/availability-pricing/api/calendar/listings", {
      method: "PUT",
      body: JSON.stringify(
        adjustments.map(({ date, toMinNights }) => ({
          listingId,
          startDate: date,
          endDate: date,
          minNights: toMinNights
        }))
      )
    });
  }
}
