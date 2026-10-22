import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  Platform,
  Image,
  ActivityIndicator,
  Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import {
  CommunityReel,
  getReelVideoType,
  extractYouTubeId,
  normalizeFacebookUrl,
} from "../services/communityService";

interface InAppVideoPlayerModalProps {
  visible: boolean;
  onClose: () => void;
  reel: CommunityReel | null;
  onOpenProfile?: (
    authorId: string,
    authorName: string,
    authorAvatar?: string,
  ) => void;
}

export const InAppVideoPlayerModal: React.FC<InAppVideoPlayerModalProps> = ({
  visible,
  onClose,
  reel,
  onOpenProfile,
}) => {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);

  if (!visible || !reel) return null;

  const videoType = getReelVideoType(reel.videoUrl);
  const youtubeId =
    videoType === "youtube" ? extractYouTubeId(reel.videoUrl) : null;
  const normalizedFbUrl =
    videoType === "facebook" ? normalizeFacebookUrl(reel.videoUrl) : "";

  const handleShare = async () => {
    try {
      await Share.share({
        title: "Splitzy Community Reel",
        message: `${reel.caption}\n${reel.videoUrl}`,
        url: reel.videoUrl,
      });
    } catch {}
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
            backgroundColor: "#000000",
            paddingTop: Math.max(
              insets.top,
              Platform.OS === "android" ? 24 : 12,
            ),
          },
        ]}
      >
        {/* Top Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            accessibilityLabel="Close player"
            activeOpacity={0.7}
          >
            <Feather name="x" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Author info pill */}
          <TouchableOpacity
            onPress={() => {
              if (onOpenProfile) {
                onClose();
                onOpenProfile(
                  reel.authorId,
                  reel.authorName,
                  reel.authorAvatar,
                );
              }
            }}
            style={styles.authorBadge}
            activeOpacity={0.8}
          >
            {reel.authorAvatar ? (
              <Image
                source={{ uri: reel.authorAvatar }}
                style={styles.authorAvatar}
              />
            ) : (
              <View style={styles.authorAvatarFallback}>
                <Text style={styles.authorAvatarInitials}>
                  {reel.authorName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.authorTextWrap}>
              <Text style={styles.authorName} numberOfLines={1}>
                {reel.authorName}
              </Text>
              <View style={styles.sourceRow}>
                <Ionicons
                  name={
                    videoType === "youtube"
                      ? "logo-youtube"
                      : videoType === "facebook"
                        ? "logo-facebook"
                        : "film-outline"
                  }
                  size={11}
                  color={
                    videoType === "youtube"
                      ? "#EF4444"
                      : videoType === "facebook"
                        ? "#3B82F6"
                        : "#10B981"
                  }
                />
                <Text style={styles.sourceText}>
                  {videoType === "youtube"
                    ? "YouTube Shorts"
                    : videoType === "facebook"
                      ? "Facebook Reel"
                      : "Community Video"}
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Share button */}
          <TouchableOpacity
            onPress={handleShare}
            style={styles.shareBtn}
            accessibilityLabel="Share reel"
            activeOpacity={0.7}
          >
            <Feather name="share-2" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Video Canvas Container */}
        <View style={styles.videoCanvas}>
          {Platform.OS === "web" ? (
            <div
              style={{
                width: "100%",
                height: "100%",
                position: "relative",
                backgroundColor: "#000000",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {videoType === "youtube" && youtubeId ? (
                <iframe
                  key={`inapp-yt-${youtubeId}`}
                  src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&mute=0&controls=1&loop=1&playlist=${youtubeId}&modestbranding=1&rel=0&playsinline=1`}
                  title={reel.caption || "YouTube Short"}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  style={{
                    width: "100%",
                    height: "100%",
                    border: "none",
                    display: "block",
                  }}
                  onLoad={() => setLoading(false)}
                />
              ) : videoType === "facebook" ? (
                <iframe
                  key={`inapp-fb-${reel.id}`}
                  src={`https://www.facebook.com/plugins/video.php?height=100%25&href=${encodeURIComponent(normalizedFbUrl || reel.videoUrl)}&show_text=false&width=100%25&t=0&autoplay=true&mute=0`}
                  title={reel.caption || "Facebook Reel"}
                  style={{
                    width: "100%",
                    height: "100%",
                    border: "none",
                    overflow: "hidden",
                  }}
                  scrolling="no"
                  allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                  allowFullScreen
                  onLoad={() => setLoading(false)}
                />
              ) : (
                <video
                  src={reel.videoUrl}
                  poster={reel.thumbnailUrl}
                  controls
                  autoPlay
                  playsInline
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    backgroundColor: "#000000",
                  }}
                  onLoadedData={() => setLoading(false)}
                />
              )}
            </div>
          ) : (
            <View style={styles.nativeFallbackContainer}>
              {reel.thumbnailUrl ? (
                <Image
                  source={{ uri: reel.thumbnailUrl }}
                  style={styles.nativeFallbackImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.nativeFallbackBlack} />
              )}
              <View style={styles.nativeFallbackOverlay}>
                <View style={styles.nativeFallbackBadge}>
                  <Ionicons name="play-circle" size={48} color="#2563EB" />
                  <Text style={styles.nativeFallbackTitle}>
                    In-App Playback
                  </Text>
                  <Text style={styles.nativeFallbackSub}>
                    Streaming{" "}
                    {videoType === "youtube"
                      ? "YouTube Short"
                      : videoType === "facebook"
                        ? "Facebook Reel"
                        : "Video"}{" "}
                    directly
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Bottom Caption & Audio Bar */}
        <View
          style={[
            styles.bottomBar,
            { paddingBottom: Math.max(insets.bottom, 16) + 8 },
          ]}
        >
          {reel.caption ? (
            <Text style={styles.captionText} numberOfLines={3}>
              {reel.caption}
            </Text>
          ) : null}

          {reel.soundTitle ? (
            <View style={styles.soundBar}>
              <Ionicons name="musical-notes" size={13} color="#94A3B8" />
              <Text style={styles.soundText} numberOfLines={1}>
                {reel.soundTitle}
              </Text>
            </View>
          ) : null}
        </View>
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
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
    zIndex: 20,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(30, 41, 59, 0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  authorBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    maxWidth: "65%",
  },
  authorAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  authorAvatarFallback: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  authorAvatarInitials: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  authorTextWrap: {
    flexShrink: 1,
  },
  authorName: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sourceText: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "600",
  },
  shareBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(30, 41, 59, 0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  videoCanvas: {
    flex: 1,
    backgroundColor: "#000000",
    position: "relative",
  },
  nativeFallbackContainer: {
    flex: 1,
    backgroundColor: "#000000",
  },
  nativeFallbackImage: {
    width: "100%",
    height: "100%",
  },
  nativeFallbackBlack: {
    flex: 1,
    backgroundColor: "#000000",
  },
  nativeFallbackOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  nativeFallbackBadge: {
    alignItems: "center",
    gap: 8,
  },
  nativeFallbackTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  nativeFallbackSub: {
    color: "#94A3B8",
    fontSize: 13,
    textAlign: "center",
  },
  bottomBar: {
    backgroundColor: "rgba(11, 17, 32, 0.95)",
    borderTopWidth: 1,
    borderTopColor: "#1E293B",
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 6,
  },
  captionText: {
    color: "#F8FAFC",
    fontSize: 13,
    lineHeight: 18,
  },
  soundBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  soundText: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "500",
  },
});
