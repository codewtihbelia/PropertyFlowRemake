import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useColorScheme, StatusBar, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationBar } from "../utils/safeNavigationBar";

export type ThemeMode = "light" | "dark" | "system";

export interface ThemeColors {
  background: string;
  card: string;
  cardElevated: string;
  cardSecondary: string;
  surface: string;
  surfaceInset: string;
  border: string;
  borderSubtle: string;
  borderHighlighted: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryLight: string;
  primaryDark: string;
  accent: string;
  success: string;
  successLight: string;
  warning: string;
  warningLight: string;
  danger: string;
  dangerLight: string;
  navBackground: string;
  navBorder: string;
  navIconInactive: string;
  navIconActive: string;
  statusBar: "light-content" | "dark-content";
}

export const lightColors: ThemeColors = {
  background: "#F8FAFC",
  card: "#FFFFFF",
  cardElevated: "#FFFFFF",
  cardSecondary: "#F1F5F9",
  surface: "#FFFFFF",
  surfaceInset: "#F1F5F9",
  border: "#E2E8F0",
  borderSubtle: "#F1F5F9",
  borderHighlighted: "rgba(37, 99, 235, 0.35)",
  text: "#0F172A",
  textSecondary: "#475569",
  textMuted: "#94A3B8",
  primary: "#2563EB",
  primaryLight: "#EFF6FF",
  primaryDark: "#1D4ED8",
  accent: "#3B82F6",
  success: "#10B981",
  successLight: "#ECFDF5",
  warning: "#F59E0B",
  warningLight: "#FEF3C7",
  danger: "#EF4444",
  dangerLight: "#FEF2F2",
  navBackground: "rgba(255, 255, 255, 0.96)",
  navBorder: "rgba(241, 245, 249, 0.95)",
  navIconInactive: "#64748B",
  navIconActive: "#FFFFFF",
  statusBar: "dark-content",
};

export const darkColors: ThemeColors = {
  background: "#111215",
  card: "#1A1C21",
  cardElevated: "#20232A",
  cardSecondary: "#15171C",
  surface: "#1A1C21",
  surfaceInset: "#131418",
  border: "rgba(255, 255, 255, 0.07)",
  borderSubtle: "rgba(255, 255, 255, 0.04)",
  borderHighlighted: "rgba(59, 130, 246, 0.35)",
  text: "#FFFFFF",
  textSecondary: "#9CA3AF",
  textMuted: "#64748B",
  primary: "#3B82F6",
  primaryLight: "rgba(59, 130, 246, 0.15)",
  primaryDark: "#2563EB",
  accent: "#3B82F6",
  success: "#10B981",
  successLight: "rgba(16, 185, 129, 0.14)",
  warning: "#F59E0B",
  warningLight: "rgba(245, 158, 11, 0.14)",
  danger: "#EF4444",
  dangerLight: "rgba(239, 68, 68, 0.14)",
  navBackground: "rgba(20, 22, 27, 0.94)",
  navBorder: "rgba(255, 255, 255, 0.09)",
  navIconInactive: "#8E929D",
  navIconActive: "#FFFFFF",
  statusBar: "light-content",
};

interface ThemeContextType {
  themeMode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
  cycleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  themeMode: "light",
  isDark: false,
  colors: lightColors,
  toggleTheme: () => {},
  cycleTheme: () => {},
  setThemeMode: () => {},
});

const THEME_STORAGE_KEY = "splitzy_theme_mode";

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const systemColorScheme = useColorScheme();

  // Load saved preference from localStorage if available in web or memory
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
        if (saved === "dark" || saved === "light" || saved === "system") {
          return saved;
        }
      }
    } catch {
      // Ignore storage errors
    }
    return "light";
  });

  // Load saved preference from AsyncStorage and localStorage
  useEffect(() => {
    let isMounted = true;
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((saved) => {
        if (
          isMounted &&
          (saved === "dark" || saved === "light" || saved === "system")
        ) {
          setThemeModeState(saved as ThemeMode);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const isDark = useMemo(() => {
    if (themeMode === "system") {
      return systemColorScheme === "dark";
    }
    return themeMode === "dark";
  }, [themeMode, systemColorScheme]);

  const colors = isDark ? darkColors : lightColors;

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(THEME_STORAGE_KEY, mode);
      }
      AsyncStorage.setItem(THEME_STORAGE_KEY, mode).catch(() => {});
    } catch {
      // Ignore storage errors
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeModeState((prev) => {
      const next: ThemeMode = prev === "dark" ? "light" : "dark";
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem(THEME_STORAGE_KEY, next);
        }
        AsyncStorage.setItem(THEME_STORAGE_KEY, next).catch(() => {});
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }, []);

  const cycleTheme = useCallback(() => {
    setThemeModeState((prev) => {
      let next: ThemeMode = "dark";
      if (prev === "light") {
        next = "dark";
      } else if (prev === "dark") {
        next = "system";
      } else {
        next = "light";
      }
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem(THEME_STORAGE_KEY, next);
        }
        AsyncStorage.setItem(THEME_STORAGE_KEY, next).catch(() => {});
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }, []);

  // Update status bar & android navigation bar on theme change
  useEffect(() => {
    if (Platform.OS === "android") {
      try {
        NavigationBar.setStyle(isDark ? "light" : "dark");
        NavigationBar.setHidden(false);
      } catch {
        // Ignore
      }
    }
    StatusBar.setBarStyle(isDark ? "light-content" : "dark-content", true);
  }, [isDark]);

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        isDark,
        colors,
        toggleTheme,
        cycleTheme,
        setThemeMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
