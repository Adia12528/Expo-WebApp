# Multi-Site App (Expo)

Lets users paste any website link inside the app and save it — each saved
link then opens as its own full-screen app-like page (native WebView),
persisted on the device. No retyping or re-finding links.

## How it works

- **Home screen** — list of saved sites. Tap `+ Add site`, paste a link
  (name is optional, auto-filled from the domain), hit Save.
- **Tap a saved site** → opens full-screen with pull-to-refresh, a loading
  bar, offline/error screen with retry, and Android back-button support.
- **Long-press a saved site** on the home screen → remove it.
- Everything is saved with `AsyncStorage`, so the list survives app restarts.

## Files

- `App.js` — the whole app: `HomeScreen` (saved-sites list + add modal) and
  `SiteScreen` (the full-screen WebView for one site).
- `config.js` — app name, pull-to-refresh, progress bar, optional domain
  allowlist for in-app navigation.
- `app.json` — app name, bundle IDs, icon/splash paths.
- `assets/` — placeholder icon/splash (swap with your own, same filenames).

## 1. Set your app's name & bundle IDs

In `app.json`:
- `expo.name` — display name
- `ios.bundleIdentifier` / `android.package` — change `com.yourcompany.websiteapp`
  to something unique (reverse-domain style, e.g. `com.adi.mysites`)

And `appName` in `config.js` if you want the in-app header to say something
other than "My Sites".

## 2. Replace the icon/splash (optional)

Swap these files, keeping the same names/sizes:
- `assets/icon.png` — 1024×1024
- `assets/adaptive-icon.png` — 1024×1024 (Android)
- `assets/splash.png` — 1242×1242
- `assets/favicon.png` — 48×48 (web)

## 3. Run it locally

```bash
npm install
npx expo start        # scan the QR code with Expo Go (iOS/Android)
npx expo start --web  # test in a browser
```

Requires Node.js 18+. Expo Go (App Store / Play Store) lets you preview on a
real phone instantly without building anything.

## 4. Build real app store binaries

Use [EAS Build](https://docs.expo.dev/build/introduction/) (free tier available):

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android   # → .aab/.apk
eas build --platform ios       # → .ipa (needs an Apple Developer account, $99/yr)
```

`eas build --platform android --profile preview` gives an installable `.apk`
directly — good for testing without a Play Store account.

To publish for real: Android needs a one-time $25 Google Play Developer
account; iOS needs a $99/yr Apple Developer account.

## Notes / ideas to extend

- Want saved sites to show their real favicon instead of a letter avatar?
  Fetch `https://www.google.com/s2/favicons?domain=<hostname>&sz=64` and
  show it in an `<Image>` — easy follow-up if you want it.
- Want to reorder or edit a saved site's name later? The list is just an
  array in `AsyncStorage` (`saved_sites_v1`) — add an edit modal the same
  way the add modal works in `HomeScreen`.
- `allowedDomains` in `config.js` restricts in-app navigation to specific
  domains if a saved site links out a lot and you want that handled
  differently (e.g. opened in the system browser via `expo-linking`).
