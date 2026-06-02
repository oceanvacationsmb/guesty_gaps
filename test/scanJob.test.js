import test from "node:test";
import assert from "node:assert/strict";
import { ScanJob } from "../src/scanJob.js";

test("starts a scan in the background and reports completion", async () => {
  let finish;
  const job = new ScanJob(
    () => new Promise((resolve) => {
      finish = resolve;
    })
  );

  assert.equal(job.start().state, "running");
  assert.equal(job.start().state, "running");
  finish({ appliedCount: 3 });
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(job.getStatus().state, "completed");
  assert.equal(job.getStatus().result.appliedCount, 3);
});
