const styles = `
  body { font: 16px Arial, sans-serif; max-width: 980px; margin: 40px auto; padding: 0 18px; color: #15243b; }
  h1 { margin-bottom: 8px; }
  nav { display: flex; gap: 10px; margin: 20px 0; }
  nav a { color: #153d6f; font-weight: bold; text-decoration: none; padding: 9px 12px; border: 1px solid #b6c5d7; border-radius: 5px; }
  nav a.active { color: white; background: #153d6f; }
  .row { display: flex; gap: 10px; margin: 16px 0; flex-wrap: wrap; align-items: center; }
  input[type=password] { min-width: 280px; padding: 10px; }
  input[type=number] { width: 72px; padding: 8px; }
  select { padding: 8px; max-width: 280px; }
  button { padding: 11px 15px; cursor: pointer; font-weight: bold; }
  .primary { color: white; background: #153d6f; border: 1px solid #153d6f; border-radius: 5px; }
  .toggle-active { min-width: 96px; }
  .listing { display: flex; gap: 10px; padding: 11px 4px; border-bottom: 1px solid #ddd; }
  .listing.inactive { opacity: 0.78; }
  .event-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
  .event-chip { border: 1px solid #ccd6e2; border-radius: 5px; padding: 5px 7px; white-space: nowrap; }
  .event-chip input[type=number] { width: 52px; padding: 4px; }
  .event-rules { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 8px; margin: 12px 0; }
  .event-rule { border: 1px solid #ccd6e2; border-radius: 5px; padding: 8px; }
  .event-rule input[type=text] { width: 88px; padding: 6px; }
  .separator { margin: 22px 0 8px; font-weight: bold; color: #44546a; }
  .panel { padding: 16px; background: #f4f7fa; border-radius: 5px; }
  .success { color: #17643a; background: #e9f7ef; }
  .error { color: #9e251d; background: #fbeceb; }
  .results { margin-top: 18px; border: 1px solid #d5dee8; border-radius: 6px; overflow: hidden; }
  .result-row { padding: 12px 14px; border-bottom: 1px solid #d5dee8; }
  .result-row:last-child { border-bottom: 0; }
  .result-title { display: flex; justify-content: space-between; gap: 12px; font-weight: bold; }
  .result-details { margin: 8px 0 0; color: #44546a; }
  #status { white-space: pre-wrap; }
`;

const scriptHelpers = `
  const keyInput = document.getElementById("key");
  const status = document.getElementById("status");
  keyInput.value = sessionStorage.getItem("guestyAdminKey") || "";
  const headers = () => ({ "content-type": "application/json", "x-admin-key": keyInput.value });
  async function api(path, options = {}) {
    sessionStorage.setItem("guestyAdminKey", keyInput.value);
    const response = await fetch(path, { ...options, headers: headers() });
    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error("Render returned an HTML page instead of API data. Wait for deployment to finish and try again.");
    }
    if (!response.ok) throw new Error(data.error || "Request failed");
    return data;
  }
      function show(message, type = "") {
        status.className = "panel " + type;
        status.textContent = message;
      }
      function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, (char) => ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;"
        }[char]));
      }
      function eventSummary(eventMinNights, eventRules) {
        const enabled = eventRules
          .filter((rule) => Number(eventMinNights?.[rule.id] || 0) > 0)
          .map((rule) => rule.name + " " + eventMinNights[rule.id]);
        return enabled.length ? " - events: " + enabled.join(", ") : "";
      }
      function rateSummary(item) {
        const sign = Number(item.adjustmentPercent || 0) > 0 ? "+" : "";
        return escapeHtml(item.listingTitle) + " copies from " +
          escapeHtml(item.masterTitle || item.masterListingId || "missing master") +
          " (" + escapeHtml(item.bedroomCategory || "no category") + ", " +
          sign + escapeHtml(item.adjustmentPercent || 0) + "%)";
      }
`;

export const propertiesPage = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Property Settings</title>
    <style>${styles}</style>
  </head>
  <body>
    <h1>Property Settings</h1>
    <p>Enable properties and choose the normal rule plus the lowest gap minimum. Step-down gaps will never go above the general minimum or below the gap minimum.</p>
    <nav>
      <a class="active" href="/properties">Property Settings</a>
      <a href="/scan">Scan &amp; Adjust</a>
      <a href="/rate-settings">Rate Settings</a>
      <a href="/rates">Copy Rates</a>
    </nav>
    <div class="row">
      <input id="key" type="password" placeholder="Settings admin key">
      <button onclick="loadListings()">Load properties</button>
      <button class="primary" onclick="save()">Save selection</button>
    </div>
    <div id="status" class="panel">Enter your admin key and load properties.</div>
    <div id="listings"></div>
    <script>
      ${scriptHelpers}
      async function loadListings() {
        try {
          const data = await api("/api/listings");
          const eventRules = data.eventRules || [];
          const eventRuleEditor = '<h3>Event Settings</h3><p>These date windows repeat every year. Use MM-DD format.</p><div class="event-rules">' +
            eventRules.map((rule) =>
              '<div class="event-rule"><strong>' + escapeHtml(rule.name) + '</strong><br>' +
              '<input class="event-name" type="hidden" value="' + escapeHtml(rule.name) + '" data-event-id="' + escapeHtml(rule.id) + '">' +
              '<input class="event-type" type="hidden" value="' + escapeHtml(rule.type || "fixed") + '" data-event-id="' + escapeHtml(rule.id) + '">' +
              (rule.type === "labor-day"
                ? '<span>Automatic: Thursday-Sunday before the first Monday in September.</span><input class="event-start" type="hidden" value="" data-event-id="' + escapeHtml(rule.id) + '"><input class="event-end" type="hidden" value="" data-event-id="' + escapeHtml(rule.id) + '">'
                : 'Start <input class="event-start" type="text" value="' + escapeHtml(rule.start) + '" data-event-id="' + escapeHtml(rule.id) + '"> ' +
                  'End <input class="event-end" type="text" value="' + escapeHtml(rule.end) + '" data-event-id="' + escapeHtml(rule.id) + '">') +
              '</div>'
            ).join("") + '</div>';
          function listingRow(listing) {
            const enabledEventCount = eventRules.filter((rule) => Number(listing.eventMinNights?.[rule.id] || 0) > 0).length;
            const eventInputs = eventRules.map((rule) => {
              const value = Number(listing.eventMinNights?.[rule.id] || 0);
              return '<span class="event-chip"><input class="event-enabled" type="checkbox" onchange="syncAllEventsCheckbox(\\'' + escapeHtml(listing.id) + '\\')" data-listing-id="' + escapeHtml(listing.id) + '" data-event-id="' + escapeHtml(rule.id) + '"' + (value > 0 ? ' checked' : '') + '> ' +
                escapeHtml(rule.name) + ' <input class="event-min" type="number" min="1" max="30" value="' + escapeHtml(value || listing.generalMinNights || 3) + '" data-listing-id="' + escapeHtml(listing.id) + '" data-event-id="' + escapeHtml(rule.id) + '"></span>';
            }).join("");
            return '<div class="listing' + (listing.active ? '' : ' inactive') + '" data-listing-id="' + escapeHtml(listing.id) + '">' +
              '<button class="toggle-active" type="button" onclick="setListingActive(\\'' + escapeHtml(listing.id) + '\\', ' + (listing.active ? 'false' : 'true') + ')">' + (listing.active ? 'Deactivate' : 'Activate') + '</button>' +
              '<input class="active-listing" type="checkbox" value="' + listing.id + '"' + (listing.active ? ' checked' : '') + ' hidden> ' +
              '<div style="flex:1"><div><strong>' + escapeHtml(listing.title || listing.id) + '</strong> <small>(' + escapeHtml(listing.id) + ')</small></div>' +
              '<div class="row"><span>General min nights: <input class="general" type="number" min="1" max="30" value="' + escapeHtml(listing.generalMinNights || 3) + '" data-listing-id="' + escapeHtml(listing.id) + '"></span>' +
              '<span>Gap min nights: <input class="floor" type="number" min="1" max="30" value="' + escapeHtml(listing.minNightsFloor || 1) + '" data-listing-id="' + escapeHtml(listing.id) + '"></span>' +
              '<span>Last min gap: <input class="last-minute" type="number" min="0" max="30" value="' + escapeHtml(listing.lastMinuteMinNights || 0) + '" data-listing-id="' + escapeHtml(listing.id) + '"> <small>next 10 days</small></span>' +
              '<span><input class="step-down" type="checkbox" data-listing-id="' + escapeHtml(listing.id) + '"' + (listing.stepDownByGap ? ' checked' : '') + '> Step down gaps</span></div>' +
              '<div class="event-list"><span class="event-chip"><input class="event-all" type="checkbox" onchange="toggleAllEvents(\\'' + escapeHtml(listing.id) + '\\', this.checked)" data-listing-id="' + escapeHtml(listing.id) + '"' + (eventRules.length && enabledEventCount === eventRules.length ? ' checked' : '') + '> All events</span>' + eventInputs + '</div></div></div>';
          }
          const activeListings = data.listings.filter((listing) => listing.active);
          const inactiveListings = data.listings.filter((listing) => !listing.active);
          document.getElementById("listings").innerHTML =
            eventRuleEditor +
            '<div class="separator">Active properties</div>' +
            '<div id="active-listings">' + activeListings.map(listingRow).join("") + '</div>' +
            '<p id="no-active"' + (activeListings.length ? ' hidden' : '') + '>No active properties selected.</p>' +
            '<div class="separator">Inactive properties</div>' +
            '<div id="inactive-listings">' + inactiveListings.map(listingRow).join("") + '</div>';
          show(data.listings.length + " properties loaded. " + data.activeCount + " enabled.");
        } catch (error) { show(error.message, "error"); }
      }
      function setListingActive(id, active) {
        const row = document.querySelector('.listing[data-listing-id="' + CSS.escape(id) + '"]');
        if (!row) return;
        const input = row.querySelector(".active-listing");
        const button = row.querySelector(".toggle-active");
        input.checked = active;
        row.classList.toggle("inactive", !active);
        button.textContent = active ? "Deactivate" : "Activate";
        button.setAttribute("onclick", "setListingActive('" + id.replace(/'/g, "\\\\'") + "', " + (!active) + ")");
        document.getElementById(active ? "active-listings" : "inactive-listings").appendChild(row);
        const hasActive = document.querySelectorAll("#active-listings .listing").length > 0;
        document.getElementById("no-active").hidden = hasActive;
      }
      function selectedIds() {
        return [...document.querySelectorAll("input.active-listing:checked")].map((input) => input.value);
      }
      function minNightsFloors() {
        const floors = {};
        for (const id of selectedIds()) {
          const input = document.querySelector('.floor[data-listing-id="' + CSS.escape(id) + '"]');
          floors[id] = Math.max(1, Number(input?.value || 1));
        }
        return floors;
      }
      function generalMinNights() {
        const values = {};
        for (const id of selectedIds()) {
          const input = document.querySelector('.general[data-listing-id="' + CSS.escape(id) + '"]');
          values[id] = Math.max(1, Number(input?.value || 3));
        }
        return values;
      }
      function stepDownByGap() {
        const values = {};
        for (const id of selectedIds()) {
          const input = document.querySelector('.step-down[data-listing-id="' + CSS.escape(id) + '"]');
          values[id] = Boolean(input?.checked);
        }
        return values;
      }
      function lastMinuteMinNights() {
        const values = {};
        for (const id of selectedIds()) {
          const input = document.querySelector('.last-minute[data-listing-id="' + CSS.escape(id) + '"]');
          values[id] = Math.max(0, Number(input?.value || 0));
        }
        return values;
      }
      function toggleAllEvents(id, checked) {
        for (const input of document.querySelectorAll('.event-enabled[data-listing-id="' + CSS.escape(id) + '"]')) {
          input.checked = checked;
        }
      }
      function syncAllEventsCheckbox(id) {
        const inputs = [...document.querySelectorAll('.event-enabled[data-listing-id="' + CSS.escape(id) + '"]')];
        const allInput = document.querySelector('.event-all[data-listing-id="' + CSS.escape(id) + '"]');
        if (allInput) allInput.checked = inputs.length > 0 && inputs.every((input) => input.checked);
      }
      function eventRules() {
        return [...document.querySelectorAll(".event-start")].map((input) => {
          const id = input.dataset.eventId;
          const name = document.querySelector('.event-name[data-event-id="' + CSS.escape(id) + '"]')?.value || id;
          const type = document.querySelector('.event-type[data-event-id="' + CSS.escape(id) + '"]')?.value || "fixed";
          const end = document.querySelector('.event-end[data-event-id="' + CSS.escape(id) + '"]')?.value || "12-31";
          return { id, name, type, start: input.value || "01-01", end };
        });
      }
      function propertyEventMinNights() {
        const values = {};
        for (const id of selectedIds()) {
          values[id] = {};
          for (const input of document.querySelectorAll('.event-enabled[data-listing-id="' + CSS.escape(id) + '"]:checked')) {
            const eventId = input.dataset.eventId;
            const minInput = document.querySelector('.event-min[data-listing-id="' + CSS.escape(id) + '"][data-event-id="' + CSS.escape(eventId) + '"]');
            values[id][eventId] = Math.max(1, Number(minInput?.value || 1));
          }
        }
        return values;
      }
      async function save() {
        try {
          const data = await api("/api/settings", { method: "PUT", body: JSON.stringify({ activeListingIds: selectedIds(), minNightsFloors: minNightsFloors(), generalMinNights: generalMinNights(), lastMinuteMinNights: lastMinuteMinNights(), eventRules: eventRules(), propertyEventMinNights: propertyEventMinNights(), stepDownByGap: stepDownByGap() }) });
          show("PROPERTY SETTINGS SAVED SUCCESSFULLY. " + data.activeListingIds.length + " properties enabled.", "success");
        } catch (error) { show(error.message, "error"); }
      }
      if (keyInput.value) loadListings();
    </script>
  </body>
</html>`;

export const rateSettingsPage = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Rate Copy Settings</title>
    <style>${styles}</style>
  </head>
  <body>
    <h1>Rate Copy Settings</h1>
    <p>Choose rate masters and copy targets. This page only shows properties already active in the scanner.</p>
    <nav>
      <a href="/properties">Property Settings</a>
      <a href="/scan">Scan &amp; Adjust</a>
      <a class="active" href="/rate-settings">Rate Settings</a>
      <a href="/rates">Copy Rates</a>
    </nav>
    <div class="row">
      <input id="key" type="password" placeholder="Settings admin key">
      <button onclick="loadRateSettings()">Load rate settings</button>
      <button class="primary" onclick="saveRateSettings()">Save rate settings</button>
    </div>
    <div id="status" class="panel">Enter your admin key and load rate settings.</div>
    <div id="listings"></div>
    <script>
      ${scriptHelpers}
      const categories = ["", "1BR", "2BR", "3BR", "4BR", "5BR", "6BR", "7BR"];
      let activeRateListings = [];
      async function loadRateSettings() {
        try {
          const data = await api("/api/rate-settings");
          activeRateListings = data.listings || [];
          renderRateSettings(activeRateListings);
          show(activeRateListings.length + " scanner-active properties loaded for rate settings.");
        } catch (error) { show(error.message, "error"); }
      }
      function option(value, label, selectedValue) {
        return '<option value="' + escapeHtml(value) + '"' + (value === selectedValue ? ' selected' : '') + '>' + escapeHtml(label) + '</option>';
      }
      function renderRateSettings(listings) {
        if (!listings.length) {
          document.getElementById("listings").innerHTML = '<p>No scanner-active properties. Activate properties on Property Settings first.</p>';
          return;
        }
        const masterOptions = (selected) =>
          option("", "Choose master", selected) +
          listings.map((listing) => option(listing.id, listing.title, selected)).join("");
        const rows = listings.map((listing) => {
          const setting = listing.rateCopy || {};
          return '<div class="listing" data-listing-id="' + escapeHtml(listing.id) + '">' +
            '<div style="flex:1"><div><strong>' + escapeHtml(listing.title || listing.id) + '</strong> <small>(' + escapeHtml(listing.id) + ')</small></div>' +
            '<div class="row">' +
            '<span>Category: <select class="rate-category" data-listing-id="' + escapeHtml(listing.id) + '">' +
              categories.map((category) => option(category, category || "No category", setting.bedroomCategory || "")).join("") +
            '</select></span>' +
            '<span>Role: <select class="rate-role" onchange="syncRateRow(\\'' + escapeHtml(listing.id) + '\\')" data-listing-id="' + escapeHtml(listing.id) + '">' +
              option("disabled", "Do not copy rates", setting.role || "disabled") +
              option("master", "Master", setting.role || "disabled") +
              option("copy", "Copy from master", setting.role || "disabled") +
            '</select></span>' +
            '<span>Copy from: <select class="rate-master" data-listing-id="' + escapeHtml(listing.id) + '">' + masterOptions(setting.masterListingId || "") + '</select></span>' +
            '<span>Adjust %: <input class="rate-adjustment" type="number" step="0.01" min="-100" max="300" value="' + escapeHtml(setting.adjustmentPercent || 0) + '" data-listing-id="' + escapeHtml(listing.id) + '"></span>' +
            '</div></div></div>';
        }).join("");
        document.getElementById("listings").innerHTML = rows;
        for (const listing of listings) syncRateRow(listing.id);
      }
      function syncRateRow(id) {
        const role = document.querySelector('.rate-role[data-listing-id="' + CSS.escape(id) + '"]')?.value || "disabled";
        const master = document.querySelector('.rate-master[data-listing-id="' + CSS.escape(id) + '"]');
        const adjustment = document.querySelector('.rate-adjustment[data-listing-id="' + CSS.escape(id) + '"]');
        if (master) master.disabled = role !== "copy";
        if (adjustment) adjustment.disabled = role !== "copy";
      }
      function rateCopySettings() {
        const values = {};
        for (const listing of activeRateListings) {
          const id = listing.id;
          const category = document.querySelector('.rate-category[data-listing-id="' + CSS.escape(id) + '"]')?.value || "";
          const role = document.querySelector('.rate-role[data-listing-id="' + CSS.escape(id) + '"]')?.value || "disabled";
          const master = document.querySelector('.rate-master[data-listing-id="' + CSS.escape(id) + '"]')?.value || "";
          const adjustment = Number(document.querySelector('.rate-adjustment[data-listing-id="' + CSS.escape(id) + '"]')?.value || 0);
          values[id] = {
            bedroomCategory: category,
            role,
            masterListingId: role === "copy" ? master : "",
            adjustmentPercent: role === "copy" ? adjustment : 0
          };
        }
        return values;
      }
      async function saveRateSettings() {
        try {
          const data = await api("/api/rate-settings", { method: "PUT", body: JSON.stringify({ rateCopySettings: rateCopySettings() }) });
          activeRateListings = data.listings || [];
          renderRateSettings(activeRateListings);
          show("RATE COPY SETTINGS SAVED SUCCESSFULLY. No rates were changed.", "success");
        } catch (error) { show(error.message, "error"); }
      }
      if (keyInput.value) loadRateSettings();
    </script>
  </body>
</html>`;

export const scanPage = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Scan &amp; Adjust Nights</title>
    <style>${styles}</style>
  </head>
  <body>
    <h1>Scan &amp; Adjust Nights</h1>
    <p>Scan enabled properties and adjust available calendar dates using general, event, last-minute, and gap rules.</p>
    <nav>
      <a href="/properties">Property Settings</a>
      <a class="active" href="/scan">Scan &amp; Adjust</a>
      <a href="/rate-settings">Rate Settings</a>
      <a href="/rates">Copy Rates</a>
    </nav>
    <div class="row">
      <input id="key" type="password" placeholder="Settings admin key">
      <button onclick="loadEnabled()">Load enabled properties</button>
      <button class="primary" onclick="scan()">SCAN &amp; ADJUST NIGHTS</button>
    </div>
    <div id="status" class="panel">Enter your admin key and load enabled properties.</div>
    <div id="listings"></div>
    <script>
      ${scriptHelpers}
      async function loadEnabled() {
        try {
          const data = await api("/api/enabled-listings");
          document.getElementById("listings").innerHTML = data.listings.length
            ? '<h3>Enabled properties</h3>' + data.listings.map((listing) =>
                '<div class="listing">' + escapeHtml(listing.title || listing.id) + ' - general min ' + escapeHtml(listing.generalMinNights || 3) + ' - gap min ' + escapeHtml(listing.minNightsFloor || 1) + (listing.lastMinuteMinNights ? ' - last min ' + escapeHtml(listing.lastMinuteMinNights) : '') + (listing.stepDownByGap ? ' - step-down enabled' : '') + eventSummary(listing.eventMinNights || {}, data.eventRules || []) + '</div>'
              ).join("")
            : '<p>No properties are enabled. Use Property Settings first.</p>';
          show(data.listings.length + " enabled properties loaded.");
        } catch (error) { show(error.message, "error"); }
      }
      async function scan() {
        try {
          show("Scanning enabled properties...");
          await api("/api/scan", { method: "POST", body: "{}" });
          await waitForScan();
        } catch (error) { show(error.message, "error"); }
      }
      function elapsed(startedAt) {
        const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(startedAt)) / 1000));
        const minutes = Math.floor(seconds / 60);
        return String(minutes).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
      }
      async function waitForScan() {
        const job = await api("/api/scan-status");
        if (job.state === "running") {
          show("Scanning enabled properties... " + elapsed(job.startedAt) + " elapsed. This may take several minutes.");
          setTimeout(waitForScan, 2000);
          return;
        }
        if (job.state === "failed") throw new Error(job.error || "Scan failed");
        if (job.state !== "completed") throw new Error("Scan did not start");
        const data = job.result;
        const detail = data.dryRun
          ? data.adjustmentCount + " proposed adjustments. No Guesty changes were made because DRY_RUN is true."
          : data.appliedCount + " adjustments applied successfully.";
        show("UPDATE SUCCESSFULLY. " + detail, "success");
        renderScanResults(data);
      }
      function renderScanResults(data) {
        const rows = (data.listings || []).map((listing) => {
          const adjustments = listing.adjustments || [];
          const countText = adjustments.length + " " + (adjustments.length === 1 ? "date" : "dates") + " adjusted";
          const details = adjustments.length
            ? '<ul class="result-details">' + adjustments.map((adjustment) =>
                '<li>' + escapeHtml(adjustment.date) + ': ' +
                escapeHtml(adjustment.fromMinNights) + ' nights -> ' +
                escapeHtml(adjustment.toMinNights) + ' nights</li>'
              ).join("") + '</ul>'
            : '<div class="result-details">No eligible dates found.</div>';
          return '<div class="result-row"><div class="result-title"><span>' +
            escapeHtml(listing.title || listing.id) + ' <small>(general ' + escapeHtml(listing.generalMinNights || 3) + ', gap min ' + escapeHtml(listing.minNightsFloor || 1) + (listing.lastMinuteMinNights ? ', last min ' + escapeHtml(listing.lastMinuteMinNights) : '') + (listing.stepDownByGap ? ', step-down' : '') + eventSummary(listing.eventMinNights || {}, data.eventRules || []) + ')</small></span><span>' +
            countText + '</span></div>' + details + '</div>';
        }).join("");
        document.getElementById("listings").innerHTML =
          '<h3>Scan results</h3><div class="results">' + rows + '</div>';
      }
      loadEnabled();
    </script>
  </body>
</html>`;

export const ratesPage = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Copy Rates</title>
    <style>${styles}</style>
  </head>
  <body>
    <h1>Copy Rates</h1>
    <p>Preview the rate copy setup. This version does not change Guesty rates.</p>
    <nav>
      <a href="/properties">Property Settings</a>
      <a href="/scan">Scan &amp; Adjust</a>
      <a href="/rate-settings">Rate Settings</a>
      <a class="active" href="/rates">Copy Rates</a>
    </nav>
    <div class="row">
      <input id="key" type="password" placeholder="Settings admin key">
      <button onclick="loadPlan()">Load rate copy setup</button>
      <button class="primary" onclick="previewRates()">PREVIEW COPY RATES</button>
    </div>
    <div id="status" class="panel">Enter your admin key and load the rate copy setup.</div>
    <div id="listings"></div>
    <script>
      ${scriptHelpers}
      function renderPlan(plan) {
        document.getElementById("listings").innerHTML = plan.length
          ? '<h3>Rate copy plan</h3><div class="results">' + plan.map((item) =>
              '<div class="result-row"><div class="result-title"><span>' + rateSummary(item) + '</span><span>' + (item.ready ? 'Ready' : 'Missing master') + '</span></div></div>'
            ).join("") + '</div>'
          : '<p>No rate copy targets selected yet. Use Rate Settings first.</p>';
      }
      async function loadPlan() {
        try {
          const data = await api("/api/rate-settings");
          renderPlan(data.plan || []);
          show("Rate copy setup loaded. No rates were changed.");
        } catch (error) { show(error.message, "error"); }
      }
      async function previewRates() {
        try {
          const data = await api("/api/rates/preview", { method: "POST", body: "{}" });
          renderPlan(data.plan || []);
          show((data.message || "Preview complete. No Guesty rates were changed.") + " " + (data.plan || []).length + " copy targets found.", "success");
        } catch (error) { show(error.message, "error"); }
      }
      if (keyInput.value) loadPlan();
    </script>
  </body>
</html>`;
