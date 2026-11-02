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
  arrayUnion,
  limit,
} from "firebase/firestore";
import { db, auth } from "../firebase/config";
import type { User } from "firebase/auth";
import {
  pushDispatchService,
  PushDispatchService,
} from "./pushDispatchService";
import {
  isQuotaExceededError,
  notifyQuotaExceeded,
} from "./firebaseDataService";

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

export type ReelCategory =
  | "all"
  | "youtube_shorts"
  | "facebook_reels"
  | "lifestyle"
  | "roommate_tips"
  | "cooking"
  | "budgeting"
  | "fun";

export interface CommunityReel {
  id: string;
  authorId: string;
  authorName: string;
  authorEmail?: string;
  authorAvatar?: string;
  authorRole?: string;
  videoUrl: string;
  thumbnailUrl?: string;
  caption: string;
  category: ReelCategory;
  soundTitle?: string;
  likes: string[];
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  createdAt: string;
  duration?: number;
  isCurated?: boolean;
  viewsCount?: number;
  viewers?: string[];
  pinned?: boolean;
}

/**
 * Format view count for reel cards and galleries (e.g., 1.1M, 25.4K, 475)
 */
export function formatViewCount(views?: number): string {
  if (!views || views <= 0) return "0";
  if (views >= 1_000_000) {
    const formatted = (views / 1_000_000).toFixed(1).replace(/\.0$/, "");
    return `${formatted}M`;
  }
  if (views >= 1_000) {
    const formatted = (views / 1_000).toFixed(1).replace(/\.0$/, "");
    return `${formatted}K`;
  }
  return String(views);
}

/**
 * Deterministically shuffles reels based on the calendar day (YYYY-MM-DD).
 * Ensures a fresh, randomized feed every day without jittering within the same day.
 */
export function getDailyShuffledReels(reels: CommunityReel[]): CommunityReel[] {
  if (!reels || reels.length <= 1) return reels;

  // Create deterministic seed from today's date string
  const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  let seed = 0;
  for (let i = 0; i < todayStr.length; i++) {
    seed = (seed << 5) - seed + todayStr.charCodeAt(i);
    seed |= 0;
  }

  // Seeded pseudo-random generator (LCG)
  const lcg = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return (seed >>> 0) / 4294967296;
  };

  const copy = [...reels];
  // Fisher-Yates shuffle with seeded PRNG
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(lcg() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

export interface CommunityReelComment {
  id: string;
  reelId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  createdAt: string;
}

export function normalizeFacebookUrl(url: string): string {
  if (!url) return "";
  let clean = url.trim().replace(/^["']|["']$/g, "");
  if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
    clean = "https://" + clean;
  }

  // 1. If it has a pure numeric video/reel ID:
  // e.g. /reel/1041123456789012, /videos/1041123456789012, ?v=1041123456789012
  const numericMatch =
    clean.match(/\/(?:reel|reels)\/(\d+)/i) ||
    clean.match(/\/share\/[rv]\/(\d+)/i) ||
    clean.match(/[?&]v=(\d+)/i) ||
    clean.match(/\/videos\/(\d+)/i);

  if (numericMatch && numericMatch[1]) {
    return `https://www.facebook.com/reel/${numericMatch[1]}/`;
  }

  // 2. If it's a mobile share redirect link (/share/r/abc123) or fb.watch/abc:
  // Strip tracking parameters but preserve the original path so Facebook app can resolve it
  try {
    const parsed = new URL(clean);
    parsed.searchParams.delete("mibextid");
    parsed.searchParams.delete("s");
    parsed.searchParams.delete("fs");
    parsed.searchParams.delete("fbclid");
    parsed.searchParams.delete("ref");
    return parsed.toString();
  } catch {
    return clean.split("?")[0];
  }
}

export function getReelVideoType(url: string): "youtube" | "facebook" | "mp4" {
  if (!url) return "mp4";
  const clean = url.toLowerCase().trim();
  if (
    clean.includes("youtube.com") ||
    clean.includes("youtu.be") ||
    extractYouTubeId(url) !== null
  ) {
    return "youtube";
  }
  if (
    clean.includes("facebook.com") ||
    clean.includes("fb.watch") ||
    clean.includes("fb.me") ||
    clean.includes("/share/r/")
  ) {
    return "facebook";
  }
  return "mp4";
}

export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  let clean = url.trim();
  clean = clean.replace(/^["']|["']$/g, "");
  // Direct 11-character video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) {
    return clean;
  }
  if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
    clean = "https://" + clean;
  }
  // Standard YouTube Shorts / Watch / Share URL variations (handles query params, handles, channels)
  const match =
    clean.match(/shorts\/([a-zA-Z0-9_-]{11})/i) ||
    clean.match(/[?&]v=([a-zA-Z0-9_-]{11})/i) ||
    clean.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/i) ||
    clean.match(/embed\/([a-zA-Z0-9_-]{11})/i) ||
    clean.match(/live\/([a-zA-Z0-9_-]{11})/i) ||
    clean.match(/shorts\/([a-zA-Z0-9_-]+)/i) ||
    clean.match(/[?&]v=([a-zA-Z0-9_-]+)/i) ||
    clean.match(/youtu\.be\/([a-zA-Z0-9_-]+)/i) ||
    clean.match(/embed\/([a-zA-Z0-9_-]+)/i);
  return match ? match[1] : null;
}

export const CURATED_REELS: CommunityReel[] = [
  {
    id: "curated_reel_1",
    authorId: "splitzy_curator_1",
    authorName: "Maya & Jordan",
    authorAvatar:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
    authorRole: "Studio Resident",
    videoUrl:
      "https://res.cloudinary.com/demo/video/upload/c_fill,ar_9:16,w_720/sea_turtle.mp4",
    thumbnailUrl:
      "https://res.cloudinary.com/demo/video/upload/c_fill,ar_9:16,w_720/sea_turtle.jpg",
    caption:
      "Tour of our peaceful city co-living space! 🌿 Designated zones and green corners keep roommates zen. #RoommateLife #StudioLiving #InAppReels",
    category: "lifestyle",
    soundTitle: "Peaceful Waves & Loft Vibes • Original",
    likes: ["user_1", "user_2", "user_3", "user_4", "user_5"],
    likesCount: 384,
    commentsCount: 42,
    sharesCount: 68,
    createdAt: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
    isCurated: true,
    viewsCount: 1140000, // 1.1M views
    pinned: true,
  },
  {
    id: "curated_reel_2",
    authorId: "splitzy_curator_2",
    authorName: "Camille Gomez",
    authorAvatar:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80",
    authorRole: "Roommate Captain",
    videoUrl:
      "https://res.cloudinary.com/demo/video/upload/c_fill,ar_9:16,w_720/dog.mp4",
    thumbnailUrl:
      "https://res.cloudinary.com/demo/video/upload/c_fill,ar_9:16,w_720/dog.jpg",
    caption:
      "When the apartment puppy greets all 4 flatmates after a long workday 🐶❤️ Roomie therapy at its best! #ApartmentPets #SplitzyVibes #CoLiving",
    category: "fun",
    soundTitle: "Puppy Joy Beats • Splitzy Original",
    likes: ["user_1", "user_3", "user_8", "user_9"],
    likesCount: 412,
    commentsCount: 56,
    sharesCount: 89,
    createdAt: new Date(Date.now() - 3600 * 1000 * 5).toISOString(),
    isCurated: true,
    viewsCount: 475,
  },
  {
    id: "curated_reel_3",
    authorId: "splitzy_curator_3",
    authorName: "Sarah Lin",
    authorAvatar:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=200&q=80",
    authorRole: "Kitchen Lead",
    videoUrl:
      "https://res.cloudinary.com/demo/video/upload/c_fill,ar_9:16,w_720/dog2.mp4",
    thumbnailUrl:
      "https://res.cloudinary.com/demo/video/upload/c_fill,ar_9:16,w_720/dog2.jpg",
    caption:
      "Kitchen patrol dog waiting patiently while the house pasta bakes! 🍝🐕 Shared meals are 10x better with furry sous-chefs. #RoommateCooking #PetFriendly",
    category: "cooking",
    soundTitle: "Chill Kitchen Lo-Fi • Acoustic",
    likes: ["user_2", "user_4", "user_6"],
    likesCount: 295,
    commentsCount: 33,
    sharesCount: 47,
    createdAt: new Date(Date.now() - 3600 * 1000 * 10).toISOString(),
    isCurated: true,
    viewsCount: 82500, // 82.5K views
  },
  {
    id: "curated_reel_4",
    authorId: "splitzy_curator_4",
    authorName: "The BGC Loft Crew",
    authorAvatar:
      "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=200&q=80",
    authorRole: "Co-Living Host",
    videoUrl:
      "https://res.cloudinary.com/demo/video/upload/c_fill,ar_9:16,w_720/rafting.mp4",
    thumbnailUrl:
      "https://res.cloudinary.com/demo/video/upload/c_fill,ar_9:16,w_720/rafting.jpg",
    caption:
      "Weekend adventure with the apartment gang! Roommates that paddle together stay together. 🚣‍♂️💦 #RoommateBonding #WeekendVibes #Splitzy",
    category: "roommate_tips",
    soundTitle: "River Rush Upbeat • Travel Mix",
    likes: ["user_1", "user_2", "user_5", "user_7"],
    likesCount: 236,
    commentsCount: 27,
    sharesCount: 39,
    createdAt: new Date(Date.now() - 3600 * 1000 * 18).toISOString(),
    isCurated: true,
    viewsCount: 19200, // 19.2K views
  },
  {
    id: "curated_reel_5",
    authorId: "splitzy_curator_5",
    authorName: "Apartment Life PH",
    authorAvatar:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
    authorRole: "Cozy Space Designer",
    videoUrl:
      "https://res.cloudinary.com/demo/video/upload/c_fill,ar_9:16,w_720/walking.mp4",
    thumbnailUrl:
      "https://res.cloudinary.com/demo/video/upload/c_fill,ar_9:16,w_720/walking.jpg",
    caption:
      "Evening stroll around our neighborhood with the roommates. Great coffee spots just 2 minutes away! 🌆👟 #ApartmentVlog #CityLiving",
    category: "lifestyle",
    soundTitle: "Golden Hour Glow • Acoustic Ambient",
    likes: ["user_3", "user_5", "user_8"],
    likesCount: 351,
    commentsCount: 39,
    sharesCount: 62,
    createdAt: new Date(Date.now() - 3600 * 1000 * 26).toISOString(),
    isCurated: true,
    viewsCount: 2400, // 2.4K views
  },
  {
    id: "curated_reel_6",
    authorId: "splitzy_curator_6",
    authorName: "Metro Roommates PH",
    authorAvatar:
      "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&q=80",
    authorRole: "Finance & Splitting",
    videoUrl:
      "https://res.cloudinary.com/demo/video/upload/c_fill,ar_9:16,w_720/finish_line.mp4",
    thumbnailUrl:
      "https://res.cloudinary.com/demo/video/upload/c_fill,ar_9:16,w_720/finish_line.jpg",
    caption:
      "Crossing the finish line: all 5 utility bills settled in 30 seconds using Splitzy! Rent, water, WiFi, electricity done. 🏁💸 #FairShare #BudgetHacks",
    category: "budgeting",
    soundTitle: "Victory Lap House • Upbeat",
    likes: ["user_2", "user_4", "user_7", "user_9"],
    likesCount: 318,
    commentsCount: 31,
    sharesCount: 54,
    createdAt: new Date(Date.now() - 3600 * 1000 * 36).toISOString(),
    isCurated: true,
    viewsCount: 15300,
  },
  {
    id: "curated_reel_7",
    authorId: "splitzy_curator_7",
    authorName: "Chef Mark & Flatmates",
    authorAvatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
    authorRole: "Meal Prep Specialist",
    videoUrl:
      "https://res.cloudinary.com/demo/video/upload/c_fill,ar_9:16,w_720/elephants.mp4",
    thumbnailUrl:
      "https://res.cloudinary.com/demo/video/upload/c_fill,ar_9:16,w_720/elephants.jpg",
    caption:
      "Nature documentary Sunday with the roommates on the living room screen! 🐘📺 Nothing beats relaxing together. #ApartmentSunday #ChillVibes",
    category: "cooking",
    soundTitle: "Wild & Free • Gentle Cinematic",
    likes: ["user_1", "user_3", "user_6"],
    likesCount: 278,
    commentsCount: 24,
    sharesCount: 46,
    createdAt: new Date(Date.now() - 3600 * 1000 * 48).toISOString(),
    isCurated: true,
    viewsCount: 3120,
  },
  {
    id: "curated_reel_8",
    authorId: "splitzy_curator_8",
    authorName: "Alyssa Diaz",
    authorAvatar:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=200&q=80",
    authorRole: "Plant & Pet Parent",
    videoUrl:
      "https://res.cloudinary.com/demo/video/upload/c_fill,ar_9:16,w_720/kitten_fighting.mp4",
    thumbnailUrl:
      "https://res.cloudinary.com/demo/video/upload/c_fill,ar_9:16,w_720/kitten_fighting.jpg",
    caption:
      "Playful roommate pets taking over the living room carpet! Never a dull moment in this apartment 🐱🐾 #Flatmates #FunnyMoments",
    category: "fun",
    soundTitle: "Playful Paws • Happy Acoustic",
    likes: ["user_2", "user_5", "user_7"],
    likesCount: 420,
    commentsCount: 48,
    sharesCount: 73,
    createdAt: new Date(Date.now() - 3600 * 1000 * 60).toISOString(),
    isCurated: true,
    viewsCount: 9400,
  },
  {
    id: "curated_reel_yt_1",
    authorId: "splitzy_curator_yt1",
    authorName: "Studio Living PH",
    authorAvatar:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
    authorRole: "Interior Creator • Shorts",
    videoUrl: "https://www.youtube.com/shorts/1e9F3Zf6T6E",
    thumbnailUrl: "https://img.youtube.com/vi/1e9F3Zf6T6E/hqdefault.jpg",
    caption:
      "Smart layout ideas for shared apartments! How to maximize small spaces with roommates 📐🏙️ #YouTubeShorts #ApartmentDesign",
    category: "roommate_tips",
    soundTitle: "Acoustic Loft Mix • Shorts Audio",
    likes: ["user_1", "user_4", "user_6"],
    likesCount: 512,
    commentsCount: 63,
    sharesCount: 92,
    createdAt: new Date(Date.now() - 3600 * 1000 * 70).toISOString(),
    isCurated: true,
    viewsCount: 43200,
  },
  {
    id: "curated_reel_yt_2",
    authorId: "splitzy_curator_yt2",
    authorName: "Quick Meal Flatmates",
    authorAvatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
    authorRole: "Budget Cook • Shorts",
    videoUrl: "https://www.youtube.com/shorts/tA9B_Fq-f20",
    thumbnailUrl: "https://img.youtube.com/vi/tA9B_Fq-f20/hqdefault.jpg",
    caption:
      "15-minute shared dinner hack that costs less than ₱100 each! 🍳🥘 Tag your roomies! #YouTubeShorts #MealPrep",
    category: "cooking",
    soundTitle: "Upbeat Kitchen Chill • Shorts Audio",
    likes: ["user_2", "user_3", "user_8"],
    likesCount: 389,
    commentsCount: 45,
    sharesCount: 77,
    createdAt: new Date(Date.now() - 3600 * 1000 * 80).toISOString(),
    isCurated: true,
    viewsCount: 26800,
  },
];

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

    // Asynchronously dispatch high-priority push notification to friends & roommates
    try {
      pushDispatchService
        .sendCommunityStoryPush({
          storyId: newDocRef.id,
          authorId: currentUid,
          authorName: cleanAuthorName,
          caption: params.caption,
        })
        .catch((e: unknown) =>
          console.warn("[CommunityService] push error on story:", e),
        );
    } catch (e: unknown) {
      console.warn("[CommunityService] push dispatch exception on story:", e);
    }

    return newDocRef.id;
  }

  private sessionViewedStories = new Set<string>();

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

    // In-memory session deduplication to eliminate repeated reads and writes
    const sessionKey = `${storyId}_${viewer.uid}`;
    if (this.sessionViewedStories.has(sessionKey)) {
      return;
    }
    this.sessionViewedStories.add(sessionKey);

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

      let cleanViewerName = formatAuthorDisplayName(viewer.name, viewer.email);
      let viewerAvatar = viewer.avatar || "";
      let viewerEmail = viewer.email || "";

      // If viewer name is empty, generic, or avatar is missing, look up real profile in Firestore users collection
      if (
        !viewer.name ||
        cleanViewerName === "Splitzy Member" ||
        cleanViewerName === "Community Member" ||
        !viewerAvatar
      ) {
        try {
          const rawUid = viewer.uid.replace(/^mem_/, "").trim();
          const userSnap = await getDoc(doc(db, "users", rawUid));
          if (userSnap.exists()) {
            const userData = userSnap.data();
            const realName =
              userData.displayName ||
              userData.fullName ||
              userData.name ||
              (userData.email ? userData.email.split("@")[0] : "");
            if (realName && realName.trim()) {
              cleanViewerName = realName.trim();
            }
            if (
              !viewerAvatar &&
              (userData.photoURL || userData.profilePicture || userData.avatar)
            ) {
              viewerAvatar =
                userData.photoURL || userData.profilePicture || userData.avatar;
            }
            if (!viewerEmail && userData.email) {
              viewerEmail = userData.email;
            }
          }
        } catch (fetchErr) {
          console.log("Viewer profile lookup notice:", fetchErr);
        }
      }

      const existingEntryIndex = existingDetails.findIndex(
        (d) => d.uid === viewer.uid,
      );
      const isAlreadyInViews = existingViews.includes(viewer.uid);

      // If already recorded with rich profile, skip
      if (
        isAlreadyInViews &&
        existingEntryIndex !== -1 &&
        existingDetails[existingEntryIndex].name !== "Splitzy Member" &&
        existingDetails[existingEntryIndex].name !== "Community Member" &&
        existingDetails[existingEntryIndex].avatar
      ) {
        return; // Already recorded with full identity
      }

      const updatedViews = isAlreadyInViews
        ? existingViews
        : [...existingViews, viewer.uid];

      const newViewerEntry: StoryViewerInfo = {
        uid: viewer.uid,
        name: cleanViewerName,
        avatar: viewerAvatar,
        email: viewerEmail,
        viewedAt: new Date().toISOString(),
      };

      let updatedDetails: StoryViewerInfo[];
      if (existingEntryIndex !== -1) {
        // Upgrade previously stored generic viewer entry with real identity
        updatedDetails = [...existingDetails];
        updatedDetails[existingEntryIndex] = {
          ...existingDetails[existingEntryIndex],
          name:
            cleanViewerName !== "Splitzy Member"
              ? cleanViewerName
              : existingDetails[existingEntryIndex].name,
          avatar:
            viewerAvatar || existingDetails[existingEntryIndex].avatar || "",
          email: viewerEmail || existingDetails[existingEntryIndex].email || "",
        };
      } else {
        updatedDetails = [...existingDetails, newViewerEntry];
      }

      await updateDoc(storyRef, {
        views: updatedViews,
        viewerDetails: updatedDetails,
      });
    } catch (err) {
      if (isQuotaExceededError(err)) {
        notifyQuotaExceeded();
      } else {
        console.warn("[CommunityService] Failed to record story view:", err);
      }
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

    // Asynchronously dispatch high-priority push notification to friends & roommates
    try {
      pushDispatchService
        .sendCommunityPostPush({
          postId: newDocRef.id,
          authorId: currentUid,
          authorName: cleanAuthorName,
          content: params.content.trim(),
          category: params.category,
        })
        .catch((e: unknown) =>
          console.warn("[CommunityService] push error on post:", e),
        );
    } catch (e: unknown) {
      console.warn("[CommunityService] push dispatch exception on post:", e);
    }

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

    // Asynchronously notify post author if this was an added/updated reaction
    if (!isAlreadyLiked || existingReaction !== reaction) {
      getDoc(postRef)
        .then((snap) => {
          if (snap.exists()) {
            const postData = snap.data();
            const authorId = postData?.authorId;
            if (authorId && authorId !== currentUid) {
              const reactorName = formatAuthorDisplayName(
                auth.currentUser?.displayName || undefined,
                auth.currentUser?.email || undefined,
              );
              pushDispatchService
                .sendCommunityReactionPush({
                  postId,
                  postAuthorId: authorId,
                  reactorId: currentUid,
                  reactorName,
                  reactionType: reaction,
                  postSnippet: postData?.content,
                })
                .catch((e: unknown) =>
                  console.warn("[CommunityService] push error on reaction:", e),
                );
            }
          }
        })
        .catch(() => {});
    }

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

    // Asynchronously notify post author
    getDoc(postRef)
      .then((snap) => {
        if (snap.exists()) {
          const postData = snap.data();
          const authorId = postData?.authorId;
          if (authorId && authorId !== currentUid) {
            pushDispatchService
              .sendCommunityCommentPush({
                postId,
                postAuthorId: authorId,
                commentId: commentDocRef.id,
                commenterId: currentUid,
                commenterName: commentData.authorName,
                commentText: commentData.content,
                postSnippet: postData?.content,
              })
              .catch((e: unknown) =>
                console.warn("[CommunityService] push error on comment:", e),
              );
          }
        }
      })
      .catch(() => {});

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
      // Deduplicate by normalized pairKey: [sender, receiver].sort().join("_")
      const pairMap = new Map<string, CommunityFriendship>();
      // Order descending by updatedAt/createdAt so latest state takes precedence
      const all = [...sentList, ...receivedList].sort((a, b) =>
        (b.updatedAt || b.createdAt || "").localeCompare(
          a.updatedAt || a.createdAt || "",
        ),
      );
      for (const f of all) {
        const cleanSender = String(f.senderId || "")
          .replace(/^mem_/, "")
          .trim();
        const cleanReceiver = String(f.receiverId || "")
          .replace(/^mem_/, "")
          .trim();
        const pairKey = [cleanSender, cleanReceiver].sort().join("_");
        if (pairKey && !pairMap.has(pairKey)) {
          pairMap.set(pairKey, {
            ...f,
            senderId: cleanSender,
            receiverId: cleanReceiver,
          });
        }
      }
      callback(Array.from(pairMap.values()));
    };

    const cleanUserId = String(userId || "")
      .replace(/^mem_/, "")
      .trim();

    const unsubSent = onSnapshot(
      query(friendshipsRef, where("senderId", "==", cleanUserId)),
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
      query(friendshipsRef, where("receiverId", "==", cleanUserId)),
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
   * Send a friend request to another Splitzy user with deterministic document ID and push dispatch.
   */
  async sendFriendRequest(
    receiver: { uid: string; name: string; avatar?: string; email?: string },
    sender: { name: string; avatar?: string; email?: string },
  ): Promise<string> {
    const rawSenderId = auth.currentUser?.uid;
    if (!rawSenderId)
      throw new Error("Must be logged in to send friend request.");
    const cleanSenderId = String(rawSenderId).replace(/^mem_/, "").trim();
    const cleanReceiverId = String(receiver.uid).replace(/^mem_/, "").trim();
    if (cleanSenderId === cleanReceiverId)
      throw new Error("Cannot add yourself as a friend.");

    const pairKey = [cleanSenderId, cleanReceiverId].sort().join("_");
    const friendshipDocId = `friendship_${pairKey}`;
    const friendshipRef = doc(db, "communityFriendships", friendshipDocId);
    const now = new Date().toISOString();

    const friendshipData: CommunityFriendship = {
      id: friendshipDocId,
      senderId: cleanSenderId,
      senderName: sender.name || auth.currentUser?.displayName || "Resident",
      senderAvatar: sender.avatar || auth.currentUser?.photoURL || "",
      senderEmail: sender.email || auth.currentUser?.email || "",
      receiverId: cleanReceiverId,
      receiverName: receiver.name || "Splitzer",
      receiverAvatar: receiver.avatar || "",
      receiverEmail: receiver.email || "",
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(friendshipRef, friendshipData, { merge: true });

    // Asynchronously dispatch friend request push notification and log to notifications collection
    try {
      pushDispatchService
        .sendFriendRequestPush({
          senderId: cleanSenderId,
          senderName: friendshipData.senderName,
          senderAvatar: friendshipData.senderAvatar,
          receiverId: cleanReceiverId,
        })
        .catch((e: unknown) =>
          console.warn("[CommunityService] push error on friend request:", e),
        );
    } catch (e: unknown) {
      console.warn("[CommunityService] push error on friend request:", e);
    }

    return friendshipDocId;
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

    const cleanUserId = String(userId).replace(/^mem_/, "").trim();
    const friendshipsRef = collection(db, "communityFriendships");
    const qSent = query(
      friendshipsRef,
      where("senderId", "==", cleanUserId),
      where("status", "==", "accepted"),
    );
    const qReceived = query(
      friendshipsRef,
      where("receiverId", "==", cleanUserId),
      where("status", "==", "accepted"),
    );

    let sentFriends: CommunityMember[] = [];
    let receivedFriends: CommunityMember[] = [];

    const notify = () => {
      const mergedMap = new Map<string, CommunityMember>();
      for (const f of [...sentFriends, ...receivedFriends]) {
        const cleanUid = String(f.uid || "")
          .replace(/^mem_/, "")
          .trim();
        if (cleanUid && cleanUid !== cleanUserId && !mergedMap.has(cleanUid)) {
          mergedMap.set(cleanUid, { ...f, uid: cleanUid });
        }
      }
      callback(Array.from(mergedMap.values()));
    };

    const unsubSent = onSnapshot(
      qSent,
      (snapshot) => {
        sentFriends = snapshot.docs.map((docSnap) => {
          const d = docSnap.data() as CommunityFriendship;
          const targetUid = String(d.receiverId || "")
            .replace(/^mem_/, "")
            .trim();
          return {
            uid: targetUid,
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
          const targetUid = String(d.senderId || "")
            .replace(/^mem_/, "")
            .trim();
          return {
            uid: targetUid,
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
   * Listen to all accepted friendships across the community to compute accurate real mutual friends.
   */
  subscribeAllAcceptedFriendships(
    callback: (friendships: CommunityFriendship[]) => void,
  ): () => void {
    const friendshipsRef = collection(db, "communityFriendships");
    const q = query(
      friendshipsRef,
      where("status", "==", "accepted"),
      limit(500),
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const pairMap = new Map<string, CommunityFriendship>();
        snapshot.docs.forEach((docSnap) => {
          const d = docSnap.data() as CommunityFriendship;
          const cleanSender = String(d.senderId || "")
            .replace(/^mem_/, "")
            .trim();
          const cleanReceiver = String(d.receiverId || "")
            .replace(/^mem_/, "")
            .trim();
          const pairKey = [cleanSender, cleanReceiver].sort().join("_");
          if (pairKey && !pairMap.has(pairKey)) {
            pairMap.set(pairKey, {
              ...d,
              id: docSnap.id,
              senderId: cleanSender,
              receiverId: cleanReceiver,
            });
          }
        });
        callback(Array.from(pairMap.values()));
      },
      (err) =>
        console.warn(
          "[CommunityService] subscribeAllAcceptedFriendships error:",
          err,
        ),
    );
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
        const cleanCurrentUid = String(currentUserId)
          .replace(/^mem_/, "")
          .trim();
        const cleanUid = String(uid).replace(/^mem_/, "").trim();
        if (cleanUid === cleanCurrentUid) return; // skip self

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

        const rel = friendships.find((f) => {
          const s = String(f.senderId || "")
            .replace(/^mem_/, "")
            .trim();
          const r = String(f.receiverId || "")
            .replace(/^mem_/, "")
            .trim();
          return (
            (s === cleanCurrentUid && r === cleanUid) ||
            (r === cleanCurrentUid && s === cleanUid)
          );
        });

        if (rel) {
          friendshipId = rel.id;
          if (rel.status === "accepted") {
            friendshipStatus = "friends";
          } else if (rel.status === "pending") {
            const cleanSender = String(rel.senderId || "")
              .replace(/^mem_/, "")
              .trim();
            friendshipStatus =
              cleanSender === cleanCurrentUid
                ? "pending_sent"
                : "pending_received";
          }
        }

        members.push({
          uid,
          name,
          avatar:
            data.profilePicture ||
            data.photoURL ||
            data.avatar ||
            data.profilePhoto ||
            data.photo ||
            "",
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

  /**
   * Update full user profile in Firestore `users` collection.
   */
  async updateUserProfile(
    userId: string,
    data: {
      name?: string;
      displayName?: string;
      bio?: string;
      location?: string;
      occupation?: string;
      school?: string;
      avatar?: string;
      profilePicture?: string;
      photoURL?: string;
      coverImage?: string;
    },
  ): Promise<void> {
    const cleanUid = String(userId).replace(/^mem_/, "").trim();
    if (!cleanUid) throw new Error("Invalid user ID for profile update.");

    const userRef = doc(db, "users", cleanUid);
    const payload: Record<string, any> = {
      updatedAt: new Date().toISOString(),
    };

    if (data.name !== undefined) payload.displayName = data.name.trim();
    if (data.displayName !== undefined)
      payload.displayName = data.displayName.trim();
    if (data.bio !== undefined) payload.bio = data.bio.trim();
    if (data.location !== undefined) payload.location = data.location.trim();
    if (data.occupation !== undefined)
      payload.occupation = data.occupation.trim();
    if (data.school !== undefined) payload.school = data.school.trim();
    if (data.coverImage !== undefined)
      payload.coverImage = data.coverImage.trim();

    const pic = data.avatar || data.profilePicture || data.photoURL;
    if (pic !== undefined) {
      payload.profilePicture = pic.trim();
      payload.photoURL = pic.trim();
      payload.avatar = pic.trim();
    }

    await setDoc(userRef, payload, { merge: true });

    // Sync auth user displayName & photoURL if current user
    if (auth.currentUser && auth.currentUser.uid === cleanUid) {
      try {
        const { updateProfile } = await import("firebase/auth");
        await updateProfile(auth.currentUser, {
          displayName: payload.displayName || auth.currentUser.displayName,
          photoURL: payload.photoURL || auth.currentUser.photoURL,
        });
      } catch (authErr) {
        console.warn("[CommunityService] updateAuthProfile deferred:", authErr);
      }
    }
  }

  /**
   * Fetch full user profile data from Firestore.
   */
  async getUserProfile(userId: string): Promise<Record<string, any> | null> {
    const cleanUid = String(userId).replace(/^mem_/, "").trim();
    if (!cleanUid) return null;
    try {
      const snap = await getDoc(doc(db, "users", cleanUid));
      if (!snap.exists()) return null;
      return snap.data();
    } catch (e) {
      console.warn("[CommunityService] getUserProfile error:", e);
      return null;
    }
  }

  /**
   * Accept an incoming direct message request from a non-friend.
   */
  async acceptDirectMessageRequest(
    conversationId: string,
    currentUserId: string,
  ): Promise<void> {
    const cleanUid = String(currentUserId).replace(/^mem_/, "").trim();
    const cleanConvId = conversationId.trim();
    if (!cleanConvId || !cleanUid) return;

    try {
      const convRef = doc(db, "directConversations", cleanConvId);
      await setDoc(
        convRef,
        {
          conversationId: cleanConvId,
          status: "accepted",
          acceptedBy: cleanUid,
          acceptedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    } catch (err) {
      console.warn(
        "[CommunityService] acceptDirectMessageRequest notice:",
        err,
      );
      throw err;
    }
  }

  /**
   * Decline/ignore a direct message request from a non-friend.
   */
  async declineDirectMessageRequest(
    conversationId: string,
    currentUserId: string,
  ): Promise<void> {
    const cleanUid = String(currentUserId).replace(/^mem_/, "").trim();
    const cleanConvId = conversationId.trim();
    if (!cleanConvId || !cleanUid) return;

    try {
      const convRef = doc(db, "directConversations", cleanConvId);
      await setDoc(
        convRef,
        {
          conversationId: cleanConvId,
          status: "declined",
          declinedBy: cleanUid,
          declinedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    } catch (err) {
      console.warn(
        "[CommunityService] declineDirectMessageRequest notice:",
        err,
      );
      throw err;
    }
  }

  /**
   * Real-time listener for accepted direct message conversations.
   * Resilient to auth restoration latency and handles offline/permission states gracefully.
   */
  subscribeAcceptedConversations(
    currentUserId: string,
    callback: (acceptedIds: Set<string>, declinedIds: Set<string>) => void,
  ): () => void {
    const cleanUid = String(currentUserId).replace(/^mem_/, "").trim();
    if (!cleanUid) {
      callback(new Set(), new Set());
      return () => {};
    }

    let unsubSnapshot: (() => void) | null = null;
    let isDisposed = false;

    const attach = () => {
      if (isDisposed || unsubSnapshot) return;
      try {
        const colRef = collection(db, "directConversations");
        unsubSnapshot = onSnapshot(
          colRef,
          (snapshot) => {
            if (isDisposed) return;
            const accepted = new Set<string>();
            const declined = new Set<string>();
            snapshot.docs.forEach((docSnap) => {
              const data = docSnap.data();
              const convId = docSnap.id;
              if (data.status === "accepted") {
                accepted.add(convId);
              } else if (data.status === "declined") {
                declined.add(convId);
              }
            });
            callback(accepted, declined);
          },
          (err) => {
            if (isDisposed) return;
            // Graceful non-crashing fallback
            callback(new Set(), new Set());
          },
        );
      } catch {
        if (!isDisposed) {
          callback(new Set(), new Set());
        }
      }
    };

    if (auth.currentUser) {
      attach();
    }

    const unsubAuth = auth.onAuthStateChanged((user: User | null) => {
      if (isDisposed) return;
      if (user) {
        attach();
      } else {
        if (unsubSnapshot) {
          unsubSnapshot();
          unsubSnapshot = null;
        }
        callback(new Set(), new Set());
      }
    });

    return () => {
      isDisposed = true;
      if (unsubAuth) unsubAuth();
      if (unsubSnapshot) {
        unsubSnapshot();
        unsubSnapshot = null;
      }
    };
  }

  // ─── REELS METHODS ────────────────────────────────────────────────────────

  subscribeReels(callback: (reels: CommunityReel[]) => void): () => void {
    const q = query(
      collection(db, "communityReels"),
      orderBy("createdAt", "desc"),
      limit(50),
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const firestoreReels: CommunityReel[] = snapshot.docs.map(
          (docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as any),
          }),
        );

        // Merge firestore user reels with curated library (avoiding duplicate IDs)
        const firestoreIds = new Set(firestoreReels.map((r) => r.id));
        const combined = [
          ...firestoreReels,
          ...CURATED_REELS.filter((cr) => !firestoreIds.has(cr.id)),
        ];
        callback(combined);
      },
      (error) => {
        console.warn("Failed to subscribe to communityReels:", error);
        callback(CURATED_REELS);
      },
    );
  }

  async createReel(
    reelData: Omit<
      CommunityReel,
      | "id"
      | "likes"
      | "likesCount"
      | "commentsCount"
      | "sharesCount"
      | "createdAt"
    >,
  ): Promise<string> {
    const reelRef = doc(collection(db, "communityReels"));

    // Auto-resolve thumbnail if not provided
    let safeThumbnail = (reelData.thumbnailUrl || "").trim();
    if (!safeThumbnail && reelData.videoUrl) {
      const ytId = extractYouTubeId(reelData.videoUrl);
      if (ytId) {
        safeThumbnail = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
      } else if (reelData.videoUrl.toLowerCase().endsWith(".mp4")) {
        safeThumbnail = reelData.videoUrl.replace(/\.mp4$/i, ".jpg");
      }
    }

    const rawReel: Record<string, any> = {
      id: reelRef.id,
      authorId: reelData.authorId || "",
      authorName: reelData.authorName || "Splitzer",
      authorEmail: reelData.authorEmail || "",
      authorAvatar: reelData.authorAvatar || "",
      authorRole: reelData.authorRole || "Splitzy Resident",
      videoUrl: reelData.videoUrl || "",
      thumbnailUrl: safeThumbnail,
      caption: reelData.caption || "",
      category: reelData.category || "lifestyle",
      soundTitle: reelData.soundTitle || "Original Audio",
      likes: [],
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      createdAt: new Date().toISOString(),
    };

    if (typeof reelData.duration === "number" && !isNaN(reelData.duration)) {
      rawReel.duration = reelData.duration;
    }
    if (typeof reelData.isCurated === "boolean") {
      rawReel.isCurated = reelData.isCurated;
    }

    // Strip any potential undefined values so Firestore setDoc never rejects the document
    const sanitizedDoc: Record<string, any> = {};
    for (const [key, val] of Object.entries(rawReel)) {
      if (val !== undefined) {
        sanitizedDoc[key] = val;
      }
    }

    await setDoc(reelRef, sanitizedDoc);
    return reelRef.id;
  }

  async toggleReelLike(reelId: string, userId: string): Promise<void> {
    if (!userId) return;
    if (reelId.startsWith("curated_")) {
      return;
    }
    const reelRef = doc(db, "communityReels", reelId);
    const snap = await getDoc(reelRef);
    if (!snap.exists()) return;

    const currentLikes: string[] = snap.data().likes || [];
    const isLiked = currentLikes.includes(userId);
    const newLikes = isLiked
      ? currentLikes.filter((uid) => uid !== userId)
      : [...currentLikes, userId];

    await updateDoc(reelRef, {
      likes: newLikes,
      likesCount: newLikes.length,
    });
  }

  subscribeReelComments(
    reelId: string,
    callback: (comments: CommunityReelComment[]) => void,
  ): () => void {
    if (reelId.startsWith("curated_")) {
      callback([
        {
          id: `comment_${reelId}_1`,
          reelId,
          authorId: "sample_commenter_1",
          authorName: "Sarah Chen",
          authorAvatar:
            "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80",
          content:
            "Love this tip! We started doing this in our unit last week and it really works! 🙌",
          createdAt: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
        },
        {
          id: `comment_${reelId}_2`,
          reelId,
          authorId: "sample_commenter_2",
          authorName: "David Kim",
          authorAvatar:
            "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80",
          content:
            "Splitzy makes it so painless. Can't imagine living without it!",
          createdAt: new Date(Date.now() - 3600 * 1000 * 1).toISOString(),
        },
      ]);
      return () => {};
    }

    const q = query(
      collection(db, "communityReels", reelId, "comments"),
      orderBy("createdAt", "asc"),
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const comments: CommunityReelComment[] = snapshot.docs.map(
          (docSnap) => ({
            id: docSnap.id,
            reelId,
            ...(docSnap.data() as any),
          }),
        );
        callback(comments);
      },
      (error) => {
        console.warn("Failed to subscribe to reel comments:", error);
        callback([]);
      },
    );
  }

  async addReelComment(
    reelId: string,
    content: string,
    author: { uid: string; name: string; avatar?: string },
  ): Promise<string> {
    if (reelId.startsWith("curated_")) {
      return `comment_curated_${Date.now()}`;
    }
    const commentRef = doc(
      collection(db, "communityReels", reelId, "comments"),
    );
    const newComment: CommunityReelComment = {
      id: commentRef.id,
      reelId,
      authorId: author.uid,
      authorName: author.name,
      authorAvatar: author.avatar || "",
      content: content.trim(),
      createdAt: new Date().toISOString(),
    };

    await setDoc(commentRef, newComment);

    try {
      const reelRef = doc(db, "communityReels", reelId);
      await updateDoc(reelRef, {
        commentsCount: increment(1),
      });
    } catch {}

    return commentRef.id;
  }

  private sessionViewedReels = new Set<string>();

  /**
   * Record a view for a reel once per user session using Firestore atomic counter.
   */
  async recordReelView(reelId: string, viewerId?: string): Promise<void> {
    if (!reelId) return;
    const sessionKey = `${reelId}_${viewerId || "guest"}`;
    if (this.sessionViewedReels.has(sessionKey)) {
      return; // Already recorded in this session
    }
    this.sessionViewedReels.add(sessionKey);

    // Handle curated reel in-memory
    if (reelId.startsWith("curated_")) {
      const cr = CURATED_REELS.find((r) => r.id === reelId);
      if (cr) {
        cr.viewsCount = (cr.viewsCount || 0) + 1;
      }
      return;
    }

    try {
      const reelRef = doc(db, "communityReels", reelId);
      const updatePayload: Record<string, any> = {
        viewsCount: increment(1),
      };
      if (viewerId) {
        updatePayload.viewers = arrayUnion(viewerId);
      }
      await updateDoc(reelRef, updatePayload);
    } catch (e) {
      if (isQuotaExceededError(e)) {
        notifyQuotaExceeded();
      } else {
        console.warn(
          "[CommunityService] recordReelView non-blocking notice:",
          e,
        );
      }
    }
  }

  /**
   * Subscribe to reels created by a specific user for Profile Screen Reels tab.
   */
  subscribeUserReels(
    userId: string,
    callback: (reels: CommunityReel[]) => void,
  ): () => void {
    const cleanUid = String(userId || "")
      .replace(/^mem_/, "")
      .trim();
    if (!cleanUid) {
      callback([]);
      return () => {};
    }

    const q = query(
      collection(db, "communityReels"),
      where("authorId", "in", [cleanUid, `mem_${cleanUid}`]),
      orderBy("createdAt", "desc"),
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const userFirestoreReels: CommunityReel[] = snapshot.docs.map(
          (docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as any),
          }),
        );

        // Include curated reels if matching author (e.g. curator accounts)
        const matchedCurated = CURATED_REELS.filter(
          (cr) =>
            cr.authorId === cleanUid ||
            cr.authorId === `mem_${cleanUid}` ||
            (cleanUid === "cebutitans03" &&
              cr.authorId.startsWith("splitzy_curator")),
        );

        callback([...userFirestoreReels, ...matchedCurated]);
      },
      (err) => {
        console.warn("[CommunityService] subscribeUserReels error:", err);
        // Fallback filter from in-memory curated
        const matchedCurated = CURATED_REELS.filter(
          (cr) =>
            cr.authorId === cleanUid ||
            cr.authorId === `mem_${cleanUid}` ||
            (cleanUid === "cebutitans03" &&
              cr.authorId.startsWith("splitzy_curator")),
        );
        callback(matchedCurated);
      },
    );
  }

  async deleteReel(reelId: string, authorId: string): Promise<void> {
    if (reelId.startsWith("curated_")) return;
    const reelRef = doc(db, "communityReels", reelId);
    const snap = await getDoc(reelRef);
    if (!snap.exists()) return;
    if (
      snap.data().authorId !== authorId &&
      auth.currentUser?.email !== "cebutitans07@gmail.com"
    ) {
      throw new Error("You are not authorized to delete this reel.");
    }
    await deleteDoc(reelRef);
  }
}

/**
 * Universal safe avatar resolver helper that normalizes all photo properties.
 */
export function resolveUserAvatarUrl(userData: any): string {
  if (!userData) return "";
  if (typeof userData === "string") {
    const trimmed = userData.trim();
    if (
      trimmed.startsWith("http://") ||
      trimmed.startsWith("https://") ||
      trimmed.startsWith("data:image/")
    ) {
      return trimmed;
    }
    return "";
  }
  const candidate =
    userData.profilePicture ||
    userData.photoURL ||
    userData.avatar ||
    userData.avatarUrl ||
    userData.profilePhoto ||
    userData.photo ||
    userData.image ||
    "";
  const str = String(candidate || "").trim();
  if (
    str.startsWith("http://") ||
    str.startsWith("https://") ||
    str.startsWith("data:image/")
  ) {
    return str;
  }
  return "";
}

export const communityService = new CommunityService();
