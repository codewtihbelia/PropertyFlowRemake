import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import {
  communityService,
  CommunityReel,
  CommunityReelComment,
  formatAuthorDisplayName,
} from "../services/communityService";
import { auth } from "../firebase/config";

interface ReelCommentsModalProps {
  visible: boolean;
  reel: CommunityReel | null;
  onClose: () => void;
  currentUser: {
    uid?: string;
    name?: string;
    displayName?: string;
    photoURL?: string;
    profilePicture?: string;
  };
}

export const ReelCommentsModal: React.FC<ReelCommentsModalProps> = ({
  visible,
  reel,
  onClose,
  currentUser,
}) => {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const [comments, setComments] = useState<CommunityReelComment[]>([]);
  const [newCommentText, setNewCommentText] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      },
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        setKeyboardHeight(0);
      },
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!visible || !reel) {
      setComments([]);
      return;
    }

    setLoading(true);
    const unsub = communityService.subscribeReelComments(reel.id, (list) => {
      setComments(list);
      setLoading(false);
    });

    return () => unsub();
  }, [visible, reel?.id]);

  const handleSubmitComment = async () => {
    if (!reel || !newCommentText.trim()) return;

    const userUid = auth.currentUser?.uid || currentUser.uid || "";
    if (!userUid) {
      Alert.alert("Authentication Required", "Please sign in to comment.");
      return;
    }

    const userName = formatAuthorDisplayName(
      currentUser.displayName || currentUser.name,
      auth.currentUser?.email,
    );
    const userAvatar = currentUser.photoURL || currentUser.profilePicture || "";

    const textToSubmit = newCommentText.trim();
    setNewCommentText("");

    // Optimistic local comment
    const tempComment: CommunityReelComment = {
      id: `temp_${Date.now()}`,
      reelId: reel.id,
      authorId: userUid,
      authorName: userName,
      authorAvatar: userAvatar,
      content: textToSubmit,
      createdAt: new Date().toISOString(),
    };
    setComments((prev) => [...prev, tempComment]);

    try {
      setSubmitting(true);
      await communityService.addReelComment(reel.id, textToSubmit, {
        uid: userUid,
        name: userName,
        avatar: userAvatar,
      });
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to post comment.");
      setComments((prev) => prev.filter((c) => c.id !== tempComment.id));
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible || !reel) return null;

  const currentAvatar =
    currentUser.photoURL || currentUser.profilePicture || "";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={[
            styles.sheetContainer,
            {
              backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
              borderTopColor: isDark ? "#334155" : "#E2E8F0",
              paddingBottom:
                Platform.OS === "android"
                  ? Math.max(insets.bottom, 16)
                  : Math.max(insets.bottom, 12),
            },
          ]}
        >
          {/* Top Grab Handle */}
          <View style={styles.handleWrap}>
            <View
              style={[
                styles.handleBar,
                { backgroundColor: isDark ? "#475569" : "#CBD5E1" },
              ]}
            />
          </View>

          {/* Header */}
          <View
            style={[
              styles.header,
              { borderBottomColor: isDark ? "#1E293B" : "#F1F5F9" },
            ]}
          >
            <View style={styles.headerTitleRow}>
              <Ionicons name="chatbubble-ellipses" size={18} color="#2563EB" />
              <Text
                style={[
                  styles.headerTitle,
                  { color: isDark ? "#F8FAFC" : "#0F172A" },
                ]}
              >
                Comments ({comments.length})
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather
                name="x"
                size={20}
                color={isDark ? "#94A3B8" : "#64748B"}
              />
            </TouchableOpacity>
          </View>

          {/* Comments List */}
          <ScrollView
            style={styles.commentsList}
            contentContainerStyle={styles.commentsListContent}
            keyboardShouldPersistTaps="handled"
          >
            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color="#2563EB" />
                <Text
                  style={[
                    styles.loadingText,
                    { color: isDark ? "#94A3B8" : "#64748B" },
                  ]}
                >
                  Loading discussion...
                </Text>
              </View>
            ) : comments.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons
                  name="chatbubbles-outline"
                  size={36}
                  color={isDark ? "#475569" : "#CBD5E1"}
                />
                <Text
                  style={[
                    styles.emptyTitle,
                    { color: isDark ? "#F8FAFC" : "#0F172A" },
                  ]}
                >
                  No comments yet
                </Text>
                <Text
                  style={[
                    styles.emptySubtitle,
                    { color: isDark ? "#94A3B8" : "#64748B" },
                  ]}
                >
                  Be the first roommate to share your thoughts on this reel!
                </Text>
              </View>
            ) : (
              comments.map((comment) => (
                <View key={comment.id} style={styles.commentRow}>
                  {comment.authorAvatar ? (
                    <Image
                      source={{ uri: comment.authorAvatar }}
                      style={styles.commentAvatar}
                    />
                  ) : (
                    <View
                      style={[
                        styles.commentAvatarFallback,
                        { backgroundColor: isDark ? "#1E293B" : "#EFF6FF" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.commentAvatarText,
                          { color: isDark ? "#60A5FA" : "#2563EB" },
                        ]}
                      >
                        {comment.authorName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}

                  <View style={styles.commentBody}>
                    <View
                      style={[
                        styles.commentBubble,
                        {
                          backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                          borderColor: isDark ? "#334155" : "#E2E8F0",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.commentAuthorName,
                          { color: isDark ? "#F8FAFC" : "#0F172A" },
                        ]}
                      >
                        {comment.authorName}
                      </Text>
                      <Text
                        style={[
                          styles.commentContentText,
                          { color: isDark ? "#CBD5E1" : "#334155" },
                        ]}
                      >
                        {comment.content}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.commentTime,
                        { color: isDark ? "#64748B" : "#94A3B8" },
                      ]}
                    >
                      {new Date(comment.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          {/* Bottom Input Bar */}
          <View
            style={[
              styles.inputBar,
              {
                backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
                borderTopColor: isDark ? "#1E293B" : "#E2E8F0",
              },
            ]}
          >
            {currentAvatar ? (
              <Image
                source={{ uri: currentAvatar }}
                style={styles.inputUserAvatar}
              />
            ) : (
              <View
                style={[
                  styles.inputAvatarFallback,
                  { backgroundColor: isDark ? "#1E293B" : "#EFF6FF" },
                ]}
              >
                <Text
                  style={[
                    styles.inputAvatarText,
                    { color: isDark ? "#60A5FA" : "#2563EB" },
                  ]}
                >
                  {(currentUser.displayName || currentUser.name || "U")
                    .charAt(0)
                    .toUpperCase()}
                </Text>
              </View>
            )}

            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: isDark ? "#1E293B" : "#F1F5F9",
                  color: isDark ? "#F8FAFC" : "#0F172A",
                  borderColor: isDark ? "#334155" : "#E2E8F0",
                },
              ]}
              placeholder="Add a friendly comment..."
              placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
              value={newCommentText}
              onChangeText={setNewCommentText}
              multiline
              maxLength={300}
            />

            <TouchableOpacity
              onPress={handleSubmitComment}
              disabled={submitting || !newCommentText.trim()}
              style={[
                styles.sendBtn,
                {
                  backgroundColor:
                    newCommentText.trim() && !submitting
                      ? "#2563EB"
                      : isDark
                        ? "#1E293B"
                        : "#E2E8F0",
                },
              ]}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons
                  name="arrow-up"
                  size={18}
                  color={
                    newCommentText.trim()
                      ? "#FFFFFF"
                      : isDark
                        ? "#475569"
                        : "#94A3B8"
                  }
                />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheetContainer: {
    maxHeight: "75%",
    minHeight: "50%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    overflow: "hidden",
  },
  handleWrap: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 4,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
  },
  commentsList: {
    flex: 1,
  },
  commentsListContent: {
    padding: 16,
    gap: 14,
  },
  loadingBox: {
    paddingVertical: 32,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
  },
  emptyBox: {
    paddingVertical: 48,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: "center",
    maxWidth: 260,
  },
  commentRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  commentAvatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  commentAvatarText: {
    fontSize: 14,
    fontWeight: "700",
  },
  commentBody: {
    flex: 1,
    gap: 4,
  },
  commentBubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderTopLeftRadius: 4,
    borderWidth: 1,
  },
  commentAuthorName: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  commentContentText: {
    fontSize: 14,
    lineHeight: 19,
  },
  commentTime: {
    fontSize: 11,
    marginLeft: 6,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 10,
  },
  inputUserAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  inputAvatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  inputAvatarText: {
    fontSize: 13,
    fontWeight: "700",
  },
  textInput: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 90,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});
