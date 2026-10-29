// ──────────────────────────────────────────────────────────────
// EDIT THIS FILE to tweak behavior.
// Website links are no longer hardcoded here — users add/save
// their own links from inside the app (see App.js → HomeScreen).
// ──────────────────────────────────────────────────────────────

export default {
  // Shown in the app header
  appName: "My Sites",

  // Pull-to-refresh inside each saved site (works on iOS + Android)
  pullToRefresh: true,

  // Show a top progress bar while pages load
  showProgressBar: true,

  // Domains a saved site is allowed to navigate to *inside* its WebView.
  // Leave empty ([]) to allow the whole internet. Per-site override:
  // pass `allowedDomains: [...]` on the site object itself if you ever
  // want to restrict one specific saved site differently.
  allowedDomains: [],
};
