import React, { useState, useRef, useEffect, useCallback, memo } from "react";
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
  ActivityIndicator,
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
  communityService,
  formatViewCount,
} from "../services/communityService";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

let NativeWebView: any = null;
if (Platform.OS !== "web") {
  try {
    NativeWebView = require("react-native-webview").WebView;
  } catch (_) {}
}

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

const SplitzyReelItemComponent: React.FC<SplitzyReelItemProps> = ({
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
  // Default to false so reels auto-play smoothly without an obstructing initial spinner
  const [isLoading, setIsLoading] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const [showPlayPauseIcon, setShowPlayPauseIcon] = useState<
    "play" | "pause" | null
  >(null);

  const heartScaleAnim = useRef(new Animated.Value(0)).current;
  const playPauseAnim = useRef(new Animated.Value(0)).current;
  const videoElemRef = useRef<any>(null);
  const stallTimerRef = useRef<any>(null);

  const isLiked = (reel.likes || []).includes(currentUserId);
  const isAuthor = reel.authorId === currentUserId;
  const videoType = getReelVideoType(reel.videoUrl);
  const youtubeId =
    videoType === "youtube" ? extractYouTubeId(reel.videoUrl) : null;

  // Intelligent Buffering Grace Period: Only show spinner if reel stalls or has trouble loading for > 1.5 seconds
  const startStallGraceTimer = useCallback(() => {
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current);
    }
    stallTimerRef.current = setTimeout(() => {
      setIsLoading(true);
    }, 1500);
  }, []);

  const clearStallGraceTimer = useCallback(() => {
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
    setIsLoading(false);
  }, []);

  // Manage playback and buffering states when active reel changes
  useEffect(() => {
    if (isActive) {
      // Do not flash the loading spinner immediately; start the 1.5s trouble-to-load timer
      startStallGraceTimer();
      // Failsafe timer so loading spinner never gets permanently stuck
      const failsafeTimer = setTimeout(() => {
        clearStallGraceTimer();
      }, 4500);
      return () => {
        clearTimeout(failsafeTimer);
        clearStallGraceTimer();
      };
    } else {
      clearStallGraceTimer();
    }
  }, [isActive, startStallGraceTimer, clearStallGraceTimer]);

  // Record view count once per unique viewer session after 1.2s of active viewing
  useEffect(() => {
    if (!isActive) return;
    const viewTimer = setTimeout(() => {
      communityService.recordReelView(reel.id, currentUserId);
    }, 1200);
    return () => clearTimeout(viewTimer);
  }, [isActive, reel.id, currentUserId]);

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
              clearStallGraceTimer();
            })
            .catch(() => {
              // Browser autoplay policy restricted audio; force mute and play immediately
              el.muted = true;
              el.play?.()
                .then(() => {
                  setIsPlaying(true);
                  clearStallGraceTimer();
                })
                .catch(() => {
                  // Requires explicit user tap
                  setIsPlaying(false);
                  clearStallGraceTimer();
                });
            });
        }
      } else {
        el.pause?.();
        setIsPlaying(false);
        clearStallGraceTimer();
      }
    }
  }, [isActive, isMuted, videoType, clearStallGraceTimer]);

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

  const formatCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return `${count || 0}`;
  };

  // Construct iframe embed source
  // Construct iframe embed source
  const getEmbedSource = () => {
    if (videoType === "youtube" && youtubeId) {
      return `https://www.youtube.com/embed/${youtubeId}?autoplay=${isActive ? 1 : 0}&mute=${isMuted ? 1 : 0}&loop=1&playlist=${youtubeId}&controls=1&playsinline=1&modestbranding=1&rel=0`;
    }
    if (videoType === "facebook") {
      const cleanFb = normalizeFacebookUrl(reel.videoUrl) || reel.videoUrl;
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(cleanFb)}&show_text=false&width=380&t=0&autoplay=${isActive ? "true" : "false"}&mute=${isMuted ? "1" : "0"}`;
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
              // Direct In-App YouTube Shorts Player (mounts iframe only when active to eliminate lag)
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: "100%",
                  backgroundColor: "#000000",
                }}
              >
                {isActive ? (
                  <iframe
                    key={`yt-${youtubeId}-${isMuted ? "muted" : "unmuted"}`}
                    src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=${isMuted ? 1 : 0}&loop=1&playlist=${youtubeId}&controls=1&playsinline=1&modestbranding=1&rel=0`}
                    title={reel.caption || "YouTube Short"}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    loading="eager"
                    onLoad={() => clearStallGraceTimer()}
                    referrerPolicy="strict-origin-when-cross-origin"
                    style={{
                      width: "100%",
                      height: "100%",
                      border: "none",
                      display: "block",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  // Lightweight preview poster when inactive (prevents lag, memory leaks, and background play)
                  <img
                    src={
                      reel.thumbnailUrl ||
                      `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`
                    }
                    alt={reel.caption || "Reel"}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                )}
              </div>
            ) : videoType === "facebook" ? (
              // Direct In-App Facebook Reel Player (mounts iframe only when active to eliminate lag)
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
                {isActive ? (
                  <iframe
                    key={`fb-${reel.id}-${isMuted ? "muted" : "unmuted"}`}
                    src={`https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(normalizeFacebookUrl(reel.videoUrl) || reel.videoUrl)}&show_text=false&width=380&t=0&autoplay=true&mute=${isMuted ? "1" : "0"}`}
                    title={reel.caption || "Facebook Reel"}
                    style={{
                      width: "100%",
                      height: "100%",
                      border: "none",
                      overflow: "hidden",
                    }}
                    scrolling="no"
                    onLoad={() => clearStallGraceTimer()}
                    allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                    allowFullScreen
                  />
                ) : (
                  // Lightweight preview poster when inactive
                  <img
                    src={
                      reel.thumbnailUrl ||
                      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=720&q=80"
                    }
                    alt={reel.caption || "Reel"}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                )}
              </div>
            ) : (
              // Direct MP4 video stream (self-recorded & uploaded reels)
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: "100%",
                  backgroundColor: "#000000",
                }}
              >
                <video
                  ref={(el: HTMLVideoElement | null) => {
                    videoElemRef.current = el;
                    if (el) {
                      el.muted = isMuted;
                    }
                  }}
                  poster={reel.thumbnailUrl}
                  autoPlay={isActive}
                  loop
                  playsInline
                  muted={isMuted}
                  controls={false}
                  preload={isActive ? "auto" : "metadata"}
                  crossOrigin="anonymous"
                  onWaiting={() => {
                    if (isActive) startStallGraceTimer();
                  }}
                  onPlaying={() => {
                    setIsPlaying(true);
                    clearStallGraceTimer();
                  }}
                  onCanPlay={() => clearStallGraceTimer()}
                  onLoadedData={() => clearStallGraceTimer()}
                  onPlay={() => {
                    setIsPlaying(true);
                    clearStallGraceTimer();
                  }}
                  onPause={() => setIsPlaying(false)}
                  onError={() => clearStallGraceTimer()}
                  onClick={(e: React.MouseEvent<HTMLVideoElement>) => {
                    e.stopPropagation();
                    const el = e.currentTarget;
                    if (el.paused) {
                      el.muted = isMuted;
                      el.play()
                        .then(() => {
                          setIsPlaying(true);
                          clearStallGraceTimer();
                          showIndicator("play");
                        })
                        .catch(() => {
                          el.muted = true;
                          el.play()
                            .then(() => {
                              setIsPlaying(true);
                              clearStallGraceTimer();
                              showIndicator("play");
                            })
                            .catch(() => {});
                        });
                    } else {
                      el.pause();
                      setIsPlaying(false);
                      showIndicator("pause");
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
              </div>
            )}
          </div>
        ) : NativeWebView ? (
          <View style={StyleSheet.absoluteFill}>
            <NativeWebView
              key={`native-reel-${reel.id}-${isMuted ? "muted" : "unmuted"}-${isActive ? "1" : "0"}`}
              source={
                videoType === "youtube" && youtubeId
                  ? {
                      html: `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"/><meta name="referrer" content="strict-origin-when-cross-origin"/><style>*{margin:0;padding:0;box-sizing:border-box;}html,body{width:100%;height:100%;background:#000000;overflow:hidden;}iframe{width:100%;height:100%;border:none;display:block;}</style></head><body><iframe src="https://www.youtube.com/embed/${youtubeId}?autoplay=${isActive ? 1 : 0}&mute=${isMuted ? 1 : 0}&loop=1&playlist=${youtubeId}&controls=1&playsinline=1&modestbranding=1&rel=0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></body></html>`,
                      baseUrl: "https://www.youtube.com",
                    }
                  : videoType === "facebook"
                    ? {
                        html: `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"/><meta name="referrer" content="strict-origin-when-cross-origin"/><style>*{margin:0;padding:0;box-sizing:border-box;}html,body{width:100%;height:100%;background:#000000;overflow:hidden;display:flex;align-items:center;justify-content:center;}iframe{width:100%;height:100%;border:none;}</style></head><body><iframe src="https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(normalizeFacebookUrl(reel.videoUrl) || reel.videoUrl)}&show_text=false&width=380&t=0&autoplay=${isActive ? "true" : "false"}&mute=${isMuted ? "1" : "0"}" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" allowfullscreen scrolling="no"></iframe></body></html>`,
                        baseUrl: "https://www.facebook.com",
                      }
                    : {
                        html: `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"/><style>*{margin:0;padding:0;box-sizing:border-box;}html,body{width:100%;height:100%;background:#000000;overflow:hidden;}video{width:100%;height:100%;object-fit:cover;display:block;}</style></head><body><video id="v" src="${reel.videoUrl}" poster="${reel.thumbnailUrl || ""}" playsinline webkit-playsinline loop autoplay ${isMuted ? "muted" : ""}></video><script>const v=document.getElementById('v');if(${isActive}){const p=v.play();if(p!==undefined){p.catch(function(){v.muted=true;v.play();});}}else{v.pause();}document.body.addEventListener('click',function(){if(v.paused){v.play();}else{v.pause();}});</script></body></html>`,
                      }
              }
              style={styles.nativeWebView}
              allowsInlineMediaPlayback={true}
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              allowsFullscreenVideo={true}
              scrollEnabled={false}
              bounces={false}
              originWhitelist={["*"]}
              onLoadStart={() => {
                if (isActive) startStallGraceTimer();
              }}
              onLoadEnd={() => {
                clearStallGraceTimer();
              }}
              onError={() => {
                clearStallGraceTimer();
              }}
            />
          </View>
        ) : (
          <View style={styles.nativeVideoPlaceholder}>
            {reel.thumbnailUrl ? (
              <Image
                source={{ uri: reel.thumbnailUrl }}
                style={styles.nativeThumbnail}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.fallbackBlackCanvas} />
            )}
          </View>
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

        {/* Centered Circular Progress Loading Indicator */}
        {isActive && isLoading && (
          <View style={styles.loadingSpinnerContainer} pointerEvents="none">
            <View style={styles.loadingSpinnerCircle}>
              <ActivityIndicator size="large" color="#FFFFFF" />
            </View>
          </View>
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
            <TouchableOpacity
              onPress={() => Linking.openURL(reel.videoUrl).catch(() => {})}
              activeOpacity={0.8}
              style={[
                styles.platformBadge,
                { backgroundColor: "rgba(220, 38, 38, 0.85)" },
              ]}
            >
              <Ionicons name="logo-youtube" size={13} color="#FFFFFF" />
              <Text style={styles.platformBadgeText}>YouTube Short</Text>
              <Feather
                name="external-link"
                size={11}
                color="#FFFFFF"
                style={{ marginLeft: 3 }}
              />
            </TouchableOpacity>
          ) : videoType === "facebook" ? (
            <TouchableOpacity
              onPress={() =>
                Linking.openURL(
                  normalizeFacebookUrl(reel.videoUrl) || reel.videoUrl,
                ).catch(() => {})
              }
              activeOpacity={0.8}
              style={[
                styles.platformBadge,
                { backgroundColor: "rgba(24, 119, 242, 0.85)" },
              ]}
            >
              <Ionicons name="logo-facebook" size={13} color="#FFFFFF" />
              <Text style={styles.platformBadgeText}>Facebook Reel</Text>
              <Feather
                name="external-link"
                size={11}
                color="#FFFFFF"
                style={{ marginLeft: 3 }}
              />
            </TouchableOpacity>
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

        {/* Views Count Badge */}
        <View style={styles.railActionBtn}>
          <Ionicons name="eye-outline" size={25} color="#FFFFFF" />
          <Text style={styles.railActionText}>
            {formatViewCount(reel.viewsCount || 0)}
          </Text>
        </View>

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
        {/* Quick Launch Pill for Facebook Reels and YouTube Shorts */}
        {videoType === "facebook" ? (
          <TouchableOpacity
            onPress={() =>
              Linking.openURL(
                normalizeFacebookUrl(reel.videoUrl) || reel.videoUrl,
              ).catch(() => {})
            }
            style={styles.openExternalPill}
            activeOpacity={0.8}
          >
            <Ionicons name="logo-facebook" size={14} color="#FFFFFF" />
            <Text style={styles.openExternalPillText}>Watch on Facebook</Text>
            <Feather name="arrow-up-right" size={13} color="#FFFFFF" />
          </TouchableOpacity>
        ) : videoType === "youtube" ? (
          <TouchableOpacity
            onPress={() => Linking.openURL(reel.videoUrl).catch(() => {})}
            style={[
              styles.openExternalPill,
              { backgroundColor: "rgba(220, 38, 38, 0.9)" },
            ]}
            activeOpacity={0.8}
          >
            <Ionicons name="logo-youtube" size={14} color="#FFFFFF" />
            <Text style={styles.openExternalPillText}>Watch on YouTube</Text>
            <Feather name="arrow-up-right" size={13} color="#FFFFFF" />
          </TouchableOpacity>
        ) : null}

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
  nativeWebView: {
    flex: 1,
    backgroundColor: "#000000",
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
  loadingSpinnerContainer: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -32,
    marginTop: -32,
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 15,
  },
  loadingSpinnerCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.25)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
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
  openExternalPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    backgroundColor: "rgba(24, 119, 242, 0.92)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 2,
  },
  openExternalPillText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
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

export const SplitzyReelItem = memo(
  SplitzyReelItemComponent,
  (prevProps, nextProps) => {
    return (
      prevProps.reel.id === nextProps.reel.id &&
      prevProps.isActive === nextProps.isActive &&
      prevProps.isMuted === nextProps.isMuted &&
      prevProps.itemHeight === nextProps.itemHeight &&
      prevProps.currentUserId === nextProps.currentUserId &&
      (prevProps.reel.likes || []).length ===
        (nextProps.reel.likes || []).length &&
      (prevProps.reel.viewsCount || 0) === (nextProps.reel.viewsCount || 0) &&
      (prevProps.reel.commentsCount || 0) ===
        (nextProps.reel.commentsCount || 0)
    );
  },
);
