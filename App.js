import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  Platform,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  Image,
  Dimensions,
  useColorScheme,
  BackHandler,
  Linking,
  KeyboardAvoidingView,
  Pressable,
  Alert,
  Share,
  ScrollView,
  Clipboard,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import * as LocalAuthentication from "expo-local-authentication";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withSpring,
  Easing,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from "react-native-reanimated";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import config from "./config";
import { lightTheme, darkTheme, radii } from "./theme";
import { forgetSiteLogin } from "./services/cookies";
import authService from "./services/auth";

// Complete any active web auth session
WebBrowser.maybeCompleteAuthSession();

// Platform-aware WebView
let WebView = null;
if (Platform.OS !== "web") {
  // eslint-disable-next-line global-require
  WebView = require("react-native-webview").WebView;
}

const STORAGE_KEY = "saved_sites_v1";
const THEME_PREF_KEY = "user_theme_pref_v1";
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Custom User-Agent on Android to prevent Google 403 disallowed_useragent
const DESKTOP_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const AD_BLOCK_DOMAINS = [
  "doubleclick.net",
  "googlesyndication.com",
  "googleadservices.com",
  "adnxs.com",
  "scorecardresearch.com",
  "taboola.com",
  "outbrain.com",
  "criteo.com"
];
const APP_CATEGORIES = ["All", "Work", "Social", "Dev", "Media", "Finance"];
const BIOMETRIC_STORAGE_KEY = "user_biometric_lock_v1";

const ANDROID_MOBILE_UA =
  "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";

// ──────────────────────────────────────────────────────────────
// Utility: URL helpers
// ──────────────────────────────────────────────────────────────
function normalizeUrl(input) {
  let url = input.trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  try {
    // eslint-disable-next-line no-new
    new URL(url);
    return url;
  } catch (e) {
    return null;
  }
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (e) {
    return url;
  }
}

function getFaviconUrl(url) {
  const host = hostnameOf(url);
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;
}

function isAllowed(url, site) {
  const domains = site?.allowedDomains?.length
    ? site.allowedDomains
    : config.allowedDomains;
  if (!domains || domains.length === 0) return true;
  try {
    const host = new URL(url).hostname;
    return domains.some((d) => host === d || host.endsWith(`.${d}`));
  } catch (e) {
    return true;
  }
}

// ──────────────────────────────────────────────────────────────
// Utility: Human-readable relative time
// ──────────────────────────────────────────────────────────────
function getTimeAgo(isoTs) {
  if (!isoTs) return null;
  const now = Date.now();
  const ts = typeof isoTs === "number" ? isoTs : new Date(isoTs).getTime();
  const diffMs = now - ts;
  if (diffMs < 0) return "Just now";
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 45) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay} days ago`;
  const diffWk = Math.floor(diffDay / 7);
  if (diffWk === 1) return "1 week ago";
  return `${diffWk} weeks ago`;
}

// ──────────────────────────────────────────────────────────────
// Liquid Glass Background: Animated drifting mesh blobs & watermark
// ──────────────────────────────────────────────────────────────
function DriftingBlobs({ theme }) {
  const blob1X = useSharedValue(SCREEN_WIDTH * 0.15);
  const blob1Y = useSharedValue(SCREEN_HEIGHT * 0.18);
  const blob1Scale = useSharedValue(1);

  const blob2X = useSharedValue(SCREEN_WIDTH * 0.8);
  const blob2Y = useSharedValue(SCREEN_HEIGHT * 0.45);
  const blob2Scale = useSharedValue(1.1);

  const blob3X = useSharedValue(SCREEN_WIDTH * 0.35);
  const blob3Y = useSharedValue(SCREEN_HEIGHT * 0.78);
  const blob3Scale = useSharedValue(0.95);

  useEffect(() => {
    blob1X.value = withRepeat(
      withSequence(
        withTiming(SCREEN_WIDTH * 0.35, { duration: 11000, easing: Easing.inOut(Easing.quad) }),
        withTiming(SCREEN_WIDTH * 0.05, { duration: 13000, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );
    blob1Y.value = withRepeat(
      withSequence(
        withTiming(SCREEN_HEIGHT * 0.28, { duration: 12000, easing: Easing.inOut(Easing.quad) }),
        withTiming(SCREEN_HEIGHT * 0.12, { duration: 14000, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );
    blob1Scale.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 9000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.9, { duration: 9000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    blob2X.value = withRepeat(
      withSequence(
        withTiming(SCREEN_WIDTH * 0.65, { duration: 14000, easing: Easing.inOut(Easing.quad) }),
        withTiming(SCREEN_WIDTH * 0.9, { duration: 12000, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );
    blob2Y.value = withRepeat(
      withSequence(
        withTiming(SCREEN_HEIGHT * 0.35, { duration: 10000, easing: Easing.inOut(Easing.quad) }),
        withTiming(SCREEN_HEIGHT * 0.58, { duration: 13000, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );

    blob3X.value = withRepeat(
      withSequence(
        withTiming(SCREEN_WIDTH * 0.55, { duration: 12500, easing: Easing.inOut(Easing.quad) }),
        withTiming(SCREEN_WIDTH * 0.2, { duration: 13500, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );
    blob3Y.value = withRepeat(
      withSequence(
        withTiming(SCREEN_HEIGHT * 0.68, { duration: 11500, easing: Easing.inOut(Easing.quad) }),
        withTiming(SCREEN_HEIGHT * 0.86, { duration: 12500, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );
  }, [blob1Scale, blob1X, blob1Y, blob2X, blob2Y, blob3X, blob3Y]);

  const styleBlob1 = useAnimatedStyle(() => ({
    transform: [
      { translateX: blob1X.value - 160 },
      { translateY: blob1Y.value - 160 },
      { scale: blob1Scale.value },
    ],
  }));

  const styleBlob2 = useAnimatedStyle(() => ({
    transform: [
      { translateX: blob2X.value - 180 },
      { translateY: blob2Y.value - 180 },
      { scale: blob2Scale.value },
    ],
  }));

  const styleBlob3 = useAnimatedStyle(() => ({
    transform: [
      { translateX: blob3X.value - 170 },
      { translateY: blob3Y.value - 170 },
      { scale: blob3Scale.value },
    ],
  }));

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <LinearGradient colors={theme.bgGradient} style={StyleSheet.absoluteFillObject} />

      {/* Very light, nearly visible background trademark watermark */}
      <View style={styles.trademarkContainer} pointerEvents="none">
        <Text
          style={[
            styles.trademarkMonogram,
            { color: theme.isDark ? "rgba(255, 255, 255, 0.024)" : "rgba(0, 0, 0, 0.02)" },
          ]}
        >
          AS
        </Text>
        <Text
          style={[
            styles.trademarkText,
            { color: theme.isDark ? "rgba(255, 255, 255, 0.038)" : "rgba(0, 0, 0, 0.028)" },
          ]}
        >
          ADITYA SONI™
        </Text>
      </View>

      {/* Blob 1: Electric Cyan / Sky */}
      <Animated.View style={[styles.blobContainer, styleBlob1]}>
        <Svg height="340" width="340" viewBox="0 0 340 340">
          <Defs>
            <RadialGradient id="grad1" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={theme.blobColors[2]} stopOpacity="1" />
              <Stop offset="65%" stopColor={theme.blobColors[2]} stopOpacity="0.5" />
              <Stop offset="100%" stopColor={theme.blobColors[2]} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="170" cy="170" r="170" fill="url(#grad1)" />
        </Svg>
      </Animated.View>

      {/* Blob 2: Luminous Magenta / Purple */}
      <Animated.View style={[styles.blobContainer, styleBlob2]}>
        <Svg height="380" width="380" viewBox="0 0 380 380">
          <Defs>
            <RadialGradient id="grad2" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={theme.blobColors[1]} stopOpacity="1" />
              <Stop offset="70%" stopColor={theme.blobColors[1]} stopOpacity="0.45" />
              <Stop offset="100%" stopColor={theme.blobColors[1]} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="190" cy="190" r="190" fill="url(#grad2)" />
        </Svg>
      </Animated.View>

      {/* Blob 3: Deep Indigo / Violet */}
      <Animated.View style={[styles.blobContainer, styleBlob3]}>
        <Svg height="360" width="360" viewBox="0 0 360 360">
          <Defs>
            <RadialGradient id="grad3" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={theme.blobColors[0]} stopOpacity="1" />
              <Stop offset="65%" stopColor={theme.blobColors[0]} stopOpacity="0.4" />
              <Stop offset="100%" stopColor={theme.blobColors[0]} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="180" cy="180" r="180" fill="url(#grad3)" />
        </Svg>
      </Animated.View>
    </View>
  );
}

// ──────────────────────────────────────────────────────────────
// Liquid Glass Container / Card Component
// ──────────────────────────────────────────────────────────────
function GlassSurface({
  children,
  style,
  theme,
  intensity,
  radius = radii.xl,
  bordered = true,
  solid = false,
  highlight = true,
}) {
  const isWeb = Platform.OS === "web";
  const blurVal = intensity ?? theme.blurIntensity;

  return (
    <View
      style={[
        styles.glassWrapper,
        {
          borderRadius: radius,
          backgroundColor: solid ? theme.glassBgSolid : theme.glassBg,
          borderColor: bordered ? theme.glassBorder : "transparent",
          borderTopColor: highlight ? theme.glassHighlight : theme.glassBorder,
          borderWidth: bordered ? 1 : 0,
        },
        theme.glassShadow,
        isWeb && {
          backdropFilter: `blur(${blurVal}px)`,
          WebkitBackdropFilter: `blur(${blurVal}px)`,
        },
        style,
      ]}
    >
      <BlurView
        intensity={blurVal}
        tint={theme.blurTint}
        style={[StyleSheet.absoluteFillObject, { borderRadius: radius }]}
      />
      {highlight && (
        <LinearGradient
          colors={[theme.glassHighlight, "transparent"]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={[styles.glassSpecularLine, { borderTopLeftRadius: radius, borderTopRightRadius: radius }]}
          pointerEvents="none"
        />
      )}
      {children}
    </View>
  );
}

// ──────────────────────────────────────────────────────────────
// Glass Favicon Badge (2x/3x density circular glass with fallback)
// ──────────────────────────────────────────────────────────────
function GlassFavicon({ url, name, theme }) {
  const [error, setError] = useState(false);
  const faviconUrl = getFaviconUrl(url);

  return (
    <View
      style={[
        styles.faviconBadge,
        {
          backgroundColor: theme.isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.85)",
          borderColor: theme.glassBorder,
        },
      ]}
    >
      {!error ? (
        <Image
          source={{ uri: faviconUrl }}
          style={styles.faviconImg}
          onError={() => setError(true)}
          resizeMode="contain"
        />
      ) : (
        <LinearGradient
          colors={theme.accentGradient}
          style={styles.faviconFallback}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.faviconFallbackText}>{(name || "S").charAt(0).toUpperCase()}</Text>
        </LinearGradient>
      )}
    </View>
  );
}

// ──────────────────────────────────────────────────────────────
// Site Tile: Liquid Glass Card with spring press, pin badge,
//            visit counter, share & inline actions
// ──────────────────────────────────────────────────────────────
function SiteTile({ item, theme, onOpen, onDelete, onForgetLogin, onPin }) {
  const scale = useSharedValue(1);
  const [showMenu, setShowMenu] = useState(false);

  const handlePressIn = () => {
    scale.value = withSpring(0.965, { damping: 14, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 14, stiffness: 300 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleShare = async () => {
    setShowMenu(false);
    try {
      await Share.share({
        title: item.name,
        message: `${item.name} — ${item.url}`,
        url: item.url, // iOS only
      });
    } catch (e) {
      // Share sheet dismissed or failed — silently ignore
    }
  };

  const timeAgo = getTimeAgo(item.lastVisited);

  return (
    <Animated.View style={[styles.tileOuter, animatedStyle]}>
      <Pressable
        onPress={() => onOpen(item)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.tilePressable}
      >
        <GlassSurface theme={theme} radius={radii.lg} style={styles.tileGlass}>
          <View style={styles.tileRow}>
            {/* Favicon */}
            <GlassFavicon url={item.url} name={item.name} theme={theme} />

            {/* Info */}
            <View style={styles.tileInfo}>
              <View style={styles.tileNameRow}>
                <Text style={[styles.tileName, { color: theme.textPrimary }]} numberOfLines={1}>
                  {item.name}
                </Text>
                {item.pinned && (
                  <Text style={styles.tilePinBadge}>⭐</Text>
                )}
              </View>
              <View style={styles.domainChipRow}>
                <View style={[styles.domainChip, { backgroundColor: theme.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }]}>
                  <Text style={[styles.tileUrl, { color: theme.textSecondary }]} numberOfLines={1}>
                    {hostnameOf(item.url)}
                  </Text>
                </View>
                {item.category && item.category !== "All" && (
                  <View style={[styles.categoryBadge, { backgroundColor: theme.accentGlow }]}>
                    <Text style={[styles.categoryBadgeText, { color: theme.accent }]}>{item.category}</Text>
                  </View>
                )}
              </View>
              {/* Visit count / last visited label */}
              {(item.visitCount > 0 || item.lastVisited) && (
                <Text style={[styles.tileVisitLabel, { color: theme.textTertiary }]} numberOfLines={1}>
                  {item.visitCount > 0 ? `• ${item.visitCount} visit${item.visitCount !== 1 ? "s" : ""}` : ""}
                  {item.visitCount > 0 && timeAgo ? "  " : ""}
                  {timeAgo ? timeAgo : ""}
                </Text>
              )}
            </View>

            {/* Actions Menu Trigger */}
            <TouchableOpacity
              style={[
                styles.dotsButton,
                { backgroundColor: theme.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)" },
              ]}
              onPress={(e) => {
                e?.stopPropagation?.();
                setShowMenu(true);
              }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Site actions"
            >
              <Text style={[styles.dotsText, { color: theme.textSecondary }]}>•••</Text>
            </TouchableOpacity>
          </View>
        </GlassSurface>
      </Pressable>

      {/* Action Sheet Modal for Site */}
      <Modal visible={showMenu} animationType="fade" transparent onRequestClose={() => setShowMenu(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setShowMenu(false)}>
          <View style={styles.menuContainer}>
            <GlassSurface theme={theme} radius={radii.xl} style={styles.menuGlass}>
              <Text style={[styles.menuHeaderTitle, { color: theme.textPrimary }]}>{item.name}</Text>
              <Text style={[styles.menuHeaderSub, { color: theme.textSecondary }]}>{item.url}</Text>

              {/* Pin / Unpin */}
              <TouchableOpacity
                style={[styles.menuItem, { borderBottomColor: theme.glassBorder, borderBottomWidth: StyleSheet.hairlineWidth }]}
                onPress={() => {
                  setShowMenu(false);
                  onPin(item.id);
                }}
              >
                <Text style={styles.menuItemIcon}>{item.pinned ? "★" : "☆"}</Text>
                <View>
                  <Text style={[styles.menuItemText, { color: theme.textPrimary }]}>
                    {item.pinned ? "Unpin Site" : "Pin to Top"}
                  </Text>
                  <Text style={[styles.menuItemDesc, { color: theme.textTertiary }]}>
                    {item.pinned ? "Remove from pinned section" : "Keeps this site at the top of your deck"}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Share */}
              <TouchableOpacity
                style={[styles.menuItem, { borderBottomColor: theme.glassBorder, borderBottomWidth: StyleSheet.hairlineWidth }]}
                onPress={handleShare}
              >
                <Text style={styles.menuItemIcon}>↗</Text>
                <View>
                  <Text style={[styles.menuItemText, { color: theme.textPrimary }]}>Share Site</Text>
                  <Text style={[styles.menuItemDesc, { color: theme.textTertiary }]}>Share URL via your device's share sheet</Text>
                </View>
              </TouchableOpacity>

              {/* Copy Link */}
              <TouchableOpacity
                style={[styles.menuItem, { borderBottomColor: theme.glassBorder, borderBottomWidth: StyleSheet.hairlineWidth }]}
                onPress={() => {
                  setShowMenu(false);
                  Clipboard.setString(item.url);
                  Alert.alert("Copied!", `${item.url} copied to clipboard.`);
                }}
              >
                <Text style={styles.menuItemIcon}>📋</Text>
                <View>
                  <Text style={[styles.menuItemText, { color: theme.textPrimary }]}>Copy Link</Text>
                  <Text style={[styles.menuItemDesc, { color: theme.textTertiary }]}>Copy this site's URL to clipboard</Text>
                </View>
              </TouchableOpacity>

              {/* Forget Login */}
              <TouchableOpacity
                style={[styles.menuItem, { borderBottomColor: theme.glassBorder, borderBottomWidth: StyleSheet.hairlineWidth }]}
                onPress={() => {
                  setShowMenu(false);
                  onForgetLogin(item);
                }}
              >
                <Text style={styles.menuItemIcon}>🔒</Text>
                <View>
                  <Text style={[styles.menuItemText, { color: theme.textPrimary }]}>Forget Login / Clear Session</Text>
                  <Text style={[styles.menuItemDesc, { color: theme.textTertiary }]}>Wipes cookies and local storage for this site</Text>
                </View>
              </TouchableOpacity>

              {/* Delete */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  onDelete(item.id);
                }}
              >
                <Text style={styles.menuItemIcon}>🗑️</Text>
                <View>
                  <Text style={[styles.menuItemText, { color: theme.danger }]}>Delete Site</Text>
                  <Text style={[styles.menuItemDesc, { color: theme.textTertiary }]}>Removes portal from your deck</Text>
                </View>
              </TouchableOpacity>
            </GlassSurface>
          </View>
        </Pressable>
      </Modal>
    </Animated.View>
  );
}

// ──────────────────────────────────────────────────────────────
// Liquid Shimmer Loading Skeleton
// ──────────────────────────────────────────────────────────────
function GlassShimmer({ theme }) {
  const pulse = useSharedValue(0.4);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.85, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 900, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, [pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  return (
    <View style={styles.shimmerContainer}>
      <Animated.View style={[styles.shimmerCard, animatedStyle]}>
        <GlassSurface theme={theme} radius={radii.xl} style={styles.shimmerGlass}>
          <View style={styles.shimmerContent}>
            <View
              style={[
                styles.shimmerOrb,
                { backgroundColor: theme.isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)" },
              ]}
            />
            <View
              style={[
                styles.shimmerLineLong,
                { backgroundColor: theme.isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)" },
              ]}
            />
            <View
              style={[
                styles.shimmerLineShort,
                { backgroundColor: theme.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" },
              ]}
            />
          </View>
        </GlassSurface>
      </Animated.View>
    </View>
  );
}

// ──────────────────────────────────────────────────────────────
// Recently Visited Pill (compact glass pill for the horizontal row)
// ──────────────────────────────────────────────────────────────
function RecentPill({ item, theme, onOpen }) {
  const [faviconError, setFaviconError] = useState(false);
  return (
    <TouchableOpacity
      onPress={() => onOpen(item)}
      activeOpacity={0.82}
      style={styles.recentPillOuter}
    >
      <GlassSurface theme={theme} radius={radii.pill} style={styles.recentPillGlass}>
        <View style={styles.recentPillRow}>
          {!faviconError ? (
            <Image
              source={{ uri: getFaviconUrl(item.url) }}
              style={styles.recentPillFavicon}
              onError={() => setFaviconError(true)}
              resizeMode="contain"
            />
          ) : (
            <View style={[styles.recentPillFaviconFallback, { backgroundColor: theme.accent }]}>
              <Text style={styles.recentPillFaviconLetter}>{(item.name || "S")[0]}</Text>
            </View>
          )}
          <Text style={[styles.recentPillName, { color: theme.textPrimary }]} numberOfLines={1}>
            {item.name}
          </Text>
        </View>
      </GlassSurface>
    </TouchableOpacity>
  );
}

// ──────────────────────────────────────────────────────────────
// Home Screen (Liquid Glass VisionOS Style with User Profile & Cloud Sync)
// ──────────────────────────────────────────────────────────────
function HomeScreen({
  sites,
  theme,
  isDark,
  user,
  biometricEnabled,
  onToggleBiometric,
  onSignIn,
  onSignOut,
  onSyncCloud,
  onToggleTheme,
  onOpen,
  onAdd,
  onDelete,
  onForgetLogin,
  onPin,
}) {
  const [modalVisible, setModalVisible] = useState(false);
  const [profileModal, setProfileModal] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [syncStatus, setSyncStatus] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [categoryInput, setCategoryInput] = useState("All");
  const insets = useSafeAreaInsets();

  const resetForm = () => {
    setUrlInput("");
    setNameInput("");
    setCategoryInput("All");
  };

  const handleSave = () => {
    const normalized = normalizeUrl(urlInput);
    if (!normalized) {
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.alert("Please paste a valid website link, e.g. example.com");
      }
      return;
    }
    onAdd({
      id: `${Date.now()}`,
      url: normalized,
      name: nameInput.trim() || hostnameOf(normalized),
      category: categoryInput || "All",
    });
    resetForm();
    setModalVisible(false);
  };

  const triggerCloudSync = async () => {
    setSyncStatus("Syncing...");
    const ok = await onSyncCloud();
    setSyncStatus(ok ? "Synced ✓" : "Sync Failed");
    setTimeout(() => setSyncStatus(""), 2500);
  };

  // ── Search & Category filter ────────────────────────────────────
  const lowerQuery = searchQuery.toLowerCase().trim();
  const categoryMatched = selectedCategory === "All"
    ? sites
    : sites.filter((s) => s.category === selectedCategory);
  const filteredSites = lowerQuery
    ? categoryMatched.filter(
        (s) =>
          s.name.toLowerCase().includes(lowerQuery) ||
          hostnameOf(s.url).toLowerCase().includes(lowerQuery)
      )
    : categoryMatched;

  // ── Pinned / unpinned split ────────────────────────────────────
  const pinnedSites = filteredSites.filter((s) => s.pinned);
  const unpinnedSites = filteredSites.filter((s) => !s.pinned);

  // ── Recently visited row (last 3 sites with a lastVisited, sorted desc) ─
  const recentSites = [...sites]
    .filter((s) => !!s.lastVisited)
    .sort((a, b) => {
      const ta = typeof a.lastVisited === "number" ? a.lastVisited : new Date(a.lastVisited).getTime();
      const tb = typeof b.lastVisited === "number" ? b.lastVisited : new Date(b.lastVisited).getTime();
      return tb - ta;
    })
    .slice(0, 3);

  // Build the FlatList data with section headers inserted
  const listData = [];
  if (recentSites.length > 0 && !lowerQuery) {
    listData.push({ _type: "recentRow", key: "__recent__" });
  }
  if (pinnedSites.length > 0) {
    listData.push({ _type: "sectionHeader", label: "⭐  Pinned", key: "__pinned_header__" });
    pinnedSites.forEach((s) => listData.push({ ...s, _type: "site" }));
  }
  if (unpinnedSites.length > 0 && pinnedSites.length > 0) {
    listData.push({ _type: "sectionHeader", label: "All Sites", key: "__all_header__" });
  }
  unpinnedSites.forEach((s) => listData.push({ ...s, _type: "site" }));

  const renderListItem = ({ item }) => {
    if (item._type === "recentRow") {
      return (
        <View style={styles.recentRowWrap}>
          <Text style={[styles.recentRowLabel, { color: theme.textSecondary }]}>Recently Visited</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recentScroll} contentContainerStyle={styles.recentScrollContent}>
            {recentSites.map((rs) => (
              <RecentPill key={rs.id} item={rs} theme={theme} onOpen={onOpen} />
            ))}
          </ScrollView>
        </View>
      );
    }
    if (item._type === "sectionHeader") {
      return (
        <Text style={[styles.sectionHeaderLabel, { color: theme.textSecondary }]}>{item.label}</Text>
      );
    }
    return (
      <SiteTile
        item={item}
        theme={theme}
        onOpen={onOpen}
        onDelete={onDelete}
        onForgetLogin={onForgetLogin}
        onPin={onPin}
      />
    );
  };

  return (
    <View style={styles.screenRoot}>
      <DriftingBlobs theme={theme} />

      <SafeAreaView style={styles.safeContainer} edges={["top", "left", "right"]}>
        <StatusBar style={isDark ? "light" : "dark"} />

        {/* VisionOS Floating Header */}
        <View style={styles.headerPad}>
          <GlassSurface
            theme={theme}
            radius={radii.xl}
            style={styles.headerGlass}
            intensity={theme.blurIntensityHeavy}
          >
            <View style={styles.headerInner}>
              <View style={styles.headerTitleRow}>
                <View style={styles.headerDropletLogo}>
                  <LinearGradient
                    colors={theme.accentGradient}
                    style={styles.dropletGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <View style={styles.dropletSpecular} />
                  </LinearGradient>
                </View>
                <View>
                  <Text style={[styles.headerTitleText, { color: theme.textPrimary }]}>
                    {config.appName}
                  </Text>
                  <Text style={[styles.headerSubtitleText, { color: theme.textSecondary }]}>
                    {sites.length} {sites.length === 1 ? "saved portal" : "saved portals"}
                  </Text>
                </View>
              </View>

              {/* Right Controls: User Profile / Sign-in & Theme Toggle */}
              <View style={styles.headerRightGroup}>
                {user ? (
                  <TouchableOpacity
                    style={[styles.userChip, { borderColor: theme.glassBorder, backgroundColor: theme.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)" }]}
                    onPress={() => setProfileModal(true)}
                  >
                    {user.picture ? (
                      <Image source={{ uri: user.picture }} style={styles.userAvatar} />
                    ) : (
                      <View style={[styles.userAvatarFallback, { backgroundColor: theme.accent }]}>
                        <Text style={styles.userAvatarFallbackText}>{(user.name || "U")[0]}</Text>
                      </View>
                    )}
                    <Text style={[styles.userChipText, { color: theme.textPrimary }]} numberOfLines={1}>
                      {user.name?.split(" ")[0] || "Profile"}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.googleSignInBtn, { borderColor: theme.glassBorder }]}
                    onPress={onSignIn}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={theme.fabGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.googleSignInGradient}
                    >
                      <Text style={styles.googleIconText}>G</Text>
                      <Text style={styles.googleSignInText}>Sign In</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={onToggleBiometric}
                  style={[
                    styles.themeToggle,
                    {
                      backgroundColor: biometricEnabled
                        ? theme.accent
                        : theme.isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
                      borderColor: biometricEnabled ? theme.accent : theme.glassBorder,
                      marginRight: 6,
                    },
                  ]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="Toggle App Lock"
                >
                  <Text style={styles.themeToggleIcon}>{biometricEnabled ? "🔒" : "🔓"}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={onToggleTheme}
                  style={[
                    styles.themeToggle,
                    {
                      backgroundColor: theme.isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
                      borderColor: theme.glassBorder,
                    },
                  ]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="Toggle appearance"
                >
                  <Text style={styles.themeToggleIcon}>{isDark ? "🌙" : "☀️"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </GlassSurface>
        </View>

        {/* Category Horizontal Pills */}
        <View style={styles.categoryBarPad}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryBarContent}>
            {APP_CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setSelectedCategory(cat)}
                  style={[
                    styles.categoryPill,
                    {
                      backgroundColor: isSelected
                        ? theme.accent
                        : theme.isDark
                        ? "rgba(255, 255, 255, 0.07)"
                        : "rgba(0, 0, 0, 0.05)",
                      borderColor: isSelected ? theme.accent : theme.glassBorder,
                    },
                  ]}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.categoryPillText,
                      { color: isSelected ? "#FFFFFF" : theme.textSecondary, fontWeight: isSelected ? "700" : "500" },
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Search / Filter Bar */}
        <View style={styles.searchBarPad}>
          <GlassSurface theme={theme} radius={radii.lg} style={styles.searchBarGlass} highlight={false}>
            <View style={styles.searchBarRow}>
              <Text style={styles.searchBarIcon}>🔍</Text>
              <TextInput
                style={[styles.searchBarInput, { color: theme.textPrimary }]}
                placeholder="Search saved sites…"
                placeholderTextColor={theme.textTertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
                autoCapitalize="none"
                clearButtonMode="while-editing"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={[styles.searchClearIcon, { color: theme.textTertiary }]}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          </GlassSurface>
        </View>

        {/* Saved Sites List / Empty State */}
        {sites.length === 0 ? (
          <View style={styles.emptyWrap}>
            <GlassSurface theme={theme} radius={radii.xxl} style={styles.emptyGlass}>
              <View style={styles.emptyInner}>
                <View style={styles.emptyOrbWrap}>
                  <LinearGradient
                    colors={theme.accentGradient}
                    style={styles.emptyOrb}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.emptyOrbIcon}>✦</Text>
                  </LinearGradient>
                </View>
                <Text style={[styles.emptyHeadline, { color: theme.textPrimary }]}>
                  Your Web, Fluid & Borderless
                </Text>
                <Text style={[styles.emptySubhead, { color: theme.textSecondary }]}>
                  Save any website into your personal liquid glass deck. It opens instantly as a
                  fresh native app with persistent logins and zero stale caches.
                </Text>
                <TouchableOpacity
                  style={[styles.emptyAddBtn, theme.glowShadow]}
                  onPress={() => setModalVisible(true)}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={theme.fabGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.emptyBtnGradient}
                  >
                    <Text style={styles.emptyBtnText}>+ Add your first site</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <View style={styles.devCreditWrap}>
                  <Text style={[styles.devCreditText, { color: theme.textTertiary }]}>
                    Developed by{" "}
                    <Text style={[styles.devCreditAuthor, { color: theme.textSecondary }]}>
                      Aditya Soni
                    </Text>
                  </Text>
                </View>
              </View>
            </GlassSurface>
          </View>
        ) : filteredSites.length === 0 && lowerQuery ? (
          /* No results card */
          <View style={styles.noResultsWrap}>
            <GlassSurface theme={theme} radius={radii.xl} style={styles.noResultsGlass}>
              <Text style={styles.noResultsEmoji}>🔍</Text>
              <Text style={[styles.noResultsTitle, { color: theme.textPrimary }]}>No results</Text>
              <Text style={[styles.noResultsSub, { color: theme.textSecondary }]}>
                No saved sites match "{searchQuery}"
              </Text>
            </GlassSurface>
          </View>
        ) : (
          <FlatList
            data={listData}
            keyExtractor={(item) => item.key ?? item.id}
            contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
            showsVerticalScrollIndicator={false}
            renderItem={renderListItem}
            ListFooterComponent={
              <View style={styles.devCreditWrap}>
                <Text style={[styles.devCreditText, { color: theme.textTertiary }]}>
                  Developed by{" "}
                  <Text style={[styles.devCreditAuthor, { color: theme.textSecondary }]}>
                    Aditya Soni
                  </Text>
                </Text>
              </View>
            }
          />
        )}

        {/* Liquid Glass Pill FAB */}
        <Animated.View
          entering={FadeIn.duration(400)}
          style={[styles.fabContainer, { bottom: insets.bottom + 20 }]}
        >
          <TouchableOpacity
            style={[styles.fabPressable, theme.glowShadow]}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={theme.fabGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.fabGradient}
            >
              <Text style={styles.fabIcon}>+</Text>
              <Text style={styles.fabLabel}>Add site</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* User Profile & Cloud Sync Modal */}
        <Modal
          visible={profileModal}
          animationType="fade"
          transparent
          onRequestClose={() => setProfileModal(false)}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setProfileModal(false)}>
            <Animated.View
              entering={SlideInDown.springify().damping(18)}
              style={styles.modalSheetWrap}
            >
              <GlassSurface
                theme={theme}
                radius={radii.xxl}
                intensity={theme.blurIntensityHeavy}
                style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 20) + 16 }]}
              >
                <View style={styles.dragPillHandle}>
                  <View style={[styles.dragPill, { backgroundColor: theme.isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)" }]} />
                </View>

                {user && (
                  <View style={styles.profileModalBody}>
                    {user.picture ? (
                      <Image source={{ uri: user.picture }} style={styles.profileModalAvatar} />
                    ) : (
                      <View style={[styles.profileModalAvatarFallback, { backgroundColor: theme.accent }]}>
                        <Text style={styles.profileModalAvatarText}>{(user.name || "U")[0]}</Text>
                      </View>
                    )}
                    <Text style={[styles.profileModalName, { color: theme.textPrimary }]}>{user.name}</Text>
                    <Text style={[styles.profileModalEmail, { color: theme.textSecondary }]}>{user.email}</Text>
                    {user.isDemo && (
                      <Text style={[styles.profileDemoBadge, { color: theme.textTertiary }]}>
                        Demo Mode — set googleClientId in config.js for real sign-in
                      </Text>
                    )}

                    <View style={styles.cloudSyncBox}>
                      <TouchableOpacity
                        style={[styles.syncButton, theme.glowShadow]}
                        onPress={triggerCloudSync}
                      >
                        <LinearGradient
                          colors={theme.fabGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.syncButtonGradient}
                        >
                          <Text style={styles.syncButtonText}>
                            {syncStatus || "☁️ Sync Decks with Cloud"}
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>
                      <Text style={[styles.syncHintText, { color: theme.textTertiary }]}>
                        Keeps all saved portals backed up safely across device reinstalls.
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={[styles.signOutBtn, { borderColor: theme.dangerBorder, backgroundColor: theme.dangerGlass }]}
                      onPress={() => {
                        setProfileModal(false);
                        onSignOut();
                      }}
                    >
                      <Text style={[styles.signOutText, { color: theme.danger }]}>Sign Out</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </GlassSurface>
            </Animated.View>
          </Pressable>
        </Modal>

        {/* Liquid Glass Add Site Bottom Sheet Modal */}
        <Modal
          visible={modalVisible}
          animationType="fade"
          transparent
          onRequestClose={() => setModalVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.modalBackdrop}
          >
            <Pressable style={styles.modalDismissOverlay} onPress={() => setModalVisible(false)} />

            <Animated.View
              entering={SlideInDown.springify().damping(18).stiffness(200)}
              exiting={SlideOutDown.duration(200)}
              style={styles.modalSheetWrap}
            >
              <GlassSurface
                theme={theme}
                radius={radii.xxl}
                intensity={theme.blurIntensityHeavy}
                style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 20) + 16 }]}
              >
                <View style={styles.dragPillHandle}>
                  <View
                    style={[
                      styles.dragPill,
                      { backgroundColor: theme.isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)" },
                    ]}
                  />
                </View>

                <View style={styles.modalHeaderRow}>
                  <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                    Add New Portal
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.modalCloseCircle,
                      { backgroundColor: theme.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" },
                    ]}
                    onPress={() => setModalVisible(false)}
                  >
                    <Text style={[styles.modalCloseText, { color: theme.textSecondary }]}>✕</Text>
                  </TouchableOpacity>
                </View>

                <Text style={[styles.modalDesc, { color: theme.textSecondary }]}>
                  Paste any web URL. We will automatically fetch its high-res icon and configure a
                  custom liquid app view with zero stale caches.
                </Text>

                <View
                  style={[
                    styles.glassInputWrap,
                    {
                      backgroundColor: theme.isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.8)",
                      borderColor: theme.glassBorder,
                    },
                  ]}
                >
                  <Text style={styles.inputPrefixIcon}>🌐</Text>
                  <TextInput
                    style={[styles.glassInput, { color: theme.textPrimary }]}
                    placeholder="Website URL (e.g. github.com)"
                    placeholderTextColor={theme.textTertiary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    value={urlInput}
                    onChangeText={setUrlInput}
                    autoFocus
                  />
                </View>

                <View
                  style={[
                    styles.glassInputWrap,
                    {
                      backgroundColor: theme.isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.8)",
                      borderColor: theme.glassBorder,
                    },
                  ]}
                >
                  <Text style={styles.inputPrefixIcon}>🏷️</Text>
                  <TextInput
                    style={[styles.glassInput, { color: theme.textPrimary }]}
                    placeholder="Custom name (optional)"
                    placeholderTextColor={theme.textTertiary}
                    value={nameInput}
                    onChangeText={setNameInput}
                  />
                </View>

                {/* Category Selection in Add Modal */}
                <View style={styles.modalCategorySection}>
                  <Text style={[styles.modalCategoryTitle, { color: theme.textSecondary }]}>Select Category</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modalCategoryScroll}>
                    {APP_CATEGORIES.filter(c => c !== "All").map((cat) => {
                      const isSel = categoryInput === cat;
                      return (
                        <TouchableOpacity
                          key={cat}
                          onPress={() => setCategoryInput(isSel ? "All" : cat)}
                          style={[
                            styles.modalCategoryPill,
                            {
                              backgroundColor: isSel
                                ? theme.accent
                                : theme.isDark
                                ? "rgba(255, 255, 255, 0.07)"
                                : "rgba(0, 0, 0, 0.05)",
                              borderColor: isSel ? theme.accent : theme.glassBorder,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.modalCategoryPillText,
                              { color: isSel ? "#FFFFFF" : theme.textSecondary, fontWeight: isSel ? "700" : "500" },
                            ]}
                          >
                            {cat}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                <View style={styles.modalActionRow}>
                  <TouchableOpacity
                    style={[
                      styles.modalCancelBtn,
                      {
                        backgroundColor: theme.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
                        borderColor: theme.glassBorder,
                      },
                    ]}
                    onPress={() => {
                      resetForm();
                      setModalVisible(false);
                    }}
                  >
                    <Text style={[styles.modalCancelBtnText, { color: theme.textSecondary }]}>
                      Cancel
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalSaveBtn, theme.glowShadow]}
                    onPress={handleSave}
                    activeOpacity={0.88}
                  >
                    <LinearGradient
                      colors={theme.fabGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.modalSaveGradient}
                    >
                      <Text style={styles.modalSaveBtnText}>Save Portal</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </GlassSurface>
            </Animated.View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

// ──────────────────────────────────────────────────────────────
// Site Screen: Fresh Load, Persistent Cookies, Progress Bar,
//              Google OAuth Handling
// ──────────────────────────────────────────────────────────────
function SiteScreen({ site, theme, isDark, onBack, onForgetLogin }) {
  const webviewRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [reloadKey, setReloadKey] = useState(() => Date.now());
  const [isDesktop, setIsDesktop] = useState(false);
  const [adBlockEnabled, setAdBlockEnabled] = useState(true);
  const insets = useSafeAreaInsets();

  // Animated progress bar width (smooth transitions instead of abrupt jumps)
  const progressAnim = useSharedValue(0.1);
  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${progressAnim.value * 100}%`,
  }));

  useEffect(() => {
    progressAnim.value = withTiming(Math.max(progress, 0.1), {
      duration: 280,
      easing: Easing.out(Easing.quad),
    });
  }, [progress, progressAnim]);

  // Force a fresh load timestamp on every open (bypasses browser and webview caches)
  const freshUrl = `${site.url}${site.url.includes("?") ? "&" : "?"}_fresh_ts=${reloadKey}`;

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (canGoBack && webviewRef.current) {
        webviewRef.current.goBack();
        return true;
      }
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [canGoBack, onBack]);

  const retry = () => {
    setHasError(false);
    setLoading(true);
    setReloadKey(Date.now());
    if (Platform.OS !== "web") {
      webviewRef.current?.reload();
    }
  };

  /**
   * Handle navigation requests:
   * 1. Intercept Google OAuth/SSO flows to prevent Google's 403 disallowed_useragent error
   * 2. Open external links or system browser when needed
   */
  const handleShouldStartLoad = (request) => {
    const targetUrl = request.url;

    // Built-in Ad & Tracker Blocker
    if (adBlockEnabled) {
      try {
        const host = new URL(targetUrl).hostname.toLowerCase();
        if (AD_BLOCK_DOMAINS.some((d) => host.includes(d))) {
          return false; // Silently drop ad/tracking requests
        }
      } catch (e) {}
    }

    // Check if URL is a Google / Apple / OAuth provider login endpoint
    const isGoogleOAuth =
      /accounts\.google\.com\/(signin|o\/oauth2|ServiceLogin)/i.test(targetUrl) ||
      /appleid\.apple\.com\/auth/i.test(targetUrl) ||
      /github\.com\/login\/oauth/i.test(targetUrl);

    if (isGoogleOAuth) {
      // Open in Custom Tabs / Safari so Google authentication succeeds without 403 block
      (async () => {
        try {
          const authResult = await WebBrowser.openAuthSessionAsync(targetUrl, site.url);
          if (authResult.type === "success" || authResult.type === "dismiss") {
            // Once user logs in, reload the site in WebView to pick up the shared cookies
            webviewRef.current?.reload();
          }
        } catch (e) {
          Linking.openURL(targetUrl);
        }
      })();
      return false; // Prevent embedded webview from navigating to blocked OAuth page
    }

    return isAllowed(targetUrl, site);
  };

  return (
    <View style={[styles.screenRoot, { backgroundColor: theme.background }]}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <DriftingBlobs theme={theme} />

      {/* Main WebView Content Area */}
      <View style={styles.siteContentArea}>
        {hasError ? (
          <View style={styles.errorContainer}>
            <GlassSurface theme={theme} radius={radii.xxl} style={styles.errorGlass}>
              <View style={styles.errorInner}>
                <Text style={styles.errorOrb}>⚠️</Text>
                <Text style={[styles.errorTitle, { color: theme.textPrimary }]}>
                  Couldn't load {site.name}
                </Text>
                <Text style={[styles.errorSubtitle, { color: theme.textSecondary }]}>
                  Check your network connection or verify the link domain.
                </Text>
                <View style={styles.errorBtnRow}>
                  <TouchableOpacity
                    style={[styles.retryBtn, theme.glowShadow]}
                    onPress={retry}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={theme.fabGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.retryBtnGradient}
                    >
                      <Text style={styles.retryBtnText}>Retry Connection</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.openBrowserFallbackBtn, { borderColor: theme.glassBorder }]}
                    onPress={() => Linking.openURL(site.url)}
                  >
                    <Text style={[styles.openBrowserFallbackText, { color: theme.accent }]}>
                      Open externally ↗
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </GlassSurface>
          </View>
        ) : Platform.OS === "web" ? (
          <iframe
            key={reloadKey}
            src={freshUrl}
            title={site.name}
            style={{
              flex: 1,
              width: "100%",
              height: "100%",
              border: "none",
              paddingTop: insets.top + 64,
            }}
            onLoad={() => setLoading(false)}
          />
        ) : (
          <WebView
            ref={webviewRef}
            source={{
              uri: freshUrl,
              headers: {
                "Cache-Control": "no-cache, no-store, must-revalidate",
                Pragma: "no-cache",
                Expires: "0",
              },
            }}
            style={[styles.webviewNative, { marginTop: insets.top + 64 }]}
            startInLoadingState={false}
            // 1. Bypass Caches: Always load latest content
            cacheEnabled={false}
            cacheMode="LOAD_NO_CACHE"
            // 2. Persistent Login: Keep cookies & storage intact
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            domStorageEnabled
            databaseEnabled
            // 3. User-Agent setting for Android to avoid embedded webview block
            userAgent={isDesktop ? DESKTOP_UA : (Platform.OS === "android" ? ANDROID_MOBILE_UA : undefined)}
            injectedJavaScript={`
              (function() {
                try {
                  if (${isDark}) {
                    var style = document.createElement('style');
                    style.id = 'mysites-dark-theme-override';
                    style.textContent = '@media (prefers-color-scheme: light) { html, body { background-color: #0d1117 !important; color: #e6edf3 !important; } }';
                    document.head.appendChild(style);
                  }
                } catch(e) {}
              })();
              true;
            `}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onLoadProgress={({ nativeEvent }) => setProgress(nativeEvent.progress)}
            onNavigationStateChange={(navState) => setCanGoBack(navState.canGoBack)}
            onError={() => {
              setHasError(true);
              setLoading(false);
            }}
            onHttpError={() => setLoading(false)}
            onShouldStartLoadWithRequest={handleShouldStartLoad}
            pullToRefreshEnabled={config.pullToRefresh}
            allowsBackForwardNavigationGestures
            decelerationRate="normal"
          />
        )}
      </View>

      {/* Frosted Shimmer Loading State */}
      {loading && !hasError && <GlassShimmer theme={theme} />}

      {/* Floating Translucent Liquid Glass Header */}
      <View style={[styles.siteFloatingHeaderWrap, { top: insets.top + 8 }]}>
        <GlassSurface
          theme={theme}
          radius={radii.xl}
          intensity={theme.blurIntensityHeavy}
          style={styles.siteHeaderGlass}
        >
          <View style={styles.siteHeaderRow}>
            {/* Back Button */}
            <TouchableOpacity
              onPress={onBack}
              style={[
                styles.siteHeaderPillBtn,
                {
                  backgroundColor: theme.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
                  borderColor: theme.glassBorder,
                },
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.siteHeaderBackArrow, { color: theme.accent }]}>‹</Text>
              <Text style={[styles.siteHeaderBackText, { color: theme.textPrimary }]}>Decks</Text>
            </TouchableOpacity>

            {/* Site Title and Host chip */}
            <View style={styles.siteHeaderTitleContainer}>
              <Text style={[styles.siteHeaderTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                {site.name}
              </Text>
              <Text style={[styles.siteHeaderHost, { color: theme.textSecondary }]} numberOfLines={1}>
                {hostnameOf(site.url)}
              </Text>
            </View>

            {/* Right Action Controls: Forget Login, Refresh, External link */}
            <View style={styles.siteHeaderActions}>
              {/* Desktop Mode Toggle */}
              <TouchableOpacity
                onPress={() => {
                  setIsDesktop((prev) => !prev);
                  setReloadKey(Date.now());
                }}
                style={[
                  styles.siteHeaderIconBtn,
                  {
                    backgroundColor: isDesktop
                      ? theme.accent
                      : theme.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
                    borderColor: isDesktop ? theme.accent : theme.glassBorder,
                  },
                ]}
                accessibilityLabel="Toggle Desktop View"
              >
                <Text style={styles.siteHeaderActionIcon}>🖥️</Text>
              </TouchableOpacity>

              {/* AdBlocker Toggle */}
              <TouchableOpacity
                onPress={() => {
                  const nextState = !adBlockEnabled;
                  setAdBlockEnabled(nextState);
                  Alert.alert("Ad Blocker", nextState ? "Ad blocker enabled." : "Ad blocker paused.");
                }}
                style={[
                  styles.siteHeaderIconBtn,
                  {
                    backgroundColor: adBlockEnabled
                      ? theme.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)"
                      : "rgba(239, 68, 68, 0.2)",
                    borderColor: theme.glassBorder,
                  },
                ]}
                accessibilityLabel="Toggle Ad Blocker"
              >
                <Text style={styles.siteHeaderActionIcon}>{adBlockEnabled ? "🛡️" : "⚠️"}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => onForgetLogin(site, webviewRef)}
                style={[
                  styles.siteHeaderIconBtn,
                  {
                    backgroundColor: theme.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
                    borderColor: theme.glassBorder,
                  },
                ]}
                accessibilityLabel="Forget Login / Clear Session"
              >
                <Text style={styles.siteHeaderActionIcon}>🔒</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={retry}
                style={[
                  styles.siteHeaderIconBtn,
                  {
                    backgroundColor: theme.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
                    borderColor: theme.glassBorder,
                  },
                ]}
                accessibilityLabel="Force Reload"
              >
                <Text style={[styles.siteHeaderActionText, { color: theme.textSecondary }]}>↻</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  Clipboard.setString(site.url);
                  Alert.alert("Copied!", `${site.url} copied to clipboard.`);
                }}
                style={[
                  styles.siteHeaderIconBtn,
                  {
                    backgroundColor: theme.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
                    borderColor: theme.glassBorder,
                  },
                ]}
                accessibilityLabel="Copy URL to clipboard"
              >
                <Text style={styles.siteHeaderActionIcon}>📋</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => Linking.openURL(site.url)}
                style={[
                  styles.siteHeaderIconBtn,
                  {
                    backgroundColor: theme.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
                    borderColor: theme.glassBorder,
                  },
                ]}
                accessibilityLabel="Open in system browser"
              >
                <Text style={[styles.siteHeaderActionText, { color: theme.accent }]}>↗</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Liquid Glass Progress Bar — smoothly animated via Reanimated */}
          {config.showProgressBar && loading && !hasError && (
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressBarAnimated, progressBarStyle]}>
                <LinearGradient
                  colors={theme.accentGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFillObject}
                />
              </Animated.View>
            </View>
          )}
        </GlassSurface>
      </View>
    </View>
  );
}

// ──────────────────────────────────────────────────────────────
// Master App Entry Point
// ──────────────────────────────────────────────────────────────
export default function App() {
  const [sites, setSites] = useState([]);
  const [activeSite, setActiveSite] = useState(null);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  // Theme preference
  const systemScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState("auto");

  const isDark = themeMode === "auto" ? systemScheme === "dark" : themeMode === "dark";
  const theme = isDark ? darkTheme : lightTheme;

  // Initial load: saved sites, theme, and user session
  useEffect(() => {
    (async () => {
      try {
        const rawSites = await AsyncStorage.getItem(STORAGE_KEY);
        if (rawSites) setSites(JSON.parse(rawSites));

        const savedTheme = await AsyncStorage.getItem(THEME_PREF_KEY);
        if (savedTheme) setThemeMode(savedTheme);

        // Check biometric lock
        const bioLock = await AsyncStorage.getItem(BIOMETRIC_STORAGE_KEY);
        if (bioLock === "true") {
          setBiometricEnabled(true);
          setIsLocked(true);
          // Trigger biometric prompt
          LocalAuthentication.authenticateAsync({
            promptMessage: "Unlock My Sites",
            fallbackLabel: "Enter Passcode",
          }).then((res) => {
            if (res.success) {
              setIsLocked(false);
            }
          });
        }

        const storedUser = await authService.getStoredUser();
        if (storedUser) {
          setUser(storedUser);
          // Auto-sync or restore from cloud
          const cloudSites = await authService.fetchSitesFromCloud(storedUser);
          if (cloudSites && cloudSites.length > 0 && (!rawSites || JSON.parse(rawSites).length === 0)) {
            setSites(cloudSites);
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cloudSites));
          }
        }
      } catch (e) {
        // clean fallback
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const toggleTheme = () => {
    const next = isDark ? "light" : "dark";
    setThemeMode(next);
    AsyncStorage.setItem(THEME_PREF_KEY, next).catch(() => {});
  };

  const toggleBiometricLock = async () => {
    const next = !biometricEnabled;
    setBiometricEnabled(next);
    await AsyncStorage.setItem(BIOMETRIC_STORAGE_KEY, next ? "true" : "false");
    Alert.alert(
      next ? "App Lock Enabled" : "App Lock Disabled",
      next ? "My Sites is now protected by biometrics." : "App lock turned off."
    );
  };

  const unlockWithBiometrics = async () => {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock My Sites",
      fallbackLabel: "Enter Passcode",
    });
    if (res.success) {
      setIsLocked(false);
    }
  };

  const persistSites = useCallback(
    (next) => {
      setSites(next);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      if (user) {
        authService.syncSitesToCloud(user, next).catch(() => {});
      }
    },
    [user]
  );

  const handleAdd = (site) =>
    persistSites([
      { ...site, pinned: false, visitCount: 0, lastVisited: null },
      ...sites,
    ]);

  const handleDelete = (id) => persistSites(sites.filter((s) => s.id !== id));

  // Toggle pin state for a site
  const handlePin = (id) => {
    const next = sites.map((s) =>
      s.id === id ? { ...s, pinned: !s.pinned } : s
    );
    persistSites(next);
  };

  // Open a site — increment visitCount + set lastVisited before navigating
  const handleOpen = (item) => {
    const now = Date.now();
    const updated = sites.map((s) =>
      s.id === item.id
        ? { ...s, visitCount: (s.visitCount || 0) + 1, lastVisited: now }
        : s
    );
    persistSites(updated);
    // Use the freshly updated version of the site for SiteScreen
    const fresh = updated.find((s) => s.id === item.id) || item;
    setActiveSite(fresh);
  };

  // In-app Google Sign-In handler
  const handleSignIn = async () => {
    try {
      const profile = await authService.promptGoogleSignIn();
      if (profile) {
        setUser(profile);
        // Sync existing sites to cloud
        await authService.syncSitesToCloud(profile, sites);
        if (profile.isDemo) {
          Alert.alert(
            "Signed In (Demo)",
            "You are signed in as Demo User. Your deck will now sync locally."
          );
        } else {
          Alert.alert("Signed In", `Welcome back, ${profile.name}!`);
        }
      }
    } catch (err) {
      console.error("Sign-in notice:", err?.message);
      Alert.alert(
        "Google Sign-In Notice",
        `${err?.message || "Could not complete sign in."}\n\nWould you like to continue with a Demo profile instead?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Use Demo Profile",
            onPress: async () => {
              const demo = authService.createDemoUser();
              await AsyncStorage.setItem("app_user_profile_v1", JSON.stringify(demo));
              setUser(demo);
            },
          },
        ]
      );
    }
  };

  const handleSignOut = async () => {
    await authService.signOutUser();
    setUser(null);
  };

  const handleSyncCloud = async () => {
    if (!user) return false;
    return await authService.syncSitesToCloud(user, sites);
  };

  // Forget Login / Clear Site Session handler
  const handleForgetLogin = async (site, webviewRef = null) => {
    const runClear = async () => {
      await forgetSiteLogin(site.url, webviewRef);
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.alert(`Logged out from ${site.name}. Session cleared.`);
      } else {
        Alert.alert("Session Cleared", `Cookies and login session for ${site.name} have been cleared.`);
      }
    };

    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(`Forget login for "${site.name}"? This clears your saved session cookies.`)) {
        await runClear();
      }
    } else {
      Alert.alert(
        "Forget Login",
        `Clear saved login cookies and storage for "${site.name}"?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Clear Session", style: "destructive", onPress: runClear },
        ]
      );
    }
  };

  if (!ready) {
    return (
      <SafeAreaProvider>
        <View style={[styles.splashScreen, { backgroundColor: theme.background }]}>
          <DriftingBlobs theme={theme} />
          <GlassShimmer theme={theme} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <Animated.View style={styles.appRoot} entering={FadeIn.duration(300)}>
        {isLocked ? (
          <View style={[styles.splashScreen, { backgroundColor: theme.background }]}>
            <DriftingBlobs theme={theme} />
            <GlassSurface theme={theme} radius={radii.xxl} style={styles.lockCardGlass}>
              <View style={styles.lockCardContent}>
                <Text style={styles.lockEmoji}>🔒</Text>
                <Text style={[styles.lockTitle, { color: theme.textPrimary }]}>My Sites is Locked</Text>
                <Text style={[styles.lockSub, { color: theme.textSecondary }]}>
                  Biometric protection is enabled for your logged-in portals.
                </Text>
                <TouchableOpacity
                  style={[styles.unlockBtn, theme.glowShadow]}
                  onPress={unlockWithBiometrics}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={theme.fabGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.unlockBtnGradient}
                  >
                    <Text style={styles.unlockBtnText}>Unlock with Biometrics</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </GlassSurface>
          </View>
        ) : activeSite ? (
          <SiteScreen
            site={activeSite}
            theme={theme}
            isDark={isDark}
            onBack={() => setActiveSite(null)}
            onForgetLogin={handleForgetLogin}
          />
        ) : (
          <HomeScreen
            sites={sites}
            theme={theme}
            isDark={isDark}
            user={user}
            biometricEnabled={biometricEnabled}
            onToggleBiometric={toggleBiometricLock}
            onSignIn={handleSignIn}
            onSignOut={handleSignOut}
            onSyncCloud={handleSyncCloud}
            onToggleTheme={toggleTheme}
            onOpen={handleOpen}
            onAdd={handleAdd}
            onDelete={handleDelete}
            onForgetLogin={handleForgetLogin}
            onPin={handlePin}
          />
        )}
      </Animated.View>
    </SafeAreaProvider>
  );
}

// ──────────────────────────────────────────────────────────────
// Liquid Glass Stylesheet
// ──────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
  },
  screenRoot: {
    flex: 1,
    overflow: "hidden",
  },
  safeContainer: {
    flex: 1,
  },
  splashScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  blobContainer: {
    position: "absolute",
    width: 380,
    height: 380,
  },

  // Glass Container
  glassWrapper: {
    overflow: "hidden",
    position: "relative",
  },
  glassSpecularLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
  },

  // Floating Header
  headerPad: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  headerGlass: {
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  headerInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerDropletLogo: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    overflow: "hidden",
    marginRight: 12,
  },
  dropletGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dropletSpecular: {
    width: 14,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.7)",
    position: "absolute",
    top: 5,
    left: 8,
  },
  headerTitleText: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  headerSubtitleText: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 1,
  },
  headerRightGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  userChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    marginRight: 8,
  },
  userAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 6,
  },
  userAvatarFallback: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  userAvatarFallbackText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  userChipText: {
    fontSize: 13,
    fontWeight: "700",
    maxWidth: 70,
  },
  googleSignInBtn: {
    borderRadius: radii.pill,
    overflow: "hidden",
    borderWidth: 1,
    marginRight: 8,
  },
  googleSignInGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  googleIconText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900",
    marginRight: 5,
  },
  googleSignInText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  themeToggle: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  themeToggleIcon: {
    fontSize: 15,
  },

  // Search Bar
  searchBarPad: {
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  searchBarGlass: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchBarRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  searchBarIcon: {
    fontSize: 15,
    marginRight: 8,
  },
  searchBarInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
  },
  searchClearIcon: {
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 8,
  },

  // Section Headers
  sectionHeaderLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 6,
  },

  // No results
  noResultsWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  noResultsGlass: {
    width: "100%",
    padding: 28,
    alignItems: "center",
  },
  noResultsEmoji: {
    fontSize: 36,
    marginBottom: 10,
  },
  noResultsTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 4,
  },
  noResultsSub: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },

  // Recently Visited Row
  recentRowWrap: {
    marginBottom: 8,
  },
  recentRowLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  recentScroll: {
    flexGrow: 0,
  },
  recentScrollContent: {
    paddingRight: 8,
  },
  recentPillOuter: {
    marginRight: 8,
  },
  recentPillGlass: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  recentPillRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  recentPillFavicon: {
    width: 18,
    height: 18,
    borderRadius: 4,
    marginRight: 6,
  },
  recentPillFaviconFallback: {
    width: 18,
    height: 18,
    borderRadius: 4,
    marginRight: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  recentPillFaviconLetter: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  recentPillName: {
    fontSize: 13,
    fontWeight: "700",
    maxWidth: 100,
  },

  // Tiles
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  tileOuter: {
    marginBottom: 12,
  },
  tilePressable: {
    borderRadius: radii.lg,
  },
  tileGlass: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  tileRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  faviconBadge: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
    overflow: "hidden",
  },
  faviconImg: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  faviconFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  faviconFallbackText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  tileInfo: {
    flex: 1,
    justifyContent: "center",
  },
  tileNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  tileName: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
    flex: 1,
  },
  tilePinBadge: {
    fontSize: 13,
    marginLeft: 4,
  },
  domainChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.sm,
    marginTop: 4,
  },
  tileUrl: {
    fontSize: 12,
    fontWeight: "500",
  },
  tileVisitLabel: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 4,
  },
  dotsButton: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  dotsText: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1,
  },

  // Menu Modal
  menuBackdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 24,
  },
  menuContainer: {
    width: "100%",
    maxWidth: 360,
  },
  menuGlass: {
    padding: 20,
  },
  menuHeaderTitle: {
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 2,
  },
  menuHeaderSub: {
    fontSize: 12,
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  menuItemIcon: {
    fontSize: 20,
    marginRight: 14,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: "700",
  },
  menuItemDesc: {
    fontSize: 11,
    marginTop: 2,
  },

  // Floating Action Button
  fabContainer: {
    position: "absolute",
    right: 20,
    zIndex: 99,
  },
  fabPressable: {
    borderRadius: radii.pill,
    overflow: "hidden",
  },
  fabGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: radii.pill,
  },
  fabIcon: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
    marginRight: 6,
  },
  fabLabel: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },

  // Empty State
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  emptyGlass: {
    width: "100%",
    padding: 28,
  },
  emptyInner: {
    alignItems: "center",
  },
  emptyOrbWrap: {
    width: 68,
    height: 68,
    borderRadius: radii.pill,
    marginBottom: 20,
    overflow: "hidden",
  },
  emptyOrb: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyOrbIcon: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "700",
  },
  emptyHeadline: {
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.4,
    marginBottom: 10,
  },
  emptySubhead: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginBottom: 24,
  },
  emptyAddBtn: {
    borderRadius: radii.pill,
    overflow: "hidden",
  },
  emptyBtnGradient: {
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: radii.pill,
  },
  emptyBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },

  // Profile Modal
  profileModalBody: {
    alignItems: "center",
    paddingVertical: 8,
  },
  profileModalAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 12,
  },
  profileModalAvatarFallback: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  profileModalAvatarText: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "700",
  },
  profileModalName: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 2,
  },
  profileModalEmail: {
    fontSize: 13,
    marginBottom: 6,
  },
  profileDemoBadge: {
    fontSize: 11,
    fontStyle: "italic",
    textAlign: "center",
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  cloudSyncBox: {
    width: "100%",
    marginBottom: 20,
    alignItems: "center",
  },
  syncButton: {
    borderRadius: radii.pill,
    overflow: "hidden",
    width: "100%",
    marginBottom: 8,
  },
  syncButtonGradient: {
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: radii.pill,
  },
  syncButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  syncHintText: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 16,
  },
  signOutBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: "700",
  },

  // Add Site Modal
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalDismissOverlay: {
    flex: 1,
  },
  modalSheetWrap: {
    width: "100%",
  },
  modalSheet: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  dragPillHandle: {
    alignItems: "center",
    marginBottom: 16,
  },
  dragPill: {
    width: 44,
    height: 5,
    borderRadius: 3,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  modalCloseCircle: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseText: {
    fontSize: 13,
    fontWeight: "700",
  },
  modalDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 20,
  },
  glassInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  inputPrefixIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  glassInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
  },
  modalActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 10,
  },
  modalCancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: radii.pill,
    borderWidth: 1,
    marginRight: 10,
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  modalSaveBtn: {
    borderRadius: radii.pill,
    overflow: "hidden",
  },
  modalSaveGradient: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: radii.pill,
  },
  modalSaveBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },

  // Site Screen Layout
  siteContentArea: {
    flex: 1,
  },
  webviewNative: {
    flex: 1,
    backgroundColor: "transparent",
  },
  siteFloatingHeaderWrap: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 999,
  },
  siteHeaderGlass: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  siteHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  siteHeaderPillBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  siteHeaderBackArrow: {
    fontSize: 18,
    fontWeight: "800",
    marginRight: 4,
  },
  siteHeaderBackText: {
    fontSize: 13,
    fontWeight: "700",
  },
  siteHeaderTitleContainer: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 10,
  },
  siteHeaderTitle: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  siteHeaderHost: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 1,
  },
  siteHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  siteHeaderIconBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 6,
  },
  siteHeaderActionText: {
    fontSize: 14,
    fontWeight: "700",
  },
  siteHeaderActionIcon: {
    fontSize: 13,
  },
  progressTrack: {
    height: 3,
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 2,
    overflow: "hidden",
    marginTop: 8,
  },
  // Animated progress bar (Reanimated Animated.View, uses LinearGradient as fill)
  progressBarAnimated: {
    height: "100%",
    borderRadius: 2,
    overflow: "hidden",
  },

  // Shimmer / Pulse Skeleton
  shimmerContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    zIndex: 50,
  },
  shimmerCard: {
    width: "100%",
    maxWidth: 380,
  },
  shimmerGlass: {
    padding: 24,
  },
  shimmerContent: {
    alignItems: "center",
  },
  shimmerOrb: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    marginBottom: 16,
  },
  shimmerLineLong: {
    width: "75%",
    height: 16,
    borderRadius: radii.sm,
    marginBottom: 10,
  },
  shimmerLineShort: {
    width: "45%",
    height: 12,
    borderRadius: radii.sm,
  },

  // Error Card
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  errorGlass: {
    width: "100%",
    padding: 24,
  },
  errorInner: {
    alignItems: "center",
  },
  errorOrb: {
    fontSize: 36,
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
    textAlign: "center",
  },
  errorSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 20,
  },
  errorBtnRow: {
    alignItems: "center",
    width: "100%",
  },
  retryBtn: {
    borderRadius: radii.pill,
    overflow: "hidden",
    width: "100%",
    marginBottom: 10,
  },
  retryBtnGradient: {
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: radii.pill,
  },
  retryBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  openBrowserFallbackBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  openBrowserFallbackText: {
    fontSize: 13,
    fontWeight: "600",
  },

  // Subtle background trademark watermark
  trademarkContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 0,
    transform: [{ rotate: "-22deg" }],
  },
  trademarkMonogram: {
    fontSize: 140,
    fontWeight: "900",
    letterSpacing: -6,
    lineHeight: 140,
    textAlign: "center",
    userSelect: "none",
  },
  trademarkText: {
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 12,
    marginTop: -16,
    textAlign: "center",
    userSelect: "none",
  },

  // Developer credit
  devCreditWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 22,
    marginTop: 8,
  },
  devCreditText: {
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: 0.4,
  },
  devCreditAuthor: {
    fontWeight: "700",
  },
  // Categories Bar
  categoryBarPad: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
  },
  categoryBarContent: {
    paddingRight: 16,
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  categoryPillText: {
    fontSize: 13,
  },
  domainChipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  categoryBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  modalCategorySection: {
    marginBottom: 16,
  },
  modalCategoryTitle: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  modalCategoryScroll: {
    flexDirection: "row",
  },
  modalCategoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    marginRight: 8,
  },
  modalCategoryPillText: {
    fontSize: 13,
  },

  // Lock Screen Card
  lockCardGlass: {
    width: "88%",
    maxWidth: 360,
    padding: 28,
  },
  lockCardContent: {
    alignItems: "center",
  },
  lockEmoji: {
    fontSize: 48,
    marginBottom: 14,
  },
  lockTitle: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.3,
    marginBottom: 8,
    textAlign: "center",
  },
  lockSub: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 24,
  },
  unlockBtn: {
    width: "100%",
    borderRadius: radii.pill,
    overflow: "hidden",
  },
  unlockBtnGradient: {
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: radii.pill,
  },
  unlockBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});
