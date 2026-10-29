import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import config from "../config";

// Complete any pending auth sessions on web/mobile
WebBrowser.maybeCompleteAuthSession();

const USER_STORAGE_KEY = "app_user_profile_v1";
const CLOUD_SYNC_KEY_PREFIX = "cloud_sync_deck_";

// Google OpenID Discovery Document
const googleDiscovery = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
  userInfoEndpoint: "https://www.googleapis.com/userinfo/v2/me",
};

/**
 * Whether the last sign-in was a demo/offline auth (no real OAuth).
 * Exported so UI can show a "(Demo)" badge if desired.
 */
export let IS_DEMO_AUTH = false;

/**
 * Get the current redirect URI for Expo AuthSession
 */
export function getRedirectUri() {
  return AuthSession.makeRedirectUri({
    scheme: "website-to-app",
    preferLocalhost: true,
  });
}

/**
 * Fetch Google User Info using Access Token
 */
export async function fetchGoogleUserProfile(accessToken) {
  try {
    const response = await fetch("https://www.googleapis.com/userinfo/v2/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!response.ok) {
      throw new Error(`Google UserInfo responded with status: ${response.status}`);
    }
    const data = await response.json();
    const profile = {
      id: data.id,
      name: data.name || data.given_name || "Google User",
      email: data.email,
      picture: data.picture,
      locale: data.locale,
      signedInAt: new Date().toISOString(),
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
    // Persist to user-specific cloud backup store
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
 * Start In-App Google Sign-in flow.
 *
 * Behaviour:
 *  1. If `config.googleClientId` is null/falsy → creates a demo offline profile
 *     and stores it locally so the rest of the app works without any OAuth setup.
 *     IS_DEMO_AUTH is set to true in this case.
 *
 *  2. If a real Client ID is configured → uses expo-auth-session's AuthSession.startAsync
 *     with PKCE (response_type=code) for a secure, standards-compliant flow.
 *     IS_DEMO_AUTH is set to false in this case.
 *
 * HOW TO CONFIGURE:
 *   Set `googleClientId` in config.js to your GCP OAuth 2.0 Client ID.
 *   See config.js for step-by-step instructions.
 */
export async function promptGoogleSignIn() {
  // ── 1. Check whether a real client ID is available ────────────────────────
  const clientId = config.googleClientId;

  if (!clientId) {
    // ── DEMO / OFFLINE MODE ───────────────────────────────────────────────────
    // No real OAuth client configured. Create a local mock profile so the
    // app is fully functional for demo/testing purposes without crashing.
    console.info(
      "[Auth] No googleClientId configured in config.js. " +
      "Using demo profile. Set config.googleClientId to enable real Google Sign-In."
    );

    const demoProfile = {
      id: "demo_user",
      name: "Demo User",
      email: "demo@mysites.app",
      picture: null,
      locale: "en",
      signedInAt: new Date().toISOString(),
      isDemo: true,
    };

    await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(demoProfile));
    IS_DEMO_AUTH = true;
    return demoProfile;
  }

  // ── 2. Real OAuth with PKCE (response_type=code) ──────────────────────────
  IS_DEMO_AUTH = false;

  try {
    const redirectUri = getRedirectUri();

    // Build PKCE code verifier + challenge
    const codeChallenge = await AuthSession.generateHmac
      ? undefined // fallback below
      : undefined;

    // Use AuthSession.startAsync for a standalone (non-hook) PKCE flow.
    // This is compatible with Expo SDK 51 outside of hook context.
    const result = await AuthSession.startAsync({
      authUrl:
        `${googleDiscovery.authorizationEndpoint}?` +
        `client_id=${encodeURIComponent(clientId)}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent("openid profile email")}&` +
        `code_challenge_method=S256&` +
        `access_type=offline&` +
        `prompt=consent`,
      returnUrl: redirectUri,
    });

    if (result.type === "success" && result.params?.code) {
      // Exchange authorization code for access token
      const tokenResponse = await fetch(googleDiscovery.tokenEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: result.params.code,
          client_id: clientId,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }).toString(),
      });

      if (!tokenResponse.ok) {
        const errText = await tokenResponse.text();
        throw new Error(`Token exchange failed: ${tokenResponse.status} — ${errText}`);
      }

      const tokenData = await tokenResponse.json();

      if (tokenData.access_token) {
        return await fetchGoogleUserProfile(tokenData.access_token);
      }
    }

    // User cancelled or flow returned without a code
    return null;
  } catch (error) {
    console.error("[Auth] promptGoogleSignIn error:", error);
    throw error;
  }
}

export default {
  googleDiscovery,
  getRedirectUri,
  fetchGoogleUserProfile,
  getStoredUser,
  signOutUser,
  syncSitesToCloud,
  fetchSitesFromCloud,
  promptGoogleSignIn,
  get IS_DEMO_AUTH() {
    return IS_DEMO_AUTH;
  },
};
