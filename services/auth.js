import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import AsyncStorage from "@react-native-async-storage/async-storage";
import config from "../config";

// Complete any pending auth sessions on web/mobile
WebBrowser.maybeCompleteAuthSession();

const USER_STORAGE_KEY = "app_user_profile_v1";
const CLOUD_SYNC_KEY_PREFIX = "cloud_sync_deck_";

/** Storage key for the list of previously signed-in Google accounts */
const KNOWN_ACCOUNTS_KEY = "known_google_accounts_v1";

// Google OpenID Discovery Document
export const googleDiscovery = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
  userInfoEndpoint: "https://www.googleapis.com/userinfo/v2/me",
};

export let IS_DEMO_AUTH = false;

/**
 * Get the current redirect URI for Expo AuthSession.
 *
 * Strategy (in priority order):
 *  1. config.googleRedirectUri  — hard-coded override (manual config)
 *  2. EXPO_PROXY                — Expo Auth Proxy (used when config.useExpoProxy = true)
 *                                 Requires the URI to be registered in GCP as an
 *                                 "Authorized redirect URI" for your Web client.
 *  3. Native scheme             — com.adityasoni.mysites:/ (requires Android OAuth client
 *                                 in GCP, NOT a web client)
 */
export function getRedirectUri() {
  if (config.googleRedirectUri) {
    return config.googleRedirectUri;
  }

  // Expo Auth Proxy — works with a Web OAuth client.
  // Register https://auth.expo.io/@adisoni.01/website-to-app in GCP → Web client →
  // Authorized redirect URIs, then set useExpoProxy: true in config.js.
  if (config.useExpoProxy) {
    return AuthSession.makeRedirectUri({
      useProxy: true,
    });
  }

  // Native scheme — works with an Android OAuth client (not web client).
  // Create an Android client in GCP with package com.adityasoni.mysites and the debug SHA-1.
  return AuthSession.makeRedirectUri({
    native: "com.adityasoni.mysites:/",
    scheme: "com.adityasoni.mysites",
  });
}

/**
 * Creates a demo user object for offline testing
 */
export function createDemoUser() {
  return {
    id: "demo_user",
    name: "Demo User",
    email: "demo@mysites.app",
    picture: null,
    locale: "en",
    signedInAt: new Date().toISOString(),
    isDemo: true,
  };
}

/**
 * Fetch Google User Info using Access Token
 */
export async function fetchGoogleUserProfile(accessToken) {
  try {
    const response = await fetch(googleDiscovery.userInfoEndpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!response.ok) {
      throw new Error(`Google UserInfo responded with status: ${response.status}`);
    }
    const data = await response.json();
    const profile = {
      id: data.id || data.sub,
      name: data.name || data.given_name || "Google User",
      email: data.email,
      picture: data.picture,
      locale: data.locale,
      signedInAt: new Date().toISOString(),
      isDemo: false,
    };
    await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(profile));
    return profile;
  } catch (error) {
    console.error("[Auth] fetchGoogleUserProfile error:", error);
    throw error;
  }
}

/**
 * Get locally stored user profile
 */
export async function getStoredUser() {
  try {
    const raw = await AsyncStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

/**
 * Sign out user from the app
 */
export async function signOutUser() {
  try {
    await AsyncStorage.removeItem(USER_STORAGE_KEY);
    IS_DEMO_AUTH = false;
    return true;
  } catch (e) {
    return false;
  }
}

// ──────────────────────────────────────────────────────────────
// Known Accounts — remembers previously signed-in Google emails
// so the app can offer a fast one-tap picker on next sign-in.
// ──────────────────────────────────────────────────────────────

/**
 * Load the list of previously signed-in Google account profiles.
 * Returns an array of { email, name, picture } objects, most-recent first.
 */
export async function getKnownAccounts() {
  try {
    const raw = await AsyncStorage.getItem(KNOWN_ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Persist a successfully signed-in profile into the known-accounts list.
 * Deduplicates by email and keeps the most-recent entry at the front (max 5).
 */
export async function saveKnownAccount(profile) {
  if (!profile?.email || profile.isDemo) return;
  try {
    const existing = await getKnownAccounts();
    const filtered = existing.filter((a) => a.email !== profile.email);
    const updated = [
      { email: profile.email, name: profile.name, picture: profile.picture },
      ...filtered,
    ].slice(0, 5);
    await AsyncStorage.setItem(KNOWN_ACCOUNTS_KEY, JSON.stringify(updated));
  } catch {
    // non-critical
  }
}

/**
 * Remove a single account from the known-accounts list (e.g. after sign-out).
 */
export async function removeKnownAccount(email) {
  try {
    const existing = await getKnownAccounts();
    await AsyncStorage.setItem(
      KNOWN_ACCOUNTS_KEY,
      JSON.stringify(existing.filter((a) => a.email !== email))
    );
  } catch {
    // non-critical
  }
}

/**
 * Sync saved sites list to Cloud (e.g. Firebase, Supabase, or Cloud Backup)
 */
export async function syncSitesToCloud(user, sites) {
  if (!user || !user.id) return false;
  try {
    const syncPayload = {
      userId: user.id,
      email: user.email,
      lastSyncedAt: new Date().toISOString(),
      sites,
    };
    await AsyncStorage.setItem(
      `${CLOUD_SYNC_KEY_PREFIX}${user.id}`,
      JSON.stringify(syncPayload)
    );
    return true;
  } catch (e) {
    console.warn("[CloudSync] Failed to sync sites:", e);
    return false;
  }
}

/**
 * Fetch saved sites from Cloud (restores deck on new device / reinstall)
 */
export async function fetchSitesFromCloud(user) {
  if (!user || !user.id) return null;
  try {
    const raw = await AsyncStorage.getItem(`${CLOUD_SYNC_KEY_PREFIX}${user.id}`);
    if (raw) {
      const data = JSON.parse(raw);
      return data.sites || [];
    }
    return null;
  } catch (e) {
    console.warn("[CloudSync] Failed to fetch cloud sites:", e);
    return null;
  }
}

/**
 * Start In-App Google Sign-in flow using official AuthRequest & WebBrowser.
 *
 * @param {Object} options
 * @param {string} [options.loginHint] - Pre-fill a known Google email to skip account picker.
 *   When provided, Google skips the account list and shows one-tap "Continue as {name}".
 *   Pass undefined / null for a fresh sign-in that lets the user pick any account.
 */
export async function promptGoogleSignIn({ loginHint } = {}) {
  const clientId = config.googleClientId?.trim();

  // If no client ID configured in config.js, sign in with Demo profile
  if (!clientId) {
    console.info("[Auth] No googleClientId configured. Using demo profile.");
    const demoProfile = createDemoUser();
    await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(demoProfile));
    IS_DEMO_AUTH = true;
    return demoProfile;
  }

  IS_DEMO_AUTH = false;
  const redirectUri = getRedirectUri();

  console.log("[Auth] Starting Google OAuth flow...");
  console.log("[Auth] Client ID:", clientId);
  console.log("[Auth] Redirect URI:", redirectUri);
  if (loginHint) console.log("[Auth] Login hint:", loginHint);

  // Build extraParams: when a known account email is supplied use login_hint for
  // instant one-tap flow. Without a hint, force the account chooser so the user
  // can pick any Google account on the device (prompt=select_account).
  const extraParams = loginHint
    ? { access_type: "offline", login_hint: loginHint }
    : { access_type: "offline", prompt: "select_account" };

  // 1. Prepare AuthRequest with PKCE
  const request = new AuthSession.AuthRequest({
    clientId,
    redirectUri,
    scopes: ["openid", "profile", "email"],
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
    extraParams,
  });

  // 2. Launch browser authentication prompt
  const result = await request.promptAsync(googleDiscovery);
  console.log("[Auth] Browser prompt result:", result);

  if (result.type === "success") {
    // Check if access_token was returned directly
    if (result.params?.access_token) {
      const profile = await fetchGoogleUserProfile(result.params.access_token);
      await saveKnownAccount(profile);
      return profile;
    }

    // Exchange authorization code for access token via PKCE
    if (result.params?.code) {
      const tokenResponse = await AuthSession.exchangeCodeAsync(
        {
          clientId,
          code: result.params.code,
          redirectUri,
          extraParams: request.codeVerifier
            ? { code_verifier: request.codeVerifier }
            : undefined,
        },
        googleDiscovery
      );

      if (tokenResponse?.accessToken) {
        const profile = await fetchGoogleUserProfile(tokenResponse.accessToken);
        await saveKnownAccount(profile);
        return profile;
      }
      throw new Error("No access token received from Google token exchange.");
    }

    if (result.params?.error) {
      throw new Error(`Google Error: ${result.params.error_description || result.params.error}`);
    }
  } else if (result.type === "cancel" || result.type === "dismiss") {
    console.log("[Auth] User dismissed or cancelled authentication.");
    return null;
  } else if (result.type === "locked") {
    throw new Error("An authentication session is already active.");
  } else {
    throw new Error(`Authentication ended with status: ${result.type}`);
  }

  return null;
}

export default {
  googleDiscovery,
  getRedirectUri,
  createDemoUser,
  fetchGoogleUserProfile,
  getStoredUser,
  signOutUser,
  syncSitesToCloud,
  fetchSitesFromCloud,
  promptGoogleSignIn,
  getKnownAccounts,
  saveKnownAccount,
  removeKnownAccount,
  get IS_DEMO_AUTH() {
    return IS_DEMO_AUTH;
  },
};
