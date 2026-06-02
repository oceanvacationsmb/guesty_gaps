export const settingsPage = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Guesty Gap Settings</title>
    <style>
      body { font: 16px Arial, sans-serif; max-width: 900px; margin: 40px auto; padding: 0 18px; color: #15243b; }
      h1 { margin-bottom: 8px; }
      .row { display: flex; gap: 10px; margin: 16px 0; flex-wrap: wrap; }
      input[type=password] { min-width: 280px; padding: 10px; }
      button { padding: 10px 14px; cursor: pointer; }
      .listing { display: flex; gap: 10px; padding: 10px 4px; border-bottom: 1px solid #ddd; }
      #status { white-space: pre-wrap; padding: 12px; background: #f4f7fa; }
    </style>
  </head>
  <body>
    <h1>Guesty Gap Settings</h1>
    <p>Listings start inactive. Enable only the properties that may receive minimum-night adjustments.</p>
    <div class="row">
      <input id="key" type="password" placeholder="Settings admin key">
      <button onclick="loadListings()">Load listings</button>
      <button onclick="save()">Save selection</button>
      <button onclick="scan()">Run dry-run scan</button>
    </div>
    <div id="status">Enter the SETTINGS_ADMIN_KEY value from Render.</div>
    <div id="listings"></div>
    <script>
      const status = document.getElementById("status");
      const headers = () => ({ "content-type": "application/json", "x-admin-key": document.getElementById("key").value });
      async function api(path, options = {}) {
        const response = await fetch(path, { ...options, headers: headers() });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Request failed");
        return data;
      }
      async function loadListings() {
        try {
          const data = await api("/api/listings");
          document.getElementById("listings").innerHTML = data.listings.map((listing) =>
            '<label class="listing"><input type="checkbox" value="' + listing.id + '"' + (listing.active ? ' checked' : '') + '> ' +
            (listing.title || listing.id) + ' <small>(' + listing.id + ')</small></label>'
          ).join("");
          status.textContent = data.listings.length + " listings loaded. " + data.activeCount + " enabled.";
        } catch (error) { status.textContent = error.message; }
      }
      function selectedIds() {
        return [...document.querySelectorAll("input[type=checkbox]:checked")].map((input) => input.value);
      }
      async function save() {
        try {
          const data = await api("/api/settings", { method: "PUT", body: JSON.stringify({ activeListingIds: selectedIds() }) });
          status.textContent = "Saved. " + data.activeListingIds.length + " listings enabled.";
        } catch (error) { status.textContent = error.message; }
      }
      async function scan() {
        try {
          status.textContent = "Scanning...";
          const data = await api("/api/scan", { method: "POST", body: "{}" });
          status.textContent = JSON.stringify(data, null, 2);
        } catch (error) { status.textContent = error.message; }
      }
    </script>
  </body>
</html>`;
