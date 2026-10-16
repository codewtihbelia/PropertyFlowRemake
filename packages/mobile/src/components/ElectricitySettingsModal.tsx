import React, { useState, useEffect, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { mobileDataService } from "../services/firebaseDataService";
import { SmoothBottomSheetModal } from "./SmoothBottomSheetModal";
import { useTheme } from "../context/ThemeContext";

export interface ElectricityConfigData {
  previousReadingKwh?: number;
  currentReadingKwh?: number;
  rateCentavosPerKwh?: number;
  consumedKwh?: number;
  totalAmountCentavos?: number;
  billingCycleId?: string;
}

export interface ElectricitySettingsModalProps {
  visible: boolean;
  onClose: () => void;
  householdId: string;
  billingCycleId?: string;
  initialConfig?: ElectricityConfigData | null;
  onSaved?: () => void;
}

export const ElectricitySettingsModal: React.FC<
  ElectricitySettingsModalProps
> = ({
  visible,
  onClose,
  householdId,
  billingCycleId,
  initialConfig,
  onSaved,
}) => {
  const { isDark, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [previousReadingInput, setPreviousReadingInput] = useState("0");
  const [currentReadingInput, setCurrentReadingInput] = useState("0");
  const [ratePerKwhInput, setRatePerKwhInput] = useState("12.00");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialConfig) {
      if (typeof initialConfig.previousReadingKwh === "number") {
        setPreviousReadingInput(String(initialConfig.previousReadingKwh));
      }
      if (typeof initialConfig.currentReadingKwh === "number") {
        setCurrentReadingInput(String(initialConfig.currentReadingKwh));
      }
      if (
        typeof initialConfig.rateCentavosPerKwh === "number" &&
        initialConfig.rateCentavosPerKwh > 0
      ) {
        setRatePerKwhInput((initialConfig.rateCentavosPerKwh / 100).toFixed(2));
      }
    }
  }, [initialConfig, visible]);

  const calculation = useMemo(() => {
    const prev = parseFloat(previousReadingInput.replace(/,/g, "")) || 0;
    const curr = parseFloat(currentReadingInput.replace(/,/g, "")) || 0;
    const ratePesos = parseFloat(ratePerKwhInput.replace(/,/g, "")) || 0;
    const diffKwh = curr - prev;
    const consumedKwh = Math.max(0, Math.round(diffKwh * 100) / 100);
    const totalPesos = Math.max(0, consumedKwh * ratePesos);
    const totalCentavos = Math.round(totalPesos * 100);
    return {
      prev,
      curr,
      ratePesos,
      diffKwh,
      consumedKwh,
      totalPesos,
      totalCentavos,
      isInvalidReading: curr > 0 && curr < prev,
    };
  }, [previousReadingInput, currentReadingInput, ratePerKwhInput]);

  const handleSave = async () => {
    if (!householdId) {
      Alert.alert("Error", "No household ID found.");
      return;
    }

    const prev = parseFloat(previousReadingInput.replace(/,/g, ""));
    const curr = parseFloat(currentReadingInput.replace(/,/g, ""));
    const ratePesos = parseFloat(ratePerKwhInput.replace(/,/g, ""));

    if (isNaN(prev) || prev < 0) {
      Alert.alert(
        "Invalid Previous Reading",
        "Please enter a valid Previous Reading in kWh (0 or higher).",
      );
      return;
    }

    if (isNaN(curr) || curr < 0) {
      Alert.alert(
        "Invalid Current Reading",
        "Please enter a valid Current Reading in kWh (0 or higher).",
      );
      return;
    }

    if (curr < prev) {
      Alert.alert(
        "Reading Mismatch",
        "Current Reading cannot be lower than Previous Reading. Please check your meter values.",
      );
      return;
    }

    if (isNaN(ratePesos) || ratePesos <= 0) {
      Alert.alert(
        "Invalid Rate per kWh",
        "Please enter a valid electricity rate per kilowatt-hour (e.g. 12.50).",
      );
      return;
    }

    const rateCentavosPerKwh = Math.round(ratePesos * 100);
    const consumedKwh = Math.max(0, Math.round((curr - prev) * 100) / 100);
    const totalAmountCentavos = Math.round(consumedKwh * rateCentavosPerKwh);

    setSaving(true);
    try {
      await mobileDataService.saveElectricityConfig(
        householdId,
        {
          previousReadingKwh: prev,
          currentReadingKwh: curr,
          rateCentavosPerKwh,
          consumedKwh,
          totalAmountCentavos,
          billingCycleId,
        },
        { billingCycleId },
      );

      setSaving(false);
      Alert.alert(
        "Electricity Settings Saved",
        consumedKwh > 0
          ? `Meter Bill Calculated: (${curr} - ${prev} = ${consumedKwh} kWh) × ₱${ratePesos.toFixed(2)}/kWh = ₱${(totalAmountCentavos / 100).toFixed(2)}. Synced to the current billing cycle.`
          : `Electricity rate (₱${ratePesos.toFixed(2)}/kWh) and base reading (${prev} kWh) saved.`,
      );
      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      setSaving(false);
      Alert.alert(
        "Error",
        err.message || "Failed to save electricity settings.",
      );
    }
  };

  return (
    <SmoothBottomSheetModal
      visible={visible}
      onClose={onClose}
      variant="bottom-sheet"
      showChipBar={true}
      title="Electricity Meter Settings"
      subtitle="Configure Previous Reading, Current Reading & Rate per kWh"
      icon={<Feather name="zap" size={18} color="#D97706" />}
      maxHeight="90%"
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollBody,
          { paddingBottom: Math.max(10, insets.bottom + 20) },
        ]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={true}
      >
        <View style={styles.readingsRow}>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.inputFieldLabel,
                isDark && { color: colors.textSecondary },
              ]}
            >
              Previous Reading (kWh)
            </Text>
            <View
              style={[
                styles.unitInputRow,
                isDark && {
                  backgroundColor: colors.surfaceInset,
                  borderColor: colors.border,
                },
              ]}
            >
              <TextInput
                style={[styles.unitTextInput, isDark && { color: colors.text }]}
                value={previousReadingInput}
                onChangeText={setPreviousReadingInput}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
              />
              <Text
                style={[
                  styles.unitSuffix,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                kWh
              </Text>
            </View>
          </View>

          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.inputFieldLabel,
                isDark && { color: colors.textSecondary },
              ]}
            >
              Current Reading (kWh)
            </Text>
            <View
              style={[
                styles.unitInputRow,
                isDark && {
                  backgroundColor: colors.surfaceInset,
                  borderColor: colors.border,
                },
                calculation.isInvalidReading && {
                  borderColor: "#EF4444",
                },
              ]}
            >
              <TextInput
                style={[styles.unitTextInput, isDark && { color: colors.text }]}
                value={currentReadingInput}
                onChangeText={setCurrentReadingInput}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
              />
              <Text
                style={[
                  styles.unitSuffix,
                  isDark && { color: colors.textSecondary },
                ]}
              >
                kWh
              </Text>
            </View>
          </View>
        </View>

        {calculation.isInvalidReading && (
          <Text style={styles.errorHintText}>
            Current Reading must be greater than or equal to Previous Reading.
          </Text>
        )}

        <View style={styles.inputSection}>
          <Text
            style={[
              styles.inputFieldLabel,
              isDark && { color: colors.textSecondary },
            ]}
          >
            Amount per Kilowatt-Hour (₱ / kWh)
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
                { color: isDark ? "#FBBF24" : "#D97706" },
              ]}
            >
              ₱
            </Text>
            <TextInput
              style={[
                styles.currencyTextInput,
                isDark && { color: colors.text },
              ]}
              value={ratePerKwhInput}
              onChangeText={setRatePerKwhInput}
              keyboardType="decimal-pad"
              placeholder="12.00"
              placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
            />
            <Text
              style={[
                styles.unitSuffix,
                isDark && { color: colors.textSecondary },
              ]}
            >
              / kWh
            </Text>
          </View>
        </View>

        {/* Live Calculation Summary Card */}
        <View
          style={[
            styles.calcCard,
            isDark && {
              backgroundColor: "rgba(245, 158, 11, 0.12)",
              borderColor: "rgba(245, 158, 11, 0.3)",
            },
          ]}
        >
          <View style={styles.calcHeaderRow}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Ionicons
                name="flash"
                size={16}
                color={isDark ? "#FBBF24" : "#D97706"}
              />
              <Text
                style={[
                  styles.calcTitle,
                  { color: isDark ? "#FBBF24" : "#92400E" },
                ]}
              >
                Calculated Electricity Bill
              </Text>
            </View>
            <Text
              style={[
                styles.calcTotalValue,
                { color: isDark ? "#FBBF24" : "#B45309" },
              ]}
            >
              ₱
              {calculation.totalPesos.toLocaleString("en-PH", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Text>
          </View>

          <View
            style={[
              styles.calcFormulaBox,
              isDark && {
                backgroundColor: "rgba(15, 23, 42, 0.45)",
                borderColor: "rgba(245, 158, 11, 0.2)",
              },
            ]}
          >
            <Text
              style={[
                styles.calcFormulaLabel,
                isDark && { color: colors.textSecondary },
              ]}
            >
              Formula: (Current Reading − Previous Reading) × Rate/kWh
            </Text>
            <Text
              style={[styles.calcFormulaMath, isDark && { color: colors.text }]}
            >
              ({calculation.curr} − {calculation.prev} ={" "}
              {calculation.consumedKwh} kWh) × ₱
              {calculation.ratePesos.toFixed(2)}/kWh = ₱
              {calculation.totalPesos.toFixed(2)}
            </Text>
          </View>

          <Text
            style={[
              styles.calcSubNote,
              isDark && { color: colors.textSecondary },
            ]}
          >
            Saving will automatically update the Electricity bill for this
            billing cycle and split it fairly across active paying roommates.
          </Text>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[
              styles.cancelBtn,
              isDark && {
                backgroundColor: colors.surfaceInset,
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
              saving && { opacity: 0.7 },
              isDark && { backgroundColor: colors.primary },
            ]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
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
                <Text style={styles.saveBtnText}>Save & Sync Bill</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SmoothBottomSheetModal>
  );
};

const styles = StyleSheet.create({
  scrollBody: {
    paddingTop: 6,
    paddingBottom: 18,
  },
  readingsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 8,
  },
  inputSection: {
    marginTop: 10,
    marginBottom: 14,
  },
  inputFieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 6,
  },
  unitInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  unitTextInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  unitSuffix: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    marginLeft: 6,
  },
  currencyInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
  },
  currencyPrefix: {
    fontSize: 18,
    fontWeight: "700",
    color: "#D97706",
    marginRight: 8,
  },
  currencyTextInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },
  errorHintText: {
    fontSize: 12,
    color: "#EF4444",
    fontWeight: "600",
    marginTop: 2,
    marginBottom: 4,
  },
  calcCard: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 16,
    padding: 14,
    marginTop: 4,
    marginBottom: 18,
  },
  calcHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  calcTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#92400E",
  },
  calcTotalValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#B45309",
  },
  calcFormulaBox: {
    backgroundColor: "#FEF3C7",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#FCD34D",
    marginBottom: 8,
  },
  calcFormulaLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#78350F",
    marginBottom: 2,
  },
  calcFormulaMath: {
    fontSize: 13,
    fontWeight: "700",
    color: "#92400E",
  },
  calcSubNote: {
    fontSize: 11,
    color: "#78350F",
    lineHeight: 16,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569",
  },
  saveBtn: {
    flex: 2,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#2563EB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
