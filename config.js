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
  // HOW TO SET UP:
  //   1. Go to https://console.cloud.google.com/
  //   2. Create a project (or select an existing one)
  //   3. Enable "Google People API" under APIs & Services
  //   4. Go to APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID
  //   5. For mobile (Expo):
  //      - Application type: "iOS" for iOS / "Android" for Android
  //      - Use the Expo redirect URI: AuthSession.makeRedirectUri({ scheme: "website-to-app" })
  //      - For development/Expo Go: select "Expo" as the redirect URI scheme
  //   6. Copy the generated Client ID and paste it below (replace null)
  //
  // If left as null, the app will use a friendly demo/offline profile
  // so you can test the full UI without any OAuth configuration.
  googleClientId: "747564924273-p5c38vam6o8ks3rnuekqh9pu9amltjpu.apps.googleusercontent.com",

  // Custom Redirect URI override (optional).
  // Leave null to automatically generate: "com.adityasoni.mysites:/" for Android builds.
  googleRedirectUri: null,
};
