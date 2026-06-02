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
