export class ScanJob {
  constructor(runScan) {
    this.runScan = runScan;
    this.status = { state: "idle" };
  }

  start() {
    if (this.status.state === "running") return this.status;

    this.status = { state: "running", startedAt: new Date().toISOString() };
    this.runScan()
      .then((result) => {
        this.status = {
          state: "completed",
          completedAt: new Date().toISOString(),
          result
        };
      })
      .catch((error) => {
        console.error(`Scan failed: ${error.message}`);
        this.status = {
          state: "failed",
          completedAt: new Date().toISOString(),
          error: error.message
        };
      });
    return this.status;
  }

  getStatus() {
    return this.status;
  }
}
