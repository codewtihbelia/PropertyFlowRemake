import React, { useEffect, useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "../firebase/config";
import { mobileDataService } from "../services/firebaseDataService";
import { useNavVisibility } from "../context/NavVisibilityContext";

interface CycleDate {
  iso: string;
  dayNum: number;
  monthShort: string;
  dayOfWeek: string;
  isWeekend: boolean;
}

const generateCycleDates = (startStr: string, endStr: string): CycleDate[] => {
  const dates: CycleDate[] = [];
  const start = new Date(startStr);
  const end = new Date(endStr);
  const cur = new Date(start);
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  while (cur <= end) {
    const iso = cur.toISOString().split("T")[0];
    dates.push({
      iso,
      dayNum: cur.getDate(),
      monthShort: monthNames[cur.getMonth()],
      dayOfWeek: dayNames[cur.getDay()],
      isWeekend: cur.getDay() === 0 || cur.getDay() === 6,
    });
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
};

export const AttendanceScreen: React.FC<{
  householdId?: string;
  billingCycleId?: string;
  userId?: string;
}> = ({ householdId, billingCycleId, userId }) => {
  const [profile, setProfile] = useState<any | null>(null);
  const [cycles, setCycles] = useState<any[]>([]);
  const [waterConfig, setWaterConfig] = useState<any | null>(null);
  const [presentDates, setPresentDates] = useState<string[]>([]);
  const currentUser = auth.currentUser;
  const activeUserId = userId || currentUser?.uid || "";
  const resolvedHouseholdId = householdId || profile?.householdId || "";

  const activeCycle = useMemo(
    () =>
      cycles.find((c) => c.billingCycleId === billingCycleId) ||
      cycles.find((c) => c.status === "ACTIVE" || c.status === "FINALIZED") ||
      cycles[0],
    [billingCycleId, cycles],
  );
  const resolvedBillingCycleId =
    billingCycleId || activeCycle?.billingCycleId || "";
  const cycleDates = useMemo(
    () =>
      activeCycle
        ? generateCycleDates(activeCycle.startDate, activeCycle.endDate)
        : [],
    [activeCycle],
  );
  const ratePerDayPesos = (waterConfig?.rateCentavosPerPersonPerDay || 0) / 100;

  useEffect(() => {
    let mounted = true;
    if (!currentUser?.uid) return;
    mobileDataService.getUserProfile(currentUser.uid).then((nextProfile) => {
      if (mounted) setProfile(nextProfile);
    });
    return () => {
      mounted = false;
    };
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!resolvedHouseholdId) return;
    const unsubCycles = mobileDataService.listenToBillingCycles(
      resolvedHouseholdId,
      setCycles,
    );
    const unsubWater = mobileDataService.listenToWaterConfig(
      resolvedHouseholdId,
      setWaterConfig,
    );
    return () => {
      unsubCycles();
      unsubWater();
    };
  }, [resolvedHouseholdId]);

  useEffect(() => {
    if (!resolvedHouseholdId || !resolvedBillingCycleId || !activeUserId)
      return;
    return mobileDataService.listenToAttendance(
      resolvedHouseholdId,
      resolvedBillingCycleId,
      activeUserId,
      (markedDates) => {
        const present = Object.entries(markedDates)
          .filter(([, status]) => status === "PRESENT")
          .map(([date]) => date);
        setPresentDates(present);
      },
    );
  }, [activeUserId, resolvedBillingCycleId, resolvedHouseholdId]);

  const toggleDay = async (iso: string) => {
    if (!resolvedHouseholdId || !resolvedBillingCycleId || !activeUserId)
      return;
    const nextStatus = presentDates.includes(iso) ? "ABSENT" : "PRESENT";
    setPresentDates((prev) =>
      nextStatus === "PRESENT"
        ? [...prev, iso]
        : prev.filter((date) => date !== iso),
    );
    await mobileDataService.toggleAttendance(
      resolvedHouseholdId,
      resolvedBillingCycleId,
      activeUserId,
      iso,
      nextStatus,
    );
  };

  const markAll = async () => {
    if (!resolvedHouseholdId || !resolvedBillingCycleId || !activeUserId)
      return;
    setPresentDates(cycleDates.map((d) => d.iso));
    await Promise.all(
      cycleDates.map((d) =>
        mobileDataService.toggleAttendance(
          resolvedHouseholdId,
          resolvedBillingCycleId,
          activeUserId,
          d.iso,
          "PRESENT",
        ),
      ),
    );
  };

  const clearAll = async () => {
    if (!resolvedHouseholdId || !resolvedBillingCycleId || !activeUserId)
      return;
    setPresentDates([]);
    await Promise.all(
      cycleDates.map((d) =>
        mobileDataService.toggleAttendance(
          resolvedHouseholdId,
          resolvedBillingCycleId,
          activeUserId,
          d.iso,
          "ABSENT",
        ),
      ),
    );
  };

  const totalDays = cycleDates.length;
  const presentCount = presentDates.length;
  const absentCount = Math.max(0, totalDays - presentCount);
  const waterFee = presentCount * ratePerDayPesos;
  const { onScroll } = useNavVisibility();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Water Attendance</Text>
          <Text style={styles.subtitle}>
            {activeCycle
              ? `${activeCycle.startDate} to ${activeCycle.endDate} · PHP ${ratePerDayPesos.toFixed(2)} / person / day`
              : "No active Firebase billing cycle found"}
          </Text>
        </View>

        {!resolvedHouseholdId || !activeCycle ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              No attendance cycle available.
            </Text>
            <Text style={styles.emptySub}>
              Ask the host to create or finalize a billing cycle in Firebase.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.residentPillActive}>
              <Text style={styles.residentPillTextActive}>
                {profile?.displayName || currentUser?.displayName || "You"}
              </Text>
            </View>

            <View style={styles.statsCard}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Days Present</Text>
                <Text style={[styles.statVal, { color: "#059669" }]}>
                  {presentCount} / {totalDays}
                </Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Days Absent</Text>
                <Text style={[styles.statVal, { color: "#DC2626" }]}>
                  {absentCount} Days
                </Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Water Share</Text>
                <Text style={[styles.statVal, { color: "#1E3A8A" }]}>
                  PHP {waterFee.toFixed(2)}
                </Text>
              </View>
            </View>

            <View style={styles.batchActions}>
              <TouchableOpacity style={styles.batchBtn} onPress={markAll}>
                <Text style={styles.batchBtnText}>Mark All Present</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.batchBtn, styles.batchBtnSecondary]}
                onPress={clearAll}
              >
                <Text
                  style={[styles.batchBtnText, styles.batchBtnTextSecondary]}
                >
                  Clear All
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Billing Cycle Calendar</Text>
            <Text style={styles.sectionHint}>
              Tap any calendar date to toggle Present / Absent status
            </Text>

            <View style={styles.grid}>
              {cycleDates.map((d) => {
                const isPresent = presentDates.includes(d.iso);
                return (
                  <TouchableOpacity
                    key={d.iso}
                    style={[
                      styles.dayBox,
                      isPresent ? styles.dayBoxPresent : styles.dayBoxAbsent,
                      d.isWeekend && styles.dayBoxWeekend,
                    ]}
                    onPress={() => toggleDay(d.iso)}
                  >
                    <Text
                      style={[
                        styles.dayOfWeek,
                        isPresent
                          ? styles.dayTextWhiteSub
                          : styles.dayTextMuted,
                      ]}
                    >
                      {d.dayOfWeek}
                    </Text>
                    <Text
                      style={[
                        styles.dayNum,
                        isPresent ? styles.dayTextWhite : styles.dayTextDark,
                      ]}
                    >
                      {d.dayNum}
                    </Text>
                    <Text
                      style={[
                        styles.dayMonth,
                        isPresent
                          ? styles.dayTextWhiteSub
                          : styles.dayTextMuted,
                      ]}
                    >
                      {d.monthShort}
                    </Text>
                    <View
                      style={[
                        styles.statusBadge,
                        isPresent ? styles.badgePresent : styles.badgeAbsent,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          isPresent
                            ? styles.badgePresentText
                            : styles.badgeAbsentText,
                        ]}
                      >
                        {isPresent ? "P" : "A"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  scrollContent: { padding: 20, paddingBottom: 85 },
  header: { marginBottom: 14 },
  title: { fontSize: 22, fontWeight: "900", color: "#0F172A" },
  subtitle: { fontSize: 13, color: "#64748B", marginTop: 3 },
  emptyCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  emptyTitle: { fontSize: 13, fontWeight: "700", color: "#334155" },
  emptySub: { fontSize: 11, color: "#94A3B8", marginTop: 2 },
  residentPillActive: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#2563EB",
    borderWidth: 1,
    borderColor: "#2563EB",
    marginBottom: 14,
  },
  residentPillTextActive: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 12,
  },
  statsCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    marginBottom: 16,
  },
  statBox: { flex: 1, alignItems: "center" },
  statDivider: {
    width: 1,
    backgroundColor: "#BFDBFE",
    height: "80%",
    alignSelf: "center",
  },
  statLabel: { fontSize: 11, color: "#1E40AF", fontWeight: "700" },
  statVal: { fontSize: 17, fontWeight: "900", marginTop: 4 },
  batchActions: { flexDirection: "row", gap: 10, marginBottom: 20 },
  batchBtn: {
    flex: 1,
    backgroundColor: "#10B981",
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  batchBtnSecondary: {
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  batchBtnText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  batchBtnTextSecondary: { color: "#64748B" },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: "#0F172A" },
  sectionHint: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
    marginBottom: 14,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  dayBox: {
    width: "18.6%",
    aspectRatio: 0.85,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    paddingVertical: 4,
  },
  dayBoxPresent: { backgroundColor: "#10B981", borderColor: "#059669" },
  dayBoxAbsent: { backgroundColor: "#F8FAFC", borderColor: "#E2E8F0" },
  dayBoxWeekend: { borderStyle: "dashed" },
  dayOfWeek: { fontSize: 9, fontWeight: "700", textTransform: "uppercase" },
  dayNum: { fontSize: 15, fontWeight: "900", marginVertical: 1 },
  dayMonth: { fontSize: 8, fontWeight: "800", textTransform: "uppercase" },
  dayTextWhite: { color: "#FFFFFF" },
  dayTextWhiteSub: { color: "#E0F2FE" },
  dayTextDark: { color: "#0F172A" },
  dayTextMuted: { color: "#94A3B8" },
  statusBadge: {
    marginTop: 3,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  badgePresent: { backgroundColor: "rgba(255,255,255,0.3)" },
  badgeAbsent: { backgroundColor: "#FEE2E2" },
  statusBadgeText: { fontSize: 8, fontWeight: "900" },
  badgePresentText: { color: "#FFFFFF" },
  badgeAbsentText: { color: "#DC2626" },
});
