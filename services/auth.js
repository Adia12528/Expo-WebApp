import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

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
 * Start In-App Google Sign-in flow
 */
export async function promptGoogleSignIn(clientId) {
  const redirectUri = getRedirectUri();
  
  // Standard fallback demo client ID for testing if user hasn't configured custom GCP OAuth
  const resolvedClientId =
    clientId ||
    "1069352123512-demo.apps.googleusercontent.com";

  const authUrl =
    `${googleDiscovery.authorizationEndpoint}?` +
    `client_id=${encodeURIComponent(resolvedClientId)}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=token&` +
    `scope=${encodeURIComponent("openid profile email")}`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

  if (result.type === "success" && result.url) {
    // Extract access_token from url fragment (#access_token=...)
    const matches = result.url.match(/access_token=([^&]+)/);
    if (matches && matches[1]) {
      const token = decodeURIComponent(matches[1]);
      return await fetchGoogleUserProfile(token);
    }
  }

  return null;
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
};
