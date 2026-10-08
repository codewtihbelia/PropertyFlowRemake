import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "../context/ThemeContext";
import { auth } from "../firebase/config";
import {
  communityService,
  CATEGORY_LABELS,
  CommunityCategory,
  CommunityPost,
  formatAuthorDisplayName,
} from "../services/communityService";
import { uploadImageToCloudinaryMobile } from "../services/cloudinaryService";

interface CreatePostModalProps {
  visible: boolean;
  onClose: () => void;
  onPostCreated?: () => void;
  currentUser: {
    uid?: string;
    name?: string;
    displayName?: string;
    email?: string;
    photoURL?: string;
    profilePicture?: string;
    role?: string;
    householdName?: string;
  };
}

interface PostImageItem {
  uri: string;
  base64?: string | null;
  mimeType?: string;
}

const CATEGORY_OPTIONS: Array<CommunityPost["category"]> = [
  "general",
  "roommate_tips",
  "items_sale",
  "looking_for_roomie",
  "events",
  "bills_advice",
];

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  visible,
  onClose,
  onPostCreated,
  currentUser,
}) => {
  const { colors, isDark } = useTheme();
  const [content, setContent] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState<CommunityPost["category"]>("general");
  const [images, setImages] = useState<PostImageItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState("");

  const authorName = formatAuthorDisplayName(
    currentUser.displayName || currentUser.name,
    currentUser.email || auth.currentUser?.email,
  );
  const authorAvatar = currentUser.photoURL || currentUser.profilePicture || "";

  const pickImage = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Permission Required",
          "Photo library access is needed to attach pictures to your post.",
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
        setImages((prev) => [
          ...prev,
          {
            uri: asset.uri,
            base64: asset.base64,
            mimeType: asset.mimeType || "image/jpeg",
          },
        ]);
      }
    } catch (err) {
      console.warn("Error picking image:", err);
      Alert.alert("Error", "Could not select image. Please try again.");
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePublish = async () => {
    const trimmed = content.trim();
    if (!trimmed && images.length === 0) {
      Alert.alert("Empty Post", "Please write a message or add a photo.");
      return;
    }

    try {
      setIsSubmitting(true);
      const uploadedImageUrls: string[] = [];

      for (let i = 0; i < images.length; i++) {
        setUploadProgressText(
          `Uploading image ${i + 1} of ${images.length}...`,
        );
        const item = images[i];
        if (item.uri.startsWith("http")) {
          uploadedImageUrls.push(item.uri);
        } else {
          const cloudUrl = await uploadImageToCloudinaryMobile({
            uri: item.uri,
            base64: item.base64,
            mimeType: item.mimeType,
          });
          uploadedImageUrls.push(cloudUrl);
        }
      }

      setUploadProgressText("Saving to community feed...");

      await communityService.createPost({
        content: trimmed,
        category: selectedCategory,
        images: uploadedImageUrls,
        authorName,
        authorEmail: currentUser.email || "",
        authorAvatar,
        authorRole: currentUser.role || "Member",
        authorHouseholdName: currentUser.householdName || "",
      });

      setContent("");
      setImages([]);
      setSelectedCategory("general");
      onClose();
      if (onPostCreated) {
        onPostCreated();
      }
    } catch (err: any) {
      console.error("Error creating post:", err);
      Alert.alert(
        "Failed to Publish",
        err?.message || "Please check your network and try again.",
      );
    } finally {
      setIsSubmitting(false);
      setUploadProgressText("");
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.overlay}
      >
        <View
          style={[
            styles.container,
            { backgroundColor: isDark ? "#1E293B" : "#FFFFFF" },
          ]}
        >
          {/* Header */}
          <View
            style={[
              styles.header,
              { borderBottomColor: isDark ? "#334155" : "#E2E8F0" },
            ]}
          >
            <TouchableOpacity
              onPress={onClose}
              disabled={isSubmitting}
              style={styles.closeBtn}
            >
              <Feather
                name="x"
                size={24}
                color={isDark ? "#94A3B8" : "#64748B"}
              />
            </TouchableOpacity>
            <Text
              style={[
                styles.headerTitle,
                { color: isDark ? "#F8FAFC" : "#0F172A" },
              ]}
            >
              Create Post
            </Text>
            <TouchableOpacity
              onPress={handlePublish}
              disabled={
                isSubmitting || (!content.trim() && images.length === 0)
              }
              style={[
                styles.publishBtn,
                {
                  opacity:
                    isSubmitting || (!content.trim() && images.length === 0)
                      ? 0.5
                      : 1,
                },
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.publishBtnText}>Publish</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollBody}
            keyboardShouldPersistTaps="handled"
          >
            {/* Author info */}
            <View style={styles.authorRow}>
              {authorAvatar ? (
                <Image source={{ uri: authorAvatar }} style={styles.avatar} />
              ) : (
                <View
                  style={[
                    styles.avatarPlaceholder,
                    { backgroundColor: isDark ? "#334155" : "#E2E8F0" },
                  ]}
                >
                  <Text
                    style={[
                      styles.avatarInitials,
                      { color: isDark ? "#94A3B8" : "#475569" },
                    ]}
                  >
                    {authorName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.authorMeta}>
                <Text
                  style={[
                    styles.authorName,
                    { color: isDark ? "#F8FAFC" : "#0F172A" },
                  ]}
                >
                  {authorName}
                </Text>
                <View style={styles.badgeRow}>
                  <View
                    style={[
                      styles.categoryBadge,
                      {
                        backgroundColor:
                          CATEGORY_LABELS[selectedCategory]?.color + "20",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryBadgeText,
                        { color: CATEGORY_LABELS[selectedCategory]?.color },
                      ]}
                    >
                      {CATEGORY_LABELS[selectedCategory]?.label}
                    </Text>
                  </View>
                  {currentUser.householdName ? (
                    <Text
                      style={[
                        styles.householdText,
                        { color: isDark ? "#94A3B8" : "#64748B" },
                      ]}
                    >
                      • {currentUser.householdName}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>

            {/* Category selection selector */}
            <Text
              style={[
                styles.sectionLabel,
                { color: isDark ? "#94A3B8" : "#64748B" },
              ]}
            >
              Topic Category
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryScroll}
            >
              {CATEGORY_OPTIONS.map((catKey) => {
                const conf = CATEGORY_LABELS[catKey];
                const isSelected = selectedCategory === catKey;
                return (
                  <TouchableOpacity
                    key={catKey}
                    onPress={() => setSelectedCategory(catKey)}
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor: isSelected
                          ? conf.color
                          : isDark
                            ? "#334155"
                            : "#F1F5F9",
                        borderColor: isSelected
                          ? conf.color
                          : isDark
                            ? "#475569"
                            : "#CBD5E1",
                      },
                    ]}
                  >
                    <Feather
                      name={conf.icon as any}
                      size={14}
                      color={isSelected ? "#FFFFFF" : conf.color}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.categoryChipText,
                        {
                          color: isSelected
                            ? "#FFFFFF"
                            : isDark
                              ? "#E2E8F0"
                              : "#334155",
                          fontWeight: isSelected ? "700" : "500",
                        },
                      ]}
                    >
                      {conf.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Main content input */}
            <TextInput
              style={[
                styles.input,
                {
                  color: isDark ? "#F8FAFC" : "#0F172A",
                  backgroundColor: isDark ? "#0F172A40" : "#F8FAFC",
                  borderColor: isDark ? "#334155" : "#E2E8F0",
                },
              ]}
              placeholder="What's on your mind? Share roomie hacks, items to giveaway or sell, asks, or upcoming house events..."
              placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
              multiline
              textAlignVertical="top"
              value={content}
              onChangeText={setContent}
              editable={!isSubmitting}
            />

            {/* Attached images preview */}
            {images.length > 0 && (
              <View style={styles.imageGallery}>
                {images.map((item, idx) => (
                  <View key={idx} style={styles.imageWrapper}>
                    <Image
                      source={{ uri: item.uri }}
                      style={styles.previewImage}
                    />
                    <TouchableOpacity
                      onPress={() => removeImage(idx)}
                      disabled={isSubmitting}
                      style={styles.removeImageBtn}
                    >
                      <Feather name="x" size={14} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {isSubmitting && uploadProgressText ? (
              <View style={styles.progressContainer}>
                <ActivityIndicator size="small" color="#2563EB" />
                <Text
                  style={[
                    styles.progressText,
                    { color: isDark ? "#94A3B8" : "#64748B" },
                  ]}
                >
                  {uploadProgressText}
                </Text>
              </View>
            ) : null}
          </ScrollView>

          {/* Bottom toolbar */}
          <View
            style={[
              styles.bottomBar,
              {
                borderTopColor: isDark ? "#334155" : "#E2E8F0",
                backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
              },
            ]}
          >
            <TouchableOpacity
              onPress={pickImage}
              disabled={isSubmitting}
              style={[
                styles.attachBtn,
                { backgroundColor: isDark ? "#334155" : "#F1F5F9" },
              ]}
            >
              <Ionicons name="image-outline" size={20} color="#2563EB" />
              <Text style={styles.attachBtnText}>Attach Photo</Text>
            </TouchableOpacity>
            <Text
              style={[
                styles.charCount,
                { color: isDark ? "#64748B" : "#94A3B8" },
              ]}
            >
              {content.length} chars
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: "88%",
    overflow: "hidden",
  },
  header: {
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
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  publishBtn: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 78,
    alignItems: "center",
  },
  publishBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  scrollBody: {
    flex: 1,
    padding: 16,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#CBD5E1",
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: 18,
    fontWeight: "700",
  },
  authorMeta: {
    marginLeft: 12,
    flex: 1,
  },
  authorName: {
    fontSize: 16,
    fontWeight: "700",
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: 6,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  householdText: {
    fontSize: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  categoryScroll: {
    paddingBottom: 14,
    gap: 8,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: 13,
  },
  input: {
    minHeight: 140,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  imageGallery: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  imageWrapper: {
    position: "relative",
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: "hidden",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  removeImageBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginVertical: 12,
  },
  progressText: {
    fontSize: 13,
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  attachBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  attachBtnText: {
    color: "#2563EB",
    fontSize: 14,
    fontWeight: "600",
  },
  charCount: {
    fontSize: 12,
  },
});
