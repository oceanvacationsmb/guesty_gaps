import test from "node:test";
import assert from "node:assert/strict";
import { GuestyClient } from "../src/guestyClient.js";

function response(status, body, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers[name.toLowerCase()] || null },
    text: async () => JSON.stringify(body)
  };
}

test("retries a Guesty request after a 429 response", async () => {
  const waits = [];
  const responses = [
    response(429, { message: "slow down" }, { "retry-after": "2" }),
    response(200, { ok: true })
  ];
  const client = new GuestyClient({
    clientId: "id",
    clientSecret: "secret",
    guestyRequestDelayMs: 1,
    fetchImpl: async () => responses.shift(),
    sleepImpl: async (milliseconds) => waits.push(milliseconds)
  });
  client.accessToken = "cached-token";

  assert.deepEqual(await client.request("/test"), { ok: true });
  assert.equal(waits.includes(2000), true);
});

test("fetches multiple listing calendars in one Guesty request", async () => {
  let requestedUrl = "";
  const client = new GuestyClient({
    clientId: "id",
    clientSecret: "secret",
    guestyRequestDelayMs: 1,
    fetchImpl: async (url) => {
      requestedUrl = url;
      return response(200, { data: { days: [] } });
    },
    sleepImpl: async () => {}
  });
  client.accessToken = "cached-token";

  await client.getCalendars(["listing-a", "listing-b"], "2026-06-02", "2026-11-29");

  const url = new URL(requestedUrl);
  assert.equal(url.pathname, "/v1/availability-pricing/api/calendar/listings");
  assert.equal(url.searchParams.get("listingIds"), "listing-a,listing-b");
  assert.equal(url.searchParams.get("useChildValues"), "true");
});

test("updates multiple minimum-night dates for one listing in one request", async () => {
  let requestOptions;
  const client = new GuestyClient({
    clientId: "id",
    clientSecret: "secret",
    guestyRequestDelayMs: 1,
    fetchImpl: async (_url, options) => {
      requestOptions = options;
      return response(200, { ok: true });
    },
    sleepImpl: async () => {}
  });
  client.accessToken = "cached-token";

  await client.setMinNightsBulk("listing-a", [
    { date: "2026-06-09", toMinNights: 2 },
    { date: "2026-06-10", toMinNights: 1 }
  ]);

  assert.equal(requestOptions.method, "PUT");
  assert.deepEqual(JSON.parse(requestOptions.body), [
    {
      listingId: "listing-a",
      startDate: "2026-06-09",
      endDate: "2026-06-09",
      minNights: 2
    },
    {
      listingId: "listing-a",
      startDate: "2026-06-10",
      endDate: "2026-06-10",
      minNights: 1
    }
  ]);
});

test("updates multiple rate dates for one listing with price only", async () => {
  let requestOptions;
  const client = new GuestyClient({
    clientId: "id",
    clientSecret: "secret",
    guestyRequestDelayMs: 1,
    fetchImpl: async (_url, options) => {
      requestOptions = options;
      return response(200, { ok: true });
    },
    sleepImpl: async () => {}
  });
  client.accessToken = "cached-token";

  await client.setRatesBulk("listing-a", [
    { date: "2026-07-20", toPrice: 220 },
    { date: "2026-07-21", toPrice: 230 }
  ]);

  assert.equal(requestOptions.method, "PUT");
  assert.deepEqual(JSON.parse(requestOptions.body), [
    {
      listingId: "listing-a",
      startDate: "2026-07-20",
      endDate: "2026-07-20",
      price: 220
    },
    {
      listingId: "listing-a",
      startDate: "2026-07-21",
      endDate: "2026-07-21",
      price: 230
    }
  ]);
});
