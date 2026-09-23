import React from "react";
import { StyleSheet, View, Text } from "react-native";

/**
 * OnboardingIllustration1
 * 100% Coded Vector UI matching the Splitzy Onboarding 1 specification:
 * - Central luminous blue dollar medallion with soft ambient elevation halo
 * - Left & Right curved dashed sky-blue transfer arcs with accent node beacons
 * - Left roommate avatar (yellow face, neutral calm expression, blue shoulders)
 * - Right roommate avatar (yellow face, sky-blue cowl, blue shoulders)
 * - Paired gold coin transaction badges with balance dash marks
 */
export const OnboardingIllustration1: React.FC = () => {
  return (
    <View style={styles.container}>
      {/* 1. Left Curved Dashed Connection Arc */}
      <View style={styles.leftArcWrapper}>
        <View style={styles.arcDashedBorder} />
        {/* Accent Node */}
        <View style={styles.leftArcNode} />
      </View>

      {/* 2. Right Curved Dashed Connection Arc */}
      <View style={styles.rightArcWrapper}>
        <View style={styles.arcDashedBorder} />
        {/* Accent Node */}
        <View style={styles.rightArcNode} />
      </View>

      {/* 3. Center Glowing Medallion */}
      <View style={styles.centerGlowRing}>
        <View style={styles.centerWhiteRing}>
          <View style={styles.centerBlueCircle}>
            <Text style={styles.dollarSign}>$</Text>
          </View>
        </View>
      </View>

      {/* 4. Left Roommate Avatar */}
      <View style={styles.leftAvatarCard}>
        <View style={styles.avatarCharacter}>
          {/* Head */}
          <View style={styles.avatarHeadYellow}>
            <View style={styles.eyesRow}>
              <View style={styles.eye} />
              <View style={styles.eye} />
            </View>
            <View style={styles.neutralMouth} />
          </View>
          {/* Shoulders */}
          <View style={styles.avatarShouldersBlue} />
        </View>
      </View>

      {/* 5. Right Roommate Avatar */}
      <View style={styles.rightAvatarCard}>
        <View style={styles.avatarCharacter}>
          {/* Head with cowl/hair */}
          <View style={styles.avatarCowlBlue}>
            <View style={styles.avatarFaceYellowInner}>
              <View style={styles.eyesRow}>
                <View style={styles.eye} />
                <View style={styles.eye} />
              </View>
              <View style={styles.neutralMouth} />
            </View>
          </View>
          {/* Shoulders */}
          <View style={styles.avatarShouldersBlue} />
        </View>
      </View>

      {/* 6. Left Gold Coin Indicator with Dash */}
      <View style={styles.leftCoinGroup}>
        <View style={styles.goldDash} />
        <View style={styles.goldCoin}>
          <Text style={styles.goldCoinText}>$</Text>
        </View>
      </View>

      {/* 7. Right Gold Coin Indicator with Dash */}
      <View style={styles.rightCoinGroup}>
        <View style={styles.goldCoin}>
          <Text style={styles.goldCoinText}>$</Text>
        </View>
        <View style={styles.goldDash} />
      </View>
    </View>
  );
};

/**
 * OnboardingIllustration2
 * 100% Coded Vector UI matching Splitzy Onboarding 2:
 * - Central household card with house emblem and 3 roommate member pills
 * - Dashed orbit line with floating utility cards (dollar, smile feedback, analytics bars, wallet, receipt)
 */
export const OnboardingIllustration2: React.FC = () => {
  return (
    <View style={styles.container}>
      {/* Dashed Orbit Ring */}
      <View style={styles.orbitRing} />

      {/* Center House Card */}
      <View style={styles.houseCard}>
        {/* House Outline Icon */}
        <View style={styles.houseIconContainer}>
          <View style={styles.houseRoof} />
          <View style={styles.houseBody}>
            <View style={styles.houseDoor} />
          </View>
        </View>

        {/* Roommate avatar badge pill */}
        <View style={styles.membersPill}>
          <View style={[styles.miniMemberDot, { backgroundColor: "#38BDF8" }]}>
            <Text style={styles.miniMemberText}>👤</Text>
          </View>
          <View style={[styles.miniMemberDot, { backgroundColor: "#818CF8" }]}>
            <Text style={styles.miniMemberText}>👤</Text>
          </View>
          <View style={[styles.miniMemberDot, { backgroundColor: "#FB923C" }]}>
            <Text style={styles.miniMemberText}>👤</Text>
          </View>
        </View>
      </View>

      {/* Satellite Floating Badge: Dollar Coin (Top-Left) */}
      <View style={[styles.satelliteBadge, styles.satDollar]}>
        <Text style={styles.satDollarText}>$</Text>
      </View>

      {/* Satellite Floating Badge: Smiley (Top-Right) */}
      <View style={[styles.satelliteCard, styles.satSmiley]}>
        <Text style={{ fontSize: 13 }}>🙂</Text>
      </View>

      {/* Satellite Floating Badge: Analytics Bar Chart (Right) */}
      <View style={[styles.satelliteCard, styles.satChart]}>
        <View style={styles.chartBars}>
          <View
            style={[styles.chartBar, { height: 7, backgroundColor: "#93C5FD" }]}
          />
          <View
            style={[
              styles.chartBar,
              { height: 14, backgroundColor: "#2563EB" },
            ]}
          />
          <View
            style={[
              styles.chartBar,
              { height: 10, backgroundColor: "#60A5FA" },
            ]}
          />
        </View>
      </View>

      {/* Satellite Floating Badge: Wallet (Bottom-Right) */}
      <View
        style={[
          styles.satelliteCard,
          styles.satWallet,
          { backgroundColor: "#2563EB" },
        ]}
      >
        <Text style={{ fontSize: 11, color: "#FFFFFF" }}>💳</Text>
      </View>

      {/* Satellite Floating Badge: Receipt List (Bottom-Left) */}
      <View style={[styles.satelliteCard, styles.satReceipt]}>
        <View style={styles.receiptLines}>
          <View
            style={[
              styles.receiptLine,
              { width: 14, backgroundColor: "#2563EB" },
            ]}
          />
          <View
            style={[
              styles.receiptLine,
              { width: 10, backgroundColor: "#94A3B8" },
            ]}
          />
          <View
            style={[
              styles.receiptLine,
              { width: 12, backgroundColor: "#CBD5E1" },
            ]}
          />
        </View>
      </View>

      {/* Tiny gold sparkles */}
      <View style={[styles.sparkleDot, { top: 68, left: 42 }]} />
      <View style={[styles.sparkleDot, { bottom: 35, left: 112 }]} />
    </View>
  );
};

/**
 * OnboardingIllustration3
 * 100% Coded Vector UI matching Splitzy Onboarding 3:
 * - Circular orbit ring with cyan and pink/coral roommate avatars
 * - Central luminous blue dollar medallion
 * - Top & Bottom gold transaction badges
 */
export const OnboardingIllustration3: React.FC = () => {
  return (
    <View style={styles.container}>
      {/* Dashed circular orbit */}
      <View style={styles.orbitRingFull} />

      {/* Central Blue Dollar Medallion */}
      <View style={styles.centerGlowRing}>
        <View style={styles.centerWhiteRing}>
          <View style={styles.centerBlueCircle}>
            <Text style={styles.dollarSign}>$</Text>
          </View>
        </View>
      </View>

      {/* Left Avatar (Sky Blue) */}
      <View style={[styles.avatarCircleRing, { left: 18, top: 70 }]}>
        <View
          style={[
            styles.avatarCircleInner,
            { backgroundColor: "#EFF6FF", borderColor: "#38BDF8" },
          ]}
        >
          <Text style={{ fontSize: 16 }}>👤</Text>
        </View>
        <View
          style={[styles.avatarSmallAnchor, { backgroundColor: "#38BDF8" }]}
        />
      </View>

      {/* Right Avatar (Coral / Pink) */}
      <View style={[styles.avatarCircleRing, { right: 18, top: 70 }]}>
        <View
          style={[
            styles.avatarCircleInner,
            { backgroundColor: "#FFF1F2", borderColor: "#FB7185" },
          ]}
        >
          <Text style={{ fontSize: 16 }}>👩</Text>
        </View>
        <View
          style={[styles.avatarSmallAnchor, { backgroundColor: "#FB7185" }]}
        />
      </View>

      {/* Bottom Gold Coins */}
      <View
        style={[
          styles.goldCoin,
          { position: "absolute", bottom: 34, left: 62 },
        ]}
      >
        <Text style={styles.goldCoinText}>$</Text>
      </View>

      <View
        style={[
          styles.goldCoin,
          { position: "absolute", bottom: 34, right: 62 },
        ]}
      >
        <Text style={styles.goldCoinText}>$</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 290,
    height: 195,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },

  /* ------------------- Onboarding 1 Vector Styles ------------------- */
  centerGlowRing: {
    width: 98,
    height: 98,
    borderRadius: 49,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.36,
    shadowRadius: 18,
    elevation: 10,
    zIndex: 10,
  },
  centerWhiteRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  centerBlueCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
  },
  dollarSign: {
    fontSize: 42,
    fontWeight: "800",
    color: "#FFFFFF",
    includeFontPadding: false,
    lineHeight: 46,
  },

  /* Arcs */
  leftArcWrapper: {
    position: "absolute",
    left: 45,
    top: 50,
    width: 95,
    height: 50,
    overflow: "hidden",
    zIndex: 2,
  },
  rightArcWrapper: {
    position: "absolute",
    right: 45,
    top: 50,
    width: 95,
    height: 50,
    overflow: "hidden",
    zIndex: 2,
  },
  arcDashedBorder: {
    width: 140,
    height: 90,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: "#38BDF8",
    borderStyle: "dashed",
    position: "absolute",
    top: 0,
    left: -20,
  },
  leftArcNode: {
    position: "absolute",
    top: 14,
    left: 28,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#0284C7",
  },
  rightArcNode: {
    position: "absolute",
    top: 14,
    right: 28,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#0284C7",
  },

  /* Avatars */
  leftAvatarCard: {
    position: "absolute",
    left: 14,
    top: 50,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#EFF6FF",
    borderWidth: 1.5,
    borderColor: "#BFDBFE",
    justifyContent: "flex-end",
    alignItems: "center",
    zIndex: 5,
    overflow: "hidden",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  rightAvatarCard: {
    position: "absolute",
    right: 14,
    top: 50,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#EFF6FF",
    borderWidth: 1.5,
    borderColor: "#BFDBFE",
    justifyContent: "flex-end",
    alignItems: "center",
    zIndex: 5,
    overflow: "hidden",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  avatarCharacter: {
    alignItems: "center",
    justifyContent: "flex-end",
    width: "100%",
    height: "100%",
    paddingBottom: 2,
  },
  avatarHeadYellow: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FACC15",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    marginBottom: -2,
  },
  avatarCowlBlue: {
    width: 23,
    height: 23,
    borderRadius: 11.5,
    backgroundColor: "#60A5FA",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    marginBottom: -2,
  },
  avatarFaceYellowInner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#FACC15",
    alignItems: "center",
    justifyContent: "center",
  },
  eyesRow: {
    flexDirection: "row",
    gap: 4,
    marginTop: 2,
  },
  eye: {
    width: 2.2,
    height: 2.2,
    borderRadius: 1.1,
    backgroundColor: "#1E293B",
  },
  neutralMouth: {
    width: 3.5,
    height: 1.2,
    borderRadius: 0.6,
    backgroundColor: "#1E293B",
    marginTop: 2.5,
  },
  avatarShouldersBlue: {
    width: 28,
    height: 13,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    backgroundColor: "#60A5FA",
  },

  /* Gold Indicator Groups */
  leftCoinGroup: {
    position: "absolute",
    left: 22,
    bottom: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  rightCoinGroup: {
    position: "absolute",
    right: 22,
    bottom: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  goldDash: {
    width: 9,
    height: 2,
    borderRadius: 1,
    backgroundColor: "#EAB308",
  },
  goldCoin: {
    width: 19,
    height: 19,
    borderRadius: 9.5,
    backgroundColor: "#FACC15",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#EAB308",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 2,
  },
  goldCoinText: {
    fontSize: 9.5,
    fontWeight: "900",
    color: "#854D0E",
    includeFontPadding: false,
    lineHeight: 11,
  },

  /* ------------------- Onboarding 2 Vector Styles ------------------- */
  orbitRing: {
    position: "absolute",
    width: 175,
    height: 175,
    borderRadius: 87.5,
    borderWidth: 1.5,
    borderColor: "#BFDBFE",
    borderStyle: "dashed",
  },
  houseCard: {
    width: 105,
    height: 105,
    borderRadius: 22,
    backgroundColor: "#F0F6FE",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    zIndex: 5,
  },
  houseIconContainer: {
    alignItems: "center",
    marginBottom: 8,
  },
  houseRoof: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftWidth: 16,
    borderRightWidth: 16,
    borderBottomWidth: 12,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#2563EB",
  },
  houseBody: {
    width: 24,
    height: 16,
    borderWidth: 2,
    borderTopWidth: 0,
    borderColor: "#2563EB",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  houseDoor: {
    width: 8,
    height: 10,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    backgroundColor: "#2563EB",
  },
  membersPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  miniMemberDot: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    justifyContent: "center",
    alignItems: "center",
  },
  miniMemberText: {
    fontSize: 8,
  },
  satelliteBadge: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 6,
  },
  satDollar: {
    top: 25,
    left: 45,
  },
  satDollarText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  satelliteCard: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 6,
  },
  satSmiley: {
    top: 25,
    right: 48,
  },
  satChart: {
    top: 80,
    right: 20,
  },
  chartBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2.5,
  },
  chartBar: {
    width: 3.5,
    borderRadius: 1.5,
  },
  satWallet: {
    bottom: 25,
    right: 48,
    borderColor: "#2563EB",
  },
  satReceipt: {
    bottom: 25,
    left: 48,
  },
  receiptLines: {
    gap: 2.5,
  },
  receiptLine: {
    height: 2,
    borderRadius: 1,
  },
  sparkleDot: {
    position: "absolute",
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#FBBF24",
  },

  /* ------------------- Onboarding 3 Vector Styles ------------------- */
  orbitRingFull: {
    position: "absolute",
    width: 185,
    height: 185,
    borderRadius: 92.5,
    borderWidth: 1.5,
    borderColor: "#38BDF8",
    borderStyle: "dashed",
  },
  avatarCircleRing: {
    position: "absolute",
    alignItems: "center",
    zIndex: 6,
  },
  avatarCircleInner: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarSmallAnchor: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
});
