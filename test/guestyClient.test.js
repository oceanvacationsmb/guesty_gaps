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
