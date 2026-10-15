import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  increment,
  limit,
} from "firebase/firestore";
import { db, auth } from "../firebase/config";

export type CommunityCategory =
  | "all"
  | "general"
  | "roommate_tips"
  | "items_sale"
  | "looking_for_roomie"
  | "events"
  | "bills_advice";

export type ReactionType =
  | "like"
  | "love"
  | "care"
  | "haha"
  | "wow"
  | "sad"
  | "angry";

export interface ReactionConfig {
  type: ReactionType;
  label: string;
  emoji: string;
  color: string;
  iconName?: string;
}

export const FB_REACTIONS: ReactionConfig[] = [
  {
    type: "like",
    label: "Like",
    emoji: "👍",
    color: "#2563EB",
    iconName: "thumbs-up",
  },
  {
    type: "love",
    label: "Love",
    emoji: "❤️",
    color: "#EF4444",
    iconName: "heart",
  },
  { type: "care", label: "Care", emoji: "🥰", color: "#F59E0B" },
  { type: "haha", label: "Haha", emoji: "😆", color: "#F59E0B" },
  { type: "wow", label: "Wow", emoji: "😮", color: "#F59E0B" },
  { type: "sad", label: "Sad", emoji: "😢", color: "#3B82F6" },
  { type: "angry", label: "Angry", emoji: "😡", color: "#EA580C" },
];

export const FB_6_REACTIONS: ReactionConfig[] = [
  {
    type: "like",
    label: "Like",
    emoji: "👍",
    color: "#2563EB",
    iconName: "thumbs-up",
  },
  {
    type: "love",
    label: "Love",
    emoji: "❤️",
    color: "#EF4444",
    iconName: "heart",
  },
  { type: "haha", label: "Haha", emoji: "😆", color: "#F59E0B" },
  { type: "wow", label: "Wow", emoji: "😮", color: "#F59E0B" },
  { type: "sad", label: "Sad", emoji: "😢", color: "#3B82F6" },
  { type: "angry", label: "Angry", emoji: "😡", color: "#EA580C" },
];

export interface CommunityPost {
  id: string;
  authorId: string;
  authorName: string;
  authorEmail?: string;
  authorAvatar?: string;
  authorRole?: string;
  authorHouseholdName?: string;
  content: string;
  images: string[];
  category:
    | "general"
    | "roommate_tips"
    | "items_sale"
    | "looking_for_roomie"
    | "events"
    | "bills_advice";
  likes: string[];
  reactions?: Record<string, ReactionType>;
  commentsCount: number;
  sharesCount: number;
  createdAt: string;
  updatedAt?: string;
}

export interface CommunityComment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  likes: string[];
  createdAt: string;
}

export interface CommunityFriendship {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  senderEmail?: string;
  receiverId: string;
  receiverName: string;
  receiverAvatar?: string;
  receiverEmail?: string;
  status: "pending" | "accepted" | "declined";
  createdAt: string;
  updatedAt: string;
}

export interface CommunityMember {
  uid: string;
  name: string;
  email?: string;
  avatar?: string;
  role?: string;
  householdName?: string;
  friendshipStatus: "none" | "pending_sent" | "pending_received" | "friends";
  friendshipId?: string;
}

export interface StoryViewerInfo {
  uid: string;
  name: string;
  avatar?: string;
  email?: string;
  viewedAt: string;
}

export interface CommunityStory {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  authorEmail?: string;
  mediaUrl: string;
  caption?: string;
  backgroundColor?: string;
  createdAt: string;
  expiresAt?: string;
  updatedAt?: string;
  isArchived?: boolean;
  views?: string[];
  viewerDetails?: StoryViewerInfo[];
  likes?: string[];
}

/**
 * Check if a story is active (within 24 hours of creation and not archived).
 */
export function isStoryActive(story: CommunityStory): boolean {
  if (story.isArchived) return false;
  const createdMs = new Date(story.createdAt).getTime();
  if (isNaN(createdMs)) return true;
  const ageMs = Date.now() - createdMs;
  return ageMs < 24 * 60 * 60 * 1000;
}

/**
 * Calculate human-readable countdown remaining before a 24-hour story expires.
 */
export function calculateStoryTimeRemaining(story: CommunityStory): {
  isExpired: boolean;
  label: string;
  hoursLeft: number;
} {
  const createdMs = new Date(story.createdAt).getTime();
  if (isNaN(createdMs))
    return { isExpired: false, label: "24h left", hoursLeft: 24 };
  const expiryMs = createdMs + 24 * 60 * 60 * 1000;
  const remainingMs = expiryMs - Date.now();
  if (remainingMs <= 0 || story.isArchived) {
    return { isExpired: true, label: "Expired", hoursLeft: 0 };
  }
  const hours = Math.floor(remainingMs / (60 * 60 * 1000));
  const mins = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) {
    return { isExpired: false, label: `${hours}h left`, hoursLeft: hours };
  }
  return {
    isExpired: false,
    label: `${Math.max(1, mins)}m left`,
    hoursLeft: 0,
  };
}

export function formatAuthorDisplayName(name?: string, email?: string): string {
  const trimmed = (name || "").trim();
  if (
    trimmed &&
    trimmed.toLowerCase() !== "resident" &&
    trimmed.toLowerCase() !== "residents" &&
    trimmed.toLowerCase() !== "splitzy resident" &&
    trimmed.toLowerCase() !== "splitzer"
  ) {
    return trimmed;
  }
  if (email && email.includes("@")) {
    const handle = email.split("@")[0].replace(/[._-]/g, " ");
    return handle
      .split(" ")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }
  return "Splitzy Member";
}

export const CATEGORY_LABELS: Record<
  CommunityCategory,
  { label: string; icon: string; color: string }
> = {
  all: { label: "All Posts", icon: "globe", color: "#2563EB" },
  general: { label: "General Chat", icon: "message-circle", color: "#3B82F6" },
  roommate_tips: { label: "Roomie Life Hacks", icon: "zap", color: "#10B981" },
  items_sale: {
    label: "Market & Giveaways",
    icon: "shopping-bag",
    color: "#F59E0B",
  },
  looking_for_roomie: {
    label: "Find Roommates",
    icon: "user-plus",
    color: "#EC4899",
  },
  events: { label: "Events & Hangouts", icon: "calendar", color: "#8B5CF6" },
  bills_advice: {
    label: "Budget & Splitting",
    icon: "dollar-sign",
    color: "#14B8A6",
  },
};

export const DEFAULT_COMMUNITY_MEMBERS: Array<
  Omit<CommunityMember, "friendshipStatus" | "friendshipId"> & {
    bio?: string;
    coverImage?: string;
    location?: string;
    mutualFriendsCount?: number;
    joinedDate?: string;
  }
> = [];

class CommunityService {
  /**
   * Listen to real-time community posts from Firestore.
   */
  subscribePosts(callback: (posts: CommunityPost[]) => void): () => void {
    const postsRef = collection(db, "communityPosts");
    const q = query(postsRef, orderBy("createdAt", "desc"));

    return onSnapshot(
      q,
      (snapshot) => {
        const posts: CommunityPost[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const cleanAuthorName = formatAuthorDisplayName(
            data.authorName,
            data.authorEmail,
          );
          posts.push({
            id: docSnap.id,
            authorId: data.authorId || "",
            authorName: cleanAuthorName,
            authorEmail: data.authorEmail || "",
            authorAvatar: data.authorAvatar || "",
            authorRole: data.authorRole || "Member",
            authorHouseholdName: data.authorHouseholdName || "",
            content: data.content || "",
            images: Array.isArray(data.images) ? data.images : [],
            category: data.category || "general",
            likes: Array.isArray(data.likes) ? data.likes : [],
            reactions:
              data.reactions && typeof data.reactions === "object"
                ? data.reactions
                : {},
            commentsCount:
              typeof data.commentsCount === "number" ? data.commentsCount : 0,
            sharesCount:
              typeof data.sharesCount === "number" ? data.sharesCount : 0,
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt,
          });
        });
        callback(posts);
      },
      (error) => {
        console.warn("[CommunityService] subscribePosts error:", error);
        callback([]);
      },
    );
  }

  /**
   * Listen to real-time stories & reels from Firestore.
   */
  subscribeStories(callback: (stories: CommunityStory[]) => void): () => void {
    const storiesRef = collection(db, "communityStories");
    const q = query(storiesRef, orderBy("createdAt", "desc"), limit(60));

    return onSnapshot(
      q,
      (snapshot) => {
        const stories: CommunityStory[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          stories.push({
            id: docSnap.id,
            authorId: data.authorId || "",
            authorName: formatAuthorDisplayName(
              data.authorName,
              data.authorEmail,
            ),
            authorAvatar: data.authorAvatar || "",
            authorEmail: data.authorEmail || "",
            mediaUrl: data.mediaUrl || "",
            caption: data.caption || "",
            backgroundColor: data.backgroundColor || undefined,
            createdAt: data.createdAt || new Date().toISOString(),
            expiresAt: data.expiresAt || undefined,
            updatedAt: data.updatedAt || undefined,
            isArchived: data.isArchived === true,
            views: Array.isArray(data.views) ? data.views : [],
            viewerDetails: Array.isArray(data.viewerDetails)
              ? data.viewerDetails
              : [],
            likes: Array.isArray(data.likes) ? data.likes : [],
          });
        });
        callback(stories);
      },
      (error) => {
        console.warn("[CommunityService] subscribeStories error:", error);
        callback([]);
      },
    );
  }

  /**
   * Create a new community story with 24-hour expiration calculation.
   */
  async createStory(params: {
    mediaUrl: string;
    caption?: string;
    backgroundColor?: string;
    authorName?: string;
    authorEmail?: string;
    authorAvatar?: string;
  }): Promise<string> {
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) throw new Error("Must be logged in to create a story.");

    const storiesRef = collection(db, "communityStories");
    const newDocRef = doc(storiesRef);
    const now = new Date();
    const createdAt = now.toISOString();
    // Expiration timestamp is set strictly 24 hours after creation
    const expiresAt = new Date(
      now.getTime() + 24 * 60 * 60 * 1000,
    ).toISOString();

    const cleanAuthorName = formatAuthorDisplayName(
      params.authorName || auth.currentUser?.displayName || undefined,
      params.authorEmail || auth.currentUser?.email || undefined,
    );

    const initialViewer: StoryViewerInfo = {
      uid: currentUid,
      name: cleanAuthorName,
      avatar: params.authorAvatar || auth.currentUser?.photoURL || "",
      email: params.authorEmail || auth.currentUser?.email || "",
      viewedAt: createdAt,
    };

    const storyData: Record<string, any> = {
      id: newDocRef.id,
      authorId: currentUid,
      authorName: cleanAuthorName,
      authorEmail: params.authorEmail || auth.currentUser?.email || "",
      authorAvatar: params.authorAvatar || auth.currentUser?.photoURL || "",
      mediaUrl: params.mediaUrl,
      caption: params.caption || "",
      backgroundColor: params.backgroundColor || "#2563EB",
      createdAt,
      expiresAt,
      isArchived: false,
      views: [currentUid],
      viewerDetails: [initialViewer],
      likes: [],
    };

    await setDoc(newDocRef, storyData);
    return newDocRef.id;
  }

  /**
   * Record a member viewing a story.
   */
  async recordStoryView(
    storyId: string,
    viewer: {
      uid: string;
      name?: string;
      avatar?: string;
      email?: string;
    },
  ): Promise<void> {
    if (!viewer.uid || !storyId) return;

    try {
      const storyRef = doc(db, "communityStories", storyId);
      const snap = await getDoc(storyRef);
      if (!snap.exists()) return;

      const data = snap.data();
      const existingViews: string[] = Array.isArray(data.views)
        ? data.views
        : [];
      const existingDetails: StoryViewerInfo[] = Array.isArray(
        data.viewerDetails,
      )
        ? data.viewerDetails
        : [];

      const cleanViewerName = formatAuthorDisplayName(
        viewer.name,
        viewer.email,
      );
      const isAlreadyInViews = existingViews.includes(viewer.uid);
      const isAlreadyInDetails = existingDetails.some(
        (d) => d.uid === viewer.uid,
      );

      if (isAlreadyInViews && isAlreadyInDetails) {
        return; // Already recorded
      }

      const updatedViews = isAlreadyInViews
        ? existingViews
        : [...existingViews, viewer.uid];
      const newViewerEntry: StoryViewerInfo = {
        uid: viewer.uid,
        name: cleanViewerName,
        avatar: viewer.avatar || "",
        email: viewer.email || "",
        viewedAt: new Date().toISOString(),
      };

      const updatedDetails = isAlreadyInDetails
        ? existingDetails
        : [...existingDetails, newViewerEntry];

      await updateDoc(storyRef, {
        views: updatedViews,
        viewerDetails: updatedDetails,
      });
    } catch (err) {
      console.warn("[CommunityService] Failed to record story view:", err);
    }
  }

  /**
   * Update an existing story's caption and background styling (author only).
   */
  async updateStory(
    storyId: string,
    params: {
      caption?: string;
      backgroundColor?: string;
    },
  ): Promise<void> {
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) throw new Error("Must be logged in to update a story.");

    const storyRef = doc(db, "communityStories", storyId);
    const updatePayload: Record<string, any> = {
      updatedAt: new Date().toISOString(),
    };

    if (params.caption !== undefined) {
      updatePayload.caption = params.caption.trim();
    }
    if (params.backgroundColor !== undefined) {
      updatePayload.backgroundColor = params.backgroundColor;
    }

    await updateDoc(storyRef, updatePayload);
  }

  /**
   * Delete a story permanently from Firestore.
   */
  async deleteStory(storyId: string): Promise<void> {
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) throw new Error("Must be logged in to delete a story.");

    const storyRef = doc(db, "communityStories", storyId);
    await deleteDoc(storyRef);
  }

  /**
   * Manually archive a story so it hides from the public feed while remaining in archive.
   */
  async archiveStory(storyId: string): Promise<void> {
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) throw new Error("Must be logged in to archive a story.");

    const storyRef = doc(db, "communityStories", storyId);
    await updateDoc(storyRef, {
      isArchived: true,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Toggle like on a story.
   */
  async toggleLikeStory(
    storyId: string,
    currentLikes: string[],
  ): Promise<void> {
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) return;

    const storyRef = doc(db, "communityStories", storyId);
    const isLiked = currentLikes.includes(currentUid);
    const updated = isLiked
      ? currentLikes.filter((uid) => uid !== currentUid)
      : [...currentLikes, currentUid];

    await updateDoc(storyRef, { likes: updated });
  }

  /**
   * Create a new community post synced to Firestore.
   */
  async createPost(params: {
    content: string;
    category: CommunityPost["category"];
    images?: string[];
    authorName?: string;
    authorEmail?: string;
    authorAvatar?: string;
    authorRole?: string;
    authorHouseholdName?: string;
  }): Promise<string> {
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) {
      throw new Error("You must be logged in to post.");
    }

    const postsRef = collection(db, "communityPosts");
    const newDocRef = doc(postsRef);
    const now = new Date().toISOString();

    const cleanAuthorName = formatAuthorDisplayName(
      params.authorName || auth.currentUser?.displayName || undefined,
      params.authorEmail || auth.currentUser?.email || undefined,
    );

    const postData = {
      id: newDocRef.id,
      authorId: currentUid,
      authorName: cleanAuthorName,
      authorEmail: params.authorEmail || auth.currentUser?.email || "",
      authorAvatar: params.authorAvatar || auth.currentUser?.photoURL || "",
      authorRole: params.authorRole || "Member",
      authorHouseholdName: params.authorHouseholdName || "",
      content: params.content.trim(),
      images: params.images || [],
      category: params.category,
      likes: [],
      commentsCount: 0,
      sharesCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(newDocRef, postData);
    return newDocRef.id;
  }

  /**
   * Toggle like on a community post (defaults to standard like).
   */
  async toggleLikePost(
    postId: string,
    currentLikes: string[],
  ): Promise<boolean> {
    return this.reactToPost(postId, currentLikes, {}, "like");
  }

  /**
   * React to a community post with any of Facebook's reactions (Like, Love, Care, Haha, Wow, Sad, Angry).
   */
  async reactToPost(
    postId: string,
    currentLikes: string[],
    currentReactions: Record<string, ReactionType> = {},
    reaction: ReactionType = "like",
  ): Promise<boolean> {
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) throw new Error("Must be logged in to react.");

    const postRef = doc(db, "communityPosts", postId);
    const existingReaction = currentReactions[currentUid];
    const isAlreadyLiked = currentLikes.includes(currentUid);

    const updatedLikes = [...currentLikes];
    const updatedReactions = { ...currentReactions };

    if (isAlreadyLiked && existingReaction === reaction) {
      // User tapped the same reaction: remove/toggle off
      const idx = updatedLikes.indexOf(currentUid);
      if (idx > -1) updatedLikes.splice(idx, 1);
      delete updatedReactions[currentUid];
    } else {
      // User added or changed reaction
      if (!isAlreadyLiked) {
        updatedLikes.push(currentUid);
      }
      updatedReactions[currentUid] = reaction;
    }

    await updateDoc(postRef, {
      likes: updatedLikes,
      reactions: updatedReactions,
      updatedAt: new Date().toISOString(),
    });

    return updatedLikes.includes(currentUid);
  }

  /**
   * Delete a community post.
   */
  async deletePost(postId: string): Promise<void> {
    const postRef = doc(db, "communityPosts", postId);
    await deleteDoc(postRef);
  }

  /**
   * Listen to real-time comments on a specific post.
   */
  subscribeComments(
    postId: string,
    callback: (comments: CommunityComment[]) => void,
  ): () => void {
    const commentsRef = collection(db, "communityPosts", postId, "comments");
    const q = query(commentsRef, orderBy("createdAt", "asc"));

    return onSnapshot(
      q,
      (snapshot) => {
        const comments: CommunityComment[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          comments.push({
            id: docSnap.id,
            postId,
            authorId: data.authorId || "",
            authorName: data.authorName || "Splitzer",
            authorAvatar: data.authorAvatar || "",
            content: data.content || "",
            likes: Array.isArray(data.likes) ? data.likes : [],
            createdAt: data.createdAt || new Date().toISOString(),
          });
        });
        callback(comments);
      },
      (error) => {
        console.warn("[CommunityService] subscribeComments error:", error);
        callback([]);
      },
    );
  }

  /**
   * Add a comment to a community post.
   */
  async addComment(
    postId: string,
    content: string,
    authorName?: string,
    authorAvatar?: string,
  ): Promise<string> {
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) throw new Error("Must be logged in to comment.");

    const commentsRef = collection(db, "communityPosts", postId, "comments");
    const commentDocRef = doc(commentsRef);
    const now = new Date().toISOString();

    const commentData = {
      id: commentDocRef.id,
      postId,
      authorId: currentUid,
      authorName: authorName || auth.currentUser?.displayName || "Resident",
      authorAvatar: authorAvatar || auth.currentUser?.photoURL || "",
      content: content.trim(),
      likes: [],
      createdAt: now,
    };

    await setDoc(commentDocRef, commentData);

    // Update parent post comment count
    const postRef = doc(db, "communityPosts", postId);
    try {
      await updateDoc(postRef, {
        commentsCount: increment(1),
        updatedAt: now,
      });
    } catch (err) {
      console.warn(
        "[CommunityService] Failed to increment comments count:",
        err,
      );
    }

    return commentDocRef.id;
  }

  /**
   * Toggle like on a comment.
   */
  async toggleLikeComment(
    postId: string,
    commentId: string,
    currentLikes: string[],
  ): Promise<boolean> {
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) throw new Error("Must be logged in to like comment.");

    const commentRef = doc(db, "communityPosts", postId, "comments", commentId);
    const isLiked = currentLikes.includes(currentUid);
    const updatedLikes = isLiked
      ? currentLikes.filter((id) => id !== currentUid)
      : [...currentLikes, currentUid];

    await updateDoc(commentRef, {
      likes: updatedLikes,
    });

    return !isLiked;
  }

  /**
   * Delete a comment.
   */
  async deleteComment(postId: string, commentId: string): Promise<void> {
    const commentRef = doc(db, "communityPosts", postId, "comments", commentId);
    await deleteDoc(commentRef);

    const postRef = doc(db, "communityPosts", postId);
    try {
      await updateDoc(postRef, {
        commentsCount: increment(-1),
      });
    } catch {
      // ignore
    }
  }

  /**
   * Listen to friendships involving the current user (sent or received).
   */
  subscribeFriendships(
    userId: string,
    callback: (friendships: CommunityFriendship[]) => void,
  ): () => void {
    if (!userId) {
      callback([]);
      return () => {};
    }

    const friendshipsRef = collection(db, "communityFriendships");

    // We listen to sent and received queries and merge
    const qSent = query(friendshipsRef, where("senderId", "==", userId));
    const qReceived = query(friendshipsRef, where("receiverId", "==", userId));

    let sentList: CommunityFriendship[] = [];
    let receivedList: CommunityFriendship[] = [];

    const notify = () => {
      const map = new Map<string, CommunityFriendship>();
      sentList.forEach((f) => map.set(f.id, f));
      receivedList.forEach((f) => map.set(f.id, f));
      callback(Array.from(map.values()));
    };

    const unsubSent = onSnapshot(
      qSent,
      (snapshot) => {
        sentList = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<CommunityFriendship, "id">),
        }));
        notify();
      },
      (err) => console.warn("[CommunityService] unsubSent error:", err),
    );

    const unsubReceived = onSnapshot(
      qReceived,
      (snapshot) => {
        receivedList = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<CommunityFriendship, "id">),
        }));
        notify();
      },
      (err) => console.warn("[CommunityService] unsubReceived error:", err),
    );

    return () => {
      unsubSent();
      unsubReceived();
    };
  }

  /**
   * Send a friend request to another Splitzy user.
   */
  async sendFriendRequest(
    receiver: { uid: string; name: string; avatar?: string; email?: string },
    sender: { name: string; avatar?: string; email?: string },
  ): Promise<string> {
    const currentUid = auth.currentUser?.uid;
    if (!currentUid)
      throw new Error("Must be logged in to send friend request.");
    if (currentUid === receiver.uid)
      throw new Error("Cannot add yourself as a friend.");

    const friendshipRef = doc(collection(db, "communityFriendships"));
    const now = new Date().toISOString();

    const friendshipData: CommunityFriendship = {
      id: friendshipRef.id,
      senderId: currentUid,
      senderName: sender.name || auth.currentUser?.displayName || "Resident",
      senderAvatar: sender.avatar || auth.currentUser?.photoURL || "",
      senderEmail: sender.email || auth.currentUser?.email || "",
      receiverId: receiver.uid,
      receiverName: receiver.name || "Splitzer",
      receiverAvatar: receiver.avatar || "",
      receiverEmail: receiver.email || "",
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(friendshipRef, friendshipData);
    return friendshipRef.id;
  }

  /**
   * Accept friend request.
   */
  async acceptFriendRequest(friendshipId: string): Promise<void> {
    const ref = doc(db, "communityFriendships", friendshipId);
    await updateDoc(ref, {
      status: "accepted",
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Decline or cancel friend request.
   */
  async declineOrCancelFriendRequest(friendshipId: string): Promise<void> {
    const ref = doc(db, "communityFriendships", friendshipId);
    await deleteDoc(ref);
  }

  /**
   * Listen to real-time posts authored by a specific user.
   */
  subscribeUserPosts(
    authorId: string,
    callback: (posts: CommunityPost[]) => void,
  ): () => void {
    if (!authorId) {
      callback([]);
      return () => {};
    }

    const postsRef = collection(db, "communityPosts");
    const q = query(postsRef, orderBy("createdAt", "desc"), limit(100));

    return onSnapshot(
      q,
      (snapshot) => {
        const posts: CommunityPost[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.authorId === authorId) {
            const cleanAuthorName = formatAuthorDisplayName(
              data.authorName,
              data.authorEmail,
            );
            posts.push({
              id: docSnap.id,
              authorId: data.authorId || "",
              authorName: cleanAuthorName,
              authorEmail: data.authorEmail || "",
              authorAvatar: data.authorAvatar || "",
              authorRole: data.authorRole || "Member",
              authorHouseholdName: data.authorHouseholdName || "",
              content: data.content || "",
              images: Array.isArray(data.images) ? data.images : [],
              category: data.category || "general",
              likes: Array.isArray(data.likes) ? data.likes : [],
              reactions:
                data.reactions && typeof data.reactions === "object"
                  ? data.reactions
                  : {},
              commentsCount:
                typeof data.commentsCount === "number" ? data.commentsCount : 0,
              sharesCount:
                typeof data.sharesCount === "number" ? data.sharesCount : 0,
              createdAt: data.createdAt || new Date().toISOString(),
              updatedAt: data.updatedAt,
            });
          }
        });
        callback(posts);
      },
      (error) => {
        console.warn("[CommunityService] subscribeUserPosts error:", error);
        callback([]);
      },
    );
  }

  /**
   * Listen to real-time accepted friends for a specific user from Firestore.
   */
  subscribeUserAcceptedFriends(
    userId: string,
    callback: (friends: CommunityMember[]) => void,
  ): () => void {
    if (!userId) {
      callback([]);
      return () => {};
    }

    const friendshipsRef = collection(db, "communityFriendships");
    const qSent = query(
      friendshipsRef,
      where("senderId", "==", userId),
      where("status", "==", "accepted"),
    );
    const qReceived = query(
      friendshipsRef,
      where("receiverId", "==", userId),
      where("status", "==", "accepted"),
    );

    let sentFriends: CommunityMember[] = [];
    let receivedFriends: CommunityMember[] = [];

    const notify = () => {
      const mergedMap = new Map<string, CommunityMember>();
      for (const f of [...sentFriends, ...receivedFriends]) {
        mergedMap.set(f.uid, f);
      }
      callback(Array.from(mergedMap.values()));
    };

    const unsubSent = onSnapshot(
      qSent,
      (snapshot) => {
        sentFriends = snapshot.docs.map((docSnap) => {
          const d = docSnap.data() as CommunityFriendship;
          return {
            uid: d.receiverId,
            name: d.receiverName || "Splitzer",
            avatar: d.receiverAvatar || "",
            email: d.receiverEmail || "",
            friendshipStatus: "friends",
            friendshipId: docSnap.id,
          };
        });
        notify();
      },
      (err) => console.warn("[CommunityService] unsubSentFriends error:", err),
    );

    const unsubReceived = onSnapshot(
      qReceived,
      (snapshot) => {
        receivedFriends = snapshot.docs.map((docSnap) => {
          const d = docSnap.data() as CommunityFriendship;
          return {
            uid: d.senderId,
            name: d.senderName || "Resident",
            avatar: d.senderAvatar || "",
            email: d.senderEmail || "",
            friendshipStatus: "friends",
            friendshipId: docSnap.id,
          };
        });
        notify();
      },
      (err) =>
        console.warn("[CommunityService] unsubReceivedFriends error:", err),
    );

    return () => {
      unsubSent();
      unsubReceived();
    };
  }

  /**
   * Discover and search users across the app from Firestore.
   * Only returns real registered users from Firestore without mock data.
   */
  async discoverMembers(
    currentUserId: string,
    friendships: CommunityFriendship[],
    searchQuery?: string,
  ): Promise<CommunityMember[]> {
    try {
      const usersRef = collection(db, "users");
      const snap = await getDocs(query(usersRef, limit(100)));
      const members: CommunityMember[] = [];

      const queryLower = (searchQuery || "").trim().toLowerCase();

      snap.forEach((docSnap) => {
        const uid = docSnap.id;
        if (uid === currentUserId) return; // skip self

        const data = docSnap.data();
        const name =
          data.displayName || data.name || data.fullName || "Splitzy Resident";
        const email = data.email || "";

        if (
          queryLower &&
          !name.toLowerCase().includes(queryLower) &&
          !email.toLowerCase().includes(queryLower)
        ) {
          return;
        }

        // Determine relationship
        let friendshipStatus: CommunityMember["friendshipStatus"] = "none";
        let friendshipId: string | undefined = undefined;

        const rel = friendships.find(
          (f) =>
            (f.senderId === currentUserId && f.receiverId === uid) ||
            (f.receiverId === currentUserId && f.senderId === uid),
        );

        if (rel) {
          friendshipId = rel.id;
          if (rel.status === "accepted") {
            friendshipStatus = "friends";
          } else if (rel.status === "pending") {
            friendshipStatus =
              rel.senderId === currentUserId
                ? "pending_sent"
                : "pending_received";
          }
        }

        members.push({
          uid,
          name,
          email,
          avatar: data.profilePicture || data.photoURL || "",
          role: data.role || "Member",
          householdName: data.householdName || "",
          friendshipStatus,
          friendshipId,
        });
      });

      return members;
    } catch (err) {
      console.warn("[CommunityService] discoverMembers error:", err);
      return [];
    }
  }

  /**
   * Query registered users from Firestore for suggestions.
   */
  async getRegisteredUsersForSuggestions(
    currentUserId: string,
    excludeUserIds: string[] = [],
  ): Promise<CommunityMember[]> {
    try {
      const usersRef = collection(db, "users");
      const snap = await getDocs(query(usersRef, limit(60)));
      const members: CommunityMember[] = [];
      const excludeSet = new Set([currentUserId, ...excludeUserIds]);

      snap.forEach((docSnap) => {
        const uid = docSnap.id;
        if (excludeSet.has(uid)) return;

        const data = docSnap.data();
        const name =
          data.displayName || data.name || data.fullName || "Splitzy Resident";
        const email = data.email || "";

        members.push({
          uid,
          name,
          email,
          avatar: data.profilePicture || data.photoURL || "",
          role: data.role || "Member",
          householdName: data.householdName || "",
          friendshipStatus: "none",
        });
      });

      return members;
    } catch (err) {
      console.warn(
        "[CommunityService] getRegisteredUsersForSuggestions error:",
        err,
      );
      return [];
    }
  }
}

export const communityService = new CommunityService();
