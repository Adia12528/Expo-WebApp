// ──────────────────────────────────────────────────────────────
// Liquid Glass & visionOS Theme Tokens
// ──────────────────────────────────────────────────────────────

export const lightTheme = {
  isDark: false,
  background: "#F4F6FB",
  bgGradient: ["#F0F4FF", "#FDF2F8", "#EEF2FF", "#F8FAFC"],
  blobColors: [
    "rgba(99, 102, 241, 0.28)",  // Indigo
    "rgba(236, 72, 153, 0.22)",  // Fuchsia / Pink
    "rgba(56, 189, 248, 0.25)",  // Sky Cyan
    "rgba(168, 85, 247, 0.20)",  // Purple
  ],

  // Glass surfaces
  glassBg: "rgba(255, 255, 255, 0.68)",
  glassBgSubtle: "rgba(255, 255, 255, 0.45)",
  glassBgSolid: "rgba(255, 255, 255, 0.85)",
  glassBorder: "rgba(255, 255, 255, 0.85)",
  glassBorderSubtle: "rgba(255, 255, 255, 0.5)",
  glassBorderBottom: "rgba(0, 0, 0, 0.05)",
  glassHighlight: "rgba(255, 255, 255, 0.95)",

  // Blur settings
  blurTint: "light",
  blurIntensity: 65,
  blurIntensityHeavy: 85,

  // Text
  textPrimary: "#0F172A",
  textSecondary: "#64748B",
  textTertiary: "#94A3B8",
  textInverse: "#FFFFFF",

  // Accents
  accent: "#3B82F6",
  accentGlow: "rgba(59, 130, 246, 0.35)",
  accentGradient: ["#38BDF8", "#3B82F6", "#6366F1"],
  fabGradient: ["rgba(59, 130, 246, 0.9)", "rgba(99, 102, 241, 0.9)"],
  danger: "#EF4444",
  dangerGlass: "rgba(239, 68, 68, 0.15)",
  dangerBorder: "rgba(239, 68, 68, 0.3)",

  // Shadows
  glassShadow: {
    shadowColor: "#1E293B",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 8,
  },
  glowShadow: {
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 10,
  },
};

export const darkTheme = {
  isDark: true,
  background: "#080B14",
  bgGradient: ["#070A12", "#0D1127", "#130E26", "#090C18"],
  blobColors: [
    "rgba(99, 102, 241, 0.35)",  // Luminous Indigo
    "rgba(217, 70, 239, 0.28)",  // Magenta
    "rgba(14, 165, 233, 0.30)",  // Vivid Cyan
    "rgba(139, 92, 246, 0.25)",  // Deep Violet
  ],

  // Glass surfaces
  glassBg: "rgba(255, 255, 255, 0.07)",
  glassBgSubtle: "rgba(255, 255, 255, 0.04)",
  glassBgSolid: "rgba(255, 255, 255, 0.14)",
  glassBorder: "rgba(255, 255, 255, 0.16)",
  glassBorderSubtle: "rgba(255, 255, 255, 0.09)",
  glassBorderBottom: "rgba(0, 0, 0, 0.4)",
  glassHighlight: "rgba(255, 255, 255, 0.4)",

  // Blur settings
  blurTint: "dark",
  blurIntensity: 50,
  blurIntensityHeavy: 80,

  // Text
  textPrimary: "#F8FAFC",
  textSecondary: "#94A3B8",
  textTertiary: "#64748B",
  textInverse: "#0F172A",

  // Accents
  accent: "#60A5FA",
  accentGlow: "rgba(96, 165, 250, 0.45)",
  accentGradient: ["#38BDF8", "#818CF8", "#C084FC"],
  fabGradient: ["rgba(56, 189, 248, 0.85)", "rgba(129, 140, 248, 0.85)"],
  danger: "#F87171",
  dangerGlass: "rgba(239, 68, 68, 0.22)",
  dangerBorder: "rgba(248, 113, 113, 0.35)",

  // Shadows
  glassShadow: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 10,
  },
  glowShadow: {
    shadowColor: "#38BDF8",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 22,
    elevation: 12,
  },
};

export const radii = {
  sm: 12,
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
