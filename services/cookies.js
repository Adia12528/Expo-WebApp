import { Platform } from "react-native";

let CookieManager = null;
try {
  // eslint-disable-next-line global-require
  const mod = require("@react-native-cookies/cookies");
  CookieManager = mod.default || mod;
} catch (e) {
  CookieManager = null;
}

/**
 * Extract clean root domain/origin for cookie scope
 */
export function getDomainFromUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch (e) {
    return url;
  }
}

/**
 * Get all active cookies for a given site
 */
export async function getCookiesForSite(url) {
  if (Platform.OS === "web") {
    return {};
  }
  if (!CookieManager) {
    return {};
  }
  try {
    const isWebKit = Platform.OS === "ios";
    const cookies = await CookieManager.get(url, isWebKit);
    return cookies || {};
  } catch (error) {
    console.warn("[Cookies] Failed to retrieve cookies:", error?.message);
    return {};
  }
}

/**
 * Forget login / clear session for a specific saved site.
 * Clears cookies from native cookie jar and wipes localStorage/sessionStorage.
 */
export async function forgetSiteLogin(url, webviewRef = null) {
  const domain = getDomainFromUrl(url);

  // 1. Clear via Native CookieManager (Android / iOS)
  if (CookieManager && Platform.OS !== "web") {
    try {
      const isWebKit = Platform.OS === "ios";
      // Clear specific url cookies
      if (typeof CookieManager.clearByName === "function") {
        const cookies = await CookieManager.get(url, isWebKit);
        if (cookies) {
          for (const name of Object.keys(cookies)) {
            await CookieManager.clearByName(url, name, isWebKit);
          }
        }
      }
      // Also flush to disk
      if (typeof CookieManager.flush === "function") {
        await CookieManager.flush();
      }
    } catch (err) {
      console.warn("[Cookies] CookieManager clear error:", err?.message);
    }
  }

  // 2. Clear via injected JavaScript in the active WebView
  if (webviewRef?.current && typeof webviewRef.current.injectJavaScript === "function") {
    const wipeScript = `
      (function() {
        try {
          if (window.localStorage) window.localStorage.clear();
          if (window.sessionStorage) window.sessionStorage.clear();
          var cookies = document.cookie.split(";");
          for (var i = 0; i < cookies.length; i++) {
            var cookie = cookies[i];
            var eqPos = cookie.indexOf("=");
            var name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
            document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=" + window.location.hostname;
            document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;";
          }
        } catch(e) {}
      })();
      true;
    `;
    webviewRef.current.injectJavaScript(wipeScript);
    // Reload after wiping
    setTimeout(() => {
      webviewRef.current?.reload?.();
    }, 150);
  }

  return true;
}

export default {
  getCookiesForSite,
  forgetSiteLogin,
  getDomainFromUrl,
};
