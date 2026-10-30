import * as Updates from "expo-updates";
import { Alert } from "react-native";

/**
 * Check and download available Over-The-Air (OTA) updates via EAS Update.
 *
 * @param {Object} options
 * @param {boolean} options.silent - If true, doesn't show "Already on latest version" alerts.
 * @returns {Promise<boolean>} Whether an update was downloaded and is ready to apply.
 */
export async function checkAndDownloadUpdate({ silent = false } = {}) {
  try {
    // OTA updates are disabled in development/local mode
    if (__DEV__ || !Updates.isEnabled) {
      if (!silent) {
        Alert.alert(
          "Development Mode",
          "OTA live updates are active in standalone builds. You can publish updates with:\n\nnpx eas-cli update --branch main"
        );
      }
      return false;
    }

    console.log("[Updates] Checking for available EAS updates...");
    const check = await Updates.checkForUpdateAsync();

    if (check.isAvailable) {
      console.log("[Updates] New update found. Downloading in background...");
      const fetchResult = await Updates.fetchUpdateAsync();

      if (fetchResult.isNew) {
        console.log("[Updates] Update downloaded successfully.");
        promptRestartPermission();
        return true;
      }
    } else {
      console.log("[Updates] App is already up to date.");
      if (!silent) {
        Alert.alert("Up to Date ✨", "You are already using the latest version of My Sites.");
      }
      return false;
    }
  } catch (error) {
    console.warn("[Updates] Failed to check/fetch updates:", error?.message);
    const msg = error?.message || "";
    // When no new update has been published to EAS yet, EAS returns 404 / Failed to download remote update
    const isNoUpdateAvailable =
      msg.includes("Failed to download remote update") ||
      msg.includes("404") ||
      msg.includes("no updates available") ||
      msg.includes("no channel");

    if (isNoUpdateAvailable) {
      if (!silent) {
        Alert.alert("Up to Date ✨", "You are already using the latest version of My Sites.");
      }
      return false;
    }

    if (!silent) {
      Alert.alert("Update Notice", `Could not check for updates: ${msg || "Network error"}`);
    }
    return false;
  }
  return false;
}

/**
 * Ask user permission to restart the app immediately or restart later.
 */
export function promptRestartPermission() {
  Alert.alert(
    "Update Ready! 🚀",
    "A new version of My Sites has been downloaded. Restart now to apply changes, or choose to restart later.",
    [
      {
        text: "Restart Later",
        style: "cancel",
        onPress: () => {
          console.log("[Updates] User deferred restart. Will apply on next launch.");
        },
      },
      {
        text: "Restart Now",
        style: "default",
        onPress: async () => {
          try {
            await Updates.reloadAsync();
          } catch (e) {
            console.warn("[Updates] Error while reloading app:", e?.message);
          }
        },
      },
    ]
  );
}

export default {
  checkAndDownloadUpdate,
  promptRestartPermission,
};

