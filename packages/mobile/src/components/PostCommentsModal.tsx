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
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import {
  communityService,
  CommunityComment,
  CommunityPost,
  formatAuthorDisplayName,
} from "../services/communityService";
import { auth } from "../firebase/config";

interface PostCommentsModalProps {
  visible: boolean;
  post: CommunityPost | null;
  onClose: () => void;
  currentUser: {
    uid?: string;
    name?: string;
    displayName?: string;
    photoURL?: string;
    profilePicture?: string;
  };
}

export const PostCommentsModal: React.FC<PostCommentsModalProps> = ({
  visible,
  post,
  onClose,
  currentUser,
}) => {
  const { colors, isDark } = useTheme();
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [newCommentText, setNewCommentText] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const currentUid = auth.currentUser?.uid || currentUser.uid || "";
  const authorName = formatAuthorDisplayName(
    currentUser.displayName || currentUser.name,
    auth.currentUser?.email,
  );
  const authorAvatar = currentUser.photoURL || currentUser.profilePicture || "";

  useEffect(() => {
    if (!visible || !post?.id) {
      setComments([]);
      return;
    }

    setLoading(true);
    const unsub = communityService.subscribeComments(post.id, (list) => {
      setComments(list);
      setLoading(false);
    });

    return () => {
      unsub();
    };
  }, [visible, post?.id]);

  const handleSendComment = async () => {
    if (!post?.id) return;
    const trimmed = newCommentText.trim();
    if (!trimmed) return;

    try {
      setSubmitting(true);
      await communityService.addComment(
        post.id,
        trimmed,
        authorName,
        authorAvatar,
      );
      setNewCommentText("");
    } catch (err: any) {
      console.error("Error adding comment:", err);
      Alert.alert("Error", err?.message || "Could not post comment.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleLikeComment = async (comment: CommunityComment) => {
    if (!post?.id || !currentUid) return;
    try {
      await communityService.toggleLikeComment(
        post.id,
        comment.id,
        comment.likes,
      );
    } catch (err) {
      console.warn("Error liking comment:", err);
    }
  };

  const handleDeleteComment = (comment: CommunityComment) => {
    if (!post?.id) return;
    Alert.alert(
      "Delete Comment",
      "Are you sure you want to delete this comment?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await communityService.deleteComment(post.id, comment.id);
            } catch (err) {
              console.warn("Error deleting comment:", err);
            }
          },
        },
      ],
    );
  };

  const formatTimeAgo = (isoString?: string) => {
    if (!isoString) return "";
    const diff = Math.max(0, Date.now() - new Date(isoString).getTime());
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  if (!post) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.overlay}
      >
        <View
          style={[
            styles.container,
            { backgroundColor: isDark ? "#1E293B" : "#FFFFFF" },
          ]}
        >
          {/* Header */}
          <View
            style={[
              styles.header,
              { borderBottomColor: isDark ? "#334155" : "#E2E8F0" },
            ]}
          >
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather
                name="x"
                size={22}
                color={isDark ? "#94A3B8" : "#64748B"}
              />
            </TouchableOpacity>
            <View style={styles.titleContainer}>
              <Text
                style={[
                  styles.headerTitle,
                  { color: isDark ? "#F8FAFC" : "#0F172A" },
                ]}
              >
                Comments
              </Text>
              <Text
                style={[
                  styles.headerSubtitle,
                  { color: isDark ? "#94A3B8" : "#64748B" },
                ]}
              >
                {comments.length} responses
              </Text>
            </View>
            <View style={{ width: 32 }} />
          </View>

          {/* Post preview pill */}
          <View
            style={[
              styles.postSnippet,
              {
                backgroundColor: isDark ? "#0F172A60" : "#F8FAFC",
                borderBottomColor: isDark ? "#334155" : "#E2E8F0",
              },
            ]}
          >
            <Text
              style={[
                styles.snippetAuthor,
                { color: isDark ? "#E2E8F0" : "#334155" },
              ]}
              numberOfLines={1}
            >
              Post by{" "}
              {formatAuthorDisplayName(post.authorName, post.authorEmail)}
            </Text>
            <Text
              style={[
                styles.snippetContent,
                { color: isDark ? "#94A3B8" : "#64748B" },
              ]}
              numberOfLines={2}
            >
              {post.content}
            </Text>
          </View>

          {/* Comments List */}
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
          >
            {loading ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="small" color="#2563EB" />
                <Text
                  style={[
                    styles.loadingText,
                    { color: isDark ? "#94A3B8" : "#64748B" },
                  ]}
                >
                  Loading conversation...
                </Text>
              </View>
            ) : comments.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons
                  name="chatbubbles-outline"
                  size={44}
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
                    styles.emptySub,
                    { color: isDark ? "#94A3B8" : "#64748B" },
                  ]}
                >
                  Be the first to share your thoughts or answer this post!
                </Text>
              </View>
            ) : (
              comments.map((item) => {
                const isLiked = currentUid
                  ? item.likes.includes(currentUid)
                  : false;
                const isAuthor = currentUid === item.authorId;
                const commentAuthorName = formatAuthorDisplayName(
                  item.authorName,
                );

                return (
                  <View key={item.id} style={styles.commentItem}>
                    {item.authorAvatar ? (
                      <Image
                        source={{ uri: item.authorAvatar }}
                        style={styles.commentAvatar}
                      />
                    ) : (
                      <View
                        style={[
                          styles.commentAvatarPlaceholder,
                          {
                            backgroundColor: isDark ? "#334155" : "#DBEAFE",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.commentAvatarInitials,
                            { color: isDark ? "#94A3B8" : "#1D4ED8" },
                          ]}
                        >
                          {commentAuthorName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}

                    <View style={styles.commentContentWrapper}>
                      <View
                        style={[
                          styles.commentBubble,
                          {
                            backgroundColor: isDark ? "#334155" : "#F1F5F9",
                          },
                        ]}
                      >
                        <View style={styles.commentHeaderRow}>
                          <Text
                            style={[
                              styles.commentAuthorName,
                              { color: isDark ? "#F8FAFC" : "#0F172A" },
                            ]}
                          >
                            {commentAuthorName}
                          </Text>
                          <Text
                            style={[
                              styles.commentTime,
                              { color: isDark ? "#94A3B8" : "#64748B" },
                            ]}
                          >
                            {formatTimeAgo(item.createdAt)}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.commentText,
                            { color: isDark ? "#E2E8F0" : "#1E293B" },
                          ]}
                        >
                          {item.content}
                        </Text>
                      </View>

                      {/* Comment actions */}
                      <View style={styles.commentActionsRow}>
                        <TouchableOpacity
                          onPress={() => handleToggleLikeComment(item)}
                          style={styles.commentActionBtn}
                        >
                          <Ionicons
                            name={isLiked ? "heart" : "heart-outline"}
                            size={14}
                            color={
                              isLiked
                                ? "#EF4444"
                                : isDark
                                  ? "#94A3B8"
                                  : "#64748B"
                            }
                          />
                          <Text
                            style={[
                              styles.commentActionText,
                              {
                                color: isLiked
                                  ? "#EF4444"
                                  : isDark
                                    ? "#94A3B8"
                                    : "#64748B",
                              },
                            ]}
                          >
                            {item.likes.length > 0 ? item.likes.length : "Like"}
                          </Text>
                        </TouchableOpacity>

                        {isAuthor && (
                          <TouchableOpacity
                            onPress={() => handleDeleteComment(item)}
                            style={styles.commentActionBtn}
                          >
                            <Feather
                              name="trash-2"
                              size={13}
                              color={isDark ? "#94A3B8" : "#64748B"}
                            />
                            <Text
                              style={[
                                styles.commentActionText,
                                { color: isDark ? "#94A3B8" : "#64748B" },
                              ]}
                            >
                              Delete
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Bottom input bar */}
          <View
            style={[
              styles.inputBar,
              {
                borderTopColor: isDark ? "#334155" : "#E2E8F0",
                backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
              },
            ]}
          >
            {authorAvatar ? (
              <Image source={{ uri: authorAvatar }} style={styles.myAvatar} />
            ) : (
              <View
                style={[
                  styles.myAvatarPlaceholder,
                  { backgroundColor: isDark ? "#334155" : "#E2E8F0" },
                ]}
              >
                <Text
                  style={[
                    styles.myAvatarInitials,
                    { color: isDark ? "#94A3B8" : "#475569" },
                  ]}
                >
                  {authorName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}

            <TextInput
              style={[
                styles.inputField,
                {
                  color: isDark ? "#F8FAFC" : "#0F172A",
                  backgroundColor: isDark ? "#0F172A" : "#F8FAFC",
                  borderColor: isDark ? "#334155" : "#E2E8F0",
                },
              ]}
              placeholder="Write a comment..."
              placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
              value={newCommentText}
              onChangeText={setNewCommentText}
              multiline
              maxLength={500}
              editable={!submitting}
            />

            <TouchableOpacity
              onPress={handleSendComment}
              disabled={submitting || !newCommentText.trim()}
              style={[
                styles.sendBtn,
                {
                  backgroundColor: "#2563EB",
                  opacity: submitting || !newCommentText.trim() ? 0.4 : 1,
                },
              ]}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="send" size={16} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: "82%",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  closeBtn: {
    padding: 6,
  },
  titleContainer: {
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  postSnippet: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  snippetAuthor: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 2,
  },
  snippetContent: {
    fontSize: 13,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 16,
  },
  centerContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 50,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 6,
  },
  emptySub: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  commentItem: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#CBD5E1",
  },
  commentAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  commentAvatarInitials: {
    fontSize: 14,
    fontWeight: "700",
  },
  commentContentWrapper: {
    marginLeft: 10,
    flex: 1,
  },
  commentBubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  commentHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  commentAuthorName: {
    fontSize: 13,
    fontWeight: "700",
  },
  commentTime: {
    fontSize: 11,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
  },
  commentActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingLeft: 8,
    paddingTop: 4,
  },
  commentActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  commentActionText: {
    fontSize: 12,
    fontWeight: "500",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 10,
  },
  myAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  myAvatarPlaceholder: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  myAvatarInitials: {
    fontSize: 13,
    fontWeight: "700",
  },
  inputField: {
    flex: 1,
    minHeight: 38,
    maxHeight: 100,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
});
