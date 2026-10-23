import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  Share,
  RefreshControl,
  Platform,
  StatusBar,
  Modal,
  BackHandler,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { auth } from "../firebase/config";
import {
  communityService,
  CommunityPost,
  CommunityCategory,
  CommunityFriendship,
  CommunityMember,
  CommunityStory,
  CommunityReel,
  CommunityReelComment,
  ReelCategory,
  ReactionType,
  CATEGORY_LABELS,
  formatAuthorDisplayName,
  FB_6_REACTIONS,
  isStoryActive,
  calculateStoryTimeRemaining,
  resolveUserAvatarUrl,
  getReelVideoType,
  getDailyShuffledReels,
} from "../services/communityService";
import { CreatePostModal } from "../components/CreatePostModal";
import { PostCommentsModal } from "../components/PostCommentsModal";
import { CreateStoryModal } from "../components/CreateStoryModal";
import { StoryViewerModal } from "../components/StoryViewerModal";
import { EditStoryModal } from "../components/EditStoryModal";
import { UserProfileScreen, UserProfileInfo } from "./UserProfileScreen";
import { FullScreenImageViewerModal } from "../components/FullScreenImageViewerModal";
import { SmoothBottomSheetModal } from "../components/SmoothBottomSheetModal";
import { CreateReelModal } from "../components/CreateReelModal";
import { ReelCommentsModal } from "../components/ReelCommentsModal";
import { SplitzyReelItem } from "../components/SplitzyReelItem";

const safeCopyTextAsync = async (text: string): Promise<boolean> => {
  try {
    const Clipboard = require("expo-clipboard");
    if (Clipboard?.setStringAsync) {
      await Clipboard.setStringAsync(text);
      return true;
    }
  } catch {}
  return false;
};

const AVATAR_PALETTES = [
  { bg: "#EFF6FF", text: "#2563EB", darkBg: "#1E293B", darkText: "#60A5FA" },
  { bg: "#FEF3C7", text: "#D97706", darkBg: "#33220A", darkText: "#FBBF24" },
  { bg: "#F3E8FF", text: "#7E22CE", darkBg: "#2B1A3D", darkText: "#C084FC" },
  { bg: "#E0F2FE", text: "#0284C7", darkBg: "#0C2E4E", darkText: "#38BDF8" },
  { bg: "#DCFCE7", text: "#16A34A", darkBg: "#0F331E", darkText: "#4ADE80" },
  { bg: "#FEE2E2", text: "#DC2626", darkBg: "#3B1414", darkText: "#F87171" },
  { bg: "#FCE7F3", text: "#DB2777", darkBg: "#3B1528", darkText: "#F472B6" },
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function getAvatarPalette(str: string, isDark: boolean) {
  const index = Math.abs(hashString(str || "Splitzy")) % AVATAR_PALETTES.length;
  const p = AVATAR_PALETTES[index];
  return {
    bg: isDark ? p.darkBg : p.bg,
    text: isDark ? p.darkText : p.text,
  };
}

export { FB_6_REACTIONS };

export interface CommunityInitialTarget {
  type?: "post" | "story" | "comment" | "reaction" | "friend_request" | string;
  postId?: string;
  storyId?: string;
  commentId?: string;
  senderId?: string;
}

interface CommunityScreenProps {
  onBack: () => void;
  currentUser?: {
    uid?: string;
    name?: string;
    displayName?: string;
    email?: string;
    role?: string;
    householdName?: string;
    photoURL?: string;
    profilePicture?: string;
  };
  onOpenDirectChat?: (
    targetUserId: string,
    targetUserName: string,
    targetUserAvatar?: string,
  ) => void;
  onNavigateToSplitzyProfile?: () => void;
  initialTarget?: CommunityInitialTarget | null;
  onClearInitialTarget?: () => void;
  onProfileUpdated?: (updated: UserProfileInfo) => void;
}

const CATEGORIES: CommunityCategory[] = [
  "all",
  "general",
  "roommate_tips",
  "items_sale",
  "looking_for_roomie",
  "events",
  "bills_advice",
];

export const CommunityScreen: React.FC<CommunityScreenProps> = ({
  onBack,
  currentUser = {},
  onOpenDirectChat,
  onNavigateToSplitzyProfile,
  initialTarget,
  onClearInitialTarget,
  onProfileUpdated,
}) => {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();

  // Active top tab: "feed", "reels", or "network"
  const [activeMainTab, setActiveMainTab] = useState<
    "feed" | "reels" | "network"
  >("feed");

  // Reels states
  const [reels, setReels] = useState<CommunityReel[]>([]);
  const [loadingReels, setLoadingReels] = useState(true);
  const [activeReelIndex, setActiveReelIndex] = useState(0);
  const [isReelsMuted, setIsReelsMuted] = useState(false);
  const [selectedReelCategory, setSelectedReelCategory] =
    useState<ReelCategory>("all");
  const [createReelVisible, setCreateReelVisible] = useState(false);
  const [activeReelForComments, setActiveReelForComments] =
    useState<CommunityReel | null>(null);
  const [reelsViewportHeight, setReelsViewportHeight] = useState(650);

  // Feed states
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] =
    useState<CommunityCategory>("all");
  const [feedScope, setFeedScope] = useState<"all" | "friends" | "my">("all");

  // Stories states
  const [cloudStories, setCloudStories] = useState<CommunityStory[]>([]);
  const [createStoryVisible, setCreateStoryVisible] = useState(false);
  const [storyViewerVisible, setStoryViewerVisible] = useState(false);
  const [selectedStoryIndex, setSelectedStoryIndex] = useState(0);
  const [editingStory, setEditingStory] = useState<CommunityStory | null>(null);
  const [storyActionTarget, setStoryActionTarget] =
    useState<CommunityStory | null>(null);
  const [showStoryArchive, setShowStoryArchive] = useState(false);
  const [viewingArchiveList, setViewingArchiveList] = useState<
    CommunityStory[]
  >([]);

  // Modals
  const [createPostVisible, setCreatePostVisible] = useState(false);
  const [activePostForComments, setActivePostForComments] =
    useState<CommunityPost | null>(null);
  const [activePostForMenu, setActivePostForMenu] =
    useState<CommunityPost | null>(null);
  const [failedAvatarUids, setFailedAvatarUids] = useState<Set<string>>(
    new Set(),
  );

  // Friendships & Discovery states
  const [friendships, setFriendships] = useState<CommunityFriendship[]>([]);
  const [allAcceptedFriendships, setAllAcceptedFriendships] = useState<
    CommunityFriendship[]
  >([]);
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
  const [networkSubTab, setNetworkSubTab] = useState<
    "discover" | "requests" | "friends"
  >("discover");
  const [friendsFilter, setFriendsFilter] = useState<
    "all" | "suggestions" | "friends"
  >("all");
  const [showNetworkSearch, setShowNetworkSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [discoveredMembers, setDiscoveredMembers] = useState<CommunityMember[]>(
    [],
  );
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [processingActionId, setProcessingActionId] = useState<string | null>(
    null,
  );
  const [dismissedSuggestionUids, setDismissedSuggestionUids] = useState<
    Set<string>
  >(new Set());
  const [activeReactionPostId, setActiveReactionPostId] = useState<
    string | null
  >(null);

  // User Profile full-screen state
  const [selectedProfileUser, setSelectedProfileUser] =
    useState<UserProfileInfo | null>(null);

  const currentUid = auth.currentUser?.uid || currentUser.uid || "";
  const currentDisplayName = formatAuthorDisplayName(
    currentUser.displayName || currentUser.name,
    currentUser.email || auth.currentUser?.email,
  );
  const currentAvatar =
    currentUser.photoURL || currentUser.profilePicture || "";

  const handleOpenMyProfile = () => {
    setSelectedProfileUser({
      uid: currentUid,
      name: currentDisplayName,
      email: currentUser.email || auth.currentUser?.email || "",
      avatar: currentAvatar,
      role: currentUser.role || "Resident Member",
      householdName: currentUser.householdName || undefined,
      friendshipStatus: "none",
    });
  };

  // Subscribe to real-time posts
  useEffect(() => {
    setLoadingPosts(true);
    const unsub = communityService.subscribePosts((list) => {
      setPosts(list);
      setLoadingPosts(false);
      setRefreshing(false);
    });

    return () => unsub();
  }, []);

  // Subscribe to real-time stories
  useEffect(() => {
    const unsub = communityService.subscribeStories((list) => {
      setCloudStories(list);
    });
    return () => unsub();
  }, []);

  // Subscribe to real-time reels with deterministic daily shuffling
  useEffect(() => {
    setLoadingReels(true);
    const unsub = communityService.subscribeReels((list) => {
      const shuffled = getDailyShuffledReels(list);
      setReels(shuffled);
      setLoadingReels(false);
    });
    return () => unsub();
  }, []);

  // Intercept hardware Android back button to navigate from Reels back to Feed
  useEffect(() => {
    const onHardwareBack = () => {
      if (selectedProfileUser) {
        setSelectedProfileUser(null);
        return true;
      }
      if (activeMainTab === "reels") {
        setActiveMainTab("feed");
        return true;
      }
      return false;
    };

    const backSub = BackHandler.addEventListener(
      "hardwareBackPress",
      onHardwareBack,
    );
    return () => backSub.remove();
  }, [activeMainTab, selectedProfileUser]);

  // Filter reels based on selected category (including YouTube Shorts and Facebook Reels)
  const filteredReels = useMemo(() => {
    if (selectedReelCategory === "all") return reels;
    if (selectedReelCategory === "youtube_shorts") {
      return reels.filter((r) => getReelVideoType(r.videoUrl) === "youtube");
    }
    if (selectedReelCategory === "facebook_reels") {
      return reels.filter((r) => getReelVideoType(r.videoUrl) === "facebook");
    }
    return reels.filter((r) => r.category === selectedReelCategory);
  }, [reels, selectedReelCategory]);

  const handleToggleReelLike = useCallback(
    async (reelId: string) => {
      if (!currentUid) {
        Alert.alert("Sign In Required", "Please sign in to like reels.");
        return;
      }
      setReels((prev) =>
        prev.map((r) => {
          if (r.id !== reelId) return r;
          const currentLikes = r.likes || [];
          const isLiked = currentLikes.includes(currentUid);
          const newLikes = isLiked
            ? currentLikes.filter((uid) => uid !== currentUid)
            : [...currentLikes, currentUid];
          return {
            ...r,
            likes: newLikes,
            likesCount: newLikes.length,
          };
        }),
      );
      try {
        await communityService.toggleReelLike(reelId, currentUid);
      } catch (err) {
        console.warn("Failed to toggle reel like:", err);
      }
    },
    [currentUid],
  );

  const handleDeleteReel = useCallback(
    (reelId: string) => {
      Alert.alert(
        "Delete Reel",
        "Are you sure you want to delete this reel? This cannot be undone.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                setReels((prev) => prev.filter((r) => r.id !== reelId));
                await communityService.deleteReel(reelId, currentUid);
              } catch (err: any) {
                Alert.alert("Error", err.message || "Failed to delete reel.");
              }
            },
          },
        ],
      );
    },
    [currentUid],
  );

  // Subscribe to friendships
  useEffect(() => {
    if (!currentUid) return;
    const unsub = communityService.subscribeFriendships(currentUid, (list) => {
      setFriendships(list);
    });
    return () => unsub();
  }, [currentUid]);

  // Subscribe to all accepted friendships to compute real deduplicated mutual friends
  useEffect(() => {
    const unsub = communityService.subscribeAllAcceptedFriendships((list) => {
      setAllAcceptedFriendships(list);
    });
    return () => unsub();
  }, []);

  // Load members for People You May Know & Discovery
  const loadMembers = useCallback(async () => {
    if (!currentUid) return;
    setLoadingMembers(true);
    try {
      const members = await communityService.discoverMembers(
        currentUid,
        friendships,
        searchQuery,
      );
      setDiscoveredMembers(members);
    } catch (err) {
      console.warn("Failed to load members:", err);
    } finally {
      setLoadingMembers(false);
    }
  }, [currentUid, friendships, searchQuery]);

  // Initial load & when network tab opens
  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  // Map of uid to latest cloud avatar URL from live user records
  const userLiveAvatarMap = useMemo(() => {
    const map = new Map<string, string>();
    discoveredMembers.forEach((m) => {
      const a = (m.avatar || "").trim();
      if (a) {
        map.set(m.uid, a);
        map.set(`mem_${m.uid}`, a);
      }
    });
    // Also include currentUser's latest avatar
    const myPic = (
      currentUser.photoURL ||
      currentUser.profilePicture ||
      ""
    ).trim();
    if (currentUid && myPic) {
      map.set(currentUid, myPic);
      map.set(`mem_${currentUid}`, myPic);
    }
    return map;
  }, [discoveredMembers, currentUser, currentUid]);

  const resolveMemberAvatar = useCallback(
    (uid?: string, fallbackAvatar?: string) => {
      if (!uid) return resolveUserAvatarUrl(fallbackAvatar);
      const cleanUid = String(uid).replace(/^mem_/, "").trim();
      const livePic =
        userLiveAvatarMap.get(cleanUid) ||
        userLiveAvatarMap.get(`mem_${cleanUid}`);
      return resolveUserAvatarUrl(livePic || fallbackAvatar);
    },
    [userLiveAvatarMap],
  );

  // Accepted friends count & IDs
  const acceptedFriends = useMemo(() => {
    return friendships.filter((f) => f.status === "accepted");
  }, [friendships]);

  const acceptedFriendUids = useMemo(() => {
    return acceptedFriends.map((f) =>
      f.senderId === currentUid ? f.receiverId : f.senderId,
    );
  }, [acceptedFriends, currentUid]);

  // 100% Real cloud-synced stories (Active within 24 hours only, with Friends-Only privacy)
  const displayStories = useMemo(() => {
    const friendUidSet = new Set(
      acceptedFriendUids.map((id) => String(id).replace(/^mem_/, "").trim()),
    );
    const cleanCurUid = String(currentUid).replace(/^mem_/, "").trim();
    return cloudStories.filter((s) => {
      if (!isStoryActive(s)) return false;
      const cleanAuthorId = String(s.authorId || "")
        .replace(/^mem_/, "")
        .trim();
      return cleanAuthorId === cleanCurUid || friendUidSet.has(cleanAuthorId);
    });
  }, [cloudStories, acceptedFriendUids, currentUid]);

  // Current user's archived stories (expired after 24h or manually archived)
  const myArchivedStories = useMemo(() => {
    if (!currentUid) return [];
    return cloudStories.filter(
      (s) =>
        (s.authorId === currentUid ||
          s.authorId === `mem_${currentUid}` ||
          `mem_${s.authorId}` === currentUid) &&
        (!isStoryActive(s) || s.isArchived),
    );
  }, [cloudStories, currentUid]);

  // All stories created by the current user
  const myAllStories = useMemo(() => {
    if (!currentUid) return [];
    return cloudStories.filter(
      (s) =>
        s.authorId === currentUid ||
        s.authorId === `mem_${currentUid}` ||
        `mem_${s.authorId}` === currentUid,
    );
  }, [cloudStories, currentUid]);

  // Deep link handler when tapped from a push notification
  const handledInitialTargetRef = useRef<string | null>(null);

  useEffect(() => {
    if (!initialTarget) return;
    const targetKey = `${initialTarget.type}_${initialTarget.postId || ""}_${initialTarget.storyId || ""}_${initialTarget.commentId || ""}`;
    if (handledInitialTargetRef.current === targetKey) return;

    if (initialTarget.storyId && displayStories.length > 0) {
      const idx = displayStories.findIndex(
        (s) => s.id === initialTarget.storyId,
      );
      if (idx !== -1) {
        handledInitialTargetRef.current = targetKey;
        setSelectedStoryIndex(idx);
        setStoryViewerVisible(true);
        if (onClearInitialTarget) onClearInitialTarget();
      }
    } else if (initialTarget.postId && posts.length > 0) {
      const foundPost = posts.find((p) => p.id === initialTarget.postId);
      if (foundPost) {
        handledInitialTargetRef.current = targetKey;
        setActiveMainTab("feed");
        if (initialTarget.type === "comment" || initialTarget.commentId) {
          setActivePostForComments(foundPost);
        }
        if (onClearInitialTarget) onClearInitialTarget();
      }
    } else if (
      initialTarget.type === "friend_request" ||
      (initialTarget as any).senderId
    ) {
      handledInitialTargetRef.current = targetKey;
      setActiveMainTab("network");
      setFriendsFilter("all");
      if (onClearInitialTarget) onClearInitialTarget();
    }
  }, [initialTarget, displayStories, posts, onClearInitialTarget]);

  // Story management handlers
  const handleDeleteStory = useCallback(async (story: CommunityStory) => {
    try {
      await communityService.deleteStory(story.id);
      setCloudStories((prev) => prev.filter((s) => s.id !== story.id));
      setStoryViewerVisible(false);
      setStoryActionTarget(null);
      Alert.alert("Story Deleted", "Your story has been permanently removed.");
    } catch (err: any) {
      console.warn("Failed to delete story:", err);
      Alert.alert("Delete Failed", err?.message || "Could not delete story.");
    }
  }, []);

  const handleStoryUpdated = useCallback((updated: CommunityStory) => {
    setCloudStories((prev) =>
      prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)),
    );
    setEditingStory(null);
  }, []);

  // Real incoming requests from Firestore only
  const allIncomingRequests = useMemo(() => {
    return friendships.filter(
      (f) => f.receiverId === currentUid && f.status === "pending",
    );
  }, [friendships, currentUid]);

  // Pending incoming requests count
  const incomingRequests = allIncomingRequests;

  // Suggestions for "People You May Know"
  const peopleYouMayKnow = useMemo(() => {
    const incomingSenderIds = new Set(
      allIncomingRequests.map((r) => r.senderId),
    );
    return discoveredMembers.filter((m) => {
      if (m.uid === currentUid) return false;
      if (dismissedSuggestionUids.has(m.uid)) return false;
      if (m.friendshipStatus === "friends") return false;
      if (incomingSenderIds.has(m.uid)) return false;
      return true;
    });
  }, [
    discoveredMembers,
    currentUid,
    dismissedSuggestionUids,
    allIncomingRequests,
  ]);

  // Handler to open Facebook-style user profile view (100% real cloud data)
  const handleOpenUserProfile = useCallback(
    (userInfo: {
      uid: string;
      name?: string;
      email?: string;
      avatar?: string;
      coverImage?: string;
      role?: string;
      householdName?: string;
      bio?: string;
      location?: string;
      mutualFriendsCount?: number;
      friendsCount?: number;
    }) => {
      const discMatch = discoveredMembers.find((m) => m.uid === userInfo.uid);

      let friendshipStatus: UserProfileInfo["friendshipStatus"] = "none";
      let friendshipId: string | undefined = undefined;

      const rel = friendships.find(
        (f) =>
          (f.senderId === currentUid && f.receiverId === userInfo.uid) ||
          (f.receiverId === currentUid && f.senderId === userInfo.uid),
      );

      if (rel) {
        friendshipId = rel.id;
        if (rel.status === "accepted") {
          friendshipStatus = "friends";
        } else if (rel.status === "pending") {
          friendshipStatus =
            rel.senderId === currentUid ? "pending_sent" : "pending_received";
        }
      } else if (allIncomingRequests.some((r) => r.senderId === userInfo.uid)) {
        const foundReq = allIncomingRequests.find(
          (r) => r.senderId === userInfo.uid,
        );
        friendshipStatus = "pending_received";
        friendshipId = foundReq?.id;
      } else if (discMatch) {
        friendshipStatus = discMatch.friendshipStatus;
        friendshipId = discMatch.friendshipId;
      }

      const cleanName = formatAuthorDisplayName(
        userInfo.name || discMatch?.name,
        userInfo.email || discMatch?.email,
      );

      const resolved: UserProfileInfo = {
        uid: userInfo.uid,
        name: cleanName,
        email: userInfo.email || discMatch?.email || "",
        avatar: userInfo.avatar || discMatch?.avatar || "",
        coverImage:
          userInfo.coverImage ||
          "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80",
        role: userInfo.role || discMatch?.role || "Splitzy Resident",
        householdName: userInfo.householdName || discMatch?.householdName || "",
        bio:
          userInfo.bio ||
          "Splitting bills, sharing space, and creating memories with great roommates! 🏡✨",
        location: userInfo.location || "San Francisco, CA",
        joinedDate: "October 2024",
        friendshipStatus,
        friendshipId,
      };

      setSelectedProfileUser(resolved);
    },
    [discoveredMembers, friendships, currentUid, allIncomingRequests],
  );

  // Stable FlatList viewability configuration to prevent VirtualizedList lag
  const viewabilityConfigRef = useRef({
    itemVisiblePercentThreshold: 60,
    minimumViewTime: 100,
  });

  const onViewableItemsChangedRef = useRef(
    ({ viewableItems }: { viewableItems: any[] }) => {
      if (viewableItems && viewableItems.length > 0) {
        const firstVisible = viewableItems[0];
        if (typeof firstVisible.index === "number" && firstVisible.index >= 0) {
          setActiveReelIndex(firstVisible.index);
        }
      }
    },
  );

  const getReelItemLayout = useCallback(
    (_: any, index: number) => ({
      length: reelsViewportHeight,
      offset: reelsViewportHeight * index,
      index,
    }),
    [reelsViewportHeight],
  );

  const reelKeyExtractor = useCallback((item: CommunityReel) => item.id, []);

  const handleToggleReelMute = useCallback(() => {
    setIsReelsMuted((prev) => !prev);
  }, []);

  const renderReelItem = useCallback(
    ({ item, index }: { item: CommunityReel; index: number }) => (
      <SplitzyReelItem
        reel={item}
        isActive={activeReelIndex === index}
        isMuted={isReelsMuted}
        onToggleMute={handleToggleReelMute}
        onToggleLike={handleToggleReelLike}
        onOpenComments={setActiveReelForComments}
        onOpenProfile={(uid, name, avatar) =>
          handleOpenUserProfile({ uid, name, avatar })
        }
        onDeleteReel={handleDeleteReel}
        onActivate={() => setActiveReelIndex(index)}
        currentUserId={currentUid}
        itemHeight={reelsViewportHeight}
      />
    ),
    [
      activeReelIndex,
      isReelsMuted,
      handleToggleReelMute,
      handleToggleReelLike,
      handleOpenUserProfile,
      handleDeleteReel,
      currentUid,
      reelsViewportHeight,
    ],
  );

  // Filter posts
  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      if (selectedCategory !== "all" && post.category !== selectedCategory) {
        return false;
      }
      if (feedScope === "my") {
        return post.authorId === currentUid;
      }
      if (feedScope === "friends") {
        return (
          post.authorId === currentUid ||
          acceptedFriendUids.includes(post.authorId)
        );
      }
      return true;
    });
  }, [posts, selectedCategory, feedScope, currentUid, acceptedFriendUids]);

  // Pull to refresh
  const onRefresh = () => {
    setRefreshing(true);
    loadMembers().finally(() => setRefreshing(false));
  };

  // React with any of the 6 Facebook emojis
  const handleSelectReaction = async (
    post: CommunityPost,
    reactionType: ReactionType,
  ) => {
    if (!currentUid) {
      Alert.alert("Sign In Required", "Please sign in to react to posts.");
      return;
    }
    setActiveReactionPostId(null);

    // Optimistic local state update
    setPosts((prevPosts) =>
      prevPosts.map((p) => {
        if (p.id !== post.id) return p;
        const currentLikes = p.likes || [];
        const currentReactions = p.reactions ? { ...p.reactions } : {};
        const isCurrentReaction = currentReactions[currentUid] === reactionType;

        let newLikes: string[];
        if (isCurrentReaction) {
          newLikes = currentLikes.filter((id) => id !== currentUid);
          delete currentReactions[currentUid];
        } else {
          newLikes = currentLikes.includes(currentUid)
            ? currentLikes
            : [...currentLikes, currentUid];
          currentReactions[currentUid] = reactionType;
        }

        return {
          ...p,
          likes: newLikes,
          reactions: currentReactions,
        };
      }),
    );

    try {
      await communityService.reactToPost(
        post.id,
        post.likes || [],
        post.reactions || {},
        reactionType,
      );
    } catch (err) {
      console.warn("Failed to react to post:", err);
    }
  };

  // Like handler (tap toggles: if reacted, unreacts; if not, sets "like")
  const handleToggleLike = async (post: CommunityPost) => {
    if (!currentUid) {
      Alert.alert("Sign In Required", "Please sign in to react to posts.");
      return;
    }
    const existingReaction = post.reactions?.[currentUid];
    const targetReaction: ReactionType = existingReaction || "like";
    await handleSelectReaction(post, targetReaction);
  };

  // Like story
  const handleLikeStory = async (story: CommunityStory) => {
    try {
      await communityService.toggleLikeStory(story.id, story.likes || []);
    } catch (err) {
      console.warn("Failed to like story:", err);
    }
  };

  // Delete post handler
  const handleDeletePost = (post: CommunityPost) => {
    Alert.alert(
      "Delete Post",
      "Are you sure you want to delete this post? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await communityService.deletePost(post.id);
            } catch (err) {
              console.warn("Failed to delete post:", err);
            }
          },
        },
      ],
    );
  };

  // Share post
  const handleSharePost = async (post: CommunityPost) => {
    try {
      const authorText = resolvePostAuthorName(post);
      await Share.share({
        message: `[Splitzy Community] ${authorText} posted: "${post.content}"\n\nJoin the roommate community on Splitzy!`,
        title: "Splitzy Community Post",
      });
    } catch {
      // user dismissed
    }
  };

  // Dynamically compute real mutual friend count between current user and target user
  const computeMutualFriendsCount = useCallback(
    (targetUid?: string) => {
      if (!currentUid || !targetUid) return 0;
      const cleanTarget = String(targetUid).replace(/^mem_/, "").trim();
      const cleanCur = String(currentUid).replace(/^mem_/, "").trim();
      if (!cleanTarget || !cleanCur || cleanTarget === cleanCur) return 0;

      // Unique friends of current user
      const myFriends = new Set<string>();
      const addIfFriend = (
        set: Set<string>,
        user: string,
        f: CommunityFriendship,
      ) => {
        const s = String(f.senderId || "")
          .replace(/^mem_/, "")
          .trim();
        const r = String(f.receiverId || "")
          .replace(/^mem_/, "")
          .trim();
        if (s === user && r && r !== user) set.add(r);
        if (r === user && s && s !== user) set.add(s);
      };

      allAcceptedFriendships.forEach((f) =>
        addIfFriend(myFriends, cleanCur, f),
      );
      acceptedFriends.forEach((f) => addIfFriend(myFriends, cleanCur, f));

      // Unique friends of target user
      const targetFriends = new Set<string>();
      allAcceptedFriendships.forEach((f) =>
        addIfFriend(targetFriends, cleanTarget, f),
      );

      let count = 0;
      myFriends.forEach((fid) => {
        if (targetFriends.has(fid)) count++;
      });
      return count;
    },
    [currentUid, allAcceptedFriendships, acceptedFriends],
  );

  const formatFriendSubtitle = useCallback(
    (targetUid: string, householdName?: string) => {
      const mutualCount = computeMutualFriendsCount(targetUid);
      if (mutualCount > 0) {
        return `Splitzy Friend • ${mutualCount} mutual friend${mutualCount === 1 ? "" : "s"}`;
      }
      if (householdName) {
        return `Splitzy Friend • ${householdName}`;
      }
      return "Splitzy Friend • Roommate in Splitzy";
    },
    [computeMutualFriendsCount],
  );

  const formatPymkSubtitle = useCallback(
    (targetUid: string, householdName?: string) => {
      const mutualCount = computeMutualFriendsCount(targetUid);
      if (mutualCount > 0) {
        return `${mutualCount} mutual friend${mutualCount === 1 ? "" : "s"} • Splitzy Resident`;
      }
      return householdName
        ? `${householdName} • Splitzy Resident`
        : "Suggested for you • Splitzy Resident";
    },
    [computeMutualFriendsCount],
  );

  // Send friend request with instant optimistic UI update on first tap
  const handleSendFriendRequest = async (member: CommunityMember) => {
    const rawSenderId = auth.currentUser?.uid || currentUid;
    const cleanSender = String(rawSenderId).replace(/^mem_/, "").trim();
    const cleanReceiver = String(member.uid).replace(/^mem_/, "").trim();
    if (!cleanSender || !cleanReceiver || cleanSender === cleanReceiver) return;

    const pairKey = [cleanSender, cleanReceiver].sort().join("_");
    const friendshipDocId = `friendship_${pairKey}`;

    // 1. Instant optimistic state update on the first tap: disables button and shows "Requested"
    setDiscoveredMembers((prev) =>
      prev.map((m) => {
        const mClean = String(m.uid).replace(/^mem_/, "").trim();
        if (mClean === cleanReceiver) {
          return {
            ...m,
            friendshipStatus: "pending_sent",
            friendshipId: friendshipDocId,
          };
        }
        return m;
      }),
    );

    setSelectedProfileUser((prev) => {
      if (!prev) return null;
      const pClean = String(prev.uid).replace(/^mem_/, "").trim();
      if (pClean === cleanReceiver) {
        return {
          ...prev,
          friendshipStatus: "pending_sent",
          friendshipId: friendshipDocId,
        };
      }
      return prev;
    });

    try {
      setProcessingActionId(member.uid);
      await communityService.sendFriendRequest(
        {
          uid: cleanReceiver,
          name: member.name,
          avatar: member.avatar,
          email: member.email,
        },
        {
          name: currentDisplayName,
          avatar: currentAvatar,
          email: currentUser.email || auth.currentUser?.email,
        },
      );
    } catch (err: any) {
      console.warn("Failed to send friend request:", err);
      // Revert optimistic update on network failure
      setDiscoveredMembers((prev) =>
        prev.map((m) => {
          const mClean = String(m.uid).replace(/^mem_/, "").trim();
          if (mClean === cleanReceiver) {
            return {
              ...m,
              friendshipStatus: "none",
              friendshipId: undefined,
            };
          }
          return m;
        }),
      );
      Alert.alert("Error", err?.message || "Could not send friend request.");
    } finally {
      setProcessingActionId(null);
    }
  };

  // Accept friend request
  const handleAcceptRequest = async (friendshipId: string) => {
    try {
      setProcessingActionId(friendshipId);
      await communityService.acceptFriendRequest(friendshipId);
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Could not accept request.");
    } finally {
      setProcessingActionId(null);
    }
  };

  // Decline/cancel friend request
  const handleDeclineRequest = async (friendshipId: string) => {
    try {
      setProcessingActionId(friendshipId);
      await communityService.declineOrCancelFriendRequest(friendshipId);
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Could not remove request.");
    } finally {
      setProcessingActionId(null);
    }
  };

  const handleDismissSuggestion = (uid: string) => {
    setDismissedSuggestionUids((prev) => new Set([...prev, uid]));
  };

  const resolvePostAuthorName = useCallback(
    (post: CommunityPost) => {
      if (post.authorId === currentUid && currentDisplayName) {
        return currentDisplayName;
      }
      return formatAuthorDisplayName(post.authorName, post.authorEmail);
    },
    [currentUid, currentDisplayName],
  );

  const formatTimeAgo = (isoString?: string) => {
    if (!isoString) return "";
    const date = new Date(isoString);
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

    // Over 7 days: clean formatted calendar date
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

  // Render a Facebook-style post card
  const renderFacebookPostCard = (post: CommunityPost) => {
    const isLiked = currentUid ? post.likes.includes(currentUid) : false;
    const isAuthor = currentUid === post.authorId;
    const catConf = CATEGORY_LABELS[post.category] || CATEGORY_LABELS.general;
    const authorNameResolved = resolvePostAuthorName(post);
    const userReaction = currentUid ? post.reactions?.[currentUid] : undefined;
    const isLikedOrReacted = !!(isLiked || userReaction);

    const getReactionButtonDisplay = () => {
      if (userReaction === "love") {
        return {
          label: "Love",
          color: "#EF4444",
          icon: <Ionicons name="heart" size={18} color="#EF4444" />,
        };
      }
      if (userReaction === "haha") {
        return {
          label: "Haha",
          color: "#F59E0B",
          icon: <Text style={styles.fbReactBtnEmoji}>😆</Text>,
        };
      }
      if (userReaction === "wow") {
        return {
          label: "Wow",
          color: "#F59E0B",
          icon: <Text style={styles.fbReactBtnEmoji}>😮</Text>,
        };
      }
      if (userReaction === "sad") {
        return {
          label: "Sad",
          color: "#3B82F6",
          icon: <Text style={styles.fbReactBtnEmoji}>😢</Text>,
        };
      }
      if (userReaction === "angry") {
        return {
          label: "Angry",
          color: "#EA580C",
          icon: <Text style={styles.fbReactBtnEmoji}>😡</Text>,
        };
      }
      if (userReaction === "care") {
        return {
          label: "Care",
          color: "#F59E0B",
          icon: <Text style={styles.fbReactBtnEmoji}>🥰</Text>,
        };
      }
      if (userReaction === "like" || isLiked) {
        return {
          label: "Like",
          color: "#2563EB",
          icon: <Ionicons name="thumbs-up" size={18} color="#2563EB" />,
        };
      }
      return {
        label: "Like",
        color: isDark ? "#CBD5E1" : "#475569",
        icon: (
          <Ionicons
            name="thumbs-up-outline"
            size={18}
            color={isDark ? "#94A3B8" : "#64748B"}
          />
        ),
      };
    };

    const reactionBtnDisplay = getReactionButtonDisplay();

    // Distinct reaction types present on this post
    const presentReactionTypes: ReactionType[] = (() => {
      const set = new Set<ReactionType>();
      if (post.reactions) {
        Object.values(post.reactions).forEach((t) => set.add(t));
      }
      if (set.size === 0 && (post.likes?.length || 0) > 0) {
        set.add("like");
      }
      return Array.from(set);
    })();

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

        {/* Post Author Header (Facebook style) */}
        <View style={styles.fbPostHeader}>
          <TouchableOpacity
            onPress={() =>
              handleOpenUserProfile({
                uid: post.authorId,
                name: authorNameResolved,
                avatar: post.authorAvatar,
                email: post.authorEmail,
                role: post.authorRole,
                householdName: post.authorHouseholdName,
              })
            }
            activeOpacity={0.8}
            style={{
              flexDirection: "row",
              alignItems: "center",
              flex: 1,
            }}
          >
            {(() => {
              const liveAuthorAvatar = resolveMemberAvatar(
                post.authorId,
                post.authorAvatar,
              );
              const authorPalette = getAvatarPalette(
                post.authorId || authorNameResolved,
                isDark,
              );
              const authorFailed = failedAvatarUids.has(post.authorId);

              if (liveAuthorAvatar && !authorFailed) {
                return (
                  <Image
                    source={{ uri: liveAuthorAvatar }}
                    style={styles.fbPostAvatar}
                    onError={() =>
                      setFailedAvatarUids((prev) =>
                        new Set(prev).add(post.authorId),
                      )
                    }
                  />
                );
              }
              return (
                <View
                  style={[
                    styles.fbPostAvatarPlaceholder,
                    { backgroundColor: authorPalette.bg },
                  ]}
                >
                  <Text
                    style={[
                      styles.fbPostAvatarInitials,
                      { color: authorPalette.text, fontWeight: "700" },
                    ]}
                  >
                    {authorNameResolved.charAt(0).toUpperCase()}
                  </Text>
                </View>
              );
            })()}

            <View style={styles.fbPostAuthorInfo}>
              <View style={styles.fbAuthorNameRow}>
                <Text
                  style={[
                    styles.fbAuthorName,
                    { color: isDark ? "#F8FAFC" : "#0F172A" },
                  ]}
                >
                  {authorNameResolved}
                </Text>
                {post.authorRole === "HOST" && (
                  <View style={styles.hostBadge}>
                    <Text style={styles.hostBadgeText}>HOST</Text>
                  </View>
                )}
              </View>

              <View style={styles.fbMetaRow}>
                <Text
                  style={[
                    styles.fbTimeText,
                    { color: isDark ? "#94A3B8" : "#64748B" },
                  ]}
                >
                  {formatTimeAgo(post.createdAt)}
                </Text>
                <Text
                  style={[
                    styles.fbDotSeparator,
                    { color: isDark ? "#94A3B8" : "#64748B" },
                  ]}
                >
                  •
                </Text>

                {/* Category chip */}
                <View
                  style={[
                    styles.fbCategoryTag,
                    { backgroundColor: catConf.color + "15" },
                  ]}
                >
                  <Feather
                    name={catConf.icon as any}
                    size={10}
                    color={catConf.color}
                    style={{ marginRight: 3 }}
                  />
                  <Text
                    style={[styles.fbCategoryTagText, { color: catConf.color }]}
                  >
                    {catConf.label}
                  </Text>
                </View>

                <Text
                  style={[
                    styles.fbDotSeparator,
                    { color: isDark ? "#94A3B8" : "#64748B" },
                  ]}
                >
                  •
                </Text>
                <Ionicons
                  name="globe-outline"
                  size={12}
                  color={isDark ? "#94A3B8" : "#64748B"}
                />
              </View>
            </View>
          </TouchableOpacity>

          {/* Right Action Menu */}
          <TouchableOpacity
            onPress={() => setActivePostForMenu(post)}
            style={styles.fbMoreBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather
              name="more-horizontal"
              size={20}
              color={isDark ? "#94A3B8" : "#64748B"}
            />
          </TouchableOpacity>
        </View>

        {/* Post Text Content */}
        {post.content ? (
          <Text
            style={[
              styles.fbContentText,
              { color: isDark ? "#F1F5F9" : "#1E293B" },
            ]}
          >
            {post.content}
          </Text>
        ) : null}

        {/* Full-width Media Grid (Facebook style with Lightbox Viewer) */}
        {post.images && post.images.length > 0 && (
          <View style={styles.fbImagesContainer}>
            {post.images.length === 1 ? (
              <TouchableOpacity
                activeOpacity={0.92}
                onPress={() =>
                  setImageViewerConfig({
                    visible: true,
                    images: post.images,
                    initialIndex: 0,
                    authorName: resolvePostAuthorName(post),
                    caption: post.content,
                  })
                }
              >
                <Image
                  source={{ uri: post.images[0] }}
                  style={styles.fbSingleImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ) : (
              <View style={styles.fbMultiImageGrid}>
                {post.images.map((imgUri, idx) => (
                  <TouchableOpacity
                    key={idx}
                    activeOpacity={0.92}
                    style={{ flex: 1 }}
                    onPress={() =>
                      setImageViewerConfig({
                        visible: true,
                        images: post.images,
                        initialIndex: idx,
                        authorName: resolvePostAuthorName(post),
                        caption: post.content,
                      })
                    }
                  >
                    <Image
                      source={{ uri: imgUri }}
                      style={styles.fbGridImage}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Facebook Social Stats Row */}
        <View
          style={[
            styles.fbStatsRow,
            { borderTopColor: isDark ? "#334155" : "#F1F5F9" },
          ]}
        >
          <View style={styles.fbReactionGroup}>
            <View style={styles.fbReactionBubbles}>
              {presentReactionTypes.length === 0 ? (
                <View style={styles.fbLikeBubble}>
                  <Ionicons name="thumbs-up" size={10} color="#FFFFFF" />
                </View>
              ) : (
                presentReactionTypes.slice(0, 3).map((rType, rIdx) => {
                  if (rType === "love") {
                    return (
                      <View
                        key={rType}
                        style={[
                          styles.fbBubbleCircle,
                          {
                            backgroundColor: "#EF4444",
                            zIndex: 10 - rIdx,
                          },
                        ]}
                      >
                        <Ionicons name="heart" size={9} color="#FFFFFF" />
                      </View>
                    );
                  }
                  if (rType === "haha") {
                    return (
                      <View
                        key={rType}
                        style={[
                          styles.fbBubbleCircle,
                          {
                            backgroundColor: "#F59E0B",
                            zIndex: 10 - rIdx,
                          },
                        ]}
                      >
                        <Text style={styles.fbBubbleEmoji}>😆</Text>
                      </View>
                    );
                  }
                  if (rType === "wow") {
                    return (
                      <View
                        key={rType}
                        style={[
                          styles.fbBubbleCircle,
                          {
                            backgroundColor: "#F59E0B",
                            zIndex: 10 - rIdx,
                          },
                        ]}
                      >
                        <Text style={styles.fbBubbleEmoji}>😮</Text>
                      </View>
                    );
                  }
                  if (rType === "sad") {
                    return (
                      <View
                        key={rType}
                        style={[
                          styles.fbBubbleCircle,
                          {
                            backgroundColor: "#3B82F6",
                            zIndex: 10 - rIdx,
                          },
                        ]}
                      >
                        <Text style={styles.fbBubbleEmoji}>😢</Text>
                      </View>
                    );
                  }
                  if (rType === "angry") {
                    return (
                      <View
                        key={rType}
                        style={[
                          styles.fbBubbleCircle,
                          {
                            backgroundColor: "#EA580C",
                            zIndex: 10 - rIdx,
                          },
                        ]}
                      >
                        <Text style={styles.fbBubbleEmoji}>😡</Text>
                      </View>
                    );
                  }
                  return (
                    <View
                      key={rType}
                      style={[
                        styles.fbBubbleCircle,
                        {
                          backgroundColor: "#2563EB",
                          zIndex: 10 - rIdx,
                        },
                      ]}
                    >
                      <Ionicons name="thumbs-up" size={9} color="#FFFFFF" />
                    </View>
                  );
                })
              )}
            </View>
            <Text
              style={[
                styles.fbStatsText,
                { color: isDark ? "#94A3B8" : "#64748B" },
              ]}
            >
              {post.likes.length > 0
                ? isLikedOrReacted
                  ? post.likes.length === 1
                    ? "You"
                    : `You and ${post.likes.length - 1} other${
                        post.likes.length - 1 > 1 ? "s" : ""
                      }`
                  : `${post.likes.length}`
                : "Be the first to react"}
            </Text>
          </View>

          <View style={styles.fbRightStats}>
            <TouchableOpacity onPress={() => setActivePostForComments(post)}>
              <Text
                style={[
                  styles.fbStatsText,
                  { color: isDark ? "#94A3B8" : "#64748B" },
                ]}
              >
                {post.commentsCount}{" "}
                {post.commentsCount === 1 ? "comment" : "comments"}
              </Text>
            </TouchableOpacity>
            <Text
              style={[
                styles.fbDotSeparator,
                { color: isDark ? "#94A3B8" : "#64748B" },
              ]}
            >
              •
            </Text>
            <Text
              style={[
                styles.fbStatsText,
                { color: isDark ? "#94A3B8" : "#64748B" },
              ]}
            >
              {post.sharesCount || 0} shares
            </Text>
          </View>
        </View>

        {/* Facebook 3-Button Action Bar (with Floating Reaction Dock) */}
        <View style={styles.fbActionBarWrap}>
          {/* Floating Facebook Reactions Dock (Pops up when holding LIKE button) */}
          {activeReactionPostId === post.id && (
            <>
              {/* Invisible backdrop to dismiss dock on outside tap */}
              <TouchableOpacity
                style={styles.reactionBackdrop}
                onPress={() => setActiveReactionPostId(null)}
                activeOpacity={1}
              />
              <View
                style={[
                  styles.fbReactionDock,
                  {
                    backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                    borderColor: isDark ? "#334155" : "#E2E8F0",
                  },
                ]}
              >
                {FB_6_REACTIONS.map((reactItem) => {
                  const isSelected = userReaction === reactItem.type;
                  return (
                    <TouchableOpacity
                      key={reactItem.type}
                      onPress={() => handleSelectReaction(post, reactItem.type)}
                      style={[
                        styles.fbReactionDockItem,
                        isSelected && {
                          backgroundColor: isDark ? "#334155" : "#EFF6FF",
                        },
                      ]}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.fbReactionDockEmoji}>
                        {reactItem.emoji}
                      </Text>
                      <Text
                        style={[
                          styles.fbReactionDockLabel,
                          { color: reactItem.color },
                        ]}
                      >
                        {reactItem.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          <View
            style={[
              styles.fbActionBar,
              {
                borderTopColor: isDark ? "#334155" : "#E2E8F0",
                borderBottomColor: isDark ? "#334155" : "#F1F5F9",
              },
            ]}
          >
            {/* LIKE BUTTON: Single tap to like/unlike, hold/long-press to open 6 react emojis */}
            <TouchableOpacity
              onPress={() => {
                if (activeReactionPostId === post.id) {
                  setActiveReactionPostId(null);
                } else {
                  handleToggleLike(post);
                }
              }}
              onLongPress={() => {
                setActiveReactionPostId(
                  activeReactionPostId === post.id ? null : post.id,
                );
              }}
              delayLongPress={260}
              style={styles.fbActionBtn}
              activeOpacity={0.7}
            >
              {reactionBtnDisplay.icon}
              <Text
                style={[
                  styles.fbActionBtnText,
                  {
                    color: reactionBtnDisplay.color,
                    fontWeight: isLikedOrReacted ? "700" : "600",
                  },
                ]}
              >
                {reactionBtnDisplay.label}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActivePostForComments(post)}
              style={styles.fbActionBtn}
              activeOpacity={0.7}
            >
              <Ionicons
                name="chatbubble-outline"
                size={18}
                color={isDark ? "#94A3B8" : "#64748B"}
              />
              <Text
                style={[
                  styles.fbActionBtnText,
                  { color: isDark ? "#CBD5E1" : "#475569" },
                ]}
              >
                Comment
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleSharePost(post)}
              style={styles.fbActionBtn}
              activeOpacity={0.7}
            >
              <Ionicons
                name="arrow-redo-outline"
                size={19}
                color={isDark ? "#94A3B8" : "#64748B"}
              />
              <Text
                style={[
                  styles.fbActionBtnText,
                  { color: isDark ? "#CBD5E1" : "#475569" },
                ]}
              >
                Share
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Facebook Inline Quick Comment Prompt */}
        <View style={styles.fbInlineCommentRow}>
          {currentAvatar ? (
            <Image
              source={{ uri: currentAvatar }}
              style={styles.fbMiniCommentAvatar}
            />
          ) : (
            <View
              style={[
                styles.fbMiniCommentAvatarPlaceholder,
                { backgroundColor: isDark ? "#334155" : "#DBEAFE" },
              ]}
            >
              <Text
                style={[
                  styles.fbMiniCommentInitial,
                  { color: isDark ? "#94A3B8" : "#1D4ED8" },
                ]}
              >
                {currentDisplayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          <TouchableOpacity
            onPress={() => setActivePostForComments(post)}
            style={[
              styles.fbInlineCommentInput,
              {
                backgroundColor: isDark ? "#0F172A" : "#F1F5F9",
                borderColor: isDark ? "#334155" : "#E2E8F0",
              },
            ]}
          >
            <Text
              style={[
                styles.fbInlineCommentPlaceholder,
                { color: isDark ? "#64748B" : "#94A3B8" },
              ]}
            >
              Write a comment...
            </Text>
            <Ionicons
              name="happy-outline"
              size={18}
              color={isDark ? "#64748B" : "#94A3B8"}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Render the "People You May Know" Section
  const renderPeopleYouMayKnowSection = () => {
    if (peopleYouMayKnow.length === 0) return null;

    return (
      <View
        style={[
          styles.pymkSectionCard,
          {
            backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
            borderColor: isDark ? "#334155" : "#E2E8F0",
          },
        ]}
      >
        <View style={styles.pymkHeaderRow}>
          <View style={styles.pymkTitleGroup}>
            <Ionicons name="people" size={20} color="#2563EB" />
            <Text
              style={[
                styles.pymkTitle,
                { color: isDark ? "#F8FAFC" : "#0F172A" },
              ]}
            >
              People You May Know
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              setActiveMainTab("network");
              setNetworkSubTab("discover");
            }}
          >
            <Text style={styles.pymkSeeAllText}>See all</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pymkScrollContent}
        >
          {peopleYouMayKnow.map((member) => {
            const isProcessing = processingActionId === member.uid;
            const isSent = member.friendshipStatus === "pending_sent";
            const cleanName = formatAuthorDisplayName(
              member.name,
              member.email,
            );

            return (
              <View
                key={member.uid}
                style={[
                  styles.pymkCard,
                  {
                    backgroundColor: isDark ? "#0F172A" : "#F8FAFC",
                    borderColor: isDark ? "#334155" : "#E2E8F0",
                  },
                ]}
              >
                {/* Dismiss button */}
                <TouchableOpacity
                  onPress={() => handleDismissSuggestion(member.uid)}
                  style={styles.pymkDismissBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="x" size={15} color="#FFFFFF" />
                </TouchableOpacity>

                {/* Portrait Picture / Avatar */}
                {(() => {
                  const liveMemberAvatar = resolveMemberAvatar(
                    member.uid,
                    member.avatar,
                  );
                  const isMemberAvatarFailed = failedAvatarUids.has(member.uid);
                  const memberPalette = getAvatarPalette(
                    member.uid || cleanName,
                    isDark,
                  );

                  return (
                    <TouchableOpacity
                      onPress={() =>
                        handleOpenUserProfile({
                          uid: member.uid,
                          name: cleanName,
                          avatar: liveMemberAvatar,
                          email: member.email,
                          role: member.role,
                          householdName: member.householdName,
                        })
                      }
                      activeOpacity={0.85}
                      style={styles.pymkAvatarWrap}
                    >
                      {liveMemberAvatar && !isMemberAvatarFailed ? (
                        <Image
                          source={{ uri: liveMemberAvatar }}
                          style={styles.pymkAvatar}
                          resizeMode="cover"
                          onError={() =>
                            setFailedAvatarUids((prev) =>
                              new Set(prev).add(member.uid),
                            )
                          }
                        />
                      ) : (
                        <View
                          style={[
                            styles.pymkAvatarPlaceholder,
                            { backgroundColor: memberPalette.bg },
                          ]}
                        >
                          <Text
                            style={[
                              styles.pymkInitial,
                              { color: memberPalette.text, fontWeight: "700" },
                            ]}
                          >
                            {cleanName.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })()}

                {/* Member Info */}
                <View style={styles.pymkBody}>
                  <TouchableOpacity
                    onPress={() =>
                      handleOpenUserProfile({
                        uid: member.uid,
                        name: cleanName,
                        avatar: resolveMemberAvatar(member.uid, member.avatar),
                        email: member.email,
                        role: member.role,
                        householdName: member.householdName,
                      })
                    }
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.pymkName,
                        { color: isDark ? "#F8FAFC" : "#0F172A" },
                      ]}
                      numberOfLines={1}
                    >
                      {cleanName}
                    </Text>
                  </TouchableOpacity>
                  <Text
                    style={[
                      styles.pymkSub,
                      { color: isDark ? "#94A3B8" : "#64748B" },
                    ]}
                    numberOfLines={1}
                  >
                    {member.householdName || "Suggested for you"}
                  </Text>

                  {/* Primary Add Friend Button */}
                  <TouchableOpacity
                    onPress={() => {
                      if (!isSent && !isProcessing) {
                        handleSendFriendRequest(member);
                      }
                    }}
                    disabled={isSent || isProcessing}
                    style={[
                      styles.pymkAddBtn,
                      isSent && styles.pymkAddBtnSent,
                      { backgroundColor: isSent ? "#10B981" : "#2563EB" },
                    ]}
                    activeOpacity={0.8}
                  >
                    {isProcessing ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons
                          name={isSent ? "checkmark" : "person-add"}
                          size={15}
                          color="#FFFFFF"
                        />
                        <Text style={styles.pymkAddBtnText}>
                          {isSent ? "Requested" : "Add friend"}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>

                  {/* Secondary Remove Button (Facebook style) */}
                  <TouchableOpacity
                    onPress={() => handleDismissSuggestion(member.uid)}
                    style={[
                      styles.pymkRemoveBtn,
                      {
                        backgroundColor: isDark ? "#334155" : "#E2E8F0",
                      },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.pymkRemoveBtnText,
                        { color: isDark ? "#E2E8F0" : "#475569" },
                      ]}
                    >
                      Remove
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  if (selectedProfileUser) {
    return (
      <View style={{ flex: 1 }}>
        <UserProfileScreen
          user={selectedProfileUser}
          onBack={() => setSelectedProfileUser(null)}
          currentUser={currentUser}
          posts={posts}
          onProfileUpdated={(updated) => {
            setPosts((prevPosts) =>
              prevPosts.map((p) => {
                const cleanP = String(p.authorId).replace(/^mem_/, "").trim();
                const cleanU = String(updated.uid).replace(/^mem_/, "").trim();
                if (cleanP === cleanU) {
                  return {
                    ...p,
                    authorName: updated.name,
                    authorAvatar: updated.avatar || p.authorAvatar,
                  };
                }
                return p;
              }),
            );
            onProfileUpdated?.(updated);
          }}
          onSendFriendRequest={async (user) => {
            // Immediate optimistic UI update on first tap
            setSelectedProfileUser((prev) =>
              prev ? { ...prev, friendshipStatus: "pending_sent" } : null,
            );
            setDiscoveredMembers((prev) =>
              prev.map((m) => {
                const cleanM = String(m.uid).replace(/^mem_/, "").trim();
                const cleanU = String(user.uid).replace(/^mem_/, "").trim();
                return cleanM === cleanU
                  ? { ...m, friendshipStatus: "pending_sent" }
                  : m;
              }),
            );
            await communityService.sendFriendRequest(
              {
                uid: user.uid,
                name: user.name,
                avatar: user.avatar,
                email: user.email,
              },
              {
                name: currentDisplayName,
                avatar: currentAvatar,
                email: currentUser.email || auth.currentUser?.email,
              },
            );
          }}
          onAcceptFriendRequest={async (friendshipId) => {
            await handleAcceptRequest(friendshipId);
            setSelectedProfileUser((prev) =>
              prev ? { ...prev, friendshipStatus: "friends" } : null,
            );
          }}
          onDeclineOrCancelRequest={async (friendshipId) => {
            await handleDeclineRequest(friendshipId);
            setSelectedProfileUser((prev) =>
              prev
                ? {
                    ...prev,
                    friendshipStatus: "none",
                    friendshipId: undefined,
                  }
                : null,
            );
          }}
          onToggleLikePost={handleToggleLike}
          onSelectReaction={handleSelectReaction}
          onOpenComments={(post) => setActivePostForComments(post)}
          onOpenUserProfile={(user) => handleOpenUserProfile(user)}
          onOpenDirectChat={(uid, name, avatar) => {
            if (onOpenDirectChat) {
              onOpenDirectChat(uid, name, avatar);
            } else {
              setSelectedProfileUser(null);
              onBack();
            }
          }}
          onNavigateToSplitzyProfile={() => {
            setSelectedProfileUser(null);
            onNavigateToSplitzyProfile?.();
          }}
          onOpenReel={(reel, reelIndex) => {
            setSelectedProfileUser(null);
            const targetIdx = reels.findIndex((r) => r.id === reel.id);
            setSelectedReelCategory("all");
            setActiveReelIndex(targetIdx >= 0 ? targetIdx : (reelIndex ?? 0));
            setActiveMainTab("reels");
          }}
        />

        <PostCommentsModal
          visible={!!activePostForComments}
          post={activePostForComments}
          onClose={() => setActivePostForComments(null)}
          currentUser={currentUser}
        />
      </View>
    );
  }

  // ─── FACEBOOK-STYLE REELS & SHORT VIDEOS SHELF (FEED EMBED) ───────────────
  const renderFacebookReelsShelf = () => {
    if (!reels || reels.length === 0) return null;
    return (
      <View
        style={[
          styles.reelsShelfCard,
          {
            backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
            borderColor: isDark ? "#334155" : "#E2E8F0",
          },
        ]}
      >
        {/* Header */}
        <View style={styles.reelsShelfHeader}>
          <View style={styles.reelsShelfTitleRow}>
            <View style={styles.reelsShelfIconWrap}>
              <Ionicons name="film" size={16} color="#FFFFFF" />
            </View>
            <View>
              <Text
                style={[
                  styles.reelsShelfTitle,
                  { color: isDark ? "#F8FAFC" : "#0F172A" },
                ]}
              >
                Reels and short videos
              </Text>
              <Text
                style={[
                  styles.reelsShelfSub,
                  { color: isDark ? "#94A3B8" : "#64748B" },
                ]}
              >
                Trending YouTube Shorts & Facebook Reels
              </Text>
            </View>
          </View>
          {/* <TouchableOpacity
            onPress={() => {
              setSelectedReelCategory("all");
              setActiveMainTab("reels");
              setActiveReelIndex(0);
            }}
            style={styles.reelsShelfSeeAllBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.reelsShelfSeeAllText}>Watch Reels</Text>
            <Ionicons name="chevron-forward" size={14} color="#2563EB" />
          </TouchableOpacity> */}
        </View>

        {/* Horizontal scroll cards */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.reelsShelfScroll}
        >
          {/* Create Reel Shortcut Card */}
          <TouchableOpacity
            onPress={() => setCreateReelVisible(true)}
            style={[
              styles.shelfReelItemCard,
              styles.shelfCreateReelCard,
              {
                backgroundColor: isDark ? "#0F172A" : "#F1F5F9",
                borderColor: isDark ? "#334155" : "#E2E8F0",
              },
            ]}
            activeOpacity={0.88}
          >
            <View style={styles.shelfCreateReelIconCircle}>
              <Ionicons name="videocam" size={24} color="#FFFFFF" />
            </View>
            <Text
              style={[
                styles.shelfCreateReelText,
                { color: isDark ? "#F8FAFC" : "#0F172A" },
              ]}
            >
              Create Reel
            </Text>
            <Text
              style={[
                styles.shelfCreateReelSub,
                { color: isDark ? "#94A3B8" : "#64748B" },
              ]}
            >
              Shorts or video
            </Text>
          </TouchableOpacity>

          {/* Reel preview cards */}
          {reels.slice(0, 10).map((r) => {
            const vType = getReelVideoType(r.videoUrl);
            const isYT = vType === "youtube";
            const isFB = vType === "facebook";

            return (
              <TouchableOpacity
                key={r.id}
                onPress={() => {
                  const targetIdx = reels.findIndex((item) => item.id === r.id);
                  setSelectedReelCategory("all");
                  setActiveReelIndex(targetIdx >= 0 ? targetIdx : 0);
                  setActiveMainTab("reels");
                }}
                style={[
                  styles.shelfReelItemCard,
                  { borderColor: isDark ? "#334155" : "#E2E8F0" },
                ]}
                activeOpacity={0.9}
              >
                {r.thumbnailUrl ? (
                  <Image
                    source={{ uri: r.thumbnailUrl }}
                    style={styles.shelfReelThumb}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.shelfReelFallbackBg}>
                    <Ionicons name="play" size={28} color="#94A3B8" />
                  </View>
                )}

                {/* Top Badge: YouTube Shorts or Facebook Reel */}
                <View style={styles.shelfReelBadgeWrap}>
                  {isYT ? (
                    <View
                      style={[
                        styles.shelfPlatformBadge,
                        { backgroundColor: "rgba(220, 38, 38, 0.95)" },
                      ]}
                    >
                      <Ionicons name="logo-youtube" size={11} color="#FFFFFF" />
                      <Text style={styles.shelfPlatformBadgeText}>Shorts</Text>
                    </View>
                  ) : isFB ? (
                    <View
                      style={[
                        styles.shelfPlatformBadge,
                        { backgroundColor: "rgba(24, 119, 242, 0.95)" },
                      ]}
                    >
                      <Ionicons
                        name="logo-facebook"
                        size={11}
                        color="#FFFFFF"
                      />
                      <Text style={styles.shelfPlatformBadgeText}>Reels</Text>
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.shelfPlatformBadge,
                        { backgroundColor: "rgba(16, 185, 129, 0.95)" },
                      ]}
                    >
                      <Ionicons name="film-outline" size={11} color="#FFFFFF" />
                      <Text style={styles.shelfPlatformBadgeText}>Clip</Text>
                    </View>
                  )}
                </View>

                {/* Center play icon */}
                <View style={styles.shelfPlayIconCircle}>
                  <Ionicons
                    name="play"
                    size={16}
                    color="#FFFFFF"
                    style={{ marginLeft: 2 }}
                  />
                </View>

                {/* Dark gradient shadow */}
                <View style={styles.shelfReelScrim} />

                {/* Bottom author and caption */}
                <View style={styles.shelfReelBottomInfo}>
                  <Text style={styles.shelfReelCaption} numberOfLines={2}>
                    {r.caption}
                  </Text>
                  <View style={styles.shelfReelAuthorRow}>
                    {r.authorAvatar ? (
                      <Image
                        source={{ uri: r.authorAvatar }}
                        style={styles.shelfReelAuthorAvatar}
                      />
                    ) : (
                      <View style={styles.shelfReelAuthorPlaceholder}>
                        <Text style={styles.shelfReelAuthorInitials}>
                          {r.authorName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.shelfReelAuthorName} numberOfLines={1}>
                      {r.authorName.split(" ")[0]}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        {
          backgroundColor:
            activeMainTab === "reels"
              ? "#000000"
              : isDark
                ? "#0B1120"
                : "#F8FAFC",
        },
      ]}
      edges={activeMainTab === "reels" ? [] : ["top"]}
    >
      <StatusBar
        barStyle={
          activeMainTab === "reels" || isDark ? "light-content" : "dark-content"
        }
        backgroundColor={activeMainTab === "reels" ? "#000000" : undefined}
      />

      {/* Top Header - Hidden when viewing Reels tab for full-bleed immersive experience */}
      {activeMainTab !== "reels" && (
        <View
          style={[
            styles.header,
            {
              backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
              borderBottomColor: isDark ? "#1E293B" : "#E2E8F0",
            },
          ]}
        >
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Feather
              name="chevron-left"
              size={22}
              color={isDark ? "#F8FAFC" : "#0F172A"}
            />
          </TouchableOpacity>

          <View style={styles.headerTitleWrap}>
            <View style={styles.headerRow}>
              <Ionicons name="sparkles" size={18} color="#2563EB" />
              <Text
                style={[
                  styles.headerTitle,
                  { color: isDark ? "#F8FAFC" : "#0F172A" },
                ]}
              >
                Splitzy Community
              </Text>
            </View>
            <Text
              style={[
                styles.headerSubtitle,
                { color: isDark ? "#94A3B8" : "#64748B" },
              ]}
            >
              Social feed & roommate network
            </Text>
          </View>

          <View style={styles.headerRightActions}>
            <TouchableOpacity
              onPress={handleOpenMyProfile}
              style={styles.headerAvatarBtn}
              activeOpacity={0.8}
              accessibilityLabel="View and edit profile"
            >
              {currentAvatar ? (
                <Image
                  source={{ uri: currentAvatar }}
                  style={styles.headerAvatarImg}
                />
              ) : (
                <View
                  style={[
                    styles.headerAvatarPlaceholder,
                    { backgroundColor: isDark ? "#334155" : "#DBEAFE" },
                  ]}
                >
                  <Text
                    style={[
                      styles.headerAvatarInitials,
                      { color: isDark ? "#94A3B8" : "#1D4ED8" },
                    ]}
                  >
                    {currentDisplayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.headerAvatarOnlineDot} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setCreatePostVisible(true)}
              style={styles.headerPostBtn}
              accessibilityLabel="Create Post"
            >
              <Ionicons name="add" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Main Tab Toggle: Feed vs Reels vs Friends & Network - Hidden in Reels tab */}
      {activeMainTab !== "reels" && (
        <View
          style={[
            styles.mainTabsContainer,
            {
              backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
              borderBottomColor: isDark ? "#1E293B" : "#E2E8F0",
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => setActiveMainTab("feed")}
            style={[
              styles.mainTabBtn,
              activeMainTab === "feed" && styles.mainTabBtnActive,
            ]}
          >
            <Feather
              name="file-text"
              size={16}
              color={
                activeMainTab === "feed"
                  ? "#2563EB"
                  : isDark
                    ? "#94A3B8"
                    : "#64748B"
              }
            />
            <Text
              style={[
                styles.mainTabBtnText,
                {
                  color:
                    activeMainTab === "feed"
                      ? "#2563EB"
                      : isDark
                        ? "#94A3B8"
                        : "#64748B",
                  fontWeight: activeMainTab === "feed" ? "700" : "500",
                },
              ]}
            >
              Feed
            </Text>
          </TouchableOpacity>

          {/* REELS TAB (Facebook-Style Short Video Feed) */}
          <TouchableOpacity
            onPress={() => setActiveMainTab("reels")}
            style={styles.mainTabBtn}
          >
            <Ionicons
              name="film-outline"
              size={17}
              color={isDark ? "#94A3B8" : "#64748B"}
            />
            <Text
              style={[
                styles.mainTabBtnText,
                {
                  color: isDark ? "#94A3B8" : "#64748B",
                  fontWeight: "500",
                },
              ]}
            >
              Reels
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveMainTab("network")}
            style={[
              styles.mainTabBtn,
              activeMainTab === "network" && styles.mainTabBtnActive,
            ]}
          >
            <Ionicons
              name="people-outline"
              size={17}
              color={
                activeMainTab === "network"
                  ? "#2563EB"
                  : isDark
                    ? "#94A3B8"
                    : "#64748B"
              }
            />
            <Text
              style={[
                styles.mainTabBtnText,
                {
                  color:
                    activeMainTab === "network"
                      ? "#2563EB"
                      : isDark
                        ? "#94A3B8"
                        : "#64748B",
                  fontWeight: activeMainTab === "network" ? "700" : "500",
                },
              ]}
            >
              People
            </Text>
            {incomingRequests.length > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>
                  {incomingRequests.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* FEED TAB VIEW */}
      {activeMainTab === "feed" && (
        <ScrollView
          style={styles.feedScrollView}
          contentContainerStyle={[
            styles.feedScrollContent,
            {
              paddingBottom: insets.bottom + 80,
              backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
            },
          ]}
          onScrollBeginDrag={() => {
            if (activeReactionPostId) {
              setActiveReactionPostId(null);
            }
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#2563EB"
            />
          }
        >
          {/* Quick Post Prompt Card (Facebook style) */}
          <View
            style={[
              styles.quickPostCard,
              {
                backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
              },
            ]}
          >
            <View style={styles.quickPostRow}>
              <TouchableOpacity
                onPress={handleOpenMyProfile}
                activeOpacity={0.8}
                accessibilityLabel="View your profile"
              >
                {currentAvatar ? (
                  <Image
                    source={{ uri: currentAvatar }}
                    style={styles.quickPostAvatar}
                  />
                ) : (
                  <View
                    style={[
                      styles.quickPostAvatarPlaceholder,
                      { backgroundColor: isDark ? "#334155" : "#DBEAFE" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.quickPostAvatarInitials,
                        { color: isDark ? "#94A3B8" : "#1D4ED8" },
                      ]}
                    >
                      {currentDisplayName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setCreatePostVisible(true)}
                style={[
                  styles.quickPostInputFake,
                  {
                    backgroundColor: isDark ? "#0F172A" : "#F1F5F9",
                    borderColor: isDark ? "#334155" : "#CBD5E1",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.quickPostPlaceholder,
                    { color: isDark ? "#64748B" : "#94A3B8" },
                  ]}
                >
                  What's on your mind, {currentDisplayName.split(" ")[0]}?
                </Text>
              </TouchableOpacity>
            </View>

            <View
              style={[
                styles.quickPostFooter,
                { borderTopColor: isDark ? "#334155" : "#F1F5F9" },
              ]}
            >
              <TouchableOpacity
                onPress={() => setCreatePostVisible(true)}
                style={styles.quickPostAction}
              >
                <Ionicons name="image" size={18} color="#10B981" />
                <Text
                  style={[
                    styles.quickPostActionText,
                    { color: isDark ? "#94A3B8" : "#64748B" },
                  ]}
                >
                  Photo
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setSelectedCategory("items_sale");
                  setCreatePostVisible(true);
                }}
                style={styles.quickPostAction}
              >
                <Feather name="shopping-bag" size={16} color="#F59E0B" />
                <Text
                  style={[
                    styles.quickPostActionText,
                    { color: isDark ? "#94A3B8" : "#64748B" },
                  ]}
                >
                  Marketplace
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setCreateStoryVisible(true)}
                style={styles.quickPostAction}
              >
                <Ionicons name="add-circle" size={18} color="#2563EB" />
                <Text
                  style={[
                    styles.quickPostActionText,
                    { color: isDark ? "#94A3B8" : "#64748B" },
                  ]}
                >
                  Story
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* FACEBOOK STORY REELS CAROUSEL (24h Ephemeral Stories) */}
          <View style={styles.storiesContainer}>
            <View style={styles.storiesHeaderRow}>
              <View style={styles.storiesTitleGroup}>
                <Ionicons name="sparkles" size={14} color="#2563EB" />
                <Text
                  style={[
                    styles.storiesSectionTitle,
                    { color: isDark ? "#F8FAFC" : "#0F172A" },
                  ]}
                >
                  Stories
                </Text>
                <Text style={styles.storiesExpiryBadge}>· 24h</Text>
              </View>

              {myArchivedStories.length > 0 && (
                <TouchableOpacity
                  onPress={() => setShowStoryArchive(true)}
                  style={styles.archiveHeaderBtn}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Ionicons name="archive-outline" size={13} color="#2563EB" />
                  <Text style={styles.archiveHeaderBtnText}>
                    My Archive ({myArchivedStories.length})
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.storiesScroll}
            >
              {/* "Create Story" Card (Facebook Style) */}
              <TouchableOpacity
                onPress={() => setCreateStoryVisible(true)}
                style={[
                  styles.createStoryCard,
                  {
                    backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                    borderColor: isDark ? "#334155" : "#E2E8F0",
                  },
                ]}
                activeOpacity={0.85}
              >
                <View style={styles.createStoryTopHalf}>
                  {currentAvatar ? (
                    <Image
                      source={{ uri: currentAvatar }}
                      style={styles.createStoryAvatarBg}
                    />
                  ) : (
                    <View
                      style={[
                        styles.createStoryAvatarPlaceholder,
                        { backgroundColor: isDark ? "#334155" : "#DBEAFE" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.createStoryInitials,
                          { color: isDark ? "#94A3B8" : "#1D4ED8" },
                        ]}
                      >
                        {currentDisplayName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Overlapping Blue Plus Button */}
                <View style={styles.createStoryPlusIconWrap}>
                  <View style={styles.createStoryPlusCircle}>
                    <Ionicons name="add" size={18} color="#FFFFFF" />
                  </View>
                </View>

                <View style={styles.createStoryBottomHalf}>
                  <Text
                    style={[
                      styles.createStoryLabel,
                      { color: isDark ? "#F8FAFC" : "#0F172A" },
                    ]}
                  >
                    Create story
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Community Story Cards */}
              {displayStories.map((story, idx) => {
                const isOwnStory = Boolean(
                  currentUid &&
                  (story.authorId === currentUid ||
                    story.authorId === `mem_${currentUid}` ||
                    `mem_${story.authorId}` === currentUid),
                );
                const remaining = calculateStoryTimeRemaining(story);

                return (
                  <TouchableOpacity
                    key={story.id || idx}
                    onPress={() => {
                      setSelectedStoryIndex(idx);
                      setStoryViewerVisible(true);
                    }}
                    style={styles.storyCard}
                    activeOpacity={0.88}
                  >
                    {story.mediaUrl ? (
                      <Image
                        source={{ uri: story.mediaUrl }}
                        style={styles.storyImageBg}
                        resizeMode="cover"
                      />
                    ) : (
                      <View
                        style={[
                          styles.storyTextCardBg,
                          story.backgroundColor
                            ? { backgroundColor: story.backgroundColor }
                            : null,
                        ]}
                      >
                        <Ionicons name="sparkles" size={24} color="#93C5FD" />
                        {story.caption ? (
                          <Text
                            style={styles.storyCardCaption}
                            numberOfLines={3}
                          >
                            {story.caption}
                          </Text>
                        ) : null}
                      </View>
                    )}

                    {/* Gradient shadow overlay */}
                    <View style={styles.storyGradientOverlay} />

                    {/* Top-left Author Avatar with Blue Story Ring */}
                    {(() => {
                      const liveStoryAvatar = resolveMemberAvatar(
                        story.authorId,
                        story.authorAvatar,
                      );
                      const isStoryAvatarFailed = failedAvatarUids.has(
                        story.authorId,
                      );
                      const storyPalette = getAvatarPalette(
                        story.authorId || story.authorName,
                        isDark,
                      );

                      return (
                        <View style={styles.storyRingWrapper}>
                          {liveStoryAvatar && !isStoryAvatarFailed ? (
                            <Image
                              source={{ uri: liveStoryAvatar }}
                              style={styles.storyAuthorAvatar}
                              onError={() =>
                                setFailedAvatarUids((prev) =>
                                  new Set(prev).add(story.authorId),
                                )
                              }
                            />
                          ) : (
                            <View
                              style={[
                                styles.storyAuthorAvatarPlaceholder,
                                { backgroundColor: storyPalette.bg },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.storyAuthorInitial,
                                  {
                                    color: storyPalette.text,
                                    fontWeight: "700",
                                  },
                                ]}
                              >
                                {story.authorName.charAt(0).toUpperCase()}
                              </Text>
                            </View>
                          )}
                        </View>
                      );
                    })()}

                    {/* Top-right menu trigger for own story */}
                    {isOwnStory && (
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation?.();
                          setStoryActionTarget(story);
                        }}
                        style={styles.storyCardMenuBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Feather
                          name="more-horizontal"
                          size={15}
                          color="#FFFFFF"
                        />
                      </TouchableOpacity>
                    )}

                    {/* Remaining expiry countdown badge */}
                    <View style={styles.storyCardExpiryWrap}>
                      <Text style={styles.storyCardExpiryText}>
                        {remaining.label}
                      </Text>
                    </View>

                    {/* Bottom Author Name */}
                    <Text style={styles.storyAuthorName} numberOfLines={1}>
                      {isOwnStory ? "Your story" : story.authorName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Facebook Reels and Short Videos Shelf (Embedded in Feed) */}
          {renderFacebookReelsShelf()}

          {/* Scope Filter Switch (All Posts | Friends Only | My Posts) */}
          <View style={styles.scopeRow}>
            {(["all", "friends", "my"] as const).map((sc) => {
              const isActive = feedScope === sc;
              const label =
                sc === "all"
                  ? "All Community"
                  : sc === "friends"
                    ? `Friends (${acceptedFriends.length})`
                    : "My Posts";
              return (
                <TouchableOpacity
                  key={sc}
                  onPress={() => setFeedScope(sc)}
                  style={[
                    styles.scopeChip,
                    {
                      backgroundColor: isActive
                        ? "#2563EB"
                        : isDark
                          ? "#1E293B"
                          : "#FFFFFF",
                      borderColor: isActive
                        ? "#2563EB"
                        : isDark
                          ? "#334155"
                          : "#E2E8F0",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.scopeChipText,
                      {
                        color: isActive
                          ? "#FFFFFF"
                          : isDark
                            ? "#CBD5E1"
                            : "#475569",
                        fontWeight: isActive ? "700" : "500",
                      },
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Horizontal Topic Category Filter Bar */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}
          >
            {CATEGORIES.map((catKey) => {
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
                          ? "#1E293B"
                          : "#FFFFFF",
                      borderColor: isSelected
                        ? conf.color
                        : isDark
                          ? "#334155"
                          : "#E2E8F0",
                    },
                  ]}
                >
                  <Feather
                    name={conf.icon as any}
                    size={13}
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

          {/* Posts Stream */}
          {loadingPosts ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color="#2563EB" />
              <Text
                style={[
                  styles.loadingText,
                  { color: isDark ? "#94A3B8" : "#64748B" },
                ]}
              >
                Syncing Splitzy Community...
              </Text>
            </View>
          ) : filteredPosts.length === 0 ? (
            <View>
              {/* If no posts yet, render People You May Know here */}
              {renderPeopleYouMayKnowSection()}

              <View
                style={[
                  styles.emptyCard,
                  {
                    backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                    borderColor: isDark ? "#334155" : "#E2E8F0",
                  },
                ]}
              >
                <Ionicons
                  name="chatbubbles-outline"
                  size={48}
                  color={isDark ? "#475569" : "#CBD5E1"}
                />
                <Text
                  style={[
                    styles.emptyTitle,
                    { color: isDark ? "#F8FAFC" : "#0F172A" },
                  ]}
                >
                  {selectedCategory !== "all"
                    ? `No posts in ${CATEGORY_LABELS[selectedCategory]?.label}`
                    : feedScope === "friends"
                      ? "No posts from friends yet"
                      : "No community posts yet"}
                </Text>
                <Text
                  style={[
                    styles.emptySub,
                    { color: isDark ? "#94A3B8" : "#64748B" },
                  ]}
                >
                  Be the first to share an update, roomie hack, or item for the
                  community!
                </Text>
                <TouchableOpacity
                  onPress={() => setCreatePostVisible(true)}
                  style={styles.emptyCreateBtn}
                >
                  <Feather name="plus-circle" size={18} color="#FFFFFF" />
                  <Text style={styles.emptyCreateBtnText}>
                    Create First Post
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            filteredPosts.map((post, postIndex) => {
              return (
                <React.Fragment key={post.id}>
                  {renderFacebookPostCard(post)}

                  {/* Insert "People You May Know" after 1st post (index 0) */}
                  {postIndex === 0 && renderPeopleYouMayKnowSection()}
                </React.Fragment>
              );
            })
          )}
        </ScrollView>
      )}

      {/* REELS TAB VIEW (100% Full-Bleed Immersive Experience) */}
      {activeMainTab === "reels" && (
        <View
          style={styles.reelsTabContainer}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            if (h > 200) setReelsViewportHeight(h);
          }}
        >
          {/* Floating Glassmorphic Top Bar for Reels (Back + Scrollable Categories + Create Reel) */}
          <View
            style={[
              styles.floatingReelsTopBar,
              {
                top:
                  Math.max(
                    insets.top,
                    Platform.OS === "android"
                      ? (StatusBar.currentHeight ?? 24)
                      : 16,
                  ) + 6,
              },
            ]}
          >
            {/* Left: Floating Translucent Back Button (Returns directly to Community Feed tab) */}
            <TouchableOpacity
              onPress={() => {
                setActiveMainTab("feed");
              }}
              style={styles.floatingReelsBackBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Back to Community Feed"
              activeOpacity={0.8}
            >
              <Feather name="chevron-left" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Center: Scrollable Reel Categories (Replacing Feed/Reels/People tabs) */}
            <View style={styles.floatingCategoriesScrollWrapper}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.floatingReelsCategoryScroll}
              >
                {[
                  { id: "all", label: "All Reels", icon: "sparkles" },
                  {
                    id: "youtube_shorts",
                    label: "YouTube Shorts",
                    icon: "logo-youtube",
                    activeBg: "#DC2626",
                  },
                  {
                    id: "roommate_tips",
                    label: "Roommate Tips",
                    icon: "bulb-outline",
                  },
                  {
                    id: "cooking",
                    label: "Cooking",
                    icon: "restaurant-outline",
                  },
                  {
                    id: "budgeting",
                    label: "Budget Hacks",
                    icon: "wallet-outline",
                  },
                  { id: "lifestyle", label: "Lifestyle", icon: "home-outline" },
                  { id: "fun", label: "Fun", icon: "happy-outline" },
                ].map((cat) => {
                  const isSelected = selectedReelCategory === cat.id;
                  const activeColor = cat.activeBg || "#2563EB";
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      onPress={() => setSelectedReelCategory(cat.id as any)}
                      style={[
                        styles.floatingReelCategoryChip,
                        isSelected && {
                          backgroundColor: activeColor,
                          borderColor: activeColor,
                        },
                      ]}
                      activeOpacity={0.85}
                    >
                      <Ionicons
                        name={cat.icon as any}
                        size={13}
                        color="#FFFFFF"
                        style={{ marginRight: 5 }}
                      />
                      <Text
                        style={[
                          styles.floatingReelCategoryChipText,
                          { fontWeight: isSelected ? "800" : "500" },
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Right: Floating Camera / Create Reel Button */}
            <TouchableOpacity
              onPress={() => setCreateReelVisible(true)}
              style={styles.floatingReelsCreateBtn}
              accessibilityLabel="Create Community Reel"
              activeOpacity={0.8}
            >
              <Ionicons name="camera-outline" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Reels Snapping Vertical List */}
          {loadingReels ? (
            <View style={styles.reelsLoadingBox}>
              <ActivityIndicator size="large" color="#2563EB" />
              <Text style={styles.reelsLoadingText}>
                Tuning into Community Reels...
              </Text>
            </View>
          ) : filteredReels.length === 0 ? (
            <View style={styles.reelsEmptyContainer}>
              <Ionicons name="videocam-outline" size={54} color="#64748B" />
              <Text style={styles.reelsEmptyTitle}>
                No reels in this category yet
              </Text>
              <Text style={styles.reelsEmptySub}>
                Be the first roommate to share a vertical clip or switch to "All
                Reels"
              </Text>
              <TouchableOpacity
                onPress={() => setCreateReelVisible(true)}
                style={styles.reelsCreateBtn}
              >
                <Ionicons name="add-circle" size={18} color="#FFFFFF" />
                <Text style={styles.reelsCreateBtnText}>Create a Reel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={filteredReels}
              keyExtractor={reelKeyExtractor}
              pagingEnabled
              showsVerticalScrollIndicator={false}
              snapToInterval={reelsViewportHeight}
              snapToAlignment="start"
              decelerationRate="fast"
              getItemLayout={getReelItemLayout}
              viewabilityConfig={viewabilityConfigRef.current}
              onViewableItemsChanged={onViewableItemsChangedRef.current}
              windowSize={3}
              maxToRenderPerBatch={2}
              initialNumToRender={2}
              removeClippedSubviews={Platform.OS !== "web"}
              renderItem={renderReelItem}
            />
          )}
        </View>
      )}

      {/* FACEBOOK-STYLE FRIENDS & NETWORK VIEW */}
      {activeMainTab === "network" && (
        <View style={styles.networkContainer}>
          {/* Facebook Friends Top Title & Search Button */}
          <View
            style={[
              styles.fbFriendsTopBar,
              {
                backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
                borderBottomColor: isDark ? "#1E293B" : "#E2E8F0",
              },
            ]}
          >
            <View style={styles.fbFriendsTitleRow}>
              <Text
                style={[
                  styles.fbFriendsMainTitle,
                  { color: isDark ? "#F8FAFC" : "#050505" },
                ]}
              >
                Friends
              </Text>

              <TouchableOpacity
                onPress={() => setShowNetworkSearch(!showNetworkSearch)}
                style={[
                  styles.fbFriendsSearchIconBtn,
                  { backgroundColor: isDark ? "#334155" : "#F1F5F9" },
                ]}
                activeOpacity={0.7}
              >
                <Feather
                  name={showNetworkSearch ? "x" : "search"}
                  size={18}
                  color={isDark ? "#F8FAFC" : "#050505"}
                />
              </TouchableOpacity>
            </View>

            {/* Facebook Filter Pills: [ Suggestions ] [ Your Friends ] */}
            <View style={styles.fbFriendsPillsRow}>
              <TouchableOpacity
                onPress={() =>
                  setFriendsFilter(
                    friendsFilter === "suggestions" ? "all" : "suggestions",
                  )
                }
                style={[
                  styles.fbFriendsPill,
                  {
                    backgroundColor:
                      friendsFilter === "suggestions"
                        ? "#1877F2"
                        : isDark
                          ? "#334155"
                          : "#E4E6EB",
                  },
                ]}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.fbFriendsPillText,
                    {
                      color:
                        friendsFilter === "suggestions"
                          ? "#FFFFFF"
                          : isDark
                            ? "#F8FAFC"
                            : "#050505",
                    },
                  ]}
                >
                  Suggestions
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() =>
                  setFriendsFilter(
                    friendsFilter === "friends" ? "all" : "friends",
                  )
                }
                style={[
                  styles.fbFriendsPill,
                  {
                    backgroundColor:
                      friendsFilter === "friends"
                        ? "#1877F2"
                        : isDark
                          ? "#334155"
                          : "#E4E6EB",
                  },
                ]}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.fbFriendsPillText,
                    {
                      color:
                        friendsFilter === "friends"
                          ? "#FFFFFF"
                          : isDark
                            ? "#F8FAFC"
                            : "#050505",
                    },
                  ]}
                >
                  Your Friends ({acceptedFriends.length})
                </Text>
              </TouchableOpacity>

              {friendsFilter !== "all" && (
                <TouchableOpacity
                  onPress={() => setFriendsFilter("all")}
                  style={[
                    styles.fbFriendsPill,
                    { backgroundColor: isDark ? "#1E293B" : "#F1F5F9" },
                  ]}
                >
                  <Text
                    style={[
                      styles.fbFriendsPillText,
                      { color: isDark ? "#94A3B8" : "#64748B" },
                    ]}
                  >
                    All
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Expandable Search Input */}
            {showNetworkSearch && (
              <View
                style={[
                  styles.searchBar,
                  {
                    backgroundColor: isDark ? "#1E293B" : "#F1F5F9",
                    borderColor: isDark ? "#334155" : "#E2E8F0",
                    marginTop: 10,
                  },
                ]}
              >
                <Feather
                  name="search"
                  size={16}
                  color={isDark ? "#94A3B8" : "#64748B"}
                />
                <TextInput
                  style={[
                    styles.searchInput,
                    { color: isDark ? "#F8FAFC" : "#0F172A" },
                  ]}
                  placeholder="Search friends & members..."
                  placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus
                />
                {searchQuery ? (
                  <TouchableOpacity onPress={() => setSearchQuery("")}>
                    <Feather
                      name="x"
                      size={16}
                      color={isDark ? "#94A3B8" : "#64748B"}
                    />
                  </TouchableOpacity>
                ) : null}
              </View>
            )}
          </View>

          {/* Main Content Area */}
          <ScrollView
            style={styles.networkScrollView}
            contentContainerStyle={[
              styles.networkScrollContent,
              { paddingBottom: insets.bottom + 80 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {friendsFilter === "friends" ? (
              /* YOUR FRIENDS VIEW */
              <View style={styles.fbFriendsSection}>
                <View style={styles.fbSectionHeaderRow}>
                  <Text
                    style={[
                      styles.fbSectionTitle,
                      { color: isDark ? "#F8FAFC" : "#050505" },
                    ]}
                  >
                    Your Friends ({acceptedFriends.length})
                  </Text>
                </View>

                {acceptedFriends.length === 0 ? (
                  <View
                    style={[
                      styles.emptyCard,
                      {
                        backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                        borderColor: isDark ? "#334155" : "#E2E8F0",
                      },
                    ]}
                  >
                    <Ionicons
                      name="people-outline"
                      size={48}
                      color={isDark ? "#475569" : "#CBD5E1"}
                    />
                    <Text
                      style={[
                        styles.emptyTitle,
                        { color: isDark ? "#F8FAFC" : "#0F172A" },
                      ]}
                    >
                      No friends yet
                    </Text>
                    <Text
                      style={[
                        styles.emptySub,
                        { color: isDark ? "#94A3B8" : "#64748B" },
                      ]}
                    >
                      Check out "Suggestions" or accept incoming requests to
                      build your roommate network!
                    </Text>
                    <TouchableOpacity
                      onPress={() => setFriendsFilter("all")}
                      style={styles.emptyCreateBtn}
                    >
                      <Feather name="search" size={16} color="#FFFFFF" />
                      <Text style={styles.emptyCreateBtnText}>
                        Discover People
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  acceptedFriends.map((f) => {
                    const friendRawName =
                      f.senderId === currentUid ? f.receiverName : f.senderName;
                    const friendEmail =
                      f.senderId === currentUid
                        ? f.receiverEmail
                        : f.senderEmail;
                    const friendCleanName = formatAuthorDisplayName(
                      friendRawName,
                      friendEmail,
                    );
                    const friendAvatar =
                      f.senderId === currentUid
                        ? f.receiverAvatar
                        : f.senderAvatar;
                    const friendUid =
                      f.senderId === currentUid ? f.receiverId : f.senderId;
                    const liveFriendAvatar = resolveMemberAvatar(
                      friendUid,
                      friendAvatar,
                    );
                    const isFriendAvatarFailed =
                      failedAvatarUids.has(friendUid);
                    const friendPalette = getAvatarPalette(
                      friendUid || friendCleanName,
                      isDark,
                    );

                    return (
                      <View
                        key={f.id}
                        style={[
                          styles.fbFriendRowCard,
                          {
                            backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                            borderBottomColor: isDark ? "#334155" : "#F1F5F9",
                          },
                        ]}
                      >
                        <TouchableOpacity
                          onPress={() =>
                            handleOpenUserProfile({
                              uid: friendUid,
                              name: friendCleanName,
                              avatar: liveFriendAvatar,
                              email: friendEmail,
                              role: "Splitzy Friend",
                            })
                          }
                          activeOpacity={0.8}
                          style={styles.fbFriendRowAvatarWrap}
                        >
                          {liveFriendAvatar && !isFriendAvatarFailed ? (
                            <Image
                              source={{ uri: liveFriendAvatar }}
                              style={styles.fbFriendRowAvatar}
                              onError={() =>
                                setFailedAvatarUids((prev) =>
                                  new Set(prev).add(friendUid),
                                )
                              }
                            />
                          ) : (
                            <View
                              style={[
                                styles.fbFriendRowAvatarPlaceholder,
                                {
                                  backgroundColor: friendPalette.bg,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.fbFriendRowInitial,
                                  {
                                    color: friendPalette.text,
                                    fontWeight: "700",
                                  },
                                ]}
                              >
                                {friendCleanName.charAt(0).toUpperCase()}
                              </Text>
                            </View>
                          )}
                        </TouchableOpacity>

                        <View style={styles.fbFriendRowInfo}>
                          <TouchableOpacity
                            onPress={() =>
                              handleOpenUserProfile({
                                uid: friendUid,
                                name: friendCleanName,
                                avatar: friendAvatar,
                                email: friendEmail,
                                role: "Splitzy Friend",
                              })
                            }
                            activeOpacity={0.8}
                          >
                            <Text
                              style={[
                                styles.fbFriendRowName,
                                { color: isDark ? "#F8FAFC" : "#050505" },
                              ]}
                              numberOfLines={1}
                            >
                              {friendCleanName}
                            </Text>
                          </TouchableOpacity>
                          <Text
                            style={[
                              styles.fbFriendRowSub,
                              { color: isDark ? "#94A3B8" : "#64748B" },
                            ]}
                          >
                            {formatFriendSubtitle(friendUid)}
                          </Text>

                          <View style={styles.fbFriendRowActions}>
                            <TouchableOpacity
                              onPress={() =>
                                handleOpenUserProfile({
                                  uid: friendUid,
                                  name: friendCleanName,
                                  avatar: friendAvatar,
                                  email: friendEmail,
                                  role: "Splitzy Friend",
                                })
                              }
                              style={[
                                styles.fbFriendViewProfileBtn,
                                {
                                  backgroundColor: isDark
                                    ? "#334155"
                                    : "#E4E6EB",
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.fbFriendViewProfileText,
                                  { color: isDark ? "#F8FAFC" : "#050505" },
                                ]}
                              >
                                View Profile
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={() => {
                                Alert.alert(
                                  "Friend Options",
                                  `Connection with ${friendCleanName}`,
                                  [
                                    {
                                      text: "Remove Friend",
                                      style: "destructive",
                                      onPress: () => handleDeclineRequest(f.id),
                                    },
                                    { text: "Cancel", style: "cancel" },
                                  ],
                                );
                              }}
                              style={[
                                styles.fbFriendMoreBtn,
                                {
                                  backgroundColor: isDark
                                    ? "#334155"
                                    : "#E4E6EB",
                                },
                              ]}
                            >
                              <Feather
                                name="more-horizontal"
                                size={18}
                                color={isDark ? "#94A3B8" : "#64748B"}
                              />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            ) : (
              /* UNIFIED FACEBOOK VIEW (Friend Requests + People You May Know) OR Pure Suggestions */
              <>
                {/* 1. FRIEND REQUESTS SECTION (Shown when not filtering to pure suggestions) */}
                {friendsFilter !== "suggestions" && (
                  <View style={styles.fbFriendsSection}>
                    <View style={styles.fbSectionHeaderRow}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <Text
                          style={[
                            styles.fbSectionTitle,
                            { color: isDark ? "#F8FAFC" : "#050505" },
                          ]}
                        >
                          Friend Requests
                        </Text>
                        {allIncomingRequests.length > 0 && (
                          <Text style={styles.fbSectionBadgeCount}>
                            {allIncomingRequests.length}
                          </Text>
                        )}
                      </View>
                      {allIncomingRequests.length > 0 && (
                        <TouchableOpacity
                          onPress={() =>
                            Alert.alert(
                              "Friend Requests",
                              `You have ${allIncomingRequests.length} pending friend requests.`,
                            )
                          }
                        >
                          <Text style={styles.fbSeeAllLink}>See all</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {allIncomingRequests.length === 0 ? (
                      <View style={styles.fbNoRequestsCard}>
                        <Ionicons
                          name="mail-unread-outline"
                          size={24}
                          color={isDark ? "#64748B" : "#94A3B8"}
                        />
                        <Text
                          style={[
                            styles.fbNoRequestsText,
                            { color: isDark ? "#94A3B8" : "#64748B" },
                          ]}
                        >
                          No pending requests right now
                        </Text>
                      </View>
                    ) : (
                      allIncomingRequests.map((req) => {
                        const isProcessing = processingActionId === req.id;
                        const senderCleanName = formatAuthorDisplayName(
                          req.senderName,
                          req.senderEmail,
                        );

                        const liveReqAvatar = resolveMemberAvatar(
                          req.senderId,
                          req.senderAvatar,
                        );
                        const isReqAvatarFailed = failedAvatarUids.has(
                          req.senderId,
                        );
                        const reqPalette = getAvatarPalette(
                          req.senderId || senderCleanName,
                          isDark,
                        );

                        return (
                          <View
                            key={req.id}
                            style={[
                              styles.fbReqCard,
                              {
                                backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                                borderBottomColor: isDark
                                  ? "#334155"
                                  : "#F1F5F9",
                              },
                            ]}
                          >
                            {/* Large Profile Avatar (tap to open User Profile) */}
                            <TouchableOpacity
                              onPress={() =>
                                handleOpenUserProfile({
                                  uid: req.senderId,
                                  name: senderCleanName,
                                  avatar: liveReqAvatar,
                                  email: req.senderEmail,
                                  role: "Splitzy Resident",
                                })
                              }
                              activeOpacity={0.8}
                              style={styles.fbReqAvatarWrap}
                            >
                              {liveReqAvatar && !isReqAvatarFailed ? (
                                <Image
                                  source={{ uri: liveReqAvatar }}
                                  style={styles.fbReqAvatar}
                                  onError={() =>
                                    setFailedAvatarUids((prev) =>
                                      new Set(prev).add(req.senderId),
                                    )
                                  }
                                />
                              ) : (
                                <View
                                  style={[
                                    styles.fbReqAvatarPlaceholder,
                                    {
                                      backgroundColor: reqPalette.bg,
                                    },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.fbReqAvatarInitials,
                                      {
                                        color: reqPalette.text,
                                        fontWeight: "700",
                                      },
                                    ]}
                                  >
                                    {senderCleanName.charAt(0).toUpperCase()}
                                  </Text>
                                </View>
                              )}
                            </TouchableOpacity>

                            {/* Details and Action Buttons on Right */}
                            <View style={styles.fbReqBody}>
                              <View style={styles.fbReqHeaderRow}>
                                <TouchableOpacity
                                  onPress={() =>
                                    handleOpenUserProfile({
                                      uid: req.senderId,
                                      name: senderCleanName,
                                      avatar: liveReqAvatar,
                                      email: req.senderEmail,
                                      role: "Splitzy Resident",
                                    })
                                  }
                                  activeOpacity={0.8}
                                  style={{ flex: 1 }}
                                >
                                  <Text
                                    style={[
                                      styles.fbReqName,
                                      { color: isDark ? "#F8FAFC" : "#050505" },
                                    ]}
                                    numberOfLines={1}
                                  >
                                    {senderCleanName}
                                  </Text>
                                </TouchableOpacity>
                                <Text
                                  style={[
                                    styles.fbReqTime,
                                    { color: isDark ? "#94A3B8" : "#64748B" },
                                  ]}
                                >
                                  {formatTimeAgo(req.createdAt) || "Recently"}
                                </Text>
                              </View>

                              <Text
                                style={[
                                  styles.fbReqMutual,
                                  { color: isDark ? "#94A3B8" : "#64748B" },
                                ]}
                                numberOfLines={1}
                              >
                                {req.senderEmail
                                  ? `Splitzy Member • ${req.senderEmail}`
                                  : "Splitzy Member • Friend Request"}
                              </Text>

                              {/* Two Action Buttons: Confirm & Delete */}
                              <View style={styles.fbReqBtnRow}>
                                <TouchableOpacity
                                  onPress={() => handleAcceptRequest(req.id)}
                                  disabled={isProcessing}
                                  style={styles.fbConfirmBtn}
                                  activeOpacity={0.8}
                                >
                                  {isProcessing ? (
                                    <ActivityIndicator
                                      size="small"
                                      color="#FFFFFF"
                                    />
                                  ) : (
                                    <Text style={styles.fbConfirmBtnText}>
                                      Confirm
                                    </Text>
                                  )}
                                </TouchableOpacity>

                                <TouchableOpacity
                                  onPress={() => handleDeclineRequest(req.id)}
                                  disabled={isProcessing}
                                  style={[
                                    styles.fbDeleteBtn,
                                    {
                                      backgroundColor: isDark
                                        ? "#334155"
                                        : "#E4E6EB",
                                    },
                                  ]}
                                  activeOpacity={0.8}
                                >
                                  <Text
                                    style={[
                                      styles.fbDeleteBtnText,
                                      {
                                        color: isDark ? "#F8FAFC" : "#050505",
                                      },
                                    ]}
                                  >
                                    Delete
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          </View>
                        );
                      })
                    )}
                  </View>
                )}

                {/* Hairline Divider between sections */}
                {friendsFilter !== "suggestions" && (
                  <View
                    style={[
                      styles.fbSectionDivider,
                      { backgroundColor: isDark ? "#334155" : "#E2E8F0" },
                    ]}
                  />
                )}

                {/* 2. PEOPLE YOU MAY KNOW SECTION */}
                <View style={styles.fbFriendsSection}>
                  <View style={styles.fbSectionHeaderRow}>
                    <Text
                      style={[
                        styles.fbSectionTitle,
                        { color: isDark ? "#F8FAFC" : "#050505" },
                      ]}
                    >
                      People You May Know
                    </Text>
                  </View>

                  {loadingMembers ? (
                    <View style={styles.centerBox}>
                      <ActivityIndicator size="large" color="#1877F2" />
                      <Text
                        style={[
                          styles.loadingText,
                          { color: isDark ? "#94A3B8" : "#64748B" },
                        ]}
                      >
                        Finding roommates and members...
                      </Text>
                    </View>
                  ) : peopleYouMayKnow.length === 0 ? (
                    <View
                      style={[
                        styles.emptyCard,
                        {
                          backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                          borderColor: isDark ? "#334155" : "#E2E8F0",
                        },
                      ]}
                    >
                      <Ionicons
                        name="people-outline"
                        size={48}
                        color={isDark ? "#475569" : "#CBD5E1"}
                      />
                      <Text
                        style={[
                          styles.emptyTitle,
                          { color: isDark ? "#F8FAFC" : "#0F172A" },
                        ]}
                      >
                        No suggestions right now
                      </Text>
                      <Text
                        style={[
                          styles.emptySub,
                          { color: isDark ? "#94A3B8" : "#64748B" },
                        ]}
                      >
                        New residents and roommates joining Splitzy will appear
                        here.
                      </Text>
                    </View>
                  ) : (
                    peopleYouMayKnow.map((member) => {
                      const isProcessing = processingActionId === member.uid;
                      const isSent = member.friendshipStatus === "pending_sent";
                      const cleanMemberName = formatAuthorDisplayName(
                        member.name,
                        member.email,
                      );

                      const liveMemberAvatar = resolveMemberAvatar(
                        member.uid,
                        member.avatar,
                      );
                      const isMemberAvatarFailed = failedAvatarUids.has(
                        member.uid,
                      );
                      const memberPalette = getAvatarPalette(
                        member.uid || cleanMemberName,
                        isDark,
                      );

                      return (
                        <View
                          key={member.uid}
                          style={[
                            styles.fbReqCard,
                            {
                              backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                              borderBottomColor: isDark ? "#334155" : "#F1F5F9",
                            },
                          ]}
                        >
                          {/* Large Profile Avatar (tap to open User Profile) */}
                          <TouchableOpacity
                            onPress={() =>
                              handleOpenUserProfile({
                                uid: member.uid,
                                name: cleanMemberName,
                                avatar: liveMemberAvatar,
                                email: member.email,
                                role: member.role,
                                householdName: member.householdName,
                              })
                            }
                            activeOpacity={0.8}
                            style={styles.fbReqAvatarWrap}
                          >
                            {liveMemberAvatar && !isMemberAvatarFailed ? (
                              <Image
                                source={{ uri: liveMemberAvatar }}
                                style={styles.fbReqAvatar}
                                onError={() =>
                                  setFailedAvatarUids((prev) =>
                                    new Set(prev).add(member.uid),
                                  )
                                }
                              />
                            ) : (
                              <View
                                style={[
                                  styles.fbReqAvatarPlaceholder,
                                  {
                                    backgroundColor: memberPalette.bg,
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.fbReqAvatarInitials,
                                    {
                                      color: memberPalette.text,
                                      fontWeight: "700",
                                    },
                                  ]}
                                >
                                  {cleanMemberName.charAt(0).toUpperCase()}
                                </Text>
                              </View>
                            )}
                          </TouchableOpacity>

                          {/* Details and Action Buttons on Right */}
                          <View style={styles.fbReqBody}>
                            <TouchableOpacity
                              onPress={() =>
                                handleOpenUserProfile({
                                  uid: member.uid,
                                  name: cleanMemberName,
                                  avatar: member.avatar,
                                  email: member.email,
                                  role: member.role,
                                  householdName: member.householdName,
                                })
                              }
                              activeOpacity={0.8}
                            >
                              <Text
                                style={[
                                  styles.fbReqName,
                                  { color: isDark ? "#F8FAFC" : "#050505" },
                                ]}
                                numberOfLines={1}
                              >
                                {cleanMemberName}
                              </Text>
                            </TouchableOpacity>

                            <Text
                              style={[
                                styles.fbReqMutual,
                                { color: isDark ? "#94A3B8" : "#64748B" },
                              ]}
                              numberOfLines={1}
                            >
                              {formatPymkSubtitle(
                                member.uid,
                                member.householdName,
                              )}
                            </Text>

                            {/* Two Action Buttons: Add Friend & Remove */}
                            <View style={styles.fbReqBtnRow}>
                              <TouchableOpacity
                                onPress={() => {
                                  if (!isSent && !isProcessing) {
                                    handleSendFriendRequest(member);
                                  }
                                }}
                                disabled={isSent || isProcessing}
                                style={[
                                  styles.fbConfirmBtn,
                                  {
                                    backgroundColor: isSent
                                      ? "#10B981"
                                      : "#1877F2",
                                  },
                                ]}
                                activeOpacity={0.8}
                              >
                                {isProcessing ? (
                                  <ActivityIndicator
                                    size="small"
                                    color="#FFFFFF"
                                  />
                                ) : (
                                  <Text style={styles.fbConfirmBtnText}>
                                    {isSent ? "Requested" : "Add Friend"}
                                  </Text>
                                )}
                              </TouchableOpacity>

                              <TouchableOpacity
                                onPress={() =>
                                  handleDismissSuggestion(member.uid)
                                }
                                style={[
                                  styles.fbDeleteBtn,
                                  {
                                    backgroundColor: isDark
                                      ? "#334155"
                                      : "#E4E6EB",
                                  },
                                ]}
                                activeOpacity={0.8}
                              >
                                <Text
                                  style={[
                                    styles.fbDeleteBtnText,
                                    {
                                      color: isDark ? "#F8FAFC" : "#050505",
                                    },
                                  ]}
                                >
                                  Remove
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              </>
            )}
          </ScrollView>
        </View>
      )}

      {/* Floating Action Button (FAB) for Creating Post / Reel */}
      {activeMainTab === "feed" && (
        <TouchableOpacity
          onPress={() => setCreatePostVisible(true)}
          style={[styles.fab, { bottom: Math.max(24, insets.bottom + 84) }]}
          activeOpacity={0.85}
        >
          <Ionicons name="create-outline" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* {activeMainTab === "reels" && (
        <TouchableOpacity
          onPress={() => setCreateReelVisible(true)}
          style={[
            styles.fab,
            {
              bottom: Math.max(24, insets.bottom + 84),
              backgroundColor: "#2563EB",
            },
          ]}
          activeOpacity={0.85}
        >
          <Ionicons name="videocam" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      )} */}

      {/* Modals */}
      <CreatePostModal
        visible={createPostVisible}
        onClose={() => setCreatePostVisible(false)}
        currentUser={currentUser}
      />

      <PostCommentsModal
        visible={!!activePostForComments}
        post={activePostForComments}
        onClose={() => setActivePostForComments(null)}
        currentUser={currentUser}
      />

      {/* Create Reel Modal */}
      <CreateReelModal
        visible={createReelVisible}
        onClose={() => setCreateReelVisible(false)}
        currentUser={currentUser}
        onReelCreated={() => {
          setActiveMainTab("reels");
        }}
      />

      {/* Reel Comments Modal */}
      <ReelCommentsModal
        visible={!!activeReelForComments}
        reel={activeReelForComments}
        onClose={() => setActiveReelForComments(null)}
        currentUser={currentUser}
      />

      {/* Post Options Bottom Sheet Modal */}
      {activePostForMenu && (
        <SmoothBottomSheetModal
          visible={!!activePostForMenu}
          onClose={() => setActivePostForMenu(null)}
          title={
            activePostForMenu.authorId === currentUid
              ? "Manage Your Post"
              : "Post Options"
          }
          subtitle={`${resolvePostAuthorName(activePostForMenu)} · ${formatTimeAgo(activePostForMenu.createdAt)}`}
          icon={
            <Ionicons
              name="ellipsis-horizontal-circle-outline"
              size={20}
              color="#2563EB"
            />
          }
          maxHeight="60%"
          showChipBar={true}
        >
          <View
            style={{
              gap: 10,
              paddingBottom: Math.max(28, insets.bottom + 16),
            }}
          >
            {/* Share Post */}
            <TouchableOpacity
              style={[
                styles.cardMenuItem,
                { backgroundColor: isDark ? "#1E222B" : "#F8FAFC" },
              ]}
              onPress={() => {
                const target = activePostForMenu;
                setActivePostForMenu(null);
                handleSharePost(target);
              }}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.cardMenuIconWrap,
                  { backgroundColor: isDark ? "#1E293B" : "#EFF6FF" },
                ]}
              >
                <Feather name="share-2" size={18} color="#2563EB" />
              </View>
              <View style={styles.cardMenuItemBody}>
                <Text
                  style={[
                    styles.cardMenuItemTitle,
                    { color: isDark ? "#F8FAFC" : "#0F172A" },
                  ]}
                >
                  Share Post
                </Text>
                <Text
                  style={[
                    styles.cardMenuItemDesc,
                    { color: isDark ? "#94A3B8" : "#64748B" },
                  ]}
                >
                  Share via messaging or other apps
                </Text>
              </View>
              <Feather
                name="chevron-right"
                size={18}
                color={isDark ? "#64748B" : "#94A3B8"}
              />
            </TouchableOpacity>

            {/* Copy Post Text */}
            {activePostForMenu.content ? (
              <TouchableOpacity
                style={[
                  styles.cardMenuItem,
                  { backgroundColor: isDark ? "#1E222B" : "#F8FAFC" },
                ]}
                onPress={async () => {
                  const content = activePostForMenu?.content || "";
                  setActivePostForMenu(null);
                  const copied = await safeCopyTextAsync(content);
                  if (copied) {
                    Alert.alert(
                      "Copied to Clipboard",
                      "Post text has been copied to your clipboard.",
                    );
                  } else {
                    Alert.alert("Post Text", content);
                  }
                }}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.cardMenuIconWrap,
                    { backgroundColor: isDark ? "#1E293B" : "#EFF6FF" },
                  ]}
                >
                  <Feather name="copy" size={18} color="#2563EB" />
                </View>
                <View style={styles.cardMenuItemBody}>
                  <Text
                    style={[
                      styles.cardMenuItemTitle,
                      { color: isDark ? "#F8FAFC" : "#0F172A" },
                    ]}
                  >
                    Copy Post Text
                  </Text>
                  <Text
                    style={[
                      styles.cardMenuItemDesc,
                      { color: isDark ? "#94A3B8" : "#64748B" },
                    ]}
                  >
                    Copy text content to clipboard
                  </Text>
                </View>
                <Feather
                  name="chevron-right"
                  size={18}
                  color={isDark ? "#64748B" : "#94A3B8"}
                />
              </TouchableOpacity>
            ) : null}

            {/* View Author Profile */}
            <TouchableOpacity
              style={[
                styles.cardMenuItem,
                { backgroundColor: isDark ? "#1E222B" : "#F8FAFC" },
              ]}
              onPress={() => {
                const target = activePostForMenu;
                setActivePostForMenu(null);
                const liveAuthorAvatar = resolveMemberAvatar(
                  target.authorId,
                  target.authorAvatar,
                );
                handleOpenUserProfile({
                  uid: target.authorId,
                  name: resolvePostAuthorName(target),
                  avatar: liveAuthorAvatar,
                  email: target.authorEmail,
                  role: target.authorRole,
                  householdName: target.authorHouseholdName,
                });
              }}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.cardMenuIconWrap,
                  { backgroundColor: isDark ? "#1E293B" : "#EFF6FF" },
                ]}
              >
                <Feather name="user" size={18} color="#2563EB" />
              </View>
              <View style={styles.cardMenuItemBody}>
                <Text
                  style={[
                    styles.cardMenuItemTitle,
                    { color: isDark ? "#F8FAFC" : "#0F172A" },
                  ]}
                >
                  {activePostForMenu.authorId === currentUid
                    ? "View Your Profile"
                    : `View ${resolvePostAuthorName(activePostForMenu)}'s Profile`}
                </Text>
                <Text
                  style={[
                    styles.cardMenuItemDesc,
                    { color: isDark ? "#94A3B8" : "#64748B" },
                  ]}
                >
                  View mutual friends, posts, and details
                </Text>
              </View>
              <Feather
                name="chevron-right"
                size={18}
                color={isDark ? "#64748B" : "#94A3B8"}
              />
            </TouchableOpacity>

            {/* Hide Post (if not Author) */}
            {activePostForMenu.authorId !== currentUid && (
              <TouchableOpacity
                style={[
                  styles.cardMenuItem,
                  { backgroundColor: isDark ? "#1E222B" : "#F8FAFC" },
                ]}
                onPress={() => {
                  const hidePostId = activePostForMenu?.id;
                  setActivePostForMenu(null);
                  if (hidePostId) {
                    setPosts((prev) => prev.filter((p) => p.id !== hidePostId));
                    Alert.alert(
                      "Post Hidden",
                      "You won't see this post in your feed anymore.",
                    );
                  }
                }}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.cardMenuIconWrap,
                    { backgroundColor: isDark ? "#1E293B" : "#F1F5F9" },
                  ]}
                >
                  <Feather
                    name="eye-off"
                    size={18}
                    color={isDark ? "#94A3B8" : "#64748B"}
                  />
                </View>
                <View style={styles.cardMenuItemBody}>
                  <Text
                    style={[
                      styles.cardMenuItemTitle,
                      { color: isDark ? "#F8FAFC" : "#0F172A" },
                    ]}
                  >
                    Hide Post
                  </Text>
                  <Text
                    style={[
                      styles.cardMenuItemDesc,
                      { color: isDark ? "#94A3B8" : "#64748B" },
                    ]}
                  >
                    See fewer posts like this in your feed
                  </Text>
                </View>
                <Feather
                  name="chevron-right"
                  size={18}
                  color={isDark ? "#64748B" : "#94A3B8"}
                />
              </TouchableOpacity>
            )}

            {/* Delete Post (if Author) */}
            {activePostForMenu.authorId === currentUid && (
              <TouchableOpacity
                style={[
                  styles.cardMenuItem,
                  {
                    backgroundColor: isDark
                      ? "rgba(239,68,68,0.12)"
                      : "#FEF2F2",
                    borderWidth: 1,
                    borderColor: isDark ? "rgba(239,68,68,0.3)" : "#FCA5A5",
                  },
                ]}
                onPress={() => {
                  const target = activePostForMenu;
                  setActivePostForMenu(null);
                  Alert.alert(
                    "Delete Post?",
                    "Are you sure you want to permanently delete this post? This cannot be undone.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () => handleDeletePost(target),
                      },
                    ],
                  );
                }}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.cardMenuIconWrap,
                    {
                      backgroundColor: isDark
                        ? "rgba(239,68,68,0.2)"
                        : "#FEE2E2",
                    },
                  ]}
                >
                  <Feather name="trash-2" size={18} color="#EF4444" />
                </View>
                <View style={styles.cardMenuItemBody}>
                  <Text
                    style={[
                      styles.cardMenuItemTitle,
                      { color: "#EF4444", fontWeight: "700" },
                    ]}
                  >
                    Delete Post
                  </Text>
                  <Text
                    style={[
                      styles.cardMenuItemDesc,
                      { color: isDark ? "#FCA5A5" : "#DC2626" },
                    ]}
                  >
                    Permanently remove this post
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color="#EF4444" />
              </TouchableOpacity>
            )}

            {/* Report Post (if not Author) */}
            {activePostForMenu.authorId !== currentUid && (
              <TouchableOpacity
                style={[
                  styles.cardMenuItem,
                  { backgroundColor: isDark ? "#1E222B" : "#F8FAFC" },
                ]}
                onPress={() => {
                  setActivePostForMenu(null);
                  Alert.alert(
                    "Post Reported",
                    "Thank you for letting us know. Our community team will review this post.",
                  );
                }}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.cardMenuIconWrap,
                    { backgroundColor: isDark ? "#1E293B" : "#FEF3C7" },
                  ]}
                >
                  <Feather name="flag" size={18} color="#F59E0B" />
                </View>
                <View style={styles.cardMenuItemBody}>
                  <Text
                    style={[
                      styles.cardMenuItemTitle,
                      { color: isDark ? "#F8FAFC" : "#0F172A" },
                    ]}
                  >
                    Report Post
                  </Text>
                  <Text
                    style={[
                      styles.cardMenuItemDesc,
                      { color: isDark ? "#94A3B8" : "#64748B" },
                    ]}
                  >
                    Report inappropriate content or spam
                  </Text>
                </View>
                <Feather
                  name="chevron-right"
                  size={18}
                  color={isDark ? "#64748B" : "#94A3B8"}
                />
              </TouchableOpacity>
            )}
          </View>
        </SmoothBottomSheetModal>
      )}

      <CreateStoryModal
        visible={createStoryVisible}
        onClose={() => setCreateStoryVisible(false)}
        currentUser={currentUser}
      />

      <StoryViewerModal
        visible={storyViewerVisible}
        stories={
          viewingArchiveList.length > 0 ? viewingArchiveList : displayStories
        }
        initialIndex={selectedStoryIndex}
        currentUserId={currentUid}
        onClose={() => {
          setStoryViewerVisible(false);
          setViewingArchiveList([]);
        }}
        onLikeStory={handleLikeStory}
        onEditStory={(story) => {
          setEditingStory(story);
        }}
        onDeleteStory={handleDeleteStory}
      />

      <EditStoryModal
        visible={!!editingStory}
        story={editingStory}
        onClose={() => setEditingStory(null)}
        onStoryUpdated={handleStoryUpdated}
      />

      {/* Card Three-Dots Quick Action Menu Modal */}
      {storyActionTarget && (
        <Modal
          visible={!!storyActionTarget}
          transparent
          animationType="fade"
          onRequestClose={() => setStoryActionTarget(null)}
        >
          <TouchableOpacity
            style={styles.cardMenuBackdrop}
            activeOpacity={1}
            onPress={() => setStoryActionTarget(null)}
          >
            <View
              style={[
                styles.cardMenuSheet,
                {
                  backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                  borderColor: isDark ? "#334155" : "#E2E8F0",
                },
              ]}
            >
              <View style={styles.cardMenuHandle} />
              <View style={styles.cardMenuHeader}>
                <Text
                  style={[
                    styles.cardMenuTitle,
                    { color: isDark ? "#F8FAFC" : "#0F172A" },
                  ]}
                >
                  Manage Your Story
                </Text>
                <Text
                  style={[
                    styles.cardMenuSubtitle,
                    { color: isDark ? "#94A3B8" : "#64748B" },
                  ]}
                >
                  {calculateStoryTimeRemaining(storyActionTarget).isExpired
                    ? "Expired"
                    : `Active · ${calculateStoryTimeRemaining(storyActionTarget).label}`}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.cardMenuItem,
                  { backgroundColor: isDark ? "#0F172A" : "#F8FAFC" },
                ]}
                onPress={() => {
                  const target = storyActionTarget;
                  setStoryActionTarget(null);
                  const idx = displayStories.findIndex(
                    (s) => s.id === target.id,
                  );
                  setSelectedStoryIndex(idx >= 0 ? idx : 0);
                  setStoryViewerVisible(true);
                }}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.cardMenuIconWrap,
                    { backgroundColor: isDark ? "#1E293B" : "#EFF6FF" },
                  ]}
                >
                  <Ionicons name="eye-outline" size={18} color="#2563EB" />
                </View>
                <View style={styles.cardMenuItemBody}>
                  <Text
                    style={[
                      styles.cardMenuItemTitle,
                      { color: isDark ? "#F8FAFC" : "#0F172A" },
                    ]}
                  >
                    View Story
                  </Text>
                  <Text
                    style={[
                      styles.cardMenuItemDesc,
                      { color: isDark ? "#94A3B8" : "#64748B" },
                    ]}
                  >
                    Open fullscreen playback
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color="#94A3B8" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.cardMenuItem,
                  { backgroundColor: isDark ? "#0F172A" : "#F8FAFC" },
                ]}
                onPress={() => {
                  const target = storyActionTarget;
                  setStoryActionTarget(null);
                  setEditingStory(target);
                }}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.cardMenuIconWrap,
                    { backgroundColor: isDark ? "#1E293B" : "#EFF6FF" },
                  ]}
                >
                  <Feather name="edit-2" size={18} color="#2563EB" />
                </View>
                <View style={styles.cardMenuItemBody}>
                  <Text
                    style={[
                      styles.cardMenuItemTitle,
                      { color: isDark ? "#F8FAFC" : "#0F172A" },
                    ]}
                  >
                    Edit Story
                  </Text>
                  <Text
                    style={[
                      styles.cardMenuItemDesc,
                      { color: isDark ? "#94A3B8" : "#64748B" },
                    ]}
                  >
                    Update caption and styling
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color="#94A3B8" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.cardMenuItem,
                  { backgroundColor: isDark ? "#0F172A" : "#F8FAFC" },
                ]}
                onPress={() => {
                  const target = storyActionTarget;
                  setStoryActionTarget(null);
                  Alert.alert(
                    "Delete Story?",
                    "Are you sure you want to permanently delete this story?",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () => handleDeleteStory(target),
                      },
                    ],
                  );
                }}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.cardMenuIconWrap,
                    { backgroundColor: isDark ? "#451A1A" : "#FEE2E2" },
                  ]}
                >
                  <Feather name="trash-2" size={18} color="#EF4444" />
                </View>
                <View style={styles.cardMenuItemBody}>
                  <Text
                    style={[styles.cardMenuItemTitle, { color: "#EF4444" }]}
                  >
                    Delete Story
                  </Text>
                  <Text
                    style={[
                      styles.cardMenuItemDesc,
                      { color: isDark ? "#94A3B8" : "#64748B" },
                    ]}
                  >
                    Remove this story completely
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color="#94A3B8" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.cardMenuCancelBtn,
                  { backgroundColor: isDark ? "#334155" : "#E2E8F0" },
                ]}
                onPress={() => setStoryActionTarget(null)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.cardMenuCancelText,
                    { color: isDark ? "#F8FAFC" : "#0F172A" },
                  ]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Story Archive Modal (User's Private Archive of Expired Stories) */}
      <Modal
        visible={showStoryArchive}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowStoryArchive(false)}
      >
        <View
          style={[
            styles.archiveModalContainer,
            {
              backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
              paddingTop: insets.top > 0 ? insets.top : 16,
              paddingBottom: insets.bottom > 0 ? insets.bottom : 16,
            },
          ]}
        >
          <View
            style={[
              styles.archiveModalHeader,
              { borderBottomColor: isDark ? "#1E293B" : "#F1F5F9" },
            ]}
          >
            <TouchableOpacity
              onPress={() => setShowStoryArchive(false)}
              style={styles.archiveCloseBtn}
            >
              <Feather
                name="x"
                size={22}
                color={isDark ? "#94A3B8" : "#64748B"}
              />
            </TouchableOpacity>

            <View style={{ alignItems: "center" }}>
              <Text
                style={[
                  styles.archiveModalTitle,
                  { color: isDark ? "#F8FAFC" : "#0F172A" },
                ]}
              >
                My Story Archive
              </Text>
              <Text
                style={[
                  styles.archiveModalSub,
                  { color: isDark ? "#94A3B8" : "#64748B" },
                ]}
              >
                {myArchivedStories.length} expired{" "}
                {myArchivedStories.length === 1 ? "story" : "stories"}
              </Text>
            </View>

            <View style={{ width: 36 }} />
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.archiveScrollContent}
          >
            <View
              style={[
                styles.archiveIntroCard,
                {
                  backgroundColor: isDark ? "#1E293B" : "#EFF6FF",
                  borderColor: isDark ? "#334155" : "#BFDBFE",
                },
              ]}
            >
              <Ionicons name="time" size={20} color="#2563EB" />
              <Text
                style={[
                  styles.archiveIntroText,
                  { color: isDark ? "#CBD5E1" : "#1E40AF" },
                ]}
              >
                Stories automatically hide from the public feed 24 hours after
                posting and are saved here in your private archive.
              </Text>
            </View>

            {myArchivedStories.length === 0 ? (
              <View style={styles.archiveEmptyState}>
                <Ionicons
                  name="file-tray-outline"
                  size={48}
                  color={isDark ? "#475569" : "#CBD5E1"}
                />
                <Text
                  style={[
                    styles.archiveEmptyTitle,
                    { color: isDark ? "#F8FAFC" : "#0F172A" },
                  ]}
                >
                  No archived stories yet
                </Text>
                <Text
                  style={[
                    styles.archiveEmptySub,
                    { color: isDark ? "#94A3B8" : "#64748B" },
                  ]}
                >
                  When your stories reach the 24-hour mark, they will appear
                  here safely preserved.
                </Text>
              </View>
            ) : (
              <View style={styles.archiveGrid}>
                {myArchivedStories.map((story, aIdx) => (
                  <View
                    key={story.id || aIdx}
                    style={[
                      styles.archiveCard,
                      {
                        backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                        borderColor: isDark ? "#334155" : "#E2E8F0",
                      },
                    ]}
                  >
                    <TouchableOpacity
                      onPress={() => {
                        setViewingArchiveList(myArchivedStories);
                        setSelectedStoryIndex(aIdx);
                        setStoryViewerVisible(true);
                      }}
                      style={styles.archiveCardMedia}
                      activeOpacity={0.85}
                    >
                      {story.mediaUrl ? (
                        <Image
                          source={{ uri: story.mediaUrl }}
                          style={styles.archiveMediaImg}
                          resizeMode="cover"
                        />
                      ) : (
                        <View
                          style={[
                            styles.archiveMediaTextBg,
                            story.backgroundColor
                              ? { backgroundColor: story.backgroundColor }
                              : null,
                          ]}
                        >
                          <Ionicons name="sparkles" size={20} color="#93C5FD" />
                          <Text
                            style={styles.archiveMediaCaption}
                            numberOfLines={3}
                          >
                            {story.caption || "Text story"}
                          </Text>
                        </View>
                      )}
                      <View style={styles.archiveExpiredTag}>
                        <Text style={styles.archiveExpiredTagText}>
                          Expired
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <View style={styles.archiveCardInfo}>
                      <Text
                        style={[
                          styles.archiveDateText,
                          { color: isDark ? "#94A3B8" : "#64748B" },
                        ]}
                      >
                        {formatTimeAgo(story.createdAt)}
                      </Text>

                      <View style={styles.archiveCardActions}>
                        <TouchableOpacity
                          onPress={() => {
                            setEditingStory(story);
                          }}
                          style={styles.archiveActionIcon}
                        >
                          <Feather
                            name="edit-2"
                            size={15}
                            color={isDark ? "#94A3B8" : "#64748B"}
                          />
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => {
                            Alert.alert(
                              "Delete Archived Story?",
                              "Are you sure you want to delete this story from your archive?",
                              [
                                { text: "Cancel", style: "cancel" },
                                {
                                  text: "Delete",
                                  style: "destructive",
                                  onPress: () => handleDeleteStory(story),
                                },
                              ],
                            );
                          }}
                          style={styles.archiveActionIcon}
                        >
                          <Feather name="trash-2" size={15} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Fullscreen Image Lightbox Modal for all feed post media */}
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 6,
    marginRight: 8,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerAvatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    position: "relative",
  },
  headerAvatarImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  headerAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatarInitials: {
    fontSize: 14,
    fontWeight: "700",
  },
  headerAvatarOnlineDot: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#10B981",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  headerPostBtn: {
    backgroundColor: "#2563EB",
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  mainTabsContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  mainTabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 7,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  mainTabBtnActive: {
    borderBottomColor: "#2563EB",
  },
  mainTabBtnText: {
    fontSize: 14,
  },
  tabBadge: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  tabBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  feedScrollView: {
    flex: 1,
  },
  feedScrollContent: {
    paddingTop: 10,
  },
  /* Quick Post Card */
  quickPostCard: {
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 12,
  },
  quickPostRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  quickPostAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  quickPostAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  quickPostAvatarInitials: {
    fontSize: 16,
    fontWeight: "700",
  },
  quickPostInputFake: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  quickPostPlaceholder: {
    fontSize: 14,
  },
  quickPostFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  quickPostAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  quickPostActionText: {
    fontSize: 13,
    fontWeight: "600",
  },
  /* Story Reels Section */
  storiesContainer: {
    marginBottom: 12,
  },
  storiesHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  storiesTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  storiesSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  storiesExpiryBadge: {
    fontSize: 12,
    color: "#2563EB",
    fontWeight: "600",
  },
  archiveHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  archiveHeaderBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2563EB",
  },
  storiesScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  createStoryCard: {
    width: 110,
    height: 185,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  createStoryTopHalf: {
    height: "65%",
    width: "100%",
  },
  createStoryAvatarBg: {
    width: "100%",
    height: "100%",
  },
  createStoryAvatarPlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  createStoryInitials: {
    fontSize: 28,
    fontWeight: "800",
  },
  createStoryPlusIconWrap: {
    position: "absolute",
    top: "55%",
    alignSelf: "center",
    zIndex: 10,
  },
  createStoryPlusCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#2563EB",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    elevation: 3,
  },
  createStoryBottomHalf: {
    height: "35%",
    width: "100%",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 8,
  },
  createStoryLabel: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  storyCard: {
    width: 110,
    height: 185,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
    justifyContent: "space-between",
    padding: 8,
  },
  storyImageBg: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 110,
    height: 185,
  },
  storyTextCardBg: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 110,
    height: 185,
    backgroundColor: "#1E3A8A",
    justifyContent: "center",
    alignItems: "center",
  },
  storyGradientOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 110,
    height: 185,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  storyRingWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2.5,
    borderColor: "#2563EB",
    padding: 1.5,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  storyAuthorAvatar: {
    width: "100%",
    height: "100%",
    borderRadius: 16,
  },
  storyAuthorAvatarPlaceholder: {
    width: "100%",
    height: "100%",
    borderRadius: 16,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
  },
  storyAuthorInitial: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  storyAuthorName: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowRadius: 3,
  },
  storyCardMenuBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  storyCardExpiryWrap: {
    position: "absolute",
    bottom: 24,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  storyCardExpiryText: {
    color: "#93C5FD",
    fontSize: 9,
    fontWeight: "700",
  },
  storyCardCaption: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    paddingHorizontal: 8,
    marginTop: 6,
  },
  /* Card Menu Action Sheet */
  cardMenuBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  cardMenuSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    borderTopWidth: 1,
  },
  cardMenuHandle: {
    width: 36,
    height: 4,
    backgroundColor: "#94A3B8",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 14,
  },
  cardMenuHeader: {
    alignItems: "center",
    marginBottom: 16,
  },
  cardMenuTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  cardMenuSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  cardMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 10,
  },
  cardMenuIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  cardMenuItemBody: {
    flex: 1,
  },
  cardMenuItemTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  cardMenuItemDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  cardMenuCancelBtn: {
    marginTop: 6,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  cardMenuCancelText: {
    fontSize: 14,
    fontWeight: "600",
  },
  /* Archive Modal */
  archiveModalContainer: {
    flex: 1,
  },
  archiveModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  archiveCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  archiveModalTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  archiveModalSub: {
    fontSize: 12,
    marginTop: 1,
  },
  archiveScrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  archiveIntroCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  archiveIntroText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  archiveEmptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  archiveEmptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 14,
    marginBottom: 4,
  },
  archiveEmptySub: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  archiveGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  archiveCard: {
    width: "48%",
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 4,
  },
  archiveCardMedia: {
    width: "100%",
    height: 160,
    position: "relative",
    backgroundColor: "#000000",
  },
  archiveMediaImg: {
    width: "100%",
    height: "100%",
  },
  archiveMediaTextBg: {
    width: "100%",
    height: "100%",
    backgroundColor: "#1E3A8A",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  archiveMediaCaption: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 8,
  },
  archiveExpiredTag: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  archiveExpiredTagText: {
    color: "#FCA5A5",
    fontSize: 10,
    fontWeight: "700",
  },
  archiveCardInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  archiveDateText: {
    fontSize: 11,
  },
  archiveCardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  archiveActionIcon: {
    padding: 4,
  },
  /* Scope & Categories */
  scopeRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    marginBottom: 8,
    gap: 8,
  },
  scopeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  scopeChipText: {
    fontSize: 12,
  },
  categoryScroll: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 8,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: 12,
  },
  /* Facebook Post Card */
  fbPostCard: {
    borderWidth: 0.5,
  },
  fbPostHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  fbPostAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 10,
  },
  fbPostAvatarPlaceholder: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  fbPostAvatarInitials: {
    fontSize: 17,
    fontWeight: "700",
  },
  fbPostAuthorInfo: {
    flex: 1,
  },
  fbAuthorNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  fbAuthorName: {
    fontSize: 15,
    fontWeight: "700",
  },
  hostBadge: {
    backgroundColor: "#F59E0B",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  hostBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
  },
  fbMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    gap: 4,
  },
  fbTimeText: {
    fontSize: 12,
  },
  fbDotSeparator: {
    fontSize: 12,
  },
  fbCategoryTag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  fbCategoryTagText: {
    fontSize: 11,
    fontWeight: "600",
  },
  fbMoreBtn: {
    padding: 6,
  },
  fbContentText: {
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  /* Media */
  fbImagesContainer: {
    width: "100%",
    marginBottom: 8,
  },
  fbSingleImage: {
    width: "100%",
    height: 290,
  },
  fbMultiImageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
  },
  fbGridImage: {
    width: "49.5%",
    height: 180,
  },
  /* Facebook Stats Row */
  fbStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderTopWidth: 1,
  },
  fbReactionGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  fbReactionBubbles: {
    flexDirection: "row",
  },
  fbLikeBubble: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  fbHeartBubble: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: -4,
  },
  fbStatsText: {
    fontSize: 12,
  },
  fbRightStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  /* Facebook Action Bar Wrap & Floating Reaction Dock */
  fbActionBarWrap: {
    position: "relative",
    zIndex: 50,
  },
  reactionBackdrop: {
    position: "absolute",
    top: -260,
    bottom: -80,
    left: -40,
    right: -40,
    zIndex: 90,
  },
  fbReactionDock: {
    position: "absolute",
    bottom: 46,
    left: 8,
    zIndex: 100,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 36,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 12,
    gap: 4,
  },
  fbReactionDockItem: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 18,
    minWidth: 42,
  },
  fbReactionDockEmoji: {
    fontSize: 26,
    marginBottom: 2,
  },
  fbReactionDockLabel: {
    fontSize: 10,
    fontWeight: "700",
  },
  fbReactBtnEmoji: {
    fontSize: 18,
    marginRight: 2,
  },
  fbBubbleCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    marginRight: -4,
  },
  fbBubbleEmoji: {
    fontSize: 9,
  },
  /* Facebook Action Bar */
  fbActionBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: 3,
  },
  fbActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 7,
    gap: 6,
  },
  fbActionBtnText: {
    fontSize: 13,
  },
  /* Inline comment */
  fbInlineCommentRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 10,
  },
  fbMiniCommentAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  fbMiniCommentAvatarPlaceholder: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  fbMiniCommentInitial: {
    fontSize: 13,
    fontWeight: "700",
  },
  fbInlineCommentInput: {
    flex: 1,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fbInlineCommentPlaceholder: {
    fontSize: 13,
  },
  /* People You May Know Section */
  pymkSectionCard: {
    borderWidth: 0.5,
    paddingVertical: 12,
  },
  pymkHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  pymkTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pymkTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  pymkSeeAllText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2563EB",
  },
  pymkScrollContent: {
    paddingHorizontal: 14,
    gap: 12,
  },
  pymkCard: {
    width: 250,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  pymkDismissBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  pymkAvatarWrap: {
    width: "100%",
    height: 195,
  },
  pymkAvatar: {
    width: "100%",
    height: "100%",
  },
  pymkAvatarPlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  pymkInitial: {
    fontSize: 48,
    fontWeight: "700",
  },
  pymkBody: {
    padding: 12,
    gap: 4,
  },
  pymkName: {
    fontSize: 15,
    fontWeight: "700",
  },
  pymkSub: {
    fontSize: 12,
    marginBottom: 8,
  },
  pymkAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
  },
  pymkAddBtnSent: {
    backgroundColor: "#10B981",
  },
  pymkAddBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  pymkRemoveBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 4,
  },
  pymkRemoveBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  /* Network Styles */
  networkContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  networkSubTabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  networkSubTabBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  networkSubTabBtnActive: {
    borderBottomColor: "#2563EB",
  },
  networkSubTabText: {
    fontSize: 13,
  },
  requestsLabelWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  subTabBadge: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  subTabBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    height: 40,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  networkScrollView: {
    flex: 1,
  },
  networkScrollContent: {
    padding: 4,
    gap: 4,
  },
  memberCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  memberAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginRight: 12,
  },
  memberAvatarPlaceholder: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  memberAvatarInitials: {
    fontSize: 17,
    fontWeight: "700",
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: "700",
  },
  memberHousehold: {
    fontSize: 12,
    marginTop: 2,
  },
  memberRole: {
    fontSize: 12,
    marginTop: 2,
  },
  addFriendBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#2563EB",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
  },
  addFriendBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  pendingSentBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
  },
  pendingSentBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  acceptMiniBtn: {
    backgroundColor: "#10B981",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
  },
  acceptMiniBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  friendBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  friendBadgeText: {
    color: "#10B981",
    fontSize: 12,
    fontWeight: "700",
  },
  requestCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  requestHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  requestActionRow: {
    flexDirection: "row",
    gap: 10,
  },
  confirmBtn: {
    flex: 1,
    backgroundColor: "#2563EB",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  deleteReqBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteReqBtnText: {
    fontWeight: "600",
    fontSize: 14,
  },
  moreFriendBtn: {
    padding: 6,
  },
  /* Empty & Loading */
  centerBox: {
    paddingVertical: 40,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
  },
  emptyCard: {
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 16,
    marginTop: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
  },
  emptyCreateBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2563EB",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
    gap: 8,
  },
  emptyCreateBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  /* Facebook Friends & Network Styles */
  fbFriendsTopBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fbFriendsTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  fbFriendsMainTitle: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  fbFriendsSearchIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  fbFriendsPillsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  fbFriendsPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  fbFriendsPillText: {
    fontSize: 14,
    fontWeight: "700",
  },
  fbFriendsSection: {
    paddingTop: 14,
  },
  fbSectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  fbSectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  fbSectionBadgeCount: {
    fontSize: 18,
    fontWeight: "800",
    color: "#E11D48",
  },
  fbSeeAllLink: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1877F2",
  },
  fbNoRequestsCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  fbNoRequestsText: {
    fontSize: 14,
    fontWeight: "500",
  },
  fbSectionDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 14,
    marginHorizontal: 16,
  },
  fbReqCard: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fbReqAvatarWrap: {
    marginRight: 14,
  },
  fbReqAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  fbReqAvatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  fbReqAvatarInitials: {
    fontSize: 28,
    fontWeight: "800",
  },
  fbReqBody: {
    flex: 1,
    justifyContent: "center",
  },
  fbReqHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  fbReqName: {
    fontSize: 16,
    fontWeight: "700",
  },
  fbReqTime: {
    fontSize: 12,
  },
  fbReqMutual: {
    fontSize: 13,
    marginTop: 2,
    marginBottom: 8,
  },
  fbReqBtnRow: {
    flexDirection: "row",
    gap: 8,
  },
  fbConfirmBtn: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#1877F2",
    alignItems: "center",
    justifyContent: "center",
  },
  fbConfirmBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  fbDeleteBtn: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  fbDeleteBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
  fbFriendRowCard: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fbFriendRowAvatarWrap: {
    marginRight: 14,
  },
  fbFriendRowAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  fbFriendRowAvatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  fbFriendRowInitial: {
    fontSize: 22,
    fontWeight: "800",
  },
  fbFriendRowInfo: {
    flex: 1,
  },
  fbFriendRowName: {
    fontSize: 16,
    fontWeight: "700",
  },
  fbFriendRowSub: {
    fontSize: 13,
    marginTop: 2,
  },
  fbFriendRowActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  fbFriendViewProfileBtn: {
    flex: 1,
    height: 34,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  fbFriendViewProfileText: {
    fontSize: 13,
    fontWeight: "700",
  },
  fbFriendMoreBtn: {
    width: 38,
    height: 34,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  // Reels Tab Styles
  reelsTabContainer: {
    flex: 1,
    backgroundColor: "#000000",
    position: "relative",
    overflow: "hidden",
  },
  floatingReelsTopBar: {
    position: "absolute",
    left: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 40,
    gap: 8,
  },
  floatingReelsBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
  },
  floatingCategoriesScrollWrapper: {
    flex: 1,
    height: 38,
    justifyContent: "center",
  },
  floatingReelsCategoryScroll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingRight: 6,
  },
  floatingReelCategoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
  },
  floatingReelCategoryChipText: {
    fontSize: 12,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  floatingReelsCreateBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(37, 99, 235, 0.85)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  reelsCategoryBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 8,
  },
  reelsCategoryScroll: {
    gap: 8,
    paddingRight: 8,
  },
  reelCategoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  reelCategoryChipText: {
    fontSize: 12,
  },
  reelsBarUploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#2563EB",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  reelsBarUploadText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  reelsLoadingBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#000000",
  },
  reelsLoadingText: {
    fontSize: 14,
  },
  reelsEmptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 8,
    backgroundColor: "#000000",
  },
  reelsEmptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 8,
  },
  reelsEmptySub: {
    fontSize: 13,
    textAlign: "center",
  },
  reelsCreateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#2563EB",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 10,
  },
  reelsCreateBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  // Feed-Embedded Facebook Reels Shelf
  reelsShelfCard: {
    marginHorizontal: 10,
    marginVertical: 10,
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  reelsShelfHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  reelsShelfTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  reelsShelfIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  reelsShelfTitle: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  reelsShelfSub: {
    fontSize: 12,
    marginTop: 1,
  },
  reelsShelfSeeAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(37, 99, 235, 0.1)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  reelsShelfSeeAllText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2563EB",
  },
  reelsShelfScroll: {
    paddingRight: 8,
    gap: 10,
  },
  shelfReelItemCard: {
    width: 140,
    height: 220,
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    backgroundColor: "#000000",
  },
  shelfCreateReelCard: {
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderStyle: "dashed",
  },
  shelfCreateReelIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  shelfCreateReelText: {
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  shelfCreateReelSub: {
    fontSize: 11,
    textAlign: "center",
    marginTop: 2,
  },
  shelfReelThumb: {
    width: "100%",
    height: "100%",
  },
  shelfReelFallbackBg: {
    width: "100%",
    height: "100%",
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
  shelfReelBadgeWrap: {
    position: "absolute",
    top: 8,
    left: 8,
    zIndex: 10,
  },
  shelfPlatformBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  shelfPlatformBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  shelfPlayIconCircle: {
    position: "absolute",
    top: "38%",
    left: "50%",
    marginLeft: -17,
    marginTop: -17,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 8,
  },
  shelfReelScrim: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  shelfReelBottomInfo: {
    position: "absolute",
    bottom: 8,
    left: 8,
    right: 8,
    zIndex: 10,
    gap: 4,
  },
  shelfReelCaption: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  shelfReelAuthorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  shelfReelAuthorAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
  shelfReelAuthorPlaceholder: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  shelfReelAuthorInitials: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "700",
  },
  shelfReelAuthorName: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
