import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import {
  communityService,
  CommunityStory,
  calculateStoryTimeRemaining,
} from "../services/communityService";

interface EditStoryModalProps {
  visible: boolean;
  story: CommunityStory | null;
  onClose: () => void;
  onStoryUpdated?: (updatedStory: CommunityStory) => void;
}

const BG_GRADIENTS = [
  "#2563EB",
  "#4F46E5",
  "#7C3AED",
  "#DB2777",
  "#EA580C",
  "#059669",
  "#0F172A",
];

export const EditStoryModal: React.FC<EditStoryModalProps> = ({
  visible,
  story,
  onClose,
  onStoryUpdated,
}) => {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();

  const [caption, setCaption] = useState("");
  const [selectedBgColor, setSelectedBgColor] = useState(BG_GRADIENTS[0]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (story) {
      setCaption(story.caption || "");
      setSelectedBgColor(story.backgroundColor || BG_GRADIENTS[0]);
    }
  }, [story, visible]);

  if (!visible || !story) return null;

  const remaining = calculateStoryTimeRemaining(story);

  const handleSave = async () => {
    if (!story) return;

    try {
      setIsSaving(true);
      await communityService.updateStory(story.id, {
        caption: caption.trim(),
        backgroundColor: selectedBgColor,
      });

      const updated: CommunityStory = {
        ...story,
        caption: caption.trim(),
        backgroundColor: selectedBgColor,
        updatedAt: new Date().toISOString(),
      };

      if (onStoryUpdated) {
        onStoryUpdated(updated);
      }
      onClose();
    } catch (err: any) {
      console.warn("Failed to update story:", err);
      Alert.alert(
        "Update Failed",
        err?.message || "Could not save story changes.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
            paddingTop: insets.top > 0 ? insets.top : 16,
            paddingBottom: insets.bottom > 0 ? insets.bottom : 16,
          },
        ]}
      >
        {/* Top Header */}
        <View
          style={[
            styles.header,
            { borderBottomColor: isDark ? "#1E293B" : "#F1F5F9" },
          ]}
        >
          <TouchableOpacity
            onPress={onClose}
            disabled={isSaving}
            style={styles.closeBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather
              name="x"
              size={22}
              color={isDark ? "#94A3B8" : "#64748B"}
            />
          </TouchableOpacity>

          <View style={styles.titleContainer}>
            <Text
              style={[styles.title, { color: isDark ? "#F8FAFC" : "#0F172A" }]}
            >
              Edit Story
            </Text>
            <Text
              style={[
                styles.subtitle,
                { color: isDark ? "#94A3B8" : "#64748B" },
              ]}
            >
              {remaining.isExpired
                ? "Story Expired"
                : `Active · ${remaining.label}`}
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleSave}
            disabled={isSaving}
            style={[styles.saveBtn, isSaving && { opacity: 0.6 }]}
            activeOpacity={0.8}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveBtnText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Live Preview Card */}
            <View style={styles.previewSection}>
              <Text
                style={[
                  styles.sectionLabel,
                  { color: isDark ? "#CBD5E1" : "#475569" },
                ]}
              >
                Preview
              </Text>

              <View style={styles.previewCardWrap}>
                {story.mediaUrl ? (
                  <View style={styles.previewImageCard}>
                    <Image
                      source={{ uri: story.mediaUrl }}
                      style={styles.previewImage}
                      resizeMode="cover"
                    />
                    <View style={styles.previewOverlay} />
                    {caption.trim() ? (
                      <View style={styles.previewCaptionOverlay}>
                        <Text
                          style={styles.previewCaptionText}
                          numberOfLines={3}
                        >
                          {caption}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <View
                    style={[
                      styles.previewTextCard,
                      { backgroundColor: selectedBgColor },
                    ]}
                  >
                    <Ionicons
                      name="sparkles"
                      size={28}
                      color="#93C5FD"
                      style={{ marginBottom: 12 }}
                    />
                    <Text
                      style={styles.previewTextStoryCaption}
                      numberOfLines={4}
                    >
                      {caption || "Your story message"}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Background Style Selector (Always useful, especially for text stories) */}
            <View style={styles.sectionWrap}>
              <Text
                style={[
                  styles.sectionLabel,
                  { color: isDark ? "#CBD5E1" : "#475569" },
                ]}
              >
                Background Styling
              </Text>
              <View style={styles.colorRow}>
                {BG_GRADIENTS.map((color) => {
                  const isSelected = selectedBgColor === color;
                  return (
                    <TouchableOpacity
                      key={color}
                      onPress={() => setSelectedBgColor(color)}
                      style={[
                        styles.colorCircle,
                        { backgroundColor: color },
                        isSelected && styles.colorCircleSelected,
                      ]}
                      activeOpacity={0.8}
                    >
                      {isSelected ? (
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Caption Text Input */}
            <View style={styles.sectionWrap}>
              <View style={styles.labelRow}>
                <Text
                  style={[
                    styles.sectionLabel,
                    { color: isDark ? "#CBD5E1" : "#475569" },
                  ]}
                >
                  Story Caption
                </Text>
                <Text
                  style={[
                    styles.charCount,
                    { color: isDark ? "#64748B" : "#94A3B8" },
                  ]}
                >
                  {caption.length}/300
                </Text>
              </View>

              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                    borderColor: isDark ? "#334155" : "#E2E8F0",
                    color: isDark ? "#F8FAFC" : "#0F172A",
                  },
                ]}
                placeholder="Add or update your story caption..."
                placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                value={caption}
                onChangeText={(val) => {
                  if (val.length <= 300) setCaption(val);
                }}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Expiration Note */}
            <View
              style={[
                styles.infoNote,
                {
                  backgroundColor: isDark ? "#1E293B" : "#F1F5F9",
                  borderColor: isDark ? "#334155" : "#E2E8F0",
                },
              ]}
            >
              <Ionicons name="time-outline" size={18} color="#2563EB" />
              <Text
                style={[
                  styles.infoNoteText,
                  { color: isDark ? "#94A3B8" : "#64748B" },
                ]}
              >
                Stories remain visible in the feed for 24 hours. Updating your
                caption will not restart the 24-hour expiration window.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  titleContainer: {
    alignItems: "center",
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  saveBtn: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    minWidth: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  previewSection: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  charCount: {
    fontSize: 12,
  },
  previewCardWrap: {
    alignItems: "center",
  },
  previewImageCard: {
    width: 170,
    height: 240,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#000000",
    position: "relative",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  previewOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  previewCaptionOverlay: {
    position: "absolute",
    bottom: 12,
    left: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  previewCaptionText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
  },
  previewTextCard: {
    width: 170,
    height: 240,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  previewTextStoryCaption: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  sectionWrap: {
    marginBottom: 20,
  },
  colorRow: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 4,
  },
  colorCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  colorCircleSelected: {
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    minHeight: 90,
  },
  infoNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  infoNoteText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
});
