import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { mobileDataService } from "../services/firebaseDataService";
import { SmoothBottomSheetModal } from "./SmoothBottomSheetModal";
import { useTheme } from "../context/ThemeContext";

export type WaterPricingModel =
  | "PER_PERSON_DAY"
  | "FIXED_MONTHLY"
  | "FIXED_PER_PERSON_MONTH";

export interface WaterSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  householdId: string;
  initialConfig?: {
    pricingModel?: WaterPricingModel;
    rateCentavosPerPersonPerDay?: number;
    fixedMonthlyAmountCentavos?: number;
    fixedPerPersonAmountCentavos?: number;
  } | null;
  onSaved?: () => void;
}

export const WaterSettingsModal: React.FC<WaterSettingsModalProps> = ({
  visible,
  onClose,
  householdId,
  initialConfig,
  onSaved,
}) => {
  const { isDark, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [selectedMode, setSelectedMode] =
    useState<WaterPricingModel>("PER_PERSON_DAY");
  const [dailyRateInput, setDailyRateInput] = useState("5.00");
  const [fixedMonthlyInput, setFixedMonthlyInput] = useState("1200.00");
  const [fixedPerPersonInput, setFixedPerPersonInput] = useState("150.00");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialConfig) {
      if (initialConfig.pricingModel) {
        setSelectedMode(initialConfig.pricingModel);
      } else if ((initialConfig.fixedMonthlyAmountCentavos || 0) > 0) {
        setSelectedMode("FIXED_MONTHLY");
      } else {
        setSelectedMode("PER_PERSON_DAY");
      }

      if (typeof initialConfig.rateCentavosPerPersonPerDay === "number") {
        setDailyRateInput(
          (initialConfig.rateCentavosPerPersonPerDay / 100).toFixed(2),
        );
      }
      if (
        typeof initialConfig.fixedMonthlyAmountCentavos === "number" &&
        initialConfig.fixedMonthlyAmountCentavos > 0
      ) {
        setFixedMonthlyInput(
          (initialConfig.fixedMonthlyAmountCentavos / 100).toFixed(2),
        );
      }
      if (
        typeof initialConfig.fixedPerPersonAmountCentavos === "number" &&
        initialConfig.fixedPerPersonAmountCentavos > 0
      ) {
        setFixedPerPersonInput(
          (initialConfig.fixedPerPersonAmountCentavos / 100).toFixed(2),
        );
      }
    }
  }, [initialConfig, visible]);

  const handleSave = async () => {
    if (!householdId) {
      Alert.alert("Error", "No household ID found.");
      return;
    }

    let dailyCentavos = 500;
    let fixedMonthlyCentavos = 0;
    let fixedPerPersonCentavos = 0;

    if (selectedMode === "PER_PERSON_DAY") {
      const parsed = parseFloat(dailyRateInput.replace(/,/g, ""));
      if (isNaN(parsed) || parsed < 0) {
        Alert.alert(
          "Invalid Input",
          "Please enter a valid daily rate in Pesos (e.g. 5.00).",
        );
        return;
      }
      dailyCentavos = Math.round(parsed * 100);
    } else if (selectedMode === "FIXED_MONTHLY") {
      const parsed = parseFloat(fixedMonthlyInput.replace(/,/g, ""));
      if (isNaN(parsed) || parsed < 0) {
        Alert.alert(
          "Invalid Input",
          "Please enter a valid monthly bill amount in Pesos (e.g. 1200.00).",
        );
        return;
      }
      fixedMonthlyCentavos = Math.round(parsed * 100);
    } else if (selectedMode === "FIXED_PER_PERSON_MONTH") {
      const parsed = parseFloat(fixedPerPersonInput.replace(/,/g, ""));
      if (isNaN(parsed) || parsed < 0) {
        Alert.alert(
          "Invalid Input",
          "Please enter a valid flat fee per person in Pesos (e.g. 150.00).",
        );
        return;
      }
      fixedPerPersonCentavos = Math.round(parsed * 100);
    }

    setSaving(true);
    try {
      await mobileDataService.saveWaterConfig(householdId, {
        pricingModel: selectedMode,
        rateCentavosPerPersonPerDay: dailyCentavos,
        fixedMonthlyAmountCentavos: fixedMonthlyCentavos,
        fixedPerPersonAmountCentavos: fixedPerPersonCentavos,
        mode: "BILLING_CYCLE",
      });

      setSaving(false);
      Alert.alert(
        "Water Settings Saved",
        selectedMode === "PER_PERSON_DAY"
          ? `Daily Attendance mode active (₱${(dailyCentavos / 100).toFixed(2)} / person / day). Roommates can log attendance on their calendar.`
          : selectedMode === "FIXED_MONTHLY"
            ? `Fixed Monthly Household mode active (₱${(fixedMonthlyCentavos / 100).toFixed(2)} total). Amount is split equally among active payors.`
            : `Flat Fee Per Person mode active (₱${(fixedPerPersonCentavos / 100).toFixed(2)} / resident). Roommates are billed this flat fee each month.`,
      );
      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      setSaving(false);
      Alert.alert("Error", err.message || "Failed to save water settings.");
    }
  };

  return (
    <SmoothBottomSheetModal
      visible={visible}
      onClose={onClose}
      variant="bottom-sheet"
      showChipBar={true}
      title="Water Billing Settings"
      subtitle="Configure how water is billed & logged"
      icon={<Feather name="droplet" size={18} color="#0284C7" />}
      maxHeight="90%"
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollBody,
          { paddingBottom: Math.max(80, insets.bottom + 60) },
        ]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={true}
      >
        {/* Segmented Mode Selector */}
        <Text style={[styles.sectionLabel, isDark && { color: colors.text }]}>
          Select Pricing Model
        </Text>
        <View
          style={[
            styles.segmentContainer,
            isDark && { backgroundColor: colors.surfaceInset },
          ]}
        >
          {/* Mode 1 */}
          <TouchableOpacity
            style={[
              styles.segmentBtn,
              selectedMode === "PER_PERSON_DAY" && [
                styles.segmentBtnActive,
                isDark && { backgroundColor: colors.card, shadowColor: "#000" },
              ],
            ]}
            onPress={() => setSelectedMode("PER_PERSON_DAY")}
            activeOpacity={0.8}
          >
            <Feather
              name="calendar"
              size={14}
              color={
                selectedMode === "PER_PERSON_DAY"
                  ? isDark
                    ? colors.accent
                    : "#0284C7"
                  : isDark
                    ? colors.textMuted
                    : "#64748B"
              }
            />
            <Text
              style={[
                styles.segmentBtnText,
                isDark && { color: colors.textMuted },
                selectedMode === "PER_PERSON_DAY" && [
                  styles.segmentBtnTextActive,
                  isDark && { color: colors.accent },
                ],
              ]}
            >
              ₱/P/D
            </Text>
          </TouchableOpacity>

          {/* Mode 2 */}
          <TouchableOpacity
            style={[
              styles.segmentBtn,
              selectedMode === "FIXED_MONTHLY" && [
                styles.segmentBtnActive,
                isDark && { backgroundColor: colors.card, shadowColor: "#000" },
              ],
            ]}
            onPress={() => setSelectedMode("FIXED_MONTHLY")}
            activeOpacity={0.8}
          >
            <Feather
              name="users"
              size={14}
              color={
                selectedMode === "FIXED_MONTHLY"
                  ? isDark
                    ? colors.accent
                    : "#0284C7"
                  : isDark
                    ? colors.textMuted
                    : "#64748B"
              }
            />
            <Text
              style={[
                styles.segmentBtnText,
                isDark && { color: colors.textMuted },
                selectedMode === "FIXED_MONTHLY" && [
                  styles.segmentBtnTextActive,
                  isDark && { color: colors.accent },
                ],
              ]}
            >
              FMo
            </Text>
          </TouchableOpacity>

          {/* Mode 3 */}
          <TouchableOpacity
            style={[
              styles.segmentBtn,
              selectedMode === "FIXED_PER_PERSON_MONTH" && [
                styles.segmentBtnActive,
                isDark && { backgroundColor: colors.card, shadowColor: "#000" },
              ],
            ]}
            onPress={() => setSelectedMode("FIXED_PER_PERSON_MONTH")}
            activeOpacity={0.8}
          >
            <Feather
              name="user"
              size={14}
              color={
                selectedMode === "FIXED_PER_PERSON_MONTH"
                  ? isDark
                    ? colors.accent
                    : "#0284C7"
                  : isDark
                    ? colors.textMuted
                    : "#64748B"
              }
            />
            <Text
              style={[
                styles.segmentBtnText,
                isDark && { color: colors.textMuted },
                selectedMode === "FIXED_PER_PERSON_MONTH" && [
                  styles.segmentBtnTextActive,
                  isDark && { color: colors.accent },
                ],
              ]}
            >
              F/P/Mo
            </Text>
          </TouchableOpacity>
        </View>

        {/* Mode-Specific Input Field */}
        {selectedMode === "PER_PERSON_DAY" && (
          <View style={styles.inputSection}>
            <Text
              style={[
                styles.inputFieldLabel,
                isDark && { color: colors.textSecondary },
              ]}
            >
              Daily Water Rate (₱ per person / day present)
            </Text>
            <View
              style={[
                styles.currencyInputRow,
                isDark && {
                  backgroundColor: colors.surfaceInset,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.currencyPrefix,
                  isDark && { color: colors.accent },
                ]}
              >
                ₱
              </Text>
              <TextInput
                style={[
                  styles.currencyTextInput,
                  isDark && { color: colors.text },
                ]}
                value={dailyRateInput}
                onChangeText={setDailyRateInput}
                keyboardType="decimal-pad"
                placeholder="5.00"
                placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
              />
            </View>

            <View
              style={[
                styles.infoCard,
                isDark && {
                  backgroundColor: "rgba(59, 130, 246, 0.12)",
                  borderColor: "rgba(59, 130, 246, 0.25)",
                },
              ]}
            >
              <View style={styles.infoIconBox}>
                <Ionicons
                  name="information-circle"
                  size={18}
                  color={isDark ? colors.accent : "#0284C7"}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.infoTitle, isDark && { color: colors.accent }]}
                >
                  Daily Attendance Calendar Active
                </Text>
                <Text
                  style={[
                    styles.infoDesc,
                    isDark && { color: colors.textSecondary },
                  ]}
                >
                  Roommates mark their stay on the interactive calendar. Water
                  dues equal verified days present × ₱{dailyRateInput || "0.00"}
                  . Non-payor consumption is automatically absorbed fairly
                  across paying roommates.
                </Text>
              </View>
            </View>
          </View>
        )}

        {selectedMode === "FIXED_MONTHLY" && (
          <View style={styles.inputSection}>
            <Text
              style={[
                styles.inputFieldLabel,
                isDark && { color: colors.textSecondary },
              ]}
            >
              Total Household Monthly Water Bill (₱)
            </Text>
            <View
              style={[
                styles.currencyInputRow,
                isDark && {
                  backgroundColor: colors.surfaceInset,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.currencyPrefix,
                  isDark && { color: colors.accent },
                ]}
              >
                ₱
              </Text>
              <TextInput
                style={[
                  styles.currencyTextInput,
                  isDark && { color: colors.text },
                ]}
                value={fixedMonthlyInput}
                onChangeText={setFixedMonthlyInput}
                keyboardType="decimal-pad"
                placeholder="1200.00"
                placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
              />
            </View>

            <View
              style={[
                styles.infoCard,
                isDark && {
                  backgroundColor: "rgba(16, 185, 129, 0.12)",
                  borderColor: "rgba(16, 185, 129, 0.25)",
                },
              ]}
            >
              <View style={styles.infoIconBox}>
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color={isDark ? colors.success : "#059669"}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.infoTitle,
                    isDark ? { color: colors.success } : { color: "#065F46" },
                  ]}
                >
                  No Daily Attendance Required
                </Text>
                <Text
                  style={[
                    styles.infoDesc,
                    isDark && { color: colors.textSecondary },
                  ]}
                >
                  The total household bill of ₱{fixedMonthlyInput || "0.00"} is
                  split evenly across all active paying roommates. Roommates see
                  an informational notice instead of the attendance calendar.
                </Text>
              </View>
            </View>
          </View>
        )}

        {selectedMode === "FIXED_PER_PERSON_MONTH" && (
          <View style={styles.inputSection}>
            <Text
              style={[
                styles.inputFieldLabel,
                isDark && { color: colors.textSecondary },
              ]}
            >
              Fixed Rate Per Person (₱ / resident / month)
            </Text>
            <View
              style={[
                styles.currencyInputRow,
                isDark && {
                  backgroundColor: colors.surfaceInset,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.currencyPrefix,
                  isDark && { color: colors.accent },
                ]}
              >
                ₱
              </Text>
              <TextInput
                style={[
                  styles.currencyTextInput,
                  isDark && { color: colors.text },
                ]}
                value={fixedPerPersonInput}
                onChangeText={setFixedPerPersonInput}
                keyboardType="decimal-pad"
                placeholder="150.00"
                placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
              />
            </View>

            <View
              style={[
                styles.infoCard,
                isDark && {
                  backgroundColor: "rgba(16, 185, 129, 0.12)",
                  borderColor: "rgba(16, 185, 129, 0.25)",
                },
              ]}
            >
              <View style={styles.infoIconBox}>
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color={isDark ? colors.success : "#059669"}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.infoTitle,
                    isDark ? { color: colors.success } : { color: "#065F46" },
                  ]}
                >
                  Flat Rate Per Resident
                </Text>
                <Text
                  style={[
                    styles.infoDesc,
                    isDark && { color: colors.textSecondary },
                  ]}
                >
                  Each paying roommate is charged a flat fee of ₱
                  {fixedPerPersonInput || "0.00"} every month. Attendance
                  logging is disabled for roommates.
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom Actions */}
      <View
        style={[
          styles.bottomBar,
          isDark && { borderTopColor: colors.border },
          { paddingBottom: Math.max(12, insets.bottom) },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.cancelBtn,
            isDark && {
              backgroundColor: colors.surfaceInset,
              borderWidth: 1,
              borderColor: colors.border,
            },
          ]}
          onPress={onClose}
          disabled={saving}
        >
          <Text
            style={[
              styles.cancelBtnText,
              isDark && { color: colors.textSecondary },
            ]}
          >
            Cancel
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.saveBtn,
            isDark && { backgroundColor: colors.primary },
            saving && { opacity: 0.7 },
          ]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Feather
                name="check"
                size={16}
                color="#FFFFFF"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.saveBtnText}>Save Water Settings</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SmoothBottomSheetModal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "flex-end",
  },
  dismissArea: {
    flex: 1,
  },
  modalContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 20,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    paddingHorizontal: 22,
    maxHeight: "88%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  titleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dropletIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#E0F2FE",
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#0F172A",
  },
  modalSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
  },
  scrollBody: {
    paddingBottom: 10,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1E293B",
    marginBottom: 10,
  },
  segmentContainer: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 16,
    padding: 4,
    gap: 4,
    marginBottom: 20,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 5,
  },
  segmentBtnActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
  },
  segmentBtnTextActive: {
    color: "#0284C7",
    fontWeight: "900",
  },
  inputSection: {
    marginTop: 4,
  },
  inputFieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 8,
  },
  currencyInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  currencyPrefix: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0284C7",
    marginRight: 6,
  },
  currencyTextInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    paddingVertical: 12,
  },
  infoCard: {
    flexDirection: "row",
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
    borderRadius: 16,
    padding: 14,
    gap: 12,
    alignItems: "flex-start",
  },
  infoIconBox: {
    marginTop: 2,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0369A1",
    marginBottom: 4,
  },
  infoDesc: {
    fontSize: 12,
    color: "#334155",
    lineHeight: 18,
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748B",
  },
  saveBtn: {
    flex: 2,
    flexDirection: "row",
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: "#0284C7",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0284C7",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});
