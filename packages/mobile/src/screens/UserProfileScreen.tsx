import React, { useState, useMemo, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  Share,
  Platform,
  StatusBar,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import {
  CommunityPost,
  CommunityMember,
  ReactionType,
  CATEGORY_LABELS,
  formatAuthorDisplayName,
  FB_6_REACTIONS,
  communityService,
} from "../services/communityService";
import { auth } from "../firebase/config";
import { FullScreenImageViewerModal } from "../components/FullScreenImageViewerModal";

export interface UserProfileInfo {
  uid: string;
  name: string;
  email?: string;
  avatar?: string;
  coverImage?: string;
  role?: string;
  householdName?: string;
  bio?: string;
  location?: string;
  joinedDate?: string;
  mutualFriendsCount?: number;
  friendsCount?: number;
  friendshipStatus?: "none" | "pending_sent" | "pending_received" | "friends";
  friendshipId?: string;
}

export interface UserProfileScreenProps {
  user: UserProfileInfo;
  onBack: () => void;
  currentUser?: {
    uid?: string;
    name?: string;
    email?: string;
    avatar?: string;
  };
  posts?: CommunityPost[];
  onSendFriendRequest?: (user: UserProfileInfo) => Promise<void>;
  onAcceptFriendRequest?: (friendshipId: string) => Promise<void>;
  onDeclineOrCancelRequest?: (friendshipId: string) => Promise<void>;
  onToggleLikePost?: (post: CommunityPost) => Promise<void>;
  onSelectReaction?: (
    post: CommunityPost,
    reaction: ReactionType,
  ) => Promise<void>;
  onOpenComments?: (post: CommunityPost) => void;
  onOpenUserProfile?: (user: UserProfileInfo) => void;
  onOpenDirectChat?: (
    targetUserId: string,
    targetUserName: string,
    targetUserAvatar?: string,
  ) => void;
  onNavigateToSplitzyProfile?: () => void;
}

export const UserProfileScreen: React.FC<UserProfileScreenProps> = ({
  user,
  onBack,
  currentUser,
  posts = [],
  onSendFriendRequest,
  onAcceptFriendRequest,
  onDeclineOrCancelRequest,
  onToggleLikePost,
  onSelectReaction,
  onOpenComments,
  onOpenUserProfile,
  onOpenDirectChat,
  onNavigateToSplitzyProfile,
}) => {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();

  const [activeTab, setActiveTab] = useState<"posts" | "about" | "friends">(
    "posts",
  );
  const [activeReactionPostId, setActiveReactionPostId] = useState<
    string | null
  >(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Real-time Cloud-synced user data states
  const [realUserPosts, setRealUserPosts] = useState<CommunityPost[]>([]);
  const [userFriends, setUserFriends] = useState<CommunityMember[]>([]);
  const [myFriends, setMyFriends] = useState<CommunityMember[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);

  const currentUid = currentUser?.uid || auth.currentUser?.uid || "";
  const cleanCurUid = String(currentUid).replace(/^mem_/, "").trim();
  const cleanTargetUid = String(user.uid || "")
    .replace(/^mem_/, "")
    .trim();
  const isSelf = cleanCurUid === cleanTargetUid;
  const cleanName = formatAuthorDisplayName(user.name, user.email);
  const coverUrl =
    user.coverImage ||
    "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80";

  const [imageViewerConfig, setImageViewerConfig] = useState<{
    visible: boolean;
    images: string[];
    initialIndex: number;
    authorName?: string;
    caption?: string;
  }>({
    visible: false,
    images: [],
    initialIndex: 0,
  });

  // Subscribe to real cloud posts authored by this specific user
  useEffect(() => {
    if (!user?.uid) return;
    const unsubPosts = communityService.subscribeUserPosts(
      user.uid,
      (cloudPosts) => {
        setRealUserPosts(cloudPosts);
      },
    );
    return () => unsubPosts();
  }, [user?.uid]);

  // Subscribe to real accepted friends for this user from Firestore
  useEffect(() => {
    if (!user?.uid) return;
    setLoadingFriends(true);
    const unsubFriends = communityService.subscribeUserAcceptedFriends(
      user.uid,
      (friends) => {
        setUserFriends(friends);
        setLoadingFriends(false);
      },
    );
    return () => unsubFriends();
  }, [user?.uid]);

  // Subscribe to current user's accepted friends to calculate real mutual friends
  useEffect(() => {
    if (!currentUid) return;
    const unsubMyFriends = communityService.subscribeUserAcceptedFriends(
      currentUid,
      (friends) => {
        setMyFriends(friends);
      },
    );
    return () => unsubMyFriends();
  }, [currentUid]);

  // Compute 100% real mutual friends between viewer and target user with clean normalized UIDs & deduplication
  const mutualFriends = useMemo(() => {
    if (isSelf || !userFriends.length || !myFriends.length) return [];
    const myFriendUids = new Set(
      myFriends.map((f) =>
        String(f.uid || "")
          .replace(/^mem_/, "")
          .trim(),
      ),
    );
    const seen = new Set<string>();
    const result: CommunityMember[] = [];
    for (const f of userFriends) {
      const cleanUid = String(f.uid || "")
        .replace(/^mem_/, "")
        .trim();
      if (!cleanUid || cleanUid === cleanCurUid || seen.has(cleanUid)) continue;
      seen.add(cleanUid);
      if (myFriendUids.has(cleanUid)) {
        result.push(f);
      }
    }
    return result;
  }, [isSelf, userFriends, myFriends, cleanCurUid]);

  // Combine real subscribed posts with feed posts authored by this user
  const userPosts = useMemo(() => {
    if (realUserPosts.length > 0) return realUserPosts;
    if (!user) return [];
    return posts.filter(
      (p) =>
        p.authorId === user.uid ||
        (user.name && p.authorName.toLowerCase() === user.name.toLowerCase()),
    );
  }, [realUserPosts, posts, user]);

  const handlePrimaryFriendAction = async () => {
    if (isSelf || isProcessingAction) return;
    setIsProcessingAction(true);
    try {
      if (user.friendshipStatus === "pending_received" && user.friendshipId) {
        if (onAcceptFriendRequest) {
          await onAcceptFriendRequest(user.friendshipId);
        }
      } else if (
        user.friendshipStatus === "pending_sent" &&
        user.friendshipId
      ) {
        if (onDeclineOrCancelRequest) {
          await onDeclineOrCancelRequest(user.friendshipId);
        }
      } else if (user.friendshipStatus === "friends" && user.friendshipId) {
        Alert.alert(
          "Unfriend",
          `Are you sure you want to remove ${cleanName} from your friends?`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Remove Friend",
              style: "destructive",
              onPress: async () => {
                if (user.friendshipId && onDeclineOrCancelRequest) {
                  await onDeclineOrCancelRequest(user.friendshipId);
                }
              },
            },
          ],
        );
      } else {
        if (onSendFriendRequest) {
          await onSendFriendRequest(user);
        }
      }
    } catch (err: any) {
      Alert.alert(
        "Action Failed",
        err?.message || "Could not complete request.",
      );
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleMessageUser = () => {
    if (onOpenDirectChat) {
      onOpenDirectChat(user.uid, cleanName, user.avatar);
      return;
    }
    Alert.alert(
      "Direct Message",
      `Send a message to ${cleanName} in Splitzy Messages?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Open Messages",
          onPress: () => {
            onBack();
          },
        },
      ],
    );
  };

  const handleShareProfile = async () => {
    try {
      await Share.share({
        message: `Connect with ${cleanName} on Splitzy Community! Split expenses and share roommate moments.`,
      });
    } catch {
      // ignore
    }
  };

  const formatTimeAgo = (isoString?: string) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "";
    const now = Date.now();
    const diff = Math.max(0, now - date.getTime());
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(diff / 86400000);
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;

    const currentYear = new Date().getFullYear();
    const postYear = date.getFullYear();
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const month = monthNames[date.getMonth()];
    const day = date.getDate();
    if (postYear === currentYear) {
      return `${month} ${day}`;
    }
    return `${month} ${day}, ${postYear}`;
  };

  const renderPostCard = (post: CommunityPost) => {
    const isLiked = currentUid ? post.likes.includes(currentUid) : false;
    const catConf = CATEGORY_LABELS[post.category] || CATEGORY_LABELS.general;
    const userReaction = currentUid ? post.reactions?.[currentUid] : undefined;
    const isLikedOrReacted = !!(isLiked || userReaction);

    const getReactionDisplay = () => {
      if (userReaction === "love")
        return { label: "Love", color: "#EF4444", emoji: "❤️" };
      if (userReaction === "haha")
        return { label: "Haha", color: "#F59E0B", emoji: "😆" };
      if (userReaction === "wow")
        return { label: "Wow", color: "#F59E0B", emoji: "😮" };
      if (userReaction === "sad")
        return { label: "Sad", color: "#3B82F6", emoji: "😢" };
      if (userReaction === "angry")
        return { label: "Angry", color: "#EA580C", emoji: "😡" };
      if (isLiked || userReaction === "like")
        return { label: "Like", color: "#2563EB", emoji: "👍" };
      return {
        label: "Like",
        color: isDark ? "#94A3B8" : "#64748B",
        emoji: "",
      };
    };

    const reactionInfo = getReactionDisplay();

    const topInset = Math.max(
      Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0,
      insets.top,
      24,
    );

    return (
      <View
        key={post.id}
        style={[
          styles.fbPostCard,
          {
            backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
            borderColor: isDark ? "#334155" : "#E2E8F0",
          },
        ]}
      >
        <StatusBar
          barStyle={isDark ? "light-content" : "dark-content"}
          translucent
          backgroundColor="#FFFFFF"
        />

        {/* Post Header */}
        <View style={styles.fbPostHeader}>
          {post.authorAvatar ? (
            <Image
              source={{ uri: post.authorAvatar }}
              style={styles.fbPostAvatar}
            />
          ) : (
            <View
              style={[
                styles.fbPostAvatarPlaceholder,
                { backgroundColor: isDark ? "#334155" : "#DBEAFE" },
              ]}
            >
              <Text
                style={{
                  color: isDark ? "#94A3B8" : "#1D4ED8",
                  fontWeight: "700",
                }}
              >
                {cleanName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          <View style={styles.fbPostAuthorInfo}>
            <Text
              style={[
                styles.fbAuthorName,
                { color: isDark ? "#F8FAFC" : "#0F172A" },
              ]}
            >
              {cleanName}
            </Text>
            <View style={styles.fbPostMetaRow}>
              <Text
                style={[
                  styles.fbTimeText,
                  { color: isDark ? "#94A3B8" : "#64748B" },
                ]}
              >
                {formatTimeAgo(post.createdAt)}
              </Text>
              <Text style={styles.fbMetaDot}>•</Text>
              <View
                style={[
                  styles.categoryBadge,
                  { backgroundColor: `${catConf.color}20` },
                ]}
              >
                <Text
                  style={[styles.categoryBadgeText, { color: catConf.color }]}
                >
                  {catConf.label}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Post Text */}
        <Text
          style={[
            styles.fbPostContent,
            { color: isDark ? "#F8FAFC" : "#0F172A" },
          ]}
        >
          {post.content}
        </Text>

        {/* Post Images (tap to view full screen) */}
        {post.images && post.images.length > 0 && (
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() =>
              setImageViewerConfig({
                visible: true,
                images: post.images,
                initialIndex: 0,
                authorName: cleanName,
                caption: post.content,
              })
            }
          >
            <Image
              source={{ uri: post.images[0] }}
              style={styles.fbPostImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
        )}

        {/* Social Stats */}
        <View
          style={[
            styles.fbPostStats,
            { borderBottomColor: isDark ? "#334155" : "#F1F5F9" },
          ]}
        >
          <View style={styles.fbReactionGroup}>
            <View style={styles.miniLikeIcon}>
              <Ionicons name="thumbs-up" size={10} color="#FFFFFF" />
            </View>
            <Text
              style={[
                styles.fbStatsText,
                { color: isDark ? "#94A3B8" : "#64748B" },
              ]}
            >
              {post.likes.length || 1}
            </Text>
          </View>

          <Text
            style={[
              styles.fbStatsText,
              { color: isDark ? "#94A3B8" : "#64748B" },
            ]}
          >
            {post.commentsCount || 0} comments • {post.sharesCount || 0} shares
          </Text>
        </View>

        {/* Floating Reactions Dock */}
        {activeReactionPostId === post.id && (
          <View
            style={[
              styles.reactionDock,
              {
                backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
                borderColor: isDark ? "#334155" : "#E2E8F0",
              },
            ]}
          >
            {FB_6_REACTIONS.map((r) => (
              <TouchableOpacity
                key={r.type}
                onPress={() => {
                  onSelectReaction?.(post, r.type);
                  setActiveReactionPostId(null);
                }}
                style={styles.reactionDockItem}
              >
                <Text style={styles.reactionDockEmoji}>{r.emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Post Action Buttons */}
        <View style={styles.fbActionBar}>
          <TouchableOpacity
            onPress={() => onToggleLikePost?.(post)}
            onLongPress={() =>
              setActiveReactionPostId(
                activeReactionPostId === post.id ? null : post.id,
              )
            }
            delayLongPress={250}
            style={styles.fbActionBtn}
          >
            {reactionInfo.emoji ? (
              <Text style={{ fontSize: 16, marginRight: 5 }}>
                {reactionInfo.emoji}
              </Text>
            ) : (
              <Ionicons
                name={isLikedOrReacted ? "thumbs-up" : "thumbs-up-outline"}
                size={18}
                color={reactionInfo.color}
              />
            )}
            <Text
              style={[styles.fbActionBtnText, { color: reactionInfo.color }]}
            >
              {reactionInfo.label}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => onOpenComments?.(post)}
            style={styles.fbActionBtn}
          >
            <Ionicons
              name="chatbubble-outline"
              size={17}
              color={isDark ? "#94A3B8" : "#64748B"}
            />
            <Text
              style={[
                styles.fbActionBtnText,
                { color: isDark ? "#94A3B8" : "#64748B" },
              ]}
            >
              Comment
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={async () => {
              try {
                await Share.share({ message: post.content });
              } catch {
                // ignore
              }
            }}
            style={styles.fbActionBtn}
          >
            <Ionicons
              name="share-social-outline"
              size={18}
              color={isDark ? "#94A3B8" : "#64748B"}
            />
            <Text
              style={[
                styles.fbActionBtnText,
                { color: isDark ? "#94A3B8" : "#64748B" },
              ]}
            >
              Share
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? "#0F172A" : "#F8FAFC" },
      ]}
    >
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Standalone Top Navigation Header */}
      <View
        style={[
          styles.topNavBar,
          {
            paddingTop: Math.max(
              insets.top,
              Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 12,
            ),
            backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
            borderBottomColor: isDark ? "#334155" : "#E2E8F0",
          },
        ]}
      >
        <TouchableOpacity
          onPress={onBack}
          style={styles.navBackBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={isDark ? "#F8FAFC" : "#0F172A"}
          />
        </TouchableOpacity>

        <Text
          style={[styles.navTitle, { color: isDark ? "#F8FAFC" : "#0F172A" }]}
          numberOfLines={1}
        >
          {cleanName}
        </Text>

        <View style={styles.navRightIcons}>
          {isSelf && onNavigateToSplitzyProfile && (
            <TouchableOpacity
              onPress={onNavigateToSplitzyProfile}
              style={styles.navIconBtn}
              accessibilityLabel="Splitzy Account & Household Settings"
            >
              <Ionicons
                name="settings-outline"
                size={20}
                color={isDark ? "#F8FAFC" : "#0F172A"}
              />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={handleShareProfile}
            style={styles.navIconBtn}
          >
            <Ionicons
              name="share-outline"
              size={20}
              color={isDark ? "#F8FAFC" : "#0F172A"}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              Alert.alert("Profile Options", `Options for ${cleanName}`, [
                { text: "Share Profile", onPress: handleShareProfile },
                {
                  text: "Copy Profile Link",
                  onPress: () =>
                    Alert.alert("Copied", "Profile link copied to clipboard"),
                },
                { text: "Cancel", style: "cancel" },
              ]);
            }}
            style={styles.navIconBtn}
          >
            <Ionicons
              name="ellipsis-horizontal"
              size={20}
              color={isDark ? "#F8FAFC" : "#0F172A"}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Scrollable Profile Content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Cover Photo and Profile Picture Header */}
        <View style={styles.headerArea}>
          <Image
            source={{ uri: coverUrl }}
            style={styles.coverImage}
            resizeMode="cover"
          />

          {/* Profile Avatar overlapping cover photo */}
          <View style={styles.avatarWrap}>
            {user.avatar ? (
              <Image
                source={{ uri: user.avatar }}
                style={[
                  styles.avatarImage,
                  { borderColor: isDark ? "#1E293B" : "#FFFFFF" },
                ]}
              />
            ) : (
              <View
                style={[
                  styles.avatarPlaceholder,
                  {
                    borderColor: isDark ? "#1E293B" : "#FFFFFF",
                    backgroundColor: isDark ? "#334155" : "#DBEAFE",
                  },
                ]}
              >
                <Text style={styles.avatarInitials}>
                  {cleanName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}

            {/* Online Green Indicator Dot */}
            <View
              style={[
                styles.onlineDot,
                { borderColor: isDark ? "#1E293B" : "#FFFFFF" },
              ]}
            />
          </View>
        </View>

        {/* Profile Identity Details Card */}
        <View
          style={[
            styles.identityCard,
            {
              backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
              borderBottomColor: isDark ? "#334155" : "#E2E8F0",
            },
          ]}
        >
          <View style={styles.nameRow}>
            <Text
              style={[
                styles.profileName,
                { color: isDark ? "#F8FAFC" : "#0F172A" },
              ]}
            >
              {cleanName}
            </Text>
            <Ionicons
              name="checkmark-circle"
              size={20}
              color="#2563EB"
              style={{ marginLeft: 6, marginTop: 4 }}
            />
          </View>

          {/* Role / Household subtitle */}
          <Text
            style={[
              styles.profileSubtitle,
              { color: isDark ? "#94A3B8" : "#64748B" },
            ]}
          >
            {user.householdName
              ? `Member of ${user.householdName}`
              : user.role || "Splitzy Resident Member"}
          </Text>

          {/* Bio */}
          <Text
            style={[
              styles.profileBio,
              { color: isDark ? "#CBD5E1" : "#334155" },
            ]}
          >
            {user.bio ||
              "Splitting bills, sharing space, and creating memories with great roommates! 🏡✨"}
          </Text>

          {/* Quick Stats Row (Friends count, mutual friends, posts) - Real Cloud Data */}
          <View style={styles.statsRow}>
            <TouchableOpacity
              onPress={() => setActiveTab("friends")}
              style={styles.statItem}
            >
              <Text
                style={[
                  styles.statNumber,
                  { color: isDark ? "#F8FAFC" : "#0F172A" },
                ]}
              >
                {userFriends.length}
              </Text>
              <Text
                style={[
                  styles.statLabel,
                  { color: isDark ? "#94A3B8" : "#64748B" },
                ]}
              >
                Friends
              </Text>
            </TouchableOpacity>

            <View style={styles.statDivider} />

            <TouchableOpacity
              onPress={() => setActiveTab("posts")}
              style={styles.statItem}
            >
              <Text
                style={[
                  styles.statNumber,
                  { color: isDark ? "#F8FAFC" : "#0F172A" },
                ]}
              >
                {userPosts.length}
              </Text>
              <Text
                style={[
                  styles.statLabel,
                  { color: isDark ? "#94A3B8" : "#64748B" },
                ]}
              >
                Posts
              </Text>
            </TouchableOpacity>

            <View style={styles.statDivider} />

            <TouchableOpacity
              onPress={() => setActiveTab("friends")}
              style={styles.statItem}
            >
              <Text
                style={[
                  styles.statNumber,
                  { color: isDark ? "#F8FAFC" : "#0F172A" },
                ]}
              >
                {isSelf ? "-" : mutualFriends.length}
              </Text>
              <Text
                style={[
                  styles.statLabel,
                  { color: isDark ? "#94A3B8" : "#64748B" },
                ]}
              >
                Mutual
              </Text>
            </TouchableOpacity>
          </View>

          {/* Action Button Bar */}
          {isSelf ? (
            <View style={styles.actionButtonsBar}>
              <TouchableOpacity
                onPress={() => {
                  if (onNavigateToSplitzyProfile) {
                    onNavigateToSplitzyProfile();
                  } else {
                    Alert.alert(
                      "Splitzy Settings",
                      "Manage your household bills and profile in Splitzy Settings.",
                    );
                  }
                }}
                style={[
                  styles.primaryActionBtn,
                  { backgroundColor: "#2563EB", flex: 1 },
                ]}
              >
                <Ionicons
                  name="settings-outline"
                  size={17}
                  color="#FFFFFF"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.primaryActionText}>
                  Splitzy Account & Household
                </Text>
              </TouchableOpacity>
            </View>
          ) : user.friendshipStatus === "pending_received" ? (
            /* Incoming request: Confirm and Delete row with Message button below */
            <View style={styles.actionButtonsStacked}>
              <View style={styles.confirmDeleteRow}>
                <TouchableOpacity
                  onPress={handlePrimaryFriendAction}
                  disabled={isProcessingAction}
                  style={[
                    styles.primaryActionBtn,
                    { flex: 1, backgroundColor: "#2563EB" },
                  ]}
                >
                  {isProcessingAction ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons
                        name="checkmark-circle"
                        size={17}
                        color="#FFFFFF"
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.primaryActionText}>Confirm</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    if (user.friendshipId && onDeclineOrCancelRequest) {
                      onDeclineOrCancelRequest(user.friendshipId);
                    }
                  }}
                  style={[
                    styles.secondaryActionBtn,
                    {
                      backgroundColor: isDark ? "#334155" : "#E2E8F0",
                      flex: 1,
                    },
                  ]}
                >
                  <Ionicons
                    name="close-circle-outline"
                    size={17}
                    color={isDark ? "#CBD5E1" : "#475569"}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.secondaryActionText,
                      { color: isDark ? "#CBD5E1" : "#475569" },
                    ]}
                  >
                    Delete
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={handleMessageUser}
                style={[
                  styles.secondaryActionBtn,
                  styles.messageFullBtn,
                  {
                    backgroundColor: isDark ? "#1E293B" : "#F1F5F9",
                    borderColor: isDark ? "#334155" : "#CBD5E1",
                    borderWidth: 1,
                  },
                ]}
              >
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={18}
                  color="#2563EB"
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.secondaryActionText,
                    { color: "#2563EB", fontWeight: "700" },
                  ]}
                >
                  Message
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.actionButtonsBar}>
              {user.friendshipStatus === "friends" ? (
                <TouchableOpacity
                  onPress={handlePrimaryFriendAction}
                  disabled={isProcessingAction}
                  style={[
                    styles.secondaryActionBtn,
                    {
                      backgroundColor: isDark ? "#334155" : "#E2E8F0",
                      flex: 1,
                    },
                  ]}
                >
                  {isProcessingAction ? (
                    <ActivityIndicator size="small" color="#2563EB" />
                  ) : (
                    <>
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color="#10B981"
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.secondaryActionText,
                          { color: isDark ? "#F8FAFC" : "#0F172A" },
                        ]}
                      >
                        Friends
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : user.friendshipStatus === "pending_sent" ? (
                <TouchableOpacity
                  onPress={handlePrimaryFriendAction}
                  disabled={isProcessingAction}
                  style={[
                    styles.secondaryActionBtn,
                    {
                      backgroundColor: isDark ? "#334155" : "#E2E8F0",
                      flex: 1,
                    },
                  ]}
                >
                  {isProcessingAction ? (
                    <ActivityIndicator size="small" color="#2563EB" />
                  ) : (
                    <>
                      <Feather
                        name="clock"
                        size={16}
                        color={isDark ? "#94A3B8" : "#64748B"}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.secondaryActionText,
                          { color: isDark ? "#94A3B8" : "#64748B" },
                        ]}
                      >
                        Requested
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={handlePrimaryFriendAction}
                  disabled={isProcessingAction}
                  style={[
                    styles.primaryActionBtn,
                    { flex: 1, backgroundColor: "#1877F2" },
                  ]}
                >
                  {isProcessingAction ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons
                        name="person-add"
                        size={17}
                        color="#FFFFFF"
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.primaryActionText}>Add Friend</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {/* Direct Message Button */}
              <TouchableOpacity
                onPress={handleMessageUser}
                style={[
                  styles.secondaryActionBtn,
                  {
                    backgroundColor: isDark ? "#334155" : "#E4E6EB",
                    paddingHorizontal: 16,
                    flexDirection: "row",
                    gap: 6,
                  },
                ]}
              >
                <Ionicons
                  name="chatbubble-ellipses"
                  size={18}
                  color={isDark ? "#F8FAFC" : "#050505"}
                />
                <Text
                  style={[
                    styles.secondaryActionText,
                    { color: isDark ? "#F8FAFC" : "#050505" },
                  ]}
                >
                  Message
                </Text>
              </TouchableOpacity>

              {/* More Options Button */}
              <TouchableOpacity
                onPress={() => {
                  Alert.alert("Profile Options", undefined, [
                    { text: "Share Profile", onPress: handleShareProfile },
                    {
                      text: "Report Profile",
                      style: "destructive",
                      onPress: () =>
                        Alert.alert(
                          "Reported",
                          "Thank you for keeping Splitzy safe.",
                        ),
                    },
                    { text: "Cancel", style: "cancel" },
                  ]);
                }}
                style={[
                  styles.secondaryActionBtn,
                  {
                    backgroundColor: isDark ? "#334155" : "#E4E6EB",
                    width: 44,
                  },
                ]}
              >
                <Ionicons
                  name="ellipsis-horizontal"
                  size={18}
                  color={isDark ? "#F8FAFC" : "#050505"}
                />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Clean Segmented Navigation Tabs: Posts | About | Friends */}
        <View
          style={[
            styles.tabsContainer,
            {
              backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
              borderBottomColor: isDark ? "#334155" : "#E2E8F0",
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => setActiveTab("posts")}
            style={[
              styles.tabBtn,
              activeTab === "posts" && styles.tabBtnActive,
            ]}
          >
            <Text
              style={[
                styles.tabBtnText,
                activeTab === "posts"
                  ? styles.tabBtnTextActive
                  : { color: isDark ? "#94A3B8" : "#64748B" },
              ]}
            >
              Posts
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab("about")}
            style={[
              styles.tabBtn,
              activeTab === "about" && styles.tabBtnActive,
            ]}
          >
            <Text
              style={[
                styles.tabBtnText,
                activeTab === "about"
                  ? styles.tabBtnTextActive
                  : { color: isDark ? "#94A3B8" : "#64748B" },
              ]}
            >
              About
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab("friends")}
            style={[
              styles.tabBtn,
              activeTab === "friends" && styles.tabBtnActive,
            ]}
          >
            <Text
              style={[
                styles.tabBtnText,
                activeTab === "friends"
                  ? styles.tabBtnTextActive
                  : { color: isDark ? "#94A3B8" : "#64748B" },
              ]}
            >
              Friends
            </Text>
          </TouchableOpacity>
        </View>

        {/* TAB 1: POSTS */}
        {activeTab === "posts" && (
          <View style={styles.tabContentArea}>
            {userPosts.length === 0 ? (
              <View
                style={[
                  styles.emptyPostsCard,
                  {
                    backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                    borderColor: isDark ? "#334155" : "#E2E8F0",
                  },
                ]}
              >
                <Ionicons
                  name="newspaper-outline"
                  size={42}
                  color={isDark ? "#475569" : "#CBD5E1"}
                />
                <Text
                  style={[
                    styles.emptyPostsTitle,
                    { color: isDark ? "#F8FAFC" : "#0F172A" },
                  ]}
                >
                  No posts yet
                </Text>
                <Text
                  style={[
                    styles.emptyPostsSub,
                    { color: isDark ? "#94A3B8" : "#64748B" },
                  ]}
                >
                  When {cleanName.split(" ")[0]} shares roommate tips or market
                  listings, they'll appear right here.
                </Text>
              </View>
            ) : (
              userPosts.map((post) => renderPostCard(post))
            )}
          </View>
        )}

        {/* TAB 2: ABOUT / DETAILS */}
        {activeTab === "about" && (
          <View style={styles.tabContentArea}>
            <View
              style={[
                styles.sectionCard,
                {
                  backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                  borderColor: isDark ? "#334155" : "#E2E8F0",
                },
              ]}
            >
              <Text
                style={[
                  styles.sectionHeading,
                  { color: isDark ? "#F8FAFC" : "#0F172A" },
                ]}
              >
                Resident Information
              </Text>

              <View style={styles.detailItem}>
                <Ionicons
                  name="home"
                  size={20}
                  color={isDark ? "#94A3B8" : "#64748B"}
                  style={styles.detailIcon}
                />
                <Text
                  style={[
                    styles.detailText,
                    { color: isDark ? "#CBD5E1" : "#334155" },
                  ]}
                >
                  Member of{" "}
                  <Text style={{ fontWeight: "700" }}>
                    {user.householdName || "Splitzy Resident Living"}
                  </Text>
                </Text>
              </View>

              <View style={styles.detailItem}>
                <Ionicons
                  name="location"
                  size={20}
                  color={isDark ? "#94A3B8" : "#64748B"}
                  style={styles.detailIcon}
                />
                <Text
                  style={[
                    styles.detailText,
                    { color: isDark ? "#CBD5E1" : "#334155" },
                  ]}
                >
                  From{" "}
                  <Text style={{ fontWeight: "700" }}>
                    {user.location || "Philippines"}
                  </Text>
                </Text>
              </View>

              <View style={styles.detailItem}>
                <Ionicons
                  name="people"
                  size={20}
                  color={isDark ? "#94A3B8" : "#64748B"}
                  style={styles.detailIcon}
                />
                <Text
                  style={[
                    styles.detailText,
                    { color: isDark ? "#CBD5E1" : "#334155" },
                  ]}
                >
                  <Text style={{ fontWeight: "700" }}>
                    {isSelf ? userFriends.length : mutualFriends.length}
                  </Text>{" "}
                  {isSelf ? "friends on Splitzy" : "mutual friends on Splitzy"}
                </Text>
              </View>

              <View style={styles.detailItem}>
                <Ionicons
                  name="calendar"
                  size={20}
                  color={isDark ? "#94A3B8" : "#64748B"}
                  style={styles.detailIcon}
                />
                <Text
                  style={[
                    styles.detailText,
                    { color: isDark ? "#CBD5E1" : "#334155" },
                  ]}
                >
                  Joined Splitzy in{" "}
                  <Text style={{ fontWeight: "700" }}>
                    {user.joinedDate || "October 2024"}
                  </Text>
                </Text>
              </View>

              <View style={styles.detailItem}>
                <Ionicons
                  name="shield-checkmark"
                  size={20}
                  color="#10B981"
                  style={styles.detailIcon}
                />
                <Text
                  style={[
                    styles.detailText,
                    { color: "#10B981", fontWeight: "600" },
                  ]}
                >
                  Verified Resident Member
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* TAB 3: FRIENDS - Real Cloud Data */}
        {activeTab === "friends" && (
          <View style={styles.tabContentArea}>
            <View
              style={[
                styles.sectionCard,
                {
                  backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                  borderColor: isDark ? "#334155" : "#E2E8F0",
                },
              ]}
            >
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text
                    style={[
                      styles.sectionHeading,
                      { color: isDark ? "#F8FAFC" : "#0F172A" },
                    ]}
                  >
                    Friends
                  </Text>
                  <Text
                    style={[
                      styles.sectionSubtitle,
                      { color: isDark ? "#94A3B8" : "#64748B" },
                    ]}
                  >
                    {userFriends.length}{" "}
                    {userFriends.length === 1 ? "friend" : "friends"}
                    {!isSelf && ` (${mutualFriends.length} mutual)`}
                  </Text>
                </View>
              </View>

              {loadingFriends ? (
                <View style={{ paddingVertical: 24, alignItems: "center" }}>
                  <ActivityIndicator size="small" color="#2563EB" />
                </View>
              ) : userFriends.length === 0 ? (
                <View style={styles.emptyFriendsState}>
                  <Ionicons
                    name="people-outline"
                    size={40}
                    color={isDark ? "#475569" : "#CBD5E1"}
                  />
                  <Text
                    style={[
                      styles.emptyFriendsTitle,
                      { color: isDark ? "#F8FAFC" : "#0F172A" },
                    ]}
                  >
                    No friends yet
                  </Text>
                  <Text
                    style={[
                      styles.emptyFriendsSubtitle,
                      { color: isDark ? "#94A3B8" : "#64748B" },
                    ]}
                  >
                    {isSelf
                      ? "Connect with roommates and community members across Splitzy!"
                      : `${cleanName.split(" ")[0]} hasn't added any friends on Splitzy Community yet.`}
                  </Text>
                </View>
              ) : (
                <View style={styles.friendsGrid}>
                  {userFriends.map((friend) => (
                    <TouchableOpacity
                      key={friend.uid}
                      onPress={() => {
                        if (onOpenUserProfile) {
                          onOpenUserProfile({
                            uid: friend.uid,
                            name: friend.name,
                            avatar: friend.avatar,
                            role: friend.role,
                            householdName: friend.householdName,
                            friendshipStatus: "friends",
                            friendshipId: friend.friendshipId,
                          });
                        }
                      }}
                      style={styles.friendGridItem}
                      activeOpacity={0.8}
                    >
                      {friend.avatar ? (
                        <Image
                          source={{ uri: friend.avatar }}
                          style={styles.friendGridAvatar}
                        />
                      ) : (
                        <View style={styles.friendGridFallback}>
                          <Text style={styles.friendGridFallbackText}>
                            {(friend.name || "M").charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <Text
                        style={[
                          styles.friendGridName,
                          { color: isDark ? "#F8FAFC" : "#0F172A" },
                        ]}
                        numberOfLines={1}
                      >
                        {friend.name.split(" ")[0]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* If viewing another member and mutual connections exist */}
            {!isSelf && mutualFriends.length > 0 && (
              <View
                style={[
                  styles.sectionCard,
                  {
                    backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                    borderColor: isDark ? "#334155" : "#E2E8F0",
                    marginTop: 12,
                  },
                ]}
              >
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Text
                      style={[
                        styles.sectionHeading,
                        { color: isDark ? "#F8FAFC" : "#0F172A" },
                      ]}
                    >
                      Mutual Friends ({mutualFriends.length})
                    </Text>
                    <Text
                      style={[
                        styles.sectionSubtitle,
                        { color: isDark ? "#94A3B8" : "#64748B" },
                      ]}
                    >
                      Friends you and {cleanName.split(" ")[0]} have in common
                    </Text>
                  </View>
                </View>

                <View style={styles.friendsGrid}>
                  {mutualFriends.map((mFriend) => (
                    <TouchableOpacity
                      key={mFriend.uid}
                      onPress={() => {
                        if (onOpenUserProfile) {
                          onOpenUserProfile({
                            uid: mFriend.uid,
                            name: mFriend.name,
                            avatar: mFriend.avatar,
                            role: mFriend.role,
                            householdName: mFriend.householdName,
                            friendshipStatus: "friends",
                            friendshipId: mFriend.friendshipId,
                          });
                        }
                      }}
                      style={styles.friendGridItem}
                      activeOpacity={0.8}
                    >
                      {mFriend.avatar ? (
                        <Image
                          source={{ uri: mFriend.avatar }}
                          style={styles.friendGridAvatar}
                        />
                      ) : (
                        <View style={styles.friendGridFallback}>
                          <Text style={styles.friendGridFallbackText}>
                            {(mFriend.name || "M").charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <Text
                        style={[
                          styles.friendGridName,
                          { color: isDark ? "#F8FAFC" : "#0F172A" },
                        ]}
                        numberOfLines={1}
                      >
                        {mFriend.name.split(" ")[0]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Fullscreen Image Lightbox Modal */}
      <FullScreenImageViewerModal
        visible={imageViewerConfig.visible}
        images={imageViewerConfig.images}
        initialIndex={imageViewerConfig.initialIndex}
        authorName={imageViewerConfig.authorName}
        caption={imageViewerConfig.caption}
        onClose={() =>
          setImageViewerConfig((prev) => ({ ...prev, visible: false }))
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topNavBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 10,
  },
  navBackBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  navTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
  },
  navRightIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  navIconBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    flex: 1,
  },
  headerArea: {
    position: "relative",
    height: 190,
  },
  coverImage: {
    width: "100%",
    height: 140,
  },
  avatarWrap: {
    position: "absolute",
    bottom: 0,
    left: 20,
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 4,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: 34,
    fontWeight: "800",
    color: "#2563EB",
  },
  onlineDot: {
    position: "absolute",
    bottom: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#10B981",
    borderWidth: 3,
  },
  identityCard: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  profileName: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  profileSubtitle: {
    fontSize: 14,
    fontWeight: "500",
    marginTop: 2,
  },
  profileBio: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    paddingVertical: 10,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 17,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: "#CBD5E1",
  },
  actionButtonsBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
  },
  actionButtonsStacked: {
    marginTop: 16,
    gap: 8,
    width: "100%",
  },
  confirmDeleteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: "100%",
  },
  messageFullBtn: {
    width: "100%",
    height: 42,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  primaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 40,
    borderRadius: 8,
    paddingHorizontal: 16,
  },
  primaryActionText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 40,
    borderRadius: 8,
  },
  secondaryActionText: {
    fontSize: 15,
    fontWeight: "600",
  },
  tabsContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingHorizontal: 16,
  },
  tabBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 8,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabBtnActive: {
    borderBottomColor: "#2563EB",
  },
  tabBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  tabBtnTextActive: {
    color: "#2563EB",
    fontWeight: "700",
  },
  tabContentArea: {
    marginTop: 12,
    paddingHorizontal: 16,
  },
  sectionCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: "700",
  },
  sectionSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
  },
  detailIcon: {
    width: 28,
  },
  detailText: {
    fontSize: 14,
    flex: 1,
  },
  friendsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  friendGridItem: {
    width: "30.5%",
    alignItems: "center",
    marginBottom: 4,
  },
  friendGridAvatar: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 8,
  },
  friendGridName: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 5,
    textAlign: "center",
  },
  friendGridFallback: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: "#3B82F6",
    alignItems: "center",
    justifyContent: "center",
  },
  friendGridFallbackText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  emptyFriendsState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  emptyFriendsTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 10,
  },
  emptyFriendsSubtitle: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18,
  },
  emptyPostsCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    alignItems: "center",
    marginTop: 8,
  },
  emptyPostsTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 8,
  },
  emptyPostsSub: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
  },
  fbPostCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 14,
    overflow: "visible",
    position: "relative",
  },
  fbPostHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
  },
  fbPostAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  fbPostAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  fbPostAuthorInfo: {
    flex: 1,
  },
  fbAuthorName: {
    fontSize: 15,
    fontWeight: "700",
  },
  fbPostMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    gap: 4,
  },
  fbTimeText: {
    fontSize: 12,
  },
  fbMetaDot: {
    fontSize: 12,
    color: "#94A3B8",
  },
  categoryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  fbPostContent: {
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  fbPostImage: {
    width: "100%",
    height: 220,
  },
  fbPostStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fbReactionGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  miniLikeIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  fbStatsText: {
    fontSize: 12,
  },
  reactionDock: {
    position: "absolute",
    bottom: 46,
    left: 12,
    flexDirection: "row",
    borderRadius: 28,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 99,
  },
  reactionDockItem: {
    paddingHorizontal: 6,
  },
  reactionDockEmoji: {
    fontSize: 24,
  },
  fbActionBar: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(150, 150, 150, 0.15)",
    paddingVertical: 4,
  },
  fbActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  fbActionBtnText: {
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 5,
  },
});
