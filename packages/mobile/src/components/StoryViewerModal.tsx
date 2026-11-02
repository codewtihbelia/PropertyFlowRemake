import React, { useState, useEffect, useRef, useMemo } from "react";
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
  Alert,
  ScrollView,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../firebase/config";
import {
  communityService,
  CommunityStory,
  StoryViewerInfo,
  calculateStoryTimeRemaining,
} from "../services/communityService";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface StoryViewerModalProps {
  visible: boolean;
  stories: CommunityStory[];
  initialIndex?: number;
  currentUser?: {
    uid?: string;
    name?: string;
    displayName?: string;
    photoURL?: string;
    profilePicture?: string;
    email?: string;
  };
  currentUserId?: string;
  onClose: () => void;
  onLikeStory?: (story: CommunityStory) => void;
  onEditStory?: (story: CommunityStory) => void;
  onDeleteStory?: (story: CommunityStory) => void;
  onOpenDirectChat?: (
    targetUserId: string,
    targetUserName: string,
    targetUserAvatar?: string,
  ) => void;
}

const REACTION_EMOJIS = ["❤️", "👍", "🔥", "😂", "👏"];

export const StoryViewerModal: React.FC<StoryViewerModalProps> = ({
  visible,
  stories,
  initialIndex = 0,
  currentUser,
  currentUserId,
  onClose,
  onLikeStory,
  onEditStory,
  onDeleteStory,
  onOpenDirectChat,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [replyText, setReplyText] = useState("");
  const [reactionSent, setReactionSent] = useState<string | null>(null);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showViewersModal, setShowViewersModal] = useState(false);

  const progressAnim = useRef(new Animated.Value(0)).current;

  const resolvedUserId = currentUserId || currentUser?.uid;

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex, visible]);

  // Pause progress timer whenever options menu or viewers list is open
  const isPaused = showActionMenu || showViewersModal;

  useEffect(() => {
    if (!visible || stories.length === 0 || isPaused) return;

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
  }, [visible, currentIndex, stories.length, isPaused]);

  const currentStory = stories[currentIndex] || stories[0] || null;

  // Enriched viewer profiles resolved from Firestore users collection
  const [enrichedProfiles, setEnrichedProfiles] = useState<
    Record<string, { name: string; avatar?: string }>
  >({});

  // Record this member viewing the story automatically
  useEffect(() => {
    if (!visible || !currentStory?.id || !resolvedUserId) return;
    const authorName =
      currentUser?.displayName ||
      currentUser?.name ||
      auth.currentUser?.displayName ||
      undefined;
    const authorAvatar =
      currentUser?.photoURL ||
      currentUser?.profilePicture ||
      auth.currentUser?.photoURL ||
      undefined;
    const authorEmail =
      currentUser?.email || auth.currentUser?.email || undefined;

    communityService.recordStoryView(currentStory.id, {
      uid: resolvedUserId,
      name: authorName,
      avatar: authorAvatar,
      email: authorEmail,
    });
  }, [visible, currentStory?.id, resolvedUserId, currentUser]);

  // Parse rich viewer details (with fallback for legacy view UIDs)
  // MUST be called unconditionally before early return to obey React Rules of Hooks
  const displayViewers: StoryViewerInfo[] = useMemo(() => {
    if (!currentStory) return [];
    const list: StoryViewerInfo[] = [];
    const seenUids = new Set<string>();

    if (Array.isArray(currentStory.viewerDetails)) {
      for (const vd of currentStory.viewerDetails) {
        if (vd.uid && !seenUids.has(vd.uid)) {
          seenUids.add(vd.uid);
          list.push(vd);
        }
      }
    }

    if (Array.isArray(currentStory.views)) {
      for (const uid of currentStory.views) {
        if (!seenUids.has(uid)) {
          seenUids.add(uid);
          list.push({
            uid,
            name: uid === resolvedUserId ? "You" : "Community Member",
            viewedAt: currentStory.createdAt,
          });
        }
      }
    }

    return list;
  }, [currentStory, resolvedUserId]);

  // Asynchronously resolve real identity and avatar from Firestore users collection for any viewers with placeholder/generic names
  useEffect(() => {
    if (!visible || !showViewersModal || !currentStory) return;

    const uidsToResolve = displayViewers
      .filter((v) => {
        const cached = enrichedProfiles[v.uid];
        if (cached) return false;
        return (
          !v.name ||
          v.name === "Splitzy Member" ||
          v.name === "Community Member" ||
          v.name === "You" ||
          !v.avatar
        );
      })
      .map((v) => v.uid);

    if (uidsToResolve.length === 0) return;

    let isMounted = true;
    (async () => {
      const updates: Record<string, { name: string; avatar?: string }> = {};
      for (const rawId of uidsToResolve) {
        try {
          const cleanId = rawId.replace(/^mem_/, "").trim();
          const uSnap = await getDoc(doc(db, "users", cleanId));
          if (uSnap.exists()) {
            const data = uSnap.data();
            const realName =
              data.displayName ||
              data.fullName ||
              data.name ||
              (data.email ? data.email.split("@")[0] : "");
            const realAvatar =
              data.photoURL || data.profilePicture || data.avatar || "";
            if (realName || realAvatar) {
              updates[rawId] = {
                name: realName || "Splitzy Member",
                avatar: realAvatar,
              };
            }
          }
        } catch (e) {
          console.log("Error enriching viewer profile:", e);
        }
      }
      if (isMounted && Object.keys(updates).length > 0) {
        setEnrichedProfiles((prev) => ({ ...prev, ...updates }));
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [visible, showViewersModal, currentStory, displayViewers]);

  if (!visible || stories.length === 0 || !currentStory) return null;

  const isAuthor = Boolean(
    resolvedUserId &&
    (currentStory.authorId === resolvedUserId ||
      currentStory.authorId === `mem_${resolvedUserId}` ||
      `mem_${currentStory.authorId}` === resolvedUserId),
  );

  const remaining = calculateStoryTimeRemaining(currentStory);

  const viewersCount = Math.max(
    displayViewers.length,
    currentStory.views?.length || 0,
  );

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

  const formatTimeAgo = (isoString?: string) => {
    if (!isoString) return "Just now";
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "Just now";
    const diff = Math.max(0, Date.now() - date.getTime());
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(diff / 86400000);
    if (days === 1) return "Yesterday";
    return `${days}d ago`;
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
          <View
            style={[
              styles.backgroundImage,
              styles.textStoryBg,
              currentStory.backgroundColor
                ? { backgroundColor: currentStory.backgroundColor }
                : null,
            ]}
          >
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
                <View style={styles.timeRow}>
                  <Text style={styles.storyTime}>
                    {formatStoryTime(currentStory.createdAt)}
                  </Text>
                  <Text style={styles.timeDot}>·</Text>
                  <Text
                    style={[
                      styles.expiryText,
                      remaining.isExpired && styles.expiredText,
                    ]}
                  >
                    {remaining.label}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.headerRightActions}>
              {isAuthor && (
                <TouchableOpacity
                  onPress={() => setShowActionMenu(true)}
                  style={styles.moreBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Feather name="more-horizontal" size={22} color="#FFFFFF" />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Feather name="x" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
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

          {/* Bottom Bar: Viewed By (Owner) vs Reply & Reactions (Viewer) */}
          {isAuthor ? (
            <View style={styles.bottomBarContainer}>
              <TouchableOpacity
                onPress={() => setShowViewersModal(true)}
                style={styles.viewedByBar}
                activeOpacity={0.85}
              >
                <View style={styles.viewedByLeft}>
                  {/* Overlapping Viewer Avatars Cluster */}
                  <View style={styles.viewedByAvatarCluster}>
                    {displayViewers.slice(0, 3).map((v, vIdx) => (
                      <View
                        key={v.uid || vIdx}
                        style={[
                          styles.viewedByMiniAvatarCircle,
                          {
                            marginLeft: vIdx === 0 ? 0 : -10,
                            zIndex: 10 - vIdx,
                          },
                        ]}
                      >
                        {v.avatar ? (
                          <Image
                            source={{ uri: v.avatar }}
                            style={styles.viewedByMiniAvatarImg}
                          />
                        ) : (
                          <View style={styles.viewedByMiniAvatarPlaceholder}>
                            <Text style={styles.viewedByMiniAvatarInitial}>
                              {v.name.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>

                  <View style={styles.viewedByTextGroup}>
                    <View style={styles.viewedByTitleRow}>
                      <Ionicons name="eye" size={15} color="#FFFFFF" />
                      <Text style={styles.viewedByTitle}>
                        {viewersCount === 0
                          ? "No views yet"
                          : viewersCount === 1
                            ? "Viewed by 1 member"
                            : `Viewed by ${viewersCount} members`}
                      </Text>
                    </View>
                    <Text style={styles.viewedBySubtext}>
                      Tap to see member details
                    </Text>
                  </View>
                </View>

                <View style={styles.viewedByRight}>
                  <View style={styles.viewedByChevronBadge}>
                    <Feather name="chevron-up" size={16} color="#FFFFFF" />
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          ) : (
            /* Viewer View: Reply & Quick Reactions */
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
          )}
        </SafeAreaView>

        {/* Action Sheet Modal for Story Owner */}
        <Modal
          visible={showActionMenu}
          transparent
          animationType="fade"
          onRequestClose={() => setShowActionMenu(false)}
        >
          <TouchableOpacity
            style={styles.actionSheetBackdrop}
            activeOpacity={1}
            onPress={() => setShowActionMenu(false)}
          >
            <View style={styles.actionSheetContent}>
              <View style={styles.actionSheetHandle} />

              <View style={styles.actionSheetHeader}>
                <Text style={styles.actionSheetTitle}>Story Options</Text>
                <Text style={styles.actionSheetSubtitle}>
                  {remaining.isExpired
                    ? "Story Expired"
                    : `Active · ${remaining.label}`}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.actionSheetItem}
                onPress={() => {
                  setShowActionMenu(false);
                  onEditStory?.(currentStory);
                }}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.actionSheetIconWrap,
                    { backgroundColor: "#DBEAFE" },
                  ]}
                >
                  <Feather name="edit-2" size={18} color="#2563EB" />
                </View>
                <View style={styles.actionSheetItemTextWrap}>
                  <Text style={styles.actionSheetItemTitle}>Edit Story</Text>
                  <Text style={styles.actionSheetItemDesc}>
                    Update caption and background styling
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color="#94A3B8" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionSheetItem}
                onPress={() => {
                  setShowActionMenu(false);
                  Alert.alert(
                    "Delete Story?",
                    "Are you sure you want to delete this story? It will be removed permanently.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () => {
                          onDeleteStory?.(currentStory);
                        },
                      },
                    ],
                  );
                }}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.actionSheetIconWrap,
                    { backgroundColor: "#FEE2E2" },
                  ]}
                >
                  <Feather name="trash-2" size={18} color="#EF4444" />
                </View>
                <View style={styles.actionSheetItemTextWrap}>
                  <Text
                    style={[styles.actionSheetItemTitle, { color: "#EF4444" }]}
                  >
                    Delete Story
                  </Text>
                  <Text style={styles.actionSheetItemDesc}>
                    Permanently remove this story
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color="#94A3B8" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionSheetCancelBtn}
                onPress={() => setShowActionMenu(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.actionSheetCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Viewed By Full List Bottom Sheet Modal (Owner Only) */}
        <Modal
          visible={showViewersModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowViewersModal(false)}
        >
          <TouchableOpacity
            style={styles.viewersBackdrop}
            activeOpacity={1}
            onPress={() => setShowViewersModal(false)}
          >
            <View
              style={styles.viewersSheet}
              onStartShouldSetResponder={() => true}
            >
              <View style={styles.viewersHandle} />

              <View style={styles.viewersHeader}>
                <View style={styles.viewersTitleRow}>
                  <Ionicons name="eye" size={20} color="#2563EB" />
                  <Text style={styles.viewersTitle}>
                    Story Viewers ({viewersCount})
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowViewersModal(false)}
                  style={styles.viewersCloseBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="x" size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <Text style={styles.viewersSubtitle}>
                Community members who have viewed your story in the last 24
                hours
              </Text>

              <ScrollView
                style={styles.viewersList}
                contentContainerStyle={styles.viewersListContent}
              >
                {displayViewers.length === 0 ? (
                  <View style={styles.viewersEmpty}>
                    <Ionicons name="eye-outline" size={44} color="#64748B" />
                    <Text style={styles.viewersEmptyTitle}>No views yet</Text>
                    <Text style={styles.viewersEmptySub}>
                      As roommates and community members see your story, their
                      names and viewing timestamps will show up here.
                    </Text>
                  </View>
                ) : (
                  displayViewers.map((viewer, vIdx) => {
                    const isSelfViewer =
                      resolvedUserId &&
                      (viewer.uid === resolvedUserId ||
                        viewer.uid === `mem_${resolvedUserId}` ||
                        `mem_${viewer.uid}` === resolvedUserId);
                    const isLikedByViewer = Boolean(
                      currentStory.likes?.includes(viewer.uid) ||
                      currentStory.likes?.includes(`mem_${viewer.uid}`),
                    );

                    const enriched = enrichedProfiles[viewer.uid];
                    const rawName =
                      enriched?.name ||
                      (isSelfViewer
                        ? currentUser?.displayName ||
                          currentUser?.name ||
                          auth.currentUser?.displayName ||
                          viewer.name
                        : viewer.name);
                    const displayName =
                      rawName &&
                      rawName !== "Splitzy Member" &&
                      rawName !== "Community Member"
                        ? rawName
                        : isSelfViewer
                          ? "You"
                          : "Roommate";

                    const displayAvatar =
                      enriched?.avatar ||
                      (isSelfViewer
                        ? currentUser?.photoURL ||
                          currentUser?.profilePicture ||
                          auth.currentUser?.photoURL ||
                          viewer.avatar
                        : viewer.avatar);

                    return (
                      <View key={viewer.uid || vIdx} style={styles.viewerRow}>
                        {/* Avatar */}
                        <View style={styles.viewerAvatarWrap}>
                          {displayAvatar ? (
                            <Image
                              source={{ uri: displayAvatar }}
                              style={styles.viewerAvatarImg}
                            />
                          ) : (
                            <View style={styles.viewerAvatarPlaceholder}>
                              <Text style={styles.viewerAvatarInitial}>
                                {(displayName || "U").charAt(0).toUpperCase()}
                              </Text>
                            </View>
                          )}
                          {isLikedByViewer && (
                            <View style={styles.viewerHeartBadge}>
                              <Ionicons
                                name="heart"
                                size={10}
                                color="#FFFFFF"
                              />
                            </View>
                          )}
                        </View>

                        {/* Viewer Info */}
                        <View style={styles.viewerInfo}>
                          <View style={styles.viewerNameRow}>
                            <Text style={styles.viewerName} numberOfLines={1}>
                              {isSelfViewer
                                ? `${displayName} (You)`
                                : displayName}
                            </Text>
                            {isLikedByViewer && (
                              <Text style={styles.viewerLikedTag}>Liked</Text>
                            )}
                          </View>
                          <Text style={styles.viewedTime}>
                            {viewer.viewedAt
                              ? `Viewed ${formatTimeAgo(viewer.viewedAt)}`
                              : "Seen"}
                          </Text>
                        </View>

                        {/* Quick Message Button (if not self) */}
                        {!isSelfViewer && onOpenDirectChat ? (
                          <TouchableOpacity
                            onPress={() => {
                              setShowViewersModal(false);
                              onClose();
                              onOpenDirectChat(
                                viewer.uid,
                                displayName,
                                displayAvatar,
                              );
                            }}
                            style={styles.viewerChatBtn}
                            activeOpacity={0.8}
                          >
                            <Ionicons
                              name="chatbubble-ellipses"
                              size={14}
                              color="#2563EB"
                            />
                            <Text style={styles.viewerChatBtnText}>Chat</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    );
                  })
                )}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
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
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  storyTime: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 11,
    fontWeight: "500",
  },
  timeDot: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
  },
  expiryText: {
    color: "#93C5FD",
    fontSize: 11,
    fontWeight: "600",
  },
  expiredText: {
    color: "#FCA5A5",
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  moreBtn: {
    padding: 6,
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
  /* Viewed By Bar for Story Owner */
  viewedByBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  viewedByLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  viewedByAvatarCluster: {
    flexDirection: "row",
    alignItems: "center",
  },
  viewedByMiniAvatarCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    overflow: "hidden",
    backgroundColor: "#2563EB",
  },
  viewedByMiniAvatarImg: {
    width: "100%",
    height: "100%",
  },
  viewedByMiniAvatarPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  viewedByMiniAvatarInitial: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  viewedByTextGroup: {
    justifyContent: "center",
  },
  viewedByTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  viewedByTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  viewedBySubtext: {
    color: "rgba(255, 255, 255, 0.65)",
    fontSize: 11,
    marginTop: 1,
  },
  viewedByRight: {
    alignItems: "center",
    justifyContent: "center",
  },
  viewedByChevronBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  /* Viewer View: Reply & Reaction styles */
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
  /* Action Sheet Modal */
  actionSheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  actionSheetContent: {
    backgroundColor: "#1E293B",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderColor: "#334155",
  },
  actionSheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: "#475569",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 14,
  },
  actionSheetHeader: {
    marginBottom: 16,
    alignItems: "center",
  },
  actionSheetTitle: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "700",
  },
  actionSheetSubtitle: {
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 2,
  },
  actionSheetItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "#0F172A",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#334155",
  },
  actionSheetIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  actionSheetItemTextWrap: {
    flex: 1,
  },
  actionSheetItemTitle: {
    color: "#F8FAFC",
    fontSize: 14,
    fontWeight: "600",
  },
  actionSheetItemDesc: {
    color: "#94A3B8",
    fontSize: 11,
    marginTop: 2,
  },
  actionSheetCancelBtn: {
    marginTop: 6,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "#334155",
  },
  actionSheetCancelText: {
    color: "#F8FAFC",
    fontSize: 14,
    fontWeight: "600",
  },
  /* Viewed By Full List Bottom Sheet */
  viewersBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  viewersSheet: {
    backgroundColor: "#1E293B",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderColor: "#334155",
    maxHeight: SCREEN_HEIGHT * 0.72,
  },
  viewersHandle: {
    width: 36,
    height: 4,
    backgroundColor: "#475569",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  viewersHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  viewersTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  viewersTitle: {
    color: "#F8FAFC",
    fontSize: 17,
    fontWeight: "700",
  },
  viewersCloseBtn: {
    padding: 6,
  },
  viewersSubtitle: {
    color: "#94A3B8",
    fontSize: 12,
    marginBottom: 16,
  },
  viewersList: {
    flexGrow: 0,
  },
  viewersListContent: {
    paddingBottom: 20,
  },
  viewersEmpty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  viewersEmptyTitle: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 4,
  },
  viewersEmptySub: {
    color: "#94A3B8",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  viewerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  viewerAvatarWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    position: "relative",
    marginRight: 12,
  },
  viewerAvatarImg: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  viewerAvatarPlaceholder: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  viewerAvatarInitial: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  viewerHeartBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#1E293B",
  },
  viewerInfo: {
    flex: 1,
  },
  viewerNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  viewerName: {
    color: "#F8FAFC",
    fontSize: 14,
    fontWeight: "600",
  },
  viewerLikedTag: {
    color: "#F87171",
    fontSize: 11,
    fontWeight: "600",
  },
  viewedTime: {
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 2,
  },
  viewerChatBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#334155",
  },
  viewerChatBtnText: {
    color: "#93C5FD",
    fontSize: 12,
    fontWeight: "600",
  },
});
