import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  Ionicons,
  MaterialCommunityIcons,
  FontAwesome5,
} from "@expo/vector-icons";

interface PlatformLogoProps {
  platformKey: string;
  size?: number;
  name?: string;
  customColor?: string;
}

export function PlatformLogo({
  platformKey,
  size = 40,
  name,
  customColor,
}: PlatformLogoProps) {
  const normKey = (platformKey || "").toLowerCase().trim();
  const radius = Math.round(size * 0.28);
  const iconSize = Math.round(size * 0.52);

  switch (normKey) {
    case "netflix":
      return (
        <View
          style={[
            styles.container,
            {
              width: size,
              height: size,
              borderRadius: radius,
              backgroundColor: "#141414",
            },
          ]}
        >
          {/* Netflix Red Ribbon 'N' */}
          <View style={{ alignItems: "center", justifyContent: "center" }}>
            <Text
              style={{
                color: "#E50914",
                fontSize: Math.round(size * 0.62),
                fontWeight: "900",
                fontFamily: "System",
                letterSpacing: -1,
                textShadowColor: "rgba(0, 0, 0, 0.75)",
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 3,
              }}
            >
              N
            </Text>
          </View>
        </View>
      );

    case "spotify":
      return (
        <View
          style={[
            styles.container,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: "#1DB954",
            },
          ]}
        >
          <MaterialCommunityIcons
            name="spotify"
            size={Math.round(size * 0.72)}
            color="#000000"
          />
        </View>
      );

    case "youtube":
      return (
        <View
          style={[
            styles.container,
            {
              width: size,
              height: size,
              borderRadius: radius,
              backgroundColor: "#FF0000",
            },
          ]}
        >
          <Ionicons
            name="play"
            size={iconSize}
            color="#FFFFFF"
            style={{ marginLeft: 2 }}
          />
        </View>
      );

    case "disney":
    case "disney_plus":
      return (
        <LinearGradient
          colors={["#0C163B", "#113CCF"]}
          style={[
            styles.container,
            { width: size, height: size, borderRadius: radius },
          ]}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: Math.round(size * 0.46),
                fontWeight: "900",
                fontStyle: "italic",
                letterSpacing: -0.5,
              }}
            >
              D+
            </Text>
          </View>
        </LinearGradient>
      );

    case "apple_music":
      return (
        <LinearGradient
          colors={["#FC3C44", "#FA243C"]}
          style={[
            styles.container,
            { width: size, height: size, borderRadius: radius },
          ]}
        >
          <Ionicons name="musical-notes" size={iconSize} color="#FFFFFF" />
        </LinearGradient>
      );

    case "chatgpt":
    case "openai":
      return (
        <View
          style={[
            styles.container,
            {
              width: size,
              height: size,
              borderRadius: radius,
              backgroundColor: "#10A37F",
            },
          ]}
        >
          <MaterialCommunityIcons
            name="robot"
            size={iconSize}
            color="#FFFFFF"
          />
        </View>
      );

    case "claude":
    case "anthropic":
      return (
        <View
          style={[
            styles.container,
            {
              width: size,
              height: size,
              borderRadius: radius,
              backgroundColor: "#D97706",
            },
          ]}
        >
          <MaterialCommunityIcons
            name="asterisk"
            size={iconSize}
            color="#FFFFFF"
          />
        </View>
      );

    case "google_one":
    case "google":
      return (
        <View
          style={[
            styles.container,
            {
              width: size,
              height: size,
              borderRadius: radius,
              backgroundColor: "#FFFFFF",
              borderWidth: 1.5,
              borderColor: "#4285F4",
            },
          ]}
        >
          <MaterialCommunityIcons
            name="google"
            size={iconSize}
            color="#4285F4"
          />
        </View>
      );

    case "icloud":
    case "apple":
      return (
        <LinearGradient
          colors={["#38BDF8", "#0284C7"]}
          style={[
            styles.container,
            { width: size, height: size, borderRadius: radius },
          ]}
        >
          <Ionicons name="cloud" size={iconSize} color="#FFFFFF" />
        </LinearGradient>
      );

    case "prime_video":
    case "amazon":
      return (
        <LinearGradient
          colors={["#002F4C", "#00A8E1"]}
          style={[
            styles.container,
            { width: size, height: size, borderRadius: radius },
          ]}
        >
          <MaterialCommunityIcons
            name="arrow-right-bold-outline"
            size={iconSize}
            color="#FFFFFF"
          />
        </LinearGradient>
      );

    case "crunchyroll":
      return (
        <View
          style={[
            styles.container,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: "#F47521",
            },
          ]}
        >
          <MaterialCommunityIcons
            name="eye-circle-outline"
            size={Math.round(size * 0.72)}
            color="#FFFFFF"
          />
        </View>
      );

    case "github_copilot":
    case "github":
      return (
        <View
          style={[
            styles.container,
            {
              width: size,
              height: size,
              borderRadius: radius,
              backgroundColor: "#24292F",
            },
          ]}
        >
          <MaterialCommunityIcons
            name="github"
            size={Math.round(size * 0.65)}
            color="#FFFFFF"
          />
        </View>
      );

    case "canva":
      return (
        <LinearGradient
          colors={["#00C4CC", "#7D2AE8"]}
          style={[
            styles.container,
            { width: size, height: size, borderRadius: radius },
          ]}
        >
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: Math.round(size * 0.48),
              fontWeight: "900",
              fontStyle: "italic",
            }}
          >
            Ca
          </Text>
        </LinearGradient>
      );

    case "midjourney":
      return (
        <View
          style={[
            styles.container,
            {
              width: size,
              height: size,
              borderRadius: radius,
              backgroundColor: "#0F172A",
            },
          ]}
        >
          <Ionicons name="boat" size={iconSize} color="#38BDF8" />
        </View>
      );

    case "playstation":
      return (
        <View
          style={[
            styles.container,
            {
              width: size,
              height: size,
              borderRadius: radius,
              backgroundColor: "#003791",
            },
          ]}
        >
          <MaterialCommunityIcons
            name="sony-playstation"
            size={Math.round(size * 0.7)}
            color="#FFFFFF"
          />
        </View>
      );

    case "steam":
      return (
        <LinearGradient
          colors={["#171A21", "#2A475E"]}
          style={[
            styles.container,
            { width: size, height: size, borderRadius: radius },
          ]}
        >
          <MaterialCommunityIcons
            name="steam"
            size={Math.round(size * 0.7)}
            color="#FFFFFF"
          />
        </LinearGradient>
      );

    case "nintendo":
      return (
        <View
          style={[
            styles.container,
            {
              width: size,
              height: size,
              borderRadius: radius,
              backgroundColor: "#E60012",
            },
          ]}
        >
          <MaterialCommunityIcons
            name="nintendo-switch"
            size={Math.round(size * 0.68)}
            color="#FFFFFF"
          />
        </View>
      );

    case "meralco":
    case "power":
    case "electricity":
      return (
        <LinearGradient
          colors={["#EA580C", "#F97316"]}
          style={[
            styles.container,
            { width: size, height: size, borderRadius: radius },
          ]}
        >
          <Ionicons name="flash" size={iconSize} color="#FFFFFF" />
        </LinearGradient>
      );

    case "internet":
    case "wifi":
    case "fiber":
      return (
        <LinearGradient
          colors={["#2563EB", "#3B82F6"]}
          style={[
            styles.container,
            { width: size, height: size, borderRadius: radius },
          ]}
        >
          <Ionicons name="wifi" size={iconSize} color="#FFFFFF" />
        </LinearGradient>
      );

    case "billease":
      return (
        <LinearGradient
          colors={["#0A2540", "#00A389"]}
          style={[
            styles.container,
            { width: size, height: size, borderRadius: radius },
          ]}
        >
          <Text
            style={{
              color: "#00FFCC",
              fontSize: Math.round(size * 0.52),
              fontWeight: "900",
              fontFamily: "System",
              letterSpacing: -1,
            }}
          >
            B
          </Text>
        </LinearGradient>
      );

    case "tala":
      return (
        <View
          style={[
            styles.container,
            {
              width: size,
              height: size,
              borderRadius: radius,
              backgroundColor: "#00A389",
            },
          ]}
        >
          <Ionicons name="leaf" size={iconSize} color="#FFFFFF" />
        </View>
      );

    case "home_credit":
    case "homecredit":
      return (
        <View
          style={[
            styles.container,
            {
              width: size,
              height: size,
              borderRadius: radius,
              backgroundColor: "#E20613",
            },
          ]}
        >
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: Math.round(size * 0.44),
              fontWeight: "900",
              letterSpacing: -0.5,
            }}
          >
            HC
          </Text>
        </View>
      );

    case "gloan":
    case "gcash_loan":
      return (
        <LinearGradient
          colors={["#005CE6", "#00A3FF"]}
          style={[
            styles.container,
            { width: size, height: size, borderRadius: radius },
          ]}
        >
          <Text
            style={{
              color: "#FFDE59",
              fontSize: Math.round(size * 0.46),
              fontWeight: "900",
            }}
          >
            G
          </Text>
        </LinearGradient>
      );

    case "maya_credit":
    case "mayacredit":
      return (
        <LinearGradient
          colors={["#0B132B", "#059669"]}
          style={[
            styles.container,
            { width: size, height: size, borderRadius: radius },
          ]}
        >
          <Text
            style={{
              color: "#34D399",
              fontSize: Math.round(size * 0.46),
              fontWeight: "900",
            }}
          >
            M
          </Text>
        </LinearGradient>
      );

    case "spaylater":
    case "shopee_paylater":
      return (
        <LinearGradient
          colors={["#EE4D2D", "#F97316"]}
          style={[
            styles.container,
            { width: size, height: size, borderRadius: radius },
          ]}
        >
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: Math.round(size * 0.42),
              fontWeight: "900",
            }}
          >
            SPay
          </Text>
        </LinearGradient>
      );

    case "lazpaylater":
    case "lazada_paylater":
      return (
        <LinearGradient
          colors={["#0F146D", "#F51480"]}
          style={[
            styles.container,
            { width: size, height: size, borderRadius: radius },
          ]}
        >
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: Math.round(size * 0.42),
              fontWeight: "900",
            }}
          >
            Laz
          </Text>
        </LinearGradient>
      );

    case "cashalo":
      return (
        <LinearGradient
          colors={["#0072CE", "#009EE0"]}
          style={[
            styles.container,
            { width: size, height: size, borderRadius: radius },
          ]}
        >
          <Ionicons name="cash-outline" size={iconSize} color="#FFFFFF" />
        </LinearGradient>
      );

    case "juanhand":
      return (
        <LinearGradient
          colors={["#1E3A8A", "#2563EB"]}
          style={[
            styles.container,
            { width: size, height: size, borderRadius: radius },
          ]}
        >
          <Text
            style={{
              color: "#FDE047",
              fontSize: Math.round(size * 0.46),
              fontWeight: "900",
            }}
          >
            JH
          </Text>
        </LinearGradient>
      );

    case "bank_loan":
      return (
        <LinearGradient
          colors={["#1E293B", "#334155"]}
          style={[
            styles.container,
            { width: size, height: size, borderRadius: radius },
          ]}
        >
          <Ionicons name="business" size={iconSize} color="#38BDF8" />
        </LinearGradient>
      );

    default: {
      const bg = customColor || "#64748B";
      const initial = (name || platformKey || "S")
        .trim()
        .charAt(0)
        .toUpperCase();
      return (
        <View
          style={[
            styles.container,
            {
              width: size,
              height: size,
              borderRadius: radius,
              backgroundColor: bg,
            },
          ]}
        >
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: Math.round(size * 0.48),
              fontWeight: "800",
            }}
          >
            {initial}
          </Text>
        </View>
      );
    }
  }
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
