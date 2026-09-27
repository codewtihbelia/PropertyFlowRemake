import React, { useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Animated,
  Easing,
  ViewStyle,
  StyleProp,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = "100%",
  height = 16,
  borderRadius = 8,
  style,
}) => {
  const pulseAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.85,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.35,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [pulseAnim]);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height: height as any,
          borderRadius,
          backgroundColor: "#E2E8F0",
          opacity: pulseAnim,
        },
        style,
      ]}
    />
  );
};

// ==========================================
// 1. HOME SCREEN SKELETON
// ==========================================
export const HomeScreenSkeleton: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header */}
        <View style={styles.headerRow}>
          <View style={styles.headerUserWrap}>
            <Skeleton width={44} height={44} borderRadius={22} />
            <View style={{ marginLeft: 12 }}>
              <Skeleton width={130} height={18} borderRadius={6} />
              <Skeleton
                width={80}
                height={13}
                borderRadius={5}
                style={{ marginTop: 6 }}
              />
            </View>
          </View>
          <View style={styles.row}>
            <Skeleton
              width={38}
              height={38}
              borderRadius={19}
              style={{ marginRight: 8 }}
            />
            <Skeleton width={38} height={38} borderRadius={19} />
          </View>
        </View>

        {/* Hero Balance Card Skeleton */}
        <View style={styles.heroCardSkeleton}>
          <View style={styles.rowBetween}>
            <Skeleton width={96} height={22} borderRadius={11} />
            <Skeleton width={64} height={20} borderRadius={10} />
          </View>
          <Skeleton
            width={180}
            height={38}
            borderRadius={10}
            style={{ marginTop: 14 }}
          />
          <Skeleton
            width={120}
            height={14}
            borderRadius={6}
            style={{ marginTop: 8 }}
          />

          <View style={[styles.rowBetween, { marginTop: 22 }]}>
            <Skeleton width="48%" height={44} borderRadius={14} />
            <Skeleton width="48%" height={44} borderRadius={14} />
          </View>
        </View>

        {/* Quick Actions Row */}
        <View style={styles.quickActionsRow}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.quickActionItem}>
              <Skeleton width={52} height={52} borderRadius={26} />
              <Skeleton
                width={46}
                height={12}
                borderRadius={5}
                style={{ marginTop: 8 }}
              />
            </View>
          ))}
        </View>

        {/* Section Header */}
        <View style={[styles.rowBetween, { marginTop: 28, marginBottom: 14 }]}>
          <Skeleton width={140} height={20} borderRadius={6} />
          <Skeleton width={60} height={14} borderRadius={6} />
        </View>

        {/* Transaction Cards */}
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={styles.transactionCard}>
            <Skeleton width={44} height={44} borderRadius={22} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Skeleton width={120} height={16} borderRadius={6} />
              <Skeleton
                width={80}
                height={12}
                borderRadius={5}
                style={{ marginTop: 6 }}
              />
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Skeleton width={64} height={16} borderRadius={6} />
              <Skeleton
                width={42}
                height={11}
                borderRadius={4}
                style={{ marginTop: 6 }}
              />
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

// ==========================================
// 2. BILLS SCREEN SKELETON
// ==========================================
export const BillsScreenSkeleton: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header */}
        <View style={[styles.rowBetween, { marginBottom: 18 }]}>
          <Skeleton width={120} height={24} borderRadius={8} />
          <Skeleton width={38} height={38} borderRadius={19} />
        </View>

        {/* Cycle Pill */}
        <Skeleton
          width={160}
          height={30}
          borderRadius={15}
          style={{ marginBottom: 16 }}
        />

        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <Skeleton width={110} height={16} borderRadius={6} />
          <Skeleton
            width={160}
            height={34}
            borderRadius={10}
            style={{ marginTop: 10 }}
          />
          <View style={[styles.rowBetween, { marginTop: 20 }]}>
            <View>
              <Skeleton width={70} height={12} borderRadius={4} />
              <Skeleton
                width={90}
                height={18}
                borderRadius={6}
                style={{ marginTop: 6 }}
              />
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Skeleton width={70} height={12} borderRadius={4} />
              <Skeleton
                width={90}
                height={18}
                borderRadius={6}
                style={{ marginTop: 6 }}
              />
            </View>
          </View>
        </View>

        {/* Bills Section Header */}
        <View style={[styles.rowBetween, { marginTop: 24, marginBottom: 14 }]}>
          <Skeleton width={130} height={18} borderRadius={6} />
          <Skeleton width={50} height={14} borderRadius={5} />
        </View>

        {/* Bill Rows */}
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={styles.transactionCard}>
            <Skeleton width={44} height={44} borderRadius={12} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Skeleton width={110} height={15} borderRadius={6} />
              <Skeleton
                width={85}
                height={12}
                borderRadius={5}
                style={{ marginTop: 6 }}
              />
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Skeleton width={70} height={16} borderRadius={6} />
              <Skeleton
                width={52}
                height={20}
                borderRadius={10}
                style={{ marginTop: 6 }}
              />
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

// ==========================================
// 3. ATTENDANCE SCREEN SKELETON
// ==========================================
export const AttendanceScreenSkeleton: React.FC<{
  onBack?: () => void;
}> = () => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header */}
        <View style={[styles.rowBetween, { marginBottom: 20 }]}>
          <Skeleton width={38} height={38} borderRadius={19} />
          <Skeleton width={140} height={22} borderRadius={8} />
          <Skeleton width={38} height={38} borderRadius={19} />
        </View>

        {/* Cycle Date Range Badge */}
        <View style={{ alignItems: "center", marginBottom: 20 }}>
          <Skeleton width={200} height={28} borderRadius={14} />
        </View>

        {/* Calendar Card Skeleton */}
        <View style={styles.calendarCard}>
          {/* Day Headers (M T W T F S S) */}
          <View style={[styles.rowBetween, { marginBottom: 16 }]}>
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <Skeleton key={d} width={28} height={14} borderRadius={4} />
            ))}
          </View>
          {/* Date Grid */}
          {[1, 2, 3, 4, 5].map((row) => (
            <View key={row} style={[styles.rowBetween, { marginBottom: 12 }]}>
              {[1, 2, 3, 4, 5, 6, 7].map((col) => (
                <Skeleton key={col} width={34} height={34} borderRadius={17} />
              ))}
            </View>
          ))}
        </View>

        {/* Attendance Summary Stat Card */}
        <View style={[styles.summaryCard, { marginTop: 20 }]}>
          <View style={styles.rowBetween}>
            <View>
              <Skeleton width={80} height={13} borderRadius={5} />
              <Skeleton
                width={60}
                height={24}
                borderRadius={8}
                style={{ marginTop: 6 }}
              />
            </View>
            <View>
              <Skeleton width={80} height={13} borderRadius={5} />
              <Skeleton
                width={60}
                height={24}
                borderRadius={8}
                style={{ marginTop: 6 }}
              />
            </View>
            <View>
              <Skeleton width={80} height={13} borderRadius={5} />
              <Skeleton
                width={60}
                height={24}
                borderRadius={8}
                style={{ marginTop: 6 }}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// ==========================================
// 4. MANAGE GROUP SCREEN SKELETON
// ==========================================
export const ManageGroupScreenSkeleton: React.FC<{
  onBack?: () => void;
}> = () => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header */}
        <View style={[styles.rowBetween, { marginBottom: 20 }]}>
          <Skeleton width={38} height={38} borderRadius={19} />
          <Skeleton width={140} height={22} borderRadius={8} />
          <Skeleton width={38} height={38} borderRadius={19} />
        </View>

        {/* Household Info Card */}
        <View style={styles.summaryCard}>
          <View style={styles.headerUserWrap}>
            <Skeleton width={56} height={56} borderRadius={28} />
            <View style={{ marginLeft: 14 }}>
              <Skeleton width={140} height={20} borderRadius={7} />
              <Skeleton
                width={90}
                height={14}
                borderRadius={5}
                style={{ marginTop: 6 }}
              />
            </View>
          </View>
          <View style={[styles.rowBetween, { marginTop: 18 }]}>
            <Skeleton width={130} height={32} borderRadius={16} />
            <Skeleton width={90} height={32} borderRadius={16} />
          </View>
        </View>

        {/* Members Header */}
        <View style={[styles.rowBetween, { marginTop: 24, marginBottom: 14 }]}>
          <Skeleton width={110} height={18} borderRadius={6} />
          <Skeleton width={70} height={14} borderRadius={5} />
        </View>

        {/* Member Rows */}
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={styles.transactionCard}>
            <Skeleton width={44} height={44} borderRadius={22} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Skeleton width={110} height={15} borderRadius={6} />
              <Skeleton
                width={70}
                height={12}
                borderRadius={5}
                style={{ marginTop: 6 }}
              />
            </View>
            <Skeleton width={60} height={24} borderRadius={12} />
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

// ==========================================
// 5. PROFILE SCREEN SKELETON
// ==========================================
export const ProfileScreenSkeleton: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header */}
        <View style={[styles.rowBetween, { marginBottom: 20 }]}>
          <Skeleton width={110} height={24} borderRadius={8} />
          <Skeleton width={38} height={38} borderRadius={19} />
        </View>

        {/* Avatar & User Details */}
        <View style={{ alignItems: "center", marginVertical: 16 }}>
          <Skeleton width={88} height={88} borderRadius={44} />
          <Skeleton
            width={140}
            height={22}
            borderRadius={8}
            style={{ marginTop: 14 }}
          />
          <Skeleton
            width={180}
            height={14}
            borderRadius={6}
            style={{ marginTop: 6 }}
          />
        </View>

        {/* Settings Group 1 */}
        <View style={[styles.summaryCard, { marginTop: 16 }]}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={[styles.rowBetween, { paddingVertical: 12 }]}>
              <View style={styles.row}>
                <Skeleton
                  width={34}
                  height={34}
                  borderRadius={10}
                  style={{ marginRight: 12 }}
                />
                <Skeleton width={120} height={16} borderRadius={6} />
              </View>
              <Skeleton width={20} height={16} borderRadius={4} />
            </View>
          ))}
        </View>

        {/* Settings Group 2 */}
        <View style={[styles.summaryCard, { marginTop: 16 }]}>
          {[1, 2].map((i) => (
            <View key={i} style={[styles.rowBetween, { paddingVertical: 12 }]}>
              <View style={styles.row}>
                <Skeleton
                  width={34}
                  height={34}
                  borderRadius={10}
                  style={{ marginRight: 12 }}
                />
                <Skeleton width={140} height={16} borderRadius={6} />
              </View>
              <Skeleton width={20} height={16} borderRadius={4} />
            </View>
          ))}
        </View>

        {/* Logout Button */}
        <View style={{ marginTop: 24 }}>
          <Skeleton width="100%" height={48} borderRadius={14} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// ==========================================
// 6. PAYMENTS SCREEN SKELETON
// ==========================================
export const PaymentsScreenSkeleton: React.FC<{ onBack?: () => void }> = () => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header */}
        <View style={[styles.rowBetween, { marginBottom: 20 }]}>
          <Skeleton width={38} height={38} borderRadius={19} />
          <Skeleton width={130} height={22} borderRadius={8} />
          <View style={{ width: 38 }} />
        </View>

        {/* Balance Due Card */}
        <View style={styles.heroCardSkeleton}>
          <Skeleton width={100} height={16} borderRadius={6} />
          <Skeleton
            width={160}
            height={36}
            borderRadius={10}
            style={{ marginTop: 12 }}
          />
          <Skeleton
            width={140}
            height={14}
            borderRadius={6}
            style={{ marginTop: 8 }}
          />
        </View>

        {/* Payment Methods Card */}
        <View style={[styles.summaryCard, { marginTop: 18 }]}>
          <Skeleton
            width={120}
            height={16}
            borderRadius={6}
            style={{ marginBottom: 14 }}
          />
          {[1, 2].map((i) => (
            <View key={i} style={[styles.rowBetween, { paddingVertical: 10 }]}>
              <View style={styles.row}>
                <Skeleton
                  width={40}
                  height={28}
                  borderRadius={6}
                  style={{ marginRight: 12 }}
                />
                <Skeleton width={110} height={15} borderRadius={5} />
              </View>
              <Skeleton width={22} height={22} borderRadius={11} />
            </View>
          ))}
        </View>

        {/* Receipt Upload Card */}
        <View
          style={[
            styles.summaryCard,
            {
              marginTop: 18,
              height: 110,
              justifyContent: "center",
              alignItems: "center",
            },
          ]}
        >
          <Skeleton width={44} height={44} borderRadius={22} />
          <Skeleton
            width={130}
            height={14}
            borderRadius={5}
            style={{ marginTop: 10 }}
          />
        </View>

        {/* Submit Button */}
        <View style={{ marginTop: 24 }}>
          <Skeleton width="100%" height={50} borderRadius={16} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// ==========================================
// 7. EXPENSE HISTORY SCREEN SKELETON
// ==========================================
export const ExpenseHistoryScreenSkeleton: React.FC<{
  onBack?: () => void;
}> = () => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header */}
        <View style={[styles.rowBetween, { marginBottom: 18 }]}>
          <Skeleton width={38} height={38} borderRadius={19} />
          <Skeleton width={140} height={22} borderRadius={8} />
          <Skeleton width={38} height={38} borderRadius={19} />
        </View>

        {/* Search Bar Skeleton */}
        <Skeleton
          width="100%"
          height={44}
          borderRadius={14}
          style={{ marginBottom: 14 }}
        />

        {/* Category Filter Pills */}
        <View style={[styles.row, { marginBottom: 20 }]}>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton
              key={i}
              width={76}
              height={32}
              borderRadius={16}
              style={{ marginRight: 8 }}
            />
          ))}
        </View>

        {/* Group 1 */}
        <Skeleton
          width={100}
          height={16}
          borderRadius={5}
          style={{ marginBottom: 10 }}
        />
        {[1, 2].map((i) => (
          <View key={i} style={styles.transactionCard}>
            <Skeleton width={44} height={44} borderRadius={14} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Skeleton width={120} height={15} borderRadius={6} />
              <Skeleton
                width={80}
                height={12}
                borderRadius={5}
                style={{ marginTop: 6 }}
              />
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Skeleton width={64} height={16} borderRadius={6} />
              <Skeleton
                width={50}
                height={11}
                borderRadius={4}
                style={{ marginTop: 6 }}
              />
            </View>
          </View>
        ))}

        {/* Group 2 */}
        <Skeleton
          width={110}
          height={16}
          borderRadius={5}
          style={{ marginTop: 14, marginBottom: 10 }}
        />
        {[1, 2, 3].map((i) => (
          <View key={i} style={styles.transactionCard}>
            <Skeleton width={44} height={44} borderRadius={14} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Skeleton width={130} height={15} borderRadius={6} />
              <Skeleton
                width={70}
                height={12}
                borderRadius={5}
                style={{ marginTop: 6 }}
              />
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Skeleton width={64} height={16} borderRadius={6} />
              <Skeleton
                width={50}
                height={11}
                borderRadius={4}
                style={{ marginTop: 6 }}
              />
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  headerUserWrap: {
    flexDirection: "row",
    alignItems: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroCardSkeleton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 20,
  },
  quickActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    marginVertical: 12,
  },
  quickActionItem: {
    alignItems: "center",
  },
  transactionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 12,
  },
  calendarCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
});
