// ──────────────────────────────────────────────────────────────
// Liquid Glass & visionOS Theme Tokens
// Premium Modern Typography, Refined Cards & Dynamic Themes
// ──────────────────────────────────────────────────────────────

export const lightTheme = {
  isDark: false,
  background: "#F6F8FD",
  bgGradient: ["#EDF2FF", "#FAF5FF", "#F0FDF4", "#F8FAFC"],
  blobColors: [
    "rgba(99, 102, 241, 0.22)",  // Electric Indigo
    "rgba(236, 72, 153, 0.18)",  // Soft Rose / Magenta
    "rgba(14, 165, 233, 0.20)",  // Sky Cyan
    "rgba(168, 85, 247, 0.16)",  // Iris Purple
  ],

  // Glass surfaces
  glassBg: "rgba(255, 255, 255, 0.72)",
  glassBgSubtle: "rgba(255, 255, 255, 0.50)",
  glassBgSolid: "rgba(255, 255, 255, 0.90)",
  glassBorder: "rgba(255, 255, 255, 0.90)",
  glassBorderSubtle: "rgba(226, 232, 240, 0.80)",
  glassBorderBottom: "rgba(15, 23, 42, 0.06)",
  glassHighlight: "rgba(255, 255, 255, 0.98)",

  // Blur settings
  blurTint: "light",
  blurIntensity: 60,
  blurIntensityHeavy: 85,

  // Modern Typography Hierarchy
  textPrimary: "#0B1120",
  textSecondary: "#475569",
  textTertiary: "#94A3B8",
  textInverse: "#FFFFFF",

  // Accents
  accent: "#2563EB",
  accentGlow: "rgba(37, 99, 235, 0.20)",
  accentGradient: ["#0284C7", "#2563EB", "#6366F1"],
  fabGradient: ["#2563EB", "#4F46E5"],
  danger: "#EF4444",
  dangerGlass: "rgba(239, 68, 68, 0.12)",
  dangerBorder: "rgba(239, 68, 68, 0.25)",

  // Elevation & Shadows
  glassShadow: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 6,
  },
  glowShadow: {
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 10,
  },
};

export const darkTheme = {
  isDark: true,
  background: "#05070E",
  bgGradient: ["#05070E", "#090E20", "#110D24", "#060812"],
  blobColors: [
    "rgba(99, 102, 241, 0.32)",  // Luminous Indigo
    "rgba(217, 70, 239, 0.24)",  // Vivid Magenta
    "rgba(14, 165, 233, 0.26)",  // Cyan Glow
    "rgba(139, 92, 246, 0.22)",  // Deep Violet
  ],

  // Glass surfaces
  glassBg: "rgba(255, 255, 255, 0.06)",
  glassBgSubtle: "rgba(255, 255, 255, 0.035)",
  glassBgSolid: "rgba(255, 255, 255, 0.12)",
  glassBorder: "rgba(255, 255, 255, 0.13)",
  glassBorderSubtle: "rgba(255, 255, 255, 0.07)",
  glassBorderBottom: "rgba(0, 0, 0, 0.6)",
  glassHighlight: "rgba(255, 255, 255, 0.35)",

  // Blur settings
  blurTint: "dark",
  blurIntensity: 45,
  blurIntensityHeavy: 75,

  // Modern Typography Hierarchy
  textPrimary: "#F8FAFC",
  textSecondary: "#94A3B8",
  textTertiary: "#64748B",
  textInverse: "#0B1120",

  // Accents
  accent: "#38BDF8",
  accentGlow: "rgba(56, 189, 248, 0.25)",
  accentGradient: ["#38BDF8", "#6366F1", "#A855F7"],
  fabGradient: ["#0284C7", "#6366F1"],
  danger: "#F87171",
  dangerGlass: "rgba(239, 68, 68, 0.18)",
  dangerBorder: "rgba(248, 113, 113, 0.30)",

  // Elevation & Shadows
  glassShadow: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.40,
    shadowRadius: 24,
    elevation: 8,
  },
  glowShadow: {
    shadowColor: "#38BDF8",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.30,
    shadowRadius: 20,
    elevation: 12,
  },
};

export const radii = {
  xs: 8,
  sm: 14,
  md: 18,
  lg: 24,
  xl: 30,
  xxl: 36,
  pill: 9999,
};

export default {
  light: lightTheme,
  dark: darkTheme,
  radii,
};
