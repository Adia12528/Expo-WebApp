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

  // ──────────────────────────────────────────────────────────────
  // Google OAuth Client ID for real Google Sign-In
  // ──────────────────────────────────────────────────────────────
  //
  // ── OPTION A: Android OAuth Client (Recommended for production) ──
  //   1. GCP Console → APIs & Services → Credentials
  //   2. + Create Credentials → OAuth 2.0 Client ID → Application type: Android
  //   3. Package name: com.adityasoni.mysites
  //   4. SHA-1: 5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
  //   5. Paste the resulting client ID below.
  //   6. Set useExpoProxy: false (or remove it)
  //
  // ── OPTION B: Web OAuth Client + Expo Auth Proxy (Quick dev fix) ──
  //   1. GCP Console → Edit your existing Web client (747564924273-...)
  //   2. Under "Authorized redirect URIs" add:
  //        https://auth.expo.io/@adisoni.01/website-to-app
  //   3. Keep the existing client ID below (Web type is fine for proxy).
  //   4. Set useExpoProxy: true
  //
  // If googleClientId is null, a friendly demo/offline profile is used.
  googleClientId: "747564924273-p5c38vam6o8ks3rnuekqh9pu9amltjpu.apps.googleusercontent.com",

  // Set to true to use the Expo Auth Proxy (Option B above).
  // Requires https://auth.expo.io/@adisoni.01/website-to-app to be an
  // authorized redirect URI in your GCP Web client.
  // Set to false (or leave out) when using an Android OAuth client (Option A).
  useExpoProxy: true,

  // Custom Redirect URI override (optional).
  // Leave null to auto-generate from useExpoProxy / scheme settings above.
  googleRedirectUri: null,
};
