import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  Image,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Animated,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { CommunityStory } from "../services/communityService";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface StoryViewerModalProps {
  visible: boolean;
  stories: CommunityStory[];
  initialIndex?: number;
  onClose: () => void;
  onLikeStory?: (story: CommunityStory) => void;
}

const REACTION_EMOJIS = ["❤️", "👍", "🔥", "😂", "👏"];

export const StoryViewerModal: React.FC<StoryViewerModalProps> = ({
  visible,
  stories,
  initialIndex = 0,
  onClose,
  onLikeStory,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [replyText, setReplyText] = useState("");
  const [reactionSent, setReactionSent] = useState<string | null>(null);

  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex, visible]);

  useEffect(() => {
    if (!visible || stories.length === 0) return;

    progressAnim.setValue(0);
    const animation = Animated.timing(progressAnim, {
      toValue: 1,
      duration: 5000,
      useNativeDriver: false,
    });

    animation.start(({ finished }) => {
      if (finished) {
        if (currentIndex < stories.length - 1) {
          setCurrentIndex((prev) => prev + 1);
        } else {
          onClose();
        }
      }
    });

    return () => {
      animation.stop();
    };
  }, [visible, currentIndex, stories.length]);

  if (!visible || stories.length === 0) return null;

  const currentStory = stories[currentIndex] || stories[0];

  const handleNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleSendReaction = (emoji: string) => {
    setReactionSent(emoji);
    if (onLikeStory) {
      onLikeStory(currentStory);
    }
    setTimeout(() => {
      setReactionSent(null);
    }, 1500);
  };

  const formatStoryTime = (isoString?: string) => {
    if (!isoString) return "Just now";
    const diff = Math.max(0, Date.now() - new Date(isoString).getTime());
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Fullscreen Story Media */}
        {currentStory.mediaUrl ? (
          <Image
            source={{ uri: currentStory.mediaUrl }}
            style={styles.backgroundImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.backgroundImage, styles.textStoryBg]}>
            <Ionicons
              name="sparkles"
              size={44}
              color="#93C5FD"
              style={{ marginBottom: 16 }}
            />
            <Text style={styles.centerStoryCaption}>
              {currentStory.caption || "Community Moment"}
            </Text>
          </View>
        )}

        {/* Dark Vignette Overlay */}
        <View style={styles.vignetteOverlay} />

        <SafeAreaView style={styles.safeContainer} edges={["top", "bottom"]}>
          {/* Top Segmented Progress Bars */}
          <View style={styles.progressContainer}>
            {stories.map((s, idx) => {
              let segmentWidth: any = "0%";
              if (idx < currentIndex) {
                segmentWidth = "100%";
              } else if (idx === currentIndex) {
                segmentWidth = progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0%", "100%"],
                });
              }

              return (
                <View key={s.id || idx} style={styles.progressBarTrack}>
                  <Animated.View
                    style={[styles.progressBarFill, { width: segmentWidth }]}
                  />
                </View>
              );
            })}
          </View>

          {/* Top Bar Header */}
          <View style={styles.headerBar}>
            <View style={styles.authorGroup}>
              {currentStory.authorAvatar ? (
                <Image
                  source={{ uri: currentStory.authorAvatar }}
                  style={styles.authorAvatar}
                />
              ) : (
                <View style={styles.authorAvatarPlaceholder}>
                  <Text style={styles.authorAvatarInitial}>
                    {currentStory.authorName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View>
                <Text style={styles.authorName}>{currentStory.authorName}</Text>
                <Text style={styles.storyTime}>
                  {formatStoryTime(currentStory.createdAt)}
                </Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Touch navigation zones */}
          <View style={styles.touchZones}>
            <TouchableWithoutFeedback onPress={handlePrev}>
              <View style={styles.touchLeft} />
            </TouchableWithoutFeedback>
            <TouchableWithoutFeedback onPress={handleNext}>
              <View style={styles.touchRight} />
            </TouchableWithoutFeedback>
          </View>

          {/* Story Caption (if photo story with caption) */}
          {currentStory.mediaUrl && currentStory.caption ? (
            <View style={styles.captionContainer}>
              <Text style={styles.bottomCaptionText}>
                {currentStory.caption}
              </Text>
            </View>
          ) : null}

          {/* Floating Reaction Animation Badge */}
          {reactionSent && (
            <View style={styles.reactionPop}>
              <Text style={styles.reactionPopEmoji}>{reactionSent}</Text>
            </View>
          )}

          {/* Bottom Facebook Action Bar */}
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.bottomBarContainer}
          >
            <View style={styles.replyBar}>
              <TextInput
                style={styles.replyInput}
                placeholder={`Reply to ${currentStory.authorName.split(" ")[0]}...`}
                placeholderTextColor="rgba(255,255,255,0.7)"
                value={replyText}
                onChangeText={setReplyText}
              />

              {replyText.trim() ? (
                <TouchableOpacity
                  onPress={() => {
                    setReplyText("");
                    handleSendReaction("💬");
                  }}
                  style={styles.sendReplyBtn}
                >
                  <Ionicons name="send" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Quick Reactions */}
            <View style={styles.reactionsRow}>
              {REACTION_EMOJIS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  onPress={() => handleSendReaction(emoji)}
                  style={styles.reactionBtn}
                >
                  <Text style={styles.reactionEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#000000",
  },
  backgroundImage: {
    position: "absolute",
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  textStoryBg: {
    backgroundColor: "#1E3A8A",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  centerStoryCaption: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 34,
  },
  vignetteOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  safeContainer: {
    flex: 1,
    justifyContent: "space-between",
  },
  progressContainer: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 4,
  },
  progressBarTrack: {
    flex: 1,
    height: 2.5,
    backgroundColor: "rgba(255,255,255,0.35)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#FFFFFF",
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  authorGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  authorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    marginRight: 10,
  },
  authorAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  authorAvatarInitial: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  authorName: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 3,
  },
  storyTime: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 11,
    fontWeight: "500",
  },
  closeBtn: {
    padding: 6,
  },
  touchZones: {
    flex: 1,
    flexDirection: "row",
  },
  touchLeft: {
    flex: 1,
  },
  touchRight: {
    flex: 2,
  },
  captionContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
    marginHorizontal: 16,
    borderRadius: 14,
    marginBottom: 10,
  },
  bottomCaptionText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 22,
  },
  reactionPop: {
    position: "absolute",
    alignSelf: "center",
    top: SCREEN_HEIGHT * 0.45,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 40,
    padding: 16,
  },
  reactionPopEmoji: {
    fontSize: 48,
  },
  bottomBarContainer: {
    paddingHorizontal: 14,
    paddingBottom: 10,
    gap: 8,
  },
  replyBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    paddingHorizontal: 14,
  },
  replyInput: {
    flex: 1,
    height: 42,
    color: "#FFFFFF",
    fontSize: 14,
  },
  sendReplyBtn: {
    padding: 6,
  },
  reactionsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 4,
  },
  reactionBtn: {
    padding: 6,
  },
  reactionEmoji: {
    fontSize: 24,
  },
});
