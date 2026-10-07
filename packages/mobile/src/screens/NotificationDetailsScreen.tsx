import React from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { formatPesos } from "@propertyflow/shared";
import {
  MobileExpense,
  MobileNotificationItem,
  NotificationCategory,
  cleanBillTitle,
} from "../services/firebaseDataService";
import { useTheme } from "../context/ThemeContext";

export interface NotificationDetailsScreenProps {
  notification: MobileNotificationItem;
  onBack: () => void;
  onPrimaryAction?: (notification: MobileNotificationItem) => void;
  currentUserId?: string;
  groupName?: string;
  household?: any | null;
  expense?: MobileExpense | null;
  payment?: any | null;
  member?: any | null;
  activeCycle?: any | null;
  cycleAttendance?: any[];
  members?: any[];
}

function getCategoryMetaVisuals(
  category: NotificationCategory,
  isDark = false,
) {
  switch (category) {
    case "reminder":
      return {
        bgColor: isDark ? "rgba(239, 68, 68, 0.2)" : "#FEE2E2",
        accentColor: isDark ? "#F87171" : "#EF4444",
        badgeBg: isDark ? "rgba(239, 68, 68, 0.15)" : "#FEF2F2",
        badgeBorder: isDark ? "rgba(239, 68, 68, 0.3)" : "#FECACA",
        badgeText: isDark ? "#F87171" : "#DC2626",
        label: "Payment Reminder",
        actionLabel: "Settle Dues Now",
        actionIcon: "credit-card" as const,
        icon: (
          <Feather
            name="bell"
            size={26}
            color={isDark ? "#F87171" : "#EF4444"}
          />
        ),
      };
    case "expense_added":
      return {
        bgColor: isDark ? "rgba(16, 185, 129, 0.2)" : "#DCFCE7",
        accentColor: isDark ? "#34D399" : "#10B981",
        badgeBg: isDark ? "rgba(16, 185, 129, 0.15)" : "#F0FDF4",
        badgeBorder: isDark ? "rgba(16, 185, 129, 0.3)" : "#BBF7D0",
        badgeText: isDark ? "#34D399" : "#15803D",
        label: "Expense Update",
        actionLabel: "View in Bills & Split",
        actionIcon: "file-text" as const,
        icon: (
          <Feather
            name="plus"
            size={28}
            color={isDark ? "#34D399" : "#10B981"}
          />
        ),
      };
    case "payment_received":
      return {
        bgColor: isDark ? "rgba(59, 130, 246, 0.2)" : "#DBEAFE",
        accentColor: isDark ? "#60A5FA" : "#2563EB",
        badgeBg: isDark ? "rgba(59, 130, 246, 0.15)" : "#EFF6FF",
        badgeBorder: isDark ? "rgba(59, 130, 246, 0.3)" : "#BFDBFE",
        badgeText: isDark ? "#60A5FA" : "#1D4ED8",
        label: "Payment Activity",
        actionLabel: "Go to Payments",
        actionIcon: "check-circle" as const,
        icon: (
          <Feather
            name="check-circle"
            size={26}
            color={isDark ? "#60A5FA" : "#2563EB"}
          />
        ),
      };
    case "water_calculated":
      return {
        bgColor: isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE",
        accentColor: isDark ? "#38BDF8" : "#0284C7",
        badgeBg: isDark ? "rgba(2, 132, 199, 0.15)" : "#F0F9FF",
        badgeBorder: isDark ? "rgba(2, 132, 199, 0.3)" : "#BAE6FD",
        badgeText: isDark ? "#38BDF8" : "#0369A1",
        label: "Water & Attendance",
        actionLabel: "Open Attendance Calendar",
        actionIcon: "calendar" as const,
        icon: (
          <Feather
            name="file-text"
            size={26}
            color={isDark ? "#38BDF8" : "#0284C7"}
          />
        ),
      };
    case "group_invite":
    default:
      return {
        bgColor: isDark ? "rgba(147, 51, 234, 0.2)" : "#F3E8FF",
        accentColor: isDark ? "#C084FC" : "#9333EA",
        badgeBg: isDark ? "rgba(147, 51, 234, 0.15)" : "#FAF5FF",
        badgeBorder: isDark ? "rgba(147, 51, 234, 0.3)" : "#E9D5FF",
        badgeText: isDark ? "#C084FC" : "#7E22CE",
        label: "Household Group",
        actionLabel: "Open Household Group",
        actionIcon: "users" as const,
        icon: (
          <Ionicons
            name="people-outline"
            size={28}
            color={isDark ? "#C084FC" : "#9333EA"}
          />
        ),
      };
  }
}

function formatFullDateTime(isoOrDate?: string | number): string {
  if (!isoOrDate) return "Recently";
  const d = new Date(isoOrDate);
  if (isNaN(d.getTime())) return String(isoOrDate);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatShortDate(isoOrDate?: string | number): string {
  if (!isoOrDate) return "—";
  const d = new Date(isoOrDate);
  if (isNaN(d.getTime())) return String(isoOrDate);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export const NotificationDetailsScreen: React.FC<
  NotificationDetailsScreenProps
> = ({
  notification,
  onBack,
  onPrimaryAction,
  currentUserId,
  groupName = "Household",
  household,
  expense,
  payment,
  member,
  activeCycle,
  cycleAttendance = [],
  members = [],
}) => {
  const { isDark, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const visuals = getCategoryMetaVisuals(notification.category, isDark);

  const topInset = Math.max(
    Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0,
    insets.top,
    24,
  );

  const cycleLabel =
    activeCycle?.name ||
    activeCycle?.cycleName ||
    new Date().toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });

  // Compute user's share if an expense is linked
  const userShareCents = React.useMemo(() => {
    if (!expense) return null;
    if (
      Array.isArray(expense.splitDetails) &&
      expense.splitDetails.length > 0
    ) {
      if (currentUserId) {
        const mySplit = expense.splitDetails.find(
          (s) => s.userId === currentUserId,
        );
        if (mySplit) return mySplit.shareCentavos;
      }
      const payorSplits = expense.splitDetails.filter((s) => !s.isExempt);
      if (payorSplits.length > 0) {
        return payorSplits[0].shareCentavos;
      }
    }
    const activePayorCount = Math.max(
      1,
      members.filter(
        (m) => m.role !== "NON_PAYOR" && m.role !== "RESIDENT_NON_PAYOR",
      ).length || 1,
    );
    return Math.round((expense.amountCents || 0) / activePayorCount);
  }, [expense, currentUserId, members]);

  const isExpensePaid = Boolean(
    expense && (expense.status === "PAID" || expense.isPaid === true),
  );

  const presentRecords = cycleAttendance.filter((a) => a.status === "PRESENT");
  const splitDaysSum = Array.isArray(expense?.splitDetails)
    ? expense!.splitDetails.reduce(
        (sum, s) => sum + (Number(s.daysPresent) || 0),
        0,
      )
    : 0;
  const totalPresentDays =
    presentRecords.length > 0 ? presentRecords.length : splitDaysSum;

  return (
    <View
      style={[
        styles.container,
        isDark && { backgroundColor: colors.background },
      ]}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        translucent
        backgroundColor="transparent"
      />

      {/* Top Navigation Bar */}
      <View
        style={[
          styles.topNav,
          { paddingTop: topInset + 8 },
          isDark && { backgroundColor: colors.background },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.backButton,
            isDark && {
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
            },
          ]}
          activeOpacity={0.75}
          onPress={onBack}
          accessibilityLabel="Back to Notifications"
        >
          <Feather
            name="chevron-left"
            size={20}
            color={isDark ? colors.text : "#0F172A"}
          />
        </TouchableOpacity>

        <Text style={[styles.screenTitle, isDark && { color: colors.text }]}>
          Notification Details
        </Text>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(100, insets.bottom + 50) },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={true}
      >
        {/* Main Full-Mode Notification Hero Card */}
        <View
          style={[
            styles.heroCard,
            isDark && {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.heroTopBar}>
            <View
              style={[styles.heroIconBox, { backgroundColor: visuals.bgColor }]}
            >
              {visuals.icon}
            </View>

            <View style={styles.badgesCol}>
              <View
                style={[
                  styles.categoryBadge,
                  {
                    backgroundColor: visuals.badgeBg,
                    borderColor: visuals.badgeBorder,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.categoryBadgeText,
                    { color: visuals.badgeText },
                  ]}
                >
                  {visuals.label}
                </Text>
              </View>

              <View
                style={[
                  styles.readStatusPill,
                  isDark && {
                    backgroundColor: "rgba(16, 185, 129, 0.16)",
                    borderColor: "rgba(16, 185, 129, 0.3)",
                    borderWidth: 1,
                  },
                ]}
              >
                <Feather
                  name="check"
                  size={11}
                  color={isDark ? colors.success : "#10B981"}
                />
                <Text
                  style={[
                    styles.readStatusText,
                    isDark && { color: colors.success },
                  ]}
                >
                  Read • Cloud Synced
                </Text>
              </View>
            </View>
          </View>

          <Text style={[styles.heroTitle, isDark && { color: colors.text }]}>
            {notification.title}
          </Text>

          <View style={styles.timestampRow}>
            <Feather
              name="clock"
              size={13}
              color={isDark ? colors.textMuted : "#64748B"}
            />
            <Text
              style={[
                styles.timestampText,
                isDark && { color: colors.textSecondary },
              ]}
            >
              {notification.timeLabel} •{" "}
              {formatFullDateTime(
                notification.createdTimestamp || notification.timestampMs,
              )}
            </Text>
          </View>

          {/* Full Unclamped Notification Message Box */}
          <View
            style={[
              styles.messageBox,
              isDark && {
                backgroundColor: colors.surfaceInset,
                borderColor: colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.messageLabel,
                isDark && { color: colors.textMuted },
              ]}
            >
              FULL MESSAGE
            </Text>
            <Text
              style={[styles.fullMessageText, isDark && { color: colors.text }]}
            >
              {notification.spans && notification.spans.length > 0
                ? notification.spans.map((span, idx) => (
                    <Text
                      key={`${notification.id}_full_span_${idx}`}
                      style={[
                        span.bold && [
                          styles.boldSpan,
                          isDark && { color: colors.text },
                        ],
                        span.color ? { color: span.color } : undefined,
                      ]}
                    >
                      {span.text}
                    </Text>
                  ))
                : notification.message}
            </Text>
          </View>
        </View>

        {/* Contextual Details for Reminder / Expense Added */}
        {(notification.category === "reminder" ||
          notification.category === "expense_added") &&
          expense && (
            <>
              <View
                style={[
                  styles.sectionCard,
                  isDark && {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.sectionHeaderRow}>
                  <Text
                    style={[
                      styles.sectionTitle,
                      isDark && { color: colors.text },
                    ]}
                  >
                    Bill & Expense Summary
                  </Text>
                  <View
                    style={[
                      styles.statusTag,
                      isExpensePaid
                        ? [
                            styles.statusTagPaid,
                            isDark && {
                              backgroundColor: "rgba(16, 185, 129, 0.16)",
                              borderColor: "rgba(16, 185, 129, 0.35)",
                            },
                          ]
                        : [
                            styles.statusTagUnpaid,
                            isDark && {
                              backgroundColor: "rgba(239, 68, 68, 0.16)",
                              borderColor: "rgba(239, 68, 68, 0.35)",
                            },
                          ],
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusTagText,
                        isExpensePaid
                          ? [
                              styles.statusTagTextPaid,
                              isDark && { color: colors.success },
                            ]
                          : [
                              styles.statusTagTextUnpaid,
                              isDark && { color: colors.danger },
                            ],
                      ]}
                    >
                      {isExpensePaid ? "PAID" : "UNPAID"}
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.amountHighlightBox,
                    isDark && {
                      backgroundColor: colors.surfaceInset,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.amountCol}>
                    <Text
                      style={[
                        styles.amountSubLabel,
                        isDark && { color: colors.textSecondary },
                      ]}
                    >
                      Total Bill Amount
                    </Text>
                    <Text
                      style={[
                        styles.amountPrimaryValue,
                        isDark && { color: colors.text },
                      ]}
                    >
                      {formatPesos(expense.amountCents || 0)}
                    </Text>
                  </View>
                  {userShareCents !== null && (
                    <View
                      style={[
                        styles.amountCol,
                        styles.amountColDivider,
                        isDark && { borderLeftColor: colors.border },
                      ]}
                    >
                      <Text
                        style={[
                          styles.amountSubLabel,
                          isDark && { color: colors.textSecondary },
                        ]}
                      >
                        Your Share
                      </Text>
                      <Text
                        style={[
                          styles.amountSecondaryValue,
                          {
                            color: isExpensePaid
                              ? isDark
                                ? colors.success
                                : "#10B981"
                              : isDark
                                ? colors.accent
                                : "#2563EB",
                          },
                        ]}
                      >
                        {formatPesos(userShareCents)}
                      </Text>
                    </View>
                  )}
                </View>

                <View
                  style={[
                    styles.infoRow,
                    isDark && { borderBottomColor: colors.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.infoLabel,
                      isDark && { color: colors.textSecondary },
                    ]}
                  >
                    Bill Title
                  </Text>
                  <Text
                    style={[styles.infoValue, isDark && { color: colors.text }]}
                  >
                    {cleanBillTitle(
                      expense.title,
                      expense.category,
                      groupName,
                    ) ||
                      expense.category ||
                      "Household Expense"}
                  </Text>
                </View>

                <View
                  style={[
                    styles.infoRow,
                    isDark && { borderBottomColor: colors.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.infoLabel,
                      isDark && { color: colors.textSecondary },
                    ]}
                  >
                    Category
                  </Text>
                  <Text
                    style={[styles.infoValue, isDark && { color: colors.text }]}
                  >
                    {expense.category || "General"}
                  </Text>
                </View>

                <View
                  style={[
                    styles.infoRow,
                    isDark && { borderBottomColor: colors.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.infoLabel,
                      isDark && { color: colors.textSecondary },
                    ]}
                  >
                    Recorded By
                  </Text>
                  <Text
                    style={[styles.infoValue, isDark && { color: colors.text }]}
                  >
                    {expense.payerName || "Host"}
                  </Text>
                </View>

                <View
                  style={[
                    styles.infoRow,
                    isDark && { borderBottomColor: colors.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.infoLabel,
                      isDark && { color: colors.textSecondary },
                    ]}
                  >
                    Split Method
                  </Text>
                  <Text
                    style={[styles.infoValue, isDark && { color: colors.text }]}
                  >
                    {expense.splitMethod || "Equal Split"}
                  </Text>
                </View>

                <View
                  style={[
                    styles.infoRow,
                    isDark && { borderBottomColor: colors.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.infoLabel,
                      isDark && { color: colors.textSecondary },
                    ]}
                  >
                    Billing Cycle
                  </Text>
                  <Text
                    style={[styles.infoValue, isDark && { color: colors.text }]}
                  >
                    {cycleLabel}
                  </Text>
                </View>

                <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                  <Text
                    style={[
                      styles.infoLabel,
                      isDark && { color: colors.textSecondary },
                    ]}
                  >
                    Date Logged
                  </Text>
                  <Text
                    style={[styles.infoValue, isDark && { color: colors.text }]}
                  >
                    {formatShortDate(expense.date || expense.createdAt)}
                  </Text>
                </View>
              </View>

              {/* Split Breakdown across Roommates */}
              {Array.isArray(expense.splitDetails) &&
                expense.splitDetails.length > 0 && (
                  <View
                    style={[
                      styles.sectionCard,
                      isDark && {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View style={styles.sectionHeaderRow}>
                      <Text
                        style={[
                          styles.sectionTitle,
                          isDark && { color: colors.text },
                        ]}
                      >
                        Roommate Split Breakdown
                      </Text>
                      <Text
                        style={[
                          styles.sectionMetaText,
                          isDark && { color: colors.textSecondary },
                        ]}
                      >
                        {expense.splitDetails.length}{" "}
                        {expense.splitDetails.length === 1
                          ? "member"
                          : "members"}
                      </Text>
                    </View>

                    {expense.splitDetails.map((split, idx) => {
                      const isMe =
                        Boolean(currentUserId) &&
                        split.userId === currentUserId;
                      return (
                        <View
                          key={`${split.userId || idx}_${idx}`}
                          style={[
                            styles.memberRow,
                            isDark && { borderBottomColor: colors.border },
                            idx === expense.splitDetails!.length - 1 && {
                              borderBottomWidth: 0,
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.memberAvatar,
                              isDark && {
                                backgroundColor: colors.surfaceInset,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.memberAvatarText,
                                isDark && { color: colors.accent },
                              ]}
                            >
                              {(split.displayName || "R")
                                .charAt(0)
                                .toUpperCase()}
                            </Text>
                          </View>
                          <View style={{ flex: 1, marginRight: 8 }}>
                            <Text
                              style={[
                                styles.memberName,
                                isDark && { color: colors.text },
                              ]}
                            >
                              {split.displayName || "Roommate"}
                              {isMe ? " (You)" : ""}
                            </Text>
                            <Text
                              style={[
                                styles.memberSub,
                                isDark && { color: colors.textSecondary },
                              ]}
                            >
                              {split.isExempt
                                ? "Exempt (Non-Payor)"
                                : split.note || "Payor Share"}
                            </Text>
                          </View>
                          <View style={{ alignItems: "flex-end" }}>
                            <Text
                              style={[
                                styles.memberShareAmount,
                                isDark && { color: colors.text },
                              ]}
                            >
                              {formatPesos(split.shareCentavos || 0)}
                            </Text>
                            <Text
                              style={[
                                styles.memberShareStatus,
                                {
                                  color:
                                    isExpensePaid || split.isPaid
                                      ? isDark
                                        ? colors.success
                                        : "#10B981"
                                      : split.isExempt
                                        ? isDark
                                          ? colors.textMuted
                                          : "#64748B"
                                        : isDark
                                          ? colors.accent
                                          : "#F59E0B",
                                },
                              ]}
                            >
                              {isExpensePaid || split.isPaid
                                ? "Paid"
                                : split.isExempt
                                  ? "Exempt"
                                  : "Pending"}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}

              {/* Notes or Receipt Image if present */}
              {(expense.notes || expense.receiptUrl) && (
                <View
                  style={[
                    styles.sectionCard,
                    isDark && {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.sectionTitle,
                      isDark && { color: colors.text },
                    ]}
                  >
                    Notes & Attachment
                  </Text>
                  {expense.notes ? (
                    <Text
                      style={[
                        styles.notesParagraph,
                        isDark && { color: colors.textSecondary },
                      ]}
                    >
                      {expense.notes}
                    </Text>
                  ) : null}
                  {expense.receiptUrl ? (
                    <Image
                      source={{ uri: expense.receiptUrl }}
                      style={styles.receiptPreview}
                      resizeMode="cover"
                    />
                  ) : null}
                </View>
              )}
            </>
          )}

        {/* Contextual Details for Payment Received / Submitted */}
        {notification.category === "payment_received" && payment && (
          <View
            style={[
              styles.sectionCard,
              isDark && {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.sectionHeaderRow}>
              <Text
                style={[styles.sectionTitle, isDark && { color: colors.text }]}
              >
                Payment Record Details
              </Text>
              <View
                style={[
                  styles.statusTag,
                  payment.status === "VERIFIED"
                    ? [
                        styles.statusTagPaid,
                        isDark && {
                          backgroundColor: "rgba(16, 185, 129, 0.16)",
                          borderColor: "rgba(16, 185, 129, 0.35)",
                        },
                      ]
                    : payment.status === "REJECTED"
                      ? [
                          styles.statusTagUnpaid,
                          isDark && {
                            backgroundColor: "rgba(239, 68, 68, 0.16)",
                            borderColor: "rgba(239, 68, 68, 0.35)",
                          },
                        ]
                      : [
                          styles.statusTagPending,
                          isDark && {
                            backgroundColor: "rgba(245, 158, 11, 0.16)",
                            borderColor: "rgba(245, 158, 11, 0.35)",
                          },
                        ],
                ]}
              >
                <Text
                  style={[
                    styles.statusTagText,
                    payment.status === "VERIFIED"
                      ? [
                          styles.statusTagTextPaid,
                          isDark && { color: colors.success },
                        ]
                      : payment.status === "REJECTED"
                        ? [
                            styles.statusTagTextUnpaid,
                            isDark && { color: colors.danger },
                          ]
                        : [
                            styles.statusTagTextPending,
                            isDark && { color: colors.warning },
                          ],
                  ]}
                >
                  {payment.status || "SUBMITTED"}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.amountHighlightBox,
                isDark && {
                  backgroundColor: colors.surfaceInset,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.amountCol}>
                <Text
                  style={[
                    styles.amountSubLabel,
                    isDark && { color: colors.textSecondary },
                  ]}
                >
                  Payment Amount
                </Text>
                <Text
                  style={[
                    styles.amountPrimaryValue,
                    { color: isDark ? colors.success : "#10B981" },
                  ]}
                >
                  {formatPesos(payment.amountCentavos || 0)}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.infoRow,
                isDark && { borderBottomColor: colors.border },
              ]}
            >
              <Text
                style={[
                  styles.infoLabel,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                Paid By
              </Text>
              <Text
                style={[styles.infoValue, isDark && { color: colors.text }]}
              >
                {payment.userName || payment.payerName || "Roommate"}
              </Text>
            </View>

            <View
              style={[
                styles.infoRow,
                isDark && { borderBottomColor: colors.border },
              ]}
            >
              <Text
                style={[
                  styles.infoLabel,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                Payment Method
              </Text>
              <Text
                style={[styles.infoValue, isDark && { color: colors.text }]}
              >
                {String(payment.paymentMethod || "BANK_TRANSFER").replace(
                  /_/g,
                  " ",
                )}
              </Text>
            </View>

            {payment.referenceNumber ? (
              <View
                style={[
                  styles.infoRow,
                  isDark && { borderBottomColor: colors.border },
                ]}
              >
                <Text
                  style={[
                    styles.infoLabel,
                    isDark && { color: colors.textSecondary },
                  ]}
                >
                  Reference No.
                </Text>
                <Text
                  style={[styles.infoValue, isDark && { color: colors.text }]}
                >
                  {payment.referenceNumber}
                </Text>
              </View>
            ) : null}

            <View
              style={[
                styles.infoRow,
                isDark && { borderBottomColor: colors.border },
              ]}
            >
              <Text
                style={[
                  styles.infoLabel,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                Household Group
              </Text>
              <Text
                style={[styles.infoValue, isDark && { color: colors.text }]}
              >
                {groupName}
              </Text>
            </View>

            <View
              style={[
                styles.infoRow,
                isDark && { borderBottomColor: colors.border },
                !payment.notes &&
                  !payment.proofOfPaymentUrl && { borderBottomWidth: 0 },
              ]}
            >
              <Text
                style={[
                  styles.infoLabel,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                Date Submitted
              </Text>
              <Text
                style={[styles.infoValue, isDark && { color: colors.text }]}
              >
                {formatFullDateTime(payment.createdDate || payment.paymentDate)}
              </Text>
            </View>

            {payment.notes ? (
              <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                <Text
                  style={[
                    styles.infoLabel,
                    isDark && { color: colors.textSecondary },
                  ]}
                >
                  Notes
                </Text>
                <Text
                  style={[styles.infoValue, isDark && { color: colors.text }]}
                >
                  {payment.notes}
                </Text>
              </View>
            ) : null}

            {payment.proofOfPaymentUrl ? (
              <View style={{ marginTop: 12 }}>
                <Text
                  style={[
                    styles.amountSubLabel,
                    { marginBottom: 8 },
                    isDark && { color: colors.textSecondary },
                  ]}
                >
                  Proof of Payment Receipt
                </Text>
                <Image
                  source={{ uri: payment.proofOfPaymentUrl }}
                  style={styles.receiptPreview}
                  resizeMode="cover"
                />
              </View>
            ) : null}
          </View>
        )}

        {/* Contextual Details for Water Bill Calculated */}
        {notification.category === "water_calculated" && (
          <View
            style={[
              styles.sectionCard,
              isDark && {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.sectionHeaderRow}>
              <Text
                style={[styles.sectionTitle, isDark && { color: colors.text }]}
              >
                Water & Attendance Breakdown
              </Text>
              <View
                style={[
                  styles.statusTag,
                  styles.statusTagInfo,
                  isDark && {
                    backgroundColor: "rgba(56, 189, 248, 0.16)",
                    borderColor: "rgba(56, 189, 248, 0.35)",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusTagText,
                    styles.statusTagTextInfo,
                    isDark && { color: "#38BDF8" },
                  ]}
                >
                  ACTIVE CYCLE
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.amountHighlightBox,
                isDark && {
                  backgroundColor: colors.surfaceInset,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.amountCol}>
                <Text
                  style={[
                    styles.amountSubLabel,
                    isDark && { color: colors.textSecondary },
                  ]}
                >
                  Logged Active Days
                </Text>
                <Text
                  style={[
                    styles.amountPrimaryValue,
                    { color: isDark ? colors.accent : "#0284C7" },
                  ]}
                >
                  {totalPresentDays} {totalPresentDays === 1 ? "Day" : "Days"}
                </Text>
              </View>
              {expense && (
                <View
                  style={[
                    styles.amountCol,
                    styles.amountColDivider,
                    isDark && { borderLeftColor: colors.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.amountSubLabel,
                      isDark && { color: colors.textSecondary },
                    ]}
                  >
                    Water Bill Total
                  </Text>
                  <Text
                    style={[
                      styles.amountSecondaryValue,
                      { color: isDark ? colors.text : "#0F172A" },
                    ]}
                  >
                    {formatPesos(expense.amountCents || 0)}
                  </Text>
                </View>
              )}
            </View>

            <View
              style={[
                styles.infoRow,
                isDark && { borderBottomColor: colors.border },
              ]}
            >
              <Text
                style={[
                  styles.infoLabel,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                Billing Cycle
              </Text>
              <Text
                style={[styles.infoValue, isDark && { color: colors.text }]}
              >
                {cycleLabel}
              </Text>
            </View>

            <View
              style={[
                styles.infoRow,
                isDark && { borderBottomColor: colors.border },
              ]}
            >
              <Text
                style={[
                  styles.infoLabel,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                Household Group
              </Text>
              <Text
                style={[styles.infoValue, isDark && { color: colors.text }]}
              >
                {groupName}
              </Text>
            </View>

            <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
              <Text
                style={[
                  styles.infoLabel,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                Calculation Method
              </Text>
              <Text
                style={[styles.infoValue, isDark && { color: colors.text }]}
              >
                Presence-Based Daily Water Split
              </Text>
            </View>
          </View>
        )}

        {/* Contextual Details for Group Invite / Join Request */}
        {notification.category === "group_invite" && (
          <View
            style={[
              styles.sectionCard,
              isDark && {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.sectionHeaderRow}>
              <Text
                style={[styles.sectionTitle, isDark && { color: colors.text }]}
              >
                Household Membership Info
              </Text>
              <View
                style={[
                  styles.statusTag,
                  member?.status === "PENDING"
                    ? [
                        styles.statusTagPending,
                        isDark && {
                          backgroundColor: "rgba(245, 158, 11, 0.16)",
                          borderColor: "rgba(245, 158, 11, 0.35)",
                        },
                      ]
                    : [
                        styles.statusTagPaid,
                        isDark && {
                          backgroundColor: "rgba(16, 185, 129, 0.16)",
                          borderColor: "rgba(16, 185, 129, 0.35)",
                        },
                      ],
                ]}
              >
                <Text
                  style={[
                    styles.statusTagText,
                    member?.status === "PENDING"
                      ? [
                          styles.statusTagTextPending,
                          isDark && { color: colors.warning },
                        ]
                      : [
                          styles.statusTagTextPaid,
                          isDark && { color: colors.success },
                        ],
                  ]}
                >
                  {member?.status === "PENDING" ? "PENDING" : "ACTIVE"}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.infoRow,
                isDark && { borderBottomColor: colors.border },
              ]}
            >
              <Text
                style={[
                  styles.infoLabel,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                Household Group
              </Text>
              <Text
                style={[styles.infoValue, isDark && { color: colors.text }]}
              >
                {groupName}
              </Text>
            </View>

            {member ? (
              <>
                <View
                  style={[
                    styles.infoRow,
                    isDark && { borderBottomColor: colors.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.infoLabel,
                      isDark && { color: colors.textSecondary },
                    ]}
                  >
                    Member Name
                  </Text>
                  <Text
                    style={[styles.infoValue, isDark && { color: colors.text }]}
                  >
                    {member.displayName || member.name || "Roommate"}
                  </Text>
                </View>

                {member.email || member.phoneNumber ? (
                  <View
                    style={[
                      styles.infoRow,
                      isDark && { borderBottomColor: colors.border },
                    ]}
                  >
                    <Text
                      style={[
                        styles.infoLabel,
                        isDark && { color: colors.textSecondary },
                      ]}
                    >
                      Contact
                    </Text>
                    <Text
                      style={[
                        styles.infoValue,
                        isDark && { color: colors.text },
                      ]}
                    >
                      {member.email || member.phoneNumber}
                    </Text>
                  </View>
                ) : null}

                <View
                  style={[
                    styles.infoRow,
                    isDark && { borderBottomColor: colors.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.infoLabel,
                      isDark && { color: colors.textSecondary },
                    ]}
                  >
                    Role
                  </Text>
                  <Text
                    style={[styles.infoValue, isDark && { color: colors.text }]}
                  >
                    {String(member.role || "PAYOR").replace(/_/g, " ")}
                  </Text>
                </View>
              </>
            ) : null}

            {household?.inviteCode ? (
              <View
                style={[
                  styles.infoRow,
                  isDark && { borderBottomColor: colors.border },
                ]}
              >
                <Text
                  style={[
                    styles.infoLabel,
                    isDark && { color: colors.textSecondary },
                  ]}
                >
                  Group Invite Code
                </Text>
                <Text
                  style={[
                    styles.infoValue,
                    { color: isDark ? colors.accent : "#2563EB" },
                  ]}
                >
                  {household.inviteCode}
                </Text>
              </View>
            ) : null}

            <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
              <Text
                style={[
                  styles.infoLabel,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                Timestamp
              </Text>
              <Text
                style={[styles.infoValue, isDark && { color: colors.text }]}
              >
                {formatFullDateTime(
                  member?.joinedDate ||
                    member?.requestedDate ||
                    notification.createdTimestamp,
                )}
              </Text>
            </View>
          </View>
        )}

        {/* Cloud Notification Record Metadata */}
        <View
          style={[
            styles.sectionCard,
            isDark && {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.sectionTitle, isDark && { color: colors.text }]}>
            Notification Record
          </Text>

          <View
            style={[
              styles.infoRow,
              isDark && { borderBottomColor: colors.border },
            ]}
          >
            <Text
              style={[
                styles.infoLabel,
                isDark && { color: colors.textSecondary },
              ]}
            >
              Household
            </Text>
            <Text style={[styles.infoValue, isDark && { color: colors.text }]}>
              {groupName}
            </Text>
          </View>

          <View
            style={[
              styles.infoRow,
              isDark && { borderBottomColor: colors.border },
            ]}
          >
            <Text
              style={[
                styles.infoLabel,
                isDark && { color: colors.textSecondary },
              ]}
            >
              Status
            </Text>
            <Text
              style={[
                styles.infoValue,
                { color: isDark ? colors.success : "#10B981" },
              ]}
            >
              Read & Saved to Cloud
            </Text>
          </View>

          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Text
              style={[
                styles.infoLabel,
                isDark && { color: colors.textSecondary },
              ]}
            >
              Notification ID
            </Text>
            <Text
              style={[
                styles.infoValue,
                {
                  fontSize: 12,
                  color: isDark ? colors.textMuted : "#64748B",
                },
              ]}
              numberOfLines={1}
            >
              {notification.cloudDocId || notification.id}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        {onPrimaryAction && (
          <TouchableOpacity
            style={[
              styles.primaryActionButton,
              isDark && {
                backgroundColor: colors.primary,
                shadowColor: colors.primary,
              },
            ]}
            activeOpacity={0.85}
            onPress={() => onPrimaryAction(notification)}
          >
            <Feather
              name={visuals.actionIcon}
              size={18}
              color="#FFFFFF"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.primaryActionButtonText}>
              {visuals.actionLabel}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.secondaryBackButton,
            isDark && {
              backgroundColor: colors.surfaceInset,
              borderColor: colors.border,
            },
          ]}
          activeOpacity={0.75}
          onPress={onBack}
        >
          <Text
            style={[
              styles.secondaryBackButtonText,
              isDark && { color: colors.text },
            ]}
          >
            Back to All Notifications
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  topNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: "#F8FAFC",
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(15, 23, 42, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 44,
    height: 44,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  heroTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  heroIconBox: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  badgesCol: {
    alignItems: "flex-end",
    gap: 6,
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  readStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
  },
  readStatusText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#15803D",
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  timestampRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 18,
  },
  timestampText: {
    fontSize: 12.5,
    fontWeight: "500",
    color: "#64748B",
  },
  messageBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  messageLabel: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#94A3B8",
    letterSpacing: 0.7,
    marginBottom: 6,
  },
  fullMessageText: {
    fontSize: 15,
    lineHeight: 23,
    color: "#334155",
    fontWeight: "400",
  },
  boldSpan: {
    fontWeight: "700",
    color: "#0F172A",
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.2,
  },
  sectionMetaText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  statusTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusTagPaid: {
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0",
  },
  statusTagUnpaid: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  statusTagPending: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
  },
  statusTagInfo: {
    backgroundColor: "#F0F9FF",
    borderColor: "#BAE6FD",
  },
  statusTagText: {
    fontSize: 11,
    fontWeight: "800",
  },
  statusTagTextPaid: {
    color: "#15803D",
  },
  statusTagTextUnpaid: {
    color: "#DC2626",
  },
  statusTagTextPending: {
    color: "#B45309",
  },
  statusTagTextInfo: {
    color: "#0369A1",
  },
  amountHighlightBox: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  amountCol: {
    flex: 1,
  },
  amountColDivider: {
    borderLeftWidth: 1,
    borderLeftColor: "#E2E8F0",
    paddingLeft: 14,
  },
  amountSubLabel: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#64748B",
    marginBottom: 4,
  },
  amountPrimaryValue: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0F172A",
  },
  amountSecondaryValue: {
    fontSize: 20,
    fontWeight: "900",
    color: "#2563EB",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
    marginRight: 12,
  },
  infoValue: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: "700",
    color: "#0F172A",
    textAlign: "right",
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  memberAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  memberAvatarText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#2563EB",
  },
  memberName: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#0F172A",
  },
  memberSub: {
    fontSize: 11.5,
    color: "#64748B",
    marginTop: 2,
  },
  memberShareAmount: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  memberShareStatus: {
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  notesParagraph: {
    fontSize: 13.5,
    lineHeight: 20,
    color: "#475569",
    marginTop: 8,
  },
  receiptPreview: {
    width: "100%",
    height: 190,
    borderRadius: 14,
    marginTop: 10,
    backgroundColor: "#F1F5F9",
  },
  primaryActionButton: {
    backgroundColor: "#2563EB",
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    marginBottom: 12,
  },
  primaryActionButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  secondaryBackButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  secondaryBackButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569",
  },
});
