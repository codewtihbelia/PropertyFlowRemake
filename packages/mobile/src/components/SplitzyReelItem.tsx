import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  Dimensions,
  Platform,
  Share,
  Animated,
  Linking,
} from "react-native";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import {
  CommunityReel,
  getReelVideoType,
  extractYouTubeId,
  normalizeFacebookUrl,
} from "../services/communityService";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface SplitzyReelItemProps {
  reel: CommunityReel;
  isActive: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  onToggleLike: (reelId: string) => void;
  onOpenComments: (reel: CommunityReel) => void;
  onOpenProfile: (
    authorId: string,
    authorName: string,
    authorAvatar?: string,
  ) => void;
  onDeleteReel?: (reelId: string) => void;
  onActivate?: () => void;
  currentUserId: string;
  itemHeight: number;
}

export const SplitzyReelItem: React.FC<SplitzyReelItemProps> = ({
  reel,
  isActive,
  isMuted,
  onToggleMute,
  onToggleLike,
  onOpenComments,
  onOpenProfile,
  onDeleteReel,
  onActivate,
  currentUserId,
  itemHeight,
}) => {
  const insets = useSafeAreaInsets();
  const [isPlaying, setIsPlaying] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const [showPlayPauseIcon, setShowPlayPauseIcon] = useState<
    "play" | "pause" | null
  >(null);

  const heartScaleAnim = useRef(new Animated.Value(0)).current;
  const playPauseAnim = useRef(new Animated.Value(0)).current;
  const videoElemRef = useRef<any>(null);

  const isLiked = (reel.likes || []).includes(currentUserId);
  const isAuthor = reel.authorId === currentUserId;
  const videoType = getReelVideoType(reel.videoUrl);
  const youtubeId =
    videoType === "youtube" ? extractYouTubeId(reel.videoUrl) : null;

  const showIndicator = (type: "play" | "pause") => {
    setShowPlayPauseIcon(type);
    playPauseAnim.setValue(0);
    Animated.sequence([
      Animated.timing(playPauseAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.delay(350),
      Animated.timing(playPauseAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowPlayPauseIcon(null);
    });
  };

  // HTML5 Video playback control for direct MP4 videos
  useEffect(() => {
    const el = videoElemRef.current;
    if (Platform.OS === "web" && el && videoType === "mp4") {
      el.muted = isMuted;
      if (isActive) {
        const playPromise = el.play?.();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsPlaying(true);
            })
            .catch(() => {
              // Browser autoplay policy restricted audio; force mute and play
              el.muted = true;
              el.play?.()
                .then(() => setIsPlaying(true))
                .catch(() => {
                  // Requires user gesture to start
                  setIsPlaying(false);
                });
            });
        }
      } else {
        el.pause?.();
        setIsPlaying(false);
      }
    }
  }, [isActive, isMuted, videoType]);

  const togglePlayPause = () => {
    if (onActivate && !isActive) {
      onActivate();
    }
    const el = videoElemRef.current;
    if (Platform.OS === "web" && el && videoType === "mp4") {
      if (el.paused) {
        el.muted = isMuted;
        const playPromise = el.play?.();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsPlaying(true);
              showIndicator("play");
            })
            .catch(() => {
              el.muted = true;
              el.play?.()
                .then(() => {
                  setIsPlaying(true);
                  showIndicator("play");
                })
                .catch(() => {});
            });
        }
      } else {
        el.pause?.();
        setIsPlaying(false);
        showIndicator("pause");
      }
    } else {
      setIsPlaying((prev) => !prev);
    }
  };

  const handleDoubleTap = () => {
    if (!isLiked) {
      onToggleLike(reel.id);
    }
    setShowHeartBurst(true);
    heartScaleAnim.setValue(0);

    Animated.sequence([
      Animated.spring(heartScaleAnim, {
        toValue: 1.2,
        friction: 4,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(heartScaleAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowHeartBurst(false);
    });
  };

  const handleShare = async () => {
    try {
      await Share.share({
        title: "Splitzy Community Reel",
        message: `Check out this reel on Splitzy: "${reel.caption}"\n${reel.videoUrl}`,
        url: reel.videoUrl,
      });
    } catch {}
  };

  const handleOpenExternal = () => {
    if (reel.videoUrl) {
      Linking.openURL(reel.videoUrl).catch(() => {});
    }
  };

  const formatCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return `${count || 0}`;
  };

  // Construct iframe embed source
  const getEmbedSource = () => {
    if (videoType === "youtube" && youtubeId) {
      return `https://www.youtube.com/embed/${youtubeId}?autoplay=${isActive ? 1 : 0}&mute=${isMuted ? 1 : 0}&loop=1&playlist=${youtubeId}&controls=1&playsinline=1&modestbranding=1&rel=0&enablejsapi=1`;
    }
    if (videoType === "facebook") {
      return `https://www.facebook.com/plugins/video.php?height=100%25&href=${encodeURIComponent(normalizeFacebookUrl(reel.videoUrl) || reel.videoUrl)}&show_text=false&width=100%25&t=0&autoplay=${isActive ? "true" : "false"}&mute=${isMuted ? "1" : "0"}`;
    }
    return null;
  };

  const embedUrl = getEmbedSource();

  return (
    <View style={[styles.container, { height: itemHeight }]}>
      {/* ─── VIDEO SURFACE ──────────────────────────────────────────────── */}
      <View style={StyleSheet.absoluteFill}>
        {Platform.OS === "web" ? (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              backgroundColor: "#000000",
              overflow: "hidden",
            }}
          >
            {videoType === "youtube" && youtubeId ? (
              // Direct In-App YouTube Shorts Player
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: "100%",
                  backgroundColor: "#000000",
                }}
              >
                <iframe
                  key={`yt-${youtubeId}`}
                  src={`https://www.youtube.com/embed/${youtubeId}?autoplay=${isActive ? 1 : 0}&mute=${isMuted ? 1 : 0}&loop=1&playlist=${youtubeId}&controls=1&playsinline=1&modestbranding=1&rel=0&iv_load_policy=3&enablejsapi=1`}
                  title={reel.caption || "YouTube Short"}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  loading="eager"
                  referrerPolicy="strict-origin-when-cross-origin"
                  style={{
                    width: "100%",
                    height: "100%",
                    border: "none",
                    display: "block",
                    objectFit: "cover",
                  }}
                />
              </div>
            ) : videoType === "facebook" ? (
              // Direct In-App Facebook Reel Player
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: "100%",
                  backgroundColor: "#000000",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <iframe
                  key={`fb-${reel.id}`}
                  src={`https://www.facebook.com/plugins/video.php?height=100%25&href=${encodeURIComponent(normalizeFacebookUrl(reel.videoUrl) || reel.videoUrl)}&show_text=false&width=100%25&t=0&autoplay=${isActive ? "true" : "false"}&mute=${isMuted ? "1" : "0"}`}
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
                />
              </div>
            ) : (
              // Direct MP4 video stream with Native DOM trusted user gesture play control
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: "100%",
                  backgroundColor: "#000000",
                }}
              >
                <video
                  ref={(el) => {
                    videoElemRef.current = el;
                    if (el) {
                      el.muted = isMuted;
                      el.defaultMuted = true;
                    }
                  }}
                  poster={reel.thumbnailUrl}
                  autoPlay={isActive}
                  loop
                  playsInline
                  muted={isMuted}
                  controls={false}
                  preload="auto"
                  crossOrigin="anonymous"
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onClick={(e) => {
                    e.stopPropagation();
                    const el = e.currentTarget;
                    if (el.paused) {
                      el.muted = isMuted;
                      el.play()
                        .then(() => setIsPlaying(true))
                        .catch(() => {
                          el.muted = true;
                          el.play()
                            .then(() => setIsPlaying(true))
                            .catch(() => {});
                        });
                    } else {
                      el.pause();
                      setIsPlaying(false);
                    }
                  }}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                    cursor: "pointer",
                    backgroundColor: "#000000",
                  }}
                >
                  <source src={reel.videoUrl} type="video/mp4" />
                </video>

                {/* Direct Native DOM Play Button (guarantees trusted browser user activation in iframe) */}
                {!isPlaying && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      if (onActivate && !isActive) {
                        onActivate();
                      }
                      const el = videoElemRef.current;
                      if (el) {
                        el.muted = isMuted;
                        const p = el.play();
                        if (p !== undefined) {
                          p.then(() => {
                            setIsPlaying(true);
                            showIndicator("play");
                          }).catch(() => {
                            el.muted = true;
                            el.play()
                              .then(() => {
                                setIsPlaying(true);
                                showIndicator("play");
                              })
                              .catch(() => {});
                          });
                        }
                      }
                    }}
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      zIndex: 10,
                      width: "82px",
                      height: "82px",
                      borderRadius: "41px",
                      backgroundColor: "rgba(37, 99, 235, 0.92)",
                      border: "3px solid #FFFFFF",
                      color: "#FFFFFF",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      boxShadow: "0 8px 30px rgba(0, 0, 0, 0.75)",
                      outline: "none",
                      padding: 0,
                    }}
                  >
                    <svg
                      width="40"
                      height="40"
                      viewBox="0 0 24 24"
                      fill="#FFFFFF"
                      style={{ marginLeft: "4px" }}
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: "800",
                        marginTop: "2px",
                        letterSpacing: "0.5px",
                      }}
                    >
                      PLAY
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <TouchableOpacity
            style={styles.nativeVideoPlaceholder}
            activeOpacity={0.9}
            onPress={() => {
              if (videoType === "youtube" || videoType === "facebook") {
                handleOpenExternal();
              } else {
                togglePlayPause();
              }
            }}
          >
            {reel.thumbnailUrl ? (
              <Image
                source={{ uri: reel.thumbnailUrl }}
                style={styles.nativeThumbnail}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.fallbackBlackCanvas} />
            )}

            <View style={styles.nativePlayOverlay}>
              <View style={styles.nativePlayCircle}>
                <Ionicons
                  name="play"
                  size={32}
                  color="#FFFFFF"
                  style={{ marginLeft: 3 }}
                />
              </View>
              <View style={styles.nativeWatchBadge}>
                <Ionicons
                  name={
                    videoType === "youtube"
                      ? "logo-youtube"
                      : videoType === "facebook"
                        ? "logo-facebook"
                        : "play-circle"
                  }
                  size={14}
                  color="#FFFFFF"
                />
                <Text style={styles.nativeWatchText}>
                  {videoType === "youtube"
                    ? "Play Short In-App"
                    : videoType === "facebook"
                      ? "Play Reel In-App"
                      : "Play Video In-App"}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* Gradient Scrims for contrast */}
        <View style={styles.topScrim} pointerEvents="none" />
        <View style={styles.bottomScrim} pointerEvents="none" />

        {/* Double-tap Heart Burst Animation */}
        {showHeartBurst && (
          <Animated.View
            style={[
              styles.centerBurstWrap,
              {
                transform: [{ scale: heartScaleAnim }],
              },
            ]}
            pointerEvents="none"
          >
            <Ionicons name="heart" size={100} color="#EF4444" />
          </Animated.View>
        )}

        {/* Play / Pause indicator icon */}
        {showPlayPauseIcon && (
          <Animated.View
            style={[
              styles.centerBurstWrap,
              {
                opacity: playPauseAnim,
                transform: [
                  {
                    scale: playPauseAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.6, 1],
                    }),
                  },
                ],
              },
            ]}
            pointerEvents="none"
          >
            <View style={styles.playPauseBubble}>
              <Ionicons
                name={showPlayPauseIcon === "play" ? "play" : "pause"}
                size={40}
                color="#FFFFFF"
              />
            </View>
          </Animated.View>
        )}
      </View>

      {/* ─── TOP CONTROL BAR ────────────────────────────────────────────── */}
      <View
        style={[
          styles.topControlRow,
          {
            top: Math.max(insets.top, Platform.OS === "android" ? 34 : 16) + 48,
          },
        ]}
      >
        <View style={styles.sourceBadgeWrap}>
          {videoType === "youtube" ? (
            <View
              style={[
                styles.platformBadge,
                { backgroundColor: "rgba(220, 38, 38, 0.85)" },
              ]}
            >
              <Ionicons name="logo-youtube" size={13} color="#FFFFFF" />
              <Text style={styles.platformBadgeText}>YouTube Short</Text>
            </View>
          ) : videoType === "facebook" ? (
            <View
              style={[
                styles.platformBadge,
                { backgroundColor: "rgba(24, 119, 242, 0.85)" },
              ]}
            >
              <Ionicons name="logo-facebook" size={13} color="#FFFFFF" />
              <Text style={styles.platformBadgeText}>Facebook Reel</Text>
            </View>
          ) : (
            <View style={styles.liveBadge}>
              <Text style={styles.liveBadgeDot}>•</Text>
              <Text style={styles.liveBadgeText}>IN-APP STREAM</Text>
            </View>
          )}
        </View>

        {/* Sound Mute Toggle */}
        <TouchableOpacity
          onPress={onToggleMute}
          style={[styles.soundToggleBtn, isMuted && styles.soundToggleBtnMuted]}
          activeOpacity={0.8}
          accessibilityLabel={isMuted ? "Unmute audio" : "Mute audio"}
        >
          <Ionicons
            name={isMuted ? "volume-mute" : "volume-high"}
            size={16}
            color="#FFFFFF"
          />
          {isMuted && (
            <Text style={styles.soundToggleMutedLabel}>Tap for sound</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ─── RIGHT ACTION RAIL ─────────────────────────────────────────── */}
      <View style={styles.rightActionRail}>
        {/* Author Avatar with Profile link */}
        <TouchableOpacity
          onPress={() =>
            onOpenProfile(reel.authorId, reel.authorName, reel.authorAvatar)
          }
          style={styles.railAvatarBtn}
          activeOpacity={0.85}
        >
          {reel.authorAvatar ? (
            <Image
              source={{ uri: reel.authorAvatar }}
              style={styles.railAvatarImg}
            />
          ) : (
            <View style={styles.railAvatarFallback}>
              <Text style={styles.railAvatarFallbackText}>
                {reel.authorName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          {!isAuthor && (
            <View style={styles.followBadge}>
              <Ionicons name="add" size={12} color="#FFFFFF" />
            </View>
          )}
        </TouchableOpacity>

        {/* Like Button */}
        <TouchableOpacity
          onPress={() => onToggleLike(reel.id)}
          style={styles.railActionBtn}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isLiked ? "heart" : "heart-outline"}
            size={28}
            color={isLiked ? "#EF4444" : "#FFFFFF"}
          />
          <Text style={styles.railActionText}>
            {formatCount(reel.likesCount || reel.likes?.length || 0)}
          </Text>
        </TouchableOpacity>

        {/* Comment Button */}
        <TouchableOpacity
          onPress={() => onOpenComments(reel)}
          style={styles.railActionBtn}
          activeOpacity={0.8}
        >
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={27}
            color="#FFFFFF"
          />
          <Text style={styles.railActionText}>
            {formatCount(reel.commentsCount || 0)}
          </Text>
        </TouchableOpacity>

        {/* Share Button */}
        <TouchableOpacity
          onPress={handleShare}
          style={styles.railActionBtn}
          activeOpacity={0.8}
        >
          <Ionicons name="share-social-outline" size={26} color="#FFFFFF" />
          <Text style={styles.railActionText}>
            {formatCount(reel.sharesCount || 0)}
          </Text>
        </TouchableOpacity>

        {/* Author Delete Option */}
        {isAuthor && onDeleteReel && (
          <TouchableOpacity
            onPress={() => onDeleteReel(reel.id)}
            style={styles.railActionBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="trash-outline" size={24} color="#F87171" />
            <Text style={[styles.railActionText, { color: "#F87171" }]}>
              Delete
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ─── BOTTOM OVERLAY: Author Details, Caption & Audio ───────────── */}
      <View style={styles.bottomOverlay}>
        {/* Author Name and Badge */}
        <TouchableOpacity
          onPress={() =>
            onOpenProfile(reel.authorId, reel.authorName, reel.authorAvatar)
          }
          style={styles.bottomAuthorRow}
          activeOpacity={0.85}
        >
          <Text style={styles.bottomAuthorName}>{reel.authorName}</Text>
          {reel.authorRole && (
            <View style={styles.bottomRoleBadge}>
              <Text style={styles.bottomRoleBadgeText}>{reel.authorRole}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Caption with expandable "more" */}
        <TouchableOpacity
          onPress={() => setCaptionExpanded((prev) => !prev)}
          activeOpacity={0.9}
        >
          <Text
            style={styles.bottomCaption}
            numberOfLines={captionExpanded ? undefined : 2}
          >
            {reel.caption}
          </Text>
          {!captionExpanded && reel.caption.length > 70 && (
            <Text style={styles.captionMoreText}>...more</Text>
          )}
        </TouchableOpacity>

        {/* Sound / Music Track Ticker */}
        {reel.soundTitle && (
          <View style={styles.soundTickerRow}>
            <Ionicons name="musical-notes" size={14} color="#FFFFFF" />
            <Text style={styles.soundTickerText} numberOfLines={1}>
              {reel.soundTitle}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    maxWidth: "100%",
    backgroundColor: "#000000",
    position: "relative",
    overflow: "hidden",
  },
  nativeVideoPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#000000",
  },
  nativeThumbnail: {
    width: "100%",
    height: "100%",
  },
  nativePlayOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  nativePlayCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  nativePlayPrompt: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.3,
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  nativeWatchBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  nativeWatchText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  fallbackBlackCanvas: {
    width: "100%",
    height: "100%",
    backgroundColor: "#0F172A",
  },
  topScrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    // backgroundColor: "rgba(0,0,0,0.35)",
  },
  bottomScrim: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 180,
    // backgroundColor: "rgba(0,0,0,0.6)",
  },
  centerBurstWrap: {
    position: "absolute",
    top: "40%",
    left: "50%",
    marginLeft: -50,
    marginTop: -50,
    width: 100,
    height: 100,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  playPauseBubble: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  topControlRow: {
    position: "absolute",
    top: 14,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 20,
  },
  sourceBadgeWrap: {
    flexDirection: "row",
    alignItems: "center",
  },
  platformBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 6,
  },
  platformBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  liveBadgeDot: {
    color: "#EF4444",
    fontSize: 14,
    fontWeight: "900",
  },
  liveBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  soundToggleBtn: {
    height: 38,
    minWidth: 38,
    paddingHorizontal: 10,
    borderRadius: 19,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  soundToggleBtnMuted: {
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
  },
  soundToggleMutedLabel: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },
  rightActionRail: {
    position: "absolute",
    right: 12,
    bottom: 80,
    alignItems: "center",
    gap: 18,
    zIndex: 20,
  },
  railAvatarBtn: {
    position: "relative",
    marginBottom: 4,
  },
  railAvatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  railAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  railAvatarFallbackText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  followBadge: {
    position: "absolute",
    bottom: -4,
    left: 14,
    backgroundColor: "#2563EB",
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  railActionBtn: {
    alignItems: "center",
    gap: 4,
  },
  railActionText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bottomOverlay: {
    position: "absolute",
    left: 16,
    right: 76,
    bottom: 40,
    gap: 8,
    zIndex: 20,
  },
  bottomAuthorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bottomAuthorName: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bottomRoleBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  bottomRoleBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },
  bottomCaption: {
    color: "#F8FAFC",
    fontSize: 13,
    lineHeight: 18,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  captionMoreText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  soundTickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 2,
  },
  soundTickerText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "500",
    maxWidth: 200,
  },
  persistentPlayOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 15,
    backgroundColor: "rgba(0, 0, 0, 0.25)",
  },
  persistentPlayCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(37, 99, 235, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  persistentPlayText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
    marginTop: 12,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    overflow: "hidden",
  },
});
