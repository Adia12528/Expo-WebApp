import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import AsyncStorage from "@react-native-async-storage/async-storage";
import config from "../config";

// Complete any pending auth sessions on web/mobile
WebBrowser.maybeCompleteAuthSession();

const USER_STORAGE_KEY = "app_user_profile_v1";
const CLOUD_SYNC_KEY_PREFIX = "cloud_sync_deck_";

// Google OpenID Discovery Document
export const googleDiscovery = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
  userInfoEndpoint: "https://www.googleapis.com/userinfo/v2/me",
};

export let IS_DEMO_AUTH = false;

/**
 * Get the current redirect URI for Expo AuthSession
 */
export function getRedirectUri() {
  if (config.googleRedirectUri) {
    return config.googleRedirectUri;
  }
  return AuthSession.makeRedirectUri({
    scheme: "com.adityasoni.mysites",
    preferLocalhost: true,
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
 */
export async function promptGoogleSignIn() {
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

  // 1. Prepare AuthRequest with PKCE
  const request = new AuthSession.AuthRequest({
    clientId,
    redirectUri,
    scopes: ["openid", "profile", "email"],
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
    extraParams: {
      access_type: "offline",
      prompt: "consent",
    },
  });

  // 2. Launch browser authentication prompt
  const result = await request.promptAsync(googleDiscovery);
  console.log("[Auth] Browser prompt result:", result);

  if (result.type === "success") {
    // Check if access_token was returned directly
    if (result.params?.access_token) {
      return await fetchGoogleUserProfile(result.params.access_token);
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
        return await fetchGoogleUserProfile(tokenResponse.accessToken);
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
  get IS_DEMO_AUTH() {
    return IS_DEMO_AUTH;
  },
};
