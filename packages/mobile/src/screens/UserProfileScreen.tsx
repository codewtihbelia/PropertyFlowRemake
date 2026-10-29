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
  Modal,
  TextInput,
  Dimensions,
} from "react-native";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "../context/ThemeContext";
import {
  CommunityPost,
  CommunityMember,
  CommunityReel,
  ReactionType,
  CATEGORY_LABELS,
  formatAuthorDisplayName,
  FB_6_REACTIONS,
  communityService,
  resolveUserAvatarUrl,
  formatViewCount,
} from "../services/communityService";
import { auth } from "../firebase/config";
import { mobileDataService } from "../services/firebaseDataService";
import { FullScreenImageViewerModal } from "../components/FullScreenImageViewerModal";

function computePresence(
  lastActive?: any,
  isOnlineFlag?: boolean,
): {
  isOnline: boolean;
  statusLabel: string;
} {
  let t = 0;
  if (lastActive) {
    if (typeof lastActive === "number") {
      t = lastActive;
    } else if (lastActive?.toDate && typeof lastActive.toDate === "function") {
      t = lastActive.toDate().getTime();
    } else if (
      typeof lastActive === "object" &&
      typeof lastActive.seconds === "number"
    ) {
      t = lastActive.seconds * 1000;
    } else {
      t = new Date(lastActive).getTime();
    }
  }

  const now = Date.now();
  const hasValidTime = !isNaN(t) && t > 0;
  const diffMs = hasValidTime ? now - t : -1;

  if (isOnlineFlag === true) {
    if (!hasValidTime || (diffMs >= 0 && diffMs < 15 * 60 * 1000)) {
      return { isOnline: true, statusLabel: "Active now" };
    }
    if (diffMs < 60 * 60 * 1000) {
      const mins = Math.max(1, Math.floor(diffMs / 60000));
      return { isOnline: false, statusLabel: `Active ${mins}m ago` };
    }
    if (diffMs < 24 * 60 * 60 * 1000) {
      const hrs = Math.max(1, Math.floor(diffMs / 3600000));
      return { isOnline: false, statusLabel: `Active ${hrs}h ago` };
    }
    return { isOnline: false, statusLabel: "Offline" };
  }

  if (!hasValidTime) {
    return { isOnline: false, statusLabel: "Offline" };
  }

  if (diffMs >= 0 && diffMs < 10 * 60 * 1000) {
    return { isOnline: true, statusLabel: "Active now" };
  }
  if (diffMs < 60 * 60 * 1000) {
    const mins = Math.max(1, Math.floor(diffMs / 60000));
    return { isOnline: false, statusLabel: `Active ${mins}m ago` };
  }
  if (diffMs < 24 * 60 * 60 * 1000) {
    const hrs = Math.max(1, Math.floor(diffMs / 3600000));
    return { isOnline: false, statusLabel: `Active ${hrs}h ago` };
  }
  return { isOnline: false, statusLabel: "Offline" };
}

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
  occupation?: string;
  school?: string;
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
  initialEditMode?: boolean;
  onProfileUpdated?: (updated: UserProfileInfo) => void;
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
  onOpenReel?: (reel: CommunityReel, index: number) => void;
}

export const UserProfileScreen: React.FC<UserProfileScreenProps> = ({
  user,
  onBack,
  currentUser,
  posts = [],
  initialEditMode = false,
  onProfileUpdated,
  onSendFriendRequest,
  onAcceptFriendRequest,
  onDeclineOrCancelRequest,
  onToggleLikePost,
  onSelectReaction,
  onOpenComments,
  onOpenUserProfile,
  onOpenDirectChat,
  onNavigateToSplitzyProfile,
  onOpenReel,
}) => {
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useTheme();
  const { width: SCREEN_WIDTH } = Dimensions.get("window");

  const [activeTab, setActiveTab] = useState<"all" | "reels" | "about">("all");
  const [showAllFriendsModal, setShowAllFriendsModal] = useState(false);
  const [friendsSearchQuery, setFriendsSearchQuery] = useState("");
  const [activeReactionPostId, setActiveReactionPostId] = useState<
    string | null
  >(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Real-time Cloud-synced user data states
  const [realUserPosts, setRealUserPosts] = useState<CommunityPost[]>([]);
  const [userFriends, setUserFriends] = useState<CommunityMember[]>([]);
  const [myFriends, setMyFriends] = useState<CommunityMember[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);

  // User's reels for Reels tab
  const [userReels, setUserReels] = useState<CommunityReel[]>([]);
  const [loadingReels, setLoadingReels] = useState(false);

  // Synced local profile details supporting Facebook-style updates
  const [profileDetails, setProfileDetails] = useState<UserProfileInfo>(user);

  // Modal and editing states for Facebook-style profile editor
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState(user.name || "");
  const [editBio, setEditBio] = useState(user.bio || "");
  const [editLocation, setEditLocation] = useState(user.location || "");
  const [editOccupation, setEditOccupation] = useState(user.occupation || "");
  const [editSchool, setEditSchool] = useState(user.school || "");
  const [editCover, setEditCover] = useState(user.coverImage || "");
  const [editAvatar, setEditAvatar] = useState(user.avatar || "");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Subscribe to user reels in real-time
  useEffect(() => {
    if (!user?.uid) return;
    setLoadingReels(true);
    const unsub = communityService.subscribeUserReels(user.uid, (list) => {
      setUserReels(list);
      setLoadingReels(false);
    });
    return () => unsub();
  }, [user?.uid]);

  // Sync profile details when user prop changes or on initial load from Firestore
  useEffect(() => {
    setProfileDetails(user);
    if (!user?.uid) return;
    communityService.getUserProfile(user.uid).then((cloudData) => {
      if (cloudData) {
        setProfileDetails((prev) => ({
          ...prev,
          name: cloudData.displayName || prev.name,
          bio: cloudData.bio !== undefined ? cloudData.bio : prev.bio,
          location:
            cloudData.location !== undefined
              ? cloudData.location
              : prev.location,
          occupation:
            cloudData.occupation !== undefined
              ? cloudData.occupation
              : prev.occupation,
          school:
            cloudData.school !== undefined ? cloudData.school : prev.school,
          coverImage: cloudData.coverImage || prev.coverImage,
          avatar:
            cloudData.profilePicture ||
            cloudData.photoURL ||
            cloudData.avatar ||
            prev.avatar,
        }));
      }
    });
  }, [user]);

  const currentUid = currentUser?.uid || auth.currentUser?.uid || "";
  const cleanCurUid = String(currentUid).replace(/^mem_/, "").trim();
  const cleanTargetUid = String(profileDetails.uid || user.uid || "")
    .replace(/^mem_/, "")
    .trim();
  const isSelf = cleanCurUid === cleanTargetUid;

  const [targetPresence, setTargetPresence] = useState<{
    isOnline: boolean;
    statusLabel: string;
  } | null>(null);

  // Subscribe to target user's real-time Firestore presence
  useEffect(() => {
    if (!cleanTargetUid) return;
    const unsub = mobileDataService.listenToUserPresence(
      cleanTargetUid,
      (data) => {
        if (!data) {
          setTargetPresence({ isOnline: false, statusLabel: "Offline" });
          return;
        }
        const lastActive = data.lastActiveAt || data.lastActiveDate;
        const isOnlineFlag = data.isOnline === true;
        setTargetPresence(computePresence(lastActive, isOnlineFlag));
      },
    );
    return () => unsub();
  }, [cleanTargetUid]);
  const cleanName = formatAuthorDisplayName(
    profileDetails.name,
    profileDetails.email || user.email,
  );
  const coverUrl =
    profileDetails.coverImage ||
    "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80";
  const avatarUrl =
    resolveUserAvatarUrl(profileDetails.avatar) ||
    resolveUserAvatarUrl(user.avatar);

  // Curated Facebook-style Cover and Avatar Presets
  const COVER_PRESETS = [
    {
      id: "city",
      name: "City Skyline",
      url: "https://images.unsplash.com/photo-1477959858617-67f30bc75b82?auto=format&fit=crop&w=1200&q=80",
    },
    {
      id: "loft",
      name: "Cozy Loft",
      url: "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80",
    },
    {
      id: "modern",
      name: "Modern Living",
      url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80",
    },
    {
      id: "sunset",
      name: "Sunset Terrace",
      url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
    },
    {
      id: "minimal",
      name: "Minimalist Beige",
      url: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=1200&q=80",
    },
    {
      id: "emerald",
      name: "Botanical Green",
      url: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=80",
    },
  ];

  const AVATAR_PRESETS = [
    {
      id: "av1",
      name: "Creative",
      url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
    },
    {
      id: "av2",
      name: "Developer",
      url: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80",
    },
    {
      id: "av3",
      name: "Designer",
      url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80",
    },
    {
      id: "av4",
      name: "Architect",
      url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
    },
    {
      id: "av5",
      name: "Artist",
      url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80",
    },
    {
      id: "av6",
      name: "Student",
      url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
    },
  ];

  const openEditModal = () => {
    setEditName(profileDetails.name || user.name || "");
    setEditBio(profileDetails.bio || user.bio || "");
    setEditLocation(profileDetails.location || user.location || "");
    setEditOccupation(profileDetails.occupation || user.occupation || "");
    setEditSchool(profileDetails.school || user.school || "");
    setEditCover(profileDetails.coverImage || user.coverImage || "");
    setEditAvatar(profileDetails.avatar || user.avatar || "");
    setShowEditModal(true);
  };

  // Auto-open profile editor modal if redirected in edit mode
  useEffect(() => {
    if (initialEditMode && isSelf) {
      openEditModal();
    }
  }, [initialEditMode, isSelf]);

  const pickImageAsync = async (target: "cover" | "avatar") => {
    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(
          "Permission Required",
          "Photo library access is needed to select a custom picture from your device.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: target === "avatar" ? [1, 1] : [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const pickedUri = result.assets[0].uri;
        if (target === "avatar") {
          setEditAvatar(pickedUri);
        } else {
          setEditCover(pickedUri);
        }
      }
    } catch (err: any) {
      console.warn("pickImageAsync error:", err);
      Alert.alert("Picker Error", err?.message || "Failed to pick image");
    }
  };

  const handleEditCoverPress = async () => {
    openEditModal();
    await pickImageAsync("cover");
  };

  const handleEditAvatarPress = async () => {
    openEditModal();
    await pickImageAsync("avatar");
  };

  const handleSaveProfile = async () => {
    if (!cleanCurUid) return;
    setIsSavingProfile(true);
    try {
      await communityService.updateUserProfile(cleanCurUid, {
        name: editName.trim(),
        displayName: editName.trim(),
        bio: editBio.trim(),
        location: editLocation.trim(),
        occupation: editOccupation.trim(),
        school: editSchool.trim(),
        coverImage: editCover.trim(),
        avatar: editAvatar.trim(),
        profilePicture: editAvatar.trim(),
        photoURL: editAvatar.trim(),
      });

      const updatedProfile: UserProfileInfo = {
        ...profileDetails,
        name: editName.trim(),
        bio: editBio.trim(),
        location: editLocation.trim(),
        occupation: editOccupation.trim(),
        school: editSchool.trim(),
        coverImage: editCover.trim(),
        avatar: editAvatar.trim(),
      };

      setProfileDetails(updatedProfile);
      onProfileUpdated?.(updatedProfile);

      setShowEditModal(false);
      Alert.alert(
        "Profile Saved",
        "Your profile picture, cover photo, and personal bio have been updated across Splitzy!",
      );
    } catch (err: any) {
      console.warn("handleSaveProfile error:", err);
      Alert.alert(
        "Save Failed",
        err?.message || "Could not save profile changes.",
      );
    } finally {
      setIsSavingProfile(false);
    }
  };

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
            backgroundColor: colors.background,
            borderColor: isDark ? "#334155" : "#E2E8F0",
          },
        ]}
      >
        <StatusBar
          barStyle={isDark ? "light-content" : "dark-content"}
          translucent
          backgroundColor="transparent"
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        translucent
        backgroundColor="transparent"
      />

      {/* Standalone Top Navigation Header */}
      <View
        style={[
          styles.topNavBar,
          {
            paddingTop: Math.max(
              insets.top,
              Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 12,
            ),
            backgroundColor: colors.background,
            // borderBottomColor: isDark ? "#334155" : "#E2E8F0",
          },
        ]}
      >
        <TouchableOpacity
          onPress={onBack}
          style={styles.navBackBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather
            name="chevron-left"
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
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Cover Photo and Profile Picture Header */}
        <View
          style={[styles.headerArea, { backgroundColor: colors.background }]}
        >
          <Image
            source={{ uri: coverUrl }}
            style={styles.coverImage}
            resizeMode="cover"
          />

          {isSelf && (
            <TouchableOpacity
              style={[
                styles.coverCameraBtn,
                {
                  borderColor: isDark ? "#FFFFFF" : "#1E293B",
                },
              ]}
              onPress={handleEditCoverPress}
              activeOpacity={0.8}
              accessibilityLabel="Edit Cover Photo"
            >
              <Feather
                name="camera"
                size={14}
                color="#FFFFFF"
                style={{ color: isDark ? "#FFFFFF" : "#1E293B" }}
              />
              <Text
                style={[
                  styles.coverCameraText,
                  { color: isDark ? "#FFFFFF" : "#1E293B" },
                ]}
              >
                Edit Cover
              </Text>
            </TouchableOpacity>
          )}

          {/* Profile Avatar overlapping cover photo */}
          <View style={styles.avatarWrap}>
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
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
                    backgroundColor: colors.background,
                  },
                ]}
              >
                <Text style={styles.avatarInitials}>
                  {cleanName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}

            {isSelf ? (
              <TouchableOpacity
                style={[
                  styles.avatarCameraBtn,
                  { borderColor: isDark ? "#1E293B" : "#FFFFFF" },
                ]}
                onPress={handleEditAvatarPress}
                activeOpacity={0.8}
                accessibilityLabel="Edit Profile Picture"
              >
                <Feather name="camera" size={14} color="#FFFFFF" />
              </TouchableOpacity>
            ) : targetPresence?.isOnline ? (
              /* Online Green Indicator Dot */
              <View
                style={[
                  styles.onlineDot,
                  { borderColor: isDark ? "#1E293B" : "#FFFFFF" },
                ]}
              />
            ) : null}
          </View>
        </View>

        {/* Profile Identity Details Card */}
        <View
          style={[
            styles.identityCard,
            {
              backgroundColor: colors.background,
              // borderBottomColor: isDark ? "#334155" : "#E2E8F0",
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
            <MaterialCommunityIcons
              name="check-decagram"
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
            {profileDetails.householdName || user.householdName
              ? `Member of ${profileDetails.householdName || user.householdName}`
              : profileDetails.role || user.role || "Splitzy Resident Member"}
          </Text>

          {/* Active Status Badge */}
          <View style={styles.presenceBadgeRow}>
            <View
              style={[
                styles.presenceIndicatorDot,
                {
                  backgroundColor:
                    isSelf || targetPresence?.isOnline ? "#10B981" : "#94A3B8",
                },
              ]}
            />
            <Text
              style={[
                styles.presenceStatusText,
                {
                  color:
                    isSelf || targetPresence?.isOnline
                      ? "#10B981"
                      : isDark
                        ? "#94A3B8"
                        : "#64748B",
                },
              ]}
            >
              {isSelf ? "Active now" : targetPresence?.statusLabel || "Offline"}
            </Text>
          </View>

          {/* Bio */}
          <Text
            style={[
              styles.profileBio,
              { color: isDark ? "#CBD5E1" : "#334155" },
            ]}
          >
            {profileDetails.bio ||
              user.bio ||
              "Splitting bills, sharing space, and creating memories with great roommates! 🏡✨"}
          </Text>

          {/* Quick Stats Row (Friends count, mutual friends, posts) - Real Cloud Data */}
          <View style={styles.statsRow}>
            <TouchableOpacity
              onPress={() => setShowAllFriendsModal(true)}
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
              onPress={() => setActiveTab("all")}
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
              onPress={() => setShowAllFriendsModal(true)}
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
                onPress={openEditModal}
                style={[
                  styles.primaryActionBtn,
                  { backgroundColor: "#1877F2", flex: 1 },
                ]}
              >
                <Ionicons
                  name="create-outline"
                  size={18}
                  color="#FFFFFF"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.primaryActionText}>Edit Profile</Text>
              </TouchableOpacity>

              {onNavigateToSplitzyProfile && (
                <TouchableOpacity
                  onPress={onNavigateToSplitzyProfile}
                  style={[
                    styles.secondaryActionBtn,
                    {
                      backgroundColor: isDark ? "#334155" : "#E4E6EB",
                      paddingHorizontal: 16,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                    },
                  ]}
                >
                  <Ionicons
                    name="settings-outline"
                    size={17}
                    color={isDark ? "#F8FAFC" : "#0F172A"}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.secondaryActionText,
                      {
                        color: isDark ? "#F8FAFC" : "#0F172A",
                        fontWeight: "600",
                      },
                    ]}
                  >
                    Settings
                  </Text>
                </TouchableOpacity>
              )}
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

        {/* Clean Segmented Navigation Tabs: All | Reels | About */}
        <View
          style={[
            styles.tabsContainer,
            {
              backgroundColor: colors.background,
              // borderBottomColor: isDark ? "#334155" : "#E2E8F0",
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => setActiveTab("all")}
            style={[styles.tabBtn, activeTab === "all" && styles.tabBtnActive]}
          >
            <Text
              style={[
                styles.tabBtnText,
                activeTab === "all"
                  ? styles.tabBtnTextActive
                  : { color: isDark ? "#94A3B8" : "#64748B" },
              ]}
            >
              All
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab("reels")}
            style={[
              styles.tabBtn,
              activeTab === "reels" && styles.tabBtnActive,
            ]}
          >
            <Text
              style={[
                styles.tabBtnText,
                activeTab === "reels"
                  ? styles.tabBtnTextActive
                  : { color: isDark ? "#94A3B8" : "#64748B" },
              ]}
            >
              Reels
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
        </View>

        {/* TAB 1: ALL (FRIENDS CAROUSEL + ALL POSTS FEED) */}
        {activeTab === "all" && (
          <View style={styles.tabContentArea}>
            {/* ─── FRIENDS HORIZONTAL SECTION (MATCHING ATTACHED DESIGN) ─── */}
            <View
              style={[
                styles.allTabFriendsCard,
                {
                  backgroundColor: colors.background,
                  // borderBottomColor: isDark ? "#334155" : "#F1F5F9",
                },
              ]}
            >
              <View style={styles.allTabFriendsHeader}>
                <Text
                  style={[
                    styles.allTabFriendsTitle,
                    { color: isDark ? "#F8FAFC" : "#0F172A" },
                  ]}
                >
                  Friends
                </Text>
                <TouchableOpacity
                  onPress={() => setShowAllFriendsModal(true)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.allTabSeeAllText}>See all</Text>
                </TouchableOpacity>
              </View>

              {loadingFriends ? (
                <View style={{ paddingVertical: 20, alignItems: "center" }}>
                  <ActivityIndicator size="small" color="#2563EB" />
                </View>
              ) : userFriends.length === 0 ? (
                <View style={styles.emptyFriendsInlineRow}>
                  <Text
                    style={[
                      styles.emptyFriendsInlineText,
                      { color: isDark ? "#94A3B8" : "#64748B" },
                    ]}
                  >
                    {isSelf
                      ? "No friends yet. Add roommates & neighbors from Community!"
                      : `${cleanName.split(" ")[0]} has no friends listed yet.`}
                  </Text>
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.friendsHorizontalScroll}
                >
                  {userFriends.map((friend, idx) => {
                    const cleanFid = String(friend.uid || "")
                      .replace(/^mem_/, "")
                      .trim();
                    const isMutual =
                      !isSelf &&
                      myFriends.some(
                        (mf) =>
                          String(mf.uid || "")
                            .replace(/^mem_/, "")
                            .trim() === cleanFid,
                      );
                    const subtitle = isSelf
                      ? friend.householdName || friend.role || "Splitzy friend"
                      : isMutual
                        ? "Mutual friend"
                        : friend.householdName || "Splitzy friend";

                    return (
                      <TouchableOpacity
                        key={friend.uid || idx}
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
                        style={styles.circularFriendItem}
                        activeOpacity={0.82}
                      >
                        {/* 100% Circular Avatar with border */}
                        <View
                          style={[
                            styles.circularFriendAvatarWrap,
                            {
                              borderColor: isDark ? "#334155" : "#E2E8F0",
                            },
                          ]}
                        >
                          {friend.avatar ? (
                            <Image
                              source={{ uri: friend.avatar }}
                              style={styles.circularFriendAvatar}
                            />
                          ) : (
                            <View
                              style={[
                                styles.circularFriendAvatarFallback,
                                {
                                  backgroundColor: isDark
                                    ? "#334155"
                                    : "#DBEAFE",
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.circularFriendInitial,
                                  {
                                    color: isDark ? "#94A3B8" : "#1D4ED8",
                                  },
                                ]}
                              >
                                {(friend.name || "M").charAt(0).toUpperCase()}
                              </Text>
                            </View>
                          )}
                        </View>

                        {/* Name (2-lines, centered) */}
                        <Text
                          style={[
                            styles.circularFriendName,
                            { color: isDark ? "#F8FAFC" : "#0F172A" },
                          ]}
                          numberOfLines={2}
                        >
                          {friend.name || "Member"}
                        </Text>

                        {/* Subtitle / mutual friends count */}
                        <Text
                          style={[
                            styles.circularFriendSubtitle,
                            { color: isDark ? "#94A3B8" : "#64748B" },
                          ]}
                          numberOfLines={1}
                        >
                          {subtitle}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            {/* ─── ALL POSTS SECTION ─── */}
            <View style={styles.allPostsSection}>
              {/* Header: All posts */}
              <View style={styles.allPostsHeaderRow}>
                <Text
                  style={[
                    styles.allPostsHeading,
                    { color: isDark ? "#F8FAFC" : "#0F172A" },
                  ]}
                >
                  All posts
                </Text>
              </View>

              {/* Quick Post Prompt Card (Facebook style when isSelf) */}
              {isSelf && (
                <View
                  style={[
                    styles.profileQuickPostCard,
                    {
                      backgroundColor: colors.background,
                      borderColor: isDark ? "#334155" : "#E2E8F0",
                    },
                  ]}
                >
                  <View style={styles.profileQuickPostRow}>
                    {avatarUrl ? (
                      <Image
                        source={{ uri: avatarUrl }}
                        style={styles.profileQuickPostAvatar}
                      />
                    ) : (
                      <View
                        style={[
                          styles.profileQuickPostAvatarPlaceholder,
                          {
                            backgroundColor: isDark ? "#334155" : "#DBEAFE",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.profileQuickPostAvatarInitial,
                            {
                              color: isDark ? "#94A3B8" : "#1D4ED8",
                            },
                          ]}
                        >
                          {cleanName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}

                    <TouchableOpacity
                      onPress={() => {
                        Alert.alert(
                          "Create Post",
                          "Post to Community feed from the Community screen.",
                          [
                            { text: "Dismiss", style: "cancel" },
                            { text: "Go to Community", onPress: onBack },
                          ],
                        );
                      }}
                      style={[
                        styles.profileQuickPostInputTrigger,
                        {
                          backgroundColor: isDark ? "#0F172A" : "#F1F5F9",
                          borderColor: isDark ? "#334155" : "#E2E8F0",
                        },
                      ]}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.profileQuickPostInputPlaceholder,
                          {
                            color: isDark ? "#94A3B8" : "#64748B",
                          },
                        ]}
                      >
                        What's on your mind?
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        Alert.alert(
                          "Share Photos",
                          "Open Community feed to share photos with roommates.",
                          [
                            { text: "Dismiss", style: "cancel" },
                            { text: "Go to Community", onPress: onBack },
                          ],
                        );
                      }}
                      style={styles.profileQuickPostMediaBtn}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="images-outline"
                        size={22}
                        color="#10B981"
                      />
                    </TouchableOpacity>
                  </View>

                  <View
                    style={[
                      styles.profileQuickPostDivider,
                      { backgroundColor: isDark ? "#334155" : "#F1F5F9" },
                    ]}
                  />

                  {/* Action Shortcuts: Reel & Live */}
                  <View style={styles.profileQuickPostActionsRow}>
                    <TouchableOpacity
                      onPress={() => setActiveTab("reels")}
                      style={[
                        styles.profileActionShortcutPill,
                        {
                          backgroundColor: isDark ? "#0F172A" : "#F8FAFC",
                          borderColor: isDark ? "#334155" : "#E2E8F0",
                        },
                      ]}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="film-outline"
                        size={16}
                        color="#EF4444"
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.profileActionShortcutText,
                          { color: isDark ? "#F8FAFC" : "#0F172A" },
                        ]}
                      >
                        Reel
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        Alert.alert(
                          "Community Live",
                          "Community video broadcast will be available in the upcoming release.",
                        );
                      }}
                      style={[
                        styles.profileActionShortcutPill,
                        {
                          backgroundColor: isDark ? "#0F172A" : "#F8FAFC",
                          borderColor: isDark ? "#334155" : "#E2E8F0",
                        },
                      ]}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="videocam-outline"
                        size={16}
                        color="#DC2626"
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.profileActionShortcutText,
                          { color: isDark ? "#F8FAFC" : "#0F172A" },
                        ]}
                      >
                        Live
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Feed of Posts */}
              {userPosts.length === 0 ? (
                <View
                  style={[
                    styles.emptyPostsCard,
                    {
                      backgroundColor: colors.background,
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
                    When {cleanName.split(" ")[0]} shares roommate tips or
                    market listings, they'll appear right here.
                  </Text>
                </View>
              ) : (
                userPosts.map((post) => renderPostCard(post))
              )}
            </View>
          </View>
        )}

        {/* TAB 2: REELS (3-COLUMN GALLERY MODE WITH VIEW COUNTS) */}
        {activeTab === "reels" && (
          <View style={{ padding: 0, marginTop: 12 }}>
            {loadingReels ? (
              <View style={styles.reelsLoadingBox}>
                <ActivityIndicator size="large" color="#2563EB" />
                <Text
                  style={[
                    styles.reelsLoadingText,
                    { color: isDark ? "#94A3B8" : "#64748B" },
                  ]}
                >
                  Loading reels...
                </Text>
              </View>
            ) : userReels.length === 0 ? (
              <View
                style={[
                  styles.emptyPostsCard,
                  {
                    backgroundColor: colors.background,
                    borderColor: isDark ? "#334155" : "#E2E8F0",
                  },
                ]}
              >
                <Ionicons
                  name="film-outline"
                  size={42}
                  color={isDark ? "#475569" : "#CBD5E1"}
                />
                <Text
                  style={[
                    styles.emptyPostsTitle,
                    { color: isDark ? "#F8FAFC" : "#0F172A" },
                  ]}
                >
                  No reels yet
                </Text>
                <Text
                  style={[
                    styles.emptyPostsSub,
                    { color: isDark ? "#94A3B8" : "#64748B" },
                  ]}
                >
                  When {cleanName.split(" ")[0]} posts YouTube Shorts or short
                  videos, they will appear here in gallery mode.
                </Text>
              </View>
            ) : (
              <View style={styles.reelsGalleryGrid}>
                {userReels.map((reelItem, rIdx) => {
                  const numColumns = 3;
                  const totalGaps = 1 * (numColumns - 1);
                  const availableWidth = SCREEN_WIDTH - 0 - totalGaps;
                  const itemWidth = Math.floor(availableWidth / numColumns);
                  const itemHeight = Math.floor(itemWidth * (14 / 9));

                  return (
                    <TouchableOpacity
                      key={reelItem.id || `profile-reel-${rIdx}`}
                      onPress={() => onOpenReel?.(reelItem, rIdx)}
                      style={[
                        styles.reelGalleryCard,
                        {
                          width: itemWidth,
                          height: itemHeight,
                          backgroundColor: isDark ? "#0F172A" : "#1E293B",
                        },
                      ]}
                      activeOpacity={0.88}
                    >
                      {reelItem.thumbnailUrl ? (
                        <Image
                          source={{ uri: reelItem.thumbnailUrl }}
                          style={styles.reelGalleryThumb}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.reelGalleryPlaceholder}>
                          <Ionicons name="play" size={24} color="#94A3B8" />
                        </View>
                      )}

                      {/* Top Pin Badge if pinned */}
                      {reelItem.pinned && (
                        <View style={styles.reelPinBadge}>
                          <Ionicons name="pin" size={12} color="#FFFFFF" />
                        </View>
                      )}

                      {/* Bottom Gradient Scrim */}
                      <View style={styles.reelCardScrim} pointerEvents="none" />

                      {/* Bottom-left formatted view count badge (e.g. 👁 1.1M, 👁 475) */}
                      <View
                        style={styles.reelCardViewBadge}
                        pointerEvents="none"
                      >
                        <Ionicons
                          name="eye-outline"
                          size={13}
                          color="#FFFFFF"
                          style={{ marginRight: 3 }}
                        />
                        <Text style={styles.reelCardViewCount}>
                          {formatViewCount(reelItem.viewsCount || 0)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
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
                  backgroundColor: colors.background,
                  // borderColor: isDark ? "#334155" : "#E2E8F0",
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
                    {profileDetails.householdName ||
                      user.householdName ||
                      "Splitzy Resident Living"}
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
                  Lives in{" "}
                  <Text style={{ fontWeight: "700" }}>
                    {profileDetails.location || user.location || "Philippines"}
                  </Text>
                </Text>
              </View>

              {Boolean(profileDetails.occupation || user.occupation) && (
                <View style={styles.detailItem}>
                  <Ionicons
                    name="briefcase"
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
                    Works as{" "}
                    <Text style={{ fontWeight: "700" }}>
                      {profileDetails.occupation || user.occupation}
                    </Text>
                  </Text>
                </View>
              )}

              {Boolean(profileDetails.school || user.school) && (
                <View style={styles.detailItem}>
                  <Ionicons
                    name="school"
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
                    Studied at{" "}
                    <Text style={{ fontWeight: "700" }}>
                      {profileDetails.school || user.school}
                    </Text>
                  </Text>
                </View>
              )}

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
                    {profileDetails.joinedDate ||
                      user.joinedDate ||
                      "October 2024"}
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

      {/* Facebook-Style Edit Profile Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowEditModal(false)}
      >
        <View
          style={[
            styles.editModalContainer,
            {
              backgroundColor: colors.background,
              paddingTop: Math.max(
                insets.top,
                Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 12,
              ),
            },
          ]}
        >
          {/* Header */}
          <View
            style={[
              styles.editModalHeader,
              {
                borderBottomColor: isDark ? "#334155" : "#E2E8F0",
                backgroundColor: colors.background,
              },
            ]}
          >
            <TouchableOpacity
              onPress={() => setShowEditModal(false)}
              style={styles.editModalCloseBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name="close"
                size={24}
                color={isDark ? "#F8FAFC" : "#0F172A"}
              />
            </TouchableOpacity>

            <Text
              style={[
                styles.editModalTitle,
                { color: isDark ? "#F8FAFC" : "#0F172A" },
              ]}
            >
              Edit Profile
            </Text>

            <TouchableOpacity
              onPress={handleSaveProfile}
              disabled={isSavingProfile}
              style={[
                styles.editModalSaveBtn,
                { opacity: isSavingProfile ? 0.7 : 1 },
              ]}
            >
              {isSavingProfile ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.editModalSaveBtnText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.editModalScroll}
            contentContainerStyle={[
              styles.editModalScrollContent,
              { paddingBottom: insets.bottom + 20 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* 1. Profile Picture Section */}
            <View
              style={[
                styles.editSection,
                { borderBottomColor: isDark ? "#334155" : "#F1F5F9" },
              ]}
            >
              <View style={styles.editSectionHeader}>
                <Text
                  style={[
                    styles.editSectionTitle,
                    { color: isDark ? "#F8FAFC" : "#0F172A" },
                  ]}
                >
                  Profile Picture
                </Text>
                <TouchableOpacity
                  onPress={() => pickImageAsync("avatar")}
                  style={styles.editSectionActionBtn}
                >
                  <Text style={styles.editSectionActionText}>Choose Photo</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.editAvatarPreviewRow}>
                {editAvatar ? (
                  <Image
                    source={{ uri: editAvatar }}
                    style={styles.editAvatarPreview}
                  />
                ) : (
                  <View
                    style={[
                      styles.editAvatarPlaceholder,
                      { backgroundColor: isDark ? "#334155" : "#DBEAFE" },
                    ]}
                  >
                    <Text style={styles.editAvatarPlaceholderText}>
                      {(editName || "U").charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  style={[
                    styles.chooseDevicePhotoBtn,
                    {
                      backgroundColor: isDark ? "#1E293B" : "#F1F5F9",
                      borderColor: isDark ? "#334155" : "#CBD5E1",
                    },
                  ]}
                  onPress={() => pickImageAsync("avatar")}
                >
                  <Feather
                    name="image"
                    size={16}
                    color={isDark ? "#60A5FA" : "#2563EB"}
                  />
                  <Text
                    style={[
                      styles.chooseDevicePhotoText,
                      { color: isDark ? "#60A5FA" : "#2563EB" },
                    ]}
                  >
                    Upload from Library
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Avatar Presets */}
              <Text
                style={[
                  styles.presetSectionLabel,
                  { color: isDark ? "#94A3B8" : "#64748B" },
                ]}
              >
                Or choose an avatar style:
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.presetsScroll}
              >
                {AVATAR_PRESETS.map((preset) => {
                  const isSelected = editAvatar === preset.url;
                  return (
                    <TouchableOpacity
                      key={preset.id}
                      onPress={() => setEditAvatar(preset.url)}
                      style={[
                        styles.presetAvatarItem,
                        isSelected && styles.presetItemActive,
                      ]}
                      activeOpacity={0.8}
                    >
                      <Image
                        source={{ uri: preset.url }}
                        style={styles.presetAvatarImage}
                      />
                      {isSelected && (
                        <View style={styles.presetCheckmark}>
                          <Ionicons
                            name="checkmark"
                            size={12}
                            color="#FFFFFF"
                          />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* 2. Cover Photo Section */}
            <View
              style={[
                styles.editSection,
                { borderBottomColor: isDark ? "#334155" : "#F1F5F9" },
              ]}
            >
              <View style={styles.editSectionHeader}>
                <Text
                  style={[
                    styles.editSectionTitle,
                    { color: isDark ? "#F8FAFC" : "#0F172A" },
                  ]}
                >
                  Cover Photo
                </Text>
                <TouchableOpacity
                  onPress={() => pickImageAsync("cover")}
                  style={styles.editSectionActionBtn}
                >
                  <Text style={styles.editSectionActionText}>Choose Photo</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.editCoverPreviewWrap}>
                <Image
                  source={{
                    uri:
                      editCover ||
                      "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80",
                  }}
                  style={styles.editCoverPreview}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  style={styles.editCoverOverlayBtn}
                  onPress={() => pickImageAsync("cover")}
                >
                  <Feather name="camera" size={15} color="#FFFFFF" />
                  <Text style={styles.editCoverOverlayText}>Upload Cover</Text>
                </TouchableOpacity>
              </View>

              {/* Cover Presets */}
              <Text
                style={[
                  styles.presetSectionLabel,
                  { color: isDark ? "#94A3B8" : "#64748B" },
                ]}
              >
                Or choose a curated cover theme:
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.presetsScroll}
              >
                {COVER_PRESETS.map((preset) => {
                  const isSelected = editCover === preset.url;
                  return (
                    <TouchableOpacity
                      key={preset.id}
                      onPress={() => setEditCover(preset.url)}
                      style={[
                        styles.presetCoverItem,
                        isSelected && styles.presetItemActive,
                      ]}
                      activeOpacity={0.8}
                    >
                      <Image
                        source={{ uri: preset.url }}
                        style={styles.presetCoverImage}
                      />
                      <Text
                        style={[
                          styles.presetCoverLabel,
                          { color: isDark ? "#CBD5E1" : "#475569" },
                        ]}
                        numberOfLines={1}
                      >
                        {preset.name}
                      </Text>
                      {isSelected && (
                        <View style={styles.presetCheckmarkCover}>
                          <Ionicons
                            name="checkmark"
                            size={12}
                            color="#FFFFFF"
                          />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* 3. Bio / About Section */}
            <View
              style={[
                styles.editSection,
                { borderBottomColor: isDark ? "#334155" : "#F1F5F9" },
              ]}
            >
              <Text
                style={[
                  styles.editSectionTitle,
                  { color: isDark ? "#F8FAFC" : "#0F172A", marginBottom: 6 },
                ]}
              >
                Bio
              </Text>
              <Text
                style={[
                  styles.editSectionDesc,
                  { color: isDark ? "#94A3B8" : "#64748B" },
                ]}
              >
                Describe yourself, your roommate habits, and what you enjoy!
              </Text>
              <TextInput
                style={[
                  styles.editBioInput,
                  {
                    // backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                    backgroundColor: colors.background,
                    borderColor: isDark ? "#334155" : "#CBD5E1",
                    color: isDark ? "#F8FAFC" : "#0F172A",
                  },
                ]}
                placeholder="Write something about yourself..."
                placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                multiline
                numberOfLines={3}
                value={editBio}
                onChangeText={setEditBio}
              />
            </View>

            {/* 4. Details / Personal Information */}
            <View style={styles.editSection}>
              <Text
                style={[
                  styles.editSectionTitle,
                  { color: isDark ? "#F8FAFC" : "#0F172A", marginBottom: 12 },
                ]}
              >
                Customize Your Info
              </Text>

              {/* Display Name */}
              <View style={styles.editFieldGroup}>
                <Text
                  style={[
                    styles.editFieldLabel,
                    { color: isDark ? "#CBD5E1" : "#475569" },
                  ]}
                >
                  Full Name
                </Text>
                <TextInput
                  style={[
                    styles.editTextInput,
                    {
                      backgroundColor: colors.background,
                      borderColor: isDark ? "#334155" : "#CBD5E1",
                      color: isDark ? "#F8FAFC" : "#0F172A",
                    },
                  ]}
                  placeholder="Your Name"
                  placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                  value={editName}
                  onChangeText={setEditName}
                />
              </View>

              {/* City / Location */}
              <View style={styles.editFieldGroup}>
                <Text
                  style={[
                    styles.editFieldLabel,
                    { color: isDark ? "#CBD5E1" : "#475569" },
                  ]}
                >
                  City / Location
                </Text>
                <TextInput
                  style={[
                    styles.editTextInput,
                    {
                      backgroundColor: colors.background,
                      borderColor: isDark ? "#334155" : "#CBD5E1",
                      color: isDark ? "#F8FAFC" : "#0F172A",
                    },
                  ]}
                  placeholder="e.g. Quezon City, Manila"
                  placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                  value={editLocation}
                  onChangeText={setEditLocation}
                />
              </View>

              {/* Occupation */}
              <View style={styles.editFieldGroup}>
                <Text
                  style={[
                    styles.editFieldLabel,
                    { color: isDark ? "#CBD5E1" : "#475569" },
                  ]}
                >
                  Occupation / Work
                </Text>
                <TextInput
                  style={[
                    styles.editTextInput,
                    {
                      backgroundColor: colors.background,
                      borderColor: isDark ? "#334155" : "#CBD5E1",
                      color: isDark ? "#F8FAFC" : "#0F172A",
                    },
                  ]}
                  placeholder="e.g. Software Engineer, Student, Designer"
                  placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                  value={editOccupation}
                  onChangeText={setEditOccupation}
                />
              </View>

              {/* School / Education */}
              <View style={styles.editFieldGroup}>
                <Text
                  style={[
                    styles.editFieldLabel,
                    { color: isDark ? "#CBD5E1" : "#475569" },
                  ]}
                >
                  School / Education
                </Text>
                <TextInput
                  style={[
                    styles.editTextInput,
                    {
                      backgroundColor: colors.background,
                      borderColor: isDark ? "#334155" : "#CBD5E1",
                      color: isDark ? "#F8FAFC" : "#0F172A",
                    },
                  ]}
                  placeholder="e.g. UP Diliman, DLSU, UST"
                  placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                  value={editSchool}
                  onChangeText={setEditSchool}
                />
              </View>

              {/* Save Button */}
              <TouchableOpacity
                onPress={handleSaveProfile}
                disabled={isSavingProfile}
                style={[
                  styles.saveProfileFullBtn,
                  { opacity: isSavingProfile ? 0.7 : 1 },
                ]}
              >
                {isSavingProfile ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color="#FFFFFF"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.saveProfileFullBtnText}>
                      Save All Changes
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ─── ALL FRIENDS DEDICATED MODAL (OPENED VIA "SEE ALL") ─── */}
      <Modal
        visible={showAllFriendsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowAllFriendsModal(false);
          setFriendsSearchQuery("");
        }}
      >
        <View
          style={[
            styles.allFriendsModalContainer,
            {
              backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
              paddingTop: Math.max(
                insets.top,
                Platform.OS === "android" ? 24 : 12,
              ),
            },
          ]}
        >
          {/* Header */}
          <View
            style={[
              styles.allFriendsModalHeader,
              { borderBottomColor: isDark ? "#1E293B" : "#E2E8F0" },
            ]}
          >
            <TouchableOpacity
              onPress={() => {
                setShowAllFriendsModal(false);
                setFriendsSearchQuery("");
              }}
              style={styles.allFriendsModalCloseBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name="arrow-back"
                size={22}
                color={isDark ? "#F8FAFC" : "#0F172A"}
              />
            </TouchableOpacity>

            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text
                style={[
                  styles.allFriendsModalTitle,
                  { color: isDark ? "#F8FAFC" : "#0F172A" },
                ]}
              >
                Friends
              </Text>
              <Text
                style={[
                  styles.allFriendsModalSub,
                  { color: isDark ? "#94A3B8" : "#64748B" },
                ]}
              >
                {userFriends.length}{" "}
                {userFriends.length === 1 ? "friend" : "friends"}
                {!isSelf && ` • ${mutualFriends.length} mutual`}
              </Text>
            </View>
          </View>

          {/* Search bar */}
          <View
            style={[
              styles.allFriendsSearchBox,
              {
                backgroundColor: isDark ? "#1E293B" : "#F1F5F9",
                borderColor: isDark ? "#334155" : "#E2E8F0",
              },
            ]}
          >
            <Ionicons
              name="search"
              size={18}
              color={isDark ? "#94A3B8" : "#64748B"}
              style={{ marginRight: 8 }}
            />
            <TextInput
              style={[
                styles.allFriendsSearchInput,
                { color: isDark ? "#F8FAFC" : "#0F172A" },
              ]}
              placeholder="Search friends..."
              placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
              value={friendsSearchQuery}
              onChangeText={setFriendsSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {Boolean(friendsSearchQuery) && (
              <TouchableOpacity
                onPress={() => setFriendsSearchQuery("")}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name="close-circle"
                  size={16}
                  color={isDark ? "#94A3B8" : "#64748B"}
                />
              </TouchableOpacity>
            )}
          </View>

          {/* Friends List */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingBottom: insets.bottom + 40,
            }}
            showsVerticalScrollIndicator={false}
          >
            {(() => {
              const q = friendsSearchQuery.trim().toLowerCase();
              const filtered = userFriends.filter(
                (f) =>
                  !q ||
                  (f.name && f.name.toLowerCase().includes(q)) ||
                  (f.householdName &&
                    f.householdName.toLowerCase().includes(q)),
              );

              if (filtered.length === 0) {
                return (
                  <View style={styles.allFriendsEmptyBox}>
                    <Ionicons
                      name="people-outline"
                      size={44}
                      color={isDark ? "#475569" : "#CBD5E1"}
                    />
                    <Text
                      style={[
                        styles.allFriendsEmptyTitle,
                        { color: isDark ? "#F8FAFC" : "#0F172A" },
                      ]}
                    >
                      {friendsSearchQuery
                        ? "No matching friends"
                        : "No friends to show"}
                    </Text>
                  </View>
                );
              }

              return filtered.map((friend) => {
                const cleanFid = String(friend.uid || "")
                  .replace(/^mem_/, "")
                  .trim();
                const isMutual =
                  !isSelf &&
                  myFriends.some(
                    (mf) =>
                      String(mf.uid || "")
                        .replace(/^mem_/, "")
                        .trim() === cleanFid,
                  );

                return (
                  <TouchableOpacity
                    key={friend.uid}
                    onPress={() => {
                      setShowAllFriendsModal(false);
                      setFriendsSearchQuery("");
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
                    style={[
                      styles.allFriendsListItem,
                      { borderBottomColor: isDark ? "#1E293B" : "#F1F5F9" },
                    ]}
                    activeOpacity={0.7}
                  >
                    {friend.avatar ? (
                      <Image
                        source={{ uri: friend.avatar }}
                        style={styles.allFriendsListAvatar}
                      />
                    ) : (
                      <View
                        style={[
                          styles.allFriendsListAvatarFallback,
                          {
                            backgroundColor: isDark ? "#334155" : "#DBEAFE",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.allFriendsListInitial,
                            { color: isDark ? "#94A3B8" : "#1D4ED8" },
                          ]}
                        >
                          {(friend.name || "M").charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}

                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text
                        style={[
                          styles.allFriendsListName,
                          { color: isDark ? "#F8FAFC" : "#0F172A" },
                        ]}
                        numberOfLines={1}
                      >
                        {friend.name || "Splitzy Member"}
                      </Text>
                      <Text
                        style={[
                          styles.allFriendsListSubtitle,
                          { color: isDark ? "#94A3B8" : "#64748B" },
                        ]}
                        numberOfLines={1}
                      >
                        {isSelf
                          ? friend.householdName ||
                            friend.role ||
                            "Splitzy friend"
                          : isMutual
                            ? "Mutual friend"
                            : friend.householdName || "Splitzy friend"}
                      </Text>
                    </View>

                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={isDark ? "#64748B" : "#94A3B8"}
                    />
                  </TouchableOpacity>
                );
              });
            })()}
          </ScrollView>
        </View>
      </Modal>
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
    // borderBottomWidth: StyleSheet.hairlineWidth,
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
    // backgroundColor: "#FFFFFF",
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
    // borderBottomWidth: StyleSheet.hairlineWidth,
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
  presenceBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 6,
  },
  presenceIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  presenceStatusText: {
    fontSize: 12,
    fontWeight: "600",
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
    paddingHorizontal: 16,
  },
  tabBtn: {
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: 100,
  },
  tabBtnActive: {
    borderColor: "#2563EB",
    minWidth: 80,
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
  reelsLoadingBox: {
    paddingVertical: 50,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  reelsLoadingText: {
    fontSize: 14,
    fontWeight: "600",
  },
  reelsGalleryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 1,
    paddingBottom: 24,
  },
  reelGalleryCard: {
    overflow: "hidden",
    position: "relative",
  },
  reelGalleryThumb: {
    width: "100%",
    height: "100%",
  },
  reelGalleryPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1E293B",
  },
  reelPinBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  reelCardScrim: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 48,
    // backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  reelCardViewBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.40)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    zIndex: 2,
  },
  reelCardViewCount: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  sectionCard: {
    borderRadius: 12,
    padding: 8,
    // borderWidth: StyleSheet.hairlineWidth,
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
    marginTop: 20,
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
    borderRadius: 100,
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
    // borderWidth: StyleSheet.hairlineWidth,
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
    borderBottomWidth: 1,
    borderTopWidth: 1,
    marginBottom: 14,
    margin: -15,
    marginTop: 0,
    padding: 8,
    overflow: "visible",
    position: "relative",
  },
  fbPostHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingTop: 4,
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
    paddingHorizontal: 8,
    paddingBottom: 10,
    paddingTop: 8,
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
  coverCameraBtn: {
    position: "absolute",
    bottom: 12,
    right: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
  },
  coverCameraText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  avatarCameraBtn: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#1877F2",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  editModalContainer: {
    flex: 1,
  },
  editModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  editModalCloseBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  editModalTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  editModalSaveBtn: {
    backgroundColor: "#1877F2",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  editModalSaveBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  editModalScroll: {
    flex: 1,
  },
  editModalScrollContent: {
    padding: 16,
    gap: 16,
  },
  editSection: {
    paddingBottom: 20,
    // borderBottomWidth: StyleSheet.hairlineWidth,
  },
  editSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  editSectionTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  editSectionDesc: {
    fontSize: 13,
    marginBottom: 10,
    lineHeight: 18,
  },
  editSectionActionBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  editSectionActionText: {
    color: "#1877F2",
    fontSize: 15,
    fontWeight: "600",
  },
  editAvatarPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 14,
  },
  editAvatarPreview: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  editAvatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  editAvatarPlaceholderText: {
    fontSize: 28,
    fontWeight: "700",
    color: "#2563EB",
  },
  chooseDevicePhotoBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  chooseDevicePhotoText: {
    fontSize: 14,
    fontWeight: "600",
  },
  presetSectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  presetsScroll: {
    gap: 10,
    paddingVertical: 4,
  },
  presetAvatarItem: {
    width: 58,
    height: 58,
    borderRadius: 29,
    padding: 2,
    position: "relative",
  },
  presetItemActive: {
    borderWidth: 2.5,
    borderColor: "#1877F2",
  },
  presetAvatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 29,
  },
  presetCheckmark: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: "#1877F2",
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  editCoverPreviewWrap: {
    width: "100%",
    height: 130,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
    marginBottom: 14,
  },
  editCoverPreview: {
    width: "100%",
    height: "100%",
  },
  editCoverOverlayBtn: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 100,
  },
  editCoverOverlayText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  presetCoverItem: {
    width: 100,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: "rgba(150, 150, 150, 0.2)",
  },
  presetCoverImage: {
    width: "100%",
    height: 60,
  },
  presetCoverLabel: {
    fontSize: 11,
    padding: 4,
    textAlign: "center",
    fontWeight: "600",
  },
  presetCheckmarkCover: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#1877F2",
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  editBioInput: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: "top",
    minHeight: 80,
  },
  editFieldGroup: {
    marginBottom: 14,
  },
  editFieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  editTextInput: {
    height: 48,
    borderRadius: 100,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  saveProfileFullBtn: {
    backgroundColor: "#1877F2",
    borderRadius: 100,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    shadowColor: "#1877F2",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  saveProfileFullBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  // ─── FRIENDS HORIZONTAL SECTION STYLES (MATCHING USER SCREENSHOT) ───
  allTabFriendsCard: {
    paddingVertical: 8,
    marginBottom: 8,
  },
  allTabFriendsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  allTabFriendsTitle: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  allTabSeeAllText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#2563EB",
  },
  emptyFriendsInlineRow: {
    paddingVertical: 14,
  },
  emptyFriendsInlineText: {
    fontSize: 13,
    lineHeight: 18,
  },
  friendsHorizontalScroll: {
    paddingRight: 16,
    gap: 14,
  },
  circularFriendItem: {
    alignItems: "center",
    width: 80,
  },
  circularFriendAvatarWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1.5,
    overflow: "hidden",
    backgroundColor: "#F1F5F9",
    marginBottom: 8,
  },
  circularFriendAvatar: {
    width: "100%",
    height: "100%",
    borderRadius: 34,
  },
  circularFriendAvatarFallback: {
    width: "100%",
    height: "100%",
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  circularFriendInitial: {
    fontSize: 22,
    fontWeight: "700",
  },
  circularFriendName: {
    fontSize: 12.5,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 16,
    marginBottom: 2,
    height: 32,
  },
  circularFriendSubtitle: {
    fontSize: 11,
    textAlign: "center",
    lineHeight: 14,
  },

  // ─── ALL POSTS SECTION ───
  allPostsSection: {
    paddingTop: 0,
  },
  allPostsHeaderRow: {
    // paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  allPostsHeading: {
    fontSize: 19,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  profileQuickPostCard: {
    // marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 12,
    backgroundColor: "#333333",
  },
  profileQuickPostRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  profileQuickPostAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  profileQuickPostAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  profileQuickPostAvatarInitial: {
    fontSize: 16,
    fontWeight: "700",
  },
  profileQuickPostInputTrigger: {
    flex: 1,
    marginHorizontal: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
  },
  profileQuickPostInputPlaceholder: {
    fontSize: 14,
  },
  profileQuickPostMediaBtn: {
    padding: 6,
  },
  profileQuickPostDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 10,
  },
  profileQuickPostActionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  profileActionShortcutPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  profileActionShortcutText: {
    fontSize: 13,
    fontWeight: "600",
  },

  // ─── ALL FRIENDS MODAL STYLES ───
  allFriendsModalContainer: {
    flex: 1,
  },
  allFriendsModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  allFriendsModalCloseBtn: {
    padding: 4,
  },
  allFriendsModalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  allFriendsModalSub: {
    fontSize: 12,
    marginTop: 2,
  },
  allFriendsSearchBox: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
  },
  allFriendsSearchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  allFriendsEmptyBox: {
    alignItems: "center",
    paddingVertical: 40,
  },
  allFriendsEmptyTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginTop: 10,
  },
  allFriendsListItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  allFriendsListAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  allFriendsListAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  allFriendsListInitial: {
    fontSize: 18,
    fontWeight: "700",
  },
  allFriendsListName: {
    fontSize: 15,
    fontWeight: "600",
  },
  allFriendsListSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
});
