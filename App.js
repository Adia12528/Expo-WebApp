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
  AppState,
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
import { forgetSiteLogin, flushCookies, clearAllCookies } from "./services/cookies";
import authService from "./services/auth";
import updatesService, { getUpdateInfo } from "./services/updates";

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
  "criteo.com",
  "adroll.com",
  "amazon-adsystem.com",
  "popads.net"
];
const APP_CATEGORIES = ["All", "Work", "Social", "Dev", "Media", "Finance"];
const BIOMETRIC_STORAGE_KEY = "user_biometric_lock_v1";
const AUTOLOCK_STORAGE_KEY = "user_autolock_timeout_v2";
const SORT_STORAGE_KEY = "portal_sort_mode_v1";

const PRESET_COLORS = [
  "#06B6D4", // Cyan
  "#6366F1", // Indigo
  "#A855F7", // Purple
  "#F43F5E", // Rose
  "#F59E0B", // Amber
  "#10B981", // Emerald
];

const PRESET_EMOJIS = ["🌐", "💼", "💻", "📱", "🎬", "🎵", "📊", "🛒", "📚", "🎮", "⚡", "🔒"];

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
// Glass Favicon Badge (2x/3x density circular glass with custom emoji/color fallback)
// ──────────────────────────────────────────────────────────────
function GlassFavicon({ url, name, theme, color, emoji }) {
  const [error, setError] = useState(false);
  const faviconUrl = getFaviconUrl(url);

  if (emoji) {
    return (
      <View
        style={[
          styles.faviconBadge,
          {
            backgroundColor: color ? `${color}28` : (theme.isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.85)"),
            borderColor: color || theme.glassBorder,
          },
        ]}
      >
        <Text style={styles.customEmojiText}>{emoji}</Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.faviconBadge,
        {
          backgroundColor: color ? `${color}20` : (theme.isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.85)"),
          borderColor: color || theme.glassBorder,
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
          colors={color ? [color, color] : theme.accentGradient}
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
function SiteTile({ item, theme, onOpen, onDelete, onForgetLogin, onPin, onEdit }) {
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
        onLongPress={() => setShowMenu(true)}
        delayLongPress={320}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.tilePressable}
      >
        <GlassSurface
          theme={theme}
          radius={radii.xl}
          style={[
            styles.tileGlass,
            item.pinned && {
              borderColor: theme.isDark ? "rgba(56, 189, 248, 0.45)" : "rgba(37, 99, 235, 0.45)",
              borderWidth: 1.2,
            },
            item.color && {
              borderLeftColor: item.color,
              borderLeftWidth: 3.5,
            },
          ]}
        >
          <View style={styles.tileRow}>
            {/* Favicon with VisionOS squircle badge */}
            <GlassFavicon
              url={item.url}
              name={item.name}
              theme={theme}
              color={item.color}
              emoji={item.emoji}
            />

            {/* Info */}
            <View style={styles.tileInfo}>
              <View style={styles.tileNameRow}>
                <Text style={[styles.tileName, { color: theme.textPrimary }]} numberOfLines={1}>
                  {item.name}
                </Text>
                {item.pinned && (
                  <View style={[styles.pinnedBadgeWrap, { backgroundColor: theme.accentGlow }]}>
                    <Text style={[styles.pinnedBadgeText, { color: theme.accent }]}>Pinned</Text>
                  </View>
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

            {/* Quick Open Chevron */}
            <View style={styles.tileChevronWrap}>
              <Text style={[styles.tileChevron, { color: theme.textTertiary }]}>›</Text>
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

              {/* Edit Portal */}
              <TouchableOpacity
                style={[styles.menuItem, { borderBottomColor: theme.glassBorder, borderBottomWidth: StyleSheet.hairlineWidth }]}
                onPress={() => {
                  setShowMenu(false);
                  if (onEdit) onEdit(item);
                }}
              >
                <Text style={styles.menuItemIcon}>✏️</Text>
                <View>
                  <Text style={[styles.menuItemText, { color: theme.textPrimary }]}>Edit Portal</Text>
                  <Text style={[styles.menuItemDesc, { color: theme.textTertiary }]}>
                    Customize name, category, emoji icon, or accent color
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
                  <Text style={[styles.menuItemText, { color: theme.textPrimary }]}>Clear Site Session & Cookies</Text>
                  <Text style={[styles.menuItemDesc, { color: theme.textTertiary }]}>Wipes cookies and local storage for this portal only</Text>
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
  autoLockTimeout,
  onChangeAutoLockTimeout,
  sortMode = "default",
  onSelectSortMode,
  onToggleBiometric,
  onSignIn,
  onSignOut,
  onSyncCloud,
  onToggleTheme,
  onOpen,
  onAdd,
  onEdit,
  onDelete,
  onForgetLogin,
  onPin,
  updateReady,
  onCheckUpdates,
  onRestartApp,
  onImportSites,
  onClearAllSessions,
}) {
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSite, setEditingSite] = useState(null);
  const [profileModal, setProfileModal] = useState(false);
  const [settingsModal, setSettingsModal] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [importJsonText, setImportJsonText] = useState("");
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [colorInput, setColorInput] = useState("");
  const [emojiInput, setEmojiInput] = useState("");
  const [syncStatus, setSyncStatus] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [categoryInput, setCategoryInput] = useState("All");
  const insets = useSafeAreaInsets();
  const updateInfo = getUpdateInfo();

  const resetForm = () => {
    setUrlInput("");
    setNameInput("");
    setColorInput("");
    setEmojiInput("");
    setCategoryInput("All");
    setEditingSite(null);
  };

  const handleStartEdit = (siteItem) => {
    setEditingSite(siteItem);
    setUrlInput(siteItem.url);
    setNameInput(siteItem.name);
    setCategoryInput(siteItem.category || "All");
    setColorInput(siteItem.color || "");
    setEmojiInput(siteItem.emoji || "");
    setModalVisible(true);
  };

  const handleStartAdd = () => {
    resetForm();
    setModalVisible(true);
  };

  const handleSave = () => {
    const normalized = normalizeUrl(urlInput);
    if (!normalized) {
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.alert("Please paste a valid website link, e.g. example.com");
      }
      return;
    }
    if (editingSite) {
      if (onEdit) {
        onEdit({
          ...editingSite,
          url: normalized,
          name: nameInput.trim() || hostnameOf(normalized),
          category: categoryInput || "All",
          color: colorInput || null,
          emoji: emojiInput || null,
        });
      }
    } else {
      onAdd({
        id: `${Date.now()}`,
        url: normalized,
        name: nameInput.trim() || hostnameOf(normalized),
        category: categoryInput || "All",
        color: colorInput || null,
        emoji: emojiInput || null,
        pinned: false,
        visitCount: 0,
        lastVisited: null,
      });
    }
    resetForm();
    setModalVisible(false);
  };

  const cycleSortMode = () => {
    const modes = ["default", "most_visited", "recent", "az"];
    const nextIdx = (modes.indexOf(sortMode) + 1) % modes.length;
    const next = modes[nextIdx];
    if (onSelectSortMode) onSelectSortMode(next);
  };

  const getSortLabel = (mode) => {
    switch (mode) {
      case "most_visited":
        return "🔥 Visits";
      case "recent":
        return "🕒 Recent";
      case "az":
        return "🔤 A-Z";
      default:
        return "⇅ Sort";
    }
  };

  const triggerCloudSync = async () => {
    setSyncStatus("Syncing...");
    const ok = await onSyncCloud();
    setSyncStatus(ok ? "Synced ✓" : "Sync Failed");
    setTimeout(() => setSyncStatus(""), 2500);
  };

  const handleExportDecks = () => {
    try {
      const exportData = JSON.stringify(sites, null, 2);
      Clipboard.setString(exportData);
      Share.share({
        title: "My Sites Backup",
        message: exportData,
      }).catch(() => {});
      Alert.alert(
        "Decks Exported! 📋",
        `Copied ${sites.length} saved portals to your clipboard. You can also save or share this text backup.`
      );
    } catch (e) {
      Alert.alert("Export Error", "Could not export sites.");
    }
  };

  const handleImportDecks = () => {
    try {
      const parsed = JSON.parse(importJsonText.trim());
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error("Invalid format: expected a list of sites.");
      }
      const valid = parsed.filter((s) => s.url && s.name).map((s) => ({
        id: s.id || `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        url: normalizeUrl(s.url) || s.url,
        name: s.name,
        category: s.category || "All",
        color: s.color || null,
        emoji: s.emoji || null,
        pinned: !!s.pinned,
        visitCount: s.visitCount || 0,
        lastVisited: s.lastVisited || null,
      }));
      if (valid.length === 0) {
        throw new Error("No valid sites found in the backup text.");
      }
      if (onImportSites) onImportSites(valid);
      setImportModal(false);
      setImportJsonText("");
      Alert.alert("Import Successful! ✨", `Successfully restored ${valid.length} portals into your deck.`);
    } catch (err) {
      Alert.alert("Import Notice", `Could not parse backup JSON:\n${err.message || "Invalid JSON"}`);
    }
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

  // ── Apply sorting to unpinned sites ────────────────────────────
  const sortedUnpinned = [...unpinnedSites];
  if (sortMode === "most_visited") {
    sortedUnpinned.sort((a, b) => (b.visitCount || 0) - (a.visitCount || 0));
  } else if (sortMode === "recent") {
    sortedUnpinned.sort((a, b) => {
      const ta = typeof a.lastVisited === "number" ? a.lastVisited : (a.lastVisited ? new Date(a.lastVisited).getTime() : 0);
      const tb = typeof b.lastVisited === "number" ? b.lastVisited : (b.lastVisited ? new Date(b.lastVisited).getTime() : 0);
      return tb - ta;
    });
  } else if (sortMode === "az") {
    sortedUnpinned.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }

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
  if (sortedUnpinned.length > 0 && pinnedSites.length > 0) {
    listData.push({ _type: "sectionHeader", label: "All Sites", key: "__all_header__" });
  }
  sortedUnpinned.forEach((s) => listData.push({ ...s, _type: "site" }));

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
        onEdit={handleStartEdit}
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

                {/* Settings & Updates Hub Button (⚙️) */}
                <TouchableOpacity
                  onPress={() => setSettingsModal(true)}
                  style={[
                    styles.themeToggle,
                    {
                      backgroundColor: theme.isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
                      borderColor: theme.glassBorder,
                      marginRight: 6,
                    },
                  ]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="App Settings & Updates Hub"
                >
                  <Text style={styles.themeToggleIcon}>⚙️</Text>
                  {updateReady && <View style={styles.updateBadgeDot} />}
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

        {/* OTA Update Ready Notification Banner */}
        {updateReady && (
          <View style={styles.updateBannerPad}>
            <GlassSurface theme={theme} radius={radii.pill} style={styles.updateBannerGlass}>
              <View style={styles.updateBannerRow}>
                <Text style={styles.updateBannerIcon}>🚀</Text>
                <View style={styles.updateBannerTextWrap}>
                  <Text style={[styles.updateBannerTitle, { color: theme.textPrimary }]}>
                    New Update Downloaded!
                  </Text>
                  <Text style={[styles.updateBannerSub, { color: theme.textSecondary }]}>
                    Restart to apply changes now.
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.updateBannerBtn, theme.glowShadow]}
                  onPress={onRestartApp}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={theme.fabGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.updateBannerBtnGradient}
                  >
                    <Text style={styles.updateBannerBtnText}>Restart</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </GlassSurface>
          </View>
        )}

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

        {/* Search & Sort Row */}
        <View style={styles.searchBarPad}>
          <View style={styles.searchSortRow}>
            <View style={styles.searchFlex}>
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
            <TouchableOpacity
              style={[
                styles.sortChipBtn,
                {
                  backgroundColor: sortMode !== "default" ? theme.accentGlow : (theme.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)"),
                  borderColor: sortMode !== "default" ? theme.accent : theme.glassBorder,
                },
              ]}
              onPress={cycleSortMode}
              activeOpacity={0.75}
              accessibilityLabel="Cycle sort mode"
            >
              <Text style={[styles.sortChipText, { color: sortMode !== "default" ? theme.accent : theme.textSecondary }]}>
                {getSortLabel(sortMode)}
              </Text>
            </TouchableOpacity>
          </View>
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
                  onPress={handleStartAdd}
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
            onPress={handleStartAdd}
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

        {/* ── Settings & Live Updates Hub Modal (⚙️) ── */}
        <Modal
          visible={settingsModal}
          animationType="fade"
          transparent
          onRequestClose={() => setSettingsModal(false)}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setSettingsModal(false)}>
            <Animated.View
              entering={SlideInDown.springify().damping(18)}
              style={styles.modalSheetWrap}
            >
              <GlassSurface
                theme={theme}
                radius={radii.xxl}
                intensity={theme.blurIntensityHeavy}
                style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 20) + 16, maxHeight: SCREEN_HEIGHT * 0.88 }]}
              >
                <View style={styles.dragPillHandle}>
                  <View style={[styles.dragPill, { backgroundColor: theme.isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)" }]} />
                </View>

                {/* Header Title Row */}
                <View style={styles.settingsModalHeaderRow}>
                  <Text style={[styles.settingsModalTitle, { color: theme.textPrimary }]}>
                    Settings & System Hub
                  </Text>
                  <TouchableOpacity
                    style={[styles.modalCloseCircle, { backgroundColor: theme.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" }]}
                    onPress={() => setSettingsModal(false)}
                  >
                    <Text style={[styles.modalCloseText, { color: theme.textSecondary }]}>✕</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} style={styles.settingsScroll}>
                  {/* ── 1. OTA Live Updates Hub ── */}
                  <View style={styles.settingsSection}>
                    <Text style={[styles.settingsSectionTitle, { color: theme.textSecondary }]}>
                      LIVE APP UPDATES (OTA)
                    </Text>
                    <GlassSurface theme={theme} radius={radii.xl} style={styles.settingsCardGlass}>
                      <View style={styles.settingsCardRow}>
                        <View style={styles.settingsCardIconWrap}>
                          <Text style={styles.settingsCardEmoji}>🚀</Text>
                        </View>
                        <View style={styles.settingsCardTextCol}>
                          <View style={styles.settingsCardBadgeRow}>
                            <Text style={[styles.settingsCardTitle, { color: theme.textPrimary }]}>
                              Over-The-Air Update
                            </Text>
                            <View style={[styles.channelBadge, { backgroundColor: theme.accentGlow }]}>
                              <Text style={[styles.channelBadgeText, { color: theme.accent }]}>
                                {updateInfo.channel || "preview"}
                              </Text>
                            </View>
                          </View>
                          <Text style={[styles.settingsCardSub, { color: theme.textSecondary }]}>
                            {updateReady
                              ? "New version downloaded & ready to apply!"
                              : `Version 1.0.0 • Runtime ${updateInfo.runtimeVersion || "1.0.0"}`}
                          </Text>
                        </View>
                      </View>

                      {updateReady ? (
                        <TouchableOpacity
                          style={[styles.settingsUpdateBtn, theme.glowShadow]}
                          onPress={() => {
                            setSettingsModal(false);
                            onRestartApp();
                          }}
                          activeOpacity={0.85}
                        >
                          <LinearGradient
                            colors={theme.fabGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.settingsUpdateBtnGradient}
                          >
                            <Text style={styles.settingsUpdateBtnText}>🚀 Restart & Apply Update</Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={[
                            styles.settingsUpdateBtn,
                            {
                              backgroundColor: theme.isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
                              borderColor: theme.glassBorder,
                              borderWidth: 1,
                            },
                          ]}
                          onPress={async () => {
                            setIsCheckingUpdates(true);
                            await onCheckUpdates();
                            setIsCheckingUpdates(false);
                          }}
                          disabled={isCheckingUpdates}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.settingsCheckBtnText, { color: theme.accent }]}>
                            {isCheckingUpdates ? "⏳ Connecting to EAS Cloud..." : "🔄 Check for Updates Now"}
                          </Text>
                        </TouchableOpacity>
                      )}
                      <Text style={[styles.settingsHelpText, { color: theme.textTertiary }]}>
                        Downloads latest live features and bug fixes without needing to reinstall the APK.
                      </Text>
                    </GlassSurface>
                  </View>

                  {/* ── 2. Data & Portals Backup ── */}
                  <View style={styles.settingsSection}>
                    <Text style={[styles.settingsSectionTitle, { color: theme.textSecondary }]}>
                      BACKUP & MIGRATION
                    </Text>
                    <GlassSurface theme={theme} radius={radii.xl} style={styles.settingsCardGlass}>
                      <TouchableOpacity
                        style={styles.settingsActionRow}
                        onPress={handleExportDecks}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.settingsActionIcon}>📤</Text>
                        <View style={styles.settingsActionTextCol}>
                          <Text style={[styles.settingsActionTitle, { color: theme.textPrimary }]}>
                            Export Portals Backup
                          </Text>
                          <Text style={[styles.settingsActionSub, { color: theme.textSecondary }]}>
                            Copy all {sites.length} sites as JSON or share to Google Drive / Notes
                          </Text>
                        </View>
                        <Text style={[styles.settingsActionChevron, { color: theme.textTertiary }]}>›</Text>
                      </TouchableOpacity>

                      <View style={[styles.settingsRowDivider, { backgroundColor: theme.glassBorder }]} />

                      <TouchableOpacity
                        style={styles.settingsActionRow}
                        onPress={() => {
                          setSettingsModal(false);
                          setImportModal(true);
                        }}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.settingsActionIcon}>📥</Text>
                        <View style={styles.settingsActionTextCol}>
                          <Text style={[styles.settingsActionTitle, { color: theme.textPrimary }]}>
                            Restore from JSON Backup
                          </Text>
                          <Text style={[styles.settingsActionSub, { color: theme.textSecondary }]}>
                            Paste a JSON export to restore your bookmarks anytime
                          </Text>
                        </View>
                        <Text style={[styles.settingsActionChevron, { color: theme.textTertiary }]}>›</Text>
                      </TouchableOpacity>
                    </GlassSurface>
                  </View>

                  {/* ── 3. Security & Sessions ── */}
                  <View style={styles.settingsSection}>
                    <Text style={[styles.settingsSectionTitle, { color: theme.textSecondary }]}>
                      SECURITY & CACHE
                    </Text>
                    <GlassSurface theme={theme} radius={radii.xl} style={styles.settingsCardGlass}>
                      {/* Biometric Toggle */}
                      <TouchableOpacity
                        style={styles.settingsActionRow}
                        onPress={onToggleBiometric}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.settingsActionIcon}>🔒</Text>
                        <View style={styles.settingsActionTextCol}>
                          <Text style={[styles.settingsActionTitle, { color: theme.textPrimary }]}>
                            Biometric App Lock
                          </Text>
                          <Text style={[styles.settingsActionSub, { color: theme.textSecondary }]}>
                            {biometricEnabled ? "Enabled (Fingerprint / FaceID active)" : "Disabled (App opens freely)"}
                          </Text>
                        </View>
                        <View style={[styles.togglePill, { backgroundColor: biometricEnabled ? theme.accent : (theme.isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)") }]}>
                          <Text style={styles.togglePillText}>{biometricEnabled ? "ON" : "OFF"}</Text>
                        </View>
                      </TouchableOpacity>

                      {/* Biometric Auto-Lock Delay Selector */}
                      {biometricEnabled && (
                        <View style={styles.settingsSubOption}>
                          <Text style={[styles.settingsSubOptionLabel, { color: theme.textSecondary }]}>
                            Auto-Lock When Backgrounded:
                          </Text>
                          <View style={styles.autoLockRow}>
                            {[
                              { id: "immediate", label: "Immediate" },
                              { id: "1min", label: "1 min" },
                              { id: "5min", label: "5 min" },
                              { id: "never", label: "Never" },
                            ].map((opt) => {
                              const isSel = autoLockTimeout === opt.id;
                              return (
                                <TouchableOpacity
                                  key={opt.id}
                                  onPress={() => onChangeAutoLockTimeout && onChangeAutoLockTimeout(opt.id)}
                                  style={[
                                    styles.autoLockSegmentBtn,
                                    {
                                      backgroundColor: isSel
                                        ? theme.accent
                                        : (theme.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)"),
                                      borderColor: isSel ? theme.accent : theme.glassBorder,
                                    },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.autoLockSegmentText,
                                      { color: isSel ? "#FFFFFF" : theme.textSecondary, fontWeight: isSel ? "700" : "500" },
                                    ]}
                                  >
                                    {opt.label}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>
                      )}

                      <View style={[styles.settingsRowDivider, { backgroundColor: theme.glassBorder }]} />

                      {/* Clear All Sessions */}
                      <TouchableOpacity
                        style={styles.settingsActionRow}
                        onPress={() => {
                          Alert.alert(
                            "Wipe All Browsing Data?",
                            "This clears all saved cookies, sessions, and website storage across all portals.",
                            [
                              { text: "Cancel", style: "cancel" },
                              {
                                text: "Wipe All Data",
                                style: "destructive",
                                onPress: onClearAllSessions,
                              },
                            ]
                          );
                        }}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.settingsActionIcon}>🧹</Text>
                        <View style={styles.settingsActionTextCol}>
                          <Text style={[styles.settingsActionTitle, { color: theme.danger }]}>
                            Wipe All Web Sessions
                          </Text>
                          <Text style={[styles.settingsActionSub, { color: theme.textSecondary }]}>
                            Reset all login cookies and offline cache
                          </Text>
                        </View>
                        <Text style={[styles.settingsActionChevron, { color: theme.textTertiary }]}>›</Text>
                      </TouchableOpacity>
                    </GlassSurface>
                  </View>

                  {/* ── 4. Appearance & About ── */}
                  <View style={styles.settingsSection}>
                    <Text style={[styles.settingsSectionTitle, { color: theme.textSecondary }]}>
                      APPEARANCE
                    </Text>
                    <GlassSurface theme={theme} radius={radii.xl} style={styles.settingsCardGlass}>
                      <TouchableOpacity
                        style={styles.settingsActionRow}
                        onPress={onToggleTheme}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.settingsActionIcon}>{isDark ? "🌙" : "☀️"}</Text>
                        <View style={styles.settingsActionTextCol}>
                          <Text style={[styles.settingsActionTitle, { color: theme.textPrimary }]}>
                            Theme Mode
                          </Text>
                          <Text style={[styles.settingsActionSub, { color: theme.textSecondary }]}>
                            Currently: {isDark ? "Midnight OLED (Dark)" : "Frost White (Light)"}
                          </Text>
                        </View>
                        <Text style={[styles.settingsActionToggleText, { color: theme.accent }]}>
                          Switch to {isDark ? "Light" : "Dark"}
                        </Text>
                      </TouchableOpacity>
                    </GlassSurface>
                  </View>

                  {/* Footer Credits */}
                  <View style={styles.settingsFooter}>
                    <Text style={[styles.settingsFooterTitle, { color: theme.textPrimary }]}>
                      {config.appName} • v1.0.0
                    </Text>
                    <Text style={[styles.settingsFooterSub, { color: theme.textTertiary }]}>
                      Liquid Glass VisionOS Portal Launcher
                    </Text>
                    <Text style={[styles.settingsFooterCredit, { color: theme.textTertiary }]}>
                      Developed with ❤️ by Aditya Soni
                    </Text>
                  </View>
                </ScrollView>
              </GlassSurface>
            </Animated.View>
          </Pressable>
        </Modal>

        {/* ── Restore from JSON Backup Modal ── */}
        <Modal
          visible={importModal}
          animationType="fade"
          transparent
          onRequestClose={() => setImportModal(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.modalBackdrop}
          >
            <Pressable style={styles.modalDismissOverlay} onPress={() => setImportModal(false)} />
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
                <View style={styles.modalHeaderRow}>
                  <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                    Restore Portals
                  </Text>
                  <TouchableOpacity
                    style={[styles.modalCloseCircle, { backgroundColor: theme.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" }]}
                    onPress={() => setImportModal(false)}
                  >
                    <Text style={[styles.modalCloseText, { color: theme.textSecondary }]}>✕</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.modalDesc, { color: theme.textSecondary }]}>
                  Paste your exported JSON backup text below to restore your saved portals.
                </Text>

                <View style={[styles.importInputWrap, { borderColor: theme.glassBorder, backgroundColor: theme.isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)" }]}>
                  <TextInput
                    style={[styles.importTextInput, { color: theme.textPrimary }]}
                    placeholder='Paste JSON here (e.g. [{"name":"Google","url":"https://google.com"}])'
                    placeholderTextColor={theme.textTertiary}
                    multiline
                    numberOfLines={5}
                    value={importJsonText}
                    onChangeText={setImportJsonText}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.modalActionRow}>
                  <TouchableOpacity
                    style={[styles.modalCancelBtn, { borderColor: theme.glassBorder }]}
                    onPress={async () => {
                      const clip = await Clipboard.getString();
                      if (clip) setImportJsonText(clip);
                    }}
                  >
                    <Text style={[styles.modalCancelBtnText, { color: theme.accent }]}>
                      📋 Paste
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalSaveBtn}
                    onPress={handleImportDecks}
                  >
                    <LinearGradient
                      colors={theme.fabGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.modalSaveGradient}
                    >
                      <Text style={styles.modalSaveBtnText}>Restore Portals</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </GlassSurface>
            </Animated.View>
          </KeyboardAvoidingView>
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
                    {editingSite ? "Edit Portal" : "Add New Portal"}
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.modalCloseCircle,
                      { backgroundColor: theme.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" },
                    ]}
                    onPress={() => {
                      resetForm();
                      setModalVisible(false);
                    }}
                  >
                    <Text style={[styles.modalCloseText, { color: theme.textSecondary }]}>✕</Text>
                  </TouchableOpacity>
                </View>

                <Text style={[styles.modalDesc, { color: theme.textSecondary }]}>
                  {editingSite
                    ? "Customize portal title, category, emoji icon, or custom accent color."
                    : "Paste any web URL. We will automatically fetch its high-res icon and configure a custom liquid app view with zero stale caches."}
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
                    autoFocus={!editingSite}
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
                  <Text style={[styles.modalCategoryTitle, { color: theme.textSecondary }]}>Category</Text>
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

                {/* Custom Emoji Picker (Optional) */}
                <View style={styles.modalCategorySection}>
                  <Text style={[styles.modalCategoryTitle, { color: theme.textSecondary }]}>Custom Emoji Icon (Optional)</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modalCategoryScroll}>
                    <TouchableOpacity
                      onPress={() => setEmojiInput("")}
                      style={[
                        styles.modalEmojiPill,
                        {
                          backgroundColor: !emojiInput ? theme.accentGlow : (theme.isDark ? "rgba(255, 255, 255, 0.07)" : "rgba(0, 0, 0, 0.05)"),
                          borderColor: !emojiInput ? theme.accent : theme.glassBorder,
                        },
                      ]}
                    >
                      <Text style={[styles.modalEmojiPillText, { color: !emojiInput ? theme.accent : theme.textSecondary }]}>
                        Auto Favicon
                      </Text>
                    </TouchableOpacity>
                    {PRESET_EMOJIS.map((em) => {
                      const isSel = emojiInput === em;
                      return (
                        <TouchableOpacity
                          key={em}
                          onPress={() => setEmojiInput(isSel ? "" : em)}
                          style={[
                            styles.modalEmojiBtn,
                            {
                              backgroundColor: isSel ? theme.accentGlow : (theme.isDark ? "rgba(255, 255, 255, 0.07)" : "rgba(0, 0, 0, 0.05)"),
                              borderColor: isSel ? theme.accent : theme.glassBorder,
                            },
                          ]}
                        >
                          <Text style={styles.modalEmojiChar}>{em}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* Accent Color Picker (Optional) */}
                <View style={styles.modalCategorySection}>
                  <Text style={[styles.modalCategoryTitle, { color: theme.textSecondary }]}>Card Accent Color (Optional)</Text>
                  <View style={styles.modalColorRow}>
                    <TouchableOpacity
                      onPress={() => setColorInput("")}
                      style={[
                        styles.modalColorCircle,
                        {
                          backgroundColor: theme.isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
                          borderColor: !colorInput ? theme.accent : theme.glassBorder,
                          borderWidth: !colorInput ? 2 : 1,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 10, color: theme.textSecondary, fontWeight: "700" }}>AUTO</Text>
                    </TouchableOpacity>
                    {PRESET_COLORS.map((c) => {
                      const isSel = colorInput === c;
                      return (
                        <TouchableOpacity
                          key={c}
                          onPress={() => setColorInput(isSel ? "" : c)}
                          style={[
                            styles.modalColorCircle,
                            {
                              backgroundColor: c,
                              borderColor: isSel ? "#FFFFFF" : "transparent",
                              borderWidth: isSel ? 2.5 : 0,
                            },
                          ]}
                        />
                      );
                    })}
                  </View>
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
                      <Text style={styles.modalSaveBtnText}>
                        {editingSite ? "Save Changes" : "Save Portal"}
                      </Text>
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
// Site Screen: Persistent Logins & Cookies, Progress Bar,
//              OAuth Auto-Assist, Bottom Dock & Deck Switcher
// ──────────────────────────────────────────────────────────────
function SiteScreen({ site, sites = [], theme, isDark, user, onBack, onForgetLogin, onSwitchSite }) {
  const webviewRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [reloadKey, setReloadKey] = useState(() => Date.now());
  const [isDesktop, setIsDesktop] = useState(false);
  const [adBlockEnabled, setAdBlockEnabled] = useState(true);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [loginPromptDismissed, setLoginPromptDismissed] = useState(false);
  const [detectedGoogleBtn, setDetectedGoogleBtn] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [forceDark, setForceDark] = useState(false);
  const [deckSwitcherVisible, setDeckSwitcherVisible] = useState(false);
  const insets = useSafeAreaInsets();

  // Cycle text zoom levels
  const cycleZoom = () => {
    setZoomLevel((prev) => {
      if (prev === 1.0) return 1.15;
      if (prev === 1.15) return 1.30;
      if (prev === 1.30) return 0.90;
      return 1.0;
    });
  };

  // Inject zoom & force dark mode dynamically
  useEffect(() => {
    if (!webviewRef.current || Platform.OS === "web") return;
    const script = `
      (function() {
        try {
          document.body.style.zoom = '${zoomLevel}';
          var darkStyle = document.getElementById('mysites-force-dark-mode');
          if (${forceDark}) {
            if (!darkStyle) {
              darkStyle = document.createElement('style');
              darkStyle.id = 'mysites-force-dark-mode';
              darkStyle.textContent = 'html { filter: invert(0.92) hue-rotate(180deg) !important; background-color: #121212 !important; } img, video, iframe, canvas, svg { filter: invert(1.08) hue-rotate(180deg) !important; }';
              document.head.appendChild(darkStyle);
            }
          } else if (darkStyle) {
            darkStyle.remove();
          }
        } catch(e) {}
      })();
      true;
    `;
    webviewRef.current.injectJavaScript(script);
  }, [zoomLevel, forceDark]);

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

  // Clean, persistent URL: preserve session tokens and avoid URL query-param resets
  const targetUrl = site.url;

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (canGoBack && webviewRef.current) {
        webviewRef.current.goBack();
        return true;
      }
      flushCookies();
      onBack();
      return true;
    });
    return () => {
      sub.remove();
      flushCookies();
    };
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
   * Autofill user's logged-in account email directly into website login fields
   */
  const fillUserEmail = () => {
    if (!user?.email || !webviewRef.current) return;
    const script = `
      (function() {
        try {
          var email = ${JSON.stringify(user.email)};
          var field = document.querySelector('input[type="email"], input[name*="email" i], input[autocomplete="email" i], input[name*="user" i], input[name*="login" i]');
          if (field) {
            field.focus();
            field.value = email;
            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new Event('change', { bubbles: true }));
            var pwd = document.querySelector('input[type="password"]');
            if (pwd) {
              pwd.focus();
            }
          }
        } catch(e) {}
      })();
      true;
    `;
    webviewRef.current.injectJavaScript(script);
    setShowLoginPrompt(false);
    setLoginPromptDismissed(true);
  };

  /**
   * If the webpage has a 'Sign in with Google' button, trigger it with auto-login hint
   */
  const triggerGoogleLogin = () => {
    if (!webviewRef.current) return;
    const script = `
      (function() {
        try {
          var googleBtn = document.querySelector('button[aria-label*="Google" i], a[href*="accounts.google.com"], [data-provider="google"]');
          if (googleBtn) {
            googleBtn.click();
          }
        } catch(e) {}
      })();
      true;
    `;
    webviewRef.current.injectJavaScript(script);
    setShowLoginPrompt(false);
    setLoginPromptDismissed(true);
  };

  /**
   * Handle navigation requests:
   * 1. Intercept Google OAuth/SSO flows to prevent Google's 403 disallowed_useragent error
   * 2. Direct login hint: passes user's app email to Google so user doesn't need to retype or choose
   * 3. Open external links or system browser when needed
   */
  const handleShouldStartLoad = (request) => {
    const navUrl = request.url;

    // Built-in Ad & Tracker Blocker
    if (adBlockEnabled) {
      try {
        const host = new URL(navUrl).hostname.toLowerCase();
        if (AD_BLOCK_DOMAINS.some((d) => host.includes(d))) {
          return false; // Silently drop ad/tracking requests
        }
      } catch (e) {}
    }

    // Check if URL is a Google / Apple / OAuth provider login endpoint
    const isGoogleOAuth =
      /accounts\.google\.com\/(signin|o\/oauth2|ServiceLogin)/i.test(navUrl) ||
      /appleid\.apple\.com\/auth/i.test(navUrl) ||
      /github\.com\/login\/oauth/i.test(navUrl);

    if (isGoogleOAuth) {
      let oauthUrl = navUrl;
      // If user has signed into the app, directly pass login_hint so Google picks their account seamlessly
      if (user?.email && /accounts\.google\.com/i.test(navUrl) && !navUrl.includes("login_hint=")) {
        oauthUrl += (oauthUrl.includes("?") ? "&" : "?") + `login_hint=${encodeURIComponent(user.email)}`;
      }

      // Open in Custom Tabs / Safari so Google authentication succeeds without 403 block
      (async () => {
        try {
          const authResult = await WebBrowser.openAuthSessionAsync(oauthUrl, site.url);
          if (authResult.type === "success" || authResult.type === "dismiss") {
            // Once user logs in, flush cookies to disk and reload the site to pick up the session
            await flushCookies();
            webviewRef.current?.reload();
          }
        } catch (e) {
          Linking.openURL(oauthUrl);
        }
      })();
      return false; // Prevent embedded webview from navigating to blocked OAuth page
    }

    return isAllowed(navUrl, site);
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
            src={targetUrl}
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
            key={reloadKey}
            source={{ uri: targetUrl }}
            style={[styles.webviewNative, { marginTop: insets.top + 64 }]}
            startInLoadingState={false}
            // 1. Persistent Login: Keep cookies, local storage & session state intact
            cacheEnabled={true}
            cacheMode="LOAD_DEFAULT"
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            domStorageEnabled
            databaseEnabled
            saveFormDataDisabled={false}
            // 2. User-Agent setting for Android to avoid embedded webview block
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

                  // Scan page for login / email fields or Google Sign-In buttons
                  function scanLoginFields() {
                    var emailField = document.querySelector('input[type="email"], input[name*="email" i], input[autocomplete="email" i], input[name*="user" i], input[name*="login" i]');
                    var googleBtn = document.querySelector('button[aria-label*="Google" i], a[href*="accounts.google.com"], [data-provider="google"]');
                    if ((emailField || googleBtn) && window.ReactNativeWebView) {
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'LOGIN_FIELD_DETECTED',
                        hasEmail: !!emailField,
                        hasGoogle: !!googleBtn
                      }));
                    }
                  }
                  scanLoginFields();
                  setTimeout(scanLoginFields, 1200);
                  setTimeout(scanLoginFields, 2500);
                } catch(e) {}
              })();
              true;
            `}
            onMessage={(event) => {
              try {
                const data = JSON.parse(event.nativeEvent.data);
                if (data.type === 'LOGIN_FIELD_DETECTED' && user?.email && !loginPromptDismissed) {
                  setShowLoginPrompt(true);
                  if (data.hasGoogle) setDetectedGoogleBtn(true);
                }
              } catch (e) {}
            }}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => {
              setLoading(false);
              flushCookies();
            }}
            onLoadProgress={({ nativeEvent }) => setProgress(nativeEvent.progress)}
            onNavigationStateChange={(navState) => {
              setCanGoBack(navState.canGoBack);
              setCanGoForward(navState.canGoForward);
              flushCookies();
            }}
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

      {/* Quick Login Auto-Assist Pill */}
      {showLoginPrompt && user?.email && !loginPromptDismissed && (
        <Animated.View
          entering={SlideInDown.duration(280)}
          exiting={SlideOutDown.duration(200)}
          style={[
            styles.quickLoginBanner,
            {
              top: insets.top + 74,
              backgroundColor: theme.isDark ? "rgba(15, 23, 42, 0.94)" : "rgba(255, 255, 255, 0.96)",
              borderColor: theme.accent,
            },
          ]}
        >
          <View style={styles.quickLoginLeft}>
            <Text style={styles.quickLoginIcon}>⚡</Text>
            <View style={styles.quickLoginTextCol}>
              <Text style={[styles.quickLoginTitle, { color: theme.textPrimary }]}>
                Sign in with app account?
              </Text>
              <Text style={[styles.quickLoginEmail, { color: theme.accent }]} numberOfLines={1}>
                {user.email}
              </Text>
            </View>
          </View>

          <View style={styles.quickLoginActions}>
            {detectedGoogleBtn && (
              <TouchableOpacity
                style={[
                  styles.quickLoginBtn,
                  {
                    backgroundColor: theme.isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)",
                    borderColor: theme.glassBorder,
                    borderWidth: 1,
                  },
                ]}
                onPress={triggerGoogleLogin}
                activeOpacity={0.8}
              >
                <Text style={[styles.quickLoginBtnText, { color: theme.textPrimary }]}>Google</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.quickLoginBtn, { backgroundColor: theme.accent }]}
              onPress={fillUserEmail}
              activeOpacity={0.8}
            >
              <Text style={styles.quickLoginBtnText}>Auto-Fill</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickLoginCloseBtn}
              onPress={() => {
                setShowLoginPrompt(false);
                setLoginPromptDismissed(true);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.quickLoginCloseText, { color: theme.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

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

            {/* Site Title and Host chip (tap to switch portals) */}
            <TouchableOpacity
              style={styles.siteHeaderTitleContainer}
              onPress={() => setDeckSwitcherVisible(true)}
              activeOpacity={0.7}
            >
              <View style={styles.siteHeaderTitleRowFlex}>
                <Text style={[styles.siteHeaderTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                  {site.name}
                </Text>
                {sites.length > 1 && (
                  <Text style={[styles.siteHeaderChevronDown, { color: theme.accent }]}>▾</Text>
                )}
              </View>
              <Text style={[styles.siteHeaderHost, { color: theme.textSecondary }]} numberOfLines={1}>
                {hostnameOf(site.url)}
              </Text>
            </TouchableOpacity>

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

      {/* VisionOS Floating Bottom Navigation Dock (Arc / Safari Style) */}
      <View style={[styles.siteBottomDockWrap, { bottom: Math.max(insets.bottom, 12) + 6 }]}>
        <GlassSurface
          theme={theme}
          radius={radii.pill}
          intensity={theme.blurIntensityHeavy}
          style={styles.siteBottomDockGlass}
        >
          <View style={styles.siteBottomDockRow}>
            {/* Back in History */}
            <TouchableOpacity
              style={[styles.dockBtn, !canGoBack && styles.dockBtnDisabled]}
              onPress={() => canGoBack && webviewRef.current?.goBack()}
              disabled={!canGoBack}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Back in page history"
            >
              <Text style={[styles.dockBtnText, { color: canGoBack ? theme.textPrimary : theme.textTertiary }]}>
                ‹
              </Text>
            </TouchableOpacity>

            {/* Forward in History */}
            <TouchableOpacity
              style={[styles.dockBtn, !canGoForward && styles.dockBtnDisabled]}
              onPress={() => canGoForward && webviewRef.current?.goForward()}
              disabled={!canGoForward}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Forward in page history"
            >
              <Text style={[styles.dockBtnText, { color: canGoForward ? theme.textPrimary : theme.textTertiary }]}>
                ›
              </Text>
            </TouchableOpacity>

            <View style={[styles.dockDivider, { backgroundColor: theme.glassBorder }]} />

            {/* Text Zoom Control */}
            <TouchableOpacity
              style={[
                styles.dockPillBtn,
                zoomLevel !== 1.0 && { backgroundColor: theme.accentGlow },
              ]}
              onPress={cycleZoom}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Adjust text zoom"
            >
              <Text style={[styles.dockPillText, { color: zoomLevel !== 1.0 ? theme.accent : theme.textSecondary }]}>
                {zoomLevel === 1.0 ? "100%" : `${Math.round(zoomLevel * 100)}%`}
              </Text>
            </TouchableOpacity>

            {/* Force Dark Mode Toggle */}
            <TouchableOpacity
              style={[
                styles.dockPillBtn,
                forceDark && { backgroundColor: theme.accentGlow },
              ]}
              onPress={() => setForceDark((prev) => !prev)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Force high-contrast dark mode"
            >
              <Text style={[styles.dockPillText, { color: forceDark ? theme.accent : theme.textSecondary }]}>
                {forceDark ? "🌙 Dark" : "☀️ Page"}
              </Text>
            </TouchableOpacity>

            <View style={[styles.dockDivider, { backgroundColor: theme.glassBorder }]} />

            {/* Share Page */}
            <TouchableOpacity
              style={styles.dockBtn}
              onPress={() => {
                Share.share({
                  title: site.name,
                  message: `${site.name} - ${site.url}`,
                  url: site.url,
                }).catch(() => {});
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Share site"
            >
              <Text style={[styles.dockBtnIcon, { color: theme.textSecondary }]}>↗</Text>
            </TouchableOpacity>

            {/* Home Portal Button */}
            <TouchableOpacity
              style={[styles.dockBtnHome, { backgroundColor: theme.accentGlow }]}
              onPress={onBack}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Return to Decks"
            >
              <Text style={[styles.dockBtnIcon, { color: theme.accent }]}>🏠</Text>
            </TouchableOpacity>
          </View>
        </GlassSurface>
      </View>

      {/* Quick Deck Switcher Modal */}
      <Modal
        visible={deckSwitcherVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setDeckSwitcherVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setDeckSwitcherVisible(false)}>
          <Animated.View
            entering={SlideInDown.springify().damping(18)}
            style={styles.modalSheetWrap}
          >
            <GlassSurface
              theme={theme}
              radius={radii.xxl}
              intensity={theme.blurIntensityHeavy}
              style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 20) + 16, maxHeight: SCREEN_HEIGHT * 0.72 }]}
            >
              <View style={styles.dragPillHandle}>
                <View style={[styles.dragPill, { backgroundColor: theme.isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)" }]} />
              </View>

              <View style={styles.settingsModalHeaderRow}>
                <Text style={[styles.settingsModalTitle, { color: theme.textPrimary }]}>
                  Switch Portal
                </Text>
                <TouchableOpacity
                  style={[styles.modalCloseCircle, { backgroundColor: theme.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" }]}
                  onPress={() => setDeckSwitcherVisible(false)}
                >
                  <Text style={[styles.modalCloseText, { color: theme.textSecondary }]}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={styles.switcherScroll}>
                {sites.map((s) => {
                  const isCurrent = s.id === site.id;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={[
                        styles.switcherItemRow,
                        isCurrent && {
                          backgroundColor: theme.accentGlow,
                          borderColor: theme.accent,
                          borderWidth: 1,
                        },
                      ]}
                      onPress={() => {
                        setDeckSwitcherVisible(false);
                        if (!isCurrent && onSwitchSite) {
                          onSwitchSite(s);
                        }
                      }}
                    >
                      <GlassFavicon url={s.url} name={s.name} theme={theme} />
                      <View style={styles.switcherItemTextCol}>
                        <Text style={[styles.switcherItemName, { color: theme.textPrimary }]} numberOfLines={1}>
                          {s.name}
                        </Text>
                        <Text style={[styles.switcherItemUrl, { color: theme.textSecondary }]} numberOfLines={1}>
                          {hostnameOf(s.url)}
                        </Text>
                      </View>
                      {isCurrent ? (
                        <View style={[styles.currentPill, { backgroundColor: theme.accent }]}>
                          <Text style={styles.currentPillText}>Active</Text>
                        </View>
                      ) : (
                        <Text style={[styles.switcherItemChevron, { color: theme.textTertiary }]}>›</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </GlassSurface>
          </Animated.View>
        </Pressable>
      </Modal>
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
  const [updateReady, setUpdateReady] = useState(false);
  const [sortMode, setSortMode] = useState("default");
  const [autoLockTimeout, setAutoLockTimeout] = useState("immediate");
  // Known Google accounts for fast sign-in picker
  const [knownAccounts, setKnownAccounts] = useState([]);
  const [accountPickerVisible, setAccountPickerVisible] = useState(false);

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

        // Load sort mode and auto-lock preference
        const savedSort = await AsyncStorage.getItem(SORT_STORAGE_KEY);
        if (savedSort) setSortMode(savedSort);
        const savedAutoLock = await AsyncStorage.getItem(AUTOLOCK_STORAGE_KEY);
        if (savedAutoLock) setAutoLockTimeout(savedAutoLock);

        // Load previously signed-in Google accounts for fast picker
        const known = await authService.getKnownAccounts();
        if (known?.length > 0) setKnownAccounts(known);

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

  // Background auto-check for OTA updates on launch and resume
  useEffect(() => {
    let mounted = true;
    const checkUpdates = async () => {
      const downloaded = await updatesService.checkAndDownloadUpdate({ silent: true });
      if (mounted && downloaded) {
        setUpdateReady(true);
      }
    };

    // Delay initial check slightly so app startup is buttery smooth
    const timer = setTimeout(checkUpdates, 2500);

    // Also check when app comes to foreground
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        checkUpdates();
      }
    });

    return () => {
      mounted = false;
      clearTimeout(timer);
      sub.remove();
    };
  }, []);

  const handleCheckUpdates = async () => {
    const downloaded = await updatesService.checkAndDownloadUpdate({ silent: false });
    if (downloaded) {
      setUpdateReady(true);
    }
  };

  const handleRestartApp = () => {
    updatesService.promptRestartPermission();
  };

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

  // ── Google Sign-In: smart account picker ──────────────────────
  // Core sign-in routine — accepts an optional loginHint (email) so that
  // returning users skip the Google account picker entirely.
  const executeSignIn = async (loginHint = undefined) => {
    try {
      const profile = await authService.promptGoogleSignIn({ loginHint });
      if (profile) {
        setUser(profile);
        // Keep knownAccounts in sync (saveKnownAccount is idempotent for demos)
        const updated = await authService.getKnownAccounts();
        setKnownAccounts(updated);
        // Sync existing sites to cloud
        await authService.syncSitesToCloud(profile, sites);
        if (profile.isDemo) {
          Alert.alert(
            "Signed In (Demo)",
            "You are signed in as Demo User. Your deck will now sync locally."
          );
        } else {
          Alert.alert("Signed In", `Welcome back, ${profile.name}! 👋`);
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

  // Called when the user taps the Sign In button in the header.
  // If there are previously used accounts, show the fast-picker bottom sheet.
  // Otherwise go directly to the Google browser flow.
  const handleSignIn = async () => {
    const known = await authService.getKnownAccounts();
    setKnownAccounts(known);
    if (known.length > 0) {
      setAccountPickerVisible(true);
    } else {
      await executeSignIn();
    }
  };

  const handleSignOut = async () => {
    if (user?.email) await authService.removeKnownAccount(user.email);
    await authService.signOutUser();
    setUser(null);
  };

  const handleSyncCloud = async () => {
    if (!user) return false;
    return await authService.syncSitesToCloud(user, sites);
  };

  // Edit an existing site (preserves all fields including color, emoji)
  const handleEdit = (updatedSite) => {
    persistSites(sites.map((s) => s.id === updatedSite.id ? { ...s, ...updatedSite } : s));
  };

  // Sort mode persistence
  const handleChangeSortMode = (mode) => {
    setSortMode(mode);
    AsyncStorage.setItem(SORT_STORAGE_KEY, mode).catch(() => {});
  };

  // Auto-lock timeout persistence
  const handleChangeAutoLockTimeout = async (timeout) => {
    setAutoLockTimeout(timeout);
    await AsyncStorage.setItem(AUTOLOCK_STORAGE_KEY, timeout).catch(() => {});
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
            sites={sites}
            theme={theme}
            isDark={isDark}
            user={user}
            onBack={() => {
              flushCookies();
              setActiveSite(null);
            }}
            onForgetLogin={handleForgetLogin}
            onSwitchSite={(newSite) => {
              flushCookies();
              handleOpen(newSite);
            }}
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
            onEdit={handleEdit}
            sortMode={sortMode}
            onSelectSortMode={handleChangeSortMode}
            autoLockTimeout={autoLockTimeout}
            onChangeAutoLockTimeout={handleChangeAutoLockTimeout}
            updateReady={updateReady}
            onCheckUpdates={handleCheckUpdates}
            onRestartApp={handleRestartApp}
            onImportSites={(importedSites) => {
              const combined = [...importedSites, ...sites.filter((s) => !importedSites.some((i) => i.url === s.url))];
              persistSites(combined);
            }}
            onClearAllSessions={async () => {
              await clearAllCookies();
              Alert.alert("Sessions Cleared", "All browsing sessions, cookies, and website data have been cleared.");
            }}
          />
        )}

        {/* ── Google Account Picker Modal ──────────────────────────── */}
        <Modal
          visible={accountPickerVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setAccountPickerVisible(false)}
        >
          <Pressable
            style={styles.accountPickerBackdrop}
            onPress={() => setAccountPickerVisible(false)}
          >
            <Pressable style={styles.accountPickerSheetOuter} onPress={() => {}}>
              <GlassSurface theme={theme} radius={radii.xxl} style={styles.accountPickerSheet}>
                {/* Handle bar */}
                <View style={[styles.accountPickerHandle, { backgroundColor: theme.glassBorder }]} />

                {/* Google G header */}
                <View style={styles.accountPickerHeader}>
                  <LinearGradient
                    colors={["#4285F4", "#34A853"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.accountPickerGIcon}
                  >
                    <Text style={styles.accountPickerGText}>G</Text>
                  </LinearGradient>
                  <View style={styles.accountPickerHeaderText}>
                    <Text style={[styles.accountPickerTitle, { color: theme.textPrimary }]}>
                      Sign in with Google
                    </Text>
                    <Text style={[styles.accountPickerSub, { color: theme.textSecondary }]}>
                      Choose an account or add a new one
                    </Text>
                  </View>
                </View>

                {/* Saved accounts list */}
                <ScrollView style={styles.accountPickerList} showsVerticalScrollIndicator={false}>
                  {knownAccounts.map((acct, idx) => (
                    <TouchableOpacity
                      key={acct.email}
                      style={[
                        styles.accountPickerRow,
                        idx < knownAccounts.length - 1 && {
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: theme.glassBorder,
                        },
                      ]}
                      activeOpacity={0.7}
                      onPress={async () => {
                        setAccountPickerVisible(false);
                        await executeSignIn(acct.email);
                      }}
                    >
                      {/* Avatar */}
                      {acct.picture ? (
                        <Image source={{ uri: acct.picture }} style={styles.accountPickerAvatar} />
                      ) : (
                        <LinearGradient
                          colors={theme.fabGradient}
                          style={styles.accountPickerAvatarFallback}
                        >
                          <Text style={styles.accountPickerAvatarText}>
                            {(acct.name || acct.email)[0].toUpperCase()}
                          </Text>
                        </LinearGradient>
                      )}
                      {/* Info */}
                      <View style={styles.accountPickerInfo}>
                        <Text style={[styles.accountPickerName, { color: theme.textPrimary }]} numberOfLines={1}>
                          {acct.name || acct.email}
                        </Text>
                        <Text style={[styles.accountPickerEmail, { color: theme.textSecondary }]} numberOfLines={1}>
                          {acct.email}
                        </Text>
                      </View>
                      {/* Quick-sign indicator */}
                      <View style={[styles.accountPickerQuickBadge, { backgroundColor: theme.accent + "22" }]}>
                        <Text style={[styles.accountPickerQuickText, { color: theme.accent }]}>
                          ⚡ Quick
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Divider + "Use another account" */}
                <View style={[styles.accountPickerDivider, { backgroundColor: theme.glassBorder }]} />
                <TouchableOpacity
                  style={styles.accountPickerAddRow}
                  activeOpacity={0.7}
                  onPress={async () => {
                    setAccountPickerVisible(false);
                    await executeSignIn(); // No hint → shows Google's account chooser
                  }}
                >
                  <View style={[styles.accountPickerAddIcon, { borderColor: theme.glassBorder }]}>
                    <Text style={[styles.accountPickerAddPlus, { color: theme.accent }]}>＋</Text>
                  </View>
                  <Text style={[styles.accountPickerAddText, { color: theme.textPrimary }]}>
                    Use another account
                  </Text>
                </TouchableOpacity>

                {/* Cancel */}
                <TouchableOpacity
                  style={[styles.accountPickerCancelBtn, { borderColor: theme.glassBorder }]}
                  onPress={() => setAccountPickerVisible(false)}
                >
                  <Text style={[styles.accountPickerCancelText, { color: theme.textSecondary }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </GlassSurface>
            </Pressable>
          </Pressable>
        </Modal>
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
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  headerSubtitleText: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 1.5,
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
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  searchBarRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  searchBarIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  searchBarInput: {
    flex: 1,
    fontSize: 14.5,
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
    marginRight: 9,
  },
  recentPillGlass: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  recentPillRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  recentPillFavicon: {
    width: 20,
    height: 20,
    borderRadius: 6,
    marginRight: 8,
  },
  recentPillFaviconFallback: {
    width: 20,
    height: 20,
    borderRadius: 6,
    marginRight: 8,
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
    borderRadius: radii.xl,
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
    borderRadius: 14,
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
    fontWeight: "800",
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
    fontSize: 16.5,
    fontWeight: "700",
    letterSpacing: -0.3,
    flex: 1,
  },
  pinnedBadgeWrap: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.xs,
    marginLeft: 6,
  },
  pinnedBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  domainChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 2.5,
    borderRadius: radii.xs,
    marginTop: 4,
  },
  tileUrl: {
    fontSize: 11.5,
    fontWeight: "600",
  },
  tileVisitLabel: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 3,
  },
  tileChevronWrap: {
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  tileChevron: {
    fontSize: 22,
    fontWeight: "300",
  },
  dotsButton: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
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
    paddingHorizontal: 16,
    paddingVertical: 7.5,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  categoryPillText: {
    fontSize: 13,
    letterSpacing: -0.1,
  },
  domainChipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.xs,
  },
  categoryBadgeText: {
    fontSize: 10.5,
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

  // OTA Update Banner Styles
  updateBannerPad: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 6,
  },
  updateBannerGlass: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  updateBannerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  updateBannerIcon: {
    fontSize: 22,
    marginRight: 10,
  },
  updateBannerTextWrap: {
    flex: 1,
  },
  updateBannerTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  updateBannerSub: {
    fontSize: 11,
    marginTop: 1,
  },
  updateBannerBtn: {
    borderRadius: radii.pill,
    overflow: "hidden",
    marginLeft: 10,
  },
  updateBannerBtnGradient: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  updateBannerBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },

  // Quick Login Auto-Assist Banner in WebView
  quickLoginBanner: {
    position: "absolute",
    left: 14,
    right: 14,
    zIndex: 998,
    borderRadius: radii.xl,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
  },
  quickLoginLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
  quickLoginIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  quickLoginTextCol: {
    flex: 1,
  },
  quickLoginTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  quickLoginEmail: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 1,
  },
  quickLoginActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  quickLoginBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.md,
  },
  quickLoginBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  quickLoginCloseBtn: {
    padding: 6,
  },
  quickLoginCloseText: {
    fontSize: 14,
    fontWeight: "600",
  },

  // Notification badge dot on header settings icon
  updateBadgeDot: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
  },

  // In-WebView Header Title Row with chevron
  siteHeaderTitleRowFlex: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  siteHeaderChevronDown: {
    fontSize: 12,
    marginLeft: 4,
    fontWeight: "800",
  },

  // VisionOS Bottom Navigation Dock
  siteBottomDockWrap: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 999,
    alignItems: "center",
  },
  siteBottomDockGlass: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: "100%",
    maxWidth: 440,
  },
  siteBottomDockRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dockBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  dockBtnDisabled: {
    opacity: 0.35,
  },
  dockBtnText: {
    fontSize: 22,
    fontWeight: "600",
  },
  dockBtnIcon: {
    fontSize: 16,
  },
  dockBtnHome: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  dockDivider: {
    width: 1,
    height: 20,
    marginHorizontal: 2,
  },
  dockPillBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  dockPillText: {
    fontSize: 12,
    fontWeight: "700",
  },

  // Quick Deck Switcher Modal
  switcherScroll: {
    maxHeight: 380,
  },
  switcherItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radii.lg,
    marginBottom: 8,
  },
  switcherItemTextCol: {
    flex: 1,
  },
  switcherItemName: {
    fontSize: 15,
    fontWeight: "700",
  },
  switcherItemUrl: {
    fontSize: 11.5,
    fontWeight: "500",
    marginTop: 2,
  },
  currentPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.xs,
  },
  currentPillText: {
    color: "#fff",
    fontSize: 10.5,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  switcherItemChevron: {
    fontSize: 20,
    marginLeft: 8,
  },

  // Settings & Updates Hub Sheet
  settingsModalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  settingsModalTitle: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  settingsScroll: {
    maxHeight: 520,
  },
  settingsSection: {
    marginBottom: 18,
  },
  settingsSectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 8,
    marginLeft: 4,
  },
  settingsCardGlass: {
    padding: 16,
  },
  settingsCardRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  settingsCardIconWrap: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  settingsCardEmoji: {
    fontSize: 22,
  },
  settingsCardTextCol: {
    flex: 1,
  },
  settingsCardBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  settingsCardTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  channelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.xs,
  },
  channelBadgeText: {
    fontSize: 10.5,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  settingsCardSub: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  settingsUpdateBtn: {
    borderRadius: radii.pill,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  settingsUpdateBtnGradient: {
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  settingsUpdateBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  settingsCheckBtnText: {
    fontSize: 13.5,
    fontWeight: "700",
    paddingVertical: 11,
    textAlign: "center",
  },
  settingsHelpText: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 8,
    textAlign: "center",
  },
  settingsActionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  settingsActionIcon: {
    fontSize: 20,
    marginRight: 14,
  },
  settingsActionTextCol: {
    flex: 1,
  },
  settingsActionTitle: {
    fontSize: 14.5,
    fontWeight: "700",
  },
  settingsActionSub: {
    fontSize: 11.5,
    marginTop: 2,
    lineHeight: 15,
  },
  settingsActionChevron: {
    fontSize: 20,
    marginLeft: 8,
  },
  settingsActionToggleText: {
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 8,
  },
  settingsRowDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 4,
  },
  togglePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    marginLeft: 8,
  },
  togglePillText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },
  settingsFooter: {
    alignItems: "center",
    paddingVertical: 20,
    paddingBottom: 30,
  },
  settingsFooterTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  settingsFooterSub: {
    fontSize: 12,
    marginTop: 2,
  },
  settingsFooterCredit: {
    fontSize: 11,
    marginTop: 4,
  },

  // Import JSON Modal
  importInputWrap: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
  },
  importTextInput: {
    fontSize: 13,
    minHeight: 100,
    textAlignVertical: "top",
  },

  // Sort Chip + Search Row
  searchSortRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  searchFlex: { flex: 1 },
  sortChipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sortChipText: { fontSize: 12.5, fontWeight: "700" },

  // Settings sub-options (auto-lock)
  settingsSubOption: { paddingTop: 8, paddingBottom: 4 },
  settingsSubOptionLabel: { fontSize: 11.5, fontWeight: "600", marginBottom: 8 },
  autoLockRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  autoLockSegmentBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  autoLockSegmentText: { fontSize: 12 },

  // Add/Edit modal — emoji & color pickers
  modalEmojiPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    marginRight: 6,
  },
  modalEmojiPillText: { fontSize: 12, fontWeight: "600" },
  modalEmojiBtn: {
    width: 38,
    height: 38,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginRight: 6,
  },
  modalEmojiChar: { fontSize: 20 },
  modalColorRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  modalColorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  customEmojiText: { fontSize: 22 },

  // ── Google Account Picker Sheet ─────────────────────────────
  accountPickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  accountPickerSheetOuter: {
    // prevent backdrop tap from propagating through the sheet
  },
  accountPickerSheet: {
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 28,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  accountPickerHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
    opacity: 0.4,
  },
  accountPickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
    gap: 14,
  },
  accountPickerGIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  accountPickerGText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  accountPickerHeaderText: {
    flex: 1,
  },
  accountPickerTitle: {
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  accountPickerSub: {
    fontSize: 12.5,
    marginTop: 2,
  },
  accountPickerList: {
    maxHeight: 260,
  },
  accountPickerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
  },
  accountPickerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  accountPickerAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  accountPickerAvatarText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
  },
  accountPickerInfo: {
    flex: 1,
  },
  accountPickerName: {
    fontSize: 15,
    fontWeight: "700",
  },
  accountPickerEmail: {
    fontSize: 12,
    marginTop: 2,
  },
  accountPickerQuickBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  accountPickerQuickText: {
    fontSize: 11,
    fontWeight: "700",
  },
  accountPickerDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 10,
  },
  accountPickerAddRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
  },
  accountPickerAddIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  accountPickerAddPlus: {
    fontSize: 22,
    fontWeight: "300",
    lineHeight: 26,
  },
  accountPickerAddText: {
    fontSize: 15,
    fontWeight: "600",
  },
  accountPickerCancelBtn: {
    marginTop: 10,
    paddingVertical: 13,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: "center",
  },
  accountPickerCancelText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
