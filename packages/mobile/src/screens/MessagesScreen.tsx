import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
  Alert,
  StatusBar,
  ActivityIndicator,
  Image,
  Modal,
  Dimensions,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { SmoothBottomSheetModal } from "../components/SmoothBottomSheetModal";
import { useNavVisibility } from "../context/NavVisibilityContext";
import { useTheme } from "../context/ThemeContext";
import { mobileDataService } from "../services/firebaseDataService";
import { communityService } from "../services/communityService";
import { auth } from "../firebase/config";
import { playMessengerPopChime } from "../utils/soundEffects";

export interface MessagesScreenProps {
  onBack?: () => void;
  householdId?: string;
  currentUser?: {
    name: string;
    avatar: string;
    email?: string;
    role?: string;
    photoURL?: string;
  };
  initialTargetUserId?: string;
  onOpenSettleDues?: () => void;
  onOpenAddExpense?: () => void;
  loading?: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  sender: string;
  text: string;
  time: string;
  isMe: boolean;
  type?: "text" | "payment_claim" | "receipt_review" | "expense_split";
  meta?: {
    amount?: string;
    share?: string;
    category?: string;
    attachmentName?: string;
    status?: "pending" | "confirmed" | "settled";
    paymentMethod?: string;
  };
  createdAt?: string;
  readBy?: string[];
}

export interface ConversationItem {
  id: string;
  targetUserId?: string;
  type: "group" | "direct";
  name: string;
  initials: string;
  avatarBg: string;
  avatarColor: string;
  photoURL?: string;
  isOnline: boolean;
  onlineStatusLabel: string;
  timestamp: string;
  lastMessageTimestampMs: number;
  unreadCount?: number;
  pinned?: boolean;
  roleLabel?: string;
  lastMessage: string;
  categoryTag?: string;
  expenseAmount?: string;
  userShare?: string;
  attachmentName?: string;
  statusBadge?: {
    type: "paid" | "pending" | "settled" | "info";
    label: string;
  };
  hasReceiptConfirmAction?: boolean;
  messages: ChatMessage[];
}

const AVATAR_PALETTES = [
  { bg: "#EFF6FF", text: "#2563EB" },
  { bg: "#FEF3C7", text: "#D97706" },
  { bg: "#F3E8FF", text: "#7E22CE" },
  { bg: "#E0F2FE", text: "#0284C7" },
  { bg: "#DCFCE7", text: "#16A34A" },
  { bg: "#FEE2E2", text: "#DC2626" },
  { bg: "#FCE7F3", text: "#DB2777" },
];

const QUICK_NOTE_EMOJIS = [
  "💭",
  "🍕",
  "💻",
  "🧹",
  "😴",
  "🏃",
  "📚",
  "☕",
  "🎮",
  "🏠",
];
const NOTE_REACTION_PILLS = ["😂", "🔥", "😭", "👏", "🥰", "❤️"];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function getInitials(name: string): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function formatMessageTime(isoString?: string): string {
  if (!isoString) return "Just now";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "Just now";
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) {
      return `${diffHours}h`;
    }
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d`;
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return "Just now";
  }
}

function computePresence(lastActiveIso?: string): {
  isOnline: boolean;
  statusLabel: string;
} {
  if (!lastActiveIso) {
    return { isOnline: false, statusLabel: "Offline" };
  }
  try {
    const t = new Date(lastActiveIso).getTime();
    if (isNaN(t)) return { isOnline: false, statusLabel: "Offline" };
    const diffMs = Date.now() - t;
    // Legitimate 15-minute active presence window
    if (diffMs >= 0 && diffMs < 15 * 60 * 1000) {
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
  } catch {
    return { isOnline: false, statusLabel: "Offline" };
  }
}

export const MessagesScreen: React.FC<MessagesScreenProps> = ({
  onBack,
  householdId,
  currentUser = { name: "Resident", avatar: "R" },
  initialTargetUserId,
  onOpenSettleDues,
  onOpenAddExpense,
}) => {
  const {
    onScroll,
    keyboardHeight: contextKeyboardHeight,
    hideNav,
    showNav,
  } = useNavVisibility();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const windowDims = useWindowDimensions();
  const screenHeight = Dimensions.get("screen").height;
  const isWindowResizedBySystem = screenHeight - windowDims.height > 120;

  const topInset = Math.max(
    Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0,
    insets.top,
    Platform.OS === "ios" ? 44 : 20,
  );
  const bottomInset = Math.max(
    insets.bottom,
    Platform.OS === "android" ? 24 : 16,
  );

  const currentUid = auth.currentUser?.uid || "";
  const currentUserName =
    currentUser?.name || auth.currentUser?.displayName || "You";
  const currentUserAvatar =
    currentUser?.avatar ||
    (currentUserName ? currentUserName[0].toUpperCase() : "U");
  const currentUserPhotoURL =
    currentUser?.photoURL || auth.currentUser?.photoURL || undefined;

  const cachedProfile = mobileDataService.getCachedProfile(currentUid);
  const [userProfile, setUserProfile] = useState<any | null>(
    () => cachedProfile,
  );

  // Sync profile real-time to immediately detect join approval / rejection
  useEffect(() => {
    if (!currentUid) return;
    const unsub = mobileDataService.listenToUserProfile(currentUid, (p) => {
      if (p) setUserProfile(p);
    });
    return () => unsub();
  }, [currentUid]);

  // Real Firestore state
  const [householdMembers, setHouseholdMembers] = useState<any[]>([]);
  const [householdInfo, setHouseholdInfo] = useState<any>(null);
  const [rawMessages, setRawMessages] = useState<any[]>([]);
  const [householdNotes, setHouseholdNotes] = useState<
    Record<string, { note: string; emoji?: string; updatedAt: string }>
  >({});
  const [acceptedCommunityFriends, setAcceptedCommunityFriends] = useState<
    any[]
  >([]);
  const [directMessages, setDirectMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Strict helper: only active approved members belong in the group chat and direct messages
  const isActiveMember = (m: any) => {
    if (!m) return false;
    const s = String(m.status || "").toUpperCase();
    const js = String(m.joinRequestStatus || "").toUpperCase();
    if (
      s === "REJECTED" ||
      s === "DECLINED" ||
      s === "PENDING" ||
      s === "INACTIVE" ||
      s === "REMOVED" ||
      s === "CANCELLED"
    ) {
      return false;
    }
    if (
      js === "REJECTED" ||
      js === "DECLINED" ||
      js === "PENDING" ||
      js === "REMOVED"
    ) {
      return false;
    }
    if (m.rejectionReason || m.rejectedDate) {
      return false;
    }
    return (
      s === "ACTIVE" || m.role === "HOST" || (!m.status && !m.joinRequestStatus)
    );
  };

  // Search and Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<
    "all" | "apartment" | "pending" | "direct"
  >("all");

  // Selected thread for full-screen active chat
  const [activeThread, setActiveThread] = useState<ConversationItem | null>(
    null,
  );
  const [chatInputText, setChatInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messageScrollRef = useRef<ScrollView>(null);
  const chatInputRef = useRef<TextInput>(null);
  const noteReplyInputRef = useRef<TextInput>(null);
  const searchInputRef = useRef<TextInput>(null);

  // Messenger-style tap to reveal message timestamp and seen status
  const [toggledMessageIds, setToggledMessageIds] = useState<
    Record<string, boolean>
  >({});
  const [localKeyboardHeight, setLocalKeyboardHeight] = useState(0);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const keyboardHeight = Math.max(
    localKeyboardHeight,
    contextKeyboardHeight || 0,
  );
  const keyboardActive = isKeyboardOpen || isInputFocused || keyboardHeight > 0;

  // Auto-hide bottom floating navigation menu while inside full-screen chat thread
  useEffect(() => {
    if (activeThread) {
      hideNav();
    } else {
      showNav();
    }
  }, [activeThread, hideNav, showNav]);

  useEffect(() => {
    return () => {
      showNav();
    };
  }, [showNav]);

  useEffect(() => {
    const onShow = (e: any) => {
      const h = e?.endCoordinates?.height || 0;
      if (h > 0) {
        setLocalKeyboardHeight(h);
      }
      setIsKeyboardOpen(true);
      setTimeout(() => {
        messageScrollRef.current?.scrollToEnd({ animated: true });
      }, 80);
    };

    const onHide = () => {
      setLocalKeyboardHeight(0);
      setIsKeyboardOpen(false);
      setIsInputFocused(false);
    };

    const showSub1 = Keyboard.addListener("keyboardWillShow", onShow);
    const showSub2 = Keyboard.addListener("keyboardDidShow", onShow);
    const hideSub1 = Keyboard.addListener("keyboardWillHide", onHide);
    const hideSub2 = Keyboard.addListener("keyboardDidHide", onHide);

    return () => {
      showSub1.remove();
      showSub2.remove();
      hideSub1.remove();
      hideSub2.remove();
    };
  }, []);

  const defaultBottomPadding = Math.max(
    bottomInset,
    Platform.OS === "android" ? 20 : 12,
  );

  const chatInputBottomPadding = useMemo(() => {
    if (!keyboardActive) {
      return defaultBottomPadding;
    }

    if (Platform.OS === "android") {
      if (isWindowResizedBySystem) {
        // OS already resized the window above keyboard; provide a clean 14px cushion
        return 14;
      }
      // Translucent mode on Android: window is full-screen and does not resize.
      // Elevate input container above keyboard plus the system navigation bar with a 14px cushion.
      const effectiveHeight = keyboardHeight > 0 ? keyboardHeight : 285;
      const navBarHeight = insets.bottom > 0 ? insets.bottom : 24;
      return effectiveHeight + navBarHeight + 14;
    }

    if (Platform.OS === "ios") {
      // On iOS, KeyboardAvoidingView (behavior="padding") lifts the container by keyboardHeight.
      // Provide a generous 14px cushion above the soft keyboard.
      return 14;
    }

    // Web / other platforms
    return 14;
  }, [
    keyboardActive,
    isWindowResizedBySystem,
    keyboardHeight,
    insets.bottom,
    defaultBottomPadding,
  ]);

  const handleToggleMessage = (msgId: string) => {
    setToggledMessageIds((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  // Modals
  const [showRequestSplitModal, setShowRequestSplitModal] = useState(false);
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);

  // Thought Note Form state (optional emoji)
  const [noteInputText, setNoteInputText] = useState("");
  const [selectedNoteEmoji, setSelectedNoteEmoji] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);

  // Viewing Roommate Note Modal (matching reference screenshot)
  const [viewingNoteData, setViewingNoteData] = useState<{
    member: any;
    note: { note: string; emoji?: string; updatedAt: string };
  } | null>(null);
  const [noteReplyText, setNoteReplyText] = useState("");
  const [isSendingNoteReply, setIsSendingNoteReply] = useState(false);

  // Request Split form state
  const [splitTargetId, setSplitTargetId] = useState("ALL");
  const [splitAmount, setSplitAmount] = useState("");
  const [splitDescription, setSplitDescription] = useState("");

  // 1. Subscribe to real-time Firestore data
  useEffect(() => {
    if (!householdId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Heartbeat: update active presence
    mobileDataService.updateUserHeartbeat(householdId, currentUid);

    const unsubMembers = mobileDataService.listenToHouseholdMembers(
      householdId,
      (members) => {
        setHouseholdMembers((members || []).filter(isActiveMember));
      },
    );

    const unsubHousehold = mobileDataService.listenToHousehold(
      householdId,
      (hh) => {
        setHouseholdInfo(hh);
      },
    );

    const unsubMessages = mobileDataService.listenToHouseholdMessages(
      householdId,
      (msgs) => {
        setRawMessages(msgs || []);
        setLoading(false);
      },
    );

    const unsubNotes = mobileDataService.listenToHouseholdNotes(
      householdId,
      (notes) => {
        setHouseholdNotes(notes || {});
        // Pre-fill note input if user already has a note
        if (currentUid && notes && notes[currentUid]) {
          setNoteInputText(notes[currentUid].note || "");
          setSelectedNoteEmoji(notes[currentUid].emoji || "");
        }
      },
    );

    return () => {
      unsubMembers();
      unsubHousehold();
      unsubMessages();
      unsubNotes();
    };
  }, [householdId, currentUid]);

  // 1b. Subscribe to real-time accepted community friendships (friends outside or inside the group)
  useEffect(() => {
    if (!currentUid) return;
    const unsub = communityService.subscribeFriendships(
      currentUid,
      (allFriendships) => {
        const accepted = (allFriendships || []).filter(
          (f) => f.status === "accepted" || (f as any).status === "friends",
        );
        const mapped = accepted.map((f) => {
          const isSender = f.senderId === currentUid;
          const friendUid = isSender ? f.receiverId : f.senderId;
          const friendName = isSender ? f.receiverName : f.senderName;
          const friendAvatar = isSender ? f.receiverAvatar : f.senderAvatar;
          const friendEmail = isSender ? f.receiverEmail : f.senderEmail;
          return {
            userId: friendUid,
            memberId: friendUid,
            id: friendUid,
            displayName: friendName,
            name: friendName,
            email: friendEmail,
            photoURL: friendAvatar,
            profilePicture: friendAvatar,
            role: "Friend",
            isOutsideFriend: true,
            friendshipId: f.id,
          };
        });
        setAcceptedCommunityFriends(mapped);
      },
    );
    return () => unsub();
  }, [currentUid]);

  // 1c. Subscribe to direct messages across contacts
  useEffect(() => {
    if (!currentUid) return;
    const unsub = mobileDataService.listenToDirectMessages(
      currentUid,
      (msgs) => {
        setDirectMessages(msgs || []);
      },
    );
    return () => unsub();
  }, [currentUid]);

  // Merge household messages and direct messages deduplicated by id
  const combinedMessages = useMemo(() => {
    const map = new Map<string, any>();
    rawMessages.forEach((m) => {
      if (m?.id) map.set(m.id, m);
    });
    directMessages.forEach((m) => {
      if (m?.id) map.set(m.id, m);
    });
    const list = Array.from(map.values());
    list.sort((a, b) => {
      const timeA = new Date(a.createdAt || a.timestamp || 0).getTime();
      const timeB = new Date(b.createdAt || b.timestamp || 0).getTime();
      return timeA - timeB;
    });
    return list;
  }, [rawMessages, directMessages]);

  // Real bills group members (excluding the current user, strictly active members only)
  const billsGroupMembers = useMemo(() => {
    return householdMembers.filter((m) => {
      if (!isActiveMember(m)) return false;
      const uid = m.userId || m.memberId;
      return uid && uid !== currentUid && uid !== `mem_${currentUid}`;
    });
  }, [householdMembers, currentUid]);

  // Combine household members with accepted friends from outside the household group
  const allDirectMembers = useMemo(() => {
    const list: any[] = [...billsGroupMembers];
    const existingUids = new Set<string>();

    billsGroupMembers.forEach((m) => {
      const u = String(m.userId || m.memberId || m.id || "");
      if (u) {
        existingUids.add(u);
        existingUids.add(u.replace(/^mem_/, ""));
      }
    });

    acceptedCommunityFriends.forEach((friend) => {
      const friendUid = String(
        friend.userId || friend.memberId || friend.id || "",
      );
      const cleanUid = friendUid.replace(/^mem_/, "");
      if (
        friendUid &&
        friendUid !== currentUid &&
        cleanUid !== currentUid &&
        !existingUids.has(friendUid) &&
        !existingUids.has(cleanUid)
      ) {
        list.push(friend);
        existingUids.add(friendUid);
        existingUids.add(cleanUid);
      }
    });

    return list;
  }, [billsGroupMembers, acceptedCommunityFriends, currentUid]);

  const isHost =
    userProfile?.role === "HOST" ||
    userProfile?.role === "SUPER_ADMIN" ||
    userProfile?.hostApplicationStatus === "APPROVED" ||
    householdInfo?.hostId === currentUid ||
    householdMembers.some(
      (m) =>
        (m.userId === currentUid || m.memberId === currentUid) &&
        m.role === "HOST",
    );

  const isCurrentMemberActive = useMemo(() => {
    if (isHost) return true;
    if (userProfile?.joinRequestStatus === "REJECTED") return false;
    if (!householdId) return false;
    return householdMembers.some(
      (m) =>
        (m.userId === currentUid || m.memberId === currentUid) &&
        isActiveMember(m),
    );
  }, [
    isHost,
    userProfile?.joinRequestStatus,
    householdId,
    householdMembers,
    currentUid,
  ]);

  // Current user's thought note
  const currentUserMember = householdMembers.find(
    (m) => (m.userId || m.memberId) === currentUid,
  );
  const currentUserNote =
    householdNotes[currentUid] ||
    (currentUserMember?.thoughtNote
      ? {
          note: currentUserMember.thoughtNote,
          emoji:
            currentUserMember.thoughtEmoji !== undefined &&
            currentUserMember.thoughtEmoji !== null
              ? String(currentUserMember.thoughtEmoji).trim()
              : "",
          updatedAt: currentUserMember.noteUpdatedAt || "",
        }
      : undefined);

  // Map of userId/memberId to profile avatar data & initials for fast synchronous lookup in chat messages
  const memberAvatarMap = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        initials: string;
        photoURL?: string;
        bg: string;
        text: string;
      }
    >();

    const allKnown = [...householdMembers, ...allDirectMembers];
    allKnown.forEach((member) => {
      const uids = [member.userId, member.memberId, member.id].filter(Boolean);
      const name =
        member.displayName ||
        member.name ||
        member.email?.split("@")[0] ||
        "Roommate";
      const initials = getInitials(name);
      const primaryUid = String(
        member.userId || member.memberId || member.id || "",
      );
      const palette =
        AVATAR_PALETTES[
          Math.abs(hashString(primaryUid)) % AVATAR_PALETTES.length
        ];
      const photoURL = member.profilePicture || member.photoURL || undefined;

      const info = {
        name,
        initials,
        photoURL,
        bg: palette.bg,
        text: palette.text,
      };

      uids.forEach((uid) => {
        const str = String(uid);
        map.set(str, info);
        map.set(str.replace(/^mem_/, ""), info);
      });
    });

    // Also include activeThread's direct roommate if in direct chat
    if (activeThread?.targetUserId) {
      const directUid = activeThread.targetUserId;
      if (!map.has(directUid)) {
        map.set(directUid, {
          name: activeThread.name,
          initials: activeThread.initials,
          photoURL: activeThread.photoURL,
          bg: activeThread.avatarBg,
          text: activeThread.avatarColor,
        });
      }
    }

    return map;
  }, [householdMembers, allDirectMembers, activeThread]);

  // Format a Firestore message document into ChatMessage
  const formatChatMessage = (m: any): ChatMessage => {
    const isMe = m.senderId === currentUid;
    return {
      id: m.id,
      senderId: m.senderId,
      sender: isMe ? "You" : m.senderName || "Roommate",
      text: m.text || "",
      time: formatMessageTime(m.createdAt || m.timestamp),
      isMe,
      type: m.type || "text",
      meta: m.meta,
      createdAt: m.createdAt || m.timestamp,
      readBy: m.readBy || [],
    };
  };

  // 2. Synthesize real conversations list dynamically and sort chronologically
  const conversations: ConversationItem[] = useMemo(() => {
    const list: ConversationItem[] = [];

    // A. Pinned Household Group Conversation (if household exists)
    if (householdId) {
      const groupName =
        householdInfo?.householdName ||
        householdInfo?.name ||
        "Bills Group Chat";
      const groupMsgs = combinedMessages.filter(
        (m) =>
          m.conversationId === "household_group" ||
          (!m.conversationId &&
            !m.recipientId &&
            m.householdId === householdId),
      );
      const lastGroupMsg =
        groupMsgs.length > 0 ? groupMsgs[groupMsgs.length - 1] : null;
      const groupUnread = groupMsgs.filter(
        (m) =>
          m.senderId !== currentUid && !(m.readBy || []).includes(currentUid),
      ).length;

      const groupLastTimeIso =
        lastGroupMsg?.createdAt || lastGroupMsg?.timestamp || "";
      const groupLastTimeMs = groupLastTimeIso
        ? new Date(groupLastTimeIso).getTime()
        : 0;

      list.push({
        id: "household_group",
        type: "group",
        name: groupName,
        initials: getInitials(groupName) || "BG",
        avatarBg: "#2563EB",
        avatarColor: "#FFFFFF",
        isOnline: true,
        onlineStatusLabel: `${householdMembers.length || 1} members`,
        pinned: true,
        unreadCount: groupUnread,
        timestamp: groupLastTimeIso ? formatMessageTime(groupLastTimeIso) : "",
        lastMessageTimestampMs: isNaN(groupLastTimeMs) ? 0 : groupLastTimeMs,
        lastMessage: lastGroupMsg
          ? (lastGroupMsg.senderId === currentUid
              ? "You: "
              : `${(lastGroupMsg.senderName || "Member").split(" ")[0]}: `) +
            lastGroupMsg.text
          : "No messages yet. Send a friendly hello!",
        categoryTag: lastGroupMsg?.meta?.category
          ? `${lastGroupMsg.meta.category}: ${lastGroupMsg.meta.amount || ""}`
          : undefined,
        userShare: lastGroupMsg?.meta?.share,
        messages: groupMsgs.map(formatChatMessage),
      });
    }

    // B. Direct 1-on-1 conversations for household roommates AND outside community friends
    allDirectMembers.forEach((member) => {
      const memberUid = member.userId || member.memberId;
      const memberName =
        member.displayName ||
        member.name ||
        member.email?.split("@")[0] ||
        "Roommate";
      const initials = getInitials(memberName);
      const palette =
        AVATAR_PALETTES[
          Math.abs(hashString(memberUid)) % AVATAR_PALETTES.length
        ];
      const convId = "dm_" + [currentUid, memberUid].sort().join("_");

      const directMsgs = combinedMessages.filter(
        (m) =>
          m.conversationId === convId ||
          (m.senderId === memberUid && m.recipientId === currentUid) ||
          (m.senderId === currentUid && m.recipientId === memberUid),
      );

      const lastDirectMsg =
        directMsgs.length > 0 ? directMsgs[directMsgs.length - 1] : null;
      const unreadCount = directMsgs.filter(
        (m) =>
          m.senderId === memberUid && !(m.readBy || []).includes(currentUid),
      ).length;

      const isHost =
        (member.role || "").toUpperCase() === "HOST" ||
        householdInfo?.hostId === memberUid;
      const roleLabel = isHost
        ? "Host"
        : member.isOutsideFriend
          ? "Friend"
          : "Payor";

      // Legitimate presence calculation
      const memberPresence = computePresence(
        member.lastActiveAt || member.updatedAt || member.createdAt,
      );

      const lastTimeIso =
        lastDirectMsg?.createdAt || lastDirectMsg?.timestamp || "";
      const lastTimeMs = lastTimeIso ? new Date(lastTimeIso).getTime() : 0;

      // Status badge
      let statusBadge: ConversationItem["statusBadge"] = undefined;
      if (lastDirectMsg?.meta?.status) {
        const isSettled =
          lastDirectMsg.meta.status === "confirmed" ||
          lastDirectMsg.meta.status === "settled";
        statusBadge = {
          type: isSettled ? "settled" : "pending",
          label: isSettled
            ? "Confirmed"
            : lastDirectMsg.type === "payment_claim"
              ? `Claim: ${lastDirectMsg.meta.amount}`
              : `Pending: ${lastDirectMsg.meta.amount}`,
        };
      }

      list.push({
        id: convId,
        targetUserId: memberUid,
        type: "direct",
        name: memberName,
        initials,
        avatarBg: palette.bg,
        avatarColor: palette.text,
        photoURL: member.profilePicture || member.photoURL,
        isOnline: memberPresence.isOnline,
        onlineStatusLabel: memberPresence.statusLabel,
        timestamp: lastTimeIso ? formatMessageTime(lastTimeIso) : "",
        lastMessageTimestampMs: isNaN(lastTimeMs) ? 0 : lastTimeMs,
        unreadCount,
        pinned: false,
        roleLabel,
        lastMessage: lastDirectMsg
          ? (lastDirectMsg.senderId === currentUid ? "You: " : "") +
            lastDirectMsg.text
          : "Tap to start conversation",
        categoryTag: lastDirectMsg?.meta?.category
          ? `${lastDirectMsg.meta.category}: ${lastDirectMsg.meta.amount || ""}`
          : undefined,
        expenseAmount: lastDirectMsg?.meta?.amount,
        userShare: lastDirectMsg?.meta?.share,
        attachmentName: lastDirectMsg?.meta?.attachmentName,
        statusBadge,
        hasReceiptConfirmAction: Boolean(
          lastDirectMsg?.type === "payment_claim" &&
          lastDirectMsg.senderId === memberUid &&
          lastDirectMsg.meta?.status !== "confirmed",
        ),
        messages: directMsgs.map(formatChatMessage),
      });
    });

    // CHRONOLOGICAL SORTING:
    // Pinned group stays pinned at top.
    // All direct chats are sorted by most recent message (highest timestamp on top).
    list.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return (b.lastMessageTimestampMs || 0) - (a.lastMessageTimestampMs || 0);
    });

    return list;
  }, [
    combinedMessages,
    householdId,
    householdInfo,
    allDirectMembers,
    currentUid,
  ]);

  // Keep activeThread synced with updated live messages
  useEffect(() => {
    if (!activeThread) return;
    const fresh = conversations.find((c) => c.id === activeThread.id);
    if (fresh) {
      setActiveThread(fresh);
    }
  }, [conversations]);

  // Auto-focus thread if initialTargetUserId is supplied
  useEffect(() => {
    if (initialTargetUserId && !activeThread) {
      const match = conversations.find(
        (c) => c.targetUserId === initialTargetUserId,
      );
      if (match) {
        setActiveThread(match);
      }
    }
  }, [initialTargetUserId, conversations, activeThread]);

  // Mark messages in active thread as read
  useEffect(() => {
    if (!activeThread || !currentUid) return;
    const unreadIds = activeThread.messages
      .filter((m) => !m.isMe && !(m.readBy || []).includes(currentUid))
      .map((m) => m.id);

    if (unreadIds.length > 0) {
      if (householdId) {
        mobileDataService.markHouseholdMessagesRead(
          householdId,
          unreadIds,
          currentUid,
        );
      }
      mobileDataService.markDirectMessagesRead(unreadIds, currentUid);
    }
  }, [
    activeThread?.id,
    activeThread?.messages.length,
    householdId,
    currentUid,
  ]);

  // Total unread count
  const totalUnread = useMemo(() => {
    return conversations.reduce(
      (acc, curr) => acc + (curr.unreadCount || 0),
      0,
    );
  }, [conversations]);

  // Filtered conversations
  const filteredConversations = useMemo(() => {
    let list = [...conversations];

    if (activeFilter === "apartment") {
      list = list.filter((c) => c.type === "group");
    } else if (activeFilter === "pending") {
      list = list.filter(
        (c) =>
          c.statusBadge?.type === "pending" ||
          c.hasReceiptConfirmAction ||
          c.categoryTag,
      );
    } else if (activeFilter === "direct") {
      list = list.filter((c) => c.type === "direct");
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.lastMessage.toLowerCase().includes(q) ||
          (c.categoryTag && c.categoryTag.toLowerCase().includes(q)) ||
          (c.attachmentName && c.attachmentName.toLowerCase().includes(q)),
      );
    }

    return list;
  }, [conversations, activeFilter, searchQuery]);

  // Save Thought Note (Emoji is completely optional!)
  const handleSaveNote = async () => {
    const text = noteInputText.trim();
    if (!text) {
      Alert.alert("Empty Note", "Please type something for your thought note.");
      return;
    }
    if (!householdId || !currentUid) return;

    setIsSavingNote(true);
    try {
      await mobileDataService.setHouseholdUserNote(
        householdId,
        currentUid,
        text,
        selectedNoteEmoji.trim(),
      );
      playMessengerPopChime();
      setShowNoteModal(false);
      Alert.alert(
        "Note Shared",
        "Your roommates can now see your thought bubble!",
      );
    } catch (e) {
      console.warn("Error saving note:", e);
      Alert.alert("Error", "Could not share note at this time.");
    } finally {
      setIsSavingNote(false);
    }
  };

  // Clear Thought Note
  const handleClearNote = async () => {
    if (!householdId || !currentUid) return;
    setIsSavingNote(true);
    try {
      await mobileDataService.deleteHouseholdUserNote(householdId, currentUid);
      setNoteInputText("");
      setSelectedNoteEmoji("");
      setShowNoteModal(false);
      Alert.alert("Note Removed", "Your thought note has been cleared.");
    } catch (e) {
      console.warn("Error clearing note:", e);
    } finally {
      setIsSavingNote(false);
    }
  };

  // Confirm receipt action
  const handleConfirmReceipt = async (conv: ConversationItem) => {
    if (!householdId) return;
    const claimMsg = conv.messages
      .slice()
      .reverse()
      .find((m) => m.type === "payment_claim");
    if (!claimMsg) return;

    try {
      await mobileDataService.updateHouseholdMessage(householdId, claimMsg.id, {
        "meta.status": "confirmed",
      });
      await mobileDataService.sendHouseholdMessage(householdId, {
        conversationId: conv.id,
        senderId: currentUid,
        senderName: currentUserName,
        text: `Receipt confirmed! Payment ${claimMsg.meta?.amount ? `of ${claimMsg.meta.amount} ` : ""}has been verified.`,
        recipientId: conv.targetUserId,
      });
      Alert.alert(
        "Receipt Confirmed",
        `You verified the payment from ${conv.name}. The record has been marked confirmed.`,
      );
    } catch (e) {
      console.warn("Error confirming receipt:", e);
      Alert.alert("Error", "Could not confirm receipt at this time.");
    }
  };

  // Send a new message inside active thread
  const handleSendMessage = async () => {
    const trimmed = chatInputText.trim();
    if (!trimmed || !activeThread) return;

    setChatInputText("");
    setIsSending(true);

    try {
      const isDirect = activeThread.type === "direct";
      if (isDirect && activeThread.targetUserId) {
        await mobileDataService.sendDirectMessage({
          conversationId: activeThread.id,
          senderId: currentUid,
          senderName: currentUserName,
          recipientId: activeThread.targetUserId,
          text: trimmed,
          type: "text",
          householdId: householdId || undefined,
        });
      } else if (householdId) {
        await mobileDataService.sendHouseholdMessage(householdId, {
          conversationId: activeThread.id,
          senderId: currentUid,
          senderName: currentUserName,
          text: trimmed,
          type: "text",
        });
      }
    } catch (err: any) {
      console.warn("Error sending message:", err);
      Alert.alert("Failed to send", "Please check your network connection.");
    } finally {
      setIsSending(false);
    }
  };

  // Send a reaction to a roommate's note
  const handleSendNoteReaction = async (reactionEmoji: string) => {
    if (!viewingNoteData || !householdId || !currentUid) return;
    const targetUserId =
      viewingNoteData.member.userId || viewingNoteData.member.memberId;
    const memberName =
      viewingNoteData.member.displayName ||
      viewingNoteData.member.name ||
      "Roommate";
    const convId = "dm_" + [currentUid, targetUserId].sort().join("_");
    const noteSnippet = viewingNoteData.note.note;

    try {
      playMessengerPopChime();
      await mobileDataService.sendHouseholdMessage(householdId, {
        conversationId: convId,
        senderId: currentUid,
        senderName: currentUserName,
        recipientId: targetUserId,
        text: `Reacted ${reactionEmoji} to note: "${noteSnippet}"`,
        type: "text",
      });

      Alert.alert(
        "Reaction Sent",
        `Sent ${reactionEmoji} to ${memberName.split(" ")[0]}!`,
        [
          { text: "Keep Browsing", style: "cancel" },
          {
            text: "Open Chat",
            onPress: () => {
              const targetMember = viewingNoteData.member;
              setViewingNoteData(null);
              handleOpenDirectChatWithMember(targetMember);
            },
          },
        ],
      );
    } catch (e) {
      console.warn("Error sending reaction:", e);
    }
  };

  // Send a text reply to a roommate's note (quotes the note)
  const handleSendNoteReply = async () => {
    const trimmed = noteReplyText.trim();
    if (!trimmed || !viewingNoteData || !householdId || !currentUid) return;

    const targetUserId =
      viewingNoteData.member.userId || viewingNoteData.member.memberId;
    const memberName =
      viewingNoteData.member.displayName ||
      viewingNoteData.member.name ||
      "Roommate";
    const convId = "dm_" + [currentUid, targetUserId].sort().join("_");
    const noteSnippet = viewingNoteData.note.note;

    setIsSendingNoteReply(true);
    try {
      playMessengerPopChime();
      await mobileDataService.sendHouseholdMessage(householdId, {
        conversationId: convId,
        senderId: currentUid,
        senderName: currentUserName,
        recipientId: targetUserId,
        text: `💬 Replied to your note "${noteSnippet}":\n${trimmed}`,
        type: "text",
      });

      setNoteReplyText("");
      const targetMember = viewingNoteData.member;
      setViewingNoteData(null);
      handleOpenDirectChatWithMember(targetMember);
    } catch (e) {
      console.warn("Error sending note reply:", e);
      Alert.alert("Error", "Could not send reply at this time.");
    } finally {
      setIsSendingNoteReply(false);
    }
  };

  // Submit Request Split
  const handleCreateSplitRequest = async () => {
    if (!splitAmount || isNaN(parseFloat(splitAmount))) {
      Alert.alert("Invalid Amount", "Please enter a valid split amount.");
      return;
    }
    if (!householdId) {
      Alert.alert("No Household", "Please join a household bills group first.");
      return;
    }

    const desc = splitDescription.trim() || "Shared Expense";
    const amt = parseFloat(splitAmount).toFixed(2);
    const isEntireGroup = splitTargetId === "ALL";

    let convId = "household_group";
    let recipientId: string | undefined = undefined;

    if (!isEntireGroup) {
      convId = "dm_" + [currentUid, splitTargetId].sort().join("_");
      recipientId = splitTargetId;
    }

    const shareCount = isEntireGroup ? Math.max(householdMembers.length, 2) : 2;
    const shareAmt = (parseFloat(amt) / shareCount).toFixed(2);

    try {
      await mobileDataService.sendHouseholdMessage(householdId, {
        conversationId: convId,
        senderId: currentUid,
        senderName: currentUserName,
        recipientId,
        text: `Requested split: "${desc}" for ₱${amt}`,
        type: "expense_split",
        meta: {
          amount: `₱${amt}`,
          share: `₱${shareAmt}`,
          category: desc,
          status: "pending",
        },
      });

      setShowRequestSplitModal(false);
      setSplitAmount("");
      setSplitDescription("");
      setSplitTargetId("ALL");

      Alert.alert(
        "Split Requested",
        `Your split request for ₱${amt} has been shared with your roommates.`,
      );
    } catch (e) {
      console.warn("Failed to create split request:", e);
      Alert.alert("Error", "Could not send split request.");
    }
  };

  // Open direct chat with roommate
  const handleOpenDirectChatWithMember = (member: any) => {
    const memberUid = member.userId || member.memberId;
    const convId = "dm_" + [currentUid, memberUid].sort().join("_");
    const existing = conversations.find((c) => c.id === convId);

    if (existing) {
      setActiveThread(existing);
    } else {
      const memberName =
        member.displayName ||
        member.name ||
        member.email?.split("@")[0] ||
        "Roommate";
      const palette =
        AVATAR_PALETTES[
          Math.abs(hashString(memberUid)) % AVATAR_PALETTES.length
        ];
      const presence = computePresence(
        member.lastActiveAt || member.updatedAt || member.createdAt,
      );

      const newThread: ConversationItem = {
        id: convId,
        targetUserId: memberUid,
        type: "direct",
        name: memberName,
        initials: getInitials(memberName),
        avatarBg: palette.bg,
        avatarColor: palette.text,
        photoURL: member.profilePicture || member.photoURL,
        isOnline: presence.isOnline,
        onlineStatusLabel: presence.statusLabel,
        timestamp: "New",
        lastMessageTimestampMs: Date.now(),
        unreadCount: 0,
        pinned: false,
        roleLabel: member.role === "HOST" ? "Host" : "Payor",
        lastMessage: "Tap to start conversation",
        messages: [],
      };
      setActiveThread(newThread);
    }
  };

  // Guard 1: Rejected applicant cannot access messages or group chats
  if (userProfile?.joinRequestStatus === "REJECTED") {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: isDark ? "#111215" : "#FFFFFF",
            paddingTop: topInset,
            paddingBottom: bottomInset,
          },
        ]}
      >
        <StatusBar
          barStyle={isDark ? "light-content" : "dark-content"}
          translucent
          backgroundColor="transparent"
        />
        <View style={styles.header}>
          <View style={styles.headerLeftRow}>
            {onBack && (
              <TouchableOpacity
                style={[
                  styles.backButton,
                  {
                    backgroundColor: isDark ? "#1E222B" : "#F8FAFC",
                    borderColor: isDark
                      ? "rgba(255, 255, 255, 0.1)"
                      : "#E2E8F0",
                  },
                ]}
                onPress={onBack}
                accessibilityLabel="Back"
              >
                <Feather
                  name="chevron-left"
                  size={22}
                  color={isDark ? "#FFFFFF" : "#0F172A"}
                />
              </TouchableOpacity>
            )}
            <Text
              style={[
                styles.screenTitle,
                { color: isDark ? "#FFFFFF" : "#0F172A" },
              ]}
            >
              Messages
            </Text>
          </View>
        </View>

        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 24,
          }}
        >
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: isDark ? "rgba(239, 68, 68, 0.15)" : "#FFE4E6",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <Feather name="shield-off" size={32} color="#E11D48" />
          </View>
          <Text
            style={{
              fontSize: 18,
              fontFamily: "Inter-Bold",
              color: isDark ? "#FDA4AF" : "#9F1239",
              textAlign: "center",
              marginBottom: 8,
            }}
          >
            Join Request Declined
          </Text>
          <Text
            style={{
              fontSize: 14,
              fontFamily: "Inter-Regular",
              color: isDark ? "#FECDD3" : "#BE123C",
              textAlign: "center",
              lineHeight: 20,
              marginBottom: 16,
            }}
          >
            Your request to join this household group was declined by the host.
            Only active members of the group can access group chats and direct
            messages.
          </Text>
          {Boolean(userProfile.joinRejectionReason) && (
            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: isDark
                  ? "rgba(0,0,0,0.3)"
                  : "rgba(255,255,255,0.9)",
                marginBottom: 20,
                borderWidth: 1,
                borderColor: isDark ? "rgba(239, 68, 68, 0.2)" : "#FCA5A5",
                maxWidth: 320,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: "Inter-Medium",
                  color: isDark ? "#FCA5A5" : "#9F1239",
                  textAlign: "center",
                }}
              >
                Reason: "{userProfile.joinRejectionReason}"
              </Text>
            </View>
          )}
          {onBack && (
            <TouchableOpacity
              style={{
                backgroundColor: "#E11D48",
                paddingHorizontal: 24,
                paddingVertical: 12,
                borderRadius: 12,
              }}
              onPress={onBack}
            >
              <Text
                style={{
                  color: "#FFFFFF",
                  fontFamily: "Inter-SemiBold",
                  fontSize: 14,
                }}
              >
                Return to Home
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // Guard 2: Group membership or friends required to chat
  if (!householdId && allDirectMembers.length === 0) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: isDark ? "#111215" : "#FFFFFF",
            paddingTop: topInset,
            paddingBottom: bottomInset,
          },
        ]}
      >
        <StatusBar
          barStyle={isDark ? "light-content" : "dark-content"}
          translucent
          backgroundColor="transparent"
        />
        <View style={styles.header}>
          <View style={styles.headerLeftRow}>
            {onBack && (
              <TouchableOpacity
                style={[
                  styles.backButton,
                  {
                    backgroundColor: isDark ? "#1E222B" : "#F8FAFC",
                    borderColor: isDark
                      ? "rgba(255, 255, 255, 0.1)"
                      : "#E2E8F0",
                  },
                ]}
                onPress={onBack}
                accessibilityLabel="Back"
              >
                <Feather
                  name="chevron-left"
                  size={22}
                  color={isDark ? "#FFFFFF" : "#0F172A"}
                />
              </TouchableOpacity>
            )}
            <Text
              style={[
                styles.screenTitle,
                { color: isDark ? "#FFFFFF" : "#0F172A" },
              ]}
            >
              Messages
            </Text>
          </View>
        </View>

        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 24,
          }}
        >
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: isDark ? "#1E222B" : "#F1F5F9",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <Feather
              name="message-square"
              size={32}
              color={isDark ? "#94A3B8" : "#64748B"}
            />
          </View>
          <Text
            style={{
              fontSize: 18,
              fontFamily: "Inter-Bold",
              color: isDark ? "#FFFFFF" : "#0F172A",
              textAlign: "center",
              marginBottom: 8,
            }}
          >
            No Active Conversations
          </Text>
          <Text
            style={{
              fontSize: 14,
              fontFamily: "Inter-Regular",
              color: isDark ? "#94A3B8" : "#64748B",
              textAlign: "center",
              lineHeight: 20,
              marginBottom: 20,
              maxWidth: 300,
            }}
          >
            Join a household group or connect with friends in Splitzy Community
            to start chatting and splitting expenses.
          </Text>
          {onBack && (
            <TouchableOpacity
              style={{
                backgroundColor: "#2563EB",
                paddingHorizontal: 24,
                paddingVertical: 12,
                borderRadius: 12,
              }}
              onPress={onBack}
            >
              <Text
                style={{
                  color: "#FFFFFF",
                  fontFamily: "Inter-SemiBold",
                  fontSize: 14,
                }}
              >
                Return to Home
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // Guard 3: Non-member restricted access
  if (
    !loading &&
    householdMembers.length > 0 &&
    !isCurrentMemberActive &&
    !isHost
  ) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: isDark ? "#111215" : "#FFFFFF",
            paddingTop: topInset,
            paddingBottom: bottomInset,
          },
        ]}
      >
        <StatusBar
          barStyle={isDark ? "light-content" : "dark-content"}
          translucent
          backgroundColor="transparent"
        />
        <View style={styles.header}>
          <View style={styles.headerLeftRow}>
            {onBack && (
              <TouchableOpacity
                style={[
                  styles.backButton,
                  {
                    backgroundColor: isDark ? "#1E222B" : "#F8FAFC",
                    borderColor: isDark
                      ? "rgba(255, 255, 255, 0.1)"
                      : "#E2E8F0",
                  },
                ]}
                onPress={onBack}
                accessibilityLabel="Back"
              >
                <Feather
                  name="chevron-left"
                  size={22}
                  color={isDark ? "#FFFFFF" : "#0F172A"}
                />
              </TouchableOpacity>
            )}
            <Text
              style={[
                styles.screenTitle,
                { color: isDark ? "#FFFFFF" : "#0F172A" },
              ]}
            >
              Messages
            </Text>
          </View>
        </View>

        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 24,
          }}
        >
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: isDark ? "#1E222B" : "#F1F5F9",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <Feather
              name="lock"
              size={32}
              color={isDark ? "#94A3B8" : "#64748B"}
            />
          </View>
          <Text
            style={{
              fontSize: 18,
              fontFamily: "Inter-Bold",
              color: isDark ? "#FFFFFF" : "#0F172A",
              textAlign: "center",
              marginBottom: 8,
            }}
          >
            Access Restricted
          </Text>
          <Text
            style={{
              fontSize: 14,
              fontFamily: "Inter-Regular",
              color: isDark ? "#94A3B8" : "#64748B",
              textAlign: "center",
              lineHeight: 20,
              marginBottom: 20,
              maxWidth: 300,
            }}
          >
            Only active members of this household group can view and send
            messages.
          </Text>
          {onBack && (
            <TouchableOpacity
              style={{
                backgroundColor: "#2563EB",
                paddingHorizontal: 24,
                paddingVertical: 12,
                borderRadius: 12,
              }}
              onPress={onBack}
            >
              <Text
                style={{
                  color: "#FFFFFF",
                  fontFamily: "Inter-SemiBold",
                  fontSize: 14,
                }}
              >
                Return to Home
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // ==========================================
  // VIEW 1: FULL-SCREEN NATIVE MESSENGER CHAT
  // ==========================================
  if (activeThread) {
    return (
      <KeyboardAvoidingView
        style={[
          styles.container,
          { backgroundColor: isDark ? "#111215" : "#FFFFFF" },
        ]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <StatusBar
          barStyle={isDark ? "light-content" : "dark-content"}
          translucent
          backgroundColor="transparent"
        />

        {/* Native Messenger Chat Header */}
        <View
          style={[
            styles.chatHeader,
            {
              paddingTop: topInset + 4,
              backgroundColor: isDark ? "#181A20" : "#FFFFFF",
              borderBottomColor: isDark ? "rgba(255,255,255,0.08)" : "#F1F5F9",
            },
          ]}
        >
          {/* Back chevron */}
          <TouchableOpacity
            style={styles.chatHeaderBackBtn}
            onPress={() => setActiveThread(null)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Back to conversation list"
          >
            <Feather
              name="chevron-left"
              size={28}
              color={isDark ? "#FFFFFF" : "#0F172A"}
            />
          </TouchableOpacity>

          {/* User profile & presence center column */}
          <View style={styles.chatHeaderCenter}>
            <View style={styles.chatHeaderAvatarWrap}>
              <View
                style={[
                  styles.chatHeaderAvatar,
                  { backgroundColor: activeThread.avatarBg },
                ]}
              >
                {activeThread.photoURL ? (
                  <Image
                    source={{ uri: activeThread.photoURL }}
                    style={styles.avatarImage}
                  />
                ) : activeThread.type === "group" ? (
                  <Ionicons name="home" size={20} color="#FFFFFF" />
                ) : (
                  <Text
                    style={[
                      styles.avatarText,
                      { color: activeThread.avatarColor },
                    ]}
                  >
                    {activeThread.initials}
                  </Text>
                )}
              </View>
              {activeThread.isOnline && (
                <View
                  style={[
                    styles.chatHeaderOnlineDot,
                    { borderColor: isDark ? "#181A20" : "#FFFFFF" },
                  ]}
                />
              )}
            </View>

            <View style={styles.chatHeaderTitleColumn}>
              <Text
                style={[
                  styles.chatHeaderName,
                  { color: isDark ? "#FFFFFF" : "#0F172A" },
                ]}
                numberOfLines={1}
              >
                {activeThread.name}
              </Text>
              <Text
                style={[
                  styles.chatHeaderStatus,
                  {
                    color: activeThread.isOnline
                      ? "#10B981"
                      : isDark
                        ? "#94A3B8"
                        : "#64748B",
                  },
                ]}
                numberOfLines={1}
              >
                {activeThread.type === "group"
                  ? `${householdMembers.length || 1} members · Household group`
                  : activeThread.roleLabel
                    ? `${activeThread.roleLabel} · ${activeThread.onlineStatusLabel}`
                    : activeThread.onlineStatusLabel}
              </Text>
            </View>
          </View>

          {/* Right Action Button (Quick Split Request) */}
          <TouchableOpacity
            style={[
              styles.chatHeaderActionBtn,
              {
                backgroundColor: isDark ? "rgba(37, 99, 235, 0.2)" : "#EFF6FF",
              },
            ]}
            onPress={() => {
              if (activeThread.type === "direct" && activeThread.targetUserId) {
                setSplitTargetId(activeThread.targetUserId);
              } else {
                setSplitTargetId("ALL");
              }
              setShowRequestSplitModal(true);
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Request Split"
          >
            <Feather
              name="plus-circle"
              size={20}
              color={isDark ? "#60A5FA" : "#2563EB"}
            />
          </TouchableOpacity>
        </View>

        {/* Message Feed */}
        <ScrollView
          ref={messageScrollRef}
          style={styles.chatScrollList}
          contentContainerStyle={styles.chatScrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets={false}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            messageScrollRef.current?.scrollToEnd({ animated: true });
          }}
        >
          {activeThread.messages.length === 0 ? (
            <View style={styles.chatEmptyState}>
              <View
                style={[
                  styles.chatEmptyAvatarBig,
                  { backgroundColor: activeThread.avatarBg },
                ]}
              >
                {activeThread.photoURL ? (
                  <Image
                    source={{ uri: activeThread.photoURL }}
                    style={styles.avatarImage}
                  />
                ) : activeThread.type === "group" ? (
                  <Ionicons name="home" size={32} color="#FFFFFF" />
                ) : (
                  <Text
                    style={[
                      styles.chatEmptyAvatarText,
                      { color: activeThread.avatarColor },
                    ]}
                  >
                    {activeThread.initials}
                  </Text>
                )}
              </View>
              <Text
                style={[
                  styles.chatEmptyTitle,
                  { color: isDark ? "#FFFFFF" : "#0F172A" },
                ]}
              >
                {activeThread.name}
              </Text>
              <Text
                style={[
                  styles.chatEmptySubtitle,
                  { color: isDark ? "#94A3B8" : "#64748B" },
                ]}
              >
                {activeThread.type === "group"
                  ? "Welcome to your household group chat! Share bills, receipts, and split notes here."
                  : `You and ${activeThread.name} are connected in the bills group. Send a wave to say hi!`}
              </Text>
            </View>
          ) : (
            activeThread.messages.map((msg, index) => {
              const prevMsg = activeThread.messages[index - 1];
              const showSenderName =
                !msg.isMe && (!prevMsg || prevMsg.senderId !== msg.senderId);

              // Resolve sender avatar & initials for incoming messages (Facebook Messenger style)
              const senderAvatar = !msg.isMe
                ? memberAvatarMap.get(msg.senderId) ||
                  memberAvatarMap.get(msg.senderId?.replace(/^mem_/, "")) ||
                  (activeThread.type === "direct"
                    ? {
                        name: activeThread.name,
                        initials: activeThread.initials,
                        photoURL: activeThread.photoURL,
                        bg: activeThread.avatarBg,
                        text: activeThread.avatarColor,
                      }
                    : {
                        name: msg.sender || "Roommate",
                        initials: getInitials(msg.sender || "R"),
                        photoURL: undefined,
                        bg: AVATAR_PALETTES[
                          Math.abs(hashString(msg.senderId || "R")) %
                            AVATAR_PALETTES.length
                        ].bg,
                        text: AVATAR_PALETTES[
                          Math.abs(hashString(msg.senderId || "R")) %
                            AVATAR_PALETTES.length
                        ].text,
                      })
                : null;

              const isExpanded = !!toggledMessageIds[msg.id];

              if (msg.isMe) {
                const otherReaders = (msg.readBy || []).filter(
                  (uid) => uid !== currentUid && uid !== `mem_${currentUid}`,
                );
                const isSeen =
                  otherReaders.length > 0 ||
                  (activeThread.type === "direct" &&
                    activeThread.targetUserId &&
                    (msg.readBy || []).includes(activeThread.targetUserId));

                let seenLabel = "· Sent";
                if (isSeen) {
                  if (activeThread.type === "direct") {
                    seenLabel = `· Seen by ${activeThread.name.split(" ")[0]}`;
                  } else {
                    const readerNames = otherReaders
                      .map((uid) => {
                        const m = memberAvatarMap.get(uid);
                        return m ? m.name.split(" ")[0] : null;
                      })
                      .filter(Boolean) as string[];

                    if (readerNames.length === 1) {
                      seenLabel = `· Seen by ${readerNames[0]}`;
                    } else if (readerNames.length > 1) {
                      seenLabel = `· Seen by ${readerNames[0]} and ${readerNames.length - 1} other${readerNames.length - 1 > 1 ? "s" : ""}`;
                    } else {
                      seenLabel = "· Seen";
                    }
                  }
                }

                return (
                  <View
                    key={msg.id}
                    style={[styles.msgBubbleRow, styles.msgRowMe]}
                  >
                    {/* Speech bubble */}
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => handleToggleMessage(msg.id)}
                      style={[styles.speechBubble, styles.speechBubbleMe]}
                    >
                      <Text
                        style={[
                          styles.speechBubbleText,
                          styles.speechBubbleTextMe,
                        ]}
                      >
                        {msg.text}
                      </Text>

                      {/* Embedded Expense Split Card */}
                      {msg.type === "expense_split" && msg.meta && (
                        <View
                          style={[
                            styles.msgEmbedCard,
                            {
                              backgroundColor: isDark
                                ? "rgba(0,0,0,0.3)"
                                : "#FFFFFF",
                              borderColor: isDark
                                ? "rgba(255,255,255,0.12)"
                                : "#E2E8F0",
                            },
                          ]}
                        >
                          <View style={styles.msgEmbedHeaderRow}>
                            <Text
                              style={[
                                styles.msgEmbedCategory,
                                { color: isDark ? "#FFFFFF" : "#0F172A" },
                              ]}
                            >
                              🛒 {msg.meta.category}
                            </Text>
                            <Text style={styles.msgEmbedAmount}>
                              {msg.meta.amount}
                            </Text>
                          </View>
                          {msg.meta.share && (
                            <Text
                              style={[
                                styles.msgEmbedShare,
                                { color: isDark ? "#94A3B8" : "#64748B" },
                              ]}
                            >
                              Calculated split share: {msg.meta.share}
                            </Text>
                          )}
                        </View>
                      )}

                      {/* Embedded Payment Claim Card */}
                      {msg.type === "payment_claim" && msg.meta && (
                        <View
                          style={[
                            styles.msgEmbedCard,
                            {
                              backgroundColor: isDark
                                ? "rgba(0,0,0,0.3)"
                                : "#FFFFFF",
                              borderColor: isDark
                                ? "rgba(255,255,255,0.12)"
                                : "#E2E8F0",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.msgEmbedCategory,
                              { color: isDark ? "#FFFFFF" : "#0F172A" },
                            ]}
                          >
                            💳 {msg.meta.paymentMethod || "Payment Settle"}
                          </Text>
                          <Text style={styles.msgEmbedAmount}>
                            Amount: {msg.meta.amount}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>

                    {/* Messenger-style tapped Time & Seen indicator */}
                    {isExpanded && (
                      <View style={styles.msgStatusRowMe}>
                        <Text
                          style={[
                            styles.msgStatusText,
                            isDark && { color: "#94A3B8" },
                          ]}
                        >
                          {msg.time}{" "}
                          <Text
                            style={[
                              styles.msgStatusSeenBadge,
                              isSeen && { color: "#2563EB" },
                            ]}
                          >
                            {seenLabel}
                          </Text>
                        </Text>
                      </View>
                    )}
                  </View>
                );
              }

              // Incoming message: Facebook Messenger style layout with avatar on the left
              return (
                <View key={msg.id} style={styles.msgThemContainer}>
                  {showSenderName && activeThread.type === "group" && (
                    <Text
                      style={[
                        styles.msgSenderName,
                        { color: isDark ? "#64748B" : "#94A3B8" },
                      ]}
                    >
                      {msg.sender}
                    </Text>
                  )}

                  <View style={styles.msgThemRowWithAvatar}>
                    {/* 30x30 Circular Avatar on every incoming message line */}
                    <View
                      style={[
                        styles.msgAvatarWrap,
                        { backgroundColor: senderAvatar?.bg || "#EFF6FF" },
                      ]}
                    >
                      {senderAvatar?.photoURL ? (
                        <Image
                          source={{ uri: senderAvatar.photoURL }}
                          style={styles.msgAvatarImage}
                        />
                      ) : (
                        <Text
                          style={[
                            styles.msgAvatarInitials,
                            { color: senderAvatar?.text || "#2563EB" },
                          ]}
                        >
                          {senderAvatar?.initials || "R"}
                        </Text>
                      )}
                    </View>

                    {/* Speech bubble */}
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => handleToggleMessage(msg.id)}
                      style={[
                        styles.speechBubble,
                        styles.speechBubbleThem,
                        {
                          backgroundColor: isDark ? "#242731" : "#F1F5F9",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.speechBubbleText,
                          { color: isDark ? "#FFFFFF" : "#0F172A" },
                        ]}
                      >
                        {msg.text}
                      </Text>

                      {/* Embedded Expense Split Card */}
                      {msg.type === "expense_split" && msg.meta && (
                        <View
                          style={[
                            styles.msgEmbedCard,
                            {
                              backgroundColor: isDark
                                ? "rgba(0,0,0,0.3)"
                                : "#FFFFFF",
                              borderColor: isDark
                                ? "rgba(255,255,255,0.12)"
                                : "#E2E8F0",
                            },
                          ]}
                        >
                          <View style={styles.msgEmbedHeaderRow}>
                            <Text
                              style={[
                                styles.msgEmbedCategory,
                                { color: isDark ? "#FFFFFF" : "#0F172A" },
                              ]}
                            >
                              🛒 {msg.meta.category}
                            </Text>
                            <Text style={styles.msgEmbedAmount}>
                              {msg.meta.amount}
                            </Text>
                          </View>
                          {msg.meta.share && (
                            <Text
                              style={[
                                styles.msgEmbedShare,
                                { color: isDark ? "#94A3B8" : "#64748B" },
                              ]}
                            >
                              Calculated split share: {msg.meta.share}
                            </Text>
                          )}
                        </View>
                      )}

                      {/* Embedded Payment Claim Card */}
                      {msg.type === "payment_claim" && msg.meta && (
                        <View
                          style={[
                            styles.msgEmbedCard,
                            {
                              backgroundColor: isDark
                                ? "rgba(0,0,0,0.3)"
                                : "#FFFFFF",
                              borderColor: isDark
                                ? "rgba(255,255,255,0.12)"
                                : "#E2E8F0",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.msgEmbedCategory,
                              { color: isDark ? "#FFFFFF" : "#0F172A" },
                            ]}
                          >
                            💳 {msg.meta.paymentMethod || "Payment Settle"}
                          </Text>
                          <Text style={styles.msgEmbedAmount}>
                            Amount: {msg.meta.amount}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* Messenger-style tapped Time indicator for incoming message */}
                  {isExpanded && (
                    <View style={styles.msgStatusRowThem}>
                      <Text
                        style={[
                          styles.msgStatusText,
                          isDark && { color: "#94A3B8" },
                        ]}
                      >
                        {msg.time}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>

        {/* Generous Safe-Area Padded Bottom Capsule Input Bar */}
        <View
          style={[
            styles.capsuleInputOuterContainer,
            {
              paddingBottom: chatInputBottomPadding,
              backgroundColor: isDark ? "#181A20" : "#FFFFFF",
              borderTopColor: isDark ? "rgba(255,255,255,0.08)" : "#F1F5F9",
            },
          ]}
        >
          <View style={styles.capsuleInputInnerRow}>
            {/* Quick Split trigger inside chat */}
            <TouchableOpacity
              style={[
                styles.capsuleActionIconBtn,
                {
                  backgroundColor: isDark ? "#242731" : "#F1F5F9",
                },
              ]}
              onPress={() => {
                if (
                  activeThread.type === "direct" &&
                  activeThread.targetUserId
                ) {
                  setSplitTargetId(activeThread.targetUserId);
                } else {
                  setSplitTargetId("ALL");
                }
                setShowRequestSplitModal(true);
              }}
              accessibilityLabel="Quick split expense"
            >
              <Feather
                name="plus"
                size={19}
                color={isDark ? "#60A5FA" : "#2563EB"}
              />
            </TouchableOpacity>

            {/* Rounded capsule text input */}
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => chatInputRef.current?.focus()}
              style={[
                styles.capsuleTextInputWrapper,
                {
                  backgroundColor: isDark ? "#242731" : "#F1F5F9",
                  borderColor: isDark ? "rgba(255,255,255,0.06)" : "#E2E8F0",
                },
              ]}
            >
              <TextInput
                ref={chatInputRef}
                style={[
                  styles.capsuleTextInput,
                  { color: isDark ? "#FFFFFF" : "#0F172A" },
                ]}
                placeholder={`Message ${activeThread.name.split(" ")[0]}...`}
                placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                value={chatInputText}
                onChangeText={setChatInputText}
                onSubmitEditing={handleSendMessage}
                onFocus={() => {
                  setIsInputFocused(true);
                  setIsKeyboardOpen(true);
                  setTimeout(() => {
                    messageScrollRef.current?.scrollToEnd({ animated: true });
                  }, 100);
                }}
                onBlur={() => {
                  setIsInputFocused(false);
                }}
                returnKeyType="send"
                multiline={false}
                blurOnSubmit={false}
                autoCorrect={true}
                autoCapitalize="sentences"
                underlineColorAndroid="transparent"
              />
            </TouchableOpacity>

            {/* Circular Send Button */}
            <TouchableOpacity
              style={[
                styles.capsuleSendButton,
                (!chatInputText.trim() || isSending) && { opacity: 0.5 },
              ]}
              onPress={handleSendMessage}
              disabled={!chatInputText.trim() || isSending}
              accessibilityLabel="Send message"
            >
              {isSending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="send" size={17} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* MODAL: Request Split inside full-screen view */}
        <SmoothBottomSheetModal
          visible={showRequestSplitModal}
          onClose={() => setShowRequestSplitModal(false)}
          title="Request Split"
          subtitle="Share expenses with roommates and record split claims directly in chat."
          icon={<Feather name="plus-circle" size={20} color="#2563EB" />}
          maxHeight="85%"
          showChipBar={true}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              gap: 12,
              paddingBottom: Math.max(40, insets.bottom + 24),
            }}
          >
            <Text
              style={[
                styles.inputLabel,
                { color: isDark ? "#CBD5E1" : "#475569" },
              ]}
            >
              Split With
            </Text>
            <View style={styles.roommatePillsRow}>
              <TouchableOpacity
                style={[
                  styles.roommatePill,
                  splitTargetId === "ALL"
                    ? styles.roommatePillActive
                    : [
                        styles.roommatePillInactive,
                        {
                          backgroundColor: isDark ? "#111215" : "#F1F5F9",
                          borderColor: isDark
                            ? "rgba(255,255,255,0.08)"
                            : "#E2E8F0",
                        },
                      ],
                ]}
                onPress={() => setSplitTargetId("ALL")}
              >
                <Text
                  style={[
                    styles.roommatePillText,
                    splitTargetId === "ALL"
                      ? styles.roommatePillTextActive
                      : { color: isDark ? "#CBD5E1" : "#475569" },
                  ]}
                >
                  Entire Household ({householdMembers.length || 1})
                </Text>
              </TouchableOpacity>

              {billsGroupMembers.map((m) => {
                const uid = m.userId || m.memberId;
                const name = m.displayName || m.name || "Roommate";
                const isSelected = splitTargetId === uid;
                return (
                  <TouchableOpacity
                    key={uid}
                    style={[
                      styles.roommatePill,
                      isSelected
                        ? styles.roommatePillActive
                        : [
                            styles.roommatePillInactive,
                            {
                              backgroundColor: isDark ? "#111215" : "#F1F5F9",
                              borderColor: isDark
                                ? "rgba(255,255,255,0.08)"
                                : "#E2E8F0",
                            },
                          ],
                    ]}
                    onPress={() => setSplitTargetId(uid)}
                  >
                    <Text
                      style={[
                        styles.roommatePillText,
                        isSelected
                          ? styles.roommatePillTextActive
                          : { color: isDark ? "#CBD5E1" : "#475569" },
                      ]}
                    >
                      {name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text
              style={[
                styles.inputLabel,
                { color: isDark ? "#CBD5E1" : "#475569" },
              ]}
            >
              Total Bill Amount (₱)
            </Text>
            <TextInput
              style={[
                styles.modalTextInput,
                {
                  backgroundColor: isDark ? "#111215" : "#F8FAFC",
                  borderColor: isDark ? "rgba(255,255,255,0.08)" : "#E2E8F0",
                  color: isDark ? "#FFFFFF" : "#0F172A",
                },
              ]}
              placeholder="e.g. 1200.00"
              placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
              keyboardType="decimal-pad"
              value={splitAmount}
              onChangeText={setSplitAmount}
            />

            <Text
              style={[
                styles.inputLabel,
                { color: isDark ? "#CBD5E1" : "#475569" },
              ]}
            >
              Description / Category
            </Text>
            <TextInput
              style={[
                styles.modalTextInput,
                {
                  backgroundColor: isDark ? "#111215" : "#F8FAFC",
                  borderColor: isDark ? "rgba(255,255,255,0.08)" : "#E2E8F0",
                  color: isDark ? "#FFFFFF" : "#0F172A",
                },
              ]}
              placeholder="e.g. Groceries at Supermarket"
              placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
              value={splitDescription}
              onChangeText={setSplitDescription}
            />

            <TouchableOpacity
              style={styles.modalSubmitBtn}
              onPress={handleCreateSplitRequest}
            >
              <Text style={styles.modalSubmitBtnText}>Send Split Request</Text>
            </TouchableOpacity>
          </ScrollView>
        </SmoothBottomSheetModal>
      </KeyboardAvoidingView>
    );
  }

  // ==========================================
  // VIEW 2: AUTHENTIC MESSENGER CONVERSATION FEED
  // ==========================================
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? "#111215" : "#FFFFFF" },
      ]}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        translucent
        backgroundColor="transparent"
      />

      {/* Top Header */}
      <View style={[styles.header, { paddingTop: topInset + 6 }]}>
        <View style={styles.headerLeftRow}>
          {onBack && (
            <TouchableOpacity
              style={[
                styles.backButton,
                {
                  backgroundColor: isDark ? "#1E222B" : "#F8FAFC",
                  borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "#E2E8F0",
                },
              ]}
              onPress={onBack}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Back"
            >
              <Feather
                name="chevron-left"
                size={22}
                color={isDark ? "#FFFFFF" : "#0F172A"}
              />
            </TouchableOpacity>
          )}

          <Text
            style={[
              styles.screenTitle,
              { color: isDark ? "#FFFFFF" : "#0F172A" },
            ]}
          >
            Messages
          </Text>

          {totalUnread > 0 && (
            <View
              style={[
                styles.unreadPill,
                {
                  backgroundColor: isDark
                    ? "rgba(37, 99, 235, 0.2)"
                    : "#EFF6FF",
                },
              ]}
            >
              <Text
                style={[
                  styles.unreadPillText,
                  { color: isDark ? "#60A5FA" : "#2563EB" },
                ]}
              >
                {totalUnread} new
              </Text>
            </View>
          )}
        </View>

        {/* Compose / Edit Action Button */}
        <TouchableOpacity
          style={[
            styles.composeButton,
            {
              backgroundColor: isDark ? "#1E222B" : "#F8FAFC",
              borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "#E2E8F0",
            },
          ]}
          onPress={() => setShowComposeModal(true)}
          accessibilityLabel="Compose new message"
        >
          <Feather
            name="edit"
            size={18}
            color={isDark ? "#60A5FA" : "#2563EB"}
          />
        </TouchableOpacity>
      </View>

      {/* Subtitle */}
      <View style={styles.subtitleRow}>
        <Text
          style={[
            styles.subtitleText,
            { color: isDark ? "#94A3B8" : "#64748B" },
          ]}
        >
          Roommate chats & settlement requests
        </Text>
      </View>

      {/* Search Input Bar */}
      <View style={styles.searchBarWrapper}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => searchInputRef.current?.focus()}
          style={[
            styles.searchBar,
            {
              backgroundColor: isDark ? "#181A20" : "#F1F5F9",
              borderColor: isDark ? "rgba(255,255,255,0.06)" : "#E2E8F0",
            },
          ]}
        >
          <Feather
            name="search"
            size={18}
            color={isDark ? "#64748B" : "#94A3B8"}
            style={styles.searchIcon}
          />
          <TextInput
            ref={searchInputRef}
            style={[
              styles.searchInput,
              { color: isDark ? "#FFFFFF" : "#0F172A" },
            ]}
            placeholder="Search chats, expenses, or roommates..."
            placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Feather
                name="x-circle"
                size={16}
                color={isDark ? "#94A3B8" : "#64748B"}
              />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </View>

      {/* FACEBOOK MESSENGER STYLE: Active Stories / Thought Notes Tray */}
      <View style={styles.activeUsersSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.activeUsersScrollContent}
        >
          {/* Card 0: Current User (Your Story / You with Interactive Thought Note) */}
          <TouchableOpacity
            style={styles.storyCard}
            activeOpacity={0.8}
            onPress={() => setShowNoteModal(true)}
          >
            {/* Thought bubble if note exists */}
            {currentUserNote ? (
              <View
                style={[
                  styles.thoughtBubbleWrap,
                  {
                    backgroundColor: isDark ? "#1E222B" : "#FFFFFF",
                    borderColor: isDark ? "#3B82F6" : "#2563EB",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.thoughtBubbleText,
                    { color: isDark ? "#FFFFFF" : "#0F172A" },
                  ]}
                  numberOfLines={1}
                >
                  {currentUserNote.emoji ? `${currentUserNote.emoji} ` : ""}
                  {currentUserNote.note}
                </Text>
                {/* Connecting thought dots */}
                <View
                  style={[
                    styles.thoughtDotSmall,
                    {
                      backgroundColor: isDark ? "#1E222B" : "#FFFFFF",
                      borderColor: isDark ? "#3B82F6" : "#2563EB",
                    },
                  ]}
                />
              </View>
            ) : (
              <View style={styles.thoughtBubblePlaceholder} />
            )}

            <View style={styles.storyAvatarWrap}>
              <View
                style={[
                  styles.storyAvatarCircle,
                  {
                    backgroundColor: isDark ? "#1E293B" : "#EFF6FF",
                    borderColor: isDark ? "#3B82F6" : "#2563EB",
                  },
                ]}
              >
                {currentUserPhotoURL ? (
                  <Image
                    source={{ uri: currentUserPhotoURL }}
                    style={styles.storyAvatarImage}
                  />
                ) : (
                  <Text
                    style={[
                      styles.storyAvatarText,
                      { color: isDark ? "#93C5FD" : "#2563EB" },
                    ]}
                  >
                    {currentUserAvatar}
                  </Text>
                )}
              </View>

              {/* Plus or Edit badge */}
              <View
                style={[
                  styles.storyPlusBadge,
                  { borderColor: isDark ? "#111215" : "#FFFFFF" },
                ]}
              >
                <Feather
                  name={currentUserNote ? "edit-2" : "plus"}
                  size={10}
                  color="#FFFFFF"
                />
              </View>
            </View>

            <Text
              style={[
                styles.storyNameText,
                { color: isDark ? "#94A3B8" : "#64748B" },
              ]}
              numberOfLines={1}
            >
              {currentUserNote ? "Edit note" : "Your note"}
            </Text>
          </TouchableOpacity>

          {/* Cards 1..N: Real Bills Group Members with Presence and Notes */}
          {billsGroupMembers.map((member) => {
            const memberUid = member.userId || member.memberId;
            const displayName =
              member.displayName ||
              member.name ||
              member.email?.split("@")[0] ||
              "Roommate";
            const firstName = displayName.split(" ")[0] || displayName;
            const initials = getInitials(displayName);
            const palette =
              AVATAR_PALETTES[
                Math.abs(hashString(memberUid)) % AVATAR_PALETTES.length
              ];
            const isHost =
              member.role === "HOST" || householdInfo?.hostId === memberUid;

            // Legitimate presence: active in last 15 minutes
            const presence = computePresence(
              member.lastActiveAt || member.updatedAt || member.createdAt,
            );

            // Roommate's note
            const memberNote =
              householdNotes[memberUid] ||
              (member.thoughtNote
                ? {
                    note: member.thoughtNote,
                    emoji:
                      member.thoughtEmoji !== undefined &&
                      member.thoughtEmoji !== null
                        ? String(member.thoughtEmoji).trim()
                        : "",
                    updatedAt: member.noteUpdatedAt || "",
                  }
                : undefined);

            return (
              <TouchableOpacity
                key={memberUid}
                style={styles.storyCard}
                activeOpacity={0.8}
                onPress={() => {
                  if (memberNote) {
                    setViewingNoteData({
                      member,
                      note: memberNote,
                    });
                  } else {
                    handleOpenDirectChatWithMember(member);
                  }
                }}
              >
                {/* Roommate's Thought Bubble if set */}
                {memberNote ? (
                  <View
                    style={[
                      styles.thoughtBubbleWrap,
                      {
                        backgroundColor: isDark ? "#1E222B" : "#FFFFFF",
                        borderColor: isDark ? "#475569" : "#CBD5E1",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.thoughtBubbleText,
                        { color: isDark ? "#FFFFFF" : "#0F172A" },
                      ]}
                      numberOfLines={1}
                    >
                      {memberNote.emoji ? `${memberNote.emoji} ` : ""}
                      {memberNote.note}
                    </Text>
                    <View
                      style={[
                        styles.thoughtDotSmall,
                        {
                          backgroundColor: isDark ? "#1E222B" : "#FFFFFF",
                          borderColor: isDark ? "#475569" : "#CBD5E1",
                        },
                      ]}
                    />
                  </View>
                ) : (
                  <View style={styles.thoughtBubblePlaceholder} />
                )}

                <View style={styles.storyAvatarWrap}>
                  <View
                    style={[
                      styles.storyAvatarCircle,
                      {
                        backgroundColor: palette.bg,
                        borderColor: isHost ? "#F59E0B" : palette.text,
                      },
                    ]}
                  >
                    {member.profilePicture || member.photoURL ? (
                      <Image
                        source={{
                          uri: member.profilePicture || member.photoURL,
                        }}
                        style={styles.storyAvatarImage}
                      />
                    ) : (
                      <Text
                        style={[
                          styles.storyAvatarText,
                          { color: palette.text },
                        ]}
                      >
                        {initials}
                      </Text>
                    )}
                  </View>

                  {/* Legitimate Green Presence Indicator Dot (only when active < 15m) */}
                  {presence.isOnline && (
                    <View
                      style={[
                        styles.storyActiveDot,
                        { borderColor: isDark ? "#111215" : "#FFFFFF" },
                      ]}
                    />
                  )}
                </View>

                <Text
                  style={[
                    styles.storyNameText,
                    { color: isDark ? "#E2E8F0" : "#1E293B" },
                  ]}
                  numberOfLines={1}
                >
                  {firstName}
                </Text>
              </TouchableOpacity>
            );
          })}

          {billsGroupMembers.length === 0 && !loading && (
            <View style={styles.noMembersHintWrap}>
              <Text
                style={[
                  styles.noMembersHintText,
                  { color: isDark ? "#64748B" : "#94A3B8" },
                ]}
              >
                No other roommates yet. Invite roommates from the Groups tab to
                chat!
              </Text>
            </View>
          )}
        </ScrollView>
      </View>

      {/* Horizontal Filter Tabs Bar */}
      <View style={styles.filtersWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersScrollContent}
        >
          {/* "All" Filter Pill */}
          <TouchableOpacity
            style={[
              styles.filterPill,
              activeFilter === "all"
                ? styles.filterPillActive
                : [
                    styles.filterPillInactive,
                    {
                      backgroundColor: isDark ? "#181A20" : "#F1F5F9",
                      borderColor: isDark
                        ? "rgba(255,255,255,0.06)"
                        : "#E2E8F0",
                    },
                  ],
            ]}
            onPress={() => setActiveFilter("all")}
          >
            <Text
              style={[
                styles.filterPillText,
                activeFilter === "all"
                  ? styles.filterPillTextActive
                  : { color: isDark ? "#CBD5E1" : "#475569" },
              ]}
            >
              All •
            </Text>
          </TouchableOpacity>

          {/* "Bills Group" Filter Pill */}
          <TouchableOpacity
            style={[
              styles.filterPill,
              activeFilter === "apartment"
                ? styles.filterPillActive
                : [
                    styles.filterPillInactive,
                    {
                      backgroundColor: isDark ? "#181A20" : "#F1F5F9",
                      borderColor: isDark
                        ? "rgba(255,255,255,0.06)"
                        : "#E2E8F0",
                    },
                  ],
            ]}
            onPress={() => setActiveFilter("apartment")}
          >
            <Text
              style={[
                styles.filterPillText,
                activeFilter === "apartment"
                  ? styles.filterPillTextActive
                  : { color: isDark ? "#CBD5E1" : "#475569" },
              ]}
            >
              Bills Group
            </Text>
          </TouchableOpacity>

          {/* "Pending Dues" Filter Pill */}
          <TouchableOpacity
            style={[
              styles.filterPill,
              activeFilter === "pending"
                ? styles.filterPillActive
                : [
                    styles.filterPillInactive,
                    {
                      backgroundColor: isDark ? "#181A20" : "#F1F5F9",
                      borderColor: isDark
                        ? "rgba(255,255,255,0.06)"
                        : "#E2E8F0",
                    },
                  ],
            ]}
            onPress={() => setActiveFilter("pending")}
          >
            <Text
              style={[
                styles.filterPillText,
                activeFilter === "pending"
                  ? styles.filterPillTextActive
                  : { color: isDark ? "#CBD5E1" : "#475569" },
              ]}
            >
              Pending Dues
            </Text>
          </TouchableOpacity>

          {/* "Direct Chats" Filter Pill */}
          <TouchableOpacity
            style={[
              styles.filterPill,
              activeFilter === "direct"
                ? styles.filterPillActive
                : [
                    styles.filterPillInactive,
                    {
                      backgroundColor: isDark ? "#181A20" : "#F1F5F9",
                      borderColor: isDark
                        ? "rgba(255,255,255,0.06)"
                        : "#E2E8F0",
                    },
                  ],
            ]}
            onPress={() => setActiveFilter("direct")}
          >
            <Text
              style={[
                styles.filterPillText,
                activeFilter === "direct"
                  ? styles.filterPillTextActive
                  : { color: isDark ? "#CBD5E1" : "#475569" },
              ]}
            >
              Direct Chats
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Loading state indicator */}
      {loading && (
        <View style={styles.loadingWrapper}>
          <ActivityIndicator size="small" color="#2563EB" />
          <Text
            style={[
              styles.loadingText,
              { color: isDark ? "#94A3B8" : "#64748B" },
            ]}
          >
            Syncing conversations...
          </Text>
        </View>
      )}

      {/* Seamless Facebook Messenger-Style Conversation List (Sorted Chronologically) */}
      <ScrollView
        style={styles.scrollList}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(120, insets.bottom + 95) },
        ]}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {filteredConversations.map((item) => {
          const isGroup = item.type === "group";
          const hasUnread = (item.unreadCount || 0) > 0;

          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.messengerRow,
                {
                  borderBottomColor: isDark
                    ? "rgba(255,255,255,0.05)"
                    : "#F1F5F9",
                },
              ]}
              activeOpacity={0.7}
              onPress={() => setActiveThread(item)}
            >
              {/* Large 56px Messenger Avatar */}
              <View style={styles.messengerAvatarWrap}>
                <View
                  style={[
                    styles.messengerAvatar,
                    { backgroundColor: item.avatarBg },
                  ]}
                >
                  {item.photoURL ? (
                    <Image
                      source={{ uri: item.photoURL }}
                      style={styles.avatarImage}
                    />
                  ) : isGroup ? (
                    <Ionicons name="home" size={24} color="#FFFFFF" />
                  ) : (
                    <Text
                      style={[
                        styles.messengerAvatarText,
                        { color: item.avatarColor },
                      ]}
                    >
                      {item.initials}
                    </Text>
                  )}
                </View>

                {/* Group Member Count Badge or Legitimate Online Dot */}
                {isGroup ? (
                  <View
                    style={[
                      styles.messengerGroupBadge,
                      {
                        backgroundColor: isDark ? "#111215" : "#FFFFFF",
                        borderColor: isDark ? "#2563EB" : "#2563EB",
                      },
                    ]}
                  >
                    <Text style={styles.messengerGroupBadgeText}>
                      {householdMembers.length || 1}
                    </Text>
                  </View>
                ) : (
                  item.isOnline && (
                    <View
                      style={[
                        styles.messengerOnlineDot,
                        { borderColor: isDark ? "#111215" : "#FFFFFF" },
                      ]}
                    />
                  )
                )}
              </View>

              {/* Center Content Column */}
              <View style={styles.messengerContentCol}>
                {/* Top row: Name & Timestamp */}
                <View style={styles.messengerTopRow}>
                  <View style={styles.messengerNameWrap}>
                    <Text
                      style={[
                        styles.messengerName,
                        { color: isDark ? "#FFFFFF" : "#0F172A" },
                        hasUnread && styles.messengerNameUnread,
                      ]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    {item.roleLabel && !isGroup && (
                      <Text
                        style={[
                          styles.messengerRoleText,
                          { color: isDark ? "#94A3B8" : "#64748B" },
                        ]}
                      >
                        · {item.roleLabel}
                      </Text>
                    )}
                  </View>

                  <Text
                    style={[
                      styles.messengerTime,
                      hasUnread
                        ? {
                            color: isDark ? "#60A5FA" : "#2563EB",
                            fontWeight: "700",
                          }
                        : { color: isDark ? "#94A3B8" : "#94A3B8" },
                    ]}
                  >
                    {item.timestamp}
                  </Text>
                </View>

                {/* Bottom row: Message Snippet & Unread Dot */}
                <View style={styles.messengerBottomRow}>
                  <Text
                    style={[
                      styles.messengerSnippet,
                      hasUnread
                        ? [
                            styles.messengerSnippetUnread,
                            { color: isDark ? "#FFFFFF" : "#0F172A" },
                          ]
                        : { color: isDark ? "#94A3B8" : "#64748B" },
                    ]}
                    numberOfLines={1}
                  >
                    {item.lastMessage}
                  </Text>

                  {/* Status chips or unread indicator */}
                  {hasUnread && <View style={styles.messengerUnreadBlueDot} />}

                  {/* Confirm Receipt Action trigger */}
                  {item.hasReceiptConfirmAction && (
                    <TouchableOpacity
                      style={[
                        styles.quickConfirmReceiptBtn,
                        {
                          backgroundColor: isDark
                            ? "rgba(37, 99, 235, 0.2)"
                            : "#EFF6FF",
                          borderColor: isDark
                            ? "rgba(59, 130, 246, 0.3)"
                            : "#BFDBFE",
                        },
                      ]}
                      onPress={() => handleConfirmReceipt(item)}
                    >
                      <Text
                        style={[
                          styles.quickConfirmReceiptText,
                          { color: isDark ? "#60A5FA" : "#2563EB" },
                        ]}
                      >
                        Confirm Receipt
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Empty state when no conversations match search */}
        {filteredConversations.length === 0 && !loading && (
          <View style={styles.emptyWrap}>
            <Feather
              name="message-circle"
              size={42}
              color={isDark ? "#64748B" : "#94A3B8"}
            />
            <Text
              style={[
                styles.emptyTitle,
                { color: isDark ? "#FFFFFF" : "#0F172A" },
              ]}
            >
              No conversations found
            </Text>
            <Text
              style={[
                styles.emptySubtitle,
                { color: isDark ? "#94A3B8" : "#64748B" },
              ]}
            >
              {searchQuery
                ? "Try searching for a different roommate, group, or keyword."
                : "No messages yet. Send a message to get the conversation started!"}
            </Text>
          </View>
        )}

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* Floating "+ Request Split" Action Button */}
      <View style={styles.fabWrapper} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.requestSplitFab}
          activeOpacity={0.88}
          onPress={() => {
            setSplitTargetId("ALL");
            setShowRequestSplitModal(true);
          }}
        >
          <Feather name="plus" size={18} color="#FFFFFF" />
          <Text style={styles.requestSplitFabText}>Request Split</Text>
        </TouchableOpacity>
      </View>

      {/* MODAL 1: Share a Thought / Note (Facebook Messenger Style with OPTIONAL Emoji) */}
      <SmoothBottomSheetModal
        visible={showNoteModal}
        onClose={() => setShowNoteModal(false)}
        title={currentUserNote ? "Update your thought" : "Share a thought"}
        subtitle="Post a note to your roommates that floats above your avatar for everyone to see."
        icon={<Ionicons name="chatbubble-ellipses" size={20} color="#2563EB" />}
        maxHeight="78%"
        showChipBar={true}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            gap: 14,
            paddingBottom: Math.max(40, insets.bottom + 24),
          }}
        >
          {/* Note Preview Avatar Center */}
          <View style={styles.notePreviewCenterWrap}>
            <View
              style={[
                styles.notePreviewBubble,
                {
                  backgroundColor: isDark ? "#1E222B" : "#FEF08A",
                  borderColor: isDark ? "#3B82F6" : "#FDE047",
                },
              ]}
            >
              <Text
                style={[
                  styles.notePreviewBubbleText,
                  { color: isDark ? "#93C5FD" : "#1C1917" },
                ]}
                numberOfLines={2}
              >
                {selectedNoteEmoji ? `${selectedNoteEmoji} ` : ""}
                {noteInputText.trim() || "Share what's on your mind..."}
              </Text>
            </View>

            <View style={styles.notePreviewAvatarCircle}>
              {currentUserPhotoURL ? (
                <Image
                  source={{ uri: currentUserPhotoURL }}
                  style={styles.avatarImage}
                />
              ) : (
                <Text
                  style={{ fontSize: 22, fontWeight: "900", color: "#2563EB" }}
                >
                  {currentUserAvatar}
                </Text>
              )}
            </View>
          </View>

          {/* Emoji selector row (OPTIONAL!) */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text
              style={[
                styles.inputLabel,
                { color: isDark ? "#CBD5E1" : "#475569" },
              ]}
            >
              Pick an Icon (Optional)
            </Text>
            {selectedNoteEmoji ? (
              <TouchableOpacity onPress={() => setSelectedNoteEmoji("")}>
                <Text
                  style={{
                    fontSize: 11,
                    color: isDark ? "#60A5FA" : "#2563EB",
                    fontWeight: "600",
                  }}
                >
                  Clear icon
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={styles.emojiPickerRow}>
            {/* None / Keyboard only pill */}
            <TouchableOpacity
              style={[
                styles.emojiButton,
                selectedNoteEmoji === "" && styles.emojiButtonActive,
                {
                  backgroundColor:
                    selectedNoteEmoji === ""
                      ? isDark
                        ? "#3B82F6"
                        : "#DBEAFE"
                      : isDark
                        ? "#1E222B"
                        : "#F1F5F9",
                  paddingHorizontal: 10,
                  width: "auto",
                  minWidth: 46,
                },
              ]}
              onPress={() => setSelectedNoteEmoji("")}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color:
                    selectedNoteEmoji === ""
                      ? isDark
                        ? "#FFFFFF"
                        : "#1E40AF"
                      : isDark
                        ? "#94A3B8"
                        : "#64748B",
                }}
              >
                None
              </Text>
            </TouchableOpacity>

            {QUICK_NOTE_EMOJIS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={[
                  styles.emojiButton,
                  selectedNoteEmoji === emoji && styles.emojiButtonActive,
                  {
                    backgroundColor:
                      selectedNoteEmoji === emoji
                        ? isDark
                          ? "#3B82F6"
                          : "#DBEAFE"
                        : isDark
                          ? "#1E222B"
                          : "#F1F5F9",
                  },
                ]}
                onPress={() => setSelectedNoteEmoji(emoji)}
              >
                <Text style={{ fontSize: 20 }}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Note text input with built-in phone keyboard emoji support */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text
              style={[
                styles.inputLabel,
                { color: isDark ? "#CBD5E1" : "#475569" },
              ]}
            >
              Your Thought (max 60 chars)
            </Text>
            <Text
              style={{
                fontSize: 11,
                color: isDark ? "#94A3B8" : "#64748B",
              }}
            >
              {noteInputText.length}/60
            </Text>
          </View>
          <TextInput
            style={[
              styles.modalTextInput,
              {
                backgroundColor: isDark ? "#111215" : "#F8FAFC",
                borderColor: isDark ? "rgba(255,255,255,0.08)" : "#E2E8F0",
                color: isDark ? "#FFFFFF" : "#0F172A",
              },
            ]}
            placeholder="e.g. Laptop wer na u ? 🤣"
            placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
            value={noteInputText}
            onChangeText={(t) => setNoteInputText(t.slice(0, 60))}
            maxLength={60}
          />

          <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
            {currentUserNote && (
              <TouchableOpacity
                style={[
                  styles.modalSecondaryBtn,
                  {
                    borderColor: isDark ? "rgba(239, 68, 68, 0.4)" : "#FCA5A5",
                    backgroundColor: isDark
                      ? "rgba(239, 68, 68, 0.15)"
                      : "#FEF2F2",
                  },
                ]}
                onPress={handleClearNote}
                disabled={isSavingNote}
              >
                <Text
                  style={{
                    color: "#EF4444",
                    fontSize: 13,
                    fontWeight: "700",
                  }}
                >
                  Clear Note
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.modalSubmitBtn,
                { flex: 1, marginTop: 0 },
                (!noteInputText.trim() || isSavingNote) && { opacity: 0.6 },
              ]}
              onPress={handleSaveNote}
              disabled={!noteInputText.trim() || isSavingNote}
            >
              {isSavingNote ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.modalSubmitBtnText}>Share Note</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SmoothBottomSheetModal>

      {/* MODAL 2: FULL-SCREEN AUTHENTIC FACEBOOK MESSENGER NOTE VIEWER & REPLY */}
      <Modal
        visible={!!viewingNoteData}
        animationType="fade"
        transparent={false}
        onRequestClose={() => setViewingNoteData(null)}
        statusBarTranslucent={true}
      >
        {viewingNoteData && (
          <View
            style={[
              styles.noteViewerModalOverlay,
              { backgroundColor: isDark ? "#111215" : "#FFFFFF" },
            ]}
          >
            <StatusBar
              barStyle={isDark ? "light-content" : "dark-content"}
              translucent
              backgroundColor="transparent"
            />

            {/* Top Bar matching reference screenshot */}
            <View
              style={[
                styles.noteViewerTopBar,
                {
                  paddingTop: topInset + 6,
                  borderBottomColor: isDark
                    ? "rgba(255,255,255,0.06)"
                    : "transparent",
                },
              ]}
            >
              {/* Left Profile thumbnail + Name + Time */}
              <View style={styles.noteViewerProfileHeaderLeft}>
                <View
                  style={[
                    styles.noteViewerThumbCircle,
                    {
                      backgroundColor:
                        AVATAR_PALETTES[
                          Math.abs(
                            hashString(
                              viewingNoteData.member.userId ||
                                viewingNoteData.member.memberId ||
                                "",
                            ),
                          ) % AVATAR_PALETTES.length
                        ].bg,
                    },
                  ]}
                >
                  {viewingNoteData.member.profilePicture ||
                  viewingNoteData.member.photoURL ? (
                    <Image
                      source={{
                        uri:
                          viewingNoteData.member.profilePicture ||
                          viewingNoteData.member.photoURL,
                      }}
                      style={styles.avatarImage}
                    />
                  ) : (
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "800",
                        color: "#2563EB",
                      }}
                    >
                      {getInitials(
                        viewingNoteData.member.displayName ||
                          viewingNoteData.member.name,
                      )}
                    </Text>
                  )}
                </View>

                <View style={styles.noteViewerNameColumn}>
                  <Text
                    style={[
                      styles.noteViewerHeaderName,
                      { color: isDark ? "#FFFFFF" : "#0F172A" },
                    ]}
                    numberOfLines={1}
                  >
                    {viewingNoteData.member.displayName ||
                      viewingNoteData.member.name ||
                      "Roommate"}
                  </Text>
                  <Text
                    style={[
                      styles.noteViewerHeaderTime,
                      { color: isDark ? "#94A3B8" : "#64748B" },
                    ]}
                  >
                    {formatMessageTime(viewingNoteData.note.updatedAt)}
                  </Text>
                </View>
              </View>

              {/* Right: Options & Close */}
              <View style={styles.noteViewerTopBarRight}>
                <TouchableOpacity
                  style={styles.noteViewerIconBtn}
                  onPress={() => {
                    Alert.alert(
                      viewingNoteData.member.displayName ||
                        viewingNoteData.member.name,
                      "Household member in bills group.",
                      [
                        {
                          text: "Open Profile / Chat",
                          onPress: () => {
                            const mem = viewingNoteData.member;
                            setViewingNoteData(null);
                            handleOpenDirectChatWithMember(mem);
                          },
                        },
                        { text: "Close", style: "cancel" },
                      ],
                    );
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Feather
                    name="more-horizontal"
                    size={22}
                    color={isDark ? "#FFFFFF" : "#0F172A"}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.noteViewerIconBtn}
                  onPress={() => setViewingNoteData(null)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Feather
                    name="x"
                    size={24}
                    color={isDark ? "#FFFFFF" : "#0F172A"}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Center Canvas: Huge Avatar with Perched Thought Bubble */}
            <View style={styles.noteViewerCenterSection}>
              {/* Floating Thought Bubble in warm yellow style */}
              <View style={styles.noteViewerThoughtWrap}>
                <View
                  style={[
                    styles.noteViewerYellowBubble,
                    {
                      backgroundColor: isDark ? "#423215" : "#FEF08A",
                      borderColor: isDark ? "#713F12" : "#FDE047",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.noteViewerYellowBubbleText,
                      { color: isDark ? "#FEF9C3" : "#1C1917" },
                    ]}
                  >
                    {viewingNoteData.note.emoji
                      ? `${viewingNoteData.note.emoji} `
                      : ""}
                    {viewingNoteData.note.note}
                  </Text>
                </View>

                {/* Connecting thought dots leading to the avatar */}
                <View
                  style={[
                    styles.noteViewerThoughtDotMedium,
                    {
                      backgroundColor: isDark ? "#423215" : "#FEF08A",
                      borderColor: isDark ? "#713F12" : "#FDE047",
                    },
                  ]}
                />
                <View
                  style={[
                    styles.noteViewerThoughtDotSmall,
                    {
                      backgroundColor: isDark ? "#423215" : "#FEF08A",
                      borderColor: isDark ? "#713F12" : "#FDE047",
                    },
                  ]}
                />
              </View>

              {/* Large Centered Circular Avatar */}
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => {
                  const mem = viewingNoteData.member;
                  setViewingNoteData(null);
                  handleOpenDirectChatWithMember(mem);
                }}
                style={[
                  styles.noteViewerLargeAvatarCircle,
                  {
                    backgroundColor: isDark ? "#1E293B" : "#F1F5F9",
                    borderColor: isDark ? "#334155" : "#E2E8F0",
                  },
                ]}
              >
                {viewingNoteData.member.profilePicture ||
                viewingNoteData.member.photoURL ? (
                  <Image
                    source={{
                      uri:
                        viewingNoteData.member.profilePicture ||
                        viewingNoteData.member.photoURL,
                    }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <Text
                    style={[
                      styles.noteViewerLargeAvatarInitials,
                      { color: isDark ? "#60A5FA" : "#2563EB" },
                    ]}
                  >
                    {getInitials(
                      viewingNoteData.member.displayName ||
                        viewingNoteData.member.name,
                    )}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Bottom Section: Quick Reaction Pills & Reply Input Bar */}
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
            >
              <View
                style={[
                  styles.noteViewerBottomContainer,
                  {
                    paddingBottom:
                      Platform.OS === "android"
                        ? isWindowResizedBySystem
                          ? 14
                          : (keyboardHeight > 0
                              ? keyboardHeight
                              : keyboardActive
                                ? 285
                                : 0) +
                            (insets.bottom > 0 ? insets.bottom : 24) +
                            14
                        : keyboardActive
                          ? 14
                          : Math.max(bottomInset + 10, insets.bottom + 16),
                  },
                ]}
              >
                {/* Quick Reaction Pills Row matching reference screenshot */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.noteViewerReactionPillsScroll}
                >
                  {NOTE_REACTION_PILLS.map((emoji) => (
                    <TouchableOpacity
                      key={emoji}
                      style={[
                        styles.noteViewerReactionPill,
                        {
                          backgroundColor: isDark ? "#1E222B" : "#F1F5F9",
                        },
                      ]}
                      onPress={() => handleSendNoteReaction(emoji)}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 22 }}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Bottom Reply Bar matching reference screenshot */}
                <View style={styles.noteViewerInputBarRow}>
                  {/* Sync / Direct chat action */}
                  <TouchableOpacity
                    style={[
                      styles.noteViewerActionIcon,
                      {
                        backgroundColor: isDark ? "#1E222B" : "#F1F5F9",
                      },
                    ]}
                    onPress={() => {
                      const mem = viewingNoteData.member;
                      setViewingNoteData(null);
                      handleOpenDirectChatWithMember(mem);
                    }}
                    accessibilityLabel="Open direct chat"
                  >
                    <Feather
                      name="repeat"
                      size={18}
                      color={isDark ? "#60A5FA" : "#2563EB"}
                    />
                  </TouchableOpacity>

                  {/* Rounded capsule text input */}
                  <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => noteReplyInputRef.current?.focus()}
                    style={[
                      styles.noteViewerCapsuleInputWrapper,
                      {
                        backgroundColor: isDark ? "#1E222B" : "#F1F5F9",
                        borderColor: isDark
                          ? "rgba(255,255,255,0.08)"
                          : "#E2E8F0",
                      },
                    ]}
                  >
                    <TextInput
                      ref={noteReplyInputRef}
                      style={[
                        styles.noteViewerCapsuleTextInput,
                        { color: isDark ? "#FFFFFF" : "#0F172A" },
                      ]}
                      placeholder="Send message"
                      placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                      value={noteReplyText}
                      onChangeText={setNoteReplyText}
                      onSubmitEditing={handleSendNoteReply}
                      returnKeyType="send"
                      blurOnSubmit={false}
                      autoCorrect={true}
                      autoCapitalize="sentences"
                      underlineColorAndroid="transparent"
                    />

                    <Feather
                      name="smile"
                      size={20}
                      color="#2563EB"
                      style={{ marginRight: 4 }}
                    />
                  </TouchableOpacity>

                  {/* Right side: Quick emojis or Send button */}
                  {noteReplyText.trim().length > 0 ? (
                    <TouchableOpacity
                      style={[
                        styles.noteViewerSendBtn,
                        isSendingNoteReply && { opacity: 0.5 },
                      ]}
                      onPress={handleSendNoteReply}
                      disabled={isSendingNoteReply}
                    >
                      {isSendingNoteReply ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Ionicons name="send" size={16} color="#FFFFFF" />
                      )}
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.noteViewerQuickEmojiRightWrap}>
                      <TouchableOpacity
                        onPress={() => handleSendNoteReaction("❤️")}
                        style={styles.noteViewerQuickEmojiBtn}
                      >
                        <Text style={{ fontSize: 20 }}>❤️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleSendNoteReaction("😂")}
                        style={styles.noteViewerQuickEmojiBtn}
                      >
                        <Text style={{ fontSize: 20 }}>😂</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleSendNoteReaction("😮")}
                        style={styles.noteViewerQuickEmojiBtn}
                      >
                        <Text style={{ fontSize: 20 }}>😮</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            </KeyboardAvoidingView>
          </View>
        )}
      </Modal>

      {/* MODAL 3: Request Split from conversation list */}
      <SmoothBottomSheetModal
        visible={showRequestSplitModal}
        onClose={() => setShowRequestSplitModal(false)}
        title="Request Split"
        subtitle="Share expenses with roommates and record split claims directly in chat."
        icon={<Feather name="plus-circle" size={20} color="#2563EB" />}
        maxHeight="85%"
        showChipBar={true}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            gap: 12,
            paddingBottom: Math.max(40, insets.bottom + 24),
          }}
        >
          <Text
            style={[
              styles.inputLabel,
              { color: isDark ? "#CBD5E1" : "#475569" },
            ]}
          >
            Split With
          </Text>
          <View style={styles.roommatePillsRow}>
            <TouchableOpacity
              style={[
                styles.roommatePill,
                splitTargetId === "ALL"
                  ? styles.roommatePillActive
                  : [
                      styles.roommatePillInactive,
                      {
                        backgroundColor: isDark ? "#111215" : "#F1F5F9",
                        borderColor: isDark
                          ? "rgba(255,255,255,0.08)"
                          : "#E2E8F0",
                      },
                    ],
              ]}
              onPress={() => setSplitTargetId("ALL")}
            >
              <Text
                style={[
                  styles.roommatePillText,
                  splitTargetId === "ALL"
                    ? styles.roommatePillTextActive
                    : { color: isDark ? "#CBD5E1" : "#475569" },
                ]}
              >
                Entire Household ({householdMembers.length || 1})
              </Text>
            </TouchableOpacity>

            {billsGroupMembers.map((m) => {
              const uid = m.userId || m.memberId;
              const name = m.displayName || m.name || "Roommate";
              const isSelected = splitTargetId === uid;
              return (
                <TouchableOpacity
                  key={uid}
                  style={[
                    styles.roommatePill,
                    isSelected
                      ? styles.roommatePillActive
                      : [
                          styles.roommatePillInactive,
                          {
                            backgroundColor: isDark ? "#111215" : "#F1F5F9",
                            borderColor: isDark
                              ? "rgba(255,255,255,0.08)"
                              : "#E2E8F0",
                          },
                        ],
                  ]}
                  onPress={() => setSplitTargetId(uid)}
                >
                  <Text
                    style={[
                      styles.roommatePillText,
                      isSelected
                        ? styles.roommatePillTextActive
                        : { color: isDark ? "#CBD5E1" : "#475569" },
                    ]}
                  >
                    {name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text
            style={[
              styles.inputLabel,
              { color: isDark ? "#CBD5E1" : "#475569" },
            ]}
          >
            Total Bill Amount (₱)
          </Text>
          <TextInput
            style={[
              styles.modalTextInput,
              {
                backgroundColor: isDark ? "#111215" : "#F8FAFC",
                borderColor: isDark ? "rgba(255,255,255,0.08)" : "#E2E8F0",
                color: isDark ? "#FFFFFF" : "#0F172A",
              },
            ]}
            placeholder="e.g. 1200.00"
            placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
            keyboardType="decimal-pad"
            value={splitAmount}
            onChangeText={setSplitAmount}
          />

          <Text
            style={[
              styles.inputLabel,
              { color: isDark ? "#CBD5E1" : "#475569" },
            ]}
          >
            Description / Category
          </Text>
          <TextInput
            style={[
              styles.modalTextInput,
              {
                backgroundColor: isDark ? "#111215" : "#F8FAFC",
                borderColor: isDark ? "rgba(255,255,255,0.08)" : "#E2E8F0",
                color: isDark ? "#FFFFFF" : "#0F172A",
              },
            ]}
            placeholder="e.g. Groceries at Supermarket"
            placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
            value={splitDescription}
            onChangeText={setSplitDescription}
          />

          <TouchableOpacity
            style={styles.modalSubmitBtn}
            onPress={handleCreateSplitRequest}
          >
            <Text style={styles.modalSubmitBtnText}>Send Split Request</Text>
          </TouchableOpacity>
        </ScrollView>
      </SmoothBottomSheetModal>

      {/* MODAL 4: Compose New Chat Modal */}
      <SmoothBottomSheetModal
        visible={showComposeModal}
        onClose={() => setShowComposeModal(false)}
        title="New Conversation"
        subtitle="Select a roommate from your bills group to start a direct message."
        icon={<Feather name="edit-3" size={20} color="#2563EB" />}
        maxHeight="75%"
        showChipBar={true}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            gap: 10,
            paddingBottom: Math.max(40, insets.bottom + 24),
          }}
        >
          {/* Option: Group Chat */}
          <TouchableOpacity
            style={[
              styles.composeRoommateRow,
              {
                backgroundColor: isDark ? "#111215" : "#F8FAFC",
                borderColor: isDark ? "rgba(255,255,255,0.08)" : "#E2E8F0",
              },
            ]}
            onPress={() => {
              setShowComposeModal(false);
              const grp = conversations.find((c) => c.type === "group");
              if (grp) setActiveThread(grp);
            }}
          >
            <View
              style={[
                styles.avatarBox,
                {
                  backgroundColor: "#2563EB",
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                },
              ]}
            >
              <Ionicons name="home" size={18} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: isDark ? "#FFFFFF" : "#0F172A",
                }}
              >
                {householdInfo?.householdName || "Bills Group Chat"}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  color: isDark ? "#94A3B8" : "#64748B",
                }}
              >
                Household · All {householdMembers.length || 1} members
              </Text>
            </View>
            <Feather
              name="chevron-right"
              size={18}
              color={isDark ? "#64748B" : "#94A3B8"}
            />
          </TouchableOpacity>

          {/* Option: Real bills group members */}
          {billsGroupMembers.map((member) => {
            const memberUid = member.userId || member.memberId;
            const name =
              member.displayName ||
              member.name ||
              member.email?.split("@")[0] ||
              "Roommate";
            const initials = getInitials(name);
            const palette =
              AVATAR_PALETTES[
                Math.abs(hashString(memberUid)) % AVATAR_PALETTES.length
              ];
            const isHost =
              member.role === "HOST" || householdInfo?.hostId === memberUid;

            return (
              <TouchableOpacity
                key={memberUid}
                style={[
                  styles.composeRoommateRow,
                  {
                    backgroundColor: isDark ? "#111215" : "#F8FAFC",
                    borderColor: isDark ? "rgba(255,255,255,0.08)" : "#E2E8F0",
                  },
                ]}
                onPress={() => {
                  setShowComposeModal(false);
                  handleOpenDirectChatWithMember(member);
                }}
              >
                <View
                  style={[
                    styles.avatarBox,
                    {
                      backgroundColor: palette.bg,
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.avatarText,
                      { color: palette.text, fontSize: 13 },
                    ]}
                  >
                    {initials}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "700",
                      color: isDark ? "#FFFFFF" : "#0F172A",
                    }}
                  >
                    {name}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      color: isDark ? "#94A3B8" : "#64748B",
                    }}
                  >
                    {isHost ? "Host" : "Payor"} · Direct Message
                  </Text>
                </View>
                <Feather
                  name="chevron-right"
                  size={18}
                  color={isDark ? "#64748B" : "#94A3B8"}
                />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </SmoothBottomSheetModal>
    </View>
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
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerLeftRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 2,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  unreadPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  unreadPillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  composeButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  subtitleRow: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  subtitleText: {
    fontSize: 13,
    fontWeight: "500",
  },
  searchBarWrapper: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: "100%",
    fontSize: 13.5,
    fontWeight: "500",
    paddingVertical: 0,
    textAlignVertical: "center",
  },

  /* FACEBOOK MESSENGER STORY / THOUGHT NOTE TRAY */
  activeUsersSection: {
    marginBottom: 12,
  },
  activeUsersScrollContent: {
    paddingHorizontal: 18,
    gap: 14,
    alignItems: "flex-end",
  },
  storyCard: {
    alignItems: "center",
    width: 72,
  },
  thoughtBubblePlaceholder: {
    height: 22,
  },
  thoughtBubbleWrap: {
    position: "relative",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: 76,
    marginBottom: 3,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 3,
  },
  thoughtBubbleText: {
    fontSize: 10.5,
    fontWeight: "700",
    textAlign: "center",
  },
  thoughtDotSmall: {
    position: "absolute",
    bottom: -4,
    alignSelf: "center",
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1,
  },
  storyAvatarWrap: {
    position: "relative",
    width: 56,
    height: 56,
    marginBottom: 5,
  },
  storyAvatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  storyAvatarImage: {
    width: "100%",
    height: "100%",
  },
  storyAvatarText: {
    fontSize: 18,
    fontWeight: "900",
  },
  storyActiveDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: "#22C55E",
    borderWidth: 2.5,
  },
  storyPlusBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#2563EB",
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  storyNameText: {
    fontSize: 11.5,
    fontWeight: "600",
    textAlign: "center",
    maxWidth: 70,
  },
  noMembersHintWrap: {
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  noMembersHintText: {
    fontSize: 12,
    fontStyle: "italic",
  },

  /* FILTER PILLS */
  filtersWrapper: {
    marginBottom: 10,
  },
  filtersScrollContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterPillActive: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  filterPillInactive: {
    backgroundColor: "#FFFFFF",
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: "600",
  },
  filterPillTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  loadingWrapper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 8,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: "500",
  },

  /* SEAMLESS MESSENGER CONVERSATION ROWS */
  scrollList: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  messengerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    gap: 14,
  },
  messengerAvatarWrap: {
    position: "relative",
    width: 56,
    height: 56,
  },
  messengerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "900",
  },
  messengerAvatarText: {
    fontSize: 18,
    fontWeight: "900",
  },
  messengerOnlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: "#22C55E",
    borderWidth: 2.5,
  },
  messengerGroupBadge: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  messengerGroupBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#2563EB",
    includeFontPadding: false,
  },
  messengerContentCol: {
    flex: 1,
    gap: 3,
  },
  messengerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  messengerNameWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
    marginRight: 8,
  },
  messengerName: {
    fontSize: 15.5,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  messengerNameUnread: {
    fontWeight: "900",
  },
  messengerRoleText: {
    fontSize: 12,
    fontWeight: "500",
  },
  messengerTime: {
    fontSize: 11.5,
    fontWeight: "500",
  },
  messengerBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  messengerSnippet: {
    fontSize: 13,
    fontWeight: "400",
    flex: 1,
    lineHeight: 18,
  },
  messengerSnippetUnread: {
    fontWeight: "700",
  },
  messengerUnreadBlueDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#2563EB",
    marginLeft: 6,
  },
  quickConfirmReceiptBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  quickConfirmReceiptText: {
    fontSize: 10.5,
    fontWeight: "700",
  },

  /* FULL-SCREEN CHAT VIEW STYLES */
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  chatHeaderBackBtn: {
    padding: 6,
  },
  chatHeaderCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  chatHeaderAvatarWrap: {
    position: "relative",
  },
  chatHeaderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  chatHeaderOnlineDot: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#22C55E",
    borderWidth: 2,
  },
  chatHeaderTitleColumn: {
    flex: 1,
    gap: 1,
  },
  chatHeaderName: {
    fontSize: 15.5,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  chatHeaderStatus: {
    fontSize: 11.5,
    fontWeight: "600",
  },
  chatHeaderActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  chatScrollList: {
    flex: 1,
  },
  chatScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 12,
  },
  chatEmptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 10,
  },
  chatEmptyAvatarBig: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    overflow: "hidden",
  },
  chatEmptyAvatarText: {
    fontSize: 26,
    fontWeight: "900",
  },
  chatEmptyTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  chatEmptySubtitle: {
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 28,
    lineHeight: 19,
  },
  msgBubbleRow: {
    maxWidth: "80%",
  },
  msgRowMe: {
    alignSelf: "flex-end",
    alignItems: "flex-end",
  },
  msgRowThem: {
    alignSelf: "flex-start",
    alignItems: "flex-start",
  },
  msgThemContainer: {
    maxWidth: "85%",
    alignSelf: "flex-start",
    alignItems: "flex-start",
  },
  msgSenderName: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 4,
    marginLeft: 38,
  },
  msgThemRowWithAvatar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  msgAvatarWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginBottom: 2,
  },
  msgAvatarImage: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  msgAvatarInitials: {
    fontSize: 11,
    fontWeight: "700",
  },
  speechBubble: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    gap: 4,
  },
  speechBubbleMe: {
    backgroundColor: "#2563EB",
    borderBottomRightRadius: 4,
  },
  speechBubbleThem: {
    borderBottomLeftRadius: 4,
    flexShrink: 1,
  },
  speechBubbleText: {
    fontSize: 14,
    lineHeight: 19,
  },
  speechBubbleTextMe: {
    color: "#FFFFFF",
    fontWeight: "500",
  },
  speechBubbleTime: {
    fontSize: 9.5,
    alignSelf: "flex-end",
    marginTop: 2,
  },
  speechBubbleTimeMe: {
    color: "rgba(255,255,255,0.7)",
  },
  msgEmbedCard: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 5,
  },
  msgEmbedHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  msgEmbedCategory: {
    fontSize: 12,
    fontWeight: "800",
  },
  msgEmbedAmount: {
    fontSize: 12,
    fontWeight: "800",
    color: "#10B981",
  },
  msgEmbedShare: {
    fontSize: 10.5,
    marginTop: 2,
  },
  msgStatusRowMe: {
    marginTop: 3,
    marginBottom: 4,
    marginRight: 4,
    alignItems: "flex-end",
  },
  msgStatusRowThem: {
    marginTop: 3,
    marginBottom: 4,
    marginLeft: 42,
    alignItems: "flex-start",
  },
  msgStatusText: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "500",
  },
  msgStatusSeenBadge: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
  },

  /* GENEROUS SAFE PADDED BOTTOM CAPSULE INPUT */
  capsuleInputOuterContainer: {
    borderTopWidth: 1,
    paddingTop: 8,
    paddingHorizontal: 14,
  },
  capsuleInputInnerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  capsuleActionIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  capsuleTextInputWrapper: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  capsuleTextInput: {
    flex: 1,
    width: "100%",
    height: "100%",
    fontSize: 14,
    paddingVertical: 0,
    paddingHorizontal: 0,
    textAlignVertical: "center",
  },
  capsuleSendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },

  /* FAB & EMPTY WRAPS */
  fabWrapper: {
    position: "absolute",
    bottom: 24,
    right: 20,
  },
  requestSplitFab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#2563EB",
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 22,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  requestSplitFabText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 50,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  emptySubtitle: {
    fontSize: 12.5,
    textAlign: "center",
    paddingHorizontal: 20,
    lineHeight: 18,
  },

  /* NOTE PREVIEW & MODALS */
  notePreviewCenterWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 6,
  },
  notePreviewBubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1.5,
    maxWidth: 240,
    alignItems: "center",
  },
  notePreviewBubbleText: {
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  notePreviewAvatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: "#2563EB",
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  emojiPickerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  emojiButton: {
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    width: 40,
  },
  emojiButtonActive: {
    borderWidth: 2,
    borderColor: "#2563EB",
  },
  modalSecondaryBtn: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  /* MODALS FORM */
  inputLabel: {
    fontSize: 11.5,
    fontWeight: "700",
    marginTop: 4,
  },
  roommatePillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  roommatePill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  roommatePillActive: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  roommatePillInactive: {
    backgroundColor: "#F1F5F9",
  },
  roommatePillText: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  roommatePillTextActive: {
    color: "#FFFFFF",
  },
  modalTextInput: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  modalSubmitBtn: {
    backgroundColor: "#2563EB",
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  modalSubmitBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  composeRoommateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  avatarBox: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  /* =================================================== */
  /* AUTHENTIC FACEBOOK MESSENGER NOTE VIEWER MODAL STYLES */
  /* =================================================== */
  noteViewerModalOverlay: {
    flex: 1,
    justifyContent: "space-between",
  },
  noteViewerTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  noteViewerProfileHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  noteViewerThumbCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  noteViewerNameColumn: {
    flex: 1,
    gap: 1,
  },
  noteViewerHeaderName: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  noteViewerHeaderTime: {
    fontSize: 11.5,
    fontWeight: "500",
  },
  noteViewerTopBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  noteViewerIconBtn: {
    padding: 4,
  },

  /* Center Stage */
  noteViewerCenterSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  noteViewerThoughtWrap: {
    alignItems: "center",
    position: "relative",
    marginBottom: 6,
  },
  noteViewerYellowBubble: {
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 24,
    borderWidth: 1.5,
    maxWidth: 290,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  noteViewerYellowBubbleText: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 24,
  },
  noteViewerThoughtDotMedium: {
    position: "absolute",
    bottom: -6,
    left: "40%",
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  noteViewerThoughtDotSmall: {
    position: "absolute",
    bottom: -13,
    left: "45%",
    width: 7,
    height: 7,
    borderRadius: 3.5,
    borderWidth: 1,
  },
  noteViewerLargeAvatarCircle: {
    width: 146,
    height: 146,
    borderRadius: 73,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginTop: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  noteViewerLargeAvatarInitials: {
    fontSize: 48,
    fontWeight: "900",
  },

  /* Bottom Reaction & Reply Bar */
  noteViewerBottomContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  noteViewerReactionPillsScroll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 2,
  },
  noteViewerReactionPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  noteViewerInputBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  noteViewerActionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  noteViewerCapsuleInputWrapper: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  noteViewerCapsuleTextInput: {
    flex: 1,
    height: "100%",
    fontSize: 14,
    paddingVertical: 0,
    textAlignVertical: "center",
  },
  noteViewerQuickEmojiRightWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  noteViewerQuickEmojiBtn: {
    padding: 3,
  },
  noteViewerSendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
});
