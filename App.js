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
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
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

// Platform-aware WebView
let WebView = null;
if (Platform.OS !== "web") {
  // eslint-disable-next-line global-require
  WebView = require("react-native-webview").WebView;
}

const STORAGE_KEY = "saved_sites_v1";
const THEME_PREF_KEY = "user_theme_pref_v1";
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

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
  // High-density 128px favicon from Google S2 service
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
// Liquid Glass Background: Animated drifting mesh blobs
// ──────────────────────────────────────────────────────────────
function DriftingBlobs({ theme }) {
  // Shared values for drifting motion
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
    // Gentle liquid movement loops
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

      {/* Subtle, nearly visible background trademark watermark */}
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
// Site Tile: Liquid Glass Card with spring press & inline delete
// ──────────────────────────────────────────────────────────────
function SiteTile({ item, theme, onOpen, onDelete }) {
  const scale = useSharedValue(1);
  const [showConfirm, setShowConfirm] = useState(false);
  const confirmAnim = useSharedValue(0);

  const handlePressIn = () => {
    scale.value = withSpring(0.965, { damping: 14, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 14, stiffness: 300 });
  };

  const toggleConfirm = (e) => {
    e?.stopPropagation?.();
    const next = !showConfirm;
    setShowConfirm(next);
    confirmAnim.value = withSpring(next ? 1 : 0, { damping: 15, stiffness: 220 });
  };

  const handleConfirmDelete = (e) => {
    e?.stopPropagation?.();
    scale.value = withTiming(0.8, { duration: 150 }, () => {
      // deleted
    });
    onDelete(item.id);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const deleteSliderStyle = useAnimatedStyle(() => ({
    opacity: confirmAnim.value,
    transform: [{ translateX: (1 - confirmAnim.value) * 40 }],
  }));

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
              <Text style={[styles.tileName, { color: theme.textPrimary }]} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={[styles.domainChip, { backgroundColor: theme.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }]}>
                <Text style={[styles.tileUrl, { color: theme.textSecondary }]} numberOfLines={1}>
                  {hostnameOf(item.url)}
                </Text>
              </View>
            </View>

            {/* Delete Actions */}
            {showConfirm ? (
              <Animated.View style={[styles.confirmWrap, deleteSliderStyle]}>
                <TouchableOpacity
                  style={[styles.confirmButton, { backgroundColor: theme.danger }]}
                  onPress={handleConfirmDelete}
                >
                  <Text style={styles.confirmText}>Delete</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.cancelButton, { backgroundColor: theme.isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)" }]}
                  onPress={toggleConfirm}
                >
                  <Text style={[styles.cancelText, { color: theme.textSecondary }]}>✕</Text>
                </TouchableOpacity>
              </Animated.View>
            ) : (
              <TouchableOpacity
                style={[
                  styles.dotsButton,
                  { backgroundColor: theme.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)" },
                ]}
                onPress={toggleConfirm}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityLabel="Delete site"
              >
                <Text style={[styles.dotsText, { color: theme.textTertiary }]}>•••</Text>
              </TouchableOpacity>
            )}
          </View>
        </GlassSurface>
      </Pressable>
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
// Home Screen (Liquid Glass VisionOS Style)
// ──────────────────────────────────────────────────────────────
function HomeScreen({ sites, theme, isDark, onToggleTheme, onOpen, onAdd, onDelete }) {
  const [modalVisible, setModalVisible] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const insets = useSafeAreaInsets();

  const resetForm = () => {
    setUrlInput("");
    setNameInput("");
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
    });
    resetForm();
    setModalVisible(false);
  };

  return (
    <View style={styles.screenRoot}>
      {/* Dynamic Drifting Blobs */}
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

              {/* Theme Toggle Button */}
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
                  native app without address bars or clutter.
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
        ) : (
          <FlatList
            data={sites}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <SiteTile
                item={item}
                theme={theme}
                onOpen={onOpen}
                onDelete={onDelete}
              />
            )}
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
                {/* Drag pill handle */}
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
                  custom liquid app view.
                </Text>

                {/* Input Fields */}
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

                {/* Action Buttons */}
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
// Site Screen: Translucent Frosted VisionOS Header over WebView
// ──────────────────────────────────────────────────────────────
function SiteScreen({ site, theme, isDark, onBack }) {
  const webviewRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const insets = useSafeAreaInsets();

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
    if (Platform.OS === "web") {
      setReloadKey((k) => k + 1);
    } else {
      webviewRef.current?.reload();
    }
  };

  return (
    <View style={[styles.screenRoot, { backgroundColor: theme.background }]}>
      <StatusBar style={isDark ? "light" : "dark"} />

      {/* Background blobs visible on borders or loading */}
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
            src={site.url}
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
            source={{ uri: site.url }}
            style={[styles.webviewNative, { marginTop: insets.top + 64 }]}
            startInLoadingState={false}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onLoadProgress={({ nativeEvent }) => setProgress(nativeEvent.progress)}
            onNavigationStateChange={(navState) => setCanGoBack(navState.canGoBack)}
            onError={() => {
              setHasError(true);
              setLoading(false);
            }}
            onHttpError={() => setLoading(false)}
            onShouldStartLoadWithRequest={(request) => isAllowed(request.url, site)}
            pullToRefreshEnabled={config.pullToRefresh}
            allowsBackForwardNavigationGestures
            sharedCookiesEnabled
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

            {/* Site Title and Host pill */}
            <View style={styles.siteHeaderTitleContainer}>
              <Text style={[styles.siteHeaderTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                {site.name}
              </Text>
              <Text style={[styles.siteHeaderHost, { color: theme.textSecondary }]} numberOfLines={1}>
                {hostnameOf(site.url)}
              </Text>
            </View>

            {/* Right Action Controls: Refresh & External link */}
            <View style={styles.siteHeaderActions}>
              <TouchableOpacity
                onPress={retry}
                style={[
                  styles.siteHeaderIconBtn,
                  {
                    backgroundColor: theme.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
                    borderColor: theme.glassBorder,
                  },
                ]}
                accessibilityLabel="Reload site"
              >
                <Text style={[styles.siteHeaderActionText, { color: theme.textSecondary }]}>↻</Text>
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

          {/* Liquid Glass Progress Bar */}
          {config.showProgressBar && loading && !hasError && (
            <View style={styles.progressTrack}>
              <LinearGradient
                colors={theme.accentGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressBar, { width: `${Math.max(progress * 100, 10)}%` }]}
              />
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

  // Theme preference
  const systemScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState("auto"); // "auto" | "light" | "dark"

  const isDark = themeMode === "auto" ? systemScheme === "dark" : themeMode === "dark";
  const theme = isDark ? darkTheme : lightTheme;

  useEffect(() => {
    (async () => {
      try {
        const rawSites = await AsyncStorage.getItem(STORAGE_KEY);
        if (rawSites) setSites(JSON.parse(rawSites));

        const savedTheme = await AsyncStorage.getItem(THEME_PREF_KEY);
        if (savedTheme) setThemeMode(savedTheme);
      } catch (e) {
        // start with clean defaults
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

  const persistSites = useCallback((next) => {
    setSites(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const handleAdd = (site) => persistSites([site, ...sites]);
  const handleDelete = (id) => persistSites(sites.filter((s) => s.id !== id));

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
        {activeSite ? (
          <SiteScreen
            site={activeSite}
            theme={theme}
            isDark={isDark}
            onBack={() => setActiveSite(null)}
          />
        ) : (
          <HomeScreen
            sites={sites}
            theme={theme}
            isDark={isDark}
            onToggleTheme={toggleTheme}
            onOpen={setActiveSite}
            onAdd={handleAdd}
            onDelete={handleDelete}
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
    paddingVertical: 14,
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
    marginTop: 1,
  },
  themeToggle: {
    width: 38,
    height: 38,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  themeToggleIcon: {
    fontSize: 16,
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
  tileName: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
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
  dotsButton: {
    width: 34,
    height: 34,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },
  dotsText: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1,
  },
  confirmWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
  },
  confirmButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
    marginRight: 6,
  },
  confirmText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  cancelButton: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontSize: 11,
    fontWeight: "700",
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
  progressTrack: {
    height: 3,
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 2,
    overflow: "hidden",
    marginTop: 8,
  },
  progressBar: {
    height: "100%",
    borderRadius: 2,
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
});
