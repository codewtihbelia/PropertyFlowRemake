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
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "../context/ThemeContext";
import { communityService } from "../services/communityService";
import { uploadImageToCloudinaryMobile } from "../services/cloudinaryService";

interface CreateStoryModalProps {
  visible: boolean;
  onClose: () => void;
  onStoryCreated?: () => void;
  currentUser: {
    uid?: string;
    name?: string;
    displayName?: string;
    email?: string;
    photoURL?: string;
    profilePicture?: string;
  };
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

export const CreateStoryModal: React.FC<CreateStoryModalProps> = ({
  visible,
  onClose,
  onStoryCreated,
  currentUser,
}) => {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const [selectedImage, setSelectedImage] = useState<{
    uri: string;
    base64?: string | null;
    mimeType?: string;
  } | null>(null);
  const [caption, setCaption] = useState("");
  const [selectedBgColor, setSelectedBgColor] = useState(BG_GRADIENTS[0]);
  const [isUploading, setIsUploading] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      },
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        setKeyboardHeight(0);
      },
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const authorName =
    currentUser.displayName || currentUser.name || "Splitzy Member";
  const authorAvatar = currentUser.photoURL || currentUser.profilePicture || "";

  const pickImage = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Permission Required",
          "Photo library access is needed to create a story with photos.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedImage({
          uri: asset.uri,
          base64: asset.base64,
          mimeType: asset.mimeType || "image/jpeg",
        });
      }
    } catch (err) {
      console.warn("Error picking story image:", err);
      Alert.alert("Error", "Could not load image. Please try again.");
    }
  };

  const handleShareStory = async () => {
    if (!selectedImage && !caption.trim()) {
      Alert.alert(
        "Story Empty",
        "Please select a photo or write text for your story.",
      );
      return;
    }

    try {
      setIsUploading(true);
      let mediaUrl = "";

      if (selectedImage) {
        mediaUrl = await uploadImageToCloudinaryMobile({
          uri: selectedImage.uri,
          base64: selectedImage.base64,
          mimeType: selectedImage.mimeType,
        });
      }

      await communityService.createStory({
        mediaUrl: mediaUrl || "",
        caption: caption.trim(),
        backgroundColor: selectedBgColor,
        authorName,
        authorEmail: currentUser.email || "",
        authorAvatar,
      });

      setSelectedImage(null);
      setCaption("");
      onClose();
      if (onStoryCreated) {
        onStoryCreated();
      }
    } catch (err: any) {
      console.warn("Failed to create story:", err);
      Alert.alert("Error", err?.message || "Failed to share story.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={[
            styles.modalContainer,
            {
              backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
              marginBottom:
                Platform.OS === "android" && keyboardHeight > 0
                  ? Math.max(keyboardHeight, 320) + Math.max(insets.bottom, 28)
                  : 0,
            },
          ]}
        >
          {/* Header */}
          <View
            style={[
              styles.modalHeader,
              { borderBottomColor: isDark ? "#1E293B" : "#E2E8F0" },
            ]}
          >
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather
                name="x"
                size={22}
                color={isDark ? "#F8FAFC" : "#0F172A"}
              />
            </TouchableOpacity>

            <Text
              style={[
                styles.modalTitle,
                { color: isDark ? "#F8FAFC" : "#0F172A" },
              ]}
            >
              Create Story
            </Text>

            <TouchableOpacity
              onPress={handleShareStory}
              disabled={isUploading || (!selectedImage && !caption.trim())}
              style={[
                styles.shareBtn,
                !selectedImage && !caption.trim() && styles.shareBtnDisabled,
              ]}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.shareBtnText}>Share</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: Math.max(insets.bottom + 24, 32) },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            {/* Story Preview Canvas */}
            <View
              style={[
                styles.storyCanvas,
                {
                  backgroundColor: selectedImage ? "#000000" : selectedBgColor,
                },
              ]}
            >
              {selectedImage ? (
                <Image
                  source={{ uri: selectedImage.uri }}
                  style={styles.canvasImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.textOnlyPreview}>
                  <Ionicons name="sparkles" size={28} color="#FFFFFF" />
                  <Text style={styles.previewCaptionText}>
                    {caption || "Type your story thoughts below..."}
                  </Text>
                </View>
              )}

              {/* Author badge preview */}
              <View style={styles.canvasAuthorBadge}>
                {authorAvatar ? (
                  <Image
                    source={{ uri: authorAvatar }}
                    style={styles.authorBadgeAvatar}
                  />
                ) : (
                  <View style={styles.authorBadgePlaceholder}>
                    <Text style={styles.authorBadgeInitial}>
                      {authorName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text style={styles.authorBadgeName}>{authorName}</Text>
              </View>

              {selectedImage && (
                <TouchableOpacity
                  onPress={() => setSelectedImage(null)}
                  style={styles.removeImageBtn}
                >
                  <Feather name="trash-2" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>

            {/* Controls */}
            <View style={styles.controlsWrap}>
              <TouchableOpacity
                onPress={pickImage}
                style={[
                  styles.photoSelectBtn,
                  {
                    backgroundColor: isDark ? "#1E293B" : "#F1F5F9",
                    borderColor: isDark ? "#334155" : "#E2E8F0",
                  },
                ]}
              >
                <Ionicons name="images" size={20} color="#2563EB" />
                <Text
                  style={[
                    styles.photoSelectBtnText,
                    { color: isDark ? "#F8FAFC" : "#0F172A" },
                  ]}
                >
                  {selectedImage ? "Change Photo" : "Add Photo from Library"}
                </Text>
              </TouchableOpacity>

              {/* Caption Input */}
              <Text
                style={[
                  styles.inputLabel,
                  { color: isDark ? "#94A3B8" : "#64748B" },
                ]}
              >
                Story Caption / Thoughts
              </Text>
              <TextInput
                style={[
                  styles.captionInput,
                  {
                    backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                    borderColor: isDark ? "#334155" : "#E2E8F0",
                    color: isDark ? "#F8FAFC" : "#0F172A",
                  },
                ]}
                placeholder="What's happening? Share a moment with Splitzy..."
                placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                value={caption}
                onChangeText={setCaption}
                multiline
                maxLength={200}
              />

              {!selectedImage && (
                <View style={styles.colorsRow}>
                  <Text
                    style={[
                      styles.inputLabel,
                      {
                        color: isDark ? "#94A3B8" : "#64748B",
                        marginBottom: 8,
                      },
                    ]}
                  >
                    Background Color
                  </Text>
                  <View style={styles.colorPills}>
                    {BG_GRADIENTS.map((color) => (
                      <TouchableOpacity
                        key={color}
                        onPress={() => setSelectedBgColor(color)}
                        style={[
                          styles.colorPill,
                          { backgroundColor: color },
                          selectedBgColor === color && styles.colorPillActive,
                        ]}
                      />
                    ))}
                  </View>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "92%",
    minHeight: "75%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  closeBtn: {
    padding: 6,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  shareBtn: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
  },
  shareBtnDisabled: {
    backgroundColor: "#93C5FD",
  },
  shareBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  scrollContent: {
    padding: 16,
  },
  storyCanvas: {
    height: 280,
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  canvasImage: {
    width: "100%",
    height: "100%",
  },
  textOnlyPreview: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  previewCaptionText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 12,
    lineHeight: 26,
  },
  canvasAuthorBadge: {
    position: "absolute",
    top: 14,
    left: 14,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  authorBadgeAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 6,
  },
  authorBadgePlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 6,
  },
  authorBadgeInitial: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  authorBadgeName: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  removeImageBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 8,
    borderRadius: 20,
  },
  controlsWrap: {
    paddingBottom: 24,
  },
  photoSelectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 8,
  },
  photoSelectBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  captionInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: "top",
    marginBottom: 16,
  },
  colorsRow: {
    marginTop: 4,
  },
  colorPills: {
    flexDirection: "row",
    gap: 10,
  },
  colorPill: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  colorPillActive: {
    borderWidth: 3,
    borderColor: "#FFFFFF",
    elevation: 3,
  },
});
