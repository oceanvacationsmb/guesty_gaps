import test from "node:test";
import assert from "node:assert/strict";
import { formatDateInTimeZone } from "../src/dates.js";

test("day zero uses the configured Eastern time zone", () => {
  const date = new Date("2026-06-03T01:00:00Z");
  assert.equal(formatDateInTimeZone(date, "America/New_York"), "2026-06-02");
});
