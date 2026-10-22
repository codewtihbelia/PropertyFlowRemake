import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "../context/ThemeContext";
import {
  communityService,
  ReelCategory,
  formatAuthorDisplayName,
  getReelVideoType,
  extractYouTubeId,
  normalizeFacebookUrl,
} from "../services/communityService";
import { uploadVideoToCloudinaryMobile } from "../services/cloudinaryService";
import { uploadVideoToFirebaseStorageMobile } from "../services/firebaseStorageService";
import { auth } from "../firebase/config";

interface CreateReelModalProps {
  visible: boolean;
  onClose: () => void;
  currentUser: {
    uid?: string;
    name?: string;
    displayName?: string;
    photoURL?: string;
    profilePicture?: string;
    role?: string;
  };
  onReelCreated?: () => void;
}

const REEL_CATEGORIES: { id: ReelCategory; label: string; icon: string }[] = [
  { id: "roommate_tips", label: "Roommate Tips", icon: "bulb-outline" },
  { id: "cooking", label: "Cooking & Meals", icon: "restaurant-outline" },
  { id: "budgeting", label: "Budget Hacks", icon: "wallet-outline" },
  { id: "lifestyle", label: "Apartment Living", icon: "home-outline" },
  { id: "fun", label: "Fun & Games", icon: "sparkles-outline" },
];

const SUGGESTED_HASHTAGS = [
  "#RoommateHacks",
  "#SplitzyLife",
  "#ApartmentVibes",
  "#CoLivingTips",
  "#MealPrep",
  "#BudgetSmart",
];

const SAMPLE_SHORT_PRESETS = [
  {
    title: "YouTube Shorts: Studio Tour",
    url: "https://www.youtube.com/shorts/1e9F3Zf6T6E",
    category: "lifestyle" as ReelCategory,
    caption:
      "Tour of our 300 sq ft city studio! 🏙️ Designated zones and vertical organizers keep 2 roommates from clashing. #RoommateLife #StudioLiving #YouTubeShorts",
  },
  {
    title: "YouTube Shorts: Kitchen Hacks",
    url: "https://www.youtube.com/shorts/tA9B_Fq-f20",
    category: "cooking" as ReelCategory,
    caption:
      "Must-know shared kitchen hacks that save hours on cleanup! 🍳 Sponge color-coding and olive oil prep tips. #RoommateHacks #CookingHacks #YouTubeShorts",
  },
  {
    title: "YouTube Shorts: Cozy Apartment",
    url: "https://www.youtube.com/shorts/k-d_FydJ7uk",
    category: "lifestyle" as ReelCategory,
    caption:
      "Warm lighting and plants: transforming a cold rental into a cozy home for 3 roommates! 🪴✨ #ApartmentTour #CozyLiving #YouTubeShorts",
  },
  {
    title: "YouTube Shorts: Food Hacks",
    url: "https://www.youtube.com/shorts/Wv865tJg43Y",
    category: "cooking" as ReelCategory,
    caption:
      "Restaurant copycat meals on a student roommate budget! 🍔🍟 Cooked in 20 minutes for under ₱150 per person. #FoodHacks #BudgetMeals #YouTubeShorts",
  },
  {
    title: "Streaming Video: Apartment Puppy",
    url: "https://res.cloudinary.com/demo/video/upload/c_fill,ar_9:16,w_720/dog.mp4",
    category: "fun" as ReelCategory,
    caption:
      "When the apartment puppy greets all 4 flatmates after a long workday 🐶❤️ Roomie therapy at its best! #ApartmentPets #SplitzyVibes #CoLiving",
  },
];

export const CreateReelModal: React.FC<CreateReelModalProps> = ({
  visible,
  onClose,
  currentUser,
  onReelCreated,
}) => {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();

  const [inputMode, setInputMode] = useState<"link" | "upload">("link");
  const [videoLink, setVideoLink] = useState("");
  const [selectedVideoUri, setSelectedVideoUri] = useState<string | null>(null);
  const [videoThumbnail, setVideoThumbnail] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [caption, setCaption] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState<ReelCategory>("roommate_tips");
  const [soundTitle, setSoundTitle] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const resetForm = () => {
    setInputMode("link");
    setVideoLink("");
    setSelectedVideoUri(null);
    setVideoThumbnail(null);
    setVideoDuration(null);
    setCaption("");
    setSelectedCategory("roommate_tips");
    setSoundTitle("");
    setPublishing(false);
    setUploadProgress(0);
  };

  const handleClose = () => {
    if (publishing) {
      Alert.alert(
        "Upload in Progress",
        "Your reel is being saved. Discard changes?",
        [
          { text: "Keep Editing", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => {
              resetForm();
              onClose();
            },
          },
        ],
      );
      return;
    }
    resetForm();
    onClose();
  };

  const handlePickVideo = async () => {
    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(
          "Permission Required",
          "Please grant media gallery access to upload a reel.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
        allowsEditing: true,
        quality: 0.8,
        videoMaxDuration: 90,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedVideoUri(asset.uri);
        if (asset.duration) {
          setVideoDuration(Math.round(asset.duration / 1000));
        }
        const userName = formatAuthorDisplayName(
          currentUser.displayName || currentUser.name,
          auth.currentUser?.email,
        );
        setSoundTitle(`Original Audio • ${userName}`);
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to select video.");
    }
  };

  const handleRecordVideo = async () => {
    try {
      const permissionResult =
        await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(
          "Permission Required",
          "Please grant camera access to record a reel.",
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["videos"],
        allowsEditing: true,
        quality: 0.8,
        videoMaxDuration: 60,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedVideoUri(asset.uri);
        if (asset.duration) {
          setVideoDuration(Math.round(asset.duration / 1000));
        }
        const userName = formatAuthorDisplayName(
          currentUser.displayName || currentUser.name,
          auth.currentUser?.email,
        );
        setSoundTitle(`Original Audio • ${userName}`);
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to record video.");
    }
  };

  const handleAddHashtag = (tag: string) => {
    if (caption.includes(tag)) return;
    setCaption((prev) => (prev ? `${prev} ${tag}` : tag));
  };

  const handleSelectPreset = (preset: (typeof SAMPLE_SHORT_PRESETS)[0]) => {
    setVideoLink(preset.url);
    setSelectedCategory(preset.category);
    if (!caption) {
      setCaption(preset.caption);
    }
    const detectedType = getReelVideoType(preset.url);
    setSoundTitle(
      detectedType === "youtube" ? "YouTube Shorts Audio" : "Community Audio",
    );
    const ytId = extractYouTubeId(preset.url);
    if (ytId) {
      setVideoThumbnail(`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`);
    } else if (preset.url.toLowerCase().endsWith(".mp4")) {
      setVideoThumbnail(preset.url.replace(/\.mp4$/i, ".jpg"));
    }
  };

  const handlePublishReel = async () => {
    const userUid = auth.currentUser?.uid || currentUser.uid || "";
    if (!userUid) {
      Alert.alert("Sign In Required", "Please sign in to publish a reel.");
      return;
    }

    const userName = formatAuthorDisplayName(
      currentUser.displayName || currentUser.name,
      auth.currentUser?.email,
    );
    const userAvatar = currentUser.photoURL || currentUser.profilePicture || "";

    let finalVideoUrl = "";

    if (inputMode === "link") {
      let trimmed = videoLink.trim();
      if (!trimmed) {
        Alert.alert(
          "Link Required",
          "Please paste a YouTube Shorts, Facebook Reel, or video URL.",
        );
        return;
      }
      if (getReelVideoType(trimmed) === "facebook") {
        trimmed = normalizeFacebookUrl(trimmed);
      }
      finalVideoUrl = trimmed;
    } else {
      if (!selectedVideoUri) {
        Alert.alert("Video Required", "Please select or record a video first.");
        return;
      }
      finalVideoUrl = selectedVideoUri;
    }

    try {
      setPublishing(true);
      setUploadProgress(30);

      // Upload local video to cloud storage if it's an uploaded device file
      if (
        inputMode === "upload" &&
        !finalVideoUrl.startsWith("http://") &&
        !finalVideoUrl.startsWith("https://")
      ) {
        setUploadProgress(40);
        let cloudUploadSuccess = false;
        try {
          finalVideoUrl = await uploadVideoToCloudinaryMobile(finalVideoUrl);
          setUploadProgress(85);
          cloudUploadSuccess = true;
        } catch (uploadErr) {
          console.warn(
            "Cloudinary video upload failed, falling back to Firebase Storage:",
            uploadErr,
          );
        }

        if (!cloudUploadSuccess) {
          try {
            setUploadProgress(65);
            finalVideoUrl = await uploadVideoToFirebaseStorageMobile(
              selectedVideoUri || finalVideoUrl,
            );
            setUploadProgress(85);
            cloudUploadSuccess = true;
          } catch (storageErr) {
            console.error("Firebase Storage video upload failed:", storageErr);
          }
        }

        if (
          !cloudUploadSuccess ||
          (!finalVideoUrl.startsWith("http://") &&
            !finalVideoUrl.startsWith("https://"))
        ) {
          throw new Error(
            "Could not upload video to cloud storage. Please check your connection or use a YouTube Shorts or Facebook Reel link instead.",
          );
        }
      }

      setUploadProgress(90);

      const detectedType = getReelVideoType(finalVideoUrl);
      const defaultSound =
        detectedType === "youtube"
          ? "YouTube Shorts Audio"
          : detectedType === "facebook"
            ? "Facebook Reel Audio"
            : `Original Audio • ${userName}`;

      const ytId = extractYouTubeId(finalVideoUrl);
      const computedThumbnail =
        (videoThumbnail || "").trim() ||
        (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : "") ||
        (finalVideoUrl.toLowerCase().endsWith(".mp4")
          ? finalVideoUrl.replace(/\.mp4$/i, ".jpg")
          : "");

      await communityService.createReel({
        authorId: userUid,
        authorName: userName,
        authorEmail: auth.currentUser?.email || "",
        authorAvatar: userAvatar || "",
        authorRole: currentUser.role || "Splitzy Resident",
        videoUrl: finalVideoUrl,
        thumbnailUrl: computedThumbnail,
        caption:
          caption.trim() || "Everyday co-living moments with Splitzy! ✨",
        category: selectedCategory,
        soundTitle: soundTitle.trim() || defaultSound,
        ...(typeof videoDuration === "number"
          ? { duration: videoDuration }
          : {}),
      });

      setUploadProgress(100);
      Alert.alert("Reel Published!", "Your community reel is now live.");
      resetForm();
      onClose();
      if (onReelCreated) {
        onReelCreated();
      }
    } catch (err: any) {
      console.error("Failed to publish reel:", err);
      Alert.alert("Publish Failed", err.message || "Could not publish reel.");
    } finally {
      setPublishing(false);
    }
  };

  if (!visible) return null;

  const detectedVideoType = getReelVideoType(videoLink);
  const isValidLink = Boolean(
    videoLink.trim().startsWith("http://") ||
    videoLink.trim().startsWith("https://") ||
    extractYouTubeId(videoLink.trim()),
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View
        style={[
          styles.container,
          { backgroundColor: isDark ? "#0B1120" : "#FFFFFF" },
        ]}
      >
        {/* Top Header */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
              borderBottomColor: isDark ? "#1E293B" : "#E2E8F0",
              paddingTop: Math.max(insets.top, 16),
            },
          ]}
        >
          <TouchableOpacity onPress={handleClose} style={styles.headerBtn}>
            <Feather
              name="x"
              size={22}
              color={isDark ? "#F8FAFC" : "#0F172A"}
            />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text
              style={[
                styles.headerTitle,
                { color: isDark ? "#F8FAFC" : "#0F172A" },
              ]}
            >
              Create Community Reel
            </Text>
            {/* <Text
              style={[
                styles.headerSubtitle,
                { color: isDark ? "#94A3B8" : "#64748B" },
              ]}
            >
              Share YouTube Shorts, Facebook Reels or clips
            </Text> */}
          </View>
          <TouchableOpacity
            onPress={handlePublishReel}
            disabled={
              publishing ||
              (inputMode === "link" ? !isValidLink : !selectedVideoUri)
            }
            style={[
              styles.publishBtn,
              {
                backgroundColor:
                  (inputMode === "link" ? isValidLink : !!selectedVideoUri) &&
                  !publishing
                    ? "#2563EB"
                    : "#94A3B8",
              },
            ]}
          >
            {publishing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.publishBtnText}>Share</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Upload Progress Banner */}
        {publishing && (
          <View style={styles.progressBanner}>
            <View
              style={[styles.progressBar, { width: `${uploadProgress}%` }]}
            />
            <Text style={styles.progressText}>
              Publishing reel to Splitzy... {uploadProgress}%
            </Text>
          </View>
        )}

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 40 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Mode Switcher: YouTube/Facebook Link vs File Upload */}
          <View
            style={[
              styles.modeSwitcher,
              {
                backgroundColor: isDark ? "#1E293B" : "#E2E8F0",
              },
            ]}
          >
            <TouchableOpacity
              onPress={() => setInputMode("link")}
              style={[
                styles.modeBtn,
                inputMode === "link" && [
                  styles.modeBtnActive,
                  { backgroundColor: isDark ? "#0F172A" : "#FFFFFF" },
                ],
              ]}
            >
              <Ionicons
                name="logo-youtube"
                size={16}
                color={inputMode === "link" ? "#DC2626" : "#64748B"}
              />
              <Text
                style={[
                  styles.modeBtnText,
                  {
                    color:
                      inputMode === "link"
                        ? isDark
                          ? "#FFFFFF"
                          : "#0F172A"
                        : "#64748B",
                    fontWeight: inputMode === "link" ? "700" : "500",
                  },
                ]}
              >
                Yt/Fb URL
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setInputMode("upload")}
              style={[
                styles.modeBtn,
                inputMode === "upload" && [
                  styles.modeBtnActive,
                  { backgroundColor: isDark ? "#0F172A" : "#FFFFFF" },
                ],
              ]}
            >
              <Ionicons
                name="cloud-upload"
                size={16}
                color={inputMode === "upload" ? "#2563EB" : "#64748B"}
              />
              <Text
                style={[
                  styles.modeBtnText,
                  {
                    color:
                      inputMode === "upload"
                        ? isDark
                          ? "#FFFFFF"
                          : "#0F172A"
                        : "#64748B",
                    fontWeight: inputMode === "upload" ? "700" : "500",
                  },
                ]}
              >
                Upload Video File
              </Text>
            </TouchableOpacity>
          </View>

          {/* Mode 1: Link Input (YouTube Shorts or Facebook Reel) */}
          {inputMode === "link" ? (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
                  borderColor: isDark ? "#1E293B" : "#E2E8F0",
                },
              ]}
            >
              <View style={styles.cardHeaderRow}>
                <Ionicons name="link" size={18} color="#2563EB" />
                <Text
                  style={[
                    styles.cardTitle,
                    { color: isDark ? "#F8FAFC" : "#0F172A" },
                  ]}
                >
                  Paste Reel or Shorts Link
                </Text>
              </View>

              <TextInput
                style={[
                  styles.linkInput,
                  {
                    backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                    color: isDark ? "#F8FAFC" : "#0F172A",
                    borderColor: isValidLink
                      ? "#2563EB"
                      : isDark
                        ? "#334155"
                        : "#E2E8F0",
                  },
                ]}
                placeholder="e.g. https://www.youtube.com/shorts/..."
                placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                value={videoLink}
                onChangeText={setVideoLink}
                autoCapitalize="none"
                autoCorrect={false}
              />

              {/* Status Detection Badge */}
              {videoLink.trim() && (
                <View style={styles.detectedBadgeRow}>
                  {detectedVideoType === "youtube" ? (
                    <View
                      style={[
                        styles.detectedBadge,
                        { backgroundColor: "#FEE2E2" },
                      ]}
                    >
                      <Ionicons name="logo-youtube" size={14} color="#DC2626" />
                      <Text
                        style={[styles.detectedBadgeText, { color: "#DC2626" }]}
                      >
                        YouTube Shorts Detected
                      </Text>
                    </View>
                  ) : detectedVideoType === "facebook" ? (
                    <View
                      style={[
                        styles.detectedBadge,
                        { backgroundColor: "#DBEAFE" },
                      ]}
                    >
                      <Ionicons
                        name="logo-facebook"
                        size={14}
                        color="#1877F2"
                      />
                      <Text
                        style={[styles.detectedBadgeText, { color: "#1877F2" }]}
                      >
                        Facebook Reel Detected
                      </Text>
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.detectedBadge,
                        { backgroundColor: "#DCFCE7" },
                      ]}
                    >
                      <Ionicons
                        name="videocam-outline"
                        size={14}
                        color="#16A34A"
                      />
                      <Text
                        style={[styles.detectedBadgeText, { color: "#16A34A" }]}
                      >
                        Direct Video Stream
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Quick Try Presets */}
              <Text
                style={[
                  styles.quickPresetsTitle,
                  { color: isDark ? "#94A3B8" : "#64748B" },
                ]}
              >
                Or try one of these co-living shorts:
              </Text>
              <View style={styles.presetsList}>
                {SAMPLE_SHORT_PRESETS.map((preset, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => handleSelectPreset(preset)}
                    style={[
                      styles.presetItem,
                      {
                        backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                        borderColor:
                          videoLink === preset.url
                            ? "#2563EB"
                            : isDark
                              ? "#334155"
                              : "#E2E8F0",
                      },
                    ]}
                  >
                    <Ionicons name="play-circle" size={18} color="#2563EB" />
                    <Text
                      style={[
                        styles.presetItemText,
                        { color: isDark ? "#F8FAFC" : "#0F172A" },
                      ]}
                    >
                      {preset.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            /* Mode 2: Video File Selection */
            <View
              style={[
                styles.card,
                {
                  backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
                  borderColor: isDark ? "#1E293B" : "#E2E8F0",
                },
              ]}
            >
              {selectedVideoUri ? (
                <View style={styles.videoSelectedContainer}>
                  <Ionicons name="videocam" size={42} color="#2563EB" />
                  <Text
                    style={[
                      styles.videoSelectedText,
                      { color: isDark ? "#F8FAFC" : "#0F172A" },
                    ]}
                  >
                    Video Clip Attached
                  </Text>
                  {videoDuration && (
                    <Text
                      style={[
                        styles.videoDurationText,
                        { color: isDark ? "#94A3B8" : "#64748B" },
                      ]}
                    >
                      Duration: ~{videoDuration}s (9:16 Vertical)
                    </Text>
                  )}
                  <View style={styles.videoActionRow}>
                    <TouchableOpacity
                      onPress={handlePickVideo}
                      style={[
                        styles.changeVideoBtn,
                        { backgroundColor: isDark ? "#1E293B" : "#EFF6FF" },
                      ]}
                    >
                      <Feather name="refresh-cw" size={14} color="#2563EB" />
                      <Text style={styles.changeVideoBtnText}>Change</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setSelectedVideoUri(null)}
                      style={[
                        styles.changeVideoBtn,
                        { backgroundColor: isDark ? "#3B1414" : "#FEE2E2" },
                      ]}
                    >
                      <Feather name="trash-2" size={14} color="#DC2626" />
                      <Text
                        style={[
                          styles.changeVideoBtnText,
                          { color: "#DC2626" },
                        ]}
                      >
                        Remove
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.videoPickerPlaceholder}>
                  <View style={styles.pickerIconWrap}>
                    <Ionicons name="film-outline" size={36} color="#2563EB" />
                  </View>
                  <Text
                    style={[
                      styles.pickerTitle,
                      { color: isDark ? "#F8FAFC" : "#0F172A" },
                    ]}
                  >
                    Select a 9:16 Vertical Video
                  </Text>
                  <Text
                    style={[
                      styles.pickerSubtitle,
                      { color: isDark ? "#94A3B8" : "#64748B" },
                    ]}
                  >
                    Record or pick a short video up to 60 seconds
                  </Text>

                  <View style={styles.pickerButtonRow}>
                    <TouchableOpacity
                      onPress={handlePickVideo}
                      style={styles.pickerActionBtn}
                    >
                      <Ionicons name="images" size={18} color="#FFFFFF" />
                      <Text style={styles.pickerActionBtnText}>Gallery</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={handleRecordVideo}
                      style={[
                        styles.pickerActionBtn,
                        { backgroundColor: "#0284C7" },
                      ]}
                    >
                      <Ionicons name="camera" size={18} color="#FFFFFF" />
                      <Text style={styles.pickerActionBtnText}>Record</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Caption Input */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
                borderColor: isDark ? "#1E293B" : "#E2E8F0",
              },
            ]}
          >
            <View style={styles.cardHeaderRow}>
              <Ionicons name="create-outline" size={18} color="#2563EB" />
              <Text
                style={[
                  styles.cardTitle,
                  { color: isDark ? "#F8FAFC" : "#0F172A" },
                ]}
              >
                Reel Caption
              </Text>
            </View>
            <TextInput
              style={[
                styles.captionInput,
                {
                  backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                  color: isDark ? "#F8FAFC" : "#0F172A",
                  borderColor: isDark ? "#334155" : "#E2E8F0",
                },
              ]}
              placeholder="What's this reel about? Share tips, hacks, or funny roommate moments..."
              placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
              value={caption}
              onChangeText={setCaption}
              multiline
              maxLength={400}
            />
            <View style={styles.captionMetaRow}>
              <Text
                style={[
                  styles.charCount,
                  { color: isDark ? "#64748B" : "#94A3B8" },
                ]}
              >
                {caption.length}/400
              </Text>
            </View>

            {/* Quick Hashtags */}
            <Text
              style={[
                styles.quickTagsTitle,
                { color: isDark ? "#94A3B8" : "#64748B" },
              ]}
            >
              Suggested tags:
            </Text>
            <View style={styles.tagWrap}>
              {SUGGESTED_HASHTAGS.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  onPress={() => handleAddHashtag(tag)}
                  style={[
                    styles.tagChip,
                    {
                      backgroundColor: caption.includes(tag)
                        ? "#2563EB"
                        : isDark
                          ? "#1E293B"
                          : "#F1F5F9",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tagChipText,
                      {
                        color: caption.includes(tag)
                          ? "#FFFFFF"
                          : isDark
                            ? "#94A3B8"
                            : "#475569",
                      },
                    ]}
                  >
                    {tag}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Category Selection */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
                borderColor: isDark ? "#1E293B" : "#E2E8F0",
              },
            ]}
          >
            <View style={styles.cardHeaderRow}>
              <Ionicons name="pricetags-outline" size={18} color="#2563EB" />
              <Text
                style={[
                  styles.cardTitle,
                  { color: isDark ? "#F8FAFC" : "#0F172A" },
                ]}
              >
                Category
              </Text>
            </View>

            <View style={styles.categoryGrid}>
              {REEL_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => setSelectedCategory(cat.id)}
                    style={[
                      styles.categoryCard,
                      {
                        backgroundColor: isSelected
                          ? "#2563EB"
                          : isDark
                            ? "#1E293B"
                            : "#F8FAFC",
                        borderColor: isSelected
                          ? "#2563EB"
                          : isDark
                            ? "#334155"
                            : "#E2E8F0",
                      },
                    ]}
                  >
                    <Ionicons
                      name={cat.icon as any}
                      size={20}
                      color={
                        isSelected ? "#FFFFFF" : isDark ? "#94A3B8" : "#64748B"
                      }
                    />
                    <Text
                      style={[
                        styles.categoryCardText,
                        {
                          color: isSelected
                            ? "#FFFFFF"
                            : isDark
                              ? "#F8FAFC"
                              : "#0F172A",
                          fontWeight: isSelected ? "700" : "500",
                        },
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>
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
    paddingBottom: 14,
  },
  headerBtn: {
    padding: 6,
  },
  headerTitleWrap: {
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  headerSubtitle: {
    fontSize: 12,
  },
  publishBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    minWidth: 70,
    alignItems: "center",
    justifyContent: "center",
  },
  publishBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  progressBanner: {
    height: 28,
    backgroundColor: "#1E293B",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  progressBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#2563EB",
  },
  progressText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    zIndex: 1,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  modeSwitcher: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 12,
  },
  modeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modeBtnActive: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  modeBtnText: {
    fontSize: 12,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  linkInput: {
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  detectedBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  detectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  detectedBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  quickPresetsTitle: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  presetsList: {
    gap: 8,
  },
  presetItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  presetItemText: {
    fontSize: 13,
    fontWeight: "600",
  },
  videoSelectedContainer: {
    alignItems: "center",
    paddingVertical: 12,
  },
  videoSelectedText: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 4,
  },
  videoDurationText: {
    fontSize: 12,
  },
  videoActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  changeVideoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  changeVideoBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2563EB",
  },
  videoPickerPlaceholder: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 6,
  },
  pickerIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  pickerSubtitle: {
    fontSize: 13,
    textAlign: "center",
    maxWidth: 240,
    marginBottom: 8,
  },
  pickerButtonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 6,
  },
  pickerActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#2563EB",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  pickerActionBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  captionInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: "top",
  },
  captionMetaRow: {
    alignItems: "flex-end",
  },
  charCount: {
    fontSize: 11,
  },
  quickTagsTitle: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: -4,
  },
  tagWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tagChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  tagChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    width: "48%",
  },
  categoryCardText: {
    fontSize: 12,
  },
});
