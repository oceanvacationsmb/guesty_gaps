const styles = `
  body { font: 16px Arial, sans-serif; max-width: 980px; margin: 40px auto; padding: 0 18px; color: #15243b; }
  h1 { margin-bottom: 8px; }
  nav { display: flex; gap: 10px; margin: 20px 0; }
  nav a { color: #153d6f; font-weight: bold; text-decoration: none; padding: 9px 12px; border: 1px solid #b6c5d7; border-radius: 5px; }
  nav a.active { color: white; background: #153d6f; }
  .row { display: flex; gap: 10px; margin: 16px 0; flex-wrap: wrap; align-items: center; }
  input[type=password] { min-width: 280px; padding: 10px; }
  button { padding: 11px 15px; cursor: pointer; font-weight: bold; }
  .primary { color: white; background: #153d6f; border: 1px solid #153d6f; border-radius: 5px; }
  .listing { display: flex; gap: 10px; padding: 11px 4px; border-bottom: 1px solid #ddd; }
  .panel { padding: 16px; background: #f4f7fa; border-radius: 5px; }
  .success { color: #17643a; background: #e9f7ef; }
  .error { color: #9e251d; background: #fbeceb; }
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
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed");
    return data;
  }
  function show(message, type = "") {
    status.className = "panel " + type;
    status.textContent = message;
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
    <p>Enable only the properties that may receive minimum-night adjustments.</p>
    <nav>
      <a class="active" href="/properties">Property Settings</a>
      <a href="/scan">Scan &amp; Adjust</a>
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
          document.getElementById("listings").innerHTML = data.listings.map((listing) =>
            '<label class="listing"><input type="checkbox" value="' + listing.id + '"' + (listing.active ? ' checked' : '') + '> ' +
            (listing.title || listing.id) + ' <small>(' + listing.id + ')</small></label>'
          ).join("");
          show(data.listings.length + " properties loaded. " + data.activeCount + " enabled.");
        } catch (error) { show(error.message, "error"); }
      }
      function selectedIds() {
        return [...document.querySelectorAll("input[type=checkbox]:checked")].map((input) => input.value);
      }
      async function save() {
        try {
          const data = await api("/api/settings", { method: "PUT", body: JSON.stringify({ activeListingIds: selectedIds() }) });
          show("PROPERTY SETTINGS SAVED SUCCESSFULLY. " + data.activeListingIds.length + " properties enabled.", "success");
        } catch (error) { show(error.message, "error"); }
      }
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
    <p>Scan enabled properties and adjust eligible minimum-night gaps.</p>
    <nav>
      <a href="/properties">Property Settings</a>
      <a class="active" href="/scan">Scan &amp; Adjust</a>
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
                '<div class="listing">' + (listing.title || listing.id) + '</div>'
              ).join("")
            : '<p>No properties are enabled. Use Property Settings first.</p>';
          show(data.listings.length + " enabled properties loaded.");
        } catch (error) { show(error.message, "error"); }
      }
      async function scan() {
        try {
          show("Scanning enabled properties...");
          const data = await api("/api/scan", { method: "POST", body: "{}" });
          const detail = data.dryRun
            ? data.adjustmentCount + " proposed adjustments. No Guesty changes were made because DRY_RUN is true."
            : data.appliedCount + " adjustments applied successfully." +
              (data.skippedByLiveCap ? " " + data.skippedByLiveCap + " skipped by the live safety cap." : "");
          show("UPDATE SUCCESSFULLY. " + detail, "success");
        } catch (error) { show(error.message, "error"); }
      }
      loadEnabled();
    </script>
  </body>
</html>`;
