import React, { useEffect } from "react";
import { Platform } from "react-native";

function getNativeNavBar(): any | null {
  if (Platform.OS !== "android") return null;
  try {
    return require("expo-navigation-bar");
  } catch {
    return null;
  }
}

export function setSafeNavBarStyle(
  style: "light" | "dark" | "auto" | "inverted",
) {
  if (Platform.OS !== "android") return;
  try {
    const mod = getNativeNavBar();
    if (!mod) return;
    if (typeof mod.setStyle === "function") {
      mod.setStyle(style);
    } else if (typeof mod.NavigationBar?.setStyle === "function") {
      mod.NavigationBar.setStyle(style);
    } else if (typeof mod.setButtonStyleAsync === "function") {
      const btnStyle = style === "dark" ? "light" : "dark";
      mod.setButtonStyleAsync(btnStyle).catch(() => {});
    }
  } catch {
    // Ignore native module errors on unsupported devices
  }
}

export function setSafeNavBarHidden(hidden: boolean) {
  if (Platform.OS !== "android") return;
  try {
    const mod = getNativeNavBar();
    if (!mod) return;
    if (typeof mod.setHidden === "function") {
      mod.setHidden(hidden);
    } else if (typeof mod.NavigationBar?.setHidden === "function") {
      mod.NavigationBar.setHidden(hidden);
    } else if (typeof mod.setVisibilityAsync === "function") {
      mod.setVisibilityAsync(hidden ? "hidden" : "visible").catch(() => {});
    }
  } catch {
    // Ignore native module errors on unsupported devices
  }
}

export const NavigationBar: React.FC<{
  style?: "light" | "dark" | "auto" | "inverted";
  hidden?: boolean;
}> & {
  setStyle: typeof setSafeNavBarStyle;
  setHidden: typeof setSafeNavBarHidden;
} = Object.assign(
  function SafeNavigationBarComponent({
    style = "light",
    hidden = true,
  }: {
    style?: "light" | "dark" | "auto" | "inverted";
    hidden?: boolean;
  }) {
    useEffect(() => {
      if (Platform.OS === "android") {
        setSafeNavBarStyle(style);
        setSafeNavBarHidden(hidden);
      }
    }, [style, hidden]);
    return null;
  },
  {
    setStyle: setSafeNavBarStyle,
    setHidden: setSafeNavBarHidden,
  },
);
