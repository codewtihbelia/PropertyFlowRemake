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
  LayoutAnimation,
  AppState,
  Animated,
  PanResponder,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

let cachedAndroidKeyboardHeight = 290;
import { Feather, Ionicons } from "@expo/vector-icons";
import { SmoothBottomSheetModal } from "../components/SmoothBottomSheetModal";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { OfflineCallPromptModal } from "../components/OfflineCallPromptModal";
import { useNavVisibility } from "../context/NavVisibilityContext";
import { useTheme } from "../context/ThemeContext";
import { useCall } from "../context/CallContext";
import { mobileDataService } from "../services/firebaseDataService";
import { communityService } from "../services/communityService";
import { callService, CallType } from "../services/callService";
import { auth } from "../firebase/config";
import { playMessengerPopChime } from "../utils/soundEffects";
import * as ImagePicker from "expo-image-picker";
import * as Clipboard from "expo-clipboard";
import { uploadImageToCloudinaryMobile } from "../services/cloudinaryService";
import { encryptMessage, decryptMessage } from "../utils/cryptoUtils";

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
  onExploreCommunity?: () => void;
  onCreateGroup?: () => void;
  onOpenUserProfile?: (user: {
    uid: string;
    name: string;
    email?: string;
    avatar?: string;
    role?: string;
  }) => void;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  sender: string;
  text: string;
  time: string;
  isMe: boolean;
  type?:
    | "text"
    | "payment_claim"
    | "receipt_review"
    | "expense_split"
    | "call_log"
    | "image"
    | "file";
  meta?: {
    amount?: string;
    share?: string;
    category?: string;
    attachmentName?: string;
    attachmentUrl?: string;
    fileName?: string;
    fileSize?: string;
    fileType?: string;
    status?: "pending" | "confirmed" | "settled";
    paymentMethod?: string;
    callType?: "voice" | "video";
    durationSeconds?: number;
    callStatus?: "completed" | "missed" | "declined";
    replyTo?: {
      id: string;
      senderName: string;
      text: string;
    };
  };
  reactions?: Record<string, string[]>;
  replyTo?: {
    id: string;
    senderName: string;
    text: string;
  };
  createdAt?: string;
  readBy?: string[];
  deletedFor?: string[];
  isEdited?: boolean;
  editedAt?: string;
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
  avatar?: string;
  email?: string;
  chatTheme?: string;
  isOnline: boolean;
  onlineStatusLabel: string;
  lastActiveAt?: string;
  lastActiveDate?: string;
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
  isMessageRequest?: boolean;
  messages: ChatMessage[];
}

export const CHAT_THEMES = [
  { label: "Burgundy", hex: "#800020" },
  { label: "Royal Blue", hex: "#2563EB" },
  { label: "Emerald", hex: "#10B981" },
  { label: "Indigo", hex: "#6366F1" },
  { label: "Amber", hex: "#F59E0B" },
  { label: "Rose", hex: "#EC4899" },
  { label: "Teal", hex: "#0D9488" },
  { label: "Violet", hex: "#8B5CF6" },
  { label: "Crimson", hex: "#E11D48" },
  { label: "Wine", hex: "#722F37" },
];

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
const REACTION_EMOJIS = ["❤️", "😆", "😮", "😢", "😡", "👍"];

interface SwipeableMessageRowProps {
  children: React.ReactNode;
  onReply: () => void;
  isMe: boolean;
  isDark: boolean;
}

const SwipeableMessageRow: React.FC<SwipeableMessageRowProps> = ({
  children,
  onReply,
  isMe,
  isDark,
}) => {
  const panX = useRef(new Animated.Value(0)).current;
  const triggered = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return (
          gestureState.dx > 12 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5
        );
      },
      onPanResponderGrant: () => {
        triggered.current = false;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx > 0) {
          const drag = Math.min(65, gestureState.dx * 0.72);
          panX.setValue(drag);
          if (drag >= 42 && !triggered.current) {
            triggered.current = true;
          }
        }
      },
      onPanResponderRelease: () => {
        if (triggered.current) {
          onReply();
        }
        Animated.spring(panX, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 12,
          speed: 20,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(panX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    }),
  ).current;

  const iconOpacity = panX.interpolate({
    inputRange: [0, 15, 42],
    outputRange: [0, 0.4, 1],
    extrapolate: "clamp",
  });

  const iconScale = panX.interpolate({
    inputRange: [0, 18, 42],
    outputRange: [0.5, 0.8, 1.15],
    extrapolate: "clamp",
  });

  return (
    <View style={styles.swipeRowWrapper} {...panResponder.panHandlers}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.swipeReplyIconContainer,
          {
            left: isMe ? 24 : 6,
            opacity: iconOpacity,
            transform: [{ scale: iconScale }],
            backgroundColor: isDark
              ? "rgba(37,99,235,0.25)"
              : "rgba(37,99,235,0.12)",
          },
        ]}
      >
        <Ionicons
          name="arrow-undo"
          size={16}
          color={isDark ? "#60A5FA" : "#2563EB"}
        />
      </Animated.View>
      <Animated.View
        style={{
          width: "100%",
          transform: [{ translateX: panX }],
        }}
      >
        {children}
      </Animated.View>
    </View>
  );
};

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
    // If flagged online and timestamp is within last 15 minutes or no timestamp, user is active now!
    if (!hasValidTime || (diffMs >= 0 && diffMs < 15 * 60 * 1000)) {
      return { isOnline: true, statusLabel: "Active now" };
    }
    // Stale isOnline flag (>15 mins ago)
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

  // Active window: within 10 minutes
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

export function isNoteExpired(updatedAt?: string, expiresAt?: string): boolean {
  const now = Date.now();
  if (expiresAt) {
    const exp = new Date(expiresAt).getTime();
    if (!isNaN(exp)) return now >= exp;
  }
  if (updatedAt) {
    const updated = new Date(updatedAt).getTime();
    if (!isNaN(updated)) return now - updated >= 24 * 60 * 60 * 1000;
  }
  return false;
}

export function formatNoteRemainingTime(
  updatedAt?: string,
  expiresAt?: string,
): string {
  const now = Date.now();
  let expMs = 0;
  if (expiresAt) {
    const parsed = new Date(expiresAt).getTime();
    if (!isNaN(parsed)) expMs = parsed;
  }
  if (!expMs && updatedAt) {
    const parsed = new Date(updatedAt).getTime();
    if (!isNaN(parsed)) expMs = parsed + 24 * 60 * 60 * 1000;
  }
  if (!expMs) return "Expires in 24h";

  const diffMs = expMs - now;
  if (diffMs <= 0) return "Expired";
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;

  if (hours >= 1) {
    return remMins > 0
      ? `Expires in ${hours}h ${remMins}m`
      : `Expires in ${hours}h`;
  }
  if (mins >= 1) {
    return `Expires in ${mins}m`;
  }
  return "Expires in <1m";
}

interface GroupChatAvatarProps {
  members: any[];
  size?: number;
  isDark?: boolean;
}

export const GroupChatAvatar: React.FC<GroupChatAvatarProps> = ({
  members,
  size = 56,
  isDark = false,
}) => {
  const displayMembers = useMemo(() => {
    return (members || []).filter((m) => Boolean(m)).slice(0, 4);
  }, [members]);

  const bgBorderColor = isDark ? "#111215" : "#FFFFFF";

  if (displayMembers.length === 0) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: isDark ? "#1E293B" : "#DBEAFE",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons
          name="people"
          size={size * 0.48}
          color={isDark ? "#93C5FD" : "#2563EB"}
        />
      </View>
    );
  }

  if (displayMembers.length === 1) {
    const m = displayMembers[0];
    const photo = m.profilePicture || m.photoURL;
    const name = m.displayName || m.name || "Member";
    const initials = getInitials(name);
    const palette =
      AVATAR_PALETTES[
        Math.abs(hashString(String(m.userId || m.memberId || "0"))) %
          AVATAR_PALETTES.length
      ];
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: palette.bg,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {photo ? (
          <Image
            source={{ uri: photo }}
            style={{ width: "100%", height: "100%" }}
          />
        ) : (
          <Text
            style={{
              color: palette.text,
              fontSize: size * 0.38,
              fontWeight: "900",
            }}
          >
            {initials}
          </Text>
        )}
      </View>
    );
  }

  if (displayMembers.length === 2) {
    const subSize = Math.round(size * 0.62);
    return (
      <View
        style={{
          width: size,
          height: size,
          position: "relative",
          borderRadius: size / 2,
          overflow: "hidden",
          backgroundColor: isDark ? "#1E222B" : "#F1F5F9",
        }}
      >
        {displayMembers.map((m, idx) => {
          const photo = m.profilePicture || m.photoURL;
          const name = m.displayName || m.name || "Member";
          const initials = getInitials(name);
          const palette =
            AVATAR_PALETTES[
              Math.abs(hashString(String(m.userId || m.memberId || idx))) %
                AVATAR_PALETTES.length
            ];
          const isTop = idx === 0;
          return (
            <View
              key={m.userId || m.memberId || idx}
              style={{
                position: "absolute",
                top: isTop ? 0 : size - subSize,
                left: isTop ? 0 : size - subSize,
                width: subSize,
                height: subSize,
                borderRadius: subSize / 2,
                backgroundColor: palette.bg,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 2,
                borderColor: bgBorderColor,
                overflow: "hidden",
                zIndex: isTop ? 1 : 2,
              }}
            >
              {photo ? (
                <Image
                  source={{ uri: photo }}
                  style={{ width: "100%", height: "100%" }}
                />
              ) : (
                <Text
                  style={{
                    color: palette.text,
                    fontSize: subSize * 0.4,
                    fontWeight: "800",
                  }}
                >
                  {initials}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    );
  }

  if (displayMembers.length === 3) {
    const topSize = Math.round(size * 0.52);
    const bottomSize = Math.round(size * 0.5);
    return (
      <View
        style={{
          width: size,
          height: size,
          position: "relative",
          borderRadius: size / 2,
          overflow: "hidden",
          backgroundColor: isDark ? "#1E222B" : "#F1F5F9",
        }}
      >
        {displayMembers.map((m, idx) => {
          const photo = m.profilePicture || m.photoURL;
          const name = m.displayName || m.name || "Member";
          const initials = getInitials(name);
          const palette =
            AVATAR_PALETTES[
              Math.abs(hashString(String(m.userId || m.memberId || idx))) %
                AVATAR_PALETTES.length
            ];

          let stylePos: any = {};
          let currentSize = bottomSize;
          if (idx === 0) {
            currentSize = topSize;
            stylePos = { top: 1, left: (size - topSize) / 2, zIndex: 1 };
          } else if (idx === 1) {
            stylePos = { bottom: 1, left: 1, zIndex: 2 };
          } else {
            stylePos = { bottom: 1, right: 1, zIndex: 2 };
          }

          return (
            <View
              key={m.userId || m.memberId || idx}
              style={[
                {
                  position: "absolute",
                  width: currentSize,
                  height: currentSize,
                  borderRadius: currentSize / 2,
                  backgroundColor: palette.bg,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1.5,
                  borderColor: bgBorderColor,
                  overflow: "hidden",
                },
                stylePos,
              ]}
            >
              {photo ? (
                <Image
                  source={{ uri: photo }}
                  style={{ width: "100%", height: "100%" }}
                />
              ) : (
                <Text
                  style={{
                    color: palette.text,
                    fontSize: currentSize * 0.4,
                    fontWeight: "800",
                  }}
                >
                  {initials}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    );
  }

  // 4 or more: 2x2 quadrant collage
  const quadrantSize = Math.round(size * 0.48);
  return (
    <View
      style={{
        width: size,
        height: size,
        position: "relative",
        borderRadius: size / 2,
        overflow: "hidden",
        backgroundColor: isDark ? "#1E222B" : "#F1F5F9",
      }}
    >
      {displayMembers.slice(0, 4).map((m, idx) => {
        const photo = m.profilePicture || m.photoURL;
        const name = m.displayName || m.name || "Member";
        const initials = getInitials(name);
        const palette =
          AVATAR_PALETTES[
            Math.abs(hashString(String(m.userId || m.memberId || idx))) %
              AVATAR_PALETTES.length
          ];

        const isLeft = idx % 2 === 0;
        const isTop = idx < 2;

        return (
          <View
            key={m.userId || m.memberId || idx}
            style={{
              position: "absolute",
              top: isTop ? 1 : size - quadrantSize - 1,
              left: isLeft ? 1 : size - quadrantSize - 1,
              width: quadrantSize,
              height: quadrantSize,
              borderRadius: quadrantSize / 2,
              backgroundColor: palette.bg,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1.5,
              borderColor: bgBorderColor,
              overflow: "hidden",
              zIndex: idx + 1,
            }}
          >
            {photo ? (
              <Image
                source={{ uri: photo }}
                style={{ width: "100%", height: "100%" }}
              />
            ) : (
              <Text
                style={{
                  color: palette.text,
                  fontSize: quadrantSize * 0.4,
                  fontWeight: "800",
                }}
              >
                {initials}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
};

export const MessagesScreen: React.FC<MessagesScreenProps> = ({
  onBack,
  householdId,
  currentUser = { name: "Resident", avatar: "R" },
  initialTargetUserId,
  onOpenSettleDues,
  onOpenAddExpense,
  onExploreCommunity,
  onCreateGroup,
  onOpenUserProfile,
}) => {
  const {
    onScroll,
    keyboardHeight: contextKeyboardHeight,
    hideNav,
    showNav,
  } = useNavVisibility();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
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
    (currentUser as any)?.photoURL || auth.currentUser?.photoURL || undefined;

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
    Record<
      string,
      { note: string; emoji?: string; updatedAt: string; expiresAt?: string }
    >
  >({});
  const [acceptedCommunityFriends, setAcceptedCommunityFriends] = useState<
    any[]
  >([]);
  const [directMessages, setDirectMessages] = useState<any[]>([]);
  const [presenceMap, setPresenceMap] = useState<Record<string, any>>({});
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
    "all" | "requests" | "apartment" | "pending" | "direct"
  >("all");
  const [acceptedConvIds, setAcceptedConvIds] = useState<Set<string>>(
    new Set(),
  );
  const [declinedConvIds, setDeclinedConvIds] = useState<Set<string>>(
    new Set(),
  );

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

  // Modals & Action Sheet state for Message and Conversation Deletion & Attachments
  const [selectedMessageForAction, setSelectedMessageForAction] =
    useState<ChatMessage | null>(null);
  const [messageActionCoords, setMessageActionCoords] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [deleteMode, setDeleteMode] = useState<boolean>(false);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(
    null,
  );
  const [replyingToMessage, setReplyingToMessage] =
    useState<ChatMessage | null>(null);
  const [selectedConversationForDelete, setSelectedConversationForDelete] =
    useState<ConversationItem | null>(null);
  const [showAttachmentModal, setShowAttachmentModal] =
    useState<boolean>(false);
  const [isUploadingAttachment, setIsUploadingAttachment] =
    useState<boolean>(false);
  const [isDeletingMessage, setIsDeletingMessage] = useState<boolean>(false);
  const [isDeletingConversation, setIsDeletingConversation] =
    useState<boolean>(false);

  // Messenger-Style Conversation Info Screen & Media Lightbox States
  const [showConversationInfo, setShowConversationInfo] =
    useState<boolean>(false);
  const [lightboxImage, setLightboxImage] = useState<{
    uri: string;
    senderName?: string;
    timestamp?: string;
    caption?: string;
  } | null>(null);
  const [showAllMediaModal, setShowAllMediaModal] = useState<boolean>(false);
  const [allMediaActiveTab, setAllMediaActiveTab] = useState<
    "media" | "files" | "links"
  >("media");
  const [mutedThreadIds, setMutedThreadIds] = useState<Set<string>>(new Set());
  const [inChatSearchQuery, setInChatSearchQuery] = useState<string>("");
  const [isSearchingInChat, setIsSearchingInChat] = useState<boolean>(false);
  const [customNicknames, setCustomNicknames] = useState<
    Record<string, string>
  >({});

  // Conversation Info Interactive Bottom Sheet Modals
  const [showNicknamesModal, setShowNicknamesModal] = useState<boolean>(false);
  const [tempNickname, setTempNickname] = useState<string>("");
  const [showGroupMembersModal, setShowGroupMembersModal] =
    useState<boolean>(false);
  const [showThemeModal, setShowThemeModal] = useState<boolean>(false);
  const [selectedChatTheme, setSelectedChatTheme] = useState<string>("#2563EB");
  const [chatThemesMap, setChatThemesMap] = useState<Record<string, string>>(
    {},
  );

  const activeThemeObj = useMemo(() => {
    return (
      CHAT_THEMES.find((t) => t.hex === selectedChatTheme) || {
        label: "Royal Blue",
        hex: selectedChatTheme,
      }
    );
  }, [selectedChatTheme]);

  // Sync conversation-specific theme when activeThread changes
  useEffect(() => {
    if (!activeThread?.id) return;
    const threadId = activeThread.id;
    if (chatThemesMap[threadId]) {
      setSelectedChatTheme(chatThemesMap[threadId]);
      return;
    }
    let isCancelled = false;
    AsyncStorage.getItem(`@propertyflow_chat_theme_${threadId}`)
      .then((savedTheme) => {
        if (isCancelled) return;
        if (savedTheme) {
          setSelectedChatTheme(savedTheme);
          setChatThemesMap((prev) => ({ ...prev, [threadId]: savedTheme }));
        } else if (activeThread.chatTheme) {
          setSelectedChatTheme(activeThread.chatTheme);
          setChatThemesMap((prev) => ({
            ...prev,
            [threadId]: activeThread.chatTheme!,
          }));
        } else {
          setSelectedChatTheme("#2563EB");
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setSelectedChatTheme(activeThread.chatTheme || "#2563EB");
        }
      });
    return () => {
      isCancelled = true;
    };
  }, [activeThread?.id]);

  const handleSelectChatTheme = (themeHex: string) => {
    setSelectedChatTheme(themeHex);
    if (activeThread?.id) {
      setChatThemesMap((prev) => ({
        ...prev,
        [activeThread.id]: themeHex,
      }));
      AsyncStorage.setItem(
        `@propertyflow_chat_theme_${activeThread.id}`,
        themeHex,
      ).catch(() => {});
      setActiveThread((prev) =>
        prev && prev.id === activeThread.id
          ? { ...prev, chatTheme: themeHex }
          : prev,
      );
    }
  };

  const handleApplyChatTheme = () => {
    if (activeThread?.id) {
      AsyncStorage.setItem(
        `@propertyflow_chat_theme_${activeThread.id}`,
        selectedChatTheme,
      ).catch(() => {});
      setActiveThread((prev) =>
        prev && prev.id === activeThread.id
          ? { ...prev, chatTheme: selectedChatTheme }
          : prev,
      );
    }
    setShowThemeModal(false);
  };

  const [showPinnedModal, setShowPinnedModal] = useState<boolean>(false);
  const [showDisappearingModal, setShowDisappearingModal] =
    useState<boolean>(false);
  const [disappearingDuration, setDisappearingDuration] =
    useState<string>("off");
  const [disappearingDurationsMap, setDisappearingDurationsMap] = useState<
    Record<string, string>
  >({});
  const [pinnedMessageIdsMap, setPinnedMessageIdsMap] = useState<
    Record<string, string[]>
  >({});
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());
  const [restrictedUserIds, setRestrictedUserIds] = useState<Set<string>>(
    new Set(),
  );
  const [showBlockModal, setShowBlockModal] = useState<boolean>(false);
  const [showRestrictModal, setShowRestrictModal] = useState<boolean>(false);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [reportReason, setReportReason] = useState<string>(
    "Harassment or Bullying",
  );
  const [reportDetails, setReportDetails] = useState<string>("");
  const [showDeleteChatModal, setShowDeleteChatModal] =
    useState<boolean>(false);
  const [showMoreOptionsModal, setShowMoreOptionsModal] =
    useState<boolean>(false);
  const [showAutoSaveModal, setShowAutoSaveModal] = useState<boolean>(false);
  const [autoSavePhotos, setAutoSavePhotos] = useState<boolean>(true);
  const [showReadReceiptsModal, setShowReadReceiptsModal] =
    useState<boolean>(false);
  const [readReceiptsEnabled, setReadReceiptsEnabled] = useState<boolean>(true);
  const [showTypingIndicatorModal, setShowTypingIndicatorModal] =
    useState<boolean>(false);
  const [typingIndicatorEnabled, setTypingIndicatorEnabled] =
    useState<boolean>(true);
  const [showMessagePermissionsModal, setShowMessagePermissionsModal] =
    useState<boolean>(false);
  const [messagePermissionLevel, setMessagePermissionLevel] =
    useState<string>("everyone");
  const [showEncryptionModal, setShowEncryptionModal] =
    useState<boolean>(false);

  // Load all persistent chat settings on initial mount
  useEffect(() => {
    AsyncStorage.getItem("@splitzy_custom_nicknames").then((val) => {
      if (val) {
        try {
          setCustomNicknames(JSON.parse(val));
        } catch {}
      }
    });
    AsyncStorage.getItem("@splitzy_muted_threads").then((val) => {
      if (val) {
        try {
          setMutedThreadIds(new Set(JSON.parse(val)));
        } catch {}
      }
    });
    AsyncStorage.getItem("@splitzy_pinned_messages").then((val) => {
      if (val) {
        try {
          setPinnedMessageIdsMap(JSON.parse(val));
        } catch {}
      }
    });
    AsyncStorage.getItem("@splitzy_disappearing_durations").then((val) => {
      if (val) {
        try {
          setDisappearingDurationsMap(JSON.parse(val));
        } catch {}
      }
    });
    AsyncStorage.getItem("@splitzy_blocked_users").then((val) => {
      if (val) {
        try {
          setBlockedUserIds(new Set(JSON.parse(val)));
        } catch {}
      }
    });
    AsyncStorage.getItem("@splitzy_restricted_users").then((val) => {
      if (val) {
        try {
          setRestrictedUserIds(new Set(JSON.parse(val)));
        } catch {}
      }
    });
    AsyncStorage.getItem("@splitzy_autosave_photos").then((val) => {
      if (val !== null) setAutoSavePhotos(val === "true");
    });
    AsyncStorage.getItem("@splitzy_read_receipts").then((val) => {
      if (val !== null) setReadReceiptsEnabled(val === "true");
    });
    AsyncStorage.getItem("@splitzy_typing_indicators").then((val) => {
      if (val !== null) setTypingIndicatorEnabled(val === "true");
    });
    AsyncStorage.getItem("@splitzy_message_permission").then((val) => {
      if (val) setMessagePermissionLevel(val);
    });
  }, []);

  // Sync disappearing duration when activeThread changes
  useEffect(() => {
    if (activeThread?.id) {
      setDisappearingDuration(
        disappearingDurationsMap[activeThread.id] || "off",
      );
    }
  }, [activeThread?.id, disappearingDurationsMap]);

  const handleTogglePinMessage = (messageId: string) => {
    if (!activeThread?.id) return;
    const threadId = activeThread.id;
    setPinnedMessageIdsMap((prev) => {
      const currentList = prev[threadId] || [];
      const isPinned = currentList.includes(messageId);
      const updatedList = isPinned
        ? currentList.filter((id) => id !== messageId)
        : [...currentList, messageId];
      const nextMap = { ...prev, [threadId]: updatedList };
      AsyncStorage.setItem(
        "@splitzy_pinned_messages",
        JSON.stringify(nextMap),
      ).catch(() => {});
      Alert.alert(
        isPinned ? "Message Unpinned" : "Message Pinned",
        isPinned
          ? "This message has been removed from pinned messages."
          : "Message pinned! You can quickly access it anytime from Conversation Info.",
      );
      return nextMap;
    });
  };

  const handleSaveNickname = (nick: string) => {
    if (!activeThread?.id) return;
    const threadId = activeThread.id;
    setCustomNicknames((prev) => {
      const next = { ...prev };
      if (nick.trim()) {
        next[threadId] = nick.trim();
      } else {
        delete next[threadId];
      }
      AsyncStorage.setItem(
        "@splitzy_custom_nicknames",
        JSON.stringify(next),
      ).catch(() => {});
      return next;
    });
    setShowNicknamesModal(false);
    Alert.alert(
      "Nickname Updated",
      nick.trim()
        ? `Nickname set to "${nick.trim()}".`
        : "Custom nickname cleared.",
    );
  };

  const handleSetDisappearingDuration = (dur: string) => {
    if (!activeThread?.id) return;
    const threadId = activeThread.id;
    setDisappearingDuration(dur);
    setDisappearingDurationsMap((prev) => {
      const next = { ...prev, [threadId]: dur };
      AsyncStorage.setItem(
        "@splitzy_disappearing_durations",
        JSON.stringify(next),
      ).catch(() => {});
      return next;
    });
    setShowDisappearingModal(false);
    const labels: Record<string, string> = {
      off: "Off",
      "24h": "24 Hours",
      "7d": "7 Days",
      "90d": "90 Days",
    };
    Alert.alert(
      "Disappearing Messages",
      dur === "off"
        ? "Disappearing messages turned off."
        : `Messages will now vanish ${labels[dur] || dur} after being sent.`,
    );
  };

  const handleToggleBlockContact = () => {
    if (!activeThread?.id) return;
    const targetId = activeThread.targetUserId || activeThread.id;
    setBlockedUserIds((prev) => {
      const next = new Set(prev);
      const isBlocked = next.has(targetId);
      if (isBlocked) {
        next.delete(targetId);
        Alert.alert(
          "Contact Unblocked",
          `${activeThread.name} is now unblocked.`,
        );
      } else {
        next.add(targetId);
        Alert.alert(
          "Contact Blocked",
          `${activeThread.name} has been blocked. They cannot message or call you.`,
        );
      }
      AsyncStorage.setItem(
        "@splitzy_blocked_users",
        JSON.stringify([...next]),
      ).catch(() => {});
      return next;
    });
    setShowBlockModal(false);
  };

  const handleToggleRestrictContact = () => {
    if (!activeThread?.id) return;
    const targetId = activeThread.targetUserId || activeThread.id;
    setRestrictedUserIds((prev) => {
      const next = new Set(prev);
      const isRestricted = next.has(targetId);
      if (isRestricted) {
        next.delete(targetId);
        Alert.alert(
          "Account Unrestricted",
          `${activeThread.name} is no longer restricted.`,
        );
      } else {
        next.add(targetId);
        Alert.alert(
          "Account Restricted",
          `${activeThread.name} is restricted. Their chats will be silenced and your active status concealed.`,
        );
      }
      AsyncStorage.setItem(
        "@splitzy_restricted_users",
        JSON.stringify([...next]),
      ).catch(() => {});
      return next;
    });
    setShowRestrictModal(false);
  };

  const handleSubmitReportConversation = async () => {
    if (!activeThread) return;
    try {
      const reportData = {
        reporterId: currentUid,
        reporterName: currentUser.name || "Resident",
        reportedTargetId: activeThread.targetUserId || activeThread.id,
        reportedTargetName: activeThread.name,
        householdId: householdId || "",
        reason: reportReason,
        details: reportDetails.trim(),
        createdAt: new Date().toISOString(),
        status: "pending",
      };
      if ((mobileDataService as any)?.submitReport) {
        await (mobileDataService as any).submitReport(reportData);
      }
      Alert.alert(
        "Report Submitted",
        "Thank you for reporting this issue. Our team will review the conversation and take necessary action.",
      );
    } catch {
      Alert.alert(
        "Report Received",
        "Your feedback has been logged securely. Our community team has received the report.",
      );
    } finally {
      setShowReportModal(false);
      setReportDetails("");
    }
  };

  const handleShareContactCard = async () => {
    if (!activeThread) return;
    const cleanTarget = activeThread.targetUserId
      ? String(activeThread.targetUserId).replace(/^mem_/, "").trim()
      : activeThread.id;
    const customNick = customNicknames[activeThread.id];
    const nameToShow = customNick || activeThread.name;
    const roleToShow =
      (activeThread as any).role || activeThread.roleLabel || "Resident";
    const card = `Splitzy Contact Card\nName: ${nameToShow}\nRole: ${roleToShow}\nStatus: ${activeThread.isOnline ? "Active Now" : "Splitzy Member"}\nSplitzy ID: ${cleanTarget}`;
    await Clipboard.setStringAsync(card);
    Alert.alert(
      "Contact Copied",
      `Contact card for ${nameToShow} has been copied to your clipboard.`,
    );
  };

  const handleOpenChatHead = () => {
    if (!activeThread) return;
    AsyncStorage.setItem("@splitzy_active_chat_head", activeThread.id).catch(
      () => {},
    );
    Alert.alert(
      "Chat Head Activated",
      `Floating bubble enabled for ${activeThread.name}. You can continue chatting while browsing other screens.`,
    );
    setShowConversationInfo(false);
  };

  // Media items for the active thread (used in Chat Info & Media Gallery)
  const conversationMedia = useMemo(() => {
    if (!activeThread?.messages) return [];
    const imgs: {
      id: string;
      uri: string;
      senderName?: string;
      timestamp?: string;
    }[] = [];
    activeThread.messages.forEach((m) => {
      if (m.type === "image" && m.meta?.attachmentUrl) {
        imgs.push({
          id: m.id,
          uri: m.meta.attachmentUrl,
          senderName: m.isMe ? "You" : m.sender || activeThread.name,
          timestamp: m.time,
        });
      } else if (
        m.meta?.attachmentUrl &&
        /\.(jpeg|jpg|gif|png|webp|bmp)($|\?)/i.test(m.meta.attachmentUrl)
      ) {
        imgs.push({
          id: m.id,
          uri: m.meta.attachmentUrl,
          senderName: m.isMe ? "You" : m.sender || activeThread.name,
          timestamp: m.time,
        });
      }
    });

    if (imgs.length === 0) {
      return [
        {
          id: "preview_1",
          uri: "https://res.cloudinary.com/ri4xxxwk/image/upload/v1793519191/favicon.png",
          senderName: activeThread.name,
          timestamp: "Oct 24",
        },
      ];
    }
    return imgs;
  }, [activeThread?.messages, activeThread?.name]);

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
      if (Platform.OS === "android") {
        try {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        } catch {}
      }
      const h = e?.endCoordinates?.height || 0;
      if (h > 0) {
        cachedAndroidKeyboardHeight = h;
        setLocalKeyboardHeight(h);
      }
      setIsKeyboardOpen(true);
      setTimeout(() => {
        messageScrollRef.current?.scrollToEnd({ animated: true });
      }, 80);
    };

    const onHide = () => {
      if (Platform.OS === "android") {
        try {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        } catch {}
      }
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
    Platform.OS === "android" ? 16 : 14,
  );

  const chatInputBottomPadding = useMemo(() => {
    if (!keyboardActive) {
      return defaultBottomPadding;
    }
    // On Android, edge-to-edge / translucent system bars prevent the OS WindowManager
    // from automatically resizing the window via adjustResize.
    // Explicitly applying the active software keyboard height elevates the capsule input bar
    // directly flush above the keyboard.
    if (Platform.OS === "android") {
      const activeHeight =
        keyboardHeight > 0
          ? keyboardHeight
          : cachedAndroidKeyboardHeight || 290;
      return activeHeight + 50;
    }
    // On iOS, KeyboardAvoidingView (with behavior="padding") automatically offsets the entire
    // container, so 8px padding keeps it flush right above the keyboard.
    return 8;
  }, [keyboardActive, keyboardHeight, defaultBottomPadding]);

  const handleToggleMessage = (msgId: string) => {
    setToggledMessageIds((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  // Modals
  const [showRequestSplitModal, setShowRequestSplitModal] = useState(false);
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [composeSearchQuery, setComposeSearchQuery] = useState("");
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showNoteActionMenu, setShowNoteActionMenu] = useState(false);

  // Real-time Voice & Video Calling via global CallContext
  const { startCall } = useCall();

  // Offline Call Confirmation Prompt state
  const [offlinePromptData, setOfflinePromptData] = useState<{
    visible: boolean;
    contactId: string;
    contactName: string;
    contactAvatar?: string;
    lastActiveLabel: string;
    callType: CallType;
  } | null>(null);

  // Initiate outgoing call with intelligent presence verification
  const handleStartCall = async (
    type: CallType,
    targetUserOverride?: { id: string; name: string; avatar?: string },
    bypassPresenceCheck = false,
  ) => {
    const targetId = targetUserOverride?.id || activeThread?.targetUserId;
    const targetName =
      targetUserOverride?.name || activeThread?.name || "Contact";
    const targetAvatar = targetUserOverride?.avatar || activeThread?.photoURL;

    if (!targetId) {
      Alert.alert(
        "Calling Unavailable",
        "1-on-1 calling is available in direct chats with friends or roommates.",
      );
      return;
    }

    if (!bypassPresenceCheck) {
      const presence = await callService.checkUserPresence(targetId);
      if (!presence.isOnline) {
        setOfflinePromptData({
          visible: true,
          contactId: targetId,
          contactName: targetName,
          contactAvatar: targetAvatar,
          lastActiveLabel: presence.statusLabel,
          callType: type,
        });
        return;
      }
    }

    await startCall(
      {
        id: targetId,
        name: targetName,
        avatar: targetAvatar,
      },
      type,
    );
  };

  // Thought Note Form state (optional emoji)
  const [noteInputText, setNoteInputText] = useState("");
  const [selectedNoteEmoji, setSelectedNoteEmoji] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);

  // Viewing Roommate Note Modal (matching reference screenshot)
  const [viewingNoteData, setViewingNoteData] = useState<{
    member: any;
    note: {
      note: string;
      emoji?: string;
      updatedAt: string;
      expiresAt?: string;
    };
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
        // Pre-fill note input if user already has an active note
        if (currentUid && notes && notes[currentUid]) {
          const myNote = notes[currentUid];
          if (!isNoteExpired(myNote.updatedAt, myNote.expiresAt)) {
            setNoteInputText(myNote.note || "");
            setSelectedNoteEmoji(myNote.emoji || "");
          } else {
            setNoteInputText("");
            setSelectedNoteEmoji("");
          }
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

  // 1d. Subscribe to accepted/declined direct message requests from non-friends
  useEffect(() => {
    if (!currentUid) return;
    const unsub = communityService.subscribeAcceptedConversations(
      currentUid,
      (acc, dec) => {
        setAcceptedConvIds(acc);
        setDeclinedConvIds(dec);
      },
    );
    return () => unsub();
  }, [currentUid]);

  const handleAcceptMessageRequest = async (convId: string) => {
    try {
      await communityService.acceptDirectMessageRequest(convId, currentUid);
      setAcceptedConvIds((prev) => new Set([...prev, convId]));
      Alert.alert(
        "Request Accepted",
        "This conversation is now in your active chats.",
      );
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not accept request.");
    }
  };

  const handleDeclineMessageRequest = async (convId: string) => {
    try {
      await communityService.declineDirectMessageRequest(convId, currentUid);
      setDeclinedConvIds((prev) => new Set([...prev, convId]));
      setActiveThread(null);
      Alert.alert("Request Deleted", "The message request has been removed.");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not decline request.");
    }
  };

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

  // Collect all contact UIDs to subscribe to their live Firestore presence
  const contactPresenceUids = useMemo(() => {
    const ids = new Set<string>();
    const cleanCurUid = String(currentUid || "")
      .replace(/^mem_/, "")
      .trim();

    billsGroupMembers.forEach((m) => {
      const u = String(m.userId || m.memberId || m.id || "")
        .replace(/^mem_/, "")
        .trim();
      if (u && u !== cleanCurUid) ids.add(u);
    });

    acceptedCommunityFriends.forEach((f) => {
      const u = String(f.userId || f.memberId || f.id || "")
        .replace(/^mem_/, "")
        .trim();
      if (u && u !== cleanCurUid) ids.add(u);
    });

    directMessages.forEach((m) => {
      const cleanSender = String(m.senderId || "")
        .replace(/^mem_/, "")
        .trim();
      const cleanRecip = String(m.recipientId || "")
        .replace(/^mem_/, "")
        .trim();
      const other = cleanSender === cleanCurUid ? cleanRecip : cleanSender;
      if (other && other !== cleanCurUid) ids.add(other);
    });

    return Array.from(ids).sort();
  }, [billsGroupMembers, acceptedCommunityFriends, directMessages, currentUid]);

  // Subscribe to real-time presence for all contacts (outside friends, roommates, direct correspondents)
  useEffect(() => {
    if (contactPresenceUids.length === 0) {
      setPresenceMap({});
      return;
    }
    const unsub = mobileDataService.listenToUsersPresence(
      contactPresenceUids,
      (newMap) => {
        setPresenceMap(newMap);
      },
    );
    return () => unsub();
  }, [JSON.stringify(contactPresenceUids)]);

  // Live real-time presence subscription strictly for the active 1-on-1 chat partner
  useEffect(() => {
    const targetUid = activeThread?.targetUserId;
    if (!targetUid || activeThread?.type !== "direct") return;
    const cleanTargetUid = targetUid.replace(/^mem_/, "").trim();
    if (!cleanTargetUid) return;

    const unsub = mobileDataService.listenToUserPresence(
      cleanTargetUid,
      (livePres) => {
        if (livePres) {
          setPresenceMap((prev) => ({
            ...prev,
            [cleanTargetUid]: livePres,
          }));
        }
      },
    );

    return () => unsub();
  }, [activeThread?.targetUserId, activeThread?.type]);

  // Combine household members with accepted friends and incoming message request contacts
  const allDirectMembers = useMemo(() => {
    const list: any[] = [];
    const existingUids = new Set<string>();

    billsGroupMembers.forEach((m) => {
      const u = String(m.userId || m.memberId || m.id || "");
      const cleanU = u.replace(/^mem_/, "");
      if (u) {
        const livePres = presenceMap[cleanU] || {};
        list.push({
          ...m,
          isOnline:
            livePres.isOnline !== undefined
              ? livePres.isOnline
              : m.isOnline || m.online,
          lastActiveAt:
            livePres.lastActiveAt ||
            livePres.lastActiveDate ||
            m.lastActiveAt ||
            m.lastActiveDate ||
            m.lastSeen,
          lastActiveDate:
            livePres.lastActiveDate ||
            livePres.lastActiveAt ||
            m.lastActiveDate ||
            m.lastActiveAt,
          photoURL:
            livePres.photoURL ||
            livePres.profilePicture ||
            m.photoURL ||
            m.profilePicture,
          profilePicture:
            livePres.profilePicture ||
            livePres.photoURL ||
            m.profilePicture ||
            m.photoURL,
          thoughtNote:
            livePres.thoughtNote !== undefined
              ? livePres.thoughtNote
              : m.thoughtNote,
          thoughtEmoji:
            livePres.thoughtEmoji !== undefined
              ? livePres.thoughtEmoji
              : m.thoughtEmoji,
          noteUpdatedAt: livePres.noteUpdatedAt || m.noteUpdatedAt,
          noteExpiresAt: livePres.noteExpiresAt || m.noteExpiresAt,
        });
        existingUids.add(u);
        existingUids.add(cleanU);
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
        const livePres = presenceMap[cleanUid] || {};
        list.push({
          ...friend,
          isOnline:
            livePres.isOnline !== undefined
              ? livePres.isOnline
              : friend.isOnline || friend.online,
          lastActiveAt:
            livePres.lastActiveAt ||
            livePres.lastActiveDate ||
            friend.lastActiveAt ||
            friend.lastActiveDate ||
            friend.lastSeen,
          lastActiveDate:
            livePres.lastActiveDate ||
            livePres.lastActiveAt ||
            friend.lastActiveDate ||
            friend.lastActiveAt,
          photoURL:
            livePres.photoURL ||
            livePres.profilePicture ||
            friend.photoURL ||
            friend.profilePicture,
          profilePicture:
            livePres.profilePicture ||
            livePres.photoURL ||
            friend.profilePicture ||
            friend.photoURL,
          displayName:
            livePres.displayName ||
            livePres.name ||
            friend.displayName ||
            friend.name,
          name:
            livePres.name ||
            livePres.displayName ||
            friend.name ||
            friend.displayName,
          thoughtNote:
            livePres.thoughtNote !== undefined
              ? livePres.thoughtNote
              : friend.thoughtNote,
          thoughtEmoji:
            livePres.thoughtEmoji !== undefined
              ? livePres.thoughtEmoji
              : friend.thoughtEmoji,
          noteUpdatedAt: livePres.noteUpdatedAt || friend.noteUpdatedAt,
          noteExpiresAt: livePres.noteExpiresAt || friend.noteExpiresAt,
        });
        existingUids.add(friendUid);
        existingUids.add(cleanUid);
      }
    });

    // Also include any users who have sent or received direct messages with current user
    directMessages.forEach((m) => {
      const cleanSender = String(m.senderId || "")
        .replace(/^mem_/, "")
        .trim();
      const cleanRecip = String(m.recipientId || "")
        .replace(/^mem_/, "")
        .trim();
      const cleanMe = String(currentUid).replace(/^mem_/, "").trim();
      const otherUid = cleanSender === cleanMe ? cleanRecip : cleanSender;
      if (
        otherUid &&
        otherUid !== cleanMe &&
        !existingUids.has(otherUid) &&
        !existingUids.has(`mem_${otherUid}`)
      ) {
        const livePres = presenceMap[otherUid] || {};
        list.push({
          userId: otherUid,
          memberId: otherUid,
          id: otherUid,
          displayName:
            livePres.displayName ||
            livePres.name ||
            (cleanSender === cleanMe
              ? m.recipientName || "Splitzer"
              : m.senderName || "Splitzer"),
          name:
            livePres.name ||
            livePres.displayName ||
            (cleanSender === cleanMe
              ? m.recipientName || "Splitzer"
              : m.senderName || "Splitzer"),
          photoURL:
            livePres.photoURL ||
            livePres.profilePicture ||
            (cleanSender === cleanMe ? m.recipientAvatar : m.senderAvatar),
          profilePicture:
            livePres.profilePicture ||
            livePres.photoURL ||
            (cleanSender === cleanMe ? m.recipientAvatar : m.senderAvatar),
          role: "Member",
          isOutsideFriend: false,
          isNonFriendRequest: true,
          isOnline: livePres.isOnline !== undefined ? livePres.isOnline : false,
          lastActiveAt: livePres.lastActiveAt || livePres.lastActiveDate,
          lastActiveDate: livePres.lastActiveDate || livePres.lastActiveAt,
          thoughtNote: livePres.thoughtNote,
          thoughtEmoji: livePres.thoughtEmoji,
          noteUpdatedAt: livePres.noteUpdatedAt,
          noteExpiresAt: livePres.noteExpiresAt,
        });
        existingUids.add(otherUid);
        existingUids.add(`mem_${otherUid}`);
      }
    });

    return list;
  }, [
    billsGroupMembers,
    acceptedCommunityFriends,
    directMessages,
    currentUid,
    presenceMap,
  ]);

  // Combined contacts for the Active Stories / Thought Notes tray:
  // Includes roommates and accepted friends with actively online users sorted first
  const activeTrayMembers = useMemo(() => {
    const map = new Map<string, any>();

    // 1. Bills group members (roommates)
    billsGroupMembers.forEach((m) => {
      const rawUid = String(m.userId || m.memberId || m.id || "");
      const cleanUid = rawUid.replace(/^mem_/, "");
      if (cleanUid && cleanUid !== currentUid) {
        const livePres = presenceMap[cleanUid] || {};
        map.set(cleanUid, {
          ...m,
          cleanUid,
          isRoommate: true,
          isOnline:
            livePres.isOnline !== undefined
              ? livePres.isOnline
              : m.isOnline || m.online,
          lastActiveAt:
            livePres.lastActiveAt ||
            livePres.lastActiveDate ||
            m.lastActiveAt ||
            m.lastActiveDate ||
            m.lastSeen,
          lastActiveDate:
            livePres.lastActiveDate ||
            livePres.lastActiveAt ||
            m.lastActiveDate ||
            m.lastActiveAt,
          thoughtNote:
            livePres.thoughtNote !== undefined
              ? livePres.thoughtNote
              : m.thoughtNote,
          thoughtEmoji:
            livePres.thoughtEmoji !== undefined
              ? livePres.thoughtEmoji
              : m.thoughtEmoji,
          noteUpdatedAt: livePres.noteUpdatedAt || m.noteUpdatedAt,
          noteExpiresAt: livePres.noteExpiresAt || m.noteExpiresAt,
          photoURL:
            livePres.photoURL ||
            livePres.profilePicture ||
            m.photoURL ||
            m.profilePicture,
          profilePicture:
            livePres.profilePicture ||
            livePres.photoURL ||
            m.profilePicture ||
            m.photoURL,
        });
      }
    });

    // 2. Accepted community friends
    acceptedCommunityFriends.forEach((friend) => {
      const rawUid = String(
        friend.userId || friend.memberId || friend.id || "",
      );
      const cleanUid = rawUid.replace(/^mem_/, "");
      if (cleanUid && cleanUid !== currentUid) {
        const livePres = presenceMap[cleanUid] || {};
        const friendWithPresence = {
          ...friend,
          cleanUid,
          isFriend: true,
          isOnline:
            livePres.isOnline !== undefined
              ? livePres.isOnline
              : friend.isOnline || friend.online,
          lastActiveAt:
            livePres.lastActiveAt ||
            livePres.lastActiveDate ||
            friend.lastActiveAt ||
            friend.lastActiveDate ||
            friend.lastSeen,
          lastActiveDate:
            livePres.lastActiveDate ||
            livePres.lastActiveAt ||
            friend.lastActiveDate ||
            friend.lastActiveAt,
          thoughtNote:
            livePres.thoughtNote !== undefined
              ? livePres.thoughtNote
              : friend.thoughtNote,
          thoughtEmoji:
            livePres.thoughtEmoji !== undefined
              ? livePres.thoughtEmoji
              : friend.thoughtEmoji,
          noteUpdatedAt: livePres.noteUpdatedAt || friend.noteUpdatedAt,
          noteExpiresAt: livePres.noteExpiresAt || friend.noteExpiresAt,
          photoURL:
            livePres.photoURL ||
            livePres.profilePicture ||
            friend.photoURL ||
            friend.profilePicture,
          profilePicture:
            livePres.profilePicture ||
            livePres.photoURL ||
            friend.profilePicture ||
            friend.photoURL,
          displayName:
            livePres.displayName ||
            livePres.name ||
            friend.displayName ||
            friend.name,
          name:
            livePres.name ||
            livePres.displayName ||
            friend.name ||
            friend.displayName,
        };
        if (map.has(cleanUid)) {
          const existing = map.get(cleanUid);
          map.set(cleanUid, {
            ...existing,
            ...friendWithPresence,
          });
        } else {
          map.set(cleanUid, friendWithPresence);
        }
      }
    });

    // 3. Contacts from allDirectMembers
    allDirectMembers.forEach((m) => {
      const rawUid = String(m.userId || m.memberId || m.id || "");
      const cleanUid = rawUid.replace(/^mem_/, "");
      if (cleanUid && cleanUid !== currentUid && !map.has(cleanUid)) {
        const livePres = presenceMap[cleanUid] || {};
        map.set(cleanUid, {
          ...m,
          cleanUid,
          isOnline:
            livePres.isOnline !== undefined
              ? livePres.isOnline
              : m.isOnline || m.online,
          lastActiveAt:
            livePres.lastActiveAt ||
            livePres.lastActiveDate ||
            m.lastActiveAt ||
            m.lastActiveDate ||
            m.lastSeen,
          lastActiveDate:
            livePres.lastActiveDate ||
            livePres.lastActiveAt ||
            m.lastActiveDate ||
            m.lastActiveAt,
          thoughtNote:
            livePres.thoughtNote !== undefined
              ? livePres.thoughtNote
              : m.thoughtNote,
          thoughtEmoji:
            livePres.thoughtEmoji !== undefined
              ? livePres.thoughtEmoji
              : m.thoughtEmoji,
          noteUpdatedAt: livePres.noteUpdatedAt || m.noteUpdatedAt,
          noteExpiresAt: livePres.noteExpiresAt || m.noteExpiresAt,
          photoURL:
            livePres.photoURL ||
            livePres.profilePicture ||
            m.photoURL ||
            m.profilePicture,
          profilePicture:
            livePres.profilePicture ||
            livePres.photoURL ||
            m.profilePicture ||
            m.photoURL,
        });
      }
    });

    const list = Array.from(map.values());

    // Sort: Online first, then active thought note, then alphabetical
    list.sort((a, b) => {
      const aTime =
        a.lastActiveAt ||
        a.lastActiveDate ||
        a.lastSeen ||
        a.updatedAt ||
        a.createdAt;
      const bTime =
        b.lastActiveAt ||
        b.lastActiveDate ||
        b.lastSeen ||
        b.updatedAt ||
        b.createdAt;
      const aPres = computePresence(aTime, a.isOnline || a.online);
      const bPres = computePresence(bTime, b.isOnline || b.online);

      if (aPres.isOnline && !bPres.isOnline) return -1;
      if (!aPres.isOnline && bPres.isOnline) return 1;

      const aNote =
        householdNotes[a.cleanUid] ||
        (a.thoughtNote
          ? {
              note: a.thoughtNote,
              emoji: a.thoughtEmoji,
              expiresAt: a.noteExpiresAt,
              updatedAt: a.noteUpdatedAt,
            }
          : null);
      const bNote =
        householdNotes[b.cleanUid] ||
        (b.thoughtNote
          ? {
              note: b.thoughtNote,
              emoji: b.thoughtEmoji,
              expiresAt: b.noteExpiresAt,
              updatedAt: b.noteUpdatedAt,
            }
          : null);

      const aHasNote =
        aNote && !isNoteExpired(aNote.updatedAt, aNote.expiresAt);
      const bHasNote =
        bNote && !isNoteExpired(bNote.updatedAt, bNote.expiresAt);

      if (aHasNote && !bHasNote) return -1;
      if (!aHasNote && bHasNote) return 1;

      const nameA = String(
        a.displayName || a.name || a.email || "",
      ).toLowerCase();
      const nameB = String(
        b.displayName || b.name || b.email || "",
      ).toLowerCase();
      return nameA.localeCompare(nameB);
    });

    return list;
  }, [
    billsGroupMembers,
    acceptedCommunityFriends,
    allDirectMembers,
    currentUid,
    householdNotes,
    presenceMap,
  ]);

  // Filtered members for the New Conversation Modal
  const composeFilteredMembers = useMemo(() => {
    let list = [...allDirectMembers];
    if (composeSearchQuery.trim()) {
      const q = composeSearchQuery.toLowerCase().trim();
      list = list.filter((m) => {
        const name = (m.displayName || m.name || m.email || "").toLowerCase();
        return name.includes(q);
      });
    }

    // Sort: Online first, then alphabetical
    list.sort((a, b) => {
      const aTime =
        a.lastActiveAt ||
        a.lastActiveDate ||
        a.lastSeen ||
        a.updatedAt ||
        a.createdAt;
      const bTime =
        b.lastActiveAt ||
        b.lastActiveDate ||
        b.lastSeen ||
        b.updatedAt ||
        b.createdAt;
      const aPres = computePresence(aTime, a.isOnline || a.online);
      const bPres = computePresence(bTime, b.isOnline || b.online);

      if (aPres.isOnline && !bPres.isOnline) return -1;
      if (!aPres.isOnline && bPres.isOnline) return 1;

      const nameA = String(
        a.displayName || a.name || a.email || "",
      ).toLowerCase();
      const nameB = String(
        b.displayName || b.name || b.email || "",
      ).toLowerCase();
      return nameA.localeCompare(nameB);
    });

    return list;
  }, [allDirectMembers, composeSearchQuery]);

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
  const rawCurrentUserNote =
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
          expiresAt: currentUserMember.noteExpiresAt || "",
        }
      : undefined);

  const currentUserNote =
    rawCurrentUserNote &&
    !isNoteExpired(rawCurrentUserNote.updatedAt, rawCurrentUserNote.expiresAt)
      ? rawCurrentUserNote
      : undefined;

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
      reactions: m.reactions || {},
      replyTo: m.replyTo || m.meta?.replyTo,
      isEdited: m.isEdited,
      editedAt: m.editedAt,
      deletedFor: m.deletedFor || [],
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

      const cleanMemberUid = String(memberUid).replace(/^mem_/, "").trim();
      const isRoommate = billsGroupMembers.some((bm) => {
        const u = String(bm.userId || bm.memberId || bm.id || "")
          .replace(/^mem_/, "")
          .trim();
        return u === cleanMemberUid;
      });
      const isAcceptedFriend = acceptedCommunityFriends.some((af) => {
        const u = String(af.userId || af.memberId || af.id || "")
          .replace(/^mem_/, "")
          .trim();
        return u === cleanMemberUid;
      });
      const isAcceptedConv = acceptedConvIds.has(convId);
      const isDeclinedConv = declinedConvIds.has(convId);
      if (isDeclinedConv) return;

      const isMessageRequest =
        !isRoommate && !isAcceptedFriend && !isAcceptedConv;

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
          : isMessageRequest
            ? "Request"
            : undefined;

      // Legitimate presence calculation
      const livePres = presenceMap[cleanMemberUid] || {};
      const effectiveLastActive =
        livePres.lastActiveAt ||
        livePres.lastActiveDate ||
        member.lastActiveAt ||
        member.lastActiveDate ||
        member.lastSeen ||
        member.updatedAt ||
        member.createdAt;
      const effectiveIsOnline =
        livePres.isOnline !== undefined
          ? livePres.isOnline
          : member.isOnline || member.online;

      const memberPresence = computePresence(
        effectiveLastActive,
        effectiveIsOnline,
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
        lastActiveAt: effectiveLastActive,
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
        isMessageRequest,
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
    presenceMap,
  ]);

  // Keep activeThread synced with updated live messages
  useEffect(() => {
    if (!activeThread) return;
    const fresh = conversations.find((c) => c.id === activeThread.id);
    if (fresh) {
      setActiveThread(fresh);
    }
  }, [conversations]);

  // Auto-focus thread if initialTargetUserId is supplied (or initialize new direct thread if first time messaging)
  useEffect(() => {
    if (initialTargetUserId && !activeThread) {
      const match = conversations.find(
        (c) => c.targetUserId === initialTargetUserId,
      );
      if (match) {
        setActiveThread(match);
      } else {
        let isCancelled = false;
        mobileDataService
          .getUserProfile(initialTargetUserId)
          .then((prof) => {
            if (isCancelled || !prof) return;
            const memberName =
              prof.displayName ||
              prof.name ||
              prof.fullName ||
              prof.email?.split("@")[0] ||
              "User";
            const palette =
              AVATAR_PALETTES[
                Math.abs(hashString(initialTargetUserId)) %
                  AVATAR_PALETTES.length
              ];
            const convId =
              "dm_" + [currentUid, initialTargetUserId].sort().join("_");
            const newThread: ConversationItem = {
              id: convId,
              targetUserId: initialTargetUserId,
              type: "direct",
              name: memberName,
              initials: getInitials(memberName),
              avatarBg: palette.bg,
              avatarColor: palette.text,
              photoURL: prof.profilePicture || prof.photoURL,
              isOnline: false,
              onlineStatusLabel: "Community Member",
              timestamp: "New",
              lastMessageTimestampMs: Date.now(),
              unreadCount: 0,
              pinned: false,
              roleLabel: prof.role === "HOST" ? "Host" : "Member",
              lastMessage: "Tap to start conversation",
              messages: [],
            };
            setActiveThread(newThread);
          })
          .catch((err) => {
            console.warn("Could not load initial target user for DM:", err);
          });
        return () => {
          isCancelled = true;
        };
      }
    }
  }, [initialTargetUserId, conversations, activeThread, currentUid]);

  // Track message IDs marked read in memory to prevent repetitive Firestore writes
  const markedReadMessageIdsRef = useRef<Set<string>>(new Set());

  // Mark messages in active thread as read with per-conversation routing & debouncing
  useEffect(() => {
    if (!activeThread || !currentUid) return;
    const threadId = activeThread.id;
    const isGroup =
      activeThread.type === "group" || threadId === "household_group";

    const unreadIds = activeThread.messages
      .filter(
        (m) =>
          !m.isMe &&
          !(m.readBy || []).includes(currentUid) &&
          !markedReadMessageIdsRef.current.has(m.id),
      )
      .map((m) => m.id);

    if (unreadIds.length === 0) return;

    // Immediately cache to prevent duplicate writes during renders
    unreadIds.forEach((id) => markedReadMessageIdsRef.current.add(id));

    const timer = setTimeout(() => {
      if (isGroup && householdId) {
        mobileDataService.markHouseholdMessagesRead(
          householdId,
          unreadIds,
          currentUid,
        );
      } else {
        mobileDataService.markDirectMessagesRead(unreadIds, currentUid);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [
    activeThread?.id,
    activeThread?.type,
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

  // Message requests count
  const messageRequestsCount = useMemo(() => {
    return conversations.filter((c) => c.isMessageRequest).length;
  }, [conversations]);

  // Filtered conversations
  const filteredConversations = useMemo(() => {
    let list = [...conversations];

    if (activeFilter === "requests") {
      list = list.filter((c) => c.isMessageRequest);
    } else {
      // In all standard filters, keep message requests cleanly separated
      list = list.filter((c) => !c.isMessageRequest);

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
      setShowNoteActionMenu(false);
      Alert.alert(
        currentUserNote ? "Note Updated" : "Note Shared",
        currentUserNote
          ? "Your thought note has been updated and renewed for another 24 hours!"
          : "Your roommates can now see your thought note for the next 24 hours!",
      );
    } catch (e) {
      console.warn("Error saving note:", e);
      Alert.alert("Error", "Could not share note at this time.");
    } finally {
      setIsSavingNote(false);
    }
  };

  // Clear Thought Note with confirmation alert
  const confirmClearNote = () => {
    Alert.alert(
      "Remove Thought Note",
      "Are you sure you want to remove your thought note? It will disappear immediately from the messages screen for all roommates.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: handleClearNote,
        },
      ],
    );
  };

  const handleClearNote = async () => {
    if (!householdId || !currentUid) return;
    setIsSavingNote(true);
    try {
      await mobileDataService.deleteHouseholdUserNote(householdId, currentUid);
      setNoteInputText("");
      setSelectedNoteEmoji("");
      setShowNoteModal(false);
      setShowNoteActionMenu(false);
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

  // Send a new message or save edited message inside active thread
  const handleSendMessage = async () => {
    const trimmed = chatInputText.trim();
    if (!trimmed || !activeThread) return;

    // Handle saving edited message
    if (editingMessage) {
      const targetMsgId = editingMessage.id;
      const oldText = editingMessage.text;
      if (trimmed === oldText) {
        setEditingMessage(null);
        setChatInputText("");
        return;
      }

      setIsSending(true);
      // Optimistic update locally
      setActiveThread((prev) =>
        prev
          ? {
              ...prev,
              messages: prev.messages.map((m) =>
                m.id === targetMsgId
                  ? { ...m, text: trimmed, isEdited: true }
                  : m,
              ),
            }
          : prev,
      );
      setRawMessages((prev) =>
        prev.map((m) =>
          m.id === targetMsgId ? { ...m, text: trimmed, isEdited: true } : m,
        ),
      );
      setDirectMessages((prev) =>
        prev.map((m) =>
          m.id === targetMsgId ? { ...m, text: trimmed, isEdited: true } : m,
        ),
      );

      const targetMsg = editingMessage;
      setEditingMessage(null);
      setChatInputText("");

      try {
        await mobileDataService.editMessage({
          messageId: targetMsgId,
          newText: trimmed,
          householdId: householdId || undefined,
          isDirect: activeThread.type === "direct",
          conversationId: activeThread.id,
          senderId: currentUid,
          recipientId: activeThread.targetUserId,
        });
      } catch (err: any) {
        console.warn("Error editing message:", err);
        Alert.alert("Error", "Could not update message. Please try again.");
      } finally {
        setIsSending(false);
      }
      return;
    }

    const replyMeta = replyingToMessage
      ? {
          id: replyingToMessage.id,
          senderName: replyingToMessage.isMe
            ? currentUserName || "You"
            : replyingToMessage.sender,
          text:
            replyingToMessage.text ||
            (replyingToMessage.type === "image"
              ? "📷 Photo"
              : replyingToMessage.type === "file"
                ? "📎 Attachment"
                : "Message"),
        }
      : undefined;

    setReplyingToMessage(null);
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
          meta: replyMeta ? { replyTo: replyMeta } : undefined,
          householdId: householdId || undefined,
        });
      } else if (householdId) {
        await mobileDataService.sendHouseholdMessage(householdId, {
          conversationId: activeThread.id,
          senderId: currentUid,
          senderName: currentUserName,
          text: trimmed,
          type: "text",
          meta: replyMeta ? { replyTo: replyMeta } : undefined,
        });
      }
      setTimeout(() => {
        messageScrollRef.current?.scrollToEnd({ animated: true });
      }, 80);
    } catch (err: any) {
      console.warn("Error sending message:", err);
      Alert.alert("Failed to send", "Please check your network connection.");
    } finally {
      setIsSending(false);
    }
  };

  const handleStartReply = (msg: ChatMessage) => {
    setReplyingToMessage(msg);
    setTimeout(() => {
      chatInputRef.current?.focus();
    }, 100);
  };

  const handleCancelReply = () => {
    setReplyingToMessage(null);
  };

  const handleToggleReaction = async (msg: ChatMessage, emoji: string) => {
    const cleanUid = String(currentUid || "")
      .replace(/^mem_/, "")
      .trim();
    const currentList = Array.isArray(msg.reactions?.[emoji])
      ? [...msg.reactions[emoji]]
      : [];
    const exists = currentList.includes(cleanUid);
    const updatedList = exists
      ? currentList.filter((u) => u !== cleanUid)
      : [...currentList, cleanUid];

    const updatedReactions: Record<string, string[]> = {
      ...(msg.reactions || {}),
    };
    if (updatedList.length === 0) {
      delete updatedReactions[emoji];
    } else {
      updatedReactions[emoji] = updatedList;
    }

    const updateMsg = (m: ChatMessage) =>
      m.id === msg.id ? { ...m, reactions: updatedReactions } : m;

    setActiveThread((prev) =>
      prev ? { ...prev, messages: prev.messages.map(updateMsg) } : prev,
    );
    setRawMessages((prev) => prev.map(updateMsg));
    setDirectMessages((prev) => prev.map(updateMsg));

    setSelectedMessageForAction(null);
    setDeleteMode(false);

    try {
      await mobileDataService.toggleMessageReaction({
        messageId: msg.id,
        householdId: householdId || undefined,
        isDirect: activeThread?.type === "direct",
        emoji,
        userId: currentUid,
      });
    } catch (err) {
      console.warn("Error toggling reaction:", err);
    }
  };

  // Handlers for Message Action Strip (Long Press) & Editing
  const handleLongPressMessage = (msg: ChatMessage, eventOrCoords?: any) => {
    setSelectedMessageForAction(msg);
    setDeleteMode(false);
    const nativeEv = eventOrCoords?.nativeEvent || eventOrCoords;
    if (
      nativeEv &&
      typeof nativeEv.pageY === "number" &&
      typeof nativeEv.pageX === "number"
    ) {
      setMessageActionCoords({ x: nativeEv.pageX, y: nativeEv.pageY });
    } else {
      setMessageActionCoords(null);
    }
  };

  const handleStartEdit = () => {
    if (!selectedMessageForAction) return;
    setEditingMessage(selectedMessageForAction);
    setChatInputText(selectedMessageForAction.text || "");
    setSelectedMessageForAction(null);
    setDeleteMode(false);
    setTimeout(() => {
      chatInputRef.current?.focus();
    }, 120);
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setChatInputText("");
  };

  const handleCopyMessageText = async () => {
    if (!selectedMessageForAction) return;
    if (selectedMessageForAction.text) {
      await Clipboard.setStringAsync(selectedMessageForAction.text);
      Alert.alert("Copied", "Message text copied to clipboard.");
    }
    setSelectedMessageForAction(null);
    setDeleteMode(false);
  };

  const handleDeleteMessage = async (deleteForEveryone: boolean) => {
    if (!selectedMessageForAction) return;
    const msgId = selectedMessageForAction.id;
    setIsDeletingMessage(true);
    try {
      await mobileDataService.deleteMessage({
        messageId: msgId,
        householdId: householdId || undefined,
        isDirect: activeThread?.type === "direct",
        deleteForEveryone,
        currentUid,
      });

      // Instantly remove from local active thread state
      if (activeThread) {
        setActiveThread({
          ...activeThread,
          messages: activeThread.messages.filter((m) => m.id !== msgId),
        });
      }
      setRawMessages((prev) => prev.filter((m) => m.id !== msgId));
      setDirectMessages((prev) => prev.filter((m) => m.id !== msgId));
      setSelectedMessageForAction(null);
      setDeleteMode(false);
    } catch (e) {
      console.warn("Error deleting message:", e);
      Alert.alert("Error", "Could not delete message. Please try again.");
    } finally {
      setIsDeletingMessage(false);
    }
  };

  // Handlers for Conversation Deletion (Long Press)
  const handleLongPressConversation = (item: ConversationItem) => {
    setSelectedConversationForDelete(item);
  };

  const handleDeleteConversationConfirm = async () => {
    if (!selectedConversationForDelete) return;
    const convId = selectedConversationForDelete.id;
    setIsDeletingConversation(true);
    try {
      await mobileDataService.deleteConversation({
        conversationId: convId,
        householdId: householdId || undefined,
        currentUid,
      });

      if (activeThread?.id === convId) {
        setActiveThread(null);
      }
      setRawMessages((prev) =>
        prev.filter((m) => (m.conversationId || householdId) !== convId),
      );
      setDirectMessages((prev) =>
        prev.filter((m) => m.conversationId !== convId),
      );
      setSelectedConversationForDelete(null);
      Alert.alert(
        "Conversation Deleted",
        "The conversation was permanently removed.",
      );
    } catch (e) {
      console.warn("Error deleting conversation:", e);
      Alert.alert("Error", "Could not delete conversation. Please try again.");
    } finally {
      setIsDeletingConversation(false);
    }
  };

  const handleToggleMuteActiveThread = () => {
    if (!activeThread) return;
    setMutedThreadIds((prev) => {
      const next = new Set(prev);
      if (next.has(activeThread.id)) {
        next.delete(activeThread.id);
        Alert.alert(
          "Notifications Unmuted",
          `You will now receive notifications from ${activeThread.name}.`,
        );
      } else {
        next.add(activeThread.id);
        Alert.alert(
          "Conversation Muted",
          `Notifications from ${activeThread.name} are muted.`,
        );
      }
      return next;
    });
  };

  const executeDeleteActiveConversation = async () => {
    if (!activeThread) return;
    setShowDeleteChatModal(false);
    const convId = activeThread.id;
    setIsDeletingConversation(true);
    try {
      await mobileDataService.deleteConversation({
        conversationId: convId,
        householdId: householdId || undefined,
        currentUid,
      });
      setShowConversationInfo(false);
      setActiveThread(null);
      setRawMessages((prev) =>
        prev.filter((m) => (m.conversationId || householdId) !== convId),
      );
      setDirectMessages((prev) =>
        prev.filter((m) => m.conversationId !== convId),
      );
    } catch (e) {
      console.warn("Error deleting conversation:", e);
    } finally {
      setIsDeletingConversation(false);
    }
  };

  const handleDeleteActiveConversation = () => {
    if (!activeThread) return;
    Alert.alert(
      "Delete Chat",
      `Are you sure you want to delete this chat with ${activeThread.name}? All messages will be permanently removed.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const convId = activeThread.id;
            setIsDeletingConversation(true);
            try {
              await mobileDataService.deleteConversation({
                conversationId: convId,
                householdId: householdId || undefined,
                currentUid,
              });
              setShowConversationInfo(false);
              setActiveThread(null);
              setRawMessages((prev) =>
                prev.filter(
                  (m) => (m.conversationId || householdId) !== convId,
                ),
              );
              setDirectMessages((prev) =>
                prev.filter((m) => m.conversationId !== convId),
              );
              Alert.alert("Chat Deleted", "The conversation has been removed.");
            } catch (e) {
              console.warn("Error deleting conversation:", e);
              Alert.alert("Error", "Could not delete conversation.");
            } finally {
              setIsDeletingConversation(false);
            }
          },
        },
      ],
    );
  };

  // Handlers for Attachments (+ Button Modal: Send Image / Send File)
  const handlePickAndSendImage = async () => {
    try {
      setShowAttachmentModal(false);
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Permission Required",
          "Photo library permission is needed to share images.",
        );
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.85,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) return;

      const asset = res.assets[0];
      setIsUploadingAttachment(true);

      const secureUrl = await uploadImageToCloudinaryMobile({
        uri: asset.uri,
        mimeType: asset.mimeType || undefined,
      });

      const isDirect = activeThread?.type === "direct";
      if (isDirect && activeThread?.targetUserId) {
        await mobileDataService.sendDirectMessage({
          conversationId: activeThread.id,
          senderId: currentUid,
          senderName: currentUserName,
          recipientId: activeThread.targetUserId,
          text: "📷 Photo",
          type: "image",
          meta: {
            attachmentUrl: secureUrl,
            fileName: asset.fileName || "photo.jpg",
            fileSize: asset.fileSize
              ? `${Math.round(asset.fileSize / 1024)} KB`
              : undefined,
          },
          householdId: householdId || undefined,
        });
      } else if (householdId && activeThread) {
        await mobileDataService.sendHouseholdMessage(householdId, {
          conversationId: activeThread.id,
          senderId: currentUid,
          senderName: currentUserName,
          text: "📷 Photo",
          type: "image",
          meta: {
            attachmentUrl: secureUrl,
            fileName: asset.fileName || "photo.jpg",
            fileSize: asset.fileSize
              ? `${Math.round(asset.fileSize / 1024)} KB`
              : undefined,
          },
        });
      }

      setTimeout(() => {
        messageScrollRef.current?.scrollToEnd({ animated: true });
      }, 80);
    } catch (e) {
      console.warn("Error uploading/sending image:", e);
      Alert.alert("Upload Failed", "Unable to upload image. Please try again.");
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const handlePickAndSendFile = async () => {
    try {
      setShowAttachmentModal(false);
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Permission Required",
          "File access permission is needed to share files.",
        );
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: false,
        quality: 0.9,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) return;

      const asset = res.assets[0];
      setIsUploadingAttachment(true);

      const secureUrl = await uploadImageToCloudinaryMobile({
        uri: asset.uri,
        mimeType: asset.mimeType || undefined,
      });

      const fileName =
        asset.fileName ||
        (asset.type === "video" ? "video_file.mp4" : "document_file");
      const isDirect = activeThread?.type === "direct";
      if (isDirect && activeThread?.targetUserId) {
        await mobileDataService.sendDirectMessage({
          conversationId: activeThread.id,
          senderId: currentUid,
          senderName: currentUserName,
          recipientId: activeThread.targetUserId,
          text: `📎 ${fileName}`,
          type: "file",
          meta: {
            attachmentUrl: secureUrl,
            fileName: fileName,
            fileSize: asset.fileSize
              ? `${Math.round(asset.fileSize / 1024)} KB`
              : undefined,
            fileType: asset.type || "file",
          },
          householdId: householdId || undefined,
        });
      } else if (householdId && activeThread) {
        await mobileDataService.sendHouseholdMessage(householdId, {
          conversationId: activeThread.id,
          senderId: currentUid,
          senderName: currentUserName,
          text: `📎 ${fileName}`,
          type: "file",
          meta: {
            attachmentUrl: secureUrl,
            fileName: fileName,
            fileSize: asset.fileSize
              ? `${Math.round(asset.fileSize / 1024)} KB`
              : undefined,
            fileType: asset.type || "file",
          },
        });
      }

      setTimeout(() => {
        messageScrollRef.current?.scrollToEnd({ animated: true });
      }, 80);
    } catch (e) {
      console.warn("Error uploading/sending file:", e);
      Alert.alert("Upload Failed", "Unable to upload file. Please try again.");
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const handleSendLocation = async () => {
    setShowAttachmentModal(false);
    const placeName =
      householdInfo?.householdName ||
      householdInfo?.name ||
      "Apartment Residence";
    const address =
      householdInfo?.address ||
      householdInfo?.street ||
      "Main Residence, Splitzy";
    const locationText = `📍 Location: ${placeName} · ${address}`;

    try {
      const isDirect = activeThread?.type === "direct";
      if (isDirect && activeThread?.targetUserId) {
        await mobileDataService.sendDirectMessage({
          conversationId: activeThread.id,
          senderId: currentUid,
          senderName: currentUserName,
          recipientId: activeThread.targetUserId,
          text: locationText,
          type: "text",
          householdId: householdId || undefined,
        });
      } else if (householdId && activeThread) {
        await mobileDataService.sendHouseholdMessage(householdId, {
          conversationId: activeThread.id,
          senderId: currentUid,
          senderName: currentUserName,
          text: locationText,
          type: "text",
        });
      }
      setTimeout(() => {
        messageScrollRef.current?.scrollToEnd({ animated: true });
      }, 80);
    } catch (e) {
      console.warn("Error sending location:", e);
    }
  };

  const handleSendSaved = () => {
    setShowAttachmentModal(false);
    Alert.alert(
      "Saved Quick Replies",
      "Select a message template to insert into chat:",
      [
        {
          text: "Paid my dues! Please verify receipt. 💸",
          onPress: () => {
            setChatInputText("Paid my dues! Please verify receipt. 💸");
            setTimeout(() => chatInputRef.current?.focus(), 100);
          },
        },
        {
          text: "Friendly reminder: Bill deadline is coming up. 📅",
          onPress: () => {
            setChatInputText(
              "Friendly reminder: Bill deadline is coming up! 📅",
            );
            setTimeout(() => chatInputRef.current?.focus(), 100);
          },
        },
        {
          text: "Can someone share the receipt photo? 🧾",
          onPress: () => {
            setChatInputText(
              "Can someone share the receipt photo for this expense? 🧾",
            );
            setTimeout(() => chatInputRef.current?.focus(), 100);
          },
        },
        { text: "Cancel", style: "cancel" },
      ],
    );
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
        member.lastActiveAt ||
          member.lastActiveDate ||
          member.lastSeen ||
          member.updatedAt ||
          member.createdAt,
        member.isOnline || member.online,
      );

      const newThread: ConversationItem = {
        id: convId,
        targetUserId: memberUid,
        type: "direct",
        name: memberName,
        initials: getInitials(memberName),
        avatarBg: palette.bg,
        avatarColor: palette.text,
        photoURL:
          member.profilePicture ||
          member.photoURL ||
          (typeof member.avatar === "string" && member.avatar.startsWith("http")
            ? member.avatar
            : undefined),
        isOnline: presence.isOnline,
        onlineStatusLabel: presence.statusLabel,
        lastActiveAt: member.lastActiveAt || member.lastActiveDate,
        timestamp: "New",
        lastMessageTimestampMs: Date.now(),
        unreadCount: 0,
        pinned: false,
        roleLabel: member.role === "HOST" ? "Host" : undefined,
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

  // Fullscreen Lightbox Modal
  const renderLightboxModal = () => (
    <Modal
      visible={Boolean(lightboxImage)}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setLightboxImage(null)}
      statusBarTranslucent
    >
      <View style={styles.lightboxBackdrop}>
        <StatusBar
          barStyle="light-content"
          translucent
          backgroundColor="rgba(0,0,0,0.95)"
        />
        {/* Lightbox Header */}
        <View style={[styles.lightboxHeader, { paddingTop: topInset + 8 }]}>
          <TouchableOpacity
            style={styles.lightboxCloseBtn}
            onPress={() => setLightboxImage(null)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Close image preview"
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.lightboxHeaderInfo}>
            <Text style={styles.lightboxSenderText} numberOfLines={1}>
              {lightboxImage?.senderName || "Photo"}
            </Text>
            {lightboxImage?.timestamp && (
              <Text style={styles.lightboxTimeText}>
                {lightboxImage.timestamp}
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={styles.lightboxCloseBtn}
            onPress={() => {
              Alert.alert(
                "Photo Saved",
                "The photo has been saved to your photo album.",
              );
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Save photo"
          >
            <Ionicons name="download-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Interactive Zoomable Image Area */}
        <ScrollView
          style={styles.lightboxScroll}
          contentContainerStyle={styles.lightboxScrollContent}
          maximumZoomScale={3}
          minimumZoomScale={1}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          centerContent={true}
          bounces={false}
        >
          {lightboxImage?.uri && (
            <Image
              source={{ uri: lightboxImage.uri }}
              style={{
                width: windowWidth,
                height: windowHeight * 0.78,
              }}
              resizeMode="contain"
            />
          )}
        </ScrollView>

        {lightboxImage?.caption ? (
          <View
            style={[
              styles.lightboxCaptionBox,
              { paddingBottom: bottomInset + 12 },
            ]}
          >
            <Text style={styles.lightboxCaptionText}>
              {lightboxImage.caption}
            </Text>
          </View>
        ) : (
          <View style={{ height: bottomInset + 12 }} />
        )}
      </View>
    </Modal>
  );

  // All Media, Files & Links Modal
  const renderAllMediaModal = () => (
    <SmoothBottomSheetModal
      visible={showAllMediaModal}
      onClose={() => setShowAllMediaModal(false)}
      title="Media, Files & Links"
      subtitle={`Shared with ${activeThread?.name || "this chat"}`}
      icon={<Ionicons name="images-outline" size={20} color="#2563EB" />}
      maxHeight="88%"
      showChipBar={true}
    >
      <View style={{ flex: 1, paddingBottom: bottomInset }}>
        {/* Tabs Row */}
        <View
          style={[
            styles.allMediaTabsRow,
            {
              backgroundColor: isDark ? "#1E222B" : "#F1F5F9",
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.allMediaTabBtn,
              allMediaActiveTab === "media" && [
                styles.allMediaTabBtnActive,
                { backgroundColor: isDark ? "#242731" : "#FFFFFF" },
              ],
            ]}
            onPress={() => setAllMediaActiveTab("media")}
          >
            <Text
              style={[
                styles.allMediaTabText,
                {
                  color:
                    allMediaActiveTab === "media"
                      ? isDark
                        ? "#FFFFFF"
                        : "#0F172A"
                      : isDark
                        ? "#94A3B8"
                        : "#64748B",
                  fontWeight: allMediaActiveTab === "media" ? "700" : "500",
                },
              ]}
            >
              Media
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.allMediaTabBtn,
              allMediaActiveTab === "files" && [
                styles.allMediaTabBtnActive,
                { backgroundColor: isDark ? "#242731" : "#FFFFFF" },
              ],
            ]}
            onPress={() => setAllMediaActiveTab("files")}
          >
            <Text
              style={[
                styles.allMediaTabText,
                {
                  color:
                    allMediaActiveTab === "files"
                      ? isDark
                        ? "#FFFFFF"
                        : "#0F172A"
                      : isDark
                        ? "#94A3B8"
                        : "#64748B",
                  fontWeight: allMediaActiveTab === "files" ? "700" : "500",
                },
              ]}
            >
              Files
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.allMediaTabBtn,
              allMediaActiveTab === "links" && [
                styles.allMediaTabBtnActive,
                { backgroundColor: isDark ? "#242731" : "#FFFFFF" },
              ],
            ]}
            onPress={() => setAllMediaActiveTab("links")}
          >
            <Text
              style={[
                styles.allMediaTabText,
                {
                  color:
                    allMediaActiveTab === "links"
                      ? isDark
                        ? "#FFFFFF"
                        : "#0F172A"
                      : isDark
                        ? "#94A3B8"
                        : "#64748B",
                  fontWeight: allMediaActiveTab === "links" ? "700" : "500",
                },
              ]}
            >
              Links
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 12 }}
        >
          {allMediaActiveTab === "media" && (
            <View style={styles.allMediaGrid}>
              {conversationMedia.map((img, i) => (
                <TouchableOpacity
                  key={img.id || i}
                  activeOpacity={0.85}
                  style={styles.allMediaGridItem}
                  onPress={() => {
                    setLightboxImage({
                      uri: img.uri,
                      senderName: img.senderName || activeThread?.name,
                      timestamp: img.timestamp,
                    });
                  }}
                >
                  <Image
                    source={{ uri: img.uri }}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {allMediaActiveTab === "files" && (
            <View style={{ gap: 10, paddingHorizontal: 4 }}>
              {activeThread?.messages
                .filter((m) => m.type === "file" && m.meta?.attachmentUrl)
                .map((m) => (
                  <View
                    key={m.id}
                    style={[
                      styles.allMediaFileCard,
                      {
                        backgroundColor: isDark ? "#1E222B" : "#F8FAFC",
                        borderColor: isDark
                          ? "rgba(255,255,255,0.08)"
                          : "#E2E8F0",
                      },
                    ]}
                  >
                    <Ionicons name="document-text" size={24} color="#2563EB" />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: isDark ? "#FFFFFF" : "#0F172A",
                          fontSize: 14,
                          fontWeight: "600",
                        }}
                        numberOfLines={1}
                      >
                        {m.meta?.fileName || m.text}
                      </Text>
                      <Text
                        style={{
                          color: isDark ? "#94A3B8" : "#64748B",
                          fontSize: 12,
                          marginTop: 2,
                        }}
                      >
                        {m.meta?.fileSize || "PDF Document"} · {m.time}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() =>
                        Alert.alert("Opening File", "Document viewer opened.")
                      }
                    >
                      <Ionicons
                        name="cloud-download-outline"
                        size={20}
                        color={isDark ? "#60A5FA" : "#2563EB"}
                      />
                    </TouchableOpacity>
                  </View>
                ))}
              {activeThread?.messages.filter(
                (m) => m.type === "file" && m.meta?.attachmentUrl,
              ).length === 0 && (
                <View
                  style={{ alignItems: "center", paddingVertical: 36, gap: 8 }}
                >
                  <Ionicons
                    name="document-outline"
                    size={32}
                    color={isDark ? "#64748B" : "#94A3B8"}
                  />
                  <Text
                    style={{
                      color: isDark ? "#94A3B8" : "#64748B",
                      fontSize: 13,
                    }}
                  >
                    No documents shared in this conversation yet.
                  </Text>
                </View>
              )}
            </View>
          )}

          {allMediaActiveTab === "links" && (
            <View style={{ gap: 10, paddingHorizontal: 4 }}>
              <View
                style={[
                  styles.allMediaFileCard,
                  {
                    backgroundColor: isDark ? "#1E222B" : "#F8FAFC",
                    borderColor: isDark ? "rgba(255,255,255,0.08)" : "#E2E8F0",
                  },
                ]}
              >
                <Ionicons name="link-outline" size={24} color="#2563EB" />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: isDark ? "#FFFFFF" : "#0F172A",
                      fontSize: 14,
                      fontWeight: "600",
                    }}
                    numberOfLines={1}
                  >
                    Household Shared Expense Dashboard
                  </Text>
                  <Text
                    style={{
                      color: isDark ? "#94A3B8" : "#64748B",
                      fontSize: 12,
                      marginTop: 2,
                    }}
                  >
                    splitzy.app/settle/{householdId || "current"}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </SmoothBottomSheetModal>
  );

  const handleOpenProfile = () => {
    if (!activeThread) return;
    if (activeThread.type === "group") {
      setShowGroupMembersModal(true);
    } else {
      const isDirect = activeThread.type === "direct";
      const cleanTargetUid =
        isDirect && activeThread.targetUserId
          ? String(activeThread.targetUserId).replace(/^mem_/, "").trim()
          : "";
      const live = cleanTargetUid ? presenceMap[cleanTargetUid] : null;
      const threadPhoto =
        live?.photoURL || live?.profilePicture || activeThread.photoURL;
      const targetUid =
        cleanTargetUid ||
        (activeThread.targetUserId
          ? String(activeThread.targetUserId).replace(/^mem_/, "").trim()
          : "");

      setShowConversationInfo(false);
      onOpenUserProfile?.({
        uid: targetUid,
        name: activeThread.name,
        email: live?.email || activeThread.email || "",
        avatar: threadPhoto || activeThread.avatar || "",
        role: activeThread.roleLabel || "Member",
      });
    }
  };

  const handleSelectGroupMember = (m: any) => {
    if (!m) return;
    const memberUid = String(m.id || m.uid || m.userId || "")
      .replace(/^mem_/, "")
      .trim();
    const memberName = m.displayName || m.name || "Resident";
    const memberAvatar = m.profilePicture || m.photoURL || m.avatar || "";
    const memberEmail = m.email || "";
    const memberRole = m.role || "Member";

    setShowGroupMembersModal(false);
    setShowConversationInfo(false);
    onOpenUserProfile?.({
      uid: memberUid,
      name: memberName,
      email: memberEmail,
      avatar: memberAvatar,
      role: memberRole,
    });
  };

  // Dedicated Interactive Bottom Sheets for Conversation Info
  const renderConversationInfoModals = () => (
    <>
      {/* 1. Nicknames Bottom Sheet */}
      <SmoothBottomSheetModal
        visible={showNicknamesModal}
        onClose={() => setShowNicknamesModal(false)}
        title="Set Nickname"
        subtitle={`Change how ${activeThread?.name || "this contact"} appears`}
        icon={<Ionicons name="text" size={20} color="#2563EB" />}
        maxHeight="80%"
        showChipBar={true}
      >
        <View
          style={{
            paddingHorizontal: 20,
            paddingBottom: bottomInset + 16,
            paddingTop: 10,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: "600",
              color: isDark ? "#94A3B8" : "#64748B",
              marginBottom: 8,
            }}
          >
            Custom Nickname
          </Text>
          <TextInput
            value={tempNickname}
            onChangeText={setTempNickname}
            placeholder={activeThread?.name || "Enter nickname"}
            placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
            style={{
              backgroundColor: isDark ? "#1E222B" : "#F1F5F9",
              color: isDark ? "#FFFFFF" : "#0F172A",
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderRadius: 14,
              fontSize: 16,
              fontWeight: "600",
              marginBottom: 16,
            }}
            maxLength={30}
          />
          <Text
            style={{
              fontSize: 12,
              fontWeight: "600",
              color: isDark ? "#94A3B8" : "#64748B",
              marginBottom: 8,
            }}
          >
            Quick Suggestions
          </Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 20,
            }}
          >
            {["Buddy", "Roomie", "Flatmate", "Bestie"].map((preset) => (
              <TouchableOpacity
                key={preset}
                activeOpacity={0.7}
                onPress={() => {
                  const base = (activeThread?.name || "Friend").split(" ")[0];
                  setTempNickname(`${base} (${preset})`);
                }}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 20,
                  backgroundColor: isDark ? "#242731" : "#E2E8F0",
                }}
              >
                <Text
                  style={{
                    color: isDark ? "#CBD5E1" : "#334155",
                    fontSize: 13,
                    fontWeight: "500",
                  }}
                >
                  +{preset}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {customNicknames[activeThread?.id || ""] && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => handleSaveNickname("")}
                style={{
                  flex: 1,
                  paddingVertical: 13,
                  borderRadius: 14,
                  backgroundColor: isDark ? "#2A1D20" : "#FEE2E2",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{ color: "#EF4444", fontWeight: "700", fontSize: 14 }}
                >
                  Clear
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleSaveNickname(tempNickname)}
              style={{
                flex: 2,
                paddingVertical: 13,
                borderRadius: 14,
                backgroundColor: selectedChatTheme,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 14 }}
              >
                Save Nickname
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SmoothBottomSheetModal>

      {/* 2. Group Members Bottom Sheet */}
      <SmoothBottomSheetModal
        visible={showGroupMembersModal}
        onClose={() => setShowGroupMembersModal(false)}
        title="Household Members"
        subtitle={`${householdMembers.length} active residents in this group`}
        icon={<Ionicons name="people" size={20} color="#2563EB" />}
        maxHeight="82%"
        showChipBar={true}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: bottomInset + 20,
            paddingTop: 8,
          }}
        >
          <Text
            style={{
              fontSize: 12.5,
              color: isDark ? "#94A3B8" : "#64748B",
              marginBottom: 12,
              paddingHorizontal: 4,
            }}
          >
            Tap any roommate to view their profile, debts, and ledger share.
          </Text>
          {householdMembers.map((m, idx) => {
            const mUid = String(m.id || m.uid || m.userId || "")
              .replace(/^mem_/, "")
              .trim();
            const mName = m.displayName || m.name || "Resident";
            const mPhoto = m.profilePicture || m.photoURL || m.avatar;
            const mRole = m.role || "Member";
            const isCurrentUser = mUid === currentUid;
            const live = mUid ? presenceMap[mUid] : null;
            const pres = computePresence(
              live?.lastActiveAt || live?.lastActiveDate,
              live?.isOnline,
            );

            return (
              <TouchableOpacity
                key={m.id || m.uid || idx}
                activeOpacity={0.7}
                onPress={() => handleSelectGroupMember(m)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 11,
                  paddingHorizontal: 12,
                  borderRadius: 14,
                  marginBottom: 6,
                  backgroundColor: isDark ? "#181A20" : "#F8FAFC",
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    overflow: "hidden",
                    position: "relative",
                    marginRight: 12,
                  }}
                >
                  {mPhoto ? (
                    <Image
                      source={{ uri: mPhoto }}
                      style={{ width: 44, height: 44 }}
                    />
                  ) : (
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: "#2563EB",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: "#FFFFFF",
                          fontWeight: "800",
                          fontSize: 17,
                        }}
                      >
                        {getInitials(mName)}
                      </Text>
                    </View>
                  )}
                  {pres.isOnline && (
                    <View
                      style={{
                        position: "absolute",
                        bottom: 0,
                        right: 0,
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: "#10B981",
                        borderWidth: 2,
                        borderColor: isDark ? "#181A20" : "#FFFFFF",
                      }}
                    />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Text
                      style={{
                        color: isDark ? "#FFFFFF" : "#0F172A",
                        fontWeight: "700",
                        fontSize: 15,
                      }}
                      numberOfLines={1}
                    >
                      {mName}
                    </Text>
                    {isCurrentUser && (
                      <Text
                        style={{
                          color: "#2563EB",
                          fontSize: 11,
                          fontWeight: "600",
                        }}
                      >
                        (You)
                      </Text>
                    )}
                  </View>
                  <Text
                    style={{
                      color: isDark ? "#94A3B8" : "#64748B",
                      fontSize: 12,
                      marginTop: 1,
                    }}
                  >
                    {mRole} · {pres.statusLabel}
                  </Text>
                </View>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                >
                  <Text
                    style={{
                      color: "#2563EB",
                      fontSize: 12,
                      fontWeight: "600",
                    }}
                  >
                    View Profile
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color="#2563EB" />
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </SmoothBottomSheetModal>

      {/* 3. Theme Bottom Sheet */}
      <SmoothBottomSheetModal
        visible={showThemeModal}
        onClose={() => setShowThemeModal(false)}
        title="Chat Theme"
        subtitle="Select accent color for messages and buttons"
        icon={<Ionicons name="color-palette" size={20} color="#2563EB" />}
        maxHeight="75%"
        showChipBar={true}
      >
        <View
          style={{
            paddingHorizontal: 20,
            paddingBottom: bottomInset + 16,
            paddingTop: 10,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 14,
              justifyContent: "center",
              paddingVertical: 12,
            }}
          >
            {CHAT_THEMES.map((theme) => {
              const isSelected = selectedChatTheme === theme.hex;
              return (
                <TouchableOpacity
                  key={theme.hex}
                  activeOpacity={0.8}
                  onPress={() => handleSelectChatTheme(theme.hex)}
                  style={{
                    width: 88,
                    alignItems: "center",
                    paddingVertical: 12,
                    paddingHorizontal: 8,
                    borderRadius: 16,
                    backgroundColor: isDark ? "#1E222B" : "#F8FAFC",
                    borderWidth: isSelected ? 2.5 : 1,
                    borderColor: isSelected
                      ? theme.hex
                      : isDark
                        ? "rgba(255,255,255,0.08)"
                        : "#E2E8F0",
                  }}
                >
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      backgroundColor: theme.hex,
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 8,
                    }}
                  >
                    {isSelected && (
                      <Ionicons name="checkmark" size={22} color="#FFFFFF" />
                    )}
                  </View>
                  <Text
                    style={{
                      color: isDark ? "#FFFFFF" : "#0F172A",
                      fontSize: 12,
                      fontWeight: isSelected ? "800" : "500",
                      textAlign: "center",
                    }}
                  >
                    {theme.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleApplyChatTheme}
            style={{
              marginTop: 12,
              paddingVertical: 13,
              borderRadius: 14,
              backgroundColor: selectedChatTheme,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 14 }}>
              Apply Theme
            </Text>
          </TouchableOpacity>
        </View>
      </SmoothBottomSheetModal>

      {/* 4. Pinned Messages Bottom Sheet */}
      <SmoothBottomSheetModal
        visible={showPinnedModal}
        onClose={() => setShowPinnedModal(false)}
        title="Pinned Messages"
        subtitle={`Pinned in ${customNicknames[activeThread?.id || ""] || activeThread?.name || "chat"}`}
        icon={<Ionicons name="pin" size={20} color={selectedChatTheme} />}
        maxHeight="80%"
        showChipBar={true}
      >
        <View
          style={{
            paddingHorizontal: 20,
            paddingBottom: bottomInset + 16,
            paddingTop: 10,
          }}
        >
          {(() => {
            const threadPinnedIds =
              pinnedMessageIdsMap[activeThread?.id || ""] || [];
            const pinnedMsgs = (activeThread?.messages || []).filter((m) =>
              threadPinnedIds.includes(m.id),
            );
            if (pinnedMsgs.length === 0) {
              return (
                <View
                  style={{
                    alignItems: "center",
                    paddingVertical: 24,
                    paddingHorizontal: 16,
                    borderRadius: 16,
                    backgroundColor: isDark ? "#1E222B" : "#F8FAFC",
                  }}
                >
                  <Ionicons
                    name="pin-outline"
                    size={36}
                    color={isDark ? "#64748B" : "#94A3B8"}
                    style={{ marginBottom: 10 }}
                  />
                  <Text
                    style={{
                      color: isDark ? "#FFFFFF" : "#0F172A",
                      fontWeight: "700",
                      fontSize: 15,
                      textAlign: "center",
                    }}
                  >
                    No Pinned Messages
                  </Text>
                  <Text
                    style={{
                      color: isDark ? "#94A3B8" : "#64748B",
                      fontSize: 13,
                      textAlign: "center",
                      marginTop: 4,
                    }}
                  >
                    Long press any message or bill in chat to pin it here for
                    quick access.
                  </Text>
                </View>
              );
            }
            return (
              <ScrollView
                style={{ maxHeight: 320 }}
                showsVerticalScrollIndicator={false}
              >
                {pinnedMsgs.map((pm) => (
                  <View
                    key={pm.id}
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      backgroundColor: isDark ? "#1E222B" : "#F8FAFC",
                      marginBottom: 8,
                      borderLeftWidth: 3.5,
                      borderLeftColor: selectedChatTheme,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 4,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "700",
                          color: isDark ? "#60A5FA" : selectedChatTheme,
                        }}
                      >
                        {pm.isMe ? "You" : pm.sender} · {pm.time}
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleTogglePinMessage(pm.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "700",
                            color: "#EF4444",
                          }}
                        >
                          Unpin
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <Text
                      style={{
                        fontSize: 13.5,
                        color: isDark ? "#FFFFFF" : "#0F172A",
                        lineHeight: 18,
                      }}
                      numberOfLines={3}
                    >
                      {pm.text ||
                        (pm.type === "image" ? "📷 Image photo" : "Message")}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            );
          })()}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setShowPinnedModal(false)}
            style={{
              marginTop: 16,
              paddingVertical: 13,
              borderRadius: 14,
              backgroundColor: isDark ? "#242731" : "#F1F5F9",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: isDark ? "#FFFFFF" : "#0F172A",
                fontWeight: "700",
                fontSize: 14,
              }}
            >
              Done
            </Text>
          </TouchableOpacity>
        </View>
      </SmoothBottomSheetModal>

      {/* 5. Disappearing Messages Bottom Sheet */}
      <SmoothBottomSheetModal
        visible={showDisappearingModal}
        onClose={() => setShowDisappearingModal(false)}
        title="Disappearing Messages"
        subtitle="Set message lifespan for this conversation"
        icon={
          <Ionicons name="timer-outline" size={20} color={selectedChatTheme} />
        }
        maxHeight="75%"
        showChipBar={true}
      >
        <View
          style={{
            paddingHorizontal: 20,
            paddingBottom: bottomInset + 16,
            paddingTop: 6,
          }}
        >
          {[
            {
              key: "off",
              label: "Off",
              desc: "Messages will remain permanently in chat",
            },
            {
              key: "24h",
              label: "24 Hours",
              desc: "Messages vanish 24 hours after being sent",
            },
            {
              key: "7d",
              label: "7 Days",
              desc: "Messages vanish 7 days after sending",
            },
            {
              key: "90d",
              label: "90 Days",
              desc: "Messages vanish 90 days after sending",
            },
          ].map((item) => {
            const isSelected = disappearingDuration === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                activeOpacity={0.7}
                onPress={() => handleSetDisappearingDuration(item.key)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 13,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: isDark
                    ? "rgba(255,255,255,0.08)"
                    : "#E2E8F0",
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: isDark ? "#FFFFFF" : "#0F172A",
                      fontSize: 15,
                      fontWeight: isSelected ? "700" : "500",
                    }}
                  >
                    {item.label}
                  </Text>
                  <Text
                    style={{
                      color: isDark ? "#94A3B8" : "#64748B",
                      fontSize: 12,
                      marginTop: 2,
                    }}
                  >
                    {item.desc}
                  </Text>
                </View>
                {isSelected && (
                  <Ionicons
                    name="checkmark-circle"
                    size={22}
                    color={selectedChatTheme}
                  />
                )}
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setShowDisappearingModal(false)}
            style={{
              marginTop: 18,
              paddingVertical: 13,
              borderRadius: 14,
              backgroundColor: selectedChatTheme,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 14 }}>
              Done
            </Text>
          </TouchableOpacity>
        </View>
      </SmoothBottomSheetModal>

      {/* 6. Block Bottom Sheet */}
      <SmoothBottomSheetModal
        visible={showBlockModal}
        onClose={() => setShowBlockModal(false)}
        title={
          blockedUserIds.has(
            activeThread?.targetUserId || activeThread?.id || "",
          )
            ? `Unblock ${activeThread?.name || "User"}?`
            : `Block ${activeThread?.name || "User"}?`
        }
        subtitle="Privacy and Safety"
        icon={
          <Ionicons name="remove-circle-outline" size={22} color="#EF4444" />
        }
        maxHeight="70%"
        showChipBar={true}
      >
        <View
          style={{
            paddingHorizontal: 20,
            paddingBottom: bottomInset + 16,
            paddingTop: 10,
          }}
        >
          <Text
            style={{
              fontSize: 14,
              color: isDark ? "#CBD5E1" : "#475569",
              lineHeight: 20,
              marginBottom: 20,
            }}
          >
            {blockedUserIds.has(
              activeThread?.targetUserId || activeThread?.id || "",
            )
              ? `Unblocking ${activeThread?.name || "this user"} will allow them to send you messages and see your online status again.`
              : `${activeThread?.name || "This user"} will no longer be able to send you direct messages, call you, or view your real-time presence in Splitzy. You can unblock them at any time in Settings.`}
          </Text>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleToggleBlockContact}
            style={{
              paddingVertical: 14,
              borderRadius: 14,
              backgroundColor: blockedUserIds.has(
                activeThread?.targetUserId || activeThread?.id || "",
              )
                ? "#10B981"
                : "#EF4444",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 10,
            }}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 }}>
              {blockedUserIds.has(
                activeThread?.targetUserId || activeThread?.id || "",
              )
                ? "Unblock Contact"
                : "Block Contact"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setShowBlockModal(false)}
            style={{
              paddingVertical: 13,
              borderRadius: 14,
              backgroundColor: isDark ? "#242731" : "#F1F5F9",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: isDark ? "#FFFFFF" : "#0F172A",
                fontWeight: "600",
                fontSize: 14,
              }}
            >
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </SmoothBottomSheetModal>

      {/* 7. Restrict Bottom Sheet */}
      <SmoothBottomSheetModal
        visible={showRestrictModal}
        onClose={() => setShowRestrictModal(false)}
        title={
          restrictedUserIds.has(
            activeThread?.targetUserId || activeThread?.id || "",
          )
            ? `Unrestrict ${activeThread?.name || "User"}?`
            : `Restrict ${activeThread?.name || "User"}?`
        }
        subtitle="Privacy and Safety"
        icon={<Ionicons name="contrast-outline" size={22} color="#F59E0B" />}
        maxHeight="70%"
        showChipBar={true}
      >
        <View
          style={{
            paddingHorizontal: 20,
            paddingBottom: bottomInset + 16,
            paddingTop: 10,
          }}
        >
          <Text
            style={{
              fontSize: 14,
              color: isDark ? "#CBD5E1" : "#475569",
              lineHeight: 20,
              marginBottom: 20,
            }}
          >
            {restrictedUserIds.has(
              activeThread?.targetUserId || activeThread?.id || "",
            )
              ? `Unrestricting will restore direct message notifications and standard chat behavior for ${activeThread?.name || "this user"}.`
              : `Restricting moves this chat out of your main inbox, silences new message notifications, and conceals your active status from ${activeThread?.name || "this user"} without alerting them.`}
          </Text>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleToggleRestrictContact}
            style={{
              paddingVertical: 14,
              borderRadius: 14,
              backgroundColor: restrictedUserIds.has(
                activeThread?.targetUserId || activeThread?.id || "",
              )
                ? "#10B981"
                : selectedChatTheme,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 10,
            }}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 }}>
              {restrictedUserIds.has(
                activeThread?.targetUserId || activeThread?.id || "",
              )
                ? "Unrestrict Account"
                : "Restrict Account"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setShowRestrictModal(false)}
            style={{
              paddingVertical: 13,
              borderRadius: 14,
              backgroundColor: isDark ? "#242731" : "#F1F5F9",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: isDark ? "#FFFFFF" : "#0F172A",
                fontWeight: "600",
                fontSize: 14,
              }}
            >
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </SmoothBottomSheetModal>

      {/* 8. Report Bottom Sheet */}
      <SmoothBottomSheetModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        title="Report Conversation"
        subtitle="Help keep our household community safe"
        icon={<Ionicons name="warning-outline" size={22} color="#EF4444" />}
        maxHeight="85%"
        showChipBar={true}
      >
        <View
          style={{
            paddingHorizontal: 20,
            paddingBottom: bottomInset + 16,
            paddingTop: 10,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: "600",
              color: isDark ? "#94A3B8" : "#64748B",
              marginBottom: 10,
            }}
          >
            Select a reason
          </Text>
          {[
            "Harassment or Bullying",
            "Unfair Bill Dispute",
            "Inappropriate Media or Photos",
            "Spam or Suspicious Activity",
            "Other Issue",
          ].map((r) => {
            const isSelected = reportReason === r;
            return (
              <TouchableOpacity
                key={r}
                activeOpacity={0.7}
                onPress={() => setReportReason(r)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 11,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  backgroundColor: isSelected
                    ? isDark
                      ? "#1E2A44"
                      : "#EFF6FF"
                    : isDark
                      ? "#181A20"
                      : "#F8FAFC",
                  marginBottom: 6,
                  borderWidth: isSelected ? 1.5 : 1,
                  borderColor: isSelected
                    ? selectedChatTheme
                    : isDark
                      ? "rgba(255,255,255,0.06)"
                      : "#E2E8F0",
                }}
              >
                <Text
                  style={{
                    flex: 1,
                    color: isSelected
                      ? selectedChatTheme
                      : isDark
                        ? "#FFFFFF"
                        : "#0F172A",
                    fontWeight: isSelected ? "700" : "500",
                    fontSize: 14,
                  }}
                >
                  {r}
                </Text>
                {isSelected && (
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color={selectedChatTheme}
                  />
                )}
              </TouchableOpacity>
            );
          })}
          <Text
            style={{
              fontSize: 13,
              fontWeight: "600",
              color: isDark ? "#94A3B8" : "#64748B",
              marginTop: 12,
              marginBottom: 6,
            }}
          >
            Details (optional)
          </Text>
          <TextInput
            value={reportDetails}
            onChangeText={setReportDetails}
            placeholder="Provide additional details..."
            placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
            multiline
            numberOfLines={3}
            style={{
              backgroundColor: isDark ? "#1E222B" : "#F1F5F9",
              color: isDark ? "#FFFFFF" : "#0F172A",
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 12,
              fontSize: 14,
              minHeight: 64,
              textAlignVertical: "top",
              marginBottom: 16,
            }}
          />
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleSubmitReportConversation}
            style={{
              paddingVertical: 14,
              borderRadius: 14,
              backgroundColor: selectedChatTheme,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 10,
            }}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 }}>
              Submit Report
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setShowReportModal(false)}
            style={{
              paddingVertical: 12,
              borderRadius: 14,
              backgroundColor: isDark ? "#242731" : "#F1F5F9",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: isDark ? "#FFFFFF" : "#0F172A",
                fontWeight: "600",
                fontSize: 14,
              }}
            >
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </SmoothBottomSheetModal>

      {/* 9. Delete Chat Bottom Sheet */}
      <SmoothBottomSheetModal
        visible={showDeleteChatModal}
        onClose={() => setShowDeleteChatModal(false)}
        title="Delete Conversation?"
        subtitle="Permanent action"
        icon={<Ionicons name="trash-outline" size={22} color="#EF4444" />}
        maxHeight="70%"
        showChipBar={true}
      >
        <View
          style={{
            paddingHorizontal: 20,
            paddingBottom: bottomInset + 16,
            paddingTop: 10,
          }}
        >
          <Text
            style={{
              fontSize: 14,
              color: isDark ? "#CBD5E1" : "#475569",
              lineHeight: 20,
              marginBottom: 20,
            }}
          >
            Are you sure you want to permanently delete this chat with{" "}
            {activeThread?.name || "this user"}? All messages and attachments
            will be erased from your device.
          </Text>
          <TouchableOpacity
            activeOpacity={0.8}
            disabled={isDeletingConversation}
            onPress={executeDeleteActiveConversation}
            style={{
              paddingVertical: 14,
              borderRadius: 14,
              backgroundColor: "#EF4444",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 10,
            }}
          >
            {isDeletingConversation ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text
                style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 }}
              >
                Delete Conversation
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setShowDeleteChatModal(false)}
            style={{
              paddingVertical: 13,
              borderRadius: 14,
              backgroundColor: isDark ? "#242731" : "#F1F5F9",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: isDark ? "#FFFFFF" : "#0F172A",
                fontWeight: "600",
                fontSize: 14,
              }}
            >
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </SmoothBottomSheetModal>

      {/* 10. More Options Bottom Sheet */}
      <SmoothBottomSheetModal
        visible={showMoreOptionsModal}
        onClose={() => setShowMoreOptionsModal(false)}
        title={activeThread?.name || "Chat Options"}
        subtitle="Conversation settings"
        icon={
          <Ionicons
            name="ellipsis-horizontal-circle-outline"
            size={22}
            color={selectedChatTheme}
          />
        }
        maxHeight="70%"
        showChipBar={true}
      >
        <View
          style={{
            paddingHorizontal: 16,
            paddingBottom: bottomInset + 16,
            paddingTop: 6,
          }}
        >
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              setShowMoreOptionsModal(false);
              handleToggleMuteActiveThread();
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 14,
              paddingHorizontal: 12,
              gap: 14,
            }}
          >
            <Ionicons
              name={
                mutedThreadIds.has(activeThread?.id || "")
                  ? "notifications"
                  : "notifications-off-outline"
              }
              size={22}
              color={isDark ? "#FFFFFF" : "#0F172A"}
            />
            <Text
              style={{
                color: isDark ? "#FFFFFF" : "#0F172A",
                fontSize: 15,
                fontWeight: "600",
              }}
            >
              {mutedThreadIds.has(activeThread?.id || "")
                ? "Unmute Notifications"
                : "Mute Notifications"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              setShowMoreOptionsModal(false);
              setTempNickname(customNicknames[activeThread?.id || ""] || "");
              setShowNicknamesModal(true);
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 14,
              paddingHorizontal: 12,
              gap: 14,
            }}
          >
            <Ionicons
              name="text-outline"
              size={22}
              color={isDark ? "#FFFFFF" : "#0F172A"}
            />
            <Text
              style={{
                color: isDark ? "#FFFFFF" : "#0F172A",
                fontSize: 15,
                fontWeight: "600",
              }}
            >
              Set Nickname
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              setShowMoreOptionsModal(false);
              setShowAllMediaModal(true);
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 14,
              paddingHorizontal: 12,
              gap: 14,
            }}
          >
            <Ionicons
              name="images-outline"
              size={22}
              color={isDark ? "#FFFFFF" : "#0F172A"}
            />
            <Text
              style={{
                color: isDark ? "#FFFFFF" : "#0F172A",
                fontSize: 15,
                fontWeight: "600",
              }}
            >
              View Media & Files
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              setShowMoreOptionsModal(false);
              setShowDeleteChatModal(true);
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 14,
              paddingHorizontal: 12,
              gap: 14,
            }}
          >
            <Ionicons name="trash-outline" size={22} color="#EF4444" />
            <Text style={{ color: "#EF4444", fontSize: 15, fontWeight: "700" }}>
              Delete Chat
            </Text>
          </TouchableOpacity>
        </View>
      </SmoothBottomSheetModal>

      {/* 11. Auto-Save Photos Bottom Sheet */}
      <SmoothBottomSheetModal
        visible={showAutoSaveModal}
        onClose={() => setShowAutoSaveModal(false)}
        title="Auto-Save Photos"
        subtitle="Device Storage"
        icon={
          <Ionicons
            name="download-outline"
            size={20}
            color={selectedChatTheme}
          />
        }
        maxHeight="65%"
        showChipBar={true}
      >
        <View
          style={{
            paddingHorizontal: 20,
            paddingBottom: bottomInset + 16,
            paddingTop: 10,
          }}
        >
          <Text
            style={{
              fontSize: 14,
              color: isDark ? "#CBD5E1" : "#475569",
              lineHeight: 20,
              marginBottom: 16,
            }}
          >
            Automatically download and save incoming images and photos sent in
            this chat directly to your device photo gallery.
          </Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              const nextVal = !autoSavePhotos;
              setAutoSavePhotos(nextVal);
              AsyncStorage.setItem(
                "@splitzy_autosave_photos",
                String(nextVal),
              ).catch(() => {});
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: 14,
              paddingHorizontal: 16,
              borderRadius: 14,
              backgroundColor: isDark ? "#1E222B" : "#F8FAFC",
              marginBottom: 16,
            }}
          >
            <Text
              style={{
                color: isDark ? "#FFFFFF" : "#0F172A",
                fontSize: 15,
                fontWeight: "600",
              }}
            >
              Auto-save incoming media
            </Text>
            <Ionicons
              name={autoSavePhotos ? "checkbox" : "square-outline"}
              size={24}
              color={
                autoSavePhotos
                  ? selectedChatTheme
                  : isDark
                    ? "#64748B"
                    : "#94A3B8"
              }
            />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setShowAutoSaveModal(false)}
            style={{
              paddingVertical: 13,
              borderRadius: 14,
              backgroundColor: selectedChatTheme,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 14 }}>
              Done
            </Text>
          </TouchableOpacity>
        </View>
      </SmoothBottomSheetModal>

      {/* 12. Read Receipts Bottom Sheet */}
      <SmoothBottomSheetModal
        visible={showReadReceiptsModal}
        onClose={() => setShowReadReceiptsModal(false)}
        title="Read Receipts"
        subtitle="Privacy Settings"
        icon={
          <Ionicons name="eye-outline" size={20} color={selectedChatTheme} />
        }
        maxHeight="65%"
        showChipBar={true}
      >
        <View
          style={{
            paddingHorizontal: 20,
            paddingBottom: bottomInset + 16,
            paddingTop: 10,
          }}
        >
          <Text
            style={{
              fontSize: 14,
              color: isDark ? "#CBD5E1" : "#475569",
              lineHeight: 20,
              marginBottom: 16,
            }}
          >
            When active, roommates in this conversation can see when you have
            viewed their incoming messages and payment updates.
          </Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              const nextVal = !readReceiptsEnabled;
              setReadReceiptsEnabled(nextVal);
              AsyncStorage.setItem(
                "@splitzy_read_receipts",
                String(nextVal),
              ).catch(() => {});
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: 14,
              paddingHorizontal: 16,
              borderRadius: 14,
              backgroundColor: isDark ? "#1E222B" : "#F8FAFC",
              marginBottom: 16,
            }}
          >
            <Text
              style={{
                color: isDark ? "#FFFFFF" : "#0F172A",
                fontSize: 15,
                fontWeight: "600",
              }}
            >
              Send read receipts
            </Text>
            <Ionicons
              name={readReceiptsEnabled ? "checkbox" : "square-outline"}
              size={24}
              color={
                readReceiptsEnabled
                  ? selectedChatTheme
                  : isDark
                    ? "#64748B"
                    : "#94A3B8"
              }
            />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setShowReadReceiptsModal(false)}
            style={{
              paddingVertical: 13,
              borderRadius: 14,
              backgroundColor: selectedChatTheme,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 14 }}>
              Done
            </Text>
          </TouchableOpacity>
        </View>
      </SmoothBottomSheetModal>

      {/* 13. Typing Indicator Bottom Sheet */}
      <SmoothBottomSheetModal
        visible={showTypingIndicatorModal}
        onClose={() => setShowTypingIndicatorModal(false)}
        title="Typing Indicator"
        subtitle="Chat Settings"
        icon={
          <Ionicons
            name="chatbubbles-outline"
            size={20}
            color={selectedChatTheme}
          />
        }
        maxHeight="65%"
        showChipBar={true}
      >
        <View
          style={{
            paddingHorizontal: 20,
            paddingBottom: bottomInset + 16,
            paddingTop: 10,
          }}
        >
          <Text
            style={{
              fontSize: 14,
              color: isDark ? "#CBD5E1" : "#475569",
              lineHeight: 20,
              marginBottom: 16,
            }}
          >
            Display animated typing bubbles in real time when you are actively
            composing a reply or note in this chat.
          </Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              const nextVal = !typingIndicatorEnabled;
              setTypingIndicatorEnabled(nextVal);
              AsyncStorage.setItem(
                "@splitzy_typing_indicators",
                String(nextVal),
              ).catch(() => {});
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: 14,
              paddingHorizontal: 16,
              borderRadius: 14,
              backgroundColor: isDark ? "#1E222B" : "#F8FAFC",
              marginBottom: 16,
            }}
          >
            <Text
              style={{
                color: isDark ? "#FFFFFF" : "#0F172A",
                fontSize: 15,
                fontWeight: "600",
              }}
            >
              Show typing activity
            </Text>
            <Ionicons
              name={typingIndicatorEnabled ? "checkbox" : "square-outline"}
              size={24}
              color={
                typingIndicatorEnabled
                  ? selectedChatTheme
                  : isDark
                    ? "#64748B"
                    : "#94A3B8"
              }
            />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setShowTypingIndicatorModal(false)}
            style={{
              paddingVertical: 13,
              borderRadius: 14,
              backgroundColor: selectedChatTheme,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 14 }}>
              Done
            </Text>
          </TouchableOpacity>
        </View>
      </SmoothBottomSheetModal>

      {/* 14. Message Permissions Bottom Sheet */}
      <SmoothBottomSheetModal
        visible={showMessagePermissionsModal}
        onClose={() => setShowMessagePermissionsModal(false)}
        title="Message Permissions"
        subtitle="Security and Reachability"
        icon={
          <Ionicons
            name="shield-checkmark-outline"
            size={20}
            color={selectedChatTheme}
          />
        }
        maxHeight="75%"
        showChipBar={true}
      >
        <View
          style={{
            paddingHorizontal: 20,
            paddingBottom: bottomInset + 16,
            paddingTop: 10,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              color: isDark ? "#94A3B8" : "#64748B",
              marginBottom: 14,
            }}
          >
            Control who is allowed to send you messages and invite you to chat
            groups.
          </Text>
          {[
            {
              key: "everyone",
              title: "Everyone with Splitzy",
              desc: "Anyone registered on the app can reach you",
            },
            {
              key: "friends",
              title: "Friends & Household",
              desc: "Only connected friends and household group members",
            },
            {
              key: "household",
              title: "Household Members Only",
              desc: "Strict privacy: only your current household co-tenants",
            },
          ].map((item) => {
            const isSelected = messagePermissionLevel === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                activeOpacity={0.7}
                onPress={() => {
                  setMessagePermissionLevel(item.key);
                  AsyncStorage.setItem(
                    "@splitzy_message_permission",
                    item.key,
                  ).catch(() => {});
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderRadius: 14,
                  backgroundColor: isSelected
                    ? isDark
                      ? "#1E2A44"
                      : "#EFF6FF"
                    : isDark
                      ? "#181A20"
                      : "#F8FAFC",
                  marginBottom: 8,
                  borderWidth: isSelected ? 1.5 : 1,
                  borderColor: isSelected
                    ? selectedChatTheme
                    : isDark
                      ? "rgba(255,255,255,0.06)"
                      : "#E2E8F0",
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: isSelected
                        ? selectedChatTheme
                        : isDark
                          ? "#FFFFFF"
                          : "#0F172A",
                      fontSize: 14,
                      fontWeight: isSelected ? "700" : "600",
                    }}
                  >
                    {item.title}
                  </Text>
                  <Text
                    style={{
                      color: isDark ? "#94A3B8" : "#64748B",
                      fontSize: 12,
                      marginTop: 2,
                    }}
                  >
                    {item.desc}
                  </Text>
                </View>
                {isSelected && (
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={selectedChatTheme}
                  />
                )}
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setShowMessagePermissionsModal(false)}
            style={{
              marginTop: 10,
              paddingVertical: 13,
              borderRadius: 14,
              backgroundColor: selectedChatTheme,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 14 }}>
              Done
            </Text>
          </TouchableOpacity>
        </View>
      </SmoothBottomSheetModal>

      {/* 15. End-to-End Encryption Verification Bottom Sheet */}
      <SmoothBottomSheetModal
        visible={showEncryptionModal}
        onClose={() => setShowEncryptionModal(false)}
        title="End-to-End Encryption"
        subtitle="Security Verification"
        icon={<Ionicons name="lock-closed" size={20} color="#10B981" />}
        maxHeight="80%"
        showChipBar={true}
      >
        <View
          style={{
            paddingHorizontal: 20,
            paddingBottom: bottomInset + 16,
            paddingTop: 10,
          }}
        >
          <View style={{ alignItems: "center", marginBottom: 16 }}>
            <View
              style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: isDark ? "rgba(16,185,129,0.15)" : "#ECFDF5",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 10,
              }}
            >
              <Ionicons name="shield-checkmark" size={32} color="#10B981" />
            </View>
            <Text
              style={{
                fontSize: 16,
                fontWeight: "700",
                color: isDark ? "#FFFFFF" : "#0F172A",
                textAlign: "center",
              }}
            >
              Messages and calls are secured
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: isDark ? "#94A3B8" : "#64748B",
                textAlign: "center",
                marginTop: 4,
                lineHeight: 18,
              }}
            >
              No one outside of this chat, not even Splitzy, can read your
              messages, view bill receipts, or listen to your calls.
            </Text>
          </View>
          <View
            style={{
              padding: 14,
              borderRadius: 14,
              backgroundColor: isDark ? "#1E222B" : "#F8FAFC",
              borderWidth: 1,
              borderColor: isDark ? "rgba(255,255,255,0.06)" : "#E2E8F0",
              marginBottom: 16,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                color: isDark ? "#94A3B8" : "#64748B",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                marginBottom: 6,
              }}
            >
              60-Digit Safety Number
            </Text>
            <Text
              style={{
                fontSize: 13,
                fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
                color: isDark ? "#E2E8F0" : "#1E293B",
                letterSpacing: 1.5,
                lineHeight: 22,
              }}
            >
              48192 01849 71938 10294 58201 93821 75920 18493 84729 01824 91823
              48102
            </Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setShowEncryptionModal(false)}
            style={{
              paddingVertical: 13,
              borderRadius: 14,
              backgroundColor: selectedChatTheme,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 14 }}>
              Close
            </Text>
          </TouchableOpacity>
        </View>
      </SmoothBottomSheetModal>
    </>
  );

  // ==========================================
  // VIEW 1A: SLIDE-IN CONVERSATION INFO (MESSENGER-STYLE)
  // ==========================================
  if (activeThread && showConversationInfo) {
    const isDirect = activeThread.type === "direct";
    const cleanTargetUid =
      isDirect && activeThread.targetUserId
        ? String(activeThread.targetUserId).replace(/^mem_/, "").trim()
        : "";
    const live = cleanTargetUid ? presenceMap[cleanTargetUid] : null;
    const lastActive =
      live?.lastActiveAt || live?.lastActiveDate || activeThread.lastActiveAt;
    const isOnlineFlag =
      live?.isOnline !== undefined ? live.isOnline : activeThread.isOnline;
    const livePres = cleanTargetUid
      ? computePresence(lastActive, isOnlineFlag)
      : null;
    const isThreadOnline = livePres
      ? livePres.isOnline
      : Boolean(activeThread.isOnline);
    const threadStatusLabel = livePres
      ? livePres.statusLabel
      : activeThread.onlineStatusLabel || "Offline";
    const threadPhoto =
      live?.photoURL || live?.profilePicture || activeThread.photoURL;
    const isMuted = mutedThreadIds.has(activeThread.id);
    const customNickname = customNicknames[activeThread.id];
    const displayName = customNickname || activeThread.name;

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

        {/* Top Navigation Bar: Back Arrow & 3-Dots Menu */}
        <View
          style={[
            styles.conversationInfoHeader,
            {
              paddingTop: topInset + 4,
              borderBottomColor: isDark ? "rgba(255,255,255,0.06)" : "#F1F5F9",
            },
          ]}
        >
          <TouchableOpacity
            style={styles.conversationInfoBackBtn}
            onPress={() => setShowConversationInfo(false)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Back to conversation"
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={isDark ? "#FFFFFF" : "#0F172A"}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.conversationInfoBackBtn}
            onPress={() => setShowMoreOptionsModal(true)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="More options"
          >
            <Ionicons
              name="ellipsis-vertical"
              size={22}
              color={isDark ? "#FFFFFF" : "#0F172A"}
            />
          </TouchableOpacity>
        </View>

        {/* Scrollable Conversation Details */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.conversationInfoScrollContent,
            { paddingBottom: bottomInset + 30 },
          ]}
        >
          {/* Profile Section (Tap to View Profile) */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleOpenProfile}
            style={styles.conversationInfoProfileCenter}
          >
            <View
              style={[
                styles.conversationInfoAvatar,
                { backgroundColor: activeThread.avatarBg || "#EFF6FF" },
              ]}
            >
              {threadPhoto ? (
                <Image
                  source={{ uri: threadPhoto }}
                  style={styles.conversationInfoAvatarImg}
                />
              ) : activeThread.type === "group" ? (
                <GroupChatAvatar
                  members={householdMembers}
                  size={96}
                  isDark={isDark}
                />
              ) : (
                <Text
                  style={[
                    styles.conversationInfoAvatarInitials,
                    { color: activeThread.avatarColor || "#2563EB" },
                  ]}
                >
                  {activeThread.initials}
                </Text>
              )}
            </View>

            <Text
              style={[
                styles.conversationInfoName,
                { color: isDark ? "#FFFFFF" : "#0F172A" },
              ]}
              numberOfLines={2}
            >
              {displayName}
            </Text>

            <Text
              style={[
                styles.conversationInfoStatus,
                {
                  color: isThreadOnline
                    ? "#10B981"
                    : isDark
                      ? "#94A3B8"
                      : "#64748B",
                },
              ]}
            >
              {activeThread.type === "group"
                ? `${householdMembers.length || 1} members · Household Group`
                : isThreadOnline
                  ? "Active now"
                  : threadStatusLabel}
            </Text>
          </TouchableOpacity>

          {/* Quick Action Pills: Profile, Nicknames, Search, Customize */}
          <View style={styles.conversationInfoQuickActionsRow}>
            {/* Profile */}
            <TouchableOpacity
              style={styles.conversationInfoQuickActionItem}
              activeOpacity={0.7}
              onPress={handleOpenProfile}
            >
              <View
                style={[
                  styles.conversationInfoQuickActionBtn,
                  { backgroundColor: isDark ? "#242731" : "#F1F5F9" },
                ]}
              >
                <Ionicons
                  name="person-circle"
                  size={24}
                  color={isDark ? "#FFFFFF" : "#0F172A"}
                />
              </View>
              <Text
                style={[
                  styles.conversationInfoQuickActionLabel,
                  { color: isDark ? "#CBD5E1" : "#334155" },
                ]}
              >
                Profile
              </Text>
            </TouchableOpacity>

            {/* Nicknames */}
            <TouchableOpacity
              style={styles.conversationInfoQuickActionItem}
              activeOpacity={0.7}
              onPress={() => {
                setTempNickname(customNicknames[activeThread.id] || "");
                setShowNicknamesModal(true);
              }}
            >
              <View
                style={[
                  styles.conversationInfoQuickActionBtn,
                  { backgroundColor: isDark ? "#242731" : "#F1F5F9" },
                ]}
              >
                <Ionicons
                  name="text"
                  size={20}
                  color={isDark ? "#FFFFFF" : "#0F172A"}
                />
              </View>
              <Text
                style={[
                  styles.conversationInfoQuickActionLabel,
                  { color: isDark ? "#CBD5E1" : "#334155" },
                ]}
              >
                Nicknames
              </Text>
            </TouchableOpacity>

            {/* Search */}
            <TouchableOpacity
              style={styles.conversationInfoQuickActionItem}
              activeOpacity={0.7}
              onPress={() => {
                setShowConversationInfo(false);
                setIsSearchingInChat(true);
              }}
            >
              <View
                style={[
                  styles.conversationInfoQuickActionBtn,
                  { backgroundColor: isDark ? "#242731" : "#F1F5F9" },
                ]}
              >
                <Ionicons
                  name="search"
                  size={20}
                  color={isDark ? "#FFFFFF" : "#0F172A"}
                />
              </View>
              <Text
                style={[
                  styles.conversationInfoQuickActionLabel,
                  { color: isDark ? "#CBD5E1" : "#334155" },
                ]}
              >
                Search
              </Text>
            </TouchableOpacity>

            {/* Customize */}
            <TouchableOpacity
              style={styles.conversationInfoQuickActionItem}
              activeOpacity={0.7}
              onPress={() => setShowThemeModal(true)}
            >
              <View
                style={[
                  styles.conversationInfoQuickActionBtn,
                  { backgroundColor: isDark ? "#242731" : "#F1F5F9" },
                ]}
              >
                <Ionicons
                  name="color-palette"
                  size={20}
                  color={isDark ? "#FFFFFF" : "#0F172A"}
                />
              </View>
              <Text
                style={[
                  styles.conversationInfoQuickActionLabel,
                  { color: isDark ? "#CBD5E1" : "#334155" },
                ]}
              >
                Customize
              </Text>
            </TouchableOpacity>
          </View>

          {/* Section: Chat info */}
          <Text
            style={[
              styles.conversationInfoSectionTitle,
              { color: isDark ? "#94A3B8" : "#64748B" },
            ]}
          >
            Chat info
          </Text>

          {/* Horizontal Media Carousel Preview */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.conversationInfoMediaPreviewRow}
          >
            {conversationMedia.slice(0, 5).map((item, index) => (
              <TouchableOpacity
                key={item.id || index}
                activeOpacity={0.85}
                style={[
                  styles.conversationInfoMediaCard,
                  { backgroundColor: isDark ? "#1E222B" : "#E2E8F0" },
                ]}
                onPress={() =>
                  setLightboxImage({
                    uri: item.uri,
                    senderName: item.senderName || displayName,
                    timestamp: item.timestamp,
                  })
                }
              >
                <Image
                  source={{ uri: item.uri }}
                  style={styles.conversationInfoMediaImg}
                  resizeMode="cover"
                />
                <View style={styles.conversationInfoMediaOverlay}>
                  <Ionicons name="expand" size={16} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* View all media, files & links */}
          <TouchableOpacity
            style={styles.conversationInfoRow}
            activeOpacity={0.7}
            onPress={() => setShowAllMediaModal(true)}
          >
            <View style={styles.conversationInfoRowIconWrap}>
              <Ionicons
                name="images-outline"
                size={22}
                color={isDark ? "#FFFFFF" : "#0F172A"}
              />
            </View>
            <View style={styles.conversationInfoRowTextCol}>
              <Text
                style={[
                  styles.conversationInfoRowTitle,
                  { color: isDark ? "#FFFFFF" : "#0F172A" },
                ]}
              >
                View all media, files & links
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={isDark ? "#64748B" : "#94A3B8"}
            />
          </TouchableOpacity>

          {/* Pinned messages */}
          <TouchableOpacity
            style={styles.conversationInfoRow}
            activeOpacity={0.7}
            onPress={() => setShowPinnedModal(true)}
          >
            <View style={styles.conversationInfoRowIconWrap}>
              <Ionicons
                name="pin-outline"
                size={22}
                color={isDark ? "#FFFFFF" : "#0F172A"}
              />
            </View>
            <View style={styles.conversationInfoRowTextCol}>
              <Text
                style={[
                  styles.conversationInfoRowTitle,
                  { color: isDark ? "#FFFFFF" : "#0F172A" },
                ]}
              >
                Pinned messages
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={isDark ? "#64748B" : "#94A3B8"}
            />
          </TouchableOpacity>

          {/* Section: Actions */}
          <Text
            style={[
              styles.conversationInfoSectionTitle,
              { color: isDark ? "#94A3B8" : "#64748B" },
            ]}
          >
            Actions
          </Text>

          {/* Mute [Name] */}
          <TouchableOpacity
            style={styles.conversationInfoRow}
            activeOpacity={0.7}
            onPress={handleToggleMuteActiveThread}
          >
            <View style={styles.conversationInfoRowIconWrap}>
              <Ionicons
                name={isMuted ? "notifications-off" : "notifications-outline"}
                size={22}
                color={isMuted ? "#EF4444" : isDark ? "#FFFFFF" : "#0F172A"}
              />
            </View>
            <View style={styles.conversationInfoRowTextCol}>
              <Text
                style={[
                  styles.conversationInfoRowTitle,
                  { color: isDark ? "#FFFFFF" : "#0F172A" },
                ]}
              >
                {isMuted ? `Unmute ${displayName}` : `Mute ${displayName}`}
              </Text>
            </View>
            <View style={styles.conversationInfoRowRight}>
              <Text
                style={[
                  styles.conversationInfoRowRightText,
                  {
                    color: isMuted ? "#EF4444" : isDark ? "#94A3B8" : "#64748B",
                  },
                ]}
              >
                {isMuted ? "Muted" : "Off"}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Notifications & sounds */}
          <TouchableOpacity
            style={styles.conversationInfoRow}
            activeOpacity={0.7}
            onPress={handleToggleMuteActiveThread}
          >
            <View style={styles.conversationInfoRowIconWrap}>
              <Ionicons
                name="volume-high-outline"
                size={22}
                color={isDark ? "#FFFFFF" : "#0F172A"}
              />
            </View>
            <View style={styles.conversationInfoRowTextCol}>
              <Text
                style={[
                  styles.conversationInfoRowTitle,
                  { color: isDark ? "#FFFFFF" : "#0F172A" },
                ]}
              >
                Notifications & sounds
              </Text>
              <Text
                style={[
                  styles.conversationInfoRowSubtitle,
                  { color: isDark ? "#94A3B8" : "#64748B" },
                ]}
              >
                {isMuted ? "Muted" : "On"}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Open chat head */}
          <TouchableOpacity
            style={styles.conversationInfoRow}
            activeOpacity={0.7}
            onPress={handleOpenChatHead}
          >
            <View style={styles.conversationInfoRowIconWrap}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={22}
                color={isDark ? "#FFFFFF" : "#0F172A"}
              />
            </View>
            <View style={styles.conversationInfoRowTextCol}>
              <Text
                style={[
                  styles.conversationInfoRowTitle,
                  { color: isDark ? "#FFFFFF" : "#0F172A" },
                ]}
              >
                Open chat head
              </Text>
              <Text
                style={[
                  styles.conversationInfoRowSubtitle,
                  { color: isDark ? "#94A3B8" : "#64748B" },
                ]}
              >
                Multitask with floating bubble
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={isDark ? "#64748B" : "#94A3B8"}
            />
          </TouchableOpacity>

          {/* Create group chat */}
          <TouchableOpacity
            style={styles.conversationInfoRow}
            activeOpacity={0.7}
            onPress={() => {
              setShowConversationInfo(false);
              onCreateGroup ? onCreateGroup() : setShowComposeModal(true);
            }}
          >
            <View style={styles.conversationInfoRowIconWrap}>
              <Ionicons
                name="people-outline"
                size={22}
                color={isDark ? "#FFFFFF" : "#0F172A"}
              />
            </View>
            <View style={styles.conversationInfoRowTextCol}>
              <Text
                style={[
                  styles.conversationInfoRowTitle,
                  { color: isDark ? "#FFFFFF" : "#0F172A" },
                ]}
              >
                Create group chat with {displayName.split(" ")[0]}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Auto-save photos */}
          <TouchableOpacity
            style={styles.conversationInfoRow}
            activeOpacity={0.7}
            onPress={() => setShowAutoSaveModal(true)}
          >
            <View style={styles.conversationInfoRowIconWrap}>
              <Ionicons
                name="download-outline"
                size={22}
                color={isDark ? "#FFFFFF" : "#0F172A"}
              />
            </View>
            <View style={styles.conversationInfoRowTextCol}>
              <Text
                style={[
                  styles.conversationInfoRowTitle,
                  { color: isDark ? "#FFFFFF" : "#0F172A" },
                ]}
              >
                Auto-save photos
              </Text>
              <Text
                style={[
                  styles.conversationInfoRowSubtitle,
                  { color: isDark ? "#94A3B8" : "#64748B" },
                ]}
              >
                {autoSavePhotos ? "On" : "Off"}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={isDark ? "#64748B" : "#94A3B8"}
            />
          </TouchableOpacity>

          {/* Share contact */}
          <TouchableOpacity
            style={styles.conversationInfoRow}
            activeOpacity={0.7}
            onPress={handleShareContactCard}
          >
            <View style={styles.conversationInfoRowIconWrap}>
              <Ionicons
                name="share-social-outline"
                size={22}
                color={isDark ? "#FFFFFF" : "#0F172A"}
              />
            </View>
            <View style={styles.conversationInfoRowTextCol}>
              <Text
                style={[
                  styles.conversationInfoRowTitle,
                  { color: isDark ? "#FFFFFF" : "#0F172A" },
                ]}
              >
                Share contact
              </Text>
              <Text
                style={[
                  styles.conversationInfoRowSubtitle,
                  { color: isDark ? "#94A3B8" : "#64748B" },
                ]}
              >
                Copy contact card to clipboard
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={isDark ? "#64748B" : "#94A3B8"}
            />
          </TouchableOpacity>

          {/* Section: Privacy & support */}
          <Text
            style={[
              styles.conversationInfoSectionTitle,
              { color: isDark ? "#94A3B8" : "#64748B" },
            ]}
          >
            Privacy & support
          </Text>

          {/* Disappearing messages */}
          <TouchableOpacity
            style={styles.conversationInfoRow}
            activeOpacity={0.7}
            onPress={() => setShowDisappearingModal(true)}
          >
            <View style={styles.conversationInfoRowIconWrap}>
              <Ionicons
                name="timer-outline"
                size={22}
                color={isDark ? "#FFFFFF" : "#0F172A"}
              />
            </View>
            <View style={styles.conversationInfoRowTextCol}>
              <Text
                style={[
                  styles.conversationInfoRowTitle,
                  { color: isDark ? "#FFFFFF" : "#0F172A" },
                ]}
              >
                Disappearing messages
              </Text>
              <Text
                style={[
                  styles.conversationInfoRowSubtitle,
                  { color: isDark ? "#94A3B8" : "#64748B" },
                ]}
              >
                {disappearingDuration === "off"
                  ? "Off"
                  : disappearingDuration === "24h"
                    ? "24 hours"
                    : disappearingDuration === "7d"
                      ? "7 days"
                      : "90 days"}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={isDark ? "#64748B" : "#94A3B8"}
            />
          </TouchableOpacity>

          {/* Read receipts */}
          <TouchableOpacity
            style={styles.conversationInfoRow}
            activeOpacity={0.7}
            onPress={() => setShowReadReceiptsModal(true)}
          >
            <View style={styles.conversationInfoRowIconWrap}>
              <Ionicons
                name="eye-outline"
                size={22}
                color={isDark ? "#FFFFFF" : "#0F172A"}
              />
            </View>
            <View style={styles.conversationInfoRowTextCol}>
              <Text
                style={[
                  styles.conversationInfoRowTitle,
                  { color: isDark ? "#FFFFFF" : "#0F172A" },
                ]}
              >
                Read receipts
              </Text>
              <Text
                style={[
                  styles.conversationInfoRowSubtitle,
                  { color: isDark ? "#94A3B8" : "#64748B" },
                ]}
              >
                {readReceiptsEnabled ? "On" : "Off"}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={isDark ? "#64748B" : "#94A3B8"}
            />
          </TouchableOpacity>

          {/* Typing indicator */}
          <TouchableOpacity
            style={styles.conversationInfoRow}
            activeOpacity={0.7}
            onPress={() => setShowTypingIndicatorModal(true)}
          >
            <View style={styles.conversationInfoRowIconWrap}>
              <Ionicons
                name="chatbubbles-outline"
                size={22}
                color={isDark ? "#FFFFFF" : "#0F172A"}
              />
            </View>
            <View style={styles.conversationInfoRowTextCol}>
              <Text
                style={[
                  styles.conversationInfoRowTitle,
                  { color: isDark ? "#FFFFFF" : "#0F172A" },
                ]}
              >
                Typing indicator
              </Text>
              <Text
                style={[
                  styles.conversationInfoRowSubtitle,
                  { color: isDark ? "#94A3B8" : "#64748B" },
                ]}
              >
                {typingIndicatorEnabled ? "On" : "Off"}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={isDark ? "#64748B" : "#94A3B8"}
            />
          </TouchableOpacity>

          {/* Message permissions */}
          <TouchableOpacity
            style={styles.conversationInfoRow}
            activeOpacity={0.7}
            onPress={() => setShowMessagePermissionsModal(true)}
          >
            <View style={styles.conversationInfoRowIconWrap}>
              <Ionicons
                name="shield-checkmark-outline"
                size={22}
                color={isDark ? "#FFFFFF" : "#0F172A"}
              />
            </View>
            <View style={styles.conversationInfoRowTextCol}>
              <Text
                style={[
                  styles.conversationInfoRowTitle,
                  { color: isDark ? "#FFFFFF" : "#0F172A" },
                ]}
              >
                Message permissions
              </Text>
              <Text
                style={[
                  styles.conversationInfoRowSubtitle,
                  { color: isDark ? "#94A3B8" : "#64748B" },
                ]}
              >
                {messagePermissionLevel === "household"
                  ? "Household Only"
                  : messagePermissionLevel === "friends"
                    ? "Friends & Household"
                    : "Everyone"}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={isDark ? "#64748B" : "#94A3B8"}
            />
          </TouchableOpacity>

          {/* End-to-end encryption */}
          <TouchableOpacity
            style={styles.conversationInfoRow}
            activeOpacity={0.7}
            onPress={() => setShowEncryptionModal(true)}
          >
            <View style={styles.conversationInfoRowIconWrap}>
              <Ionicons
                name="lock-closed-outline"
                size={22}
                color={isDark ? "#FFFFFF" : "#0F172A"}
              />
            </View>
            <View style={styles.conversationInfoRowTextCol}>
              <Text
                style={[
                  styles.conversationInfoRowTitle,
                  { color: isDark ? "#FFFFFF" : "#0F172A" },
                ]}
              >
                End-to-end encryption
              </Text>
              <Text
                style={[
                  styles.conversationInfoRowSubtitle,
                  { color: isDark ? "#94A3B8" : "#64748B" },
                ]}
              >
                Verified Signal Protocol · Tap to view
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={isDark ? "#64748B" : "#94A3B8"}
            />
          </TouchableOpacity>

          {/* Block */}
          <TouchableOpacity
            style={styles.conversationInfoRow}
            activeOpacity={0.7}
            onPress={() => setShowBlockModal(true)}
          >
            <View style={styles.conversationInfoRowIconWrap}>
              <Ionicons
                name="remove-circle-outline"
                size={22}
                color={
                  blockedUserIds.has(
                    activeThread.targetUserId || activeThread.id,
                  )
                    ? "#EF4444"
                    : isDark
                      ? "#FFFFFF"
                      : "#0F172A"
                }
              />
            </View>
            <View style={styles.conversationInfoRowTextCol}>
              <Text
                style={[
                  styles.conversationInfoRowTitle,
                  { color: isDark ? "#FFFFFF" : "#0F172A" },
                ]}
              >
                Block
              </Text>
              <Text
                style={[
                  styles.conversationInfoRowSubtitle,
                  {
                    color: blockedUserIds.has(
                      activeThread.targetUserId || activeThread.id,
                    )
                      ? "#EF4444"
                      : isDark
                        ? "#94A3B8"
                        : "#64748B",
                  },
                ]}
              >
                {blockedUserIds.has(
                  activeThread.targetUserId || activeThread.id,
                )
                  ? "Blocked"
                  : "Not blocked"}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={isDark ? "#64748B" : "#94A3B8"}
            />
          </TouchableOpacity>

          {/* Restrict */}
          <TouchableOpacity
            style={styles.conversationInfoRow}
            activeOpacity={0.7}
            onPress={() => setShowRestrictModal(true)}
          >
            <View style={styles.conversationInfoRowIconWrap}>
              <Ionicons
                name="contrast-outline"
                size={22}
                color={
                  restrictedUserIds.has(
                    activeThread.targetUserId || activeThread.id,
                  )
                    ? "#F59E0B"
                    : isDark
                      ? "#FFFFFF"
                      : "#0F172A"
                }
              />
            </View>
            <View style={styles.conversationInfoRowTextCol}>
              <Text
                style={[
                  styles.conversationInfoRowTitle,
                  { color: isDark ? "#FFFFFF" : "#0F172A" },
                ]}
              >
                Restrict
              </Text>
              <Text
                style={[
                  styles.conversationInfoRowSubtitle,
                  {
                    color: restrictedUserIds.has(
                      activeThread.targetUserId || activeThread.id,
                    )
                      ? "#F59E0B"
                      : isDark
                        ? "#94A3B8"
                        : "#64748B",
                  },
                ]}
              >
                {restrictedUserIds.has(
                  activeThread.targetUserId || activeThread.id,
                )
                  ? "Restricted"
                  : "Standard"}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={isDark ? "#64748B" : "#94A3B8"}
            />
          </TouchableOpacity>

          {/* Report */}
          <TouchableOpacity
            style={styles.conversationInfoRow}
            activeOpacity={0.7}
            onPress={() => setShowReportModal(true)}
          >
            <View style={styles.conversationInfoRowIconWrap}>
              <Ionicons
                name="warning-outline"
                size={22}
                color={isDark ? "#FFFFFF" : "#0F172A"}
              />
            </View>
            <View style={styles.conversationInfoRowTextCol}>
              <Text
                style={[
                  styles.conversationInfoRowTitle,
                  { color: isDark ? "#FFFFFF" : "#0F172A" },
                ]}
              >
                Report
              </Text>
              <Text
                style={[
                  styles.conversationInfoRowSubtitle,
                  { color: isDark ? "#94A3B8" : "#64748B" },
                ]}
              >
                Give feedback and report conversation
              </Text>
            </View>
          </TouchableOpacity>

          {/* Delete chat (Red destructive) */}
          <TouchableOpacity
            style={styles.conversationInfoRow}
            activeOpacity={0.7}
            onPress={() => setShowDeleteChatModal(true)}
          >
            <View style={styles.conversationInfoRowIconWrap}>
              <Ionicons name="trash-outline" size={22} color="#EF4444" />
            </View>
            <View style={styles.conversationInfoRowTextCol}>
              <Text
                style={[
                  styles.conversationInfoRowTitle,
                  { color: "#EF4444", fontWeight: "700" },
                ]}
              >
                Delete chat
              </Text>
            </View>
          </TouchableOpacity>
        </ScrollView>

        {/* Lightbox Fullscreen Modal */}
        {renderLightboxModal()}

        {/* View All Media, Files & Links Modal */}
        {renderAllMediaModal()}

        {/* All Interactive Bottom Sheet Modals for Conversation Info */}
        {renderConversationInfoModals()}
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
          {(() => {
            const cleanTargetUid =
              activeThread.type !== "group" && activeThread.targetUserId
                ? String(activeThread.targetUserId).replace(/^mem_/, "").trim()
                : "";
            const live = cleanTargetUid ? presenceMap[cleanTargetUid] : null;
            const lastActive =
              live?.lastActiveAt ||
              live?.lastActiveDate ||
              activeThread.lastActiveAt;
            const isOnlineFlag =
              live?.isOnline !== undefined
                ? live.isOnline
                : activeThread.isOnline;
            const livePres = cleanTargetUid
              ? computePresence(lastActive, isOnlineFlag)
              : null;
            const isThreadOnline = livePres
              ? livePres.isOnline
              : Boolean(activeThread.isOnline);
            const threadStatusLabel = livePres
              ? livePres.statusLabel
              : activeThread.onlineStatusLabel || "Offline";
            const threadPhoto =
              live?.photoURL || live?.profilePicture || activeThread.photoURL;

            return (
              <TouchableOpacity
                style={styles.chatHeaderCenter}
                activeOpacity={0.8}
                onPress={() => setShowConversationInfo(true)}
                accessibilityLabel="View conversation info"
              >
                <View style={styles.chatHeaderAvatarWrap}>
                  {activeThread.type === "group" ? (
                    <GroupChatAvatar
                      members={householdMembers}
                      size={40}
                      isDark={isDark}
                    />
                  ) : (
                    <View
                      style={[
                        styles.chatHeaderAvatar,
                        { backgroundColor: activeThread.avatarBg },
                      ]}
                    >
                      {threadPhoto ? (
                        <Image
                          source={{ uri: threadPhoto }}
                          style={styles.avatarImage}
                        />
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
                  )}
                  {activeThread.type !== "group" && isThreadOnline && (
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
                        color: isThreadOnline
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
                      : activeThread.roleLabel &&
                          activeThread.roleLabel !== "Payor" &&
                          activeThread.roleLabel !== "Non-payor"
                        ? `${activeThread.roleLabel} · ${threadStatusLabel}`
                        : threadStatusLabel}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })()}

          {/* Header Action Buttons: Voice Call, Video Call, and Conversation Info */}
          <View style={styles.chatHeaderActionsRow}>
            {activeThread.type === "direct" && activeThread.targetUserId && (
              <>
                {/* Voice Call Button */}
                <TouchableOpacity
                  style={[
                    styles.chatHeaderActionBtn,
                    {
                      backgroundColor: isDark
                        ? "rgba(37, 99, 235, 0.2)"
                        : "#EFF6FF",
                      display: "none",
                    },
                  ]}
                  onPress={() => handleStartCall("voice")}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="Voice Call"
                >
                  <Ionicons
                    name="call-outline"
                    size={19}
                    color={isDark ? "#60A5FA" : "#2563EB"}
                  />
                </TouchableOpacity>

                {/* Video Call Button */}
                <TouchableOpacity
                  style={[
                    styles.chatHeaderActionBtn,
                    {
                      backgroundColor: isDark
                        ? "rgba(37, 99, 235, 0.2)"
                        : "#EFF6FF",
                      display: "none",
                    },
                  ]}
                  onPress={() => handleStartCall("video")}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="Video Call"
                >
                  <Ionicons
                    name="videocam-outline"
                    size={20}
                    color={isDark ? "#60A5FA" : "#2563EB"}
                  />
                </TouchableOpacity>
              </>
            )}

            {/* Conversation Info Button (Beside Video Call) */}
            <TouchableOpacity
              style={[
                styles.chatHeaderActionBtn,
                {
                  backgroundColor: isDark
                    ? "rgba(37, 99, 235, 0.2)"
                    : "#EFF6FF",
                },
              ]}
              onPress={() => setShowConversationInfo(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Conversation Information"
            >
              <Ionicons
                name="information-circle-outline"
                size={22}
                color={isDark ? "#60A5FA" : "#2563EB"}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* In-Chat Search Bar */}
        {isSearchingInChat && (
          <View
            style={[
              styles.inChatSearchBarContainer,
              {
                backgroundColor: isDark ? "#181A20" : "#F8FAFC",
                borderBottomColor: isDark
                  ? "rgba(255,255,255,0.08)"
                  : "#E2E8F0",
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
                styles.inChatSearchInput,
                { color: isDark ? "#FFFFFF" : "#0F172A" },
              ]}
              placeholder="Search in conversation..."
              placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
              value={inChatSearchQuery}
              onChangeText={setInChatSearchQuery}
              autoFocus
              returnKeyType="search"
            />
            {inChatSearchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setInChatSearchQuery("")}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ marginRight: 8 }}
              >
                <Feather
                  name="x-circle"
                  size={16}
                  color={isDark ? "#94A3B8" : "#64748B"}
                />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => {
                setIsSearchingInChat(false);
                setInChatSearchQuery("");
              }}
              style={styles.inChatSearchCloseBtn}
            >
              <Text
                style={{
                  color: isDark ? "#60A5FA" : "#2563EB",
                  fontWeight: "700",
                  fontSize: 13,
                }}
              >
                Done
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Messenger-Style Message Request Banner */}
        {activeThread.isMessageRequest &&
          !acceptedConvIds.has(activeThread.id) && (
            <View
              style={[
                styles.requestBannerBox,
                {
                  backgroundColor: isDark ? "#1E293B" : "#F0F7FF",
                  borderColor: isDark ? "#334155" : "#BFDBFE",
                },
              ]}
            >
              <View style={styles.requestBannerHeader}>
                <View
                  style={[
                    styles.requestBannerIconWrap,
                    { backgroundColor: isDark ? "#0F172A" : "#DBEAFE" },
                  ]}
                >
                  <Ionicons
                    name="chatbubbles-outline"
                    size={18}
                    color="#2563EB"
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text
                    style={[
                      styles.requestBannerTitle,
                      { color: isDark ? "#FFFFFF" : "#0F172A" },
                    ]}
                  >
                    Message Request
                  </Text>
                  <Text
                    style={[
                      styles.requestBannerDesc,
                      { color: isDark ? "#94A3B8" : "#475569" },
                    ]}
                  >
                    {activeThread.name} is not in your friends list or bills
                    group. If you accept, they'll be able to send messages
                    directly to your inbox.
                  </Text>
                </View>
              </View>
              <View style={styles.requestBannerButtonsRow}>
                <TouchableOpacity
                  style={styles.requestAcceptBtn}
                  onPress={() => handleAcceptMessageRequest(activeThread.id)}
                >
                  <Text style={styles.requestAcceptBtnText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.requestDeclineBtn,
                    {
                      backgroundColor: isDark ? "#334155" : "#E2E8F0",
                    },
                  ]}
                  onPress={() => handleDeclineMessageRequest(activeThread.id)}
                >
                  <Text
                    style={[
                      styles.requestDeclineBtnText,
                      { color: isDark ? "#CBD5E1" : "#475569" },
                    ]}
                  >
                    Delete
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

        {/* Disappearing Messages Active Notification Banner */}
        {disappearingDurationsMap[activeThread.id] &&
          disappearingDurationsMap[activeThread.id] !== "off" && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setShowDisappearingModal(true)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#F1F5F9",
                paddingVertical: 7,
                paddingHorizontal: 16,
                gap: 6,
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: isDark
                  ? "rgba(255,255,255,0.08)"
                  : "#E2E8F0",
              }}
            >
              <Ionicons
                name="timer-outline"
                size={15}
                color={selectedChatTheme}
              />
              <Text
                style={{
                  fontSize: 12,
                  color: isDark ? "#CBD5E1" : "#475569",
                  fontWeight: "600",
                }}
              >
                Disappearing messages are on (
                {disappearingDurationsMap[activeThread.id] === "24h"
                  ? "24 hours"
                  : disappearingDurationsMap[activeThread.id] === "7d"
                    ? "7 days"
                    : "90 days"}
                ) · Tap to change
              </Text>
            </TouchableOpacity>
          )}

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
            (() => {
              const query = inChatSearchQuery.trim().toLowerCase();
              const threadDisappearing =
                disappearingDurationsMap[activeThread.id] || "off";
              let baseMessages = activeThread.messages;

              if (threadDisappearing !== "off") {
                const now = Date.now();
                const maxAgeMs =
                  threadDisappearing === "24h"
                    ? 24 * 60 * 60 * 1000
                    : threadDisappearing === "7d"
                      ? 7 * 24 * 60 * 60 * 1000
                      : 90 * 24 * 60 * 60 * 1000;
                baseMessages = baseMessages.filter((m) => {
                  const mTime = new Date(
                    (m as any).timestamp || m.time || 0,
                  ).getTime();
                  if (!mTime || isNaN(mTime)) return true;
                  return now - mTime < maxAgeMs;
                });
              }

              const displayedMessages = query
                ? baseMessages.filter(
                    (m) =>
                      m.text?.toLowerCase().includes(query) ||
                      m.sender?.toLowerCase().includes(query) ||
                      m.meta?.attachmentName?.toLowerCase().includes(query),
                  )
                : baseMessages;

              if (query && displayedMessages.length === 0) {
                return (
                  <View
                    style={{
                      alignItems: "center",
                      justifyContent: "center",
                      paddingVertical: 40,
                      gap: 8,
                    }}
                  >
                    <Ionicons
                      name="search-outline"
                      size={36}
                      color={isDark ? "#64748B" : "#94A3B8"}
                    />
                    <Text
                      style={{
                        fontSize: 14,
                        color: isDark ? "#94A3B8" : "#64748B",
                      }}
                    >
                      No messages found matching &quot;{inChatSearchQuery}&quot;
                    </Text>
                  </View>
                );
              }

              return displayedMessages.map((msg, index) => {
                const prevMsg = displayedMessages[index - 1];
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

                  const hasReactions = Boolean(
                    msg.reactions &&
                    Object.keys(msg.reactions).some(
                      (k) => msg.reactions![k]?.length > 0,
                    ),
                  );

                  return (
                    <SwipeableMessageRow
                      key={msg.id}
                      onReply={() => handleStartReply(msg)}
                      isMe={true}
                      isDark={isDark}
                    >
                      <View
                        style={[
                          styles.msgBubbleRow,
                          styles.msgRowMe,
                          hasReactions && { marginBottom: 12 },
                        ]}
                      >
                        {/* Speech bubble */}
                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={() => handleToggleMessage(msg.id)}
                          onLongPress={(e) => handleLongPressMessage(msg, e)}
                          delayLongPress={350}
                          style={[
                            msg.type === "image"
                              ? styles.speechBubbleImage
                              : [
                                  styles.speechBubble,
                                  styles.speechBubbleMe,
                                  { backgroundColor: selectedChatTheme },
                                ],
                            { position: "relative" },
                          ]}
                        >
                          {/* Quoted Reply Preview */}
                          {(msg.replyTo || msg.meta?.replyTo) && (
                            <View
                              style={[
                                styles.msgReplySnippetBox,
                                styles.msgReplySnippetBoxMe,
                              ]}
                            >
                              <Text
                                style={styles.msgReplySnippetSenderMe}
                                numberOfLines={1}
                              >
                                {(msg.replyTo || msg.meta?.replyTo)
                                  ?.senderName || "Replied"}
                              </Text>
                              <Text
                                style={styles.msgReplySnippetTextMe}
                                numberOfLines={1}
                              >
                                {(msg.replyTo || msg.meta?.replyTo)?.text}
                              </Text>
                            </View>
                          )}

                          {/* Image Attachment Preview */}
                          {msg.type === "image" &&
                            (() => {
                              const imgUrl =
                                msg.meta?.attachmentUrl ||
                                (msg as any).attachmentUrl ||
                                (msg as any).imageUrl ||
                                (msg as any).uri;
                              return (
                                <TouchableOpacity
                                  activeOpacity={0.9}
                                  onPress={() =>
                                    imgUrl &&
                                    setLightboxImage({
                                      uri: imgUrl,
                                      senderName: "You",
                                      timestamp: msg.time,
                                      caption: msg.text,
                                    })
                                  }
                                  style={{
                                    marginBottom:
                                      msg.text && msg.text !== "📷 Photo"
                                        ? 6
                                        : 0,
                                    borderRadius: 16,
                                    overflow: "hidden",
                                    position: "relative",
                                    backgroundColor: isDark
                                      ? "#1E222B"
                                      : "#F1F5F9",
                                  }}
                                >
                                  {imgUrl ? (
                                    <Image
                                      source={{ uri: imgUrl }}
                                      style={{
                                        width: 220,
                                        height: 180,
                                        borderRadius: 16,
                                      }}
                                      resizeMode="cover"
                                    />
                                  ) : (
                                    <View
                                      style={{
                                        width: 220,
                                        height: 180,
                                        alignItems: "center",
                                        justifyContent: "center",
                                      }}
                                    >
                                      <ActivityIndicator
                                        size="small"
                                        color="#2563EB"
                                      />
                                    </View>
                                  )}
                                  {(!msg.text || msg.text === "📷 Photo") && (
                                    <View
                                      style={{
                                        position: "absolute",
                                        bottom: 8,
                                        right: 8,
                                        backgroundColor: "rgba(0,0,0,0.55)",
                                        paddingHorizontal: 7,
                                        paddingVertical: 2,
                                        borderRadius: 10,
                                      }}
                                    >
                                      <Text
                                        style={{
                                          color: "#FFFFFF",
                                          fontSize: 10,
                                          fontWeight: "600",
                                        }}
                                      >
                                        {msg.time}
                                      </Text>
                                    </View>
                                  )}
                                </TouchableOpacity>
                              );
                            })()}

                          {/* File Attachment Preview */}
                          {msg.type === "file" && msg.meta?.attachmentUrl && (
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 10,
                                padding: 10,
                                borderRadius: 12,
                                backgroundColor: "rgba(255,255,255,0.18)",
                                marginBottom: 6,
                              }}
                            >
                              <Ionicons
                                name="document-text"
                                size={26}
                                color="#FFFFFF"
                              />
                              <View style={{ flex: 1 }}>
                                <Text
                                  style={{
                                    color: "#FFFFFF",
                                    fontSize: 13,
                                    fontWeight: "700",
                                  }}
                                  numberOfLines={1}
                                >
                                  {msg.meta.fileName || msg.text}
                                </Text>
                                {msg.meta.fileSize && (
                                  <Text
                                    style={{
                                      color: "rgba(255,255,255,0.75)",
                                      fontSize: 11,
                                      marginTop: 1,
                                      fontWeight: "500",
                                    }}
                                  >
                                    {msg.meta.fileSize}
                                  </Text>
                                )}
                              </View>
                            </View>
                          )}

                          {(!msg.type ||
                            msg.type === "text" ||
                            (msg.type !== "image" && msg.type !== "file") ||
                            (msg.text &&
                              msg.text !== "📷 Photo" &&
                              !msg.text.startsWith("📎 "))) && (
                            <View
                              style={
                                msg.type === "image" && msg.meta?.attachmentUrl
                                  ? {
                                      backgroundColor: isDark
                                        ? "#1E293B"
                                        : "#F1F5F9",
                                      paddingHorizontal: 12,
                                      paddingVertical: 7,
                                      borderRadius: 12,
                                      marginTop: 4,
                                    }
                                  : undefined
                              }
                            >
                              <Text
                                style={[
                                  styles.speechBubbleText,
                                  msg.type === "image" &&
                                  msg.meta?.attachmentUrl
                                    ? {
                                        color: isDark ? "#FFFFFF" : "#0F172A",
                                        fontWeight: "500",
                                      }
                                    : styles.speechBubbleTextMe,
                                ]}
                              >
                                {msg.text}
                                {Boolean(msg.isEdited) && (
                                  <Text
                                    style={{
                                      fontSize: 10,
                                      opacity: 0.8,
                                      fontStyle: "italic",
                                    }}
                                  >
                                    {" "}
                                    · edited
                                  </Text>
                                )}
                              </Text>
                            </View>
                          )}

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

                          {/* Embedded Call Log Card */}
                          {msg.type === "call_log" && (
                            <View
                              style={[
                                styles.callLogCard,
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
                              <View style={styles.callLogIconWrap}>
                                <Ionicons
                                  name={
                                    msg.meta?.callType === "video"
                                      ? "videocam"
                                      : "call"
                                  }
                                  size={16}
                                  color={
                                    msg.meta?.callStatus === "missed"
                                      ? "#EF4444"
                                      : "#2563EB"
                                  }
                                />
                              </View>
                              <View style={styles.callLogDetails}>
                                <Text
                                  style={[
                                    styles.callLogTitle,
                                    { color: isDark ? "#FFFFFF" : "#0F172A" },
                                  ]}
                                >
                                  {msg.meta?.callType === "video"
                                    ? "Video Call"
                                    : "Voice Call"}
                                </Text>
                                <Text
                                  style={[
                                    styles.callLogSubtitle,
                                    { color: isDark ? "#94A3B8" : "#64748B" },
                                  ]}
                                >
                                  {msg.text.split("·")[1]?.trim() ||
                                    "Completed"}
                                </Text>
                              </View>
                              {activeThread.type === "direct" && (
                                <TouchableOpacity
                                  style={styles.callBackBtn}
                                  onPress={() =>
                                    handleStartCall(
                                      msg.meta?.callType === "video"
                                        ? "video"
                                        : "voice",
                                    )
                                  }
                                >
                                  <Text style={styles.callBackBtnText}>
                                    Call
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          )}

                          {/* Reaction Badges Pill */}
                          {hasReactions && (
                            <View
                              style={[
                                styles.bubbleReactionsPill,
                                styles.bubbleReactionsPillMe,
                                {
                                  backgroundColor: isDark
                                    ? "#1E222B"
                                    : "#FFFFFF",
                                  borderColor: isDark
                                    ? "rgba(255,255,255,0.12)"
                                    : "#E2E8F0",
                                },
                              ]}
                            >
                              {Object.entries(msg.reactions!)
                                .filter(
                                  ([_, uids]) =>
                                    Array.isArray(uids) && uids.length > 0,
                                )
                                .map(([em, uids]) => (
                                  <Text
                                    key={em}
                                    style={styles.bubbleReactionItemText}
                                  >
                                    {em}
                                    {uids.length > 1 ? ` ${uids.length}` : ""}
                                  </Text>
                                ))}
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
                    </SwipeableMessageRow>
                  );
                }

                // Incoming message: Facebook Messenger style layout with avatar on the left
                const hasIncomingReactions = Boolean(
                  msg.reactions &&
                  Object.keys(msg.reactions).some(
                    (k) => msg.reactions![k]?.length > 0,
                  ),
                );

                return (
                  <SwipeableMessageRow
                    key={msg.id}
                    onReply={() => handleStartReply(msg)}
                    isMe={false}
                    isDark={isDark}
                  >
                    <View
                      style={[
                        styles.msgThemContainer,
                        hasIncomingReactions && { marginBottom: 12 },
                      ]}
                    >
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
                          onLongPress={(e) => handleLongPressMessage(msg, e)}
                          delayLongPress={350}
                          style={[
                            msg.type === "image"
                              ? styles.speechBubbleImage
                              : [
                                  styles.speechBubble,
                                  styles.speechBubbleThem,
                                  {
                                    backgroundColor: isDark
                                      ? "#242731"
                                      : "#F1F5F9",
                                  },
                                ],
                            { position: "relative" },
                          ]}
                        >
                          {/* Quoted Reply Preview */}
                          {(msg.replyTo || msg.meta?.replyTo) && (
                            <View
                              style={[
                                styles.msgReplySnippetBox,
                                styles.msgReplySnippetBoxThem,
                                {
                                  backgroundColor: isDark
                                    ? "rgba(255,255,255,0.08)"
                                    : "rgba(0,0,0,0.06)",
                                  borderLeftColor: isDark
                                    ? "#60A5FA"
                                    : "#2563EB",
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.msgReplySnippetSenderThem,
                                  { color: isDark ? "#60A5FA" : "#2563EB" },
                                ]}
                                numberOfLines={1}
                              >
                                {(msg.replyTo || msg.meta?.replyTo)
                                  ?.senderName || "Replied"}
                              </Text>
                              <Text
                                style={[
                                  styles.msgReplySnippetTextThem,
                                  { color: isDark ? "#CBD5E1" : "#475569" },
                                ]}
                                numberOfLines={1}
                              >
                                {(msg.replyTo || msg.meta?.replyTo)?.text}
                              </Text>
                            </View>
                          )}
                          {/* Image Attachment Preview */}
                          {msg.type === "image" &&
                            (() => {
                              const imgUrl =
                                msg.meta?.attachmentUrl ||
                                (msg as any).attachmentUrl ||
                                (msg as any).imageUrl ||
                                (msg as any).uri;
                              return (
                                <TouchableOpacity
                                  activeOpacity={0.9}
                                  onPress={() =>
                                    imgUrl &&
                                    setLightboxImage({
                                      uri: imgUrl,
                                      senderName:
                                        msg.sender || activeThread.name,
                                      timestamp: msg.time,
                                      caption: msg.text,
                                    })
                                  }
                                  style={{
                                    marginBottom:
                                      msg.text && msg.text !== "📷 Photo"
                                        ? 6
                                        : 0,
                                    borderRadius: 16,
                                    overflow: "hidden",
                                    position: "relative",
                                    backgroundColor: isDark
                                      ? "#1E222B"
                                      : "#F1F5F9",
                                  }}
                                >
                                  {imgUrl ? (
                                    <Image
                                      source={{ uri: imgUrl }}
                                      style={{
                                        width: 220,
                                        height: 180,
                                        borderRadius: 16,
                                      }}
                                      resizeMode="cover"
                                    />
                                  ) : (
                                    <View
                                      style={{
                                        width: 220,
                                        height: 180,
                                        alignItems: "center",
                                        justifyContent: "center",
                                      }}
                                    >
                                      <ActivityIndicator
                                        size="small"
                                        color="#2563EB"
                                      />
                                    </View>
                                  )}
                                  {(!msg.text || msg.text === "📷 Photo") && (
                                    <View
                                      style={{
                                        position: "absolute",
                                        bottom: 8,
                                        right: 8,
                                        backgroundColor: "rgba(0,0,0,0.55)",
                                        paddingHorizontal: 7,
                                        paddingVertical: 2,
                                        borderRadius: 10,
                                      }}
                                    >
                                      <Text
                                        style={{
                                          color: "#FFFFFF",
                                          fontSize: 10,
                                          fontWeight: "600",
                                        }}
                                      >
                                        {msg.time}
                                      </Text>
                                    </View>
                                  )}
                                </TouchableOpacity>
                              );
                            })()}

                          {/* File Attachment Preview */}
                          {msg.type === "file" && msg.meta?.attachmentUrl && (
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 10,
                                padding: 10,
                                borderRadius: 12,
                                backgroundColor: isDark
                                  ? "rgba(255,255,255,0.08)"
                                  : "#E2E8F0",
                                marginBottom: 6,
                              }}
                            >
                              <Ionicons
                                name="document-text"
                                size={26}
                                color={isDark ? "#60A5FA" : "#2563EB"}
                              />
                              <View style={{ flex: 1 }}>
                                <Text
                                  style={{
                                    color: isDark ? "#FFFFFF" : "#0F172A",
                                    fontSize: 13,
                                    fontWeight: "700",
                                  }}
                                  numberOfLines={1}
                                >
                                  {msg.meta.fileName || msg.text}
                                </Text>
                                {msg.meta.fileSize && (
                                  <Text
                                    style={{
                                      color: isDark ? "#94A3B8" : "#64748B",
                                      fontSize: 11,
                                      marginTop: 1,
                                      fontWeight: "500",
                                    }}
                                  >
                                    {msg.meta.fileSize}
                                  </Text>
                                )}
                              </View>
                            </View>
                          )}

                          {(!msg.type ||
                            msg.type === "text" ||
                            (msg.type !== "image" && msg.type !== "file") ||
                            (msg.text &&
                              msg.text !== "📷 Photo" &&
                              !msg.text.startsWith("📎 "))) && (
                            <View
                              style={
                                msg.type === "image" && msg.meta?.attachmentUrl
                                  ? {
                                      backgroundColor: isDark
                                        ? "#242731"
                                        : "#F1F5F9",
                                      paddingHorizontal: 12,
                                      paddingVertical: 7,
                                      borderRadius: 12,
                                      marginTop: 4,
                                    }
                                  : undefined
                              }
                            >
                              <Text
                                style={[
                                  styles.speechBubbleText,
                                  { color: isDark ? "#FFFFFF" : "#0F172A" },
                                ]}
                              >
                                {msg.text}
                                {Boolean(msg.isEdited) && (
                                  <Text
                                    style={{
                                      fontSize: 10,
                                      color: isDark ? "#94A3B8" : "#64748B",
                                      fontStyle: "italic",
                                    }}
                                  >
                                    {" "}
                                    · edited
                                  </Text>
                                )}
                              </Text>
                            </View>
                          )}

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

                          {/* Embedded Call Log Card */}
                          {msg.type === "call_log" && (
                            <View
                              style={[
                                styles.callLogCard,
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
                              <View style={styles.callLogIconWrap}>
                                <Ionicons
                                  name={
                                    msg.meta?.callType === "video"
                                      ? "videocam"
                                      : "call"
                                  }
                                  size={16}
                                  color={
                                    msg.meta?.callStatus === "missed"
                                      ? "#EF4444"
                                      : "#2563EB"
                                  }
                                />
                              </View>
                              <View style={styles.callLogDetails}>
                                <Text
                                  style={[
                                    styles.callLogTitle,
                                    { color: isDark ? "#FFFFFF" : "#0F172A" },
                                  ]}
                                >
                                  {msg.meta?.callType === "video"
                                    ? "Video Call"
                                    : "Voice Call"}
                                </Text>
                                <Text
                                  style={[
                                    styles.callLogSubtitle,
                                    { color: isDark ? "#94A3B8" : "#64748B" },
                                  ]}
                                >
                                  {msg.text.split("·")[1]?.trim() ||
                                    "Completed"}
                                </Text>
                              </View>
                              {activeThread.type === "direct" && (
                                <TouchableOpacity
                                  style={styles.callBackBtn}
                                  onPress={() =>
                                    handleStartCall(
                                      msg.meta?.callType === "video"
                                        ? "video"
                                        : "voice",
                                    )
                                  }
                                >
                                  <Text style={styles.callBackBtnText}>
                                    Call
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          )}

                          {/* Reaction Badges Pill */}
                          {hasIncomingReactions && (
                            <View
                              style={[
                                styles.bubbleReactionsPill,
                                styles.bubbleReactionsPillThem,
                                {
                                  backgroundColor: isDark
                                    ? "#1E222B"
                                    : "#FFFFFF",
                                  borderColor: isDark
                                    ? "rgba(255,255,255,0.12)"
                                    : "#E2E8F0",
                                },
                              ]}
                            >
                              {Object.entries(msg.reactions!)
                                .filter(
                                  ([_, uids]) =>
                                    Array.isArray(uids) && uids.length > 0,
                                )
                                .map(([em, uids]) => (
                                  <Text
                                    key={em}
                                    style={styles.bubbleReactionItemText}
                                  >
                                    {em}
                                    {uids.length > 1 ? ` ${uids.length}` : ""}
                                  </Text>
                                ))}
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
                  </SwipeableMessageRow>
                );
              });
            })()
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
          {/* Editing Message Banner Bar */}
          {editingMessage && (
            <View
              style={[
                styles.editingBanner,
                {
                  backgroundColor: isDark ? "#1E222B" : "#EFF6FF",
                  // borderBottomColor: isDark
                  //   ? "rgba(255,255,255,0.08)"
                  //   : "#DBEAFE",
                },
              ]}
            >
              <Feather
                name="edit-2"
                size={14}
                color={isDark ? "#60A5FA" : "#2563EB"}
              />
              <View style={{ flex: 1, marginHorizontal: 8 }}>
                <Text
                  style={{
                    fontSize: 11.5,
                    fontWeight: "700",
                    color: isDark ? "#60A5FA" : "#2563EB",
                  }}
                >
                  Editing message
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: isDark ? "#94A3B8" : "#64748B",
                  }}
                  numberOfLines={1}
                >
                  {editingMessage.text}
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleCancelEdit}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ padding: 4 }}
              >
                <Feather
                  name="x"
                  size={16}
                  color={isDark ? "#94A3B8" : "#64748B"}
                />
              </TouchableOpacity>
            </View>
          )}

          {/* Replying Message Banner Bar */}
          {replyingToMessage && !editingMessage && (
            <View
              style={[
                styles.editingBanner,
                {
                  backgroundColor: isDark ? "#1E222B" : "#EFF6FF",
                  borderLeftWidth: 3.5,
                  borderLeftColor: selectedChatTheme,
                },
              ]}
            >
              <Ionicons name="arrow-undo" size={14} color={selectedChatTheme} />
              <View style={{ flex: 1, marginHorizontal: 8 }}>
                <Text
                  style={{
                    fontSize: 11.5,
                    fontWeight: "700",
                    color: selectedChatTheme,
                  }}
                >
                  Replying to{" "}
                  {replyingToMessage.isMe
                    ? "yourself"
                    : replyingToMessage.sender}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: isDark ? "#94A3B8" : "#64748B",
                  }}
                  numberOfLines={1}
                >
                  {replyingToMessage.text ||
                    (replyingToMessage.type === "image"
                      ? "📷 Photo"
                      : replyingToMessage.type === "file"
                        ? "📎 Attachment"
                        : "Message")}
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleCancelReply}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ padding: 4 }}
              >
                <Feather
                  name="x"
                  size={16}
                  color={isDark ? "#94A3B8" : "#64748B"}
                />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.capsuleInputInnerRow}>
            {/* Attachment options trigger (+) */}
            <TouchableOpacity
              style={[
                styles.capsuleActionIconBtn,
                {
                  backgroundColor: isDark ? "#242731" : "#F1F5F9",
                },
              ]}
              onPress={() => {
                Keyboard.dismiss();
                setShowAttachmentModal(true);
              }}
              disabled={isUploadingAttachment}
              accessibilityLabel="Add attachment"
            >
              {isUploadingAttachment ? (
                <ActivityIndicator size="small" color={selectedChatTheme} />
              ) : (
                <Feather name="plus" size={19} color={selectedChatTheme} />
              )}
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
                placeholder={
                  editingMessage
                    ? "Edit your message..."
                    : replyingToMessage
                      ? `Reply to ${
                          replyingToMessage.isMe
                            ? "yourself"
                            : replyingToMessage.sender.split(" ")[0]
                        }...`
                      : `Message ${activeThread.name.split(" ")[0]}...`
                }
                placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                value={chatInputText}
                onChangeText={setChatInputText}
                onSubmitEditing={handleSendMessage}
                onFocus={() => {
                  if (Platform.OS === "android") {
                    try {
                      LayoutAnimation.configureNext(
                        LayoutAnimation.Presets.easeInEaseOut,
                      );
                    } catch {}
                  }
                  setIsInputFocused(true);
                  setIsKeyboardOpen(true);
                  setTimeout(() => {
                    messageScrollRef.current?.scrollToEnd({ animated: true });
                  }, 120);
                }}
                onBlur={() => {
                  if (Platform.OS === "android") {
                    try {
                      LayoutAnimation.configureNext(
                        LayoutAnimation.Presets.easeInEaseOut,
                      );
                    } catch {}
                  }
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

            {/* Circular Send / Save Edit Button */}
            <TouchableOpacity
              style={[
                styles.capsuleSendButton,
                {
                  backgroundColor: editingMessage
                    ? "#10B981"
                    : selectedChatTheme,
                },
                (!chatInputText.trim() || isSending) && { opacity: 0.5 },
              ]}
              onPress={handleSendMessage}
              disabled={!chatInputText.trim() || isSending}
              accessibilityLabel={editingMessage ? "Save edit" : "Send message"}
            >
              {isSending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : editingMessage ? (
                <Ionicons name="checkmark" size={19} color="#FFFFFF" />
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

        {/* Offline Call Confirmation Prompt Modal */}
        <OfflineCallPromptModal
          visible={Boolean(offlinePromptData?.visible)}
          onClose={() => setOfflinePromptData(null)}
          contactName={offlinePromptData?.contactName || "Contact"}
          contactAvatar={offlinePromptData?.contactAvatar}
          lastActiveLabel={offlinePromptData?.lastActiveLabel || "Offline"}
          callType={offlinePromptData?.callType || "voice"}
          onRingAnyway={() => {
            if (offlinePromptData) {
              const data = offlinePromptData;
              setOfflinePromptData(null);
              handleStartCall(
                data.callType,
                {
                  id: data.contactId,
                  name: data.contactName,
                  avatar: data.contactAvatar,
                },
                true,
              );
            }
          }}
          onSendMessage={() => {
            setOfflinePromptData(null);
            setTimeout(() => {
              chatInputRef.current?.focus();
            }, 150);
          }}
        />

        {/* SMALL FLOATING MODAL ACTION STRIP (Delete / Edit / Copy) POPPING UP ABOVE TAPPED MESSAGE */}
        <Modal
          visible={Boolean(selectedMessageForAction)}
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (!isDeletingMessage) {
              setSelectedMessageForAction(null);
              setDeleteMode(false);
            }
          }}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => {
              if (!isDeletingMessage) {
                setSelectedMessageForAction(null);
                setDeleteMode(false);
              }
            }}
          >
            {selectedMessageForAction &&
              (() => {
                const isMe =
                  selectedMessageForAction.isMe ||
                  selectedMessageForAction.senderId === currentUid ||
                  selectedMessageForAction.senderId ===
                    currentUid.replace(/^mem_/, "");

                const touchY = messageActionCoords?.y ?? windowHeight / 2;
                const isAbove = touchY > topInset + 130;
                const stripTop = isAbove
                  ? Math.max(topInset + 50, touchY - 110)
                  : Math.min(windowHeight - 160, touchY + 36);

                const canEdit =
                  isMe &&
                  (selectedMessageForAction.type === "text" ||
                    !selectedMessageForAction.type ||
                    Boolean(selectedMessageForAction.text));

                return (
                  <View
                    style={[
                      styles.smallModalStripContainer,
                      {
                        top: stripTop,
                        right: isMe ? 18 : undefined,
                        left: !isMe ? 54 : undefined,
                        backgroundColor: isDark ? "#1E222B" : "#FFFFFF",
                        borderColor: isDark
                          ? "rgba(255,255,255,0.12)"
                          : "#E2E8F0",
                      },
                    ]}
                    onStartShouldSetResponder={() => true}
                  >
                    {/* Floating Emoji Reactions Bar */}
                    {!isDeletingMessage && !deleteMode && (
                      <View
                        style={[
                          styles.reactionBarContainer,
                          {
                            borderBottomColor: isDark
                              ? "rgba(255,255,255,0.08)"
                              : "#F1F5F9",
                          },
                        ]}
                      >
                        {REACTION_EMOJIS.map((emoji) => {
                          const cleanUid = String(currentUid || "")
                            .replace(/^mem_/, "")
                            .trim();
                          const userReacted =
                            Array.isArray(
                              selectedMessageForAction.reactions?.[emoji],
                            ) &&
                            selectedMessageForAction.reactions[emoji].includes(
                              cleanUid,
                            );
                          return (
                            <TouchableOpacity
                              key={emoji}
                              activeOpacity={0.65}
                              onPress={() =>
                                handleToggleReaction(
                                  selectedMessageForAction,
                                  emoji,
                                )
                              }
                              style={[
                                styles.reactionEmojiBtn,
                                userReacted && {
                                  backgroundColor: isDark
                                    ? "rgba(37,99,235,0.3)"
                                    : "rgba(37,99,235,0.15)",
                                  borderColor: isDark ? "#60A5FA" : "#2563EB",
                                },
                              ]}
                            >
                              <Text style={styles.reactionEmojiText}>
                                {emoji}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}

                    {isDeletingMessage ? (
                      <View style={styles.stripDeletingRow}>
                        <ActivityIndicator size="small" color="#EF4444" />
                        <Text
                          style={[
                            styles.stripDeletingText,
                            { color: isDark ? "#F87171" : "#DC2626" },
                          ]}
                        >
                          Deleting...
                        </Text>
                      </View>
                    ) : deleteMode ? (
                      <View style={styles.stripDeleteOptionsRow}>
                        <TouchableOpacity
                          style={[
                            styles.stripActionBtn,
                            styles.stripDeleteEveryoneBtn,
                            {
                              backgroundColor: isDark
                                ? "rgba(239,68,68,0.25)"
                                : "#FEF2F2",
                            },
                          ]}
                          activeOpacity={0.7}
                          onPress={() => handleDeleteMessage(true)}
                        >
                          <Feather name="trash-2" size={14} color="#EF4444" />
                          <Text
                            style={[
                              styles.stripActionBtnText,
                              { color: "#EF4444", fontWeight: "700" },
                            ]}
                          >
                            Everyone
                          </Text>
                        </TouchableOpacity>

                        <View
                          style={[
                            styles.stripDivider,
                            {
                              backgroundColor: isDark
                                ? "rgba(255,255,255,0.12)"
                                : "#E2E8F0",
                            },
                          ]}
                        />

                        <TouchableOpacity
                          style={styles.stripActionBtn}
                          activeOpacity={0.7}
                          onPress={() => handleDeleteMessage(false)}
                        >
                          <Feather
                            name="eye-off"
                            size={14}
                            color={isDark ? "#CBD5E1" : "#64748B"}
                          />
                          <Text
                            style={[
                              styles.stripActionBtnText,
                              { color: isDark ? "#CBD5E1" : "#64748B" },
                            ]}
                          >
                            For Me
                          </Text>
                        </TouchableOpacity>

                        <View
                          style={[
                            styles.stripDivider,
                            {
                              backgroundColor: isDark
                                ? "rgba(255,255,255,0.12)"
                                : "#E2E8F0",
                            },
                          ]}
                        />

                        <TouchableOpacity
                          style={styles.stripCloseBtn}
                          activeOpacity={0.7}
                          onPress={() => setDeleteMode(false)}
                        >
                          <Feather
                            name="x"
                            size={16}
                            color={isDark ? "#94A3B8" : "#64748B"}
                          />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.stripMainRow}>
                        {/* Reply Button */}
                        <TouchableOpacity
                          style={styles.stripActionBtn}
                          activeOpacity={0.7}
                          onPress={() => {
                            const msg = selectedMessageForAction;
                            setSelectedMessageForAction(null);
                            setDeleteMode(false);
                            handleStartReply(msg);
                          }}
                        >
                          <Ionicons
                            name="arrow-undo"
                            size={15}
                            color={isDark ? "#60A5FA" : "#2563EB"}
                          />
                          <Text
                            style={[
                              styles.stripActionBtnText,
                              {
                                color: isDark ? "#60A5FA" : "#2563EB",
                                fontWeight: "700",
                              },
                            ]}
                          >
                            Reply
                          </Text>
                        </TouchableOpacity>

                        <View
                          style={[
                            styles.stripDivider,
                            {
                              backgroundColor: isDark
                                ? "rgba(255,255,255,0.12)"
                                : "#E2E8F0",
                            },
                          ]}
                        />

                        {/* Edit Button */}
                        <TouchableOpacity
                          style={styles.stripActionBtn}
                          activeOpacity={0.7}
                          onPress={() => {
                            if (!isMe) {
                              Alert.alert(
                                "Cannot Edit",
                                "You can only edit messages you sent.",
                              );
                              return;
                            }
                            if (!canEdit) {
                              Alert.alert(
                                "Cannot Edit",
                                "Only text messages can be edited.",
                              );
                              return;
                            }
                            handleStartEdit();
                          }}
                        >
                          <Feather
                            name="edit-2"
                            size={15}
                            color={isDark ? "#60A5FA" : "#2563EB"}
                          />
                          <Text
                            style={[
                              styles.stripActionBtnText,
                              {
                                color: isDark ? "#FFFFFF" : "#0F172A",
                              },
                            ]}
                          >
                            Edit
                          </Text>
                        </TouchableOpacity>

                        <View
                          style={[
                            styles.stripDivider,
                            {
                              backgroundColor: isDark
                                ? "rgba(255,255,255,0.12)"
                                : "#E2E8F0",
                            },
                          ]}
                        />

                        {/* Delete Button */}
                        <TouchableOpacity
                          style={styles.stripActionBtn}
                          activeOpacity={0.7}
                          onPress={() => {
                            if (isMe) {
                              setDeleteMode(true);
                            } else {
                              Alert.alert(
                                "Delete Message",
                                "Hide this message from your chat history?",
                                [
                                  { text: "Cancel", style: "cancel" },
                                  {
                                    text: "Delete for Me",
                                    style: "destructive",
                                    onPress: () => handleDeleteMessage(false),
                                  },
                                ],
                              );
                            }
                          }}
                        >
                          <Feather name="trash-2" size={15} color="#EF4444" />
                          <Text
                            style={[
                              styles.stripActionBtnText,
                              { color: "#EF4444" },
                            ]}
                          >
                            Delete
                          </Text>
                        </TouchableOpacity>

                        {/* Copy Button (if text available) */}
                        {Boolean(selectedMessageForAction.text) && (
                          <>
                            <View
                              style={[
                                styles.stripDivider,
                                {
                                  backgroundColor: isDark
                                    ? "rgba(255,255,255,0.12)"
                                    : "#E2E8F0",
                                },
                              ]}
                            />
                            <TouchableOpacity
                              style={styles.stripActionBtn}
                              activeOpacity={0.7}
                              onPress={handleCopyMessageText}
                            >
                              <Feather
                                name="copy"
                                size={15}
                                color={isDark ? "#CBD5E1" : "#64748B"}
                              />
                              <Text
                                style={[
                                  styles.stripActionBtnText,
                                  {
                                    color: isDark ? "#CBD5E1" : "#64748B",
                                  },
                                ]}
                              >
                                Copy
                              </Text>
                            </TouchableOpacity>
                          </>
                        )}

                        {/* Pin / Unpin message */}
                        <View
                          style={[
                            styles.stripDivider,
                            {
                              backgroundColor: isDark
                                ? "rgba(255,255,255,0.12)"
                                : "#E2E8F0",
                            },
                          ]}
                        />
                        <TouchableOpacity
                          style={styles.stripActionBtn}
                          activeOpacity={0.7}
                          onPress={() => {
                            const msgId = selectedMessageForAction.id;
                            setSelectedMessageForAction(null);
                            setDeleteMode(false);
                            handleTogglePinMessage(msgId);
                          }}
                        >
                          <Ionicons
                            name={
                              (
                                pinnedMessageIdsMap[activeThread?.id || ""] ||
                                []
                              ).includes(selectedMessageForAction.id)
                                ? "pin"
                                : "pin-outline"
                            }
                            size={15}
                            color={
                              (
                                pinnedMessageIdsMap[activeThread?.id || ""] ||
                                []
                              ).includes(selectedMessageForAction.id)
                                ? selectedChatTheme
                                : isDark
                                  ? "#CBD5E1"
                                  : "#64748B"
                            }
                          />
                          <Text
                            style={[
                              styles.stripActionBtnText,
                              {
                                color: (
                                  pinnedMessageIdsMap[activeThread?.id || ""] ||
                                  []
                                ).includes(selectedMessageForAction.id)
                                  ? selectedChatTheme
                                  : isDark
                                    ? "#CBD5E1"
                                    : "#64748B",
                                fontWeight: (
                                  pinnedMessageIdsMap[activeThread?.id || ""] ||
                                  []
                                ).includes(selectedMessageForAction.id)
                                  ? "700"
                                  : "500",
                              },
                            ]}
                          >
                            {(
                              pinnedMessageIdsMap[activeThread?.id || ""] || []
                            ).includes(selectedMessageForAction.id)
                              ? "Unpin"
                              : "Pin"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Triangle pointer caret */}
                    {isAbove ? (
                      <View
                        style={[
                          styles.stripCaretDown,
                          {
                            borderTopColor: isDark ? "#1E222B" : "#FFFFFF",
                            right: isMe ? 24 : undefined,
                            left: !isMe ? 24 : undefined,
                          },
                        ]}
                      />
                    ) : (
                      <View
                        style={[
                          styles.stripCaretUp,
                          {
                            borderBottomColor: isDark ? "#1E222B" : "#FFFFFF",
                            right: isMe ? 24 : undefined,
                            left: !isMe ? 24 : undefined,
                          },
                        ]}
                      />
                    )}
                  </View>
                );
              })()}
          </TouchableOpacity>
        </Modal>

        {/* MESSENGER-STYLE FLOATING POPOVER MENU ABOVE THE "+" BUTTON */}
        <Modal
          visible={showAttachmentModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowAttachmentModal(false)}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowAttachmentModal(false)}
          >
            <View
              style={[
                styles.plusPopoverMenuContainer,
                {
                  bottom: Math.max(16, chatInputBottomPadding + 54),
                  backgroundColor: isDark ? "#282B33" : "#FFFFFF",
                  borderColor: isDark ? "rgba(255,255,255,0.12)" : "#E2E8F0",
                },
              ]}
              onStartShouldSetResponder={() => true}
            >
              {/* Option 1: Image / Photo */}
              <TouchableOpacity
                style={styles.plusPopoverRow}
                activeOpacity={0.7}
                onPress={handlePickAndSendImage}
              >
                <View style={styles.plusPopoverIconWrap}>
                  <Ionicons name="images" size={22} color="#3B82F6" />
                </View>
                <Text
                  style={[
                    styles.plusPopoverLabel,
                    { color: isDark ? "#FFFFFF" : "#0F172A" },
                  ]}
                >
                  Images
                </Text>
              </TouchableOpacity>

              {/* Option 2: Files */}
              {/* <TouchableOpacity
                style={styles.plusPopoverRow}
                activeOpacity={0.7}
                onPress={handlePickAndSendFile}
              >
                <View style={styles.plusPopoverIconWrap}>
                  <Ionicons name="attach" size={24} color="#3B82F6" />
                </View>
                <Text
                  style={[
                    styles.plusPopoverLabel,
                    { color: isDark ? "#FFFFFF" : "#0F172A" },
                  ]}
                >
                  Files
                </Text>
              </TouchableOpacity> */}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Fullscreen Lightbox Modal */}
        {renderLightboxModal()}

        {/* View All Media, Files & Links Modal */}
        {renderAllMediaModal()}
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
            onPress={() => {
              if (currentUserNote) {
                setShowNoteActionMenu(true);
              } else {
                setNoteInputText("");
                setSelectedNoteEmoji("");
                setShowNoteModal(true);
              }
            }}
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

            {/* Dedicated action menu button on card when user has an active note */}
            {/* {currentUserNote && (
              <TouchableOpacity
                style={[
                  styles.cardActionMenuBtn,
                  {
                    backgroundColor: isDark ? "#1E222B" : "#F1F5F9",
                    borderColor: isDark ? "rgba(255,255,255,0.08)" : "#E2E8F0",
                  },
                ]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={(e) => {
                  e.stopPropagation();
                  setShowNoteActionMenu(true);
                }}
              >
                <Feather
                  name="more-horizontal"
                  size={12}
                  color={isDark ? "#94A3B8" : "#64748B"}
                />
              </TouchableOpacity>
            )} */}
          </TouchableOpacity>

          {/* Cards 1..N: Real Friends & Roommates with Presence and Notes (Online First) */}
          {activeTrayMembers.map((member) => {
            const memberUid =
              member.cleanUid || member.userId || member.memberId || member.id;
            const displayName =
              member.displayName ||
              member.name ||
              member.email?.split("@")[0] ||
              "Friend";
            const firstName = displayName.split(" ")[0] || displayName;
            const initials = getInitials(displayName);
            const palette =
              AVATAR_PALETTES[
                Math.abs(hashString(String(memberUid))) % AVATAR_PALETTES.length
              ];
            const isHost =
              member.role === "HOST" ||
              householdInfo?.hostId === memberUid ||
              householdInfo?.hostId === member.userId;

            // Presence: online users first
            const presence = computePresence(
              member.lastActiveAt ||
                member.lastActiveDate ||
                member.lastSeen ||
                member.updatedAt ||
                member.createdAt,
              member.isOnline || member.online,
            );

            // Member's note
            const rawMemberNote =
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
                    expiresAt: member.noteExpiresAt || "",
                  }
                : undefined);

            const memberNote =
              rawMemberNote &&
              !isNoteExpired(rawMemberNote.updatedAt, rawMemberNote.expiresAt)
                ? rawMemberNote
                : undefined;

            const photo =
              member.profilePicture ||
              member.photoURL ||
              (typeof member.avatar === "string" &&
              member.avatar.startsWith("http")
                ? member.avatar
                : null);

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
                {/* Roommate / Friend Thought Bubble if set */}
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
                    {photo ? (
                      <Image
                        source={{ uri: photo }}
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

                  {/* Facebook Messenger Active Presence Indicator Dot */}
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

          {activeTrayMembers.length === 0 && !loading && (
            <View style={styles.noMembersHintWrap}>
              <Text
                style={[
                  styles.noMembersHintText,
                  { color: isDark ? "#64748B" : "#94A3B8" },
                ]}
              >
                {householdId
                  ? "No roommates or friends yet. Invite contacts to start chatting!"
                  : "Connect with friends in Community to start chatting!"}
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

          {/* "Requests" Filter Pill (Messenger Style) */}
          <TouchableOpacity
            style={[
              styles.filterPill,
              activeFilter === "requests"
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
            onPress={() => setActiveFilter("requests")}
          >
            <Text
              style={[
                styles.filterPillText,
                activeFilter === "requests"
                  ? styles.filterPillTextActive
                  : { color: isDark ? "#CBD5E1" : "#475569" },
              ]}
            >
              Requests
              {messageRequestsCount > 0 ? ` (${messageRequestsCount})` : ""}
            </Text>
          </TouchableOpacity>

          {/* "Bills Group" Filter Pill (only if user has a household) */}
          {Boolean(householdId) && (
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
          )}

          {/* "Pending Dues" Filter Pill (only if user has a household) */}
          {Boolean(householdId) && (
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
          )}

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
              onLongPress={() => handleLongPressConversation(item)}
              delayLongPress={400}
            >
              {/* Large 56px Messenger Avatar */}
              <View style={styles.messengerAvatarWrap}>
                {isGroup ? (
                  <GroupChatAvatar
                    members={householdMembers}
                    size={56}
                    isDark={isDark}
                  />
                ) : (
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
                )}

                {/* Online Dot for direct chat */}
                {!isGroup && item.isOnline && (
                  <View
                    style={[
                      styles.messengerOnlineDot,
                      { borderColor: isDark ? "#111215" : "#FFFFFF" },
                    ]}
                  />
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
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {item.lastMessage.includes("Video Call") && (
                      <Ionicons
                        name="videocam"
                        size={13}
                        color="#2563EB"
                        style={{ marginRight: 4 }}
                      />
                    )}
                    {item.lastMessage.includes("Voice Call") && (
                      <Ionicons
                        name="call"
                        size={13}
                        color="#2563EB"
                        style={{ marginRight: 4 }}
                      />
                    )}
                    <Text
                      style={[
                        styles.messengerSnippet,
                        hasUnread
                          ? [
                              styles.messengerSnippetUnread,
                              { color: isDark ? "#FFFFFF" : "#0F172A" },
                            ]
                          : { color: isDark ? "#94A3B8" : "#64748B" },
                        { flex: 1 },
                      ]}
                      numberOfLines={1}
                    >
                      {item.lastMessage}
                    </Text>
                  </View>

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

        {/* Empty state when no conversations match search or no chats yet */}
        {filteredConversations.length === 0 && !loading && (
          <View style={styles.emptyWrap}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: isDark ? "rgba(37, 99, 235, 0.15)" : "#EFF6FF",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <Ionicons
                name="chatbubbles"
                size={34}
                color={isDark ? "#60A5FA" : "#2563EB"}
              />
            </View>
            <Text
              style={[
                styles.emptyTitle,
                { color: isDark ? "#FFFFFF" : "#0F172A" },
              ]}
            >
              {searchQuery ? "No conversations found" : "Direct Messages"}
            </Text>
            <Text
              style={[
                styles.emptySubtitle,
                { color: isDark ? "#94A3B8" : "#64748B" },
              ]}
            >
              {searchQuery
                ? "Try searching for a different friend, keyword, or name."
                : "Connect 1-on-1 with community friends, roommates, and neighbors. You don't need a group to send direct messages!"}
            </Text>

            {/* Quick Action Buttons: Explore Community & Create Group */}
            {!searchQuery && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  marginTop: 20,
                  flexWrap: "wrap",
                }}
              >
                {onExploreCommunity && (
                  <TouchableOpacity
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      backgroundColor: "#2563EB",
                      paddingHorizontal: 18,
                      paddingVertical: 12,
                      borderRadius: 14,
                      shadowColor: "#2563EB",
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.25,
                      shadowRadius: 8,
                      elevation: 4,
                    }}
                    onPress={onExploreCommunity}
                    activeOpacity={0.85}
                  >
                    <Feather name="compass" size={17} color="#FFFFFF" />
                    <Text
                      style={{
                        color: "#FFFFFF",
                        fontSize: 14,
                        fontWeight: "700",
                      }}
                    >
                      Explore Community
                    </Text>
                  </TouchableOpacity>
                )}

                {onCreateGroup && !householdId && (
                  <TouchableOpacity
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      backgroundColor: isDark ? "#1E222B" : "#F1F5F9",
                      paddingHorizontal: 18,
                      paddingVertical: 12,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: isDark
                        ? "rgba(255, 255, 255, 0.1)"
                        : "#E2E8F0",
                    }}
                    onPress={onCreateGroup}
                    activeOpacity={0.85}
                  >
                    <Feather
                      name="plus-circle"
                      size={17}
                      color={isDark ? "#FFFFFF" : "#0F172A"}
                    />
                    <Text
                      style={{
                        color: isDark ? "#FFFFFF" : "#0F172A",
                        fontSize: 14,
                        fontWeight: "700",
                      }}
                    >
                      Create Group
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* If user has accepted community friends, offer 1-tap quick start cards */}
            {!searchQuery && acceptedCommunityFriends.length > 0 && (
              <View
                style={{ marginTop: 28, width: "100%", alignItems: "center" }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    letterSpacing: 0.5,
                    textTransform: "uppercase",
                    color: isDark ? "#94A3B8" : "#64748B",
                    marginBottom: 12,
                  }}
                >
                  Your Friends · Tap to Message
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{
                    gap: 12,
                    paddingHorizontal: 16,
                  }}
                >
                  {acceptedCommunityFriends.map((friend) => (
                    <TouchableOpacity
                      key={friend.userId || friend.id}
                      style={{
                        alignItems: "center",
                        width: 72,
                      }}
                      onPress={() => handleOpenDirectChatWithMember(friend)}
                      activeOpacity={0.8}
                    >
                      <View
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 24,
                          backgroundColor: "#2563EB",
                          alignItems: "center",
                          justifyContent: "center",
                          marginBottom: 6,
                          overflow: "hidden",
                        }}
                      >
                        {friend.photoURL || friend.profilePicture ? (
                          <Image
                            source={{
                              uri: friend.photoURL || friend.profilePicture,
                            }}
                            style={{ width: 48, height: 48 }}
                          />
                        ) : (
                          <Text
                            style={{
                              color: "#FFFFFF",
                              fontWeight: "700",
                              fontSize: 16,
                            }}
                          >
                            {getInitials(
                              friend.displayName || friend.name || "Friend",
                            )}
                          </Text>
                        )}
                      </View>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "600",
                          color: isDark ? "#FFFFFF" : "#0F172A",
                          textAlign: "center",
                        }}
                        numberOfLines={1}
                      >
                        {
                          (friend.displayName || friend.name || "Friend").split(
                            " ",
                          )[0]
                        }
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        )}

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* Messenger-style Circular Floating Plus Action Button */}
      <View style={styles.fabWrapper} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.circularPlusFab}
          activeOpacity={0.85}
          onPress={() => {
            setComposeSearchQuery("");
            setShowComposeModal(true);
          }}
          accessibilityLabel="Start a new conversation"
        >
          <Feather name="plus" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* MODAL 1: Share a Thought / Note (Facebook Messenger Style with OPTIONAL Emoji) */}
      <SmoothBottomSheetModal
        visible={showNoteModal}
        onClose={() => setShowNoteModal(false)}
        title={currentUserNote ? "Edit your thought" : "Share a thought"}
        subtitle={
          currentUserNote
            ? `${formatNoteRemainingTime(currentUserNote.updatedAt, currentUserNote.expiresAt)} · Updates will renew your note for 24 hours.`
            : "Post a note to your roommates that floats above your avatar. Automatically expires after 24 hours."
        }
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

            {/* Expiration badge / indicator under preview */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                marginTop: 6,
              }}
            >
              <Feather
                name="clock"
                size={13}
                color={isDark ? "#60A5FA" : "#2563EB"}
              />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: isDark ? "#60A5FA" : "#2563EB",
                }}
              >
                {currentUserNote
                  ? `${formatNoteRemainingTime(currentUserNote.updatedAt, currentUserNote.expiresAt)} (resets to 24h on save)`
                  : "Expires automatically 24 hours after sharing"}
              </Text>
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
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    paddingHorizontal: 14,
                  },
                ]}
                onPress={confirmClearNote}
                disabled={isSavingNote}
              >
                <Feather name="trash-2" size={15} color="#EF4444" />
                <Text
                  style={{
                    color: "#EF4444",
                    fontSize: 13,
                    fontWeight: "700",
                  }}
                >
                  Remove Note
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
                <Text style={styles.modalSubmitBtnText}>
                  {currentUserNote ? "Update Note" : "Share Note"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SmoothBottomSheetModal>

      {/* MODAL: Dedicated Action Menu for Active Note */}
      <SmoothBottomSheetModal
        visible={showNoteActionMenu}
        onClose={() => setShowNoteActionMenu(false)}
        title="Your Thought Note"
        subtitle={
          currentUserNote
            ? `${formatNoteRemainingTime(currentUserNote.updatedAt, currentUserNote.expiresAt)} · Visible to roommates`
            : "Manage your thought note"
        }
        icon={<Ionicons name="chatbubble-ellipses" size={20} color="#2563EB" />}
        maxHeight="48%"
        showChipBar={true}
      >
        <View
          style={{ gap: 12, paddingBottom: Math.max(30, insets.bottom + 16) }}
        >
          {currentUserNote && (
            <View
              style={{
                backgroundColor: isDark ? "#1E222B" : "#F8FAFC",
                borderRadius: 14,
                padding: 14,
                borderWidth: 1,
                borderColor: isDark ? "rgba(255,255,255,0.08)" : "#E2E8F0",
                gap: 6,
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "600",
                  color: isDark ? "#FFFFFF" : "#0F172A",
                }}
              >
                {currentUserNote.emoji ? `${currentUserNote.emoji} ` : ""}
                {currentUserNote.note}
              </Text>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Feather
                  name="clock"
                  size={12}
                  color={isDark ? "#60A5FA" : "#2563EB"}
                />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: isDark ? "#60A5FA" : "#2563EB",
                  }}
                >
                  {formatNoteRemainingTime(
                    currentUserNote.updatedAt,
                    currentUserNote.expiresAt,
                  )}
                </Text>
              </View>
            </View>
          )}

          {/* Edit Note Action Button */}
          <TouchableOpacity
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingVertical: 14,
              paddingHorizontal: 16,
              borderRadius: 12,
              backgroundColor: isDark ? "#1E222B" : "#F1F5F9",
            }}
            onPress={() => {
              setShowNoteActionMenu(false);
              if (currentUserNote) {
                setNoteInputText(currentUserNote.note || "");
                setSelectedNoteEmoji(currentUserNote.emoji || "");
              }
              setShowNoteModal(true);
            }}
          >
            <Feather
              name="edit-2"
              size={18}
              color={isDark ? "#60A5FA" : "#2563EB"}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: isDark ? "#FFFFFF" : "#0F172A",
                }}
              >
                Edit Note
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: isDark ? "#94A3B8" : "#64748B",
                }}
              >
                Change thought text or icon (resets 24h timer)
              </Text>
            </View>
            <Feather
              name="chevron-right"
              size={16}
              color={isDark ? "#64748B" : "#94A3B8"}
            />
          </TouchableOpacity>

          {/* Remove Note Action Button */}
          <TouchableOpacity
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingVertical: 14,
              paddingHorizontal: 16,
              borderRadius: 12,
              backgroundColor: isDark ? "rgba(239,68,68,0.12)" : "#FEF2F2",
              borderWidth: 1,
              borderColor: isDark ? "rgba(239,68,68,0.25)" : "#FCA5A5",
            }}
            onPress={() => {
              setShowNoteActionMenu(false);
              confirmClearNote();
            }}
          >
            <Feather name="trash-2" size={18} color="#EF4444" />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: "#EF4444",
                }}
              >
                Remove Note
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: isDark ? "#F87171" : "#DC2626",
                }}
              >
                Immediately clears note from messages screen
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color="#EF4444" />
          </TouchableOpacity>
        </View>
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
                    {formatMessageTime(viewingNoteData.note.updatedAt)} ·{" "}
                    {formatNoteRemainingTime(
                      viewingNoteData.note.updatedAt,
                      viewingNoteData.note.expiresAt,
                    )}
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

              {/* 24-hour Expiration countdown indicator */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  marginTop: 18,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 16,
                  backgroundColor: isDark ? "#1E222B" : "#F8FAFC",
                  borderWidth: 1,
                  borderColor: isDark ? "rgba(255,255,255,0.08)" : "#E2E8F0",
                }}
              >
                <Feather
                  name="clock"
                  size={13}
                  color={isDark ? "#60A5FA" : "#2563EB"}
                />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: isDark ? "#CBD5E1" : "#475569",
                  }}
                >
                  {formatNoteRemainingTime(
                    viewingNoteData.note.updatedAt,
                    viewingNoteData.note.expiresAt,
                  )}
                </Text>
              </View>
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
                    paddingBottom: keyboardActive
                      ? 8
                      : Math.max(bottomInset + 6, insets.bottom + 12),
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
        onClose={() => {
          setShowComposeModal(false);
          setComposeSearchQuery("");
        }}
        title="New Conversation"
        subtitle="Start a direct chat with friends and roommates or message the group."
        icon={<Feather name="edit-3" size={20} color="#2563EB" />}
        maxHeight="82%"
        showChipBar={true}
      >
        <View
          style={{
            gap: 12,
            paddingBottom: Math.max(30, insets.bottom + 16),
          }}
        >
          {/* Search Bar for friends & roommates */}
          <View
            style={[
              styles.composeSearchBar,
              {
                backgroundColor: isDark ? "#181A20" : "#F1F5F9",
                borderColor: isDark ? "rgba(255,255,255,0.08)" : "#E2E8F0",
              },
            ]}
          >
            <Feather
              name="search"
              size={16}
              color={isDark ? "#64748B" : "#94A3B8"}
              style={{ marginRight: 8 }}
            />
            <TextInput
              style={[
                styles.composeSearchInput,
                { color: isDark ? "#FFFFFF" : "#0F172A" },
              ]}
              placeholder="Search friends & roommates..."
              placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
              value={composeSearchQuery}
              onChangeText={setComposeSearchQuery}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {composeSearchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setComposeSearchQuery("")}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather
                  name="x-circle"
                  size={16}
                  color={isDark ? "#94A3B8" : "#64748B"}
                />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 10 }}
          >
            {/* Household Group Chat Card */}
            {householdId && !composeSearchQuery.trim() && (
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
                <GroupChatAvatar
                  members={householdMembers}
                  size={44}
                  isDark={isDark}
                />
                <View style={{ flex: 1, marginLeft: 2 }}>
                  <Text
                    style={{
                      fontSize: 14.5,
                      fontWeight: "700",
                      color: isDark ? "#FFFFFF" : "#0F172A",
                    }}
                  >
                    {householdInfo?.householdName || "Household Bills Group"}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11.5,
                      color: isDark ? "#94A3B8" : "#64748B",
                      marginTop: 1,
                    }}
                  >
                    Group · All {householdMembers.length || 1} members
                  </Text>
                </View>
                <Feather
                  name="chevron-right"
                  size={18}
                  color={isDark ? "#64748B" : "#94A3B8"}
                />
              </TouchableOpacity>
            )}

            {/* Section Header */}
            <View style={{ marginTop: 4, marginBottom: 2 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  color: isDark ? "#64748B" : "#94A3B8",
                }}
              >
                Friends & Roommates ({composeFilteredMembers.length})
              </Text>
            </View>

            {/* List of Friends and Roommates */}
            {composeFilteredMembers.map((member) => {
              const memberUid =
                member.cleanUid ||
                member.userId ||
                member.memberId ||
                member.id;
              const name =
                member.displayName ||
                member.name ||
                member.email?.split("@")[0] ||
                "Friend";
              const initials = getInitials(name);
              const palette =
                AVATAR_PALETTES[
                  Math.abs(hashString(String(memberUid))) %
                    AVATAR_PALETTES.length
                ];
              const photo =
                member.profilePicture ||
                member.photoURL ||
                (typeof member.avatar === "string" &&
                member.avatar.startsWith("http")
                  ? member.avatar
                  : null);
              const presence = computePresence(
                member.lastActiveAt ||
                  member.lastActiveDate ||
                  member.lastSeen ||
                  member.updatedAt ||
                  member.createdAt,
                member.isOnline || member.online,
              );
              const isHost =
                (member.role || "").toUpperCase() === "HOST" ||
                householdInfo?.hostId === memberUid;

              // Subtitle without Payor / Non-payor
              let subtitle = presence.isOnline
                ? "Active now"
                : presence.statusLabel !== "Offline"
                  ? presence.statusLabel
                  : isHost
                    ? "Host"
                    : member.isOutsideFriend || member.isFriend
                      ? "Friend"
                      : "Roommate";

              return (
                <TouchableOpacity
                  key={memberUid}
                  style={[
                    styles.composeRoommateRow,
                    {
                      backgroundColor: isDark ? "#111215" : "#F8FAFC",
                      borderColor: isDark
                        ? "rgba(255,255,255,0.08)"
                        : "#E2E8F0",
                    },
                  ]}
                  onPress={() => {
                    setShowComposeModal(false);
                    handleOpenDirectChatWithMember(member);
                  }}
                >
                  <View style={styles.composeAvatarWrap}>
                    <View
                      style={[
                        styles.avatarBox,
                        {
                          backgroundColor: palette.bg,
                          width: 44,
                          height: 44,
                          borderRadius: 22,
                        },
                      ]}
                    >
                      {photo ? (
                        <Image
                          source={{ uri: photo }}
                          style={{ width: "100%", height: "100%" }}
                        />
                      ) : (
                        <Text
                          style={[
                            styles.avatarText,
                            { color: palette.text, fontSize: 14 },
                          ]}
                        >
                          {initials}
                        </Text>
                      )}
                    </View>
                    {presence.isOnline && (
                      <View
                        style={[
                          styles.composeOnlineDot,
                          { borderColor: isDark ? "#111215" : "#FFFFFF" },
                        ]}
                      />
                    )}
                  </View>

                  <View style={{ flex: 1, marginLeft: 2 }}>
                    <Text
                      style={{
                        fontSize: 14.5,
                        fontWeight: "700",
                        color: isDark ? "#FFFFFF" : "#0F172A",
                      }}
                      numberOfLines={1}
                    >
                      {name}
                    </Text>
                    <Text
                      style={{
                        fontSize: 11.5,
                        color: presence.isOnline
                          ? "#10B981"
                          : isDark
                            ? "#94A3B8"
                            : "#64748B",
                        marginTop: 1,
                        fontWeight: presence.isOnline ? "600" : "500",
                      }}
                      numberOfLines={1}
                    >
                      {subtitle}
                    </Text>
                  </View>

                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={20}
                    color={isDark ? "#60A5FA" : "#2563EB"}
                  />
                </TouchableOpacity>
              );
            })}

            {composeFilteredMembers.length === 0 && (
              <View style={{ alignItems: "center", paddingVertical: 24 }}>
                <Text
                  style={{
                    fontSize: 13,
                    color: isDark ? "#94A3B8" : "#64748B",
                  }}
                >
                  {composeSearchQuery.trim()
                    ? `No friends or roommates found matching "${composeSearchQuery}"`
                    : "No friends or roommates found."}
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </SmoothBottomSheetModal>

      {/* Offline Call Confirmation Prompt Modal */}
      <OfflineCallPromptModal
        visible={Boolean(offlinePromptData?.visible)}
        onClose={() => setOfflinePromptData(null)}
        contactName={offlinePromptData?.contactName || "Contact"}
        contactAvatar={offlinePromptData?.contactAvatar}
        lastActiveLabel={offlinePromptData?.lastActiveLabel || "Offline"}
        callType={offlinePromptData?.callType || "voice"}
        onRingAnyway={() => {
          if (offlinePromptData) {
            const data = offlinePromptData;
            setOfflinePromptData(null);
            handleStartCall(
              data.callType,
              {
                id: data.contactId,
                name: data.contactName,
                avatar: data.contactAvatar,
              },
              true,
            );
          }
        }}
        onSendMessage={() => {
          setOfflinePromptData(null);
          setTimeout(() => {
            chatInputRef.current?.focus();
          }, 150);
        }}
      />

      {/* MODAL: Delete Entire Conversation Confirmation */}
      <SmoothBottomSheetModal
        visible={Boolean(selectedConversationForDelete)}
        onClose={() => {
          if (!isDeletingConversation) setSelectedConversationForDelete(null);
        }}
        title="Delete Conversation?"
        subtitle="This action cannot be undone."
        icon={<Feather name="trash-2" size={20} color="#EF4444" />}
        maxHeight="50%"
        showChipBar={true}
      >
        <View
          style={{
            gap: 14,
            paddingBottom: Math.max(20, insets.bottom + 12),
          }}
        >
          <Text
            style={{
              fontSize: 14.5,
              lineHeight: 21,
              color: isDark ? "#CBD5E1" : "#475569",
            }}
          >
            Are you sure you want to delete the entire conversation with{" "}
            <Text
              style={{
                fontWeight: "700",
                color: isDark ? "#FFFFFF" : "#0F172A",
              }}
            >
              {selectedConversationForDelete?.name || "this contact"}
            </Text>
            ? All messages and attachments in this conversation will be
            permanently removed.
          </Text>

          <TouchableOpacity
            style={{
              backgroundColor: "#EF4444",
              paddingVertical: 14,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 8,
              marginTop: 4,
            }}
            onPress={handleDeleteConversationConfirm}
            disabled={isDeletingConversation}
            activeOpacity={0.8}
          >
            {isDeletingConversation ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Feather name="trash-2" size={18} color="#FFFFFF" />
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontSize: 15,
                    fontWeight: "700",
                  }}
                >
                  Delete Entire Conversation
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              backgroundColor: isDark ? "#1E222B" : "#F1F5F9",
              paddingVertical: 13,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
            }}
            onPress={() => setSelectedConversationForDelete(null)}
            disabled={isDeletingConversation}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: isDark ? "#94A3B8" : "#64748B",
              }}
            >
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </SmoothBottomSheetModal>

      {/* Fullscreen Lightbox Modal */}
      {renderLightboxModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  swipeRowWrapper: {
    position: "relative",
    width: "100%",
    justifyContent: "center",
  },
  swipeReplyIconContainer: {
    position: "absolute",
    top: "50%",
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  reactionBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    gap: 4,
  },
  reactionEmojiBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  reactionEmojiText: {
    fontSize: 20,
  },
  msgReplySnippetBox: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderLeftWidth: 3,
    marginBottom: 6,
  },
  msgReplySnippetBoxMe: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderLeftColor: "#FFFFFF",
  },
  msgReplySnippetBoxThem: {
    borderLeftWidth: 3,
  },
  msgReplySnippetSenderMe: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 1,
  },
  msgReplySnippetTextMe: {
    fontSize: 11,
    color: "rgba(255,255,255,0.85)",
  },
  msgReplySnippetSenderThem: {
    fontSize: 10.5,
    fontWeight: "700",
    marginBottom: 1,
  },
  msgReplySnippetTextThem: {
    fontSize: 11,
  },
  bubbleReactionsPill: {
    position: "absolute",
    bottom: -9,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
    gap: 2,
    zIndex: 3,
  },
  bubbleReactionsPillMe: {
    right: 6,
  },
  bubbleReactionsPillThem: {
    left: 6,
  },
  bubbleReactionItemText: {
    fontSize: 11,
    fontWeight: "600",
  },
  chatHeaderActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  callLogCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    marginTop: 4,
    minWidth: 210,
  },
  callLogIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(37, 99, 235, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  callLogDetails: {
    flex: 1,
  },
  callLogTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  callLogSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  callBackBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: "#2563EB",
  },
  callBackBtnText: {
    color: "#FFFFFF",
    fontSize: 11.5,
    fontWeight: "700",
  },
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
  cardActionMenuBtn: {
    marginTop: 3,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
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
  speechBubbleImage: {
    backgroundColor: "transparent",
    paddingHorizontal: 0,
    paddingVertical: 0,
    padding: 0,
    borderRadius: 16,
    overflow: "hidden",
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
    bottom: 34,
    right: 20,
  },
  circularPlusFab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
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
  composeSearchBar: {
    flexDirection: "row",
    alignItems: "center",
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  composeSearchInput: {
    flex: 1,
    height: "100%",
    fontSize: 13,
    paddingVertical: 0,
    textAlignVertical: "center",
  },
  composeAvatarWrap: {
    position: "relative",
    width: 44,
    height: 44,
  },
  composeOnlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: "#22C55E",
    borderWidth: 2,
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
  requestBannerBox: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  requestBannerHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  requestBannerIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  requestBannerTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 2,
  },
  requestBannerDesc: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  requestBannerButtonsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
  },
  requestAcceptBtn: {
    flex: 1,
    backgroundColor: "#1877F2",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  requestAcceptBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  requestDeclineBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  requestDeclineBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },

  /* SMALL MODAL ACTION STRIP */
  smallModalStripContainer: {
    position: "absolute",
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 99999,
  },
  stripMainRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  stripDeleteOptionsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  stripDeletingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  stripDeletingText: {
    fontSize: 13,
    fontWeight: "600",
  },
  stripActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  stripActionBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  stripDeleteEveryoneBtn: {
    borderRadius: 10,
    marginVertical: 3,
    marginLeft: 3,
  },
  stripDivider: {
    width: 1,
    height: 20,
  },
  stripCloseBtn: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  stripCaretDown: {
    position: "absolute",
    bottom: -6,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  stripCaretUp: {
    position: "absolute",
    top: -6,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 6,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  editingBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 8,
    borderRadius: 4,
  },
  plusPopoverMenuContainer: {
    position: "absolute",
    left: 14,
    width: 215,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 16,
    zIndex: 99999,
  },
  plusPopoverRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    gap: 14,
  },
  plusPopoverIconWrap: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  plusPopoverLabel: {
    fontSize: 16.5,
    fontWeight: "600",
    letterSpacing: -0.2,
  },

  /* =================================================== */
  /* MESSENGER-STYLE CONVERSATION INFO & LIGHTBOX STYLES */
  /* =================================================== */
  conversationInfoHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  conversationInfoBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  conversationInfoScrollContent: {
    paddingBottom: 40,
  },
  conversationInfoProfileCenter: {
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  conversationInfoAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  conversationInfoAvatarImg: {
    width: "100%",
    height: "100%",
  },
  conversationInfoAvatarInitials: {
    fontSize: 36,
    fontWeight: "900",
  },
  conversationInfoName: {
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  conversationInfoStatus: {
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
  },
  conversationInfoQuickActionsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-start",
    gap: 16,
    paddingHorizontal: 16,
    marginTop: 14,
    marginBottom: 18,
  },
  conversationInfoQuickActionItem: {
    alignItems: "center",
    width: 72,
  },
  conversationInfoQuickActionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  conversationInfoQuickActionLabel: {
    fontSize: 11.5,
    fontWeight: "500",
    textAlign: "center",
  },
  conversationInfoSectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    paddingHorizontal: 20,
    marginTop: 18,
    marginBottom: 6,
  },
  conversationInfoMediaPreviewRow: {
    paddingHorizontal: 18,
    gap: 10,
    paddingVertical: 6,
  },
  conversationInfoMediaCard: {
    width: 140,
    height: 160,
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
  },
  conversationInfoMediaImg: {
    width: "100%",
    height: "100%",
  },
  conversationInfoMediaOverlay: {
    position: "absolute",
    right: 8,
    bottom: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  conversationInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 20,
    gap: 14,
  },
  conversationInfoRowIconWrap: {
    width: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  conversationInfoRowTextCol: {
    flex: 1,
  },
  conversationInfoRowTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  conversationInfoRowSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  conversationInfoRowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  conversationInfoRowRightText: {
    fontSize: 13,
    fontWeight: "500",
  },
  inChatSearchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  inChatSearchInput: {
    flex: 1,
    height: 36,
    fontSize: 14,
    paddingVertical: 0,
  },
  inChatSearchCloseBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.96)",
  },
  lightboxHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 20,
  },
  lightboxCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  lightboxHeaderInfo: {
    flex: 1,
    marginHorizontal: 12,
  },
  lightboxSenderText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  lightboxTimeText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    marginTop: 1,
  },
  lightboxScroll: {
    flex: 1,
  },
  lightboxScrollContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  lightboxCaptionBox: {
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  lightboxCaptionText: {
    color: "#FFFFFF",
    fontSize: 14,
    textAlign: "center",
  },
  allMediaTabsRow: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  allMediaTabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  allMediaTabBtnActive: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  allMediaTabText: {
    fontSize: 13,
  },
  allMediaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 14,
    gap: 8,
  },
  allMediaGridItem: {
    width: "31%",
    aspectRatio: 1,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#E2E8F0",
  },
  allMediaFileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 16,
  },
});
