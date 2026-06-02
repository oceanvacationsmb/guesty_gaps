import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const BASE_URL = "https://open-api.guesty.com/v1";
const TOKEN_URL = "https://open-api.guesty.com/oauth2/token";
const TOKEN_CACHE_PATH = resolve(".guesty-token-cache.json");

async function readCachedToken() {
  try {
    const cache = JSON.parse(await readFile(TOKEN_CACHE_PATH, "utf8"));
    return cache.expiresAt > Date.now() + 5 * 60_000 ? cache.accessToken : null;
  } catch {
    return null;
  }
}

export class GuestyClient {
  constructor({ clientId, clientSecret }) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.accessToken = null;
  }

  async getToken() {
    if (this.accessToken) return this.accessToken;

    this.accessToken = await readCachedToken();
    if (this.accessToken) return this.accessToken;

    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clientId: this.clientId,
        clientSecret: this.clientSecret
      })
    });
    const data = await response.json();
    if (!response.ok || !data.access_token) {
      throw new Error(`Guesty authentication failed (${response.status})`);
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
    const token = await this.getToken();
    const response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        accept: "application/json",
        authorization: `Bearer ${token}`,
        ...(options.body ? { "content-type": "application/json" } : {}),
        ...options.headers
      }
    });
    const text = await response.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    if (!response.ok) {
      throw new Error(`Guesty request failed (${response.status}): ${text}`);
    }
    return data;
  }

  async getListings() {
    const listings = [];
    const limit = 100;

    for (let skip = 0; ; skip += limit) {
      const page = await this.request(
        `/listings?active=true&listed=true&limit=${limit}&skip=${skip}&fields=_id%20id%20title`
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

  async openCalendarRange(listingId, startDate, endDate) {
    return this.request(`/availability-pricing/api/calendar/listings/${listingId}`, {
      method: "PUT",
      body: JSON.stringify({ startDate, endDate, status: "available" })
    });
  }
}
