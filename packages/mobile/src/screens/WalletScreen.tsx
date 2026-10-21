import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Dimensions,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Vibration,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import jsQR from "jsqr";
import { SplitzyQrCode, downloadQrCodePng } from "../components/SplitzyQrCode";
import { mobileDataService } from "../services/firebaseDataService";
import { useTheme } from "../context/ThemeContext";
import { useNavVisibility } from "../context/NavVisibilityContext";
import {
  walletService,
  WalletState,
  PaymentCard,
  SavingsPocket,
  WalletTransaction,
  CardProviderType,
  PHILIPPINE_CARD_PRESETS,
  CashAutomationRule,
  DEFAULT_CASH_RULES,
} from "../services/walletService";
import { auth } from "../firebase/config";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Safe Expo Camera & Native Scanner Loader (Resilient against EAS OTA updates across different native binaries)
let NativeCameraView: any = null;
let NativeCamera: any = null;
let nativeScanFromURLAsync: any = null;
let nativeRequestCameraPermissionsAsync: any = null;

try {
  const expCam = require("expo-camera");
  NativeCameraView = expCam.CameraView || expCam.Camera;
  NativeCamera = expCam.Camera;
  nativeScanFromURLAsync =
    expCam.scanFromURLAsync || expCam.Camera?.scanFromURLAsync;
  nativeRequestCameraPermissionsAsync =
    expCam.requestCameraPermissionsAsync ||
    expCam.Camera?.requestCameraPermissionsAsync;
} catch (_) {}

let jpegDecoder: any = null;
try {
  jpegDecoder = require("jpeg-js");
} catch (_) {}

function base64ToUint8Array(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, "");
  const len = clean.length;
  const byteLength = (len * 3) >> 2;
  const bytes = new Uint8Array(byteLength);
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const enc1 = chars.indexOf(clean.charAt(i));
    const enc2 = chars.indexOf(clean.charAt(i + 1));
    const enc3 = chars.indexOf(clean.charAt(i + 2));
    const enc4 = chars.indexOf(clean.charAt(i + 3));
    bytes[p++] = (enc1 << 2) | (enc2 >> 4);
    if (enc3 !== -1 && p < byteLength)
      bytes[p++] = ((enc2 & 15) << 4) | (enc3 >> 2);
    if (enc4 !== -1 && p < byteLength) bytes[p++] = ((enc3 & 3) << 6) | enc4;
  }
  return bytes;
}

function decodePixelsFromBytes(rawBytes: Uint8Array): {
  width: number;
  height: number;
  data: Uint8ClampedArray;
} | null {
  // Try JPEG format (SOI 0xFF, 0xD8)
  if (jpegDecoder && jpegDecoder.decode) {
    try {
      const decoded = jpegDecoder.decode(rawBytes, { useTArray: true });
      if (decoded && decoded.width && decoded.height && decoded.data) {
        return {
          width: decoded.width,
          height: decoded.height,
          data: new Uint8ClampedArray(decoded.data),
        };
      }
    } catch (_) {}
  }
  return null;
}

export interface QuickExpensePreset {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  amount: number;
  gradient: [string, string];
  defaultNote: string;
  color: string;
}

export const QUICK_EXPENSE_PRESETS: QuickExpensePreset[] = [
  {
    id: "coffee",
    title: "Coffee Break",
    icon: "cafe",
    amount: 150,
    gradient: ["#78350F", "#D97706"],
    defaultNote: "Morning espresso & pastry",
    color: "#F59E0B",
  },
  {
    id: "lunch",
    title: "Lunch Meal",
    icon: "restaurant",
    amount: 220,
    gradient: ["#C2410C", "#EA580C"],
    defaultNote: "Midday meal & drinks",
    color: "#FB923C",
  },
  {
    id: "commute",
    title: "Commute Fare",
    icon: "bus",
    amount: 65,
    gradient: ["#0369A1", "#0284C7"],
    defaultNote: "Jeepney / MRT / Transit ride",
    color: "#38BDF8",
  },
  {
    id: "grocery",
    title: "Grocery Run",
    icon: "basket",
    amount: 480,
    gradient: ["#047857", "#10B981"],
    defaultNote: "Fresh market & pantry supplies",
    color: "#34D399",
  },
  {
    id: "merienda",
    title: "Merienda Snack",
    icon: "fast-food",
    amount: 95,
    gradient: ["#B45309", "#F59E0B"],
    defaultNote: "Afternoon milk tea & snack",
    color: "#FBBF24",
  },
  {
    id: "utility",
    title: "Mobile Load / Bills",
    icon: "flash",
    amount: 300,
    gradient: ["#6D28D9", "#8B5CF6"],
    defaultNote: "Data reload / household utility",
    color: "#A78BFA",
  },
  {
    id: "pharmacy",
    title: "Pharmacy / Meds",
    icon: "medkit",
    amount: 180,
    gradient: ["#BE123C", "#F43F5E"],
    defaultNote: "Vitamins & pharmacy essentials",
    color: "#FB7185",
  },
  {
    id: "custom",
    title: "Custom Expense",
    icon: "add-circle",
    amount: 100,
    gradient: ["#1E293B", "#334155"],
    defaultNote: "Custom daily simulation",
    color: "#94A3B8",
  },
];

export interface SemanticExpenseInput {
  title?: string;
  note?: string;
  description?: string;
  category?: string;
  icon?: string;
  type?: string;
  amount?: number;
  [key: string]: any;
}

export type AppWalletTransaction = WalletTransaction & {
  note?: string;
  icon?: string;
  category?: string;
};

// Intersection ensures note, category, icon, title, and description are ALWAYS recognized by TypeScript
// on unions of SemanticExpenseInput | Partial<WalletTransaction> | WalletTransaction
export type SemanticTxInput = (
  | SemanticExpenseInput
  | Partial<WalletTransaction>
  | Partial<AppWalletTransaction>
  | Record<string, any>
) & {
  note?: string;
  category?: string;
  icon?: string;
  title?: string;
  description?: string;
};

export function getExpenseSemanticIconMobile(tx?: SemanticTxInput | null): {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
} {
  const presetIconMap: Record<
    string,
    { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }
  > = {
    coffee: { icon: "cafe", color: "#F59E0B", bg: "#F59E0B18" },
    cafe: { icon: "cafe", color: "#F59E0B", bg: "#F59E0B18" },
    lunch: { icon: "restaurant", color: "#FB923C", bg: "#FB923C18" },
    restaurant: { icon: "restaurant", color: "#FB923C", bg: "#FB923C18" },
    commute: { icon: "bus", color: "#38BDF8", bg: "#38BDF818" },
    bus: { icon: "bus", color: "#38BDF8", bg: "#38BDF818" },
    grocery: { icon: "basket", color: "#34D399", bg: "#34D39918" },
    basket: { icon: "basket", color: "#34D399", bg: "#34D39918" },
    cart: { icon: "basket", color: "#34D399", bg: "#34D39918" },
    merienda: { icon: "fast-food", color: "#FBBF24", bg: "#FBBF2418" },
    "fast-food": { icon: "fast-food", color: "#FBBF24", bg: "#FBBF2418" },
    utility: { icon: "flash", color: "#A78BFA", bg: "#A78BFA18" },
    flash: { icon: "flash", color: "#A78BFA", bg: "#A78BFA18" },
    pharmacy: { icon: "medkit", color: "#FB7185", bg: "#FB718518" },
    medkit: { icon: "medkit", color: "#FB7185", bg: "#FB718518" },
    cash: { icon: "cash", color: "#10B981", bg: "#10B98118" },
  };

  const safeTx = (tx || {}) as SemanticTxInput;
  const rawTitle = safeTx.title || "";
  const rawNote = safeTx.note || "";
  const rawDescription = safeTx.description || "";
  const rawCategory = safeTx.category || "";
  const rawText =
    `${rawTitle} ${rawNote} ${rawDescription} ${rawCategory}`.toLowerCase();

  // 1. Drinks, Coffee, Milk Tea & Beverages
  if (
    /(coffee|cafe|espresso|latte|cappuccino|americano|mocha|tea|boba|milktea|milk tea|starbucks|dunkin|drink|beverage|juice|smoothie|frap|chatime|coco|macao|gong cha|tiger sugar|matcha)/.test(
      rawText,
    )
  ) {
    return { icon: "cafe", color: "#F59E0B", bg: "#F59E0B18" };
  }
  // 2. Meals, Fast Food & Dining Out
  if (
    /(lunch|dinner|breakfast|meal|food|restaurant|karinderya|carinderia|jollibee|mcdo|mcdonald|burger|ramen|kfc|inasal|chowking|pares|silog|tapsilog|sinigang|adobo|eat|dining|resto|buffet|kbbq|samgyup|bbq|shawarma|chooks|mang inasal)/.test(
      rawText,
    )
  ) {
    return { icon: "restaurant", color: "#FB923C", bg: "#FB923C18" };
  }
  // 3. Pizza & Italian
  if (/(pizza|yellow cab|shakey|domino|pizza hut)/.test(rawText)) {
    return { icon: "pizza", color: "#EA580C", bg: "#EA580C18" };
  }
  // 4. Merienda & Bakery Snacks
  if (
    /(merienda|snack|bakery|bread|pan de sal|pandesal|pastry|donut|cake|dessert|cookie|chips|ice cream|candy|waffle|goldilocks|red ribbon)/.test(
      rawText,
    )
  ) {
    return { icon: "fast-food", color: "#FBBF24", bg: "#FBBF2418" };
  }
  // 5. Ridesharing, Fuel & Personal Vehicle
  if (
    /(grab|taxi|cab|angkas|joyride|maxim|car|gas|fuel|petrol|toll|parking|diesel|drive|petron|shell|caltex)/.test(
      rawText,
    )
  ) {
    return { icon: "car", color: "#0284C7", bg: "#0284C718" };
  }
  // 6. Commute & Public Transit
  if (
    /(commute|fare|jeep|jeepney|trike|tricycle|bus|mrt|lrt|train|transit|subway|ride|travel)/.test(
      rawText,
    )
  ) {
    return { icon: "bus", color: "#38BDF8", bg: "#38BDF818" };
  }
  // 7. Flights & Vacation Travel
  if (
    /(flight|airplane|travel|vacation|airline|airport|cebu pacific|philippine airlines|airasia|hotel|airbnb|resort)/.test(
      rawText,
    )
  ) {
    return { icon: "airplane", color: "#3B82F6", bg: "#3B82F618" };
  }
  // 8. Supermarket, Fresh Market & Pantry
  if (
    /(grocery|groceries|market|palengke|supermarket|puregold|robinsons|sm market|sari-sari|convenience|7-eleven|ministop|alfamart|store|pantry|supplies|soap|shampoo|landers|snr|s&r)/.test(
      rawText,
    )
  ) {
    return { icon: "basket", color: "#34D399", bg: "#34D39918" };
  }
  // 9. Laundry & Fabric Care
  if (
    /(laundry|labada|wash|dry clean|dryclean|detergent|downy|ariel|surf|tide|cleaners)/.test(
      rawText,
    )
  ) {
    return { icon: "shirt", color: "#0EA5E9", bg: "#0EA5E918" };
  }
  // 10. Pharmacy, Health & Medical
  if (
    /(pharmacy|meds|medicine|drug|mercury|watsons|generics|doctor|clinic|hospital|dental|dentist|health|vitamin|pill|bandage|biogesic|neozep|paracetamol|theraflu)/.test(
      rawText,
    )
  ) {
    return { icon: "medkit", color: "#FB7185", bg: "#FB718518" };
  }
  // 11. Power, Electricity & Prepaid Load
  if (
    /(utility|utilities|bill|load|data|electric|meralco|power|prepaid|postpaid)/.test(
      rawText,
    )
  ) {
    return { icon: "flash", color: "#A78BFA", bg: "#A78BFA18" };
  }
  // 12. Water Services
  if (/(water|maynilad|manila water|prime water)/.test(rawText)) {
    return { icon: "water", color: "#06B6D4", bg: "#06B6D418" };
  }
  // 13. Internet & Telecom
  if (
    /(internet|wifi|fiber|pldt|globe|smart|converge|dito|telco)/.test(rawText)
  ) {
    return { icon: "wifi", color: "#8B5CF6", bg: "#8B5CF618" };
  }
  // 14. Cinema & Streaming
  if (/(movie|cinema|netflix|theater|film|disney|hbo|youtube)/.test(rawText)) {
    return { icon: "film", color: "#E11D48", bg: "#E11D4818" };
  }
  // 15. Gaming & Digital Entertainment
  if (
    /(game|gaming|steam|playstation|xbox|nintendo|esports|valorant|genshin|mlbb|mobile legends)/.test(
      rawText,
    )
  ) {
    return { icon: "game-controller", color: "#6366F1", bg: "#6366F118" };
  }
  // 16. Music & Audio Streaming
  if (/(spotify|music|concert|song|audio|apple music)/.test(rawText)) {
    return { icon: "musical-notes", color: "#10B981", bg: "#10B98118" };
  }
  // 17. Gym, Sports & Fitness
  if (
    /(gym|workout|fitness|crossfit|boxing|yoga|anytime fitness|gold gym|pilates|sports|badminton|basketball)/.test(
      rawText,
    )
  ) {
    return { icon: "fitness", color: "#F43F5E", bg: "#F43F5E18" };
  }
  // 18. Grooming, Salon & Personal Care
  if (
    /(haircut|salon|barber|barbershop|beauty|spa|wax|massage|nails)/.test(
      rawText,
    )
  ) {
    return { icon: "cut", color: "#EC4899", bg: "#EC489918" };
  }
  // 19. School, Books & Education
  if (
    /(school|book|tuition|course|study|exam|stationery|pen|paper|class|supplies|national bookstore)/.test(
      rawText,
    )
  ) {
    return { icon: "book", color: "#3B82F6", bg: "#3B82F618" };
  }
  // 20. Tech, Gadgets & Hardware
  if (
    /(tech|gadget|phone|iphone|android|laptop|macbook|ipad|tablet|charger|cable|earbuds|airpods|headphone|mouse|keyboard|monitor|electronics)/.test(
      rawText,
    )
  ) {
    return { icon: "hardware-chip", color: "#6366F1", bg: "#6366F118" };
  }
  // 21. Celebrations & Gifts
  if (
    /(gift|regalo|present|party|birthday|anniversary|celebration|christmas|balloon)/.test(
      rawText,
    )
  ) {
    return { icon: "gift", color: "#EC4899", bg: "#EC489918" };
  }
  // 22. Tools & Repair
  if (
    /(tool|tools|repair|hardware|hammer|drill|plumbing|paint|screws|fix|maintenance)/.test(
      rawText,
    )
  ) {
    return { icon: "construct", color: "#F59E0B", bg: "#F59E0B18" };
  }
  // 23. Subscriptions & Association Dues
  if (
    /(subscription|sub|hoa|dues|condo dues|association|membership|fee|insurance)/.test(
      rawText,
    )
  ) {
    return { icon: "card", color: "#8B5CF6", bg: "#8B5CF618" };
  }
  // 24. Apparel & Lifestyle Shopping
  if (
    /(shopping|clothes|shirt|pants|shoes|sneakers|shopee|lazada|shein|tiktok|apparel|fashion|zara|uniqlo|h&m)/.test(
      rawText,
    )
  ) {
    return { icon: "pricetag", color: "#F472B6", bg: "#F472B618" };
  }
  // 25. Pets & Veterinary Care
  if (/(pet|vet|dog|cat|animal|puppy|kitten)/.test(rawText)) {
    return { icon: "paw", color: "#F59E0B", bg: "#F59E0B18" };
  }
  // 26. Rent, Home & Accommodation
  if (/(rent|room|apartment|condo|house|home|stay|dorm)/.test(rawText)) {
    return { icon: "home", color: "#14B8A6", bg: "#14B8A618" };
  }
  // 27. Cash & Allowances
  if (/(cash|allowance|petty|tender|atm|change|withdrawal)/.test(rawText)) {
    return { icon: "cash", color: "#10B981", bg: "#10B98118" };
  }

  // Preset key fallback (ignoring generic 'cart', 'custom', 'add-circle' so title takes precedence)
  const txIcon = safeTx.icon;
  if (
    txIcon &&
    !["cart", "custom", "add-circle"].includes(txIcon) &&
    presetIconMap[txIcon]
  ) {
    return presetIconMap[txIcon];
  }

  // Diversified lifestyle fallbacks (NEVER defaulting to cart or bag)
  const fallbacks: {
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    bg: string;
  }[] = [
    { icon: "sparkles", color: "#EC4899", bg: "#EC489918" },
    { icon: "pricetag", color: "#8B5CF6", bg: "#8B5CF618" },
    { icon: "compass", color: "#14B8A6", bg: "#14B8A618" },
    { icon: "bookmark", color: "#06B6D4", bg: "#06B6D418" },
    { icon: "wallet", color: "#10B981", bg: "#10B98118" },
    { icon: "heart", color: "#F43F5E", bg: "#F43F5E18" },
    { icon: "gift", color: "#F59E0B", bg: "#F59E0B18" },
    { icon: "cube", color: "#3B82F6", bg: "#3B82F618" },
    { icon: "ribbon", color: "#8B5CF6", bg: "#8B5CF618" },
    { icon: "shield-checkmark", color: "#0284C7", bg: "#0284C718" },
  ];
  const charCodeSum = (tx?.title || "expense")
    .split("")
    .reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return fallbacks[charCodeSum % fallbacks.length];
}

interface WalletScreenProps {
  userId?: string;
  currentUser?: {
    name: string;
    role?: string;
    email?: string;
    avatar?: string;
    photoURL?: string;
  };
  onNavigateToBills?: () => void;
  onNavigateToSettle?: () => void;
}

export function WalletScreen({
  userId: propUserId,
  currentUser,
  onNavigateToBills,
  onNavigateToSettle,
}: WalletScreenProps) {
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useTheme();
  const { onScroll, showNav, keyboardHeight } = useNavVisibility();
  const [localKeyboardHeight, setLocalKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const s1 = Keyboard.addListener(showEvent, (e: any) => {
      setLocalKeyboardHeight(e?.endCoordinates?.height || 0);
    });
    const s2 = Keyboard.addListener(hideEvent, () => {
      setLocalKeyboardHeight(0);
    });
    return () => {
      s1.remove();
      s2.remove();
    };
  }, []);

  const effectiveKeyboardHeight = Math.max(
    keyboardHeight || 0,
    localKeyboardHeight,
  );
  const windowHeight = Dimensions.get("window").height;
  const modalAdaptiveMaxHeight = React.useMemo(() => {
    if (effectiveKeyboardHeight > 0) {
      return Math.max(
        260,
        windowHeight - effectiveKeyboardHeight - (insets.top + 24),
      );
    }
    return windowHeight * 0.92;
  }, [effectiveKeyboardHeight, windowHeight, insets.top]);

  const dynamicModalOverlayStyle = [
    styles.modalOverlay,
    effectiveKeyboardHeight > 0
      ? { paddingBottom: effectiveKeyboardHeight }
      : { paddingBottom: Math.max(0, insets.bottom) },
  ];

  useEffect(() => {
    showNav();
  }, [showNav]);

  const [currentUid, setCurrentUid] = useState<string>(() => {
    return propUserId || auth.currentUser?.uid || "guest";
  });

  useEffect(() => {
    if (propUserId && propUserId !== "guest") {
      setCurrentUid(propUserId);
    }
    const unsub = auth.onAuthStateChanged((user: any) => {
      if (user?.uid) {
        setCurrentUid(user.uid);
      } else if (propUserId) {
        setCurrentUid(propUserId);
      }
    });
    return unsub;
  }, [propUserId]);

  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [hideBalance, setHideBalance] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Modals state
  const [showCashInModal, setShowCashInModal] = useState<boolean>(false);
  const [cashInAmount, setCashInAmount] = useState<string>("1000");
  const [cashInMethod, setCashInMethod] = useState<string>("GCash");
  const [selectedCashInCardId, setSelectedCashInCardId] = useState<string>("");
  const [cashInSource, setCashInSource] = useState<string>("");

  const [showAddCardModal, setShowAddCardModal] = useState<boolean>(false);
  const [newCardType, setNewCardType] = useState<CardProviderType>("gcash");
  const [newCardName, setNewCardName] = useState<string>("");
  const [newCardNumber, setNewCardNumber] = useState<string>("");
  const [newCardHolder, setNewCardHolder] = useState<string>("");
  const [newCardBalance, setNewCardBalance] = useState<string>("5000");

  // Card Details / Tap Action Bottom Sheet State
  const [showCardDetailModal, setShowCardDetailModal] =
    useState<boolean>(false);
  const [selectedCardDetail, setSelectedCardDetail] =
    useState<PaymentCard | null>(null);

  // Delete Individual Card Modal State (Security Question: Name of Card)
  const [showDeleteCardModal, setShowDeleteCardModal] =
    useState<boolean>(false);
  const [selectedCardToDelete, setSelectedCardToDelete] =
    useState<PaymentCard | null>(null);
  const [deleteCardConfirmText, setDeleteCardConfirmText] =
    useState<string>("");
  const [isDeletingCard, setIsDeletingCard] = useState<boolean>(false);

  // Quick Circle Menu Action Modals
  const [showSendMoneyModal, setShowSendMoneyModal] = useState<boolean>(false);
  const [sendRecipient, setSendRecipient] = useState<string>("Roommate Alex");
  const [sendAmount, setSendAmount] = useState<string>("500");
  const [sendNote, setSendNote] = useState<string>("");
  const [sendSelectedCardId, setSendSelectedCardId] = useState<string>("");

  const [showRequestSplitModal, setShowRequestSplitModal] =
    useState<boolean>(false);
  const [splitTitle, setSplitTitle] = useState<string>(
    "Meralco Electricity Bill",
  );
  const [splitAmount, setSplitAmount] = useState<string>("2400");
  const [splitNumPeople, setSplitNumPeople] = useState<number>(4);

  const [showScanQrModal, setShowScanQrModal] = useState<boolean>(false);
  const [qrModalTab, setQrModalTab] = useState<"scan" | "receive">("scan");
  const [qrScanStep, setQrScanStep] = useState<
    "viewfinder" | "confirm" | "receipt"
  >("viewfinder");
  const [presetAmount, setPresetAmount] = useState<string>("");
  const [presetNote, setPresetNote] = useState<string>("");
  const [showPresetEditor, setShowPresetEditor] = useState<boolean>(false);
  const [copiedPayLink, setCopiedPayLink] = useState<boolean>(false);
  const [manualCodeInput, setManualCodeInput] = useState<string>("");
  const [showManualInput, setShowManualInput] = useState<boolean>(false);
  const [scannedRecipient, setScannedRecipient] = useState<{
    uid: string;
    name: string;
    email?: string;
    avatar?: string;
    role?: string;
  } | null>(null);
  const [qrTransferAmount, setQrTransferAmount] = useState<string>("");
  const [qrTransferNote, setQrTransferNote] = useState<string>("");
  const [qrFundingSource, setQrFundingSource] = useState<"wallet" | string>(
    "wallet",
  );
  const [isProcessingQrTransfer, setIsProcessingQrTransfer] =
    useState<boolean>(false);
  const [qrReceipt, setQrReceipt] = useState<{
    refNumber: string;
    amount: number;
    recipientName: string;
    sourceName: string;
    timestamp: string;
    note?: string;
  } | null>(null);
  const [householdMembers, setHouseholdMembers] = useState<any[]>([]);

  // Real Camera & Scanner State
  const videoRef = useRef<any>(null);
  const cameraStreamRef = useRef<any>(null);
  const scanIntervalRef = useRef<any>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<
    boolean | null
  >(null);
  const [cameraFacingMode, setCameraFacingMode] = useState<
    "environment" | "user"
  >("environment");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isDownloadingQrPng, setIsDownloadingQrPng] = useState<boolean>(false);
  const [isDecodingImage, setIsDecodingImage] = useState<boolean>(false);

  const qrScanLaserAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (
      showScanQrModal &&
      qrModalTab === "scan" &&
      qrScanStep === "viewfinder"
    ) {
      const animLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(qrScanLaserAnim, {
            toValue: 1,
            duration: 1600,
            useNativeDriver: true,
          }),
          Animated.timing(qrScanLaserAnim, {
            toValue: 0,
            duration: 1600,
            useNativeDriver: true,
          }),
        ]),
      );
      animLoop.start();
      return () => animLoop.stop();
    }
  }, [showScanQrModal, qrModalTab, qrScanStep, qrScanLaserAnim]);

  useEffect(() => {
    const cachedProfile = mobileDataService.getCachedProfile(currentUid);
    const householdId = cachedProfile?.householdId || "";
    if (!householdId) return;

    const unsub = mobileDataService.listenToHouseholdMembers(
      householdId,
      (data) => {
        if (Array.isArray(data) && data.length > 0) {
          setHouseholdMembers(data);
        }
      },
    );
    return unsub;
  }, [currentUid]);

  const availableRoommates = useMemo(() => {
    const filtered = householdMembers.filter(
      (m) => (m.userId || m.uid || m.id) !== currentUid,
    );
    if (filtered.length > 0) {
      return filtered.map((m) => ({
        uid: m.userId || m.uid || m.id,
        name: m.name || m.displayName || "Roommate",
        email: m.email || "",
        avatar: m.profilePicture || m.avatar || "",
        role: m.role || "MEMBER",
      }));
    }
    return [
      {
        uid: "user_alex_rivera",
        name: "Alex Rivera",
        email: "alex.rivera@splitzy.ph",
        avatar: "",
        role: "MEMBER",
      },
      {
        uid: "user_maria_santos",
        name: "Maria Santos",
        email: "maria.santos@splitzy.ph",
        avatar: "",
        role: "HOST",
      },
      {
        uid: "user_josh_chen",
        name: "Josh Chen",
        email: "josh.chen@splitzy.ph",
        avatar: "",
        role: "MEMBER",
      },
      {
        uid: "user_bea_ramos",
        name: "Bea Ramos",
        email: "bea.ramos@splitzy.ph",
        avatar: "",
        role: "MEMBER",
      },
    ];
  }, [householdMembers, currentUid]);

  const myDisplayName =
    currentUser?.name || auth.currentUser?.displayName || "Splitzy Resident";
  const myEmail = currentUser?.email || auth.currentUser?.email || "";
  const myAvatar =
    currentUser?.photoURL ||
    currentUser?.avatar ||
    auth.currentUser?.photoURL ||
    "";

  const myQrPayload = useMemo(() => {
    const params = new URLSearchParams();
    params.set("uid", currentUid);
    params.set("name", myDisplayName);
    if (myEmail) params.set("email", myEmail);
    if (presetAmount && Number(presetAmount) > 0) {
      params.set("amt", presetAmount.trim());
    }
    if (presetNote && presetNote.trim()) {
      params.set("note", presetNote.trim());
    }
    return `splitzy://pay?${params.toString()}`;
  }, [currentUid, myDisplayName, myEmail, presetAmount, presetNote]);

  const parseQrPayload = (payload: string) => {
    try {
      const trimmed = payload.trim();
      if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        const parsed = JSON.parse(trimmed);
        return {
          uid: parsed.uid || parsed.userId || "user_roommate",
          name: parsed.name || parsed.displayName || "Splitzy Resident",
          email: parsed.email || "",
          amount: parsed.amount
            ? String(parsed.amount)
            : parsed.amt
              ? String(parsed.amt)
              : "",
          note: parsed.note || "",
        };
      }

      if (trimmed.includes("uid=")) {
        const queryPart = trimmed.includes("?")
          ? trimmed.split("?")[1]
          : trimmed;
        const searchParams = new URLSearchParams(queryPart);
        const uid = searchParams.get("uid") || "user_roommate";
        const name = searchParams.get("name") || "Splitzy Resident";
        const email = searchParams.get("email") || "";
        const amt = searchParams.get("amt") || searchParams.get("amount") || "";
        const note = searchParams.get("note") || "";
        return { uid, name, email, amount: amt, note };
      }

      const matched = availableRoommates.find(
        (r) =>
          r.uid.toLowerCase() === trimmed.toLowerCase() ||
          r.name.toLowerCase() === trimmed.toLowerCase() ||
          r.email.toLowerCase() === trimmed.toLowerCase(),
      );
      if (matched) {
        return {
          uid: matched.uid,
          name: matched.name,
          email: matched.email,
          amount: "",
          note: "",
        };
      }

      return {
        uid: trimmed || "user_splitzy_resident",
        name: trimmed.includes("@")
          ? trimmed.split("@")[0]
          : "Splitzy Resident",
        email: trimmed.includes("@") ? trimmed : "",
        amount: "",
        note: "",
      };
    } catch (e) {
      return {
        uid: "user_roommate",
        name: "Splitzy Resident",
        email: "",
        amount: "",
        note: "",
      };
    }
  };

  const stopLiveCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (cameraStreamRef.current) {
      try {
        cameraStreamRef.current
          .getTracks()
          .forEach((track: any) => track.stop());
      } catch (e) {
        console.warn("[WalletScreen] Error stopping camera stream:", e);
      }
      cameraStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const startLiveCamera = async () => {
    try {
      setCameraError(null);
      stopLiveCamera();

      if (Platform.OS === "web") {
        if (
          typeof navigator === "undefined" ||
          !navigator.mediaDevices?.getUserMedia
        ) {
          setCameraError("Camera is not supported on this platform.");
          setHasCameraPermission(false);
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: cameraFacingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        cameraStreamRef.current = stream;
        setHasCameraPermission(true);
        setIsCameraActive(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute("playsinline", "true");
          videoRef.current
            .play()
            .catch((e: any) =>
              console.warn("[WalletScreen] Video play error:", e),
            );
        }

        if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = setInterval(() => {
          captureAndScanFrame();
        }, 120);
      } else {
        // Native mobile platform (Android / iOS)
        try {
          if (typeof nativeRequestCameraPermissionsAsync === "function") {
            const res = await nativeRequestCameraPermissionsAsync();
            if (res && res.status === "granted") {
              setHasCameraPermission(true);
              setIsCameraActive(true);
            } else {
              setHasCameraPermission(false);
              setCameraError(
                "Camera permission was denied. Please allow camera access in your device settings to scan QR codes.",
              );
            }
          } else if (
            NativeCamera &&
            typeof NativeCamera.requestCameraPermissionsAsync === "function"
          ) {
            const res = await NativeCamera.requestCameraPermissionsAsync();
            if (res && res.status === "granted") {
              setHasCameraPermission(true);
              setIsCameraActive(true);
            } else {
              setHasCameraPermission(false);
              setCameraError(
                "Camera permission was denied. Please allow camera access in your device settings to scan QR codes.",
              );
            }
          } else {
            // Default to active for native camera runtime
            setHasCameraPermission(true);
            setIsCameraActive(true);
          }
        } catch (permErr: any) {
          console.warn(
            "[WalletScreen] Native camera permission request error:",
            permErr,
          );
          setHasCameraPermission(true);
          setIsCameraActive(true);
        }
      }
    } catch (err: any) {
      console.warn("[WalletScreen] Camera start error:", err);
      setHasCameraPermission(false);
      setCameraError(
        err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError"
          ? "Camera permission was denied. Please allow camera access in your browser or device settings."
          : err?.message || "Could not access device camera.",
      );
    }
  };

  const captureAndScanFrame = async () => {
    if (Platform.OS !== "web") return;
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return;

    // 1. Native BarcodeDetector (hardware accelerated on supported browsers)
    if (
      typeof window !== "undefined" &&
      typeof (window as any).BarcodeDetector !== "undefined"
    ) {
      try {
        const detector = new (window as any).BarcodeDetector({
          formats: ["qr_code"],
        });
        const detected = await detector.detect(video);
        if (detected && detected.length > 0 && detected[0].rawValue) {
          handleOnQrCodeScanned(detected[0].rawValue);
          return;
        }
      } catch (_) {}
    }

    // 2. Fallback pure jsQR frame analysis (browser DOM canvas)
    try {
      if (typeof document !== "undefined") {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, 640 / Math.max(width, height));
        canvas.width = Math.floor(width * scale);
        canvas.height = Math.floor(height * scale);
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const qrCode = jsQR(imgData.data, canvas.width, canvas.height, {
            inversionAttempts: "dontInvert",
          });
          if (qrCode && qrCode.data) {
            handleOnQrCodeScanned(qrCode.data);
          }
        }
      }
    } catch (_) {}
  };

  const handleOnQrCodeScanned = (rawCode: string) => {
    if (!rawCode || !rawCode.trim()) return;

    // 1. Stop camera stream immediately
    stopLiveCamera();

    // 2. Tactile vibration feedback
    try {
      Vibration.vibrate([0, 50, 40, 50]);
    } catch (_) {}

    // 3. Parse QR payload
    const parsed = parseQrPayload(rawCode);

    // 4. Resolve real recipient information
    const matchedRoommate = availableRoommates.find(
      (m) =>
        (parsed.uid && m.uid.toLowerCase() === parsed.uid.toLowerCase()) ||
        (parsed.email &&
          m.email &&
          m.email.toLowerCase() === parsed.email.toLowerCase()) ||
        (parsed.name && m.name.toLowerCase() === parsed.name.toLowerCase()),
    );

    const recipientData = matchedRoommate || {
      uid: parsed.uid || `user_${Date.now()}`,
      name: parsed.name || "Splitzy Resident",
      email: parsed.email || "",
      avatar: "",
      role: "MEMBER",
    };

    setScannedRecipient(recipientData);
    setQrTransferAmount(parsed.amount || "");
    setQrTransferNote(parsed.note || "Splitzy QR Payment");
    setQrFundingSource("wallet");
    setQrScanStep("confirm");
  };

  useEffect(() => {
    if (
      showScanQrModal &&
      qrModalTab === "scan" &&
      qrScanStep === "viewfinder"
    ) {
      startLiveCamera();
    } else {
      stopLiveCamera();
    }
    return () => {
      stopLiveCamera();
    };
  }, [showScanQrModal, qrModalTab, qrScanStep, cameraFacingMode]);

  const toggleCameraFacingMode = () => {
    setCameraFacingMode((prev) =>
      prev === "environment" ? "user" : "environment",
    );
  };

  const handleOpenScanQrModal = (initialTab: "scan" | "receive" = "scan") => {
    setQrModalTab(initialTab);
    setQrScanStep("viewfinder");
    setScannedRecipient(null);
    setQrTransferAmount("");
    setQrTransferNote("");
    setQrFundingSource("wallet");
    setQrReceipt(null);
    setShowPresetEditor(false);
    setCopiedPayLink(false);
    setShowManualInput(false);
    setManualCodeInput("");
    setShowScanQrModal(true);
  };

  const handleSelectRoommateToTransfer = (
    roommate: {
      uid: string;
      name: string;
      email?: string;
      avatar?: string;
      role?: string;
    },
    defaultPresetAmt?: string,
    defaultNote?: string,
  ) => {
    try {
      Vibration.vibrate(40);
    } catch (_) {}
    setScannedRecipient(roommate);
    setQrTransferAmount(defaultPresetAmt || "");
    setQrTransferNote(defaultNote || "Splitzy QR Payment");
    setQrFundingSource("wallet");
    setQrScanStep("confirm");
  };

  const handlePickQrImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 1.0,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setIsDecodingImage(true);

        // Native Mobile Path (iOS & Android): No DOM dependencies, 100% resilient
        if (Platform.OS !== "web") {
          try {
            // A. Attempt native hardware/OS barcode URL scan if available
            if (typeof nativeScanFromURLAsync === "function") {
              try {
                const scanned = await nativeScanFromURLAsync(asset.uri, ["qr"]);
                if (scanned && scanned.length > 0 && scanned[0].data) {
                  setIsDecodingImage(false);
                  handleOnQrCodeScanned(scanned[0].data);
                  return;
                }
              } catch (_) {}
            }

            // B. Pure TypeScript image decode via raw base64 bytes + jsQR
            let rawBytes: Uint8Array | null = null;
            if (asset.base64) {
              rawBytes = base64ToUint8Array(asset.base64);
            }

            if (rawBytes && rawBytes.length > 0) {
              const decoded = decodePixelsFromBytes(rawBytes);
              if (decoded && decoded.width && decoded.height) {
                const qrCode = jsQR(
                  decoded.data,
                  decoded.width,
                  decoded.height,
                );
                if (qrCode && qrCode.data) {
                  setIsDecodingImage(false);
                  handleOnQrCodeScanned(qrCode.data);
                  return;
                }
              }
            }

            setIsDecodingImage(false);
            Alert.alert(
              "No QR Code Detected",
              "No valid QR code was detected in the selected image. Please make sure the QR code is clearly visible and well-lit, or use the camera to scan directly.",
            );
          } catch (nativeErr: any) {
            console.warn(
              "[WalletScreen] Native image decode error:",
              nativeErr,
            );
            setIsDecodingImage(false);
            Alert.alert(
              "Decoding Failed",
              "Could not read QR code from this image. Please try another photo or scan directly with the camera.",
            );
          }
          return;
        }

        // Web Path: DOM Image and Canvas
        if (
          typeof window !== "undefined" &&
          typeof (window as any).Image !== "undefined"
        ) {
          const img = new (window as any).Image();
          img.crossOrigin = "anonymous";
          img.src = asset.uri;

          img.onload = () => {
            try {
              if (typeof document !== "undefined") {
                const canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext("2d", {
                  willReadFrequently: true,
                });
                if (!ctx) {
                  setIsDecodingImage(false);
                  Alert.alert(
                    "Scan Error",
                    "Could not initialize image processor.",
                  );
                  return;
                }
                ctx.drawImage(img, 0, 0);
                const imgData = ctx.getImageData(0, 0, img.width, img.height);
                const qrCode = jsQR(imgData.data, img.width, img.height);

                setIsDecodingImage(false);
                if (qrCode && qrCode.data) {
                  handleOnQrCodeScanned(qrCode.data);
                } else {
                  Alert.alert(
                    "No QR Code Detected",
                    "No valid QR code was detected in the selected image. Please make sure the QR code is clearly visible and well-lit, or use the camera to scan directly.",
                  );
                }
              }
            } catch (e: any) {
              console.warn("[WalletScreen] Image decode error:", e);
              setIsDecodingImage(false);
              Alert.alert(
                "Decoding Failed",
                "Could not read QR code from this image. Please try another photo.",
              );
            }
          };

          img.onerror = () => {
            setIsDecodingImage(false);
            Alert.alert(
              "Image Error",
              "Could not load the selected image for QR scanning.",
            );
          };
        } else {
          setIsDecodingImage(false);
          Alert.alert(
            "Notice",
            "Image scanning is not supported in this environment.",
          );
        }
      }
    } catch (err) {
      console.warn("[WalletScreen] Image picker QR error:", err);
      setIsDecodingImage(false);
      Alert.alert(
        "Photo Gallery Error",
        "Could not open photo library to read QR code.",
      );
    }
  };

  const handleDownloadQrPng = async () => {
    try {
      setIsDownloadingQrPng(true);
      const res = await downloadQrCodePng({
        value: myQrPayload,
        name: myDisplayName,
        email: myEmail,
        amount: presetAmount,
        note: presetNote,
        initials: myDisplayName,
      });
      if (res.success) {
        Alert.alert(
          "QR Code Downloaded",
          "Your Splitzy payment QR code has been saved as a high-resolution PNG image.",
        );
      } else {
        Alert.alert("Notice", res.message || "Could not save QR code.");
      }
    } catch (err: any) {
      Alert.alert(
        "Download Error",
        err?.message || "Failed to download QR code.",
      );
    } finally {
      setIsDownloadingQrPng(false);
    }
  };

  const handleCopyMyPayLink = async () => {
    try {
      await Clipboard.setStringAsync(myQrPayload);
      try {
        Vibration.vibrate(30);
      } catch (_) {}
      setCopiedPayLink(true);
      setTimeout(() => setCopiedPayLink(false), 2200);
    } catch (err) {
      console.warn("Failed to copy pay link:", err);
    }
  };

  const handleExecuteQrTransfer = async () => {
    if (!scannedRecipient) return;
    const numAmount = parseFloat(qrTransferAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert(
        "Invalid Amount",
        "Please enter a valid transfer amount greater than ₱0.00.",
      );
      return;
    }

    let sourceLabel = "Available Balance";
    let sourceBal = wallet?.balance || 0;
    if (qrFundingSource !== "wallet") {
      const card = wallet?.cards.find((c) => c.id === qrFundingSource);
      if (!card) {
        Alert.alert(
          "Funding Source Error",
          "Selected payment card was not found.",
        );
        return;
      }
      sourceBal = card.balance || 0;
      sourceLabel = card.name;
    }

    if (sourceBal < numAmount) {
      Alert.alert(
        "Insufficient Balance",
        `You need ₱${numAmount.toFixed(2)} but ${sourceLabel} only has ₱${sourceBal.toFixed(2)} available.`,
      );
      return;
    }

    setIsProcessingQrTransfer(true);
    try {
      const res = await walletService.transferViaQr({
        senderUid: currentUid,
        senderName: myDisplayName,
        recipientUid: scannedRecipient.uid,
        recipientName: scannedRecipient.name,
        amount: numAmount,
        fundingSourceId: qrFundingSource,
        note: qrTransferNote,
      });

      if (!res.success) {
        Alert.alert("Transfer Failed", res.message);
        setIsProcessingQrTransfer(false);
        return;
      }

      try {
        Vibration.vibrate([0, 50, 40, 50]);
      } catch (_) {}

      setQrReceipt({
        refNumber: res.referenceNumber,
        amount: numAmount,
        recipientName: scannedRecipient.name,
        sourceName: sourceLabel,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        note: qrTransferNote.trim(),
      });
      setQrScanStep("receipt");
    } catch (err: any) {
      console.warn("[WalletScreen] QR Transfer error:", err);
      Alert.alert(
        "Transfer Error",
        err?.message || "An error occurred while transferring funds.",
      );
    } finally {
      setIsProcessingQrTransfer(false);
    }
  };

  const [showAnalyticsModal, setShowAnalyticsModal] = useState<boolean>(false);

  const [showLimitsModal, setShowLimitsModal] = useState<boolean>(false);
  const [dailyOnlineLimit, setDailyOnlineLimit] = useState<string>("15000");
  const [isCardLocked, setIsCardLocked] = useState<boolean>(false);
  const [allowContactless, setAllowContactless] = useState<boolean>(true);

  const [showAddPocketModal, setShowAddPocketModal] = useState<boolean>(false);
  const [pocketName, setPocketName] = useState<string>("");
  const [pocketTarget, setPocketTarget] = useState<string>("");
  const [pocketCategory, setPocketCategory] = useState<
    "emergency" | "travel" | "bills" | "deposit" | "personal"
  >("emergency");

  const [selectedPocket, setSelectedPocket] = useState<SavingsPocket | null>(
    null,
  );
  const [showPocketActionModal, setShowPocketActionModal] =
    useState<boolean>(false);
  const [pocketActionType, setPocketActionType] = useState<
    "deposit" | "withdraw"
  >("deposit");
  const [pocketTransferAmount, setPocketTransferAmount] =
    useState<string>("500");
  const [pocketSelectedCardId, setPocketSelectedCardId] = useState<string>("");

  // Cash on Hand & Finance Automation State
  const [cashRules, setCashRules] =
    useState<CashAutomationRule[]>(DEFAULT_CASH_RULES);
  const [showCashAutomationModal, setShowCashAutomationModal] =
    useState<boolean>(false);
  const [showCashExpenseModal, setShowCashExpenseModal] =
    useState<boolean>(false);
  const [selectedCashCardId, setSelectedCashCardId] = useState<string>("");
  const [cashExpenseAmount, setCashExpenseAmount] = useState<string>("35");
  const [cashExpenseTitle, setCashExpenseTitle] = useState<string>(
    "Jeepney / Tricycle Fare",
  );
  const [cashExpenseCategory, setCashExpenseCategory] =
    useState<string>("Commute");
  const [isExecutingCashAuto, setIsExecutingCashAuto] =
    useState<boolean>(false);
  const [isRecordingCashExpense, setIsRecordingCashExpense] =
    useState<boolean>(false);

  const [selectedTx, setSelectedTx] = useState<AppWalletTransaction | null>(
    null,
  );
  const [isEditingTxNote, setIsEditingTxNote] = useState<boolean>(false);
  const [editedTxNoteText, setEditedTxNoteText] = useState<string>("");
  const [isSavingTxNote, setIsSavingTxNote] = useState<boolean>(false);
  const [isDeletingTx, setIsDeletingTx] = useState<boolean>(false);
  const [txFilter, setTxFilter] = useState<
    "all" | "cash_in" | "payment" | "savings"
  >("all");

  // Quick Expense Simulator State
  const [showExpenseSimModal, setShowExpenseSimModal] =
    useState<boolean>(false);
  const [selectedExpensePreset, setSelectedExpensePreset] =
    useState<QuickExpensePreset | null>(null);
  const [simCardId, setSimCardId] = useState<string>("");
  const [simAmount, setSimAmount] = useState<string>("");
  const [simNote, setSimNote] = useState<string>("");
  const [customExpenseTitle, setCustomExpenseTitle] = useState<string>("");
  const [activeSimCardId, setActiveSimCardId] = useState<string>("");
  const [isSimulatingExpense, setIsSimulatingExpense] =
    useState<boolean>(false);

  // Card-to-Card Transfer State
  const [showTransferModal, setShowTransferModal] = useState<boolean>(false);
  const [transferSourceCardId, setTransferSourceCardId] = useState<string>("");
  const [transferDestCardId, setTransferDestCardId] = useState<string>("");
  const [transferAmount, setTransferAmount] = useState<string>("");
  const [transferNote, setTransferNote] = useState<string>("");
  const [isTransferring, setIsTransferring] = useState<boolean>(false);

  // Walkthrough State
  const [showWalkthroughModal, setShowWalkthroughModal] =
    useState<boolean>(false);
  const [walkthroughStep, setWalkthroughStep] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    walletService.isWalkthroughCompleted(currentUid).then((completed) => {
      if (isMounted && !completed) {
        setShowWalkthroughModal(true);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [currentUid]);

  const handleFinishWalkthrough = async (
    action?: "cash_in" | "add_card" | "add_pocket",
  ) => {
    await walletService.setWalkthroughCompleted(currentUid, true);
    setShowWalkthroughModal(false);
    setWalkthroughStep(0);
    if (action === "cash_in") {
      handleOpenCashIn();
    } else if (action === "add_card") {
      setShowAddCardModal(true);
    } else if (action === "add_pocket") {
      setShowAddPocketModal(true);
    }
  };

  useEffect(() => {
    setLoading(true);
    const unsubscribe = walletService.listenToWallet(currentUid, (state) => {
      setWallet(state);
      setLoading(false);
    });
    return unsubscribe;
  }, [currentUid]);

  const handleOpenCashIn = () => {
    if (!wallet?.cards || wallet.cards.length === 0) {
      Alert.alert(
        "No Card Configured",
        "Please link a payment method (GCash, Maya, or bank card) first before adding funds to your wallet.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Add Card Now",
            onPress: () => setShowAddCardModal(true),
          },
        ],
      );
      return;
    }
    const defaultCard =
      wallet.cards.find((c) => c.isDefault) || wallet.cards[0];
    setSelectedCashInCardId(defaultCard.id);
    setCashInMethod(defaultCard.name);
    setCashInSource("");
    setShowCashInModal(true);
  };

  const handleCashIn = async () => {
    const num = parseFloat(cashInAmount);
    if (isNaN(num) || num <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid amount to cash in.");
      return;
    }

    try {
      const targetCardId =
        selectedCashInCardId || wallet?.cards?.[0]?.id || cashInMethod;
      const cleanSource = cashInSource.trim();
      const updated = await walletService.cashIn(
        currentUid,
        num,
        targetCardId,
        cleanSource || undefined,
      );
      setWallet(updated);
      setShowCashInModal(false);
      setCashInAmount("1000");
      setCashInSource("");
      const matched = updated.cards.find((c) => c.id === targetCardId);
      const cardTitle = matched ? matched.name : cashInMethod;
      const sourceSuffix = cleanSource ? ` from ${cleanSource}` : "";
      Alert.alert(
        "Top-up Successful",
        `₱${num.toLocaleString()} has been added${sourceSuffix} to ${cardTitle}. Total Available Digital Balance updated!`,
      );
    } catch (e: any) {
      Alert.alert("Top-up Failed", e?.message || "Could not complete top up.");
    }
  };

  const handlePromptDeleteCard = (card: PaymentCard) => {
    setSelectedCardToDelete(card);
    setDeleteCardConfirmText("");
    setShowDeleteCardModal(true);
  };

  const handleConfirmDeleteCard = async () => {
    if (!selectedCardToDelete) return;
    const required = selectedCardToDelete.name.trim().toLowerCase();
    const typed = deleteCardConfirmText.trim().toLowerCase();

    if (typed !== required) {
      Alert.alert(
        "Security Question Mismatch",
        `Please type "${selectedCardToDelete.name}" exactly to confirm deleting this card.`,
      );
      return;
    }

    setIsDeletingCard(true);
    try {
      const updated = await walletService.deletePaymentCard(
        currentUid,
        selectedCardToDelete.id,
      );
      setWallet(updated);
      setShowDeleteCardModal(false);
      setSelectedCardToDelete(null);
      setDeleteCardConfirmText("");
      Alert.alert(
        "Card Removed",
        `"${selectedCardToDelete.name}" has been permanently removed from your wallet.`,
      );
    } catch (e: any) {
      Alert.alert("Deletion Failed", e?.message || "Could not delete card.");
    } finally {
      setIsDeletingCard(false);
    }
  };

  const handleStartEditTxNote = () => {
    if (!selectedTx) return;
    const currentNote =
      selectedTx.note ||
      (!selectedTx.description?.startsWith("Daily simulated expense") &&
      !selectedTx.description?.startsWith("Added ₱") &&
      !selectedTx.description?.startsWith("Transferred ₱")
        ? selectedTx.description
        : "") ||
      (selectedTx.type === "cash_in" ? (selectedTx as any)?.source : "");
    setEditedTxNoteText(currentNote || "");
    setIsEditingTxNote(true);
  };

  const handleSaveTxNote = async () => {
    if (!selectedTx) return;
    try {
      setIsSavingTxNote(true);
      const clean = editedTxNoteText.trim();
      const res = await walletService.updateTransactionNote(
        currentUid,
        selectedTx.id,
        clean,
      );
      if (res.success) {
        setWallet(res.updatedState);
        const refreshedTx = res.updatedState.transactions.find(
          (t) => t.id === selectedTx.id,
        );
        if (refreshedTx) {
          setSelectedTx(refreshedTx);
        } else {
          setSelectedTx({
            ...selectedTx,
            note: clean || undefined,
            description: clean || selectedTx.description,
          });
        }
        setIsEditingTxNote(false);
        Alert.alert(
          "Note Updated",
          "Transaction note has been saved permanently.",
        );
      } else {
        Alert.alert("Update Failed", res.message);
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not save note.");
    } finally {
      setIsSavingTxNote(false);
    }
  };

  const handleDeleteSelectedTx = () => {
    if (!selectedTx) return;
    Alert.alert(
      "Delete Transaction",
      `Are you sure you want to delete this ${selectedTx.title} record (₱${(selectedTx.amount ?? 0).toLocaleString()})? Your wallet balance will automatically adjust.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete & Adjust Balance",
          style: "destructive",
          onPress: async () => {
            try {
              setIsDeletingTx(true);
              const res = await walletService.deleteTransaction(
                currentUid,
                selectedTx.id,
              );
              if (res.success) {
                setWallet(res.updatedState);
                setSelectedTx(null);
                setIsEditingTxNote(false);
                Alert.alert("Deleted", res.message);
              } else {
                Alert.alert("Error", res.message);
              }
            } catch (e: any) {
              Alert.alert(
                "Error",
                e?.message || "Could not delete transaction.",
              );
            } finally {
              setIsDeletingTx(false);
            }
          },
        },
      ],
    );
  };

  const handleSendMoney = async () => {
    const num = parseFloat(sendAmount);
    if (isNaN(num) || num <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid transfer amount.");
      return;
    }
    const card =
      wallet?.cards.find((c) => c.id === sendSelectedCardId) ||
      wallet?.cards[0];
    if (!card) {
      Alert.alert("No Card", "Please select a funding card.");
      return;
    }
    if ((card.balance || 0) < num) {
      Alert.alert(
        "Insufficient Funds",
        `${card.name} only has ₱${(card.balance || 0).toLocaleString()} available.`,
      );
      return;
    }

    const res = await walletService.deductForDebtSettlement(
      currentUid,
      num,
      sendRecipient.trim() || "Roommate Alex",
      undefined,
      card.name,
    );
    if (res.success) {
      setWallet(res.updatedState);
      setShowSendMoneyModal(false);
      setSendAmount("500");
      setSendNote("");
      Alert.alert(
        "Transfer Complete",
        `Sent ₱${num.toLocaleString()} to ${sendRecipient.trim() || "Roommate Alex"} via ${card.name}!`,
      );
    } else {
      Alert.alert("Transfer Failed", res.message);
    }
  };

  const handleCreateSplitRequest = () => {
    const num = parseFloat(splitAmount);
    if (isNaN(num) || num <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid split amount.");
      return;
    }
    const perPerson = (num / splitNumPeople).toFixed(2);
    setShowRequestSplitModal(false);
    Alert.alert(
      "Split Request Created",
      `Created request for "${splitTitle || "Household Split"}" (₱${num.toLocaleString()}). Each of the ${splitNumPeople} roommates requested for ₱${perPerson}.`,
    );
  };

  const handleAddCard = async () => {
    if (!newCardNumber.trim()) {
      Alert.alert("Missing Detail", "Please enter account or card digits.");
      return;
    }

    const preset =
      PHILIPPINE_CARD_PRESETS[newCardType] || PHILIPPINE_CARD_PRESETS.custom;

    const cleanNum = newCardNumber.trim();
    const masked =
      newCardType === "gcash"
        ? cleanNum.startsWith("09")
          ? cleanNum.substring(0, 4) +
            " ••• " +
            cleanNum.substring(cleanNum.length - 4)
          : "09•• ••• " + cleanNum.slice(-4)
        : "•••• " + cleanNum.slice(-4);

    const parsedBalance = parseFloat(newCardBalance) || 0;

    try {
      const updated = await walletService.addPaymentCard(currentUid, {
        type: newCardType,
        name: newCardName.trim() || preset.name,
        accountNumber: masked,
        cardholderName:
          newCardHolder.trim() || currentUser?.name || "Account Owner",
        colorGradient: preset.gradient,
        isDefault: (wallet?.cards.length || 0) === 0,
        expiry: preset.isEWallet ? undefined : "12/28",
        balance: Math.max(0, parsedBalance),
      });
      setWallet(updated);
      setShowAddCardModal(false);
      setNewCardName("");
      setNewCardNumber("");
      setNewCardHolder("");
      setNewCardBalance("5000");
      Alert.alert(
        "Card Added",
        `Linked ${newCardName.trim() || preset.name} with ₱${parsedBalance.toLocaleString()} balance. Total Available Digital Balance updated!`,
      );
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not add payment card.");
    }
  };

  const handleCreatePocket = async () => {
    const targetNum = parseFloat(pocketTarget);
    if (!pocketName.trim() || isNaN(targetNum) || targetNum <= 0) {
      Alert.alert(
        "Incomplete Details",
        "Please enter goal name and target amount.",
      );
      return;
    }

    const icons: Record<string, string> = {
      emergency: "shield-checkmark",
      travel: "airplane",
      bills: "receipt",
      deposit: "home",
      personal: "heart",
    };

    const colorsPreset: Record<string, string> = {
      emergency: "#2563EB",
      travel: "#059669",
      bills: "#D97706",
      deposit: "#7C3AED",
      personal: "#DB2777",
    };

    try {
      const updated = await walletService.createSavingsPocket(currentUid, {
        name: pocketName.trim(),
        targetAmount: targetNum,
        currentAmount: 0,
        color: colorsPreset[pocketCategory] || "#2563EB",
        icon: icons[pocketCategory] || "shield-checkmark",
        category: pocketCategory,
      });
      setWallet(updated);
      setShowAddPocketModal(false);
      setPocketName("");
      setPocketTarget("");
      Alert.alert(
        "Goal Created",
        `"${pocketName}" savings pocket is now active.`,
      );
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not create pocket.");
    }
  };

  const handlePocketTransfer = async () => {
    if (!selectedPocket) return;
    const num = parseFloat(pocketTransferAmount);
    if (isNaN(num) || num <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid amount.");
      return;
    }

    if (pocketActionType === "deposit") {
      const result = await walletService.depositToPocket(
        currentUid,
        selectedPocket.id,
        num,
        pocketSelectedCardId || undefined,
      );
      if (result.success) {
        setWallet(result.updatedState);
        setShowPocketActionModal(false);
        Alert.alert("Deposit Saved", result.message);
      } else {
        Alert.alert("Action Failed", result.message);
      }
    } else {
      const result = await walletService.withdrawFromPocket(
        currentUid,
        selectedPocket.id,
        num,
        pocketSelectedCardId || undefined,
      );
      if (result.success) {
        setWallet(result.updatedState);
        setShowPocketActionModal(false);
        Alert.alert("Withdrawal Complete", result.message);
      } else {
        Alert.alert("Action Failed", result.message);
      }
    }
  };

  const handleOpenCashExpense = (cashCardId?: string) => {
    const cashCard =
      wallet?.cards.find((c) =>
        cashCardId ? c.id === cashCardId : c.type === "cash",
      ) || wallet?.cards[0];

    if (!cashCard) {
      Alert.alert(
        "No Payment Card",
        "Please link a card or add Cash on Hand first.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Add Cash Card",
            onPress: () => {
              setNewCardType("cash");
              setNewCardName("Cash on Hand");
              setNewCardNumber("SN-2026-PH-CASH");
              setShowAddCardModal(true);
            },
          },
        ],
      );
      return;
    }

    setSelectedCashCardId(cashCard.id);
    setCashExpenseTitle("Jeepney / Tricycle Fare");
    setCashExpenseAmount("25");
    setCashExpenseCategory("Commute");
    setShowCashExpenseModal(true);
  };

  const handleOpenCashAutomation = (cashCardId?: string) => {
    const cashCard =
      wallet?.cards.find((c) =>
        cashCardId ? c.id === cashCardId : c.type === "cash",
      ) || wallet?.cards[0];

    if (!cashCard) {
      Alert.alert(
        "Cash on Hand Needed",
        "To automate cash expenses and finance cash on hand, please add a Cash Card first.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Add Cash Card",
            onPress: () => {
              setNewCardType("cash");
              setNewCardName("Cash on Hand");
              setNewCardNumber("SN-2026-PH-CASH");
              setShowAddCardModal(true);
            },
          },
        ],
      );
      return;
    }

    setSelectedCashCardId(cashCard.id);
    setShowCashAutomationModal(true);
  };

  const handleExecuteCashExpense = async () => {
    if (!selectedCashCardId) return;
    const amt = parseFloat(cashExpenseAmount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid expense amount.");
      return;
    }

    setIsRecordingCashExpense(true);
    try {
      const res = await walletService.recordCashExpense(
        currentUid,
        selectedCashCardId,
        amt,
        cashExpenseTitle.trim() || "Cash Expense",
        cashExpenseCategory,
      );
      if (res.success) {
        setWallet(res.updatedState);
        setShowCashExpenseModal(false);
        Alert.alert("Cash Expense Recorded", res.message);
      } else {
        Alert.alert("Recording Failed", res.message);
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not record cash expense.");
    } finally {
      setIsRecordingCashExpense(false);
    }
  };

  const handleRunCashAutoExpenses = async () => {
    const cashCard =
      wallet?.cards.find((c) => c.id === selectedCashCardId) ||
      wallet?.cards.find((c) => c.type === "cash") ||
      wallet?.cards[0];

    if (!cashCard) {
      Alert.alert("Error", "No Cash on Hand card found.");
      return;
    }

    setIsExecutingCashAuto(true);
    try {
      const res = await walletService.runAutomatedCashExpenses(
        currentUid,
        cashCard.id,
        cashRules,
      );
      if (res.success) {
        setWallet(res.updatedState);
        Alert.alert("⚡ Cash Automation Complete", res.message);
      } else {
        Alert.alert("Automation Paused", res.message);
      }
    } catch (e: any) {
      Alert.alert(
        "Error",
        e?.message || "Could not run automated cash expenses.",
      );
    } finally {
      setIsExecutingCashAuto(false);
    }
  };

  const handleToggleCashRule = (ruleId: string) => {
    setCashRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r)),
    );
  };

  const handleOpenTransfer = (preselectedSourceCardId?: string) => {
    if (!wallet?.cards || wallet.cards.length < 2) {
      Alert.alert(
        "Multiple Cards Required",
        "You need at least 2 linked cards or accounts to transfer money between them. Please link another card first.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Add Card",
            onPress: () => setShowAddCardModal(true),
          },
        ],
      );
      return;
    }
    const fromId =
      preselectedSourceCardId ||
      wallet.cards.find((c) => c.isDefault)?.id ||
      wallet.cards[0].id;
    const toCard = wallet.cards.find((c) => c.id !== fromId) || wallet.cards[0];

    setTransferSourceCardId(fromId);
    setTransferDestCardId(toCard.id);
    setTransferAmount("");
    setTransferNote("");
    setShowTransferModal(true);
  };

  const handleExecuteTransfer = async () => {
    const amt = parseFloat(transferAmount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert(
        "Invalid Amount",
        "Please enter a valid transfer amount greater than ₱0.",
      );
      return;
    }

    if (!transferSourceCardId || !transferDestCardId) {
      Alert.alert(
        "Selection Required",
        "Please select both source and destination cards.",
      );
      return;
    }

    if (transferSourceCardId === transferDestCardId) {
      Alert.alert(
        "Invalid Destination",
        "Source and destination cards must be different accounts.",
      );
      return;
    }

    const sourceCard = wallet?.cards.find((c) => c.id === transferSourceCardId);
    if (!sourceCard || (sourceCard.balance || 0) < amt) {
      Alert.alert(
        "Insufficient Balance",
        `Selected source card only has ₱${(
          sourceCard?.balance || 0
        ).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} available.`,
      );
      return;
    }

    try {
      setIsTransferring(true);
      const res = await walletService.transferBetweenCards(
        currentUid,
        transferSourceCardId,
        transferDestCardId,
        amt,
        transferNote,
      );
      if (res.success) {
        setWallet(res.updatedState);
        setShowTransferModal(false);
        Alert.alert("Transfer Complete", res.message);
      } else {
        Alert.alert("Transfer Failed", res.message);
      }
    } catch (e: any) {
      Alert.alert(
        "Transfer Error",
        e?.message || "Could not complete transfer.",
      );
    } finally {
      setIsTransferring(false);
    }
  };

  const handleQuickCirclePress = (preset: QuickExpensePreset) => {
    if (!wallet?.cards || wallet.cards.length === 0) {
      Alert.alert(
        "No Card Linked",
        "Please link a payment card first before simulating everyday expenses.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Add Card",
            onPress: () => setShowAddCardModal(true),
          },
        ],
      );
      return;
    }

    setSelectedExpensePreset(preset);
    setSimAmount(String(preset.amount));
    setSimNote(preset.defaultNote);
    setCustomExpenseTitle(
      preset.id === "custom" ? "Custom Expense" : preset.title,
    );
    const targetCardId =
      activeSimCardId && wallet.cards.some((c) => c.id === activeSimCardId)
        ? activeSimCardId
        : wallet.cards.find((c) => c.isDefault)?.id || wallet.cards[0].id;
    setSimCardId(targetCardId);
    setShowExpenseSimModal(true);
  };

  const handleExecuteSimulatedExpense = async () => {
    if (!selectedExpensePreset) return;
    const amt = parseFloat(simAmount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert(
        "Invalid Amount",
        "Please enter a valid expense amount greater than ₱0.",
      );
      return;
    }

    const card = wallet?.cards.find((c) => c.id === simCardId);
    if (!card) {
      Alert.alert(
        "Card Not Selected",
        "Please select a payment card to deduct the expense from.",
      );
      return;
    }

    if ((card.balance || 0) < amt) {
      Alert.alert(
        "Insufficient Card Balance",
        `Selected card ${card.name} only has ₱${(
          card.balance || 0
        ).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} available. Please top up or choose another card.`,
      );
      return;
    }

    const finalTitle =
      selectedExpensePreset.id === "custom" && customExpenseTitle.trim()
        ? customExpenseTitle.trim()
        : selectedExpensePreset.title;
    const cleanNote = simNote.trim();
    const finalIcon =
      selectedExpensePreset.id === "custom"
        ? getExpenseSemanticIconMobile({
            title: finalTitle,
            note: cleanNote,
            type: "expense_simulation",
          }).icon
        : selectedExpensePreset.icon === "cart"
          ? "basket"
          : selectedExpensePreset.icon;

    try {
      setIsSimulatingExpense(true);
      const res = await walletService.simulateCardExpense(
        currentUid,
        simCardId,
        amt,
        finalTitle,
        finalIcon,
        cleanNote,
      );
      if (res.success) {
        setWallet(res.updatedState);
        setShowExpenseSimModal(false);
        setSimNote("");
        setCustomExpenseTitle("");
        Alert.alert("Expense Simulated", res.message);
      } else {
        Alert.alert("Simulation Failed", res.message);
      }
    } catch (e: any) {
      Alert.alert(
        "Simulation Error",
        e?.message || "Could not simulate expense.",
      );
    } finally {
      setIsSimulatingExpense(false);
    }
  };

  const handleCardPress = (card: PaymentCard) => {
    setSelectedCardDetail(card);
    setShowCardDetailModal(true);
  };

  const handleSetDefaultCard = async (card: PaymentCard) => {
    try {
      const updated = await walletService.setDefaultCard(currentUid, card.id);
      setWallet(updated);
      setSelectedCardDetail((prev) =>
        prev ? { ...prev, isDefault: true } : null,
      );
      Alert.alert(
        "Primary Method Updated",
        `${card.name} is now your default payment method.`,
      );
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not update default card.");
    }
  };

  const filteredTransactions = (wallet?.transactions || []).filter((tx) => {
    if (txFilter === "all") return true;
    if (txFilter === "cash_in") return tx.type === "cash_in";
    if (txFilter === "payment")
      return (
        tx.type === "bill_payment" ||
        tx.type === "debt_settlement" ||
        tx.type === "expense_simulation" ||
        tx.type === "card_transfer" ||
        tx.type === "cash_expense"
      );
    if (txFilter === "savings")
      return tx.type === "savings_deposit" || tx.type === "savings_withdrawal";
    return true;
  });

  if (loading && !wallet) {
    return (
      <View
        style={[
          styles.centerContainer,
          { backgroundColor: isDark ? colors.background : "#F8FAFC" },
        ]}
      >
        <ActivityIndicator size="large" color="#2563EB" />
        <Text
          style={[
            styles.loadingText,
            { color: isDark ? colors.textMuted : "#64748B" },
          ]}
        >
          Loading Splitzy Wallet...
        </Text>
      </View>
    );
  }

  const balance =
    (wallet?.cards || []).length > 0
      ? (wallet?.cards || []).reduce((sum, c) => sum + (c.balance || 0), 0)
      : (wallet?.balance ?? 0);

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: isDark ? colors.background : "#F8FAFC",
          paddingBottom: insets.bottom,
        },
      ]}
    >
      {/* Top App Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: isDark ? colors.card : "transparent",
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.headerTitle,
              { color: isDark ? colors.text : "#0F172A" },
            ]}
          >
            Splitzy Wallet
          </Text>
          <Text
            style={[
              styles.headerSubtitle,
              { color: isDark ? colors.textMuted : "#64748B" },
            ]}
          >
            Personal funds, cards & shared dues
          </Text>
        </View>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={[
              styles.headerTourBtn,
              {
                backgroundColor: isDark ? colors.surfaceInset : "#EFF6FF",
                borderColor: isDark ? colors.border : "#DBEAFE",
                borderWidth: 1,
              },
            ]}
            onPress={() => {
              setWalkthroughStep(0);
              setShowWalkthroughModal(true);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="sparkles" size={15} color="#2563EB" />
            <Text
              style={[
                styles.headerTourBtnText,
                { color: isDark ? "#60A5FA" : "#1D4ED8" },
              ]}
            >
              Tour
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.headerActionBtn,
              {
                backgroundColor: isDark ? colors.surfaceInset : "#F1F5F9",
                borderColor: isDark ? colors.border : "#E2E8F0",
                borderWidth: isDark ? 1 : 0,
              },
            ]}
            onPress={handleOpenCashIn}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={20} color="#2563EB" />
            <Text style={styles.headerActionBtnText}>Cash In</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(40, insets.bottom + 45) },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {/* 1. Hero Balance Banner */}
        <LinearGradient
          colors={isDark ? ["#1E293B", "#0F172A"] : ["#1E3A8A", "#2563EB"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroTopRow}>
            <View style={styles.heroTagRow}>
              <View style={styles.heroIndicatorDot} />
              <Text style={styles.heroLabel}>Available Balance</Text>
            </View>

            <TouchableOpacity
              onPress={() => setHideBalance(!hideBalance)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name={hideBalance ? "eye-off-outline" : "eye-outline"}
                size={20}
                color="#E2E8F0"
              />
            </TouchableOpacity>
          </View>

          <Text style={styles.heroBalance}>
            {hideBalance
              ? "₱ ••••••"
              : `₱${(balance ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </Text>

          <View style={styles.heroActionRow}>
            <TouchableOpacity
              style={styles.heroBtnPrimary}
              onPress={handleOpenCashIn}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-down-circle" size={18} color="#2563EB" />
              <Text style={styles.heroBtnPrimaryText}>Cash In</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.heroBtnSecondary}
              onPress={() => onNavigateToBills?.()}
              activeOpacity={0.8}
            >
              <Ionicons name="receipt-outline" size={17} color="#FFFFFF" />
              <Text style={styles.heroBtnSecondaryText}>Pay</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.heroBtnSecondary}
              onPress={() => onNavigateToSettle?.()}
              activeOpacity={0.8}
            >
              <Ionicons name="swap-horizontal" size={17} color="#FFFFFF" />
              <Text style={styles.heroBtnSecondaryText}>Settle</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* 2. Quick Circle Menu Icon Hub */}
        <View style={styles.quickCircleMenuContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickCircleScrollContent}
            style={styles.quickCircleScrollView}
          >
            <TouchableOpacity
              style={styles.quickCircleItem}
              onPress={() => {
                if (!wallet?.cards || wallet.cards.length === 0) {
                  Alert.alert(
                    "No Card Configured",
                    "Please link a payment card first before sending funds.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Add Card",
                        onPress: () => setShowAddCardModal(true),
                      },
                    ],
                  );
                  return;
                }
                setSendSelectedCardId(
                  wallet.cards.find((c) => c.isDefault)?.id ||
                    wallet.cards[0].id,
                );
                setShowSendMoneyModal(true);
              }}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.quickCircleBtn,
                  {
                    backgroundColor: isDark ? "#1E3A8A" : "#EFF6FF",
                    borderColor: isDark ? "#2563EB" : "#BFDBFE",
                  },
                ]}
              >
                <Ionicons
                  name="paper-plane"
                  size={20}
                  color={isDark ? "#60A5FA" : "#2563EB"}
                />
              </View>
              <Text
                style={[
                  styles.quickCircleLabel,
                  { color: isDark ? colors.text : "#0F172A" },
                ]}
              >
                Send
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickCircleItem}
              onPress={() => setShowRequestSplitModal(true)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.quickCircleBtn,
                  {
                    backgroundColor: isDark ? "#064E3B" : "#ECFDF5",
                    borderColor: isDark ? "#059669" : "#A7F3D0",
                  },
                ]}
              >
                <Ionicons
                  name="people"
                  size={20}
                  color={isDark ? "#34D399" : "#059669"}
                />
              </View>
              <Text
                style={[
                  styles.quickCircleLabel,
                  { color: isDark ? colors.text : "#0F172A" },
                ]}
              >
                Split
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickCircleItem}
              onPress={() => handleOpenTransfer()}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.quickCircleBtn,
                  {
                    backgroundColor: isDark ? "#312E81" : "#EEF2FF",
                    borderColor: isDark ? "#4F46E5" : "#C7D2FE",
                  },
                ]}
              >
                <Ionicons
                  name="swap-horizontal"
                  size={20}
                  color={isDark ? "#818CF8" : "#4F46E5"}
                />
              </View>
              <Text
                style={[
                  styles.quickCircleLabel,
                  { color: isDark ? colors.text : "#0F172A" },
                ]}
              >
                Transfer
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickCircleItem}
              onPress={() => handleOpenScanQrModal("scan")}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.quickCircleBtn,
                  {
                    backgroundColor: isDark ? "#581C87" : "#FAF5FF",
                    borderColor: isDark ? "#9333EA" : "#E9D5FF",
                  },
                ]}
              >
                <Ionicons
                  name="qr-code"
                  size={20}
                  color={isDark ? "#C084FC" : "#9333EA"}
                />
              </View>
              <Text
                style={[
                  styles.quickCircleLabel,
                  { color: isDark ? colors.text : "#0F172A" },
                ]}
              >
                Scan QR
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickCircleItem}
              onPress={() => setShowAnalyticsModal(true)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.quickCircleBtn,
                  {
                    backgroundColor: isDark ? "#78350F" : "#FFFBEB",
                    borderColor: isDark ? "#D97706" : "#FDE68A",
                  },
                ]}
              >
                <Ionicons
                  name="pie-chart"
                  size={20}
                  color={isDark ? "#FBBF24" : "#D97706"}
                />
              </View>
              <Text
                style={[
                  styles.quickCircleLabel,
                  { color: isDark ? colors.text : "#0F172A" },
                ]}
              >
                Analytics
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickCircleItem}
              onPress={() => setShowLimitsModal(true)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.quickCircleBtn,
                  {
                    backgroundColor: isDark ? "#1F2937" : "#F1F5F9",
                    borderColor: isDark ? "#4B5563" : "#CBD5E1",
                  },
                ]}
              >
                <Ionicons
                  name="shield-checkmark"
                  size={20}
                  color={isDark ? "#9CA3AF" : "#475569"}
                />
              </View>
              <Text
                style={[
                  styles.quickCircleLabel,
                  { color: isDark ? colors.text : "#0F172A" },
                ]}
              >
                Limits
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickCircleItem}
              onPress={() => handleOpenCashExpense()}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.quickCircleBtn,
                  {
                    backgroundColor: isDark ? "#064E3B" : "#ECFDF5",
                    borderColor: isDark ? "#059669" : "#A7F3D0",
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="cash-multiple"
                  size={20}
                  color={isDark ? "#34D399" : "#059669"}
                />
              </View>
              <Text
                style={[
                  styles.quickCircleLabel,
                  { color: isDark ? colors.text : "#0F172A" },
                ]}
              >
                Cash Spend
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickCircleItem}
              onPress={() => handleOpenCashAutomation()}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.quickCircleBtn,
                  {
                    backgroundColor: isDark ? "#065F46" : "#F0FDF4",
                    borderColor: isDark ? "#10B981" : "#BBF7D0",
                  },
                ]}
              >
                <Ionicons
                  name="flash-outline"
                  size={20}
                  color={isDark ? "#6EE7B7" : "#10B981"}
                />
              </View>
              <Text
                style={[
                  styles.quickCircleLabel,
                  { color: isDark ? colors.text : "#0F172A" },
                ]}
              >
                Cash Auto
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* 2.5 Quick Circles: Daily Expense Simulator */}
        <View
          style={[
            styles.quickExpenseSectionCard,
            {
              backgroundColor: isDark ? colors.card : "#FFFFFF",
              borderColor: isDark ? colors.border : "#E2E8F0",
            },
          ]}
        >
          <View style={styles.quickExpenseHeaderRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.quickExpenseTitleBadgeRow}>
                <Text
                  style={[
                    styles.quickExpenseTitle,
                    { color: isDark ? colors.text : "#0F172A" },
                  ]}
                >
                  Quick Expenses
                </Text>
              </View>
              <Text
                style={[
                  styles.quickExpenseSubtitle,
                  { color: isDark ? colors.textMuted : "#64748B" },
                ]}
              >
                Simulate everyday expenses & auto-deduct from linked cards
              </Text>
            </View>

            {/* Active Card Pill Selector */}
            {wallet?.cards && wallet.cards.length > 0 && (
              <TouchableOpacity
                style={[
                  styles.activeCardSelectorPill,
                  {
                    backgroundColor: isDark ? colors.surfaceInset : "#F8FAFC",
                    borderColor: isDark ? colors.border : "#E2E8F0",
                  },
                ]}
                onPress={() => {
                  if (wallet.cards.length <= 1) return;
                  const curId =
                    activeSimCardId ||
                    wallet.cards.find((c) => c.isDefault)?.id ||
                    wallet.cards[0].id;
                  const curIdx = wallet.cards.findIndex((c) => c.id === curId);
                  const nextIdx = (curIdx + 1) % wallet.cards.length;
                  setActiveSimCardId(wallet.cards[nextIdx].id);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="card" size={13} color="#2563EB" />
                <Text
                  style={[
                    styles.activeCardSelectorText,
                    { color: isDark ? colors.text : "#0F172A" },
                  ]}
                  numberOfLines={1}
                >
                  {(() => {
                    const c =
                      wallet.cards.find((cd) => cd.id === activeSimCardId) ||
                      wallet.cards.find((cd) => cd.isDefault) ||
                      wallet.cards[0];
                    return `${c.name.split(" ")[0]} · ₱${(c.balance || 0).toLocaleString()}`;
                  })()}
                </Text>
                {wallet.cards.length > 1 && (
                  <Ionicons
                    name="swap-vertical"
                    size={11}
                    color={isDark ? colors.textMuted : "#94A3B8"}
                  />
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Horizontal Scrollable Quick Circles */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickExpenseScrollContent}
            style={styles.quickExpenseScrollView}
          >
            {QUICK_EXPENSE_PRESETS.map((preset) => (
              <TouchableOpacity
                key={preset.id}
                style={styles.quickExpenseCircleItem}
                onPress={() => handleQuickCirclePress(preset)}
                activeOpacity={0.75}
              >
                <LinearGradient
                  colors={preset.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.quickExpenseCircleGradient}
                >
                  <Ionicons name={preset.icon} size={22} color="#FFFFFF" />
                </LinearGradient>
                <Text
                  style={[
                    styles.quickExpenseCircleName,
                    { color: isDark ? colors.text : "#0F172A" },
                  ]}
                  numberOfLines={1}
                >
                  {preset.title.split(" ")[0]}
                </Text>
                <View
                  style={[
                    styles.quickExpenseAmountPill,
                    {
                      backgroundColor: isDark ? colors.surfaceInset : "#EFF6FF",
                      borderColor: isDark ? colors.border : "#DBEAFE",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.quickExpenseAmountPillText,
                      { color: isDark ? "#60A5FA" : "#2563EB" },
                    ]}
                  >
                    ₱{preset.amount}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Quick Setup Checklist for Fresh Empty Wallets */}
        {balance === 0 &&
          (wallet?.cards || []).length === 0 &&
          (wallet?.pockets || []).length === 0 && (
            <View
              style={[
                styles.quickStartCard,
                {
                  backgroundColor: isDark ? colors.card : "#FFFFFF",
                  borderColor: isDark ? colors.border : "#E2E8F0",
                },
              ]}
            >
              <View style={styles.quickStartHeader}>
                <View style={styles.quickStartBadge}>
                  <Ionicons name="sparkles" size={13} color="#2563EB" />
                  <Text style={styles.quickStartBadgeText}>
                    NEW WALLET SETUP
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setWalkthroughStep(0);
                    setShowWalkthroughModal(true);
                  }}
                >
                  <Text style={styles.quickStartTourLink}>
                    View Walkthrough →
                  </Text>
                </TouchableOpacity>
              </View>

              <Text
                style={[
                  styles.quickStartTitle,
                  { color: isDark ? colors.text : "#0F172A" },
                ]}
              >
                Welcome! Your wallet starts at ₱0.00
              </Text>
              <Text
                style={[
                  styles.quickStartSubtitle,
                  { color: isDark ? colors.textMuted : "#64748B" },
                ]}
              >
                Splitzy Wallet is ready for your household. Get started in 3
                steps:
              </Text>

              <View style={styles.quickStepsList}>
                <TouchableOpacity
                  style={[
                    styles.quickStepItem,
                    {
                      backgroundColor: isDark ? colors.surfaceInset : "#F8FAFC",
                      borderColor: isDark ? colors.border : "#E2E8F0",
                      borderWidth: 1,
                    },
                  ]}
                  onPress={handleOpenCashIn}
                  activeOpacity={0.7}
                >
                  <View style={styles.quickStepNumberWrap}>
                    <Text style={styles.quickStepNumber}>1</Text>
                  </View>
                  <View style={styles.quickStepTextCol}>
                    <Text
                      style={[
                        styles.quickStepTitle,
                        { color: isDark ? colors.text : "#0F172A" },
                      ]}
                    >
                      Top up your initial balance
                    </Text>
                    <Text
                      style={[
                        styles.quickStepDesc,
                        { color: isDark ? colors.textMuted : "#64748B" },
                      ]}
                    >
                      Add funds via GCash, Maya, or bank transfer for split
                      payments.h
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={isDark ? colors.textMuted : "#94A3B8"}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.quickStepItem,
                    {
                      backgroundColor: isDark ? colors.surfaceInset : "#F8FAFC",
                      borderColor: isDark ? colors.border : "#E2E8F0",
                      borderWidth: 1,
                    },
                  ]}
                  onPress={() => setShowAddCardModal(true)}
                  activeOpacity={0.7}
                >
                  <View style={styles.quickStepNumberWrap}>
                    <Text style={styles.quickStepNumber}>2</Text>
                  </View>
                  <View style={styles.quickStepTextCol}>
                    <Text
                      style={[
                        styles.quickStepTitle,
                        { color: isDark ? colors.text : "#0F172A" },
                      ]}
                    >
                      Link a payment method
                    </Text>
                    <Text
                      style={[
                        styles.quickStepDesc,
                        { color: isDark ? colors.textMuted : "#64748B" },
                      ]}
                    >
                      Save your GCash or debit card for fast 1-tap checkout.
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={isDark ? colors.textMuted : "#94A3B8"}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.quickStepItem,
                    {
                      backgroundColor: isDark ? colors.surfaceInset : "#F8FAFC",
                      borderColor: isDark ? colors.border : "#E2E8F0",
                      borderWidth: 1,
                    },
                  ]}
                  onPress={() => setShowAddPocketModal(true)}
                  activeOpacity={0.7}
                >
                  <View style={styles.quickStepNumberWrap}>
                    <Text style={styles.quickStepNumber}>3</Text>
                  </View>
                  <View style={styles.quickStepTextCol}>
                    <Text
                      style={[
                        styles.quickStepTitle,
                        { color: isDark ? colors.text : "#0F172A" },
                      ]}
                    >
                      Create a savings goal pocket
                    </Text>
                    <Text
                      style={[
                        styles.quickStepDesc,
                        { color: isDark ? colors.textMuted : "#64748B" },
                      ]}
                    >
                      Stash funds for rent deposits, repairs, or roommate trips.
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={isDark ? colors.textMuted : "#94A3B8"}
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}

        {/* 2. Linked Cards & E-Wallets Deck */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.titleAddRow}>
            <Text
              style={[
                styles.sectionTitle,
                { color: isDark ? colors.text : "#0F172A" },
              ]}
            >
              Payment Methods & Cards
            </Text>
            <TouchableOpacity
              style={styles.addSectionBtn}
              onPress={() => setShowAddCardModal(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle-outline" size={16} color="#2563EB" />
              <Text style={styles.addSectionBtnText}>Add Card</Text>
            </TouchableOpacity>
          </View>
          <Text
            style={[
              styles.sectionSubtitle,
              { color: isDark ? colors.textMuted : "#64748B" },
            ]}
          >
            GCash, Maya & Philippine bank card accounts
          </Text>
        </View>

        {(wallet?.cards || []).length === 0 ? (
          <View
            style={[
              styles.emptyCardsCard,
              {
                borderColor: isDark ? colors.border : "#E2E8F0",
                backgroundColor: isDark ? colors.card : "#FFFFFF",
              },
            ]}
          >
            <View style={styles.emptyCardIconWrap}>
              <Ionicons name="card-outline" size={26} color="#2563EB" />
            </View>
            <Text
              style={[
                styles.emptyCardsTitle,
                { color: isDark ? colors.text : "#0F172A" },
              ]}
            >
              No payment methods linked yet
            </Text>
            <Text
              style={[
                styles.emptyCardsSubtitle,
                { color: isDark ? colors.textMuted : "#64748B" },
              ]}
            >
              Link your GCash, Maya, or Philippine bank card for quick dues
              settlements and easy cash in.
            </Text>
            <TouchableOpacity
              style={styles.emptyCardActionBtn}
              onPress={() => setShowAddCardModal(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={16} color="#FFFFFF" />
              <Text style={styles.emptyCardActionBtnText}>
                Add Payment Method
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cardsCarousel}
          >
            {(wallet?.cards || []).map((card) => {
              const preset =
                PHILIPPINE_CARD_PRESETS[card.type] ||
                PHILIPPINE_CARD_PRESETS.custom;
              const isGCash = card.type === "gcash";
              const isMaya = card.type === "maya";
              const isCash = card.type === "cash";

              if (isCash) {
                return (
                  <TouchableOpacity
                    key={card.id}
                    onPress={() => handleCardPress(card)}
                    activeOpacity={0.88}
                  >
                    <LinearGradient
                      colors={["#022C22", "#064E3B", "#065F46"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[styles.cardItem, styles.cashCardItem]}
                    >
                      {/* Subtle watermark background seal */}
                      <View style={styles.cashWatermarkWrap}>
                        <MaterialCommunityIcons
                          name="shield-check"
                          size={110}
                          color="rgba(255, 255, 255, 0.04)"
                        />
                      </View>

                      {/* Top Row: Central Bank seal / Brand & Badges */}
                      <View style={styles.cardItemTop}>
                        <View
                          style={{
                            width: "100%",
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 6,
                          }}
                        >
                          <View style={styles.cashTenderBadge}>
                            <Text style={styles.cashTenderText}>
                              Cash on hand
                            </Text>
                          </View>
                          {card.isDefault && (
                            <View style={styles.cardDefaultBadge}>
                              <Text style={styles.cardDefaultText}>
                                PRIMARY
                              </Text>
                            </View>
                          )}
                          <TouchableOpacity
                            style={styles.cardTrashBtn}
                            onPress={() => handlePromptDeleteCard(card)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            accessibilityLabel={`Delete ${card.name}`}
                          >
                            <Ionicons
                              name="trash-outline"
                              size={14}
                              color="#FFFFFF"
                            />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Balance display */}
                      <View style={styles.cardBalanceRow}>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 5,
                          }}
                        >
                          <View style={styles.cashAutoLiveDot} />

                          <Text style={styles.cashBalanceLabel}>
                            Available Balance
                          </Text>
                        </View>
                        <Text style={styles.cashBalanceAmount}>
                          {hideBalance
                            ? "₱ ••••••"
                            : `₱${(card.balance || 0).toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}`}
                        </Text>
                      </View>

                      {/* Bottom Row: Custodian & Serial */}
                      <View style={styles.cardItemBottom}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardHolderLabel}>CUSTODIAN</Text>
                          <Text style={styles.cardHolderName} numberOfLines={1}>
                            {card.cardholderName ||
                              currentUser?.name ||
                              "Cash Custodian"}
                          </Text>
                        </View>

                        <View style={styles.cardRightMeta}>
                          <Text style={styles.cashSerialText}>
                            {card.accountNumber || "SN • 2026-PH-CASH"}
                          </Text>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 4,
                              justifyContent: "flex-end",
                              marginTop: 2,
                            }}
                          >
                            <MaterialCommunityIcons
                              name="cash-multiple"
                              size={12}
                              color="#6EE7B7"
                            />
                            <Text style={styles.cashSubBadgeText}>
                              Peso Notes • BSP
                            </Text>
                          </View>
                        </View>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                );
              }

              return (
                <TouchableOpacity
                  key={card.id}
                  onPress={() => handleCardPress(card)}
                  activeOpacity={0.88}
                >
                  <LinearGradient
                    colors={card.colorGradient || preset.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.cardItem}
                  >
                    <View style={styles.cardItemTop}>
                      <View style={styles.cardBrandBadge}>
                        <Text style={styles.cardBrandName}>
                          {preset ? preset.name : card.name}
                        </Text>
                      </View>

                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        {card.isDefault && (
                          <View style={styles.cardDefaultBadge}>
                            <Text style={styles.cardDefaultText}>PRIMARY</Text>
                          </View>
                        )}
                        <TouchableOpacity
                          style={styles.cardTrashBtn}
                          onPress={() => handlePromptDeleteCard(card)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          accessibilityLabel={`Delete ${card.name}`}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={14}
                            color="#FFFFFF"
                          />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.cardBalanceRow}>
                      <Text style={styles.cardBalanceLabel}>CARD BALANCE</Text>
                      <Text style={styles.cardBalanceAmount}>
                        {hideBalance
                          ? "₱ ••••••"
                          : `₱${(card.balance || 0).toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}`}
                      </Text>
                    </View>

                    <View style={styles.cardItemMiddle}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <MaterialCommunityIcons
                          name="integrated-circuit-chip"
                          size={26}
                          color="#FCD34D"
                        />
                        <MaterialCommunityIcons
                          name="contactless-payment"
                          size={18}
                          color="rgba(255, 255, 255, 0.75)"
                        />
                      </View>
                      <Text style={styles.cardNumberText}>
                        {card.accountNumber}
                      </Text>
                    </View>

                    <View style={styles.cardItemBottom}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardHolderLabel}>CARDHOLDER</Text>
                        <Text style={styles.cardHolderName} numberOfLines={1}>
                          {card.cardholderName}
                        </Text>
                      </View>

                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={styles.cardNetworkBadge}>
                          {preset?.network || (isGCash ? "QR Ph" : "Visa")}
                        </Text>
                        {card.expiry && (
                          <Text style={styles.cardExpiryText}>
                            EXP {card.expiry}
                          </Text>
                        )}
                      </View>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              );
            })}

            {/* Add Card Shortcut Card */}
            <TouchableOpacity
              style={[
                styles.addCardPlaceholder,
                {
                  borderColor: isDark ? colors.border : "#CBD5E1",
                  backgroundColor: isDark ? colors.surfaceInset : "#F1F5F966",
                },
              ]}
              onPress={() => setShowAddCardModal(true)}
              activeOpacity={0.7}
            >
              <View style={styles.addCardIconCircle}>
                <Ionicons name="card-outline" size={24} color="#2563EB" />
              </View>
              <Text
                style={[
                  styles.addCardPlaceholderText,
                  { color: isDark ? colors.text : "#0F172A" },
                ]}
              >
                Add New Card
              </Text>
              <Text
                style={[
                  styles.addCardPlaceholderSub,
                  { color: isDark ? colors.textMuted : "#64748B" },
                ]}
              >
                GCash, Maya, BPI, BDO
              </Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* 3. Savings Pockets / Vaults */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.titleAddRow}>
            <Text
              style={[
                styles.sectionTitle,
                { color: isDark ? colors.text : "#0F172A" },
              ]}
            >
              Savings Pockets
            </Text>
            <TouchableOpacity
              style={styles.addSectionBtn}
              onPress={() => setShowAddPocketModal(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle-outline" size={16} color="#2563EB" />
              <Text style={styles.addSectionBtnText}>New Goal</Text>
            </TouchableOpacity>
          </View>
          <Text
            style={[
              styles.sectionSubtitle,
              { color: isDark ? colors.textMuted : "#64748B" },
            ]}
          >
            Stash money for rent deposits & room goals
          </Text>
        </View>

        {(wallet?.pockets || []).length === 0 ? (
          <View
            style={[
              styles.emptyPocketsContainer,
              {
                borderColor: isDark ? colors.border : "#E2E8F0",
                backgroundColor: isDark ? colors.card : "#FFFFFF",
              },
            ]}
          >
            <View style={styles.emptyPocketIconWrap}>
              <Ionicons
                name="shield-checkmark-outline"
                size={28}
                color="#2563EB"
              />
            </View>
            <Text
              style={[
                styles.emptyPocketsTitle,
                { color: isDark ? colors.text : "#0F172A" },
              ]}
            >
              No savings pockets yet
            </Text>
            <Text
              style={[
                styles.emptyPocketsSubtitle,
                { color: isDark ? colors.textMuted : "#64748B" },
              ]}
            >
              Set aside money for rent security deposits, household buffers, or
              roommate goals with progress tracking.
            </Text>
            <TouchableOpacity
              style={styles.emptyPocketActionBtn}
              onPress={() => setShowAddPocketModal(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={16} color="#FFFFFF" />
              <Text style={styles.emptyPocketActionBtnText}>
                Create First Pocket
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.pocketsScrollView}
            contentContainerStyle={styles.pocketsCarousel}
          >
            {(wallet?.pockets || []).map((pocket) => {
              const percent = Math.min(
                100,
                Math.round((pocket.currentAmount / pocket.targetAmount) * 100),
              );

              return (
                <View
                  key={pocket.id}
                  style={[
                    styles.pocketCard,
                    {
                      backgroundColor: isDark ? colors.card : "#FFFFFF",
                      borderColor: isDark ? colors.border : "#E2E8F0",
                    },
                  ]}
                >
                  <View style={styles.pocketTopRow}>
                    <View
                      style={[
                        styles.pocketIconWrap,
                        { backgroundColor: pocket.color + "22" },
                      ]}
                    >
                      <Ionicons
                        name={pocket.icon as any}
                        size={20}
                        color={pocket.color}
                      />
                    </View>

                    <View style={styles.pocketProgressBadge}>
                      <Text
                        style={[
                          styles.pocketProgressBadgeText,
                          { color: pocket.color },
                        ]}
                      >
                        {percent}%
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={[
                      styles.pocketName,
                      { color: isDark ? colors.text : "#0F172A" },
                    ]}
                    numberOfLines={1}
                  >
                    {pocket.name}
                  </Text>

                  <View style={styles.pocketAmountRow}>
                    <Text
                      style={[
                        styles.pocketCurrent,
                        { color: isDark ? colors.text : "#0F172A" },
                      ]}
                    >
                      ₱{(pocket.currentAmount ?? 0).toLocaleString()}
                    </Text>
                    <Text
                      style={[
                        styles.pocketTarget,
                        { color: isDark ? colors.textMuted : "#64748B" },
                      ]}
                    >
                      / ₱{(pocket.targetAmount ?? 0).toLocaleString()}
                    </Text>
                  </View>

                  {/* Progress bar */}
                  <View
                    style={[
                      styles.progressBarTrack,
                      {
                        backgroundColor: isDark
                          ? colors.surfaceInset
                          : "#E2E8F0",
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${percent}%`, backgroundColor: pocket.color },
                      ]}
                    />
                  </View>

                  <View style={styles.pocketButtonsRow}>
                    <TouchableOpacity
                      style={[
                        styles.pocketBtn,
                        {
                          backgroundColor: isDark
                            ? colors.surfaceInset
                            : "#F1F5F9",
                          borderColor: isDark ? colors.border : "transparent",
                          borderWidth: isDark ? 1 : 0,
                        },
                      ]}
                      onPress={() => {
                        setSelectedPocket(pocket);
                        setPocketActionType("deposit");
                        setPocketSelectedCardId(
                          wallet?.cards.find((c) => c.isDefault)?.id ||
                            wallet?.cards[0]?.id ||
                            "",
                        );
                        setShowPocketActionModal(true);
                      }}
                    >
                      <Ionicons name="arrow-up" size={14} color="#2563EB" />
                      <Text style={styles.pocketBtnText}>Stash</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.pocketBtn,
                        {
                          backgroundColor: isDark
                            ? colors.surfaceInset
                            : "#F1F5F9",
                          borderColor: isDark ? colors.border : "transparent",
                          borderWidth: isDark ? 1 : 0,
                        },
                      ]}
                      onPress={() => {
                        setSelectedPocket(pocket);
                        setPocketActionType("withdraw");
                        setPocketSelectedCardId(
                          wallet?.cards.find((c) => c.isDefault)?.id ||
                            wallet?.cards[0]?.id ||
                            "",
                        );
                        setShowPocketActionModal(true);
                      }}
                    >
                      <Ionicons
                        name="arrow-down"
                        size={14}
                        color={isDark ? colors.textMuted : "#64748B"}
                      />
                      <Text
                        style={[
                          styles.pocketBtnText,
                          { color: isDark ? colors.textMuted : "#64748B" },
                        ]}
                      >
                        Withdraw
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}

            {/* Add New Goal Shortcut Card */}
            <TouchableOpacity
              style={[
                styles.addPocketPlaceholder,
                {
                  borderColor: isDark ? colors.border : "#CBD5E1",
                  backgroundColor: isDark ? colors.surfaceInset : "#F1F5F966",
                },
              ]}
              onPress={() => setShowAddPocketModal(true)}
              activeOpacity={0.7}
            >
              <View style={styles.addPocketIconCircle}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={24}
                  color="#2563EB"
                />
              </View>
              <Text
                style={[
                  styles.addCardPlaceholderText,
                  { color: isDark ? colors.text : "#0F172A" },
                ]}
              >
                New Goal
              </Text>
              <Text
                style={[
                  styles.addCardPlaceholderSub,
                  { color: isDark ? colors.textMuted : "#64748B" },
                ]}
              >
                Create pocket
              </Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* 4. Activity & Transaction Ledger */}
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text
              style={[
                styles.sectionTitle,
                { color: isDark ? colors.text : "#0F172A" },
              ]}
            >
              Activity & Ledger
            </Text>
            <Text
              style={[
                styles.sectionSubtitle,
                { color: isDark ? colors.textMuted : "#64748B" },
              ]}
            >
              Real-time records of payments, deposits & top-ups
            </Text>
          </View>
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterTabsRow}>
          {[
            { id: "all", label: "All" },
            { id: "cash_in", label: "Top-ups" },
            { id: "payment", label: "Bills & Dues" },
            { id: "savings", label: "Savings" },
          ].map((tab) => {
            const active = txFilter === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.filterTabBtn,
                  active
                    ? { backgroundColor: "#2563EB" }
                    : {
                        backgroundColor: isDark
                          ? colors.surfaceInset
                          : "#F1F5F9",
                        borderWidth: 1,
                        borderColor: isDark ? colors.border : "#E2E8F0",
                      },
                ]}
                onPress={() => setTxFilter(tab.id as any)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    {
                      color: active
                        ? "#FFFFFF"
                        : isDark
                          ? colors.textSecondary
                          : "#64748B",
                    },
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {filteredTransactions.length === 0 ? (
          <View
            style={[
              styles.emptyTxBox,
              {
                backgroundColor: isDark ? colors.card : "#FFFFFF",
                borderColor: isDark ? colors.border : "#E2E8F0",
              },
            ]}
          >
            <Ionicons
              name="receipt-outline"
              size={36}
              color={isDark ? colors.textMuted : "#94A3B8"}
            />
            <Text
              style={[
                styles.emptyTxTitle,
                { color: isDark ? colors.text : "#0F172A" },
              ]}
            >
              No transactions yet
            </Text>
            <Text
              style={[
                styles.emptyTxSubtitle,
                { color: isDark ? colors.textMuted : "#64748B" },
              ]}
            >
              Top up your wallet or pay household dues to see records here.
            </Text>
          </View>
        ) : (
          <View
            style={[
              styles.txListContainer,
              {
                backgroundColor: isDark ? colors.card : "#FFFFFF",
                borderColor: isDark ? colors.border : "#E2E8F0",
              },
            ]}
          >
            {filteredTransactions.map((tx, idx) => {
              const isPositive =
                tx.type === "cash_in" || tx.type === "savings_withdrawal";
              const isLast = idx === filteredTransactions.length - 1;

              return (
                <TouchableOpacity
                  key={tx.id}
                  style={[
                    styles.txRow,
                    !isLast && {
                      borderBottomWidth: 1,
                      borderBottomColor: isDark ? colors.border : "#F1F5F9",
                    },
                  ]}
                  onPress={() => setSelectedTx(tx)}
                  activeOpacity={0.7}
                >
                  {(() => {
                    const isExpense =
                      tx.type === "expense_simulation" ||
                      tx.type === "cash_expense";

                    if (isExpense) {
                      const iconData = getExpenseSemanticIconMobile(tx);
                      return (
                        <View
                          style={[
                            styles.txIconWrap,
                            { backgroundColor: iconData.bg },
                          ]}
                        >
                          <Ionicons
                            name={iconData.icon}
                            size={20}
                            color={iconData.color}
                          />
                        </View>
                      );
                    }

                    return (
                      <View
                        style={[
                          styles.txIconWrap,
                          {
                            backgroundColor:
                              tx.type === "card_transfer"
                                ? "#6366F118"
                                : isPositive
                                  ? "#10B98118"
                                  : "#2563EB18",
                          },
                        ]}
                      >
                        <Ionicons
                          name={
                            tx.type === "cash_in"
                              ? "arrow-down-circle"
                              : tx.type === "bill_payment"
                                ? "receipt"
                                : tx.type === "debt_settlement"
                                  ? "swap-horizontal"
                                  : tx.type === "card_transfer"
                                    ? "swap-horizontal"
                                    : "shield-checkmark"
                          }
                          size={20}
                          color={
                            tx.type === "card_transfer"
                              ? "#6366F1"
                              : isPositive
                                ? "#10B981"
                                : "#2563EB"
                          }
                        />
                      </View>
                    );
                  })()}

                  <View style={styles.txInfoCol}>
                    <Text
                      style={[
                        styles.txTitle,
                        { color: isDark ? colors.text : "#0F172A" },
                      ]}
                      numberOfLines={1}
                    >
                      {tx.title}
                    </Text>
                    <Text
                      style={[
                        styles.txMeta,
                        { color: isDark ? colors.textMuted : "#64748B" },
                      ]}
                      numberOfLines={1}
                    >
                      {(tx as AppWalletTransaction).note
                        ? `${(tx as AppWalletTransaction).note} · `
                        : ""}
                      {tx.paymentMethodUsed} ·{" "}
                      {new Date(tx.timestamp).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </Text>
                  </View>

                  <View style={styles.txAmountCol}>
                    <Text
                      style={[
                        styles.txAmount,
                        {
                          color:
                            tx.type === "card_transfer"
                              ? isDark
                                ? "#818CF8"
                                : "#4F46E5"
                              : isPositive
                                ? "#10B981"
                                : isDark
                                  ? colors.text
                                  : "#0F172A",
                        },
                      ]}
                    >
                      {tx.type === "card_transfer"
                        ? "⇄ ₱"
                        : isPositive
                          ? "+₱"
                          : "-₱"}
                      {(tx.amount ?? 0).toLocaleString()}
                    </Text>
                    <Text style={styles.txStatusCompleted}>Completed</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* MODAL 1: Cash In / Top Up */}
      <Modal
        visible={showCashInModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCashInModal(false)}
        statusBarTranslucent={true}
      >
        <View style={dynamicModalOverlayStyle}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowCashInModal(false)}
          />
          <View
            style={[
              styles.modalSheet,
              {
                maxHeight: modalAdaptiveMaxHeight,
                backgroundColor: isDark ? colors.cardElevated : "#FFFFFF",
                borderColor: isDark ? colors.border : "transparent",
                borderWidth: isDark ? 1 : 0,
              },
            ]}
          >
            <View
              style={[
                styles.modalHandle,
                isDark && { backgroundColor: colors.textMuted },
              ]}
            />
            <Text
              style={[
                styles.modalTitle,
                { color: isDark ? colors.text : "#0F172A" },
              ]}
            >
              Top-up Splitzy Wallet
            </Text>
            <Text
              style={[
                styles.modalSubtitle,
                { color: isDark ? colors.textMuted : "#64748B" },
              ]}
            >
              Select quick amount or type custom value
            </Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets={true}
              style={{ maxHeight: effectiveKeyboardHeight > 0 ? 260 : 420 }}
            >
              {/* Quick Amount Pills */}
              <View style={styles.quickAmountsRow}>
                {["500", "1000", "2000", "5000"].map((preset) => (
                  <TouchableOpacity
                    key={preset}
                    style={[
                      styles.quickPill,
                      cashInAmount === preset
                        ? { backgroundColor: "#2563EB" }
                        : {
                            backgroundColor: isDark
                              ? colors.surfaceInset
                              : "#F1F5F9",
                            borderWidth: 1,
                            borderColor: isDark ? colors.border : "#E2E8F0",
                          },
                    ]}
                    onPress={() => setCashInAmount(preset)}
                  >
                    <Text
                      style={[
                        styles.quickPillText,
                        {
                          color:
                            cashInAmount === preset
                              ? "#FFFFFF"
                              : isDark
                                ? colors.text
                                : "#0F172A",
                        },
                      ]}
                    >
                      ₱{preset}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Input */}
              <View
                style={[
                  styles.amountInputWrap,
                  {
                    backgroundColor: isDark ? colors.surfaceInset : "#F8FAFC",
                    borderColor: isDark ? colors.border : "#CBD5E1",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.currencyPrefix,
                    { color: isDark ? colors.textMuted : "#64748B" },
                  ]}
                >
                  ₱
                </Text>
                <TextInput
                  style={[
                    styles.amountInput,
                    { color: isDark ? colors.text : "#0F172A" },
                  ]}
                  keyboardType="numeric"
                  value={cashInAmount}
                  onChangeText={setCashInAmount}
                  placeholder="0.00"
                  placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
                />
              </View>

              {/* Money Source / Origin Field */}
              <Text
                style={[
                  styles.inputLabel,
                  {
                    color: isDark ? colors.textSecondary : "#475569",
                    marginTop: 12,
                  },
                ]}
              >
                Money Source / Origin (Optional)
              </Text>
              <View
                style={[
                  styles.simChipRow,
                  { marginBottom: 6, flexWrap: "wrap" },
                ]}
              >
                {[
                  "Salary",
                  "Freelance / Gig",
                  "Savings",
                  "Allowance",
                  "Bonus / Gift",
                  "Business / Sales",
                  "Refund",
                  "Other",
                ].map((srcPreset) => {
                  const isSelected = cashInSource === srcPreset;
                  return (
                    <TouchableOpacity
                      key={srcPreset}
                      style={[
                        styles.simChipBtn,
                        {
                          backgroundColor: isSelected
                            ? isDark
                              ? "#1E3A8A"
                              : "#DBEAFE"
                            : isDark
                              ? colors.surfaceInset
                              : "#F1F5F9",
                          borderColor: isSelected
                            ? "#2563EB"
                            : isDark
                              ? colors.border
                              : "#E2E8F0",
                        },
                      ]}
                      onPress={() =>
                        setCashInSource(isSelected ? "" : srcPreset)
                      }
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.simChipBtnText,
                          {
                            color: isSelected
                              ? isDark
                                ? "#93C5FD"
                                : "#1D4ED8"
                              : isDark
                                ? colors.textMuted
                                : "#475569",
                            fontWeight: isSelected ? "700" : "500",
                          },
                        ]}
                      >
                        {srcPreset}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View
                style={[
                  styles.amountInputWrap,
                  {
                    backgroundColor: isDark ? colors.surfaceInset : "#F8FAFC",
                    borderColor: isDark ? colors.border : "#CBD5E1",
                    height: 46,
                    paddingHorizontal: 12,
                  },
                ]}
              >
                <Ionicons
                  name="wallet-outline"
                  size={18}
                  color={isDark ? colors.textMuted : "#64748B"}
                  style={{ marginRight: 8 }}
                />
                <TextInput
                  style={[
                    styles.amountInput,
                    {
                      color: isDark ? colors.text : "#0F172A",
                      fontSize: 14,
                      textAlign: "left",
                      flex: 1,
                    },
                  ]}
                  value={cashInSource}
                  onChangeText={setCashInSource}
                  placeholder="e.g. Monthly Salary, Freelance gig, Allowance"
                  placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
                />
                {Boolean(cashInSource) && (
                  <TouchableOpacity
                    onPress={() => setCashInSource("")}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name="close-circle"
                      size={18}
                      color={isDark ? colors.textMuted : "#94A3B8"}
                    />
                  </TouchableOpacity>
                )}
              </View>

              {/* Destination Card Select */}
              <Text
                style={[
                  styles.inputLabel,
                  { color: isDark ? colors.textSecondary : "#475569" },
                ]}
              >
                Deposit Funds To Card
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10, marginVertical: 8 }}
              >
                {(wallet?.cards || []).map((card) => {
                  const isSelected =
                    (selectedCashInCardId || wallet?.cards[0]?.id) === card.id;
                  return (
                    <TouchableOpacity
                      key={card.id}
                      style={[
                        styles.cardPickBox,
                        isSelected
                          ? {
                              borderColor: "#2563EB",
                              backgroundColor: isDark ? "#1E3A8A35" : "#EFF6FF",
                            }
                          : {
                              borderColor: isDark ? colors.border : "#E2E8F0",
                              backgroundColor: isDark
                                ? colors.surfaceInset
                                : "#FFFFFF",
                            },
                      ]}
                      onPress={() => {
                        setSelectedCashInCardId(card.id);
                        setCashInMethod(card.name);
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: 4,
                        }}
                      >
                        <Text
                          style={[
                            styles.cardPickName,
                            { color: isDark ? colors.text : "#0F172A" },
                          ]}
                          numberOfLines={1}
                        >
                          {card.name}
                        </Text>
                        {card.isDefault && (
                          <View style={styles.cardDefaultMiniBadge}>
                            <Text style={styles.cardDefaultMiniText}>
                              PRIMARY
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.cardPickAccount,
                          { color: isDark ? colors.textMuted : "#64748B" },
                        ]}
                      >
                        {card.accountNumber}
                      </Text>
                      <Text style={styles.cardPickBalance}>
                        ₱
                        {(card.balance || 0).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Confirm button */}
              <TouchableOpacity
                style={styles.modalPrimaryBtn}
                onPress={handleCashIn}
                activeOpacity={0.8}
              >
                <Text style={styles.modalPrimaryBtnText}>
                  Confirm Top-up of ₱
                  {parseFloat(cashInAmount || "0").toLocaleString()}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowCashInModal(false)}
              >
                <Text
                  style={[
                    styles.modalCancelBtnText,
                    { color: isDark ? colors.textMuted : "#64748B" },
                  ]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: Add Mock Card / E-Wallet */}
      <Modal
        visible={showAddCardModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddCardModal(false)}
        statusBarTranslucent={true}
      >
        <View style={dynamicModalOverlayStyle}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowAddCardModal(false)}
          />
          <View
            style={[
              styles.modalSheet,
              {
                maxHeight: modalAdaptiveMaxHeight,
                backgroundColor: isDark ? colors.cardElevated : "#FFFFFF",
                borderColor: isDark ? colors.border : "transparent",
                borderWidth: isDark ? 1 : 0,
              },
            ]}
          >
            <View
              style={[
                styles.modalHandle,
                isDark && { backgroundColor: colors.textMuted },
              ]}
            />
            <Text
              style={[
                styles.modalTitle,
                { color: isDark ? colors.text : "#0F172A" },
              ]}
            >
              Add Payment Method
            </Text>
            <Text
              style={[
                styles.modalSubtitle,
                { color: isDark ? colors.textMuted : "#64748B" },
              ]}
            >
              Link a mock card or e-wallet for quick household splits
            </Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: effectiveKeyboardHeight > 0 ? 240 : 380 }}
            >
              {/* Type selector: All Philippine Bank & E-Wallet Presets */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, marginVertical: 12 }}
              >
                {Object.values(PHILIPPINE_CARD_PRESETS).map((prov) => (
                  <TouchableOpacity
                    key={prov.type}
                    style={[
                      styles.providerChip,
                      newCardType === prov.type
                        ? {
                            backgroundColor: prov.gradient[0],
                            borderColor: prov.accentColor,
                            borderWidth: 1.5,
                          }
                        : {
                            backgroundColor: isDark
                              ? colors.surfaceInset
                              : "#F1F5F9",
                            borderWidth: 1,
                            borderColor: isDark ? colors.border : "#E2E8F0",
                          },
                    ]}
                    onPress={() => {
                      setNewCardType(prov.type as any);
                      if (
                        !newCardName ||
                        Object.values(PHILIPPINE_CARD_PRESETS).some(
                          (p) => p.name === newCardName,
                        )
                      ) {
                        setNewCardName(prov.name);
                      }
                    }}
                  >
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: prov.gradient[0],
                        marginRight: 4,
                      }}
                    />
                    <Text
                      style={[
                        styles.providerChipText,
                        {
                          color:
                            newCardType === prov.type
                              ? "#FFFFFF"
                              : isDark
                                ? colors.text
                                : "#0F172A",
                          fontWeight: newCardType === prov.type ? "800" : "600",
                        },
                      ]}
                    >
                      {prov.shortCode}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text
                style={[
                  styles.inputLabel,
                  { color: isDark ? colors.textSecondary : "#475569" },
                ]}
              >
                Account / Card Nickname (Optional)
              </Text>
              <TextInput
                style={[
                  styles.modalTextInput,
                  {
                    backgroundColor: isDark ? colors.surfaceInset : "#F8FAFC",
                    borderColor: isDark ? colors.border : "#CBD5E1",
                    color: isDark ? colors.text : "#0F172A",
                  },
                ]}
                placeholder="e.g. My Personal GCash or Salary Card"
                placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
                value={newCardName}
                onChangeText={setNewCardName}
              />

              <Text
                style={[
                  styles.inputLabel,
                  { color: isDark ? colors.textSecondary : "#475569" },
                ]}
              >
                {newCardType === "gcash"
                  ? "Mobile Number"
                  : "Last 4 Digits / Number"}
              </Text>
              <TextInput
                style={[
                  styles.modalTextInput,
                  {
                    backgroundColor: isDark ? colors.surfaceInset : "#F8FAFC",
                    borderColor: isDark ? colors.border : "#CBD5E1",
                    color: isDark ? colors.text : "#0F172A",
                  },
                ]}
                placeholder={newCardType === "gcash" ? "09171234567" : "8821"}
                placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
                value={newCardNumber}
                onChangeText={setNewCardNumber}
                keyboardType="numeric"
              />

              <Text
                style={[
                  styles.inputLabel,
                  { color: isDark ? colors.textSecondary : "#475569" },
                ]}
              >
                Account Holder Name
              </Text>
              <TextInput
                style={[
                  styles.modalTextInput,
                  {
                    backgroundColor: isDark ? colors.surfaceInset : "#F8FAFC",
                    borderColor: isDark ? colors.border : "#CBD5E1",
                    color: isDark ? colors.text : "#0F172A",
                  },
                ]}
                placeholder="e.g. Alex Chen"
                placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
                value={newCardHolder}
                onChangeText={setNewCardHolder}
              />

              <Text
                style={[
                  styles.inputLabel,
                  { color: isDark ? colors.textSecondary : "#475569" },
                ]}
              >
                Initial Card Balance (₱)
              </Text>
              <TextInput
                style={[
                  styles.modalTextInput,
                  {
                    backgroundColor: isDark ? colors.surfaceInset : "#F8FAFC",
                    borderColor: isDark ? colors.border : "#CBD5E1",
                    color: isDark ? colors.text : "#0F172A",
                  },
                ]}
                placeholder="e.g. 5000"
                placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
                value={newCardBalance}
                onChangeText={setNewCardBalance}
                keyboardType="numeric"
              />
            </ScrollView>

            <TouchableOpacity
              style={styles.modalPrimaryBtn}
              onPress={handleAddCard}
              activeOpacity={0.8}
            >
              <Text style={styles.modalPrimaryBtnText}>
                Save Payment Method
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setShowAddCardModal(false)}
            >
              <Text
                style={[
                  styles.modalCancelBtnText,
                  { color: isDark ? colors.textMuted : "#64748B" },
                ]}
              >
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL 2.5: Card Details & Quick Actions Bottom Sheet */}
      <Modal
        visible={showCardDetailModal && Boolean(selectedCardDetail)}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCardDetailModal(false)}
        statusBarTranslucent={true}
      >
        <View style={dynamicModalOverlayStyle}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowCardDetailModal(false)}
          />
          <View
            style={[
              styles.modalSheet,
              {
                maxHeight: modalAdaptiveMaxHeight,
                backgroundColor: isDark ? colors.cardElevated : "#FFFFFF",
                borderColor: isDark ? colors.border : "transparent",
                borderWidth: isDark ? 1 : 0,
              },
            ]}
          >
            <View
              style={[
                styles.modalHandle,
                isDark && { backgroundColor: colors.textMuted },
              ]}
            />

            {selectedCardDetail &&
              (() => {
                const preset =
                  PHILIPPINE_CARD_PRESETS[selectedCardDetail.type] ||
                  PHILIPPINE_CARD_PRESETS.custom;
                const isGCash = selectedCardDetail.type === "gcash";

                return (
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ paddingBottom: 20 }}
                  >
                    <Text
                      style={[
                        styles.modalTitle,
                        {
                          color: isDark ? colors.text : "#0F172A",
                          marginBottom: 12,
                        },
                      ]}
                    >
                      Card Details & Actions
                    </Text>

                    {/* Card Visual Banner Preview */}
                    <LinearGradient
                      colors={
                        selectedCardDetail.type === "cash"
                          ? ["#022C22", "#064E3B", "#065F46"]
                          : selectedCardDetail.colorGradient || preset.gradient
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.cardDetailBanner}
                    >
                      <View style={styles.cardDetailBannerTop}>
                        {selectedCardDetail.type === "cash" && (
                          <View style={styles.cashTenderBadge}>
                            <Text style={styles.cashTenderText}>
                              Cash On Hand
                            </Text>
                          </View>
                        )}
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          {selectedCardDetail.isDefault && (
                            <View style={styles.cardDefaultBadge}>
                              <Text style={styles.cardDefaultText}>
                                PRIMARY
                              </Text>
                            </View>
                          )}
                          <Text style={styles.cardNetworkBadge}>
                            {selectedCardDetail.type === "cash"
                              ? "Cash • BSP"
                              : preset?.network || (isGCash ? "QR Ph" : "Visa")}
                          </Text>
                        </View>
                      </View>

                      <View style={{ marginVertical: 8 }}>
                        <Text
                          style={
                            selectedCardDetail.type === "cash"
                              ? styles.cashBalanceLabel
                              : styles.cardBalanceLabel
                          }
                        >
                          {selectedCardDetail.type === "cash"
                            ? "AVAILABLE BALANCE"
                            : "CARD BALANCE"}
                        </Text>
                        <Text style={styles.cardBalanceAmount}>
                          {hideBalance
                            ? "₱ ••••••"
                            : `₱${(
                                selectedCardDetail.balance || 0
                              ).toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}`}
                        </Text>
                      </View>

                      <View style={styles.cardItemBottom}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardHolderLabel}>
                            {selectedCardDetail.type === "cash"
                              ? "CUSTODIAN"
                              : "CARDHOLDER"}
                          </Text>
                          <Text style={styles.cardHolderName} numberOfLines={1}>
                            {selectedCardDetail.cardholderName ||
                              currentUser?.name ||
                              "Cash Custodian"}
                          </Text>
                        </View>
                        <Text
                          style={
                            selectedCardDetail.type === "cash"
                              ? styles.cashSerialText
                              : styles.cardNumberText
                          }
                        >
                          {selectedCardDetail.accountNumber}
                        </Text>
                      </View>
                    </LinearGradient>

                    {/* Actions Section */}
                    <View style={{ marginVertical: 14, gap: 10 }}>
                      {selectedCardDetail.type === "cash" && (
                        <View style={{ gap: 8 }}>
                          <TouchableOpacity
                            style={[
                              styles.cardDetailActionRow,
                              {
                                backgroundColor: isDark
                                  ? "#064E3B30"
                                  : "#ECFDF5",
                                borderColor: isDark ? "#047857" : "#A7F3D0",
                              },
                            ]}
                            onPress={() => {
                              setShowCardDetailModal(false);
                              handleOpenCashExpense(selectedCardDetail.id);
                            }}
                            activeOpacity={0.75}
                          >
                            <View
                              style={[
                                styles.cardDetailActionIconWrap,
                                { backgroundColor: "#05966920" },
                              ]}
                            >
                              <Ionicons
                                name="flash"
                                size={18}
                                color="#059669"
                              />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text
                                style={[
                                  styles.cardDetailActionTitle,
                                  { color: isDark ? colors.text : "#065F46" },
                                ]}
                              >
                                Log Cash Spent (Cash on Hand)
                              </Text>
                              <Text
                                style={[
                                  styles.cardDetailActionSub,
                                  {
                                    color: isDark
                                      ? colors.textMuted
                                      : "#047857",
                                  },
                                ]}
                              >
                                Quick-record daily commute, food, and petty
                                expenses
                              </Text>
                            </View>
                            <Ionicons
                              name="chevron-forward"
                              size={16}
                              color={isDark ? colors.textMuted : "#059669"}
                            />
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.cardDetailActionRow,
                              {
                                backgroundColor: isDark
                                  ? colors.surfaceInset
                                  : "#F0FDF4",
                                borderColor: isDark ? colors.border : "#BBF7D0",
                              },
                            ]}
                            onPress={() => {
                              setShowCardDetailModal(false);
                              handleOpenCashAutomation(selectedCardDetail.id);
                            }}
                            activeOpacity={0.75}
                          >
                            <View
                              style={[
                                styles.cardDetailActionIconWrap,
                                { backgroundColor: "#10B98120" },
                              ]}
                            >
                              <Ionicons
                                name="sparkles"
                                size={18}
                                color="#10B981"
                              />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text
                                style={[
                                  styles.cardDetailActionTitle,
                                  { color: isDark ? colors.text : "#0F172A" },
                                ]}
                              >
                                Cash Expense Automation Suite
                              </Text>
                              <Text
                                style={[
                                  styles.cardDetailActionSub,
                                  {
                                    color: isDark
                                      ? colors.textMuted
                                      : "#64748B",
                                  },
                                ]}
                              >
                                Daily recurring commute & allowance
                                auto-deductions
                              </Text>
                            </View>
                            <Ionicons
                              name="chevron-forward"
                              size={16}
                              color={isDark ? colors.textMuted : "#94A3B8"}
                            />
                          </TouchableOpacity>
                        </View>
                      )}

                      {!selectedCardDetail.isDefault && (
                        <TouchableOpacity
                          style={[
                            styles.cardDetailActionRow,
                            {
                              backgroundColor: isDark
                                ? colors.surfaceInset
                                : "#EFF6FF",
                              borderColor: isDark ? colors.border : "#BFDBFE",
                            },
                          ]}
                          onPress={() =>
                            handleSetDefaultCard(selectedCardDetail)
                          }
                          activeOpacity={0.75}
                        >
                          <View
                            style={[
                              styles.cardDetailActionIconWrap,
                              { backgroundColor: "#2563EB18" },
                            ]}
                          >
                            <Ionicons name="star" size={18} color="#2563EB" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.cardDetailActionTitle,
                                { color: isDark ? colors.text : "#0F172A" },
                              ]}
                            >
                              Set as Primary Payment Card
                            </Text>
                            <Text
                              style={[
                                styles.cardDetailActionSub,
                                {
                                  color: isDark ? colors.textMuted : "#64748B",
                                },
                              ]}
                            >
                              Default source for bill splits and debit payments
                            </Text>
                          </View>
                          <Ionicons
                            name="chevron-forward"
                            size={16}
                            color={isDark ? colors.textMuted : "#94A3B8"}
                          />
                        </TouchableOpacity>
                      )}

                      <View style={styles.cardDetailGridRow}>
                        <TouchableOpacity
                          style={[
                            styles.cardDetailGridBtn,
                            {
                              backgroundColor: isDark
                                ? colors.surfaceInset
                                : "#F8FAFC",
                              borderColor: isDark ? colors.border : "#E2E8F0",
                            },
                          ]}
                          onPress={() => {
                            setShowCardDetailModal(false);
                            setSelectedCashInCardId(selectedCardDetail.id);
                            setCashInMethod(selectedCardDetail.name);
                            setShowCashInModal(true);
                          }}
                          activeOpacity={0.75}
                        >
                          <Ionicons
                            name="add-circle-outline"
                            size={20}
                            color="#2563EB"
                          />
                          <Text
                            style={[
                              styles.cardDetailGridBtnText,
                              { color: isDark ? colors.text : "#0F172A" },
                            ]}
                          >
                            Cash In
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.cardDetailGridBtn,
                            {
                              backgroundColor: isDark
                                ? colors.surfaceInset
                                : "#F8FAFC",
                              borderColor: isDark ? colors.border : "#E2E8F0",
                            },
                          ]}
                          onPress={() => {
                            setShowCardDetailModal(false);
                            setSendSelectedCardId(selectedCardDetail.id);
                            setShowSendMoneyModal(true);
                          }}
                          activeOpacity={0.75}
                        >
                          <Ionicons
                            name="paper-plane-outline"
                            size={20}
                            color="#10B981"
                          />
                          <Text
                            style={[
                              styles.cardDetailGridBtnText,
                              { color: isDark ? colors.text : "#0F172A" },
                            ]}
                          >
                            Send
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.cardDetailGridBtn,
                            {
                              backgroundColor: isDark
                                ? colors.surfaceInset
                                : "#F8FAFC",
                              borderColor: isDark ? colors.border : "#E2E8F0",
                            },
                          ]}
                          onPress={() => {
                            setShowCardDetailModal(false);
                            handleOpenTransfer(selectedCardDetail.id);
                          }}
                          activeOpacity={0.75}
                        >
                          <Ionicons
                            name="swap-horizontal"
                            size={20}
                            color="#6366F1"
                          />
                          <Text
                            style={[
                              styles.cardDetailGridBtnText,
                              { color: isDark ? colors.text : "#0F172A" },
                            ]}
                          >
                            Transfer
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.cardDetailGridBtn,
                            {
                              backgroundColor: isDark
                                ? colors.surfaceInset
                                : "#F8FAFC",
                              borderColor: isDark ? colors.border : "#E2E8F0",
                            },
                          ]}
                          onPress={() => {
                            Alert.alert(
                              "Account Number",
                              selectedCardDetail.accountNumber,
                            );
                          }}
                          activeOpacity={0.75}
                        >
                          <Ionicons
                            name="copy-outline"
                            size={20}
                            color="#8B5CF6"
                          />
                          <Text
                            style={[
                              styles.cardDetailGridBtnText,
                              { color: isDark ? colors.text : "#0F172A" },
                            ]}
                          >
                            Acct No.
                          </Text>
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity
                        style={[
                          styles.cardDetailActionRow,
                          {
                            backgroundColor: isDark ? "#450A0A25" : "#FEF2F2",
                            borderColor: isDark ? "#7F1D1D" : "#FEE2E2",
                          },
                        ]}
                        onPress={() => {
                          setShowCardDetailModal(false);
                          handlePromptDeleteCard(selectedCardDetail);
                        }}
                        activeOpacity={0.75}
                      >
                        <View
                          style={[
                            styles.cardDetailActionIconWrap,
                            { backgroundColor: "#EF444418" },
                          ]}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={18}
                            color="#EF4444"
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.cardDetailActionTitle,
                              { color: "#EF4444" },
                            ]}
                          >
                            Remove this Card
                          </Text>
                          <Text
                            style={[
                              styles.cardDetailActionSub,
                              { color: isDark ? "#F87171" : "#B91C1C" },
                            ]}
                          >
                            Security verification required before unlinking
                          </Text>
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={16}
                          color="#EF4444"
                        />
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      style={styles.modalCancelBtn}
                      onPress={() => setShowCardDetailModal(false)}
                    >
                      <Text
                        style={[
                          styles.modalCancelBtnText,
                          { color: isDark ? colors.textMuted : "#64748B" },
                        ]}
                      >
                        Close
                      </Text>
                    </TouchableOpacity>
                  </ScrollView>
                );
              })()}
          </View>
        </View>
      </Modal>

      {/* MODAL 2.6: Quick Expense Simulation Bottom Sheet */}
      <Modal
        visible={showExpenseSimModal && Boolean(selectedExpensePreset)}
        transparent
        animationType="slide"
        onRequestClose={() => setShowExpenseSimModal(false)}
        statusBarTranslucent={true}
      >
        <View style={dynamicModalOverlayStyle}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowExpenseSimModal(false)}
          />
          <View
            style={[
              styles.modalSheet,
              {
                maxHeight: modalAdaptiveMaxHeight,
                backgroundColor: isDark ? colors.cardElevated : "#FFFFFF",
                borderColor: isDark ? colors.border : "transparent",
                borderWidth: isDark ? 1 : 0,
              },
            ]}
          >
            <View
              style={[
                styles.modalHandle,
                isDark && { backgroundColor: colors.textMuted },
              ]}
            />

            {selectedExpensePreset &&
              (() => {
                const currentCard =
                  wallet?.cards.find((c) => c.id === simCardId) ||
                  wallet?.cards[0];
                const cardBal = currentCard?.balance || 0;
                const expenseAmt = parseFloat(simAmount) || 0;
                const isInsufficient = cardBal < expenseAmt;
                const balanceAfter = Math.max(0, cardBal - expenseAmt);

                return (
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    automaticallyAdjustKeyboardInsets={true}
                    style={{
                      maxHeight: effectiveKeyboardHeight > 0 ? 280 : 500,
                    }}
                  >
                    <View style={styles.simModalHeaderRow}>
                      <LinearGradient
                        colors={selectedExpensePreset.gradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.simModalIconWrap}
                      >
                        <Ionicons
                          name={
                            selectedExpensePreset.id === "custom" &&
                            customExpenseTitle.trim()
                              ? getExpenseSemanticIconMobile({
                                  title: customExpenseTitle,
                                  note: simNote,
                                  type: "expense_simulation",
                                }).icon
                              : selectedExpensePreset.icon
                          }
                          size={26}
                          color="#FFFFFF"
                        />
                      </LinearGradient>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.modalTitle,
                            {
                              color: isDark ? colors.text : "#0F172A",
                              marginBottom: 2,
                            },
                          ]}
                        >
                          {selectedExpensePreset.id === "custom" &&
                          customExpenseTitle.trim()
                            ? customExpenseTitle.trim()
                            : selectedExpensePreset.title}
                        </Text>
                        <Text
                          style={[
                            styles.simModalSub,
                            { color: isDark ? colors.textMuted : "#64748B" },
                          ]}
                        >
                          Simulate daily expense with auto card deduction
                        </Text>
                      </View>
                    </View>

                    {/* Custom Expense Name Input when Custom Preset Selected */}
                    {selectedExpensePreset.id === "custom" && (
                      <View style={{ marginTop: 10 }}>
                        <Text
                          style={[
                            styles.inputLabel,
                            {
                              color: isDark ? colors.textSecondary : "#475569",
                            },
                          ]}
                        >
                          Custom Expense Name / For What
                        </Text>
                        <TextInput
                          style={[
                            styles.modalTextInput,
                            {
                              backgroundColor: isDark
                                ? colors.surfaceInset
                                : "#F8FAFC",
                              borderColor: isDark ? colors.border : "#CBD5E1",
                              color: isDark ? colors.text : "#0F172A",
                            },
                          ]}
                          value={customExpenseTitle}
                          onChangeText={setCustomExpenseTitle}
                          placeholder="e.g. Milk Tea, Dinner with friends, GrabCar, Gym"
                          placeholderTextColor={
                            isDark ? colors.textMuted : "#94A3B8"
                          }
                        />
                      </View>
                    )}

                    {/* Expense Amount Input */}
                    <Text
                      style={[
                        styles.inputLabel,
                        {
                          color: isDark ? colors.textSecondary : "#475569",
                          marginTop: 12,
                        },
                      ]}
                    >
                      Expense Amount (₱)
                    </Text>
                    <View
                      style={[
                        styles.simAmountInputRow,
                        {
                          backgroundColor: isDark
                            ? colors.surfaceInset
                            : "#F8FAFC",
                          borderColor: isDark ? colors.border : "#CBD5E1",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.simAmountCurrency,
                          { color: isDark ? "#60A5FA" : "#2563EB" },
                        ]}
                      >
                        ₱
                      </Text>
                      <TextInput
                        style={[
                          styles.simAmountTextInput,
                          { color: isDark ? colors.text : "#0F172A" },
                        ]}
                        value={simAmount}
                        onChangeText={setSimAmount}
                        keyboardType="numeric"
                        placeholder="0.00"
                        placeholderTextColor={
                          isDark ? colors.textMuted : "#94A3B8"
                        }
                      />
                    </View>

                    {/* Quick Bump Chips */}
                    <View style={styles.simChipRow}>
                      {[
                        { label: "+₱20", val: 20 },
                        { label: "+₱50", val: 50 },
                        { label: "+₱100", val: 100 },
                        {
                          label: `Preset (₱${selectedExpensePreset.amount})`,
                          reset: true,
                        },
                      ].map((chip, idx) => (
                        <TouchableOpacity
                          key={idx}
                          style={[
                            styles.simChipBtn,
                            {
                              backgroundColor: isDark
                                ? colors.surfaceInset
                                : "#EFF6FF",
                              borderColor: isDark ? colors.border : "#BFDBFE",
                            },
                          ]}
                          onPress={() => {
                            if (chip.reset) {
                              setSimAmount(
                                String(selectedExpensePreset.amount),
                              );
                            } else {
                              const cur = parseFloat(simAmount) || 0;
                              setSimAmount(String(cur + (chip.val || 0)));
                            }
                          }}
                        >
                          <Text
                            style={[
                              styles.simChipBtnText,
                              { color: isDark ? "#60A5FA" : "#2563EB" },
                            ]}
                          >
                            {chip.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Select Card to Auto-Deduct From */}
                    <Text
                      style={[
                        styles.inputLabel,
                        {
                          color: isDark ? colors.textSecondary : "#475569",
                          marginTop: 14,
                          marginBottom: 6,
                        },
                      ]}
                    >
                      Deduct From Payment Card
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
                    >
                      {(wallet?.cards || []).map((card) => {
                        const isSelected = card.id === simCardId;
                        const presetConfig =
                          PHILIPPINE_CARD_PRESETS[card.type] ||
                          PHILIPPINE_CARD_PRESETS.custom;
                        return (
                          <TouchableOpacity
                            key={card.id}
                            style={[
                              styles.simCardOption,
                              {
                                backgroundColor: isSelected
                                  ? isDark
                                    ? "#1E3A8A"
                                    : "#EFF6FF"
                                  : isDark
                                    ? colors.surfaceInset
                                    : "#F8FAFC",
                                borderColor: isSelected
                                  ? "#2563EB"
                                  : isDark
                                    ? colors.border
                                    : "#E2E8F0",
                              },
                            ]}
                            onPress={() => setSimCardId(card.id)}
                            activeOpacity={0.7}
                          >
                            <View
                              style={[
                                styles.simCardColorDot,
                                { backgroundColor: presetConfig.accentColor },
                              ]}
                            />
                            <View>
                              <Text
                                style={[
                                  styles.simCardOptionName,
                                  {
                                    color: isSelected
                                      ? isDark
                                        ? "#93C5FD"
                                        : "#1D4ED8"
                                      : isDark
                                        ? colors.text
                                        : "#0F172A",
                                  },
                                ]}
                              >
                                {card.name}
                              </Text>
                              <Text
                                style={[
                                  styles.simCardOptionBal,
                                  {
                                    color: isDark
                                      ? colors.textMuted
                                      : "#64748B",
                                  },
                                ]}
                              >
                                ₱{(card.balance || 0).toLocaleString()}
                              </Text>
                            </View>
                            {isSelected && (
                              <Ionicons
                                name="checkmark-circle"
                                size={16}
                                color="#2563EB"
                                style={{ marginLeft: 6 }}
                              />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>

                    {/* Deduction Live Preview Callout */}
                    {currentCard && (
                      <View
                        style={[
                          styles.simPreviewCallout,
                          {
                            backgroundColor: isInsufficient
                              ? isDark
                                ? "#450A0A30"
                                : "#FEF2F2"
                              : isDark
                                ? colors.surfaceInset
                                : "#F0FDF4",
                            borderColor: isInsufficient
                              ? "#EF4444"
                              : isDark
                                ? colors.border
                                : "#BBF7D0",
                          },
                        ]}
                      >
                        <Ionicons
                          name={
                            isInsufficient
                              ? "alert-circle"
                              : "checkmark-circle-outline"
                          }
                          size={18}
                          color={isInsufficient ? "#EF4444" : "#10B981"}
                        />
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.simPreviewText,
                              {
                                color: isInsufficient
                                  ? "#EF4444"
                                  : isDark
                                    ? colors.text
                                    : "#15803D",
                              },
                            ]}
                          >
                            {isInsufficient
                              ? `Insufficient funds on ${currentCard.name} (Available: ₱${cardBal.toLocaleString()})`
                              : `Balance after deduction: ₱${balanceAfter.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* Expense Note / Memo */}
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginTop: 10,
                      }}
                    >
                      <Text
                        style={[
                          styles.inputLabel,
                          {
                            color: isDark ? colors.textSecondary : "#475569",
                            marginTop: 0,
                          },
                        ]}
                      >
                        Expense Note / Memo
                      </Text>
                      {Boolean(selectedExpensePreset.defaultNote) &&
                        simNote !== selectedExpensePreset.defaultNote && (
                          <TouchableOpacity
                            onPress={() =>
                              setSimNote(selectedExpensePreset.defaultNote)
                            }
                            hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
                          >
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: "600",
                                color: "#2563EB",
                              }}
                            >
                              Reset to preset note
                            </Text>
                          </TouchableOpacity>
                        )}
                    </View>
                    <View style={{ position: "relative" }}>
                      <TextInput
                        style={[
                          styles.modalTextInput,
                          {
                            backgroundColor: isDark
                              ? colors.surfaceInset
                              : "#F8FAFC",
                            borderColor: isDark ? colors.border : "#CBD5E1",
                            color: isDark ? colors.text : "#0F172A",
                            paddingRight: Boolean(simNote) ? 36 : 14,
                          },
                        ]}
                        value={simNote}
                        onChangeText={setSimNote}
                        placeholder="e.g. Afternoon latte & snack"
                        placeholderTextColor={
                          isDark ? colors.textMuted : "#94A3B8"
                        }
                      />
                      {Boolean(simNote) && (
                        <TouchableOpacity
                          onPress={() => setSimNote("")}
                          style={{
                            position: "absolute",
                            right: 10,
                            top: 14,
                          }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons
                            name="close-circle"
                            size={18}
                            color={isDark ? colors.textMuted : "#94A3B8"}
                          />
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Action Buttons */}
                    <TouchableOpacity
                      style={[
                        styles.modalPrimaryBtn,
                        (isInsufficient || expenseAmt <= 0) && {
                          backgroundColor: "#94A3B8",
                        },
                      ]}
                      onPress={handleExecuteSimulatedExpense}
                      disabled={
                        isSimulatingExpense || isInsufficient || expenseAmt <= 0
                      }
                      activeOpacity={0.8}
                    >
                      {isSimulatingExpense ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.modalPrimaryBtnText}>
                          {isInsufficient && expenseAmt > 0
                            ? `Insufficient Balance on ${currentCard?.name || "Card"}`
                            : expenseAmt <= 0
                              ? "Enter Expense Amount"
                              : `Simulate & Deduct ₱${expenseAmt.toLocaleString(
                                  "en-US",
                                  {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  },
                                )}`}
                        </Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.modalCancelBtn}
                      onPress={() => setShowExpenseSimModal(false)}
                    >
                      <Text
                        style={[
                          styles.modalCancelBtnText,
                          { color: isDark ? colors.textMuted : "#64748B" },
                        ]}
                      >
                        Cancel
                      </Text>
                    </TouchableOpacity>
                  </ScrollView>
                );
              })()}
          </View>
        </View>
      </Modal>

      {/* MODAL 2.7: Card-to-Card Transfer Bottom Sheet */}
      <Modal
        visible={showTransferModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTransferModal(false)}
        statusBarTranslucent={true}
      >
        <View style={dynamicModalOverlayStyle}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowTransferModal(false)}
          />
          <View
            style={[
              styles.modalSheet,
              {
                maxHeight: modalAdaptiveMaxHeight,
                backgroundColor: isDark ? colors.cardElevated : "#FFFFFF",
                borderColor: isDark ? colors.border : "transparent",
                borderWidth: isDark ? 1 : 0,
              },
            ]}
          >
            <View
              style={[
                styles.modalHandle,
                isDark && { backgroundColor: colors.textMuted },
              ]}
            />

            {(() => {
              const sourceCard = wallet?.cards.find(
                (c) => c.id === transferSourceCardId,
              );
              const destCard = wallet?.cards.find(
                (c) => c.id === transferDestCardId,
              );
              const sourceBal = sourceCard?.balance || 0;
              const destBal = destCard?.balance || 0;
              const transferAmt = parseFloat(transferAmount) || 0;
              const isInsufficient = sourceBal < transferAmt;
              const isSameCard = transferSourceCardId === transferDestCardId;

              return (
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  automaticallyAdjustKeyboardInsets={true}
                  style={{ maxHeight: effectiveKeyboardHeight > 0 ? 280 : 500 }}
                >
                  <View style={styles.transferHeaderRow}>
                    <View
                      style={[
                        styles.transferHeaderIconWrap,
                        {
                          backgroundColor: isDark ? "#312E81" : "#EEF2FF",
                        },
                      ]}
                    >
                      <Ionicons
                        name="swap-horizontal"
                        size={22}
                        color={isDark ? "#818CF8" : "#4F46E5"}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.modalTitle,
                          {
                            color: isDark ? colors.text : "#0F172A",
                            marginBottom: 2,
                          },
                        ]}
                      >
                        Transfer Between Cards
                      </Text>
                      <Text
                        style={[
                          styles.simModalSub,
                          { color: isDark ? colors.textMuted : "#64748B" },
                        ]}
                      >
                        Rebalance funds between linked cards & e-wallets
                      </Text>
                    </View>
                  </View>

                  {/* Transfer Source & Destination Card Selector */}
                  <View style={styles.transferPairContainer}>
                    {/* From Card */}
                    <View
                      style={[
                        styles.transferCardBox,
                        {
                          backgroundColor: isDark
                            ? colors.surfaceInset
                            : "#F8FAFC",
                          borderColor: isDark ? colors.border : "#E2E8F0",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.transferCardBoxLabel,
                          { color: isDark ? colors.textMuted : "#64748B" },
                        ]}
                      >
                        FROM (SOURCE)
                      </Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: 6, marginTop: 4 }}
                      >
                        {(wallet?.cards || []).map((card) => {
                          const isSel = card.id === transferSourceCardId;
                          return (
                            <TouchableOpacity
                              key={card.id}
                              style={[
                                styles.transferCardPill,
                                isSel && styles.transferCardPillActive,
                                {
                                  backgroundColor: isSel
                                    ? isDark
                                      ? "#1E3A8A"
                                      : "#EFF6FF"
                                    : isDark
                                      ? colors.background
                                      : "#FFFFFF",
                                  borderColor: isSel
                                    ? "#2563EB"
                                    : isDark
                                      ? colors.border
                                      : "#E2E8F0",
                                },
                              ]}
                              onPress={() => setTransferSourceCardId(card.id)}
                            >
                              <Text
                                style={[
                                  styles.transferCardPillName,
                                  {
                                    color: isSel
                                      ? isDark
                                        ? "#93C5FD"
                                        : "#1D4ED8"
                                      : isDark
                                        ? colors.text
                                        : "#0F172A",
                                  },
                                ]}
                              >
                                {card.name.split(" ")[0]}
                              </Text>
                              <Text
                                style={[
                                  styles.transferCardPillBal,
                                  {
                                    color: isDark
                                      ? colors.textMuted
                                      : "#64748B",
                                  },
                                ]}
                              >
                                ₱{(card.balance || 0).toLocaleString()}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>

                    {/* Swap Button */}
                    <TouchableOpacity
                      style={[
                        styles.transferSwapBtn,
                        {
                          backgroundColor: isDark ? colors.card : "#FFFFFF",
                          borderColor: isDark ? colors.border : "#CBD5E1",
                        },
                      ]}
                      onPress={() => {
                        const temp = transferSourceCardId;
                        setTransferSourceCardId(transferDestCardId);
                        setTransferDestCardId(temp);
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="swap-vertical"
                        size={18}
                        color="#2563EB"
                      />
                    </TouchableOpacity>

                    {/* To Card */}
                    <View
                      style={[
                        styles.transferCardBox,
                        {
                          backgroundColor: isDark
                            ? colors.surfaceInset
                            : "#F8FAFC",
                          borderColor: isDark ? colors.border : "#E2E8F0",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.transferCardBoxLabel,
                          { color: isDark ? colors.textMuted : "#64748B" },
                        ]}
                      >
                        TO (DESTINATION)
                      </Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: 6, marginTop: 4 }}
                      >
                        {(wallet?.cards || []).map((card) => {
                          const isSel = card.id === transferDestCardId;
                          return (
                            <TouchableOpacity
                              key={card.id}
                              style={[
                                styles.transferCardPill,
                                isSel && styles.transferCardPillActive,
                                {
                                  backgroundColor: isSel
                                    ? isDark
                                      ? "#064E3B"
                                      : "#ECFDF5"
                                    : isDark
                                      ? colors.background
                                      : "#FFFFFF",
                                  borderColor: isSel
                                    ? "#059669"
                                    : isDark
                                      ? colors.border
                                      : "#E2E8F0",
                                },
                              ]}
                              onPress={() => setTransferDestCardId(card.id)}
                            >
                              <Text
                                style={[
                                  styles.transferCardPillName,
                                  {
                                    color: isSel
                                      ? isDark
                                        ? "#6EE7B7"
                                        : "#047857"
                                      : isDark
                                        ? colors.text
                                        : "#0F172A",
                                  },
                                ]}
                              >
                                {card.name.split(" ")[0]}
                              </Text>
                              <Text
                                style={[
                                  styles.transferCardPillBal,
                                  {
                                    color: isDark
                                      ? colors.textMuted
                                      : "#64748B",
                                  },
                                ]}
                              >
                                ₱{(card.balance || 0).toLocaleString()}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  </View>

                  {/* Transfer Amount Input */}
                  <Text
                    style={[
                      styles.inputLabel,
                      {
                        color: isDark ? colors.textSecondary : "#475569",
                        marginTop: 12,
                      },
                    ]}
                  >
                    Transfer Amount (₱)
                  </Text>
                  <View
                    style={[
                      styles.simAmountInputRow,
                      {
                        backgroundColor: isDark
                          ? colors.surfaceInset
                          : "#F8FAFC",
                        borderColor: isDark ? colors.border : "#CBD5E1",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.simAmountCurrency,
                        { color: isDark ? "#818CF8" : "#4F46E5" },
                      ]}
                    >
                      ₱
                    </Text>
                    <TextInput
                      style={[
                        styles.simAmountTextInput,
                        { color: isDark ? colors.text : "#0F172A" },
                      ]}
                      value={transferAmount}
                      onChangeText={setTransferAmount}
                      keyboardType="numeric"
                      placeholder="0.00"
                      placeholderTextColor={
                        isDark ? colors.textMuted : "#94A3B8"
                      }
                    />
                  </View>

                  {/* Quick Amount Chips */}
                  <View style={styles.simChipRow}>
                    {[
                      { label: "₱200", val: 200 },
                      { label: "₱500", val: 500 },
                      { label: "₱1,000", val: 1000 },
                      { label: "₱2,500", val: 2500 },
                      { label: "Max", max: true },
                    ].map((chip, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.simChipBtn,
                          {
                            backgroundColor: isDark
                              ? colors.surfaceInset
                              : "#EEF2FF",
                            borderColor: isDark ? colors.border : "#C7D2FE",
                          },
                        ]}
                        onPress={() => {
                          if (chip.max) {
                            setTransferAmount(String(sourceBal));
                          } else {
                            setTransferAmount(String(chip.val));
                          }
                        }}
                      >
                        <Text
                          style={[
                            styles.simChipBtnText,
                            { color: isDark ? "#818CF8" : "#4F46E5" },
                          ]}
                        >
                          {chip.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Transfer Note / Purpose */}
                  <Text
                    style={[
                      styles.inputLabel,
                      {
                        color: isDark ? colors.textSecondary : "#475569",
                        marginTop: 10,
                      },
                    ]}
                  >
                    Transfer Memo (Optional)
                  </Text>
                  <TextInput
                    style={[
                      styles.modalTextInput,
                      {
                        backgroundColor: isDark
                          ? colors.surfaceInset
                          : "#F8FAFC",
                        borderColor: isDark ? colors.border : "#CBD5E1",
                        color: isDark ? colors.text : "#0F172A",
                      },
                    ]}
                    value={transferNote}
                    onChangeText={setTransferNote}
                    placeholder="e.g. Card rebalancing / bill allocation"
                    placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
                  />

                  {/* Balance Impact Live Summary */}
                  {sourceCard && destCard && (
                    <View
                      style={[
                        styles.transferSummaryBox,
                        {
                          backgroundColor:
                            isInsufficient || isSameCard
                              ? isDark
                                ? "#450A0A30"
                                : "#FEF2F2"
                              : isDark
                                ? colors.surfaceInset
                                : "#F0FDF4",
                          borderColor:
                            isInsufficient || isSameCard
                              ? "#EF4444"
                              : isDark
                                ? colors.border
                                : "#BBF7D0",
                        },
                      ]}
                    >
                      <Ionicons
                        name={
                          isInsufficient || isSameCard
                            ? "alert-circle"
                            : "swap-horizontal"
                        }
                        size={18}
                        color={
                          isInsufficient || isSameCard ? "#EF4444" : "#10B981"
                        }
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.simPreviewText,
                            {
                              color:
                                isInsufficient || isSameCard
                                  ? "#EF4444"
                                  : isDark
                                    ? colors.text
                                    : "#15803D",
                            },
                          ]}
                        >
                          {isSameCard
                            ? "Source and destination cards must be different accounts."
                            : isInsufficient
                              ? `Insufficient balance on ${sourceCard.name} (Available: ₱${sourceBal.toLocaleString()})`
                              : `${sourceCard.name}: ₱${Math.max(0, sourceBal - transferAmt).toLocaleString()}  ➔  ${destCard.name}: ₱${(destBal + transferAmt).toLocaleString()}`}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Confirm Button */}
                  <TouchableOpacity
                    style={[
                      styles.modalPrimaryBtn,
                      { backgroundColor: "#4F46E5" },
                      (isInsufficient || isSameCard || transferAmt <= 0) && {
                        backgroundColor: "#94A3B8",
                      },
                    ]}
                    onPress={handleExecuteTransfer}
                    disabled={
                      isTransferring ||
                      isInsufficient ||
                      isSameCard ||
                      transferAmt <= 0
                    }
                    activeOpacity={0.8}
                  >
                    {isTransferring ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.modalPrimaryBtnText}>
                        {isSameCard
                          ? "Select Different Accounts"
                          : isInsufficient && transferAmt > 0
                            ? `Insufficient Balance on ${sourceCard?.name || "Card"}`
                            : transferAmt <= 0
                              ? "Enter Transfer Amount"
                              : `Confirm Transfer ₱${transferAmt.toLocaleString(
                                  "en-US",
                                  {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  },
                                )}`}
                      </Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalCancelBtn}
                    onPress={() => setShowTransferModal(false)}
                  >
                    <Text
                      style={[
                        styles.modalCancelBtnText,
                        { color: isDark ? colors.textMuted : "#64748B" },
                      ]}
                    >
                      Cancel
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* MODAL 2.8: Quick Cash Expense Logger */}
      <Modal
        visible={showCashExpenseModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCashExpenseModal(false)}
        statusBarTranslucent={true}
      >
        <View style={dynamicModalOverlayStyle}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowCashExpenseModal(false)}
          />
          <View
            style={[
              styles.modalSheet,
              {
                maxHeight: modalAdaptiveMaxHeight,
                backgroundColor: isDark ? colors.cardElevated : "#FFFFFF",
                borderColor: isDark ? colors.border : "transparent",
                borderWidth: isDark ? 1 : 0,
              },
            ]}
          >
            <View
              style={[
                styles.modalHandle,
                isDark && { backgroundColor: colors.textMuted },
              ]}
            />

            {(() => {
              const cashCard =
                wallet?.cards.find((c) => c.id === selectedCashCardId) ||
                wallet?.cards.find((c) => c.type === "cash") ||
                wallet?.cards[0];
              const cashBal = cashCard?.balance || 0;
              const expenseAmt = parseFloat(cashExpenseAmount) || 0;
              const isInsufficient = cashBal < expenseAmt;

              return (
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  automaticallyAdjustKeyboardInsets={true}
                  style={{ maxHeight: effectiveKeyboardHeight > 0 ? 280 : 500 }}
                >
                  <View style={styles.simModalHeaderRow}>
                    <View
                      style={[
                        styles.simModalIconWrap,
                        { backgroundColor: "#065F46" },
                      ]}
                    >
                      <Ionicons name="cash" size={24} color="#34D399" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.modalTitle,
                          {
                            color: isDark ? colors.text : "#0F172A",
                            marginBottom: 2,
                          },
                        ]}
                      >
                        Record Cash Expense
                      </Text>
                      <Text
                        style={[
                          styles.simModalSub,
                          { color: isDark ? colors.textMuted : "#64748B" },
                        ]}
                      >
                        Deduct directly from physical Cash on Hand
                      </Text>
                    </View>
                  </View>

                  {/* Cash Card Source Pill */}
                  {cashCard && (
                    <View
                      style={[
                        styles.cashSourcePill,
                        {
                          backgroundColor: isDark ? "#064E3B30" : "#ECFDF5",
                          borderColor: isDark ? "#047857" : "#A7F3D0",
                        },
                      ]}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Ionicons
                          name="wallet-outline"
                          size={16}
                          color="#059669"
                        />
                        <Text
                          style={[
                            styles.cashSourcePillTitle,
                            { color: isDark ? "#6EE7B7" : "#065F46" },
                          ]}
                        >
                          {cashCard.name}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.cashSourcePillBal,
                          { color: isDark ? "#A7F3D0" : "#047857" },
                        ]}
                      >
                        ₱{(cashBal ?? 0).toLocaleString()} available
                      </Text>
                    </View>
                  )}

                  {/* Amount Input */}
                  <Text
                    style={[
                      styles.inputLabel,
                      {
                        color: isDark ? colors.textSecondary : "#475569",
                        marginTop: 12,
                      },
                    ]}
                  >
                    Cash Amount (₱)
                  </Text>
                  <View
                    style={[
                      styles.simAmountInputRow,
                      {
                        backgroundColor: isDark
                          ? colors.surfaceInset
                          : "#F8FAFC",
                        borderColor: isDark ? colors.border : "#CBD5E1",
                      },
                    ]}
                  >
                    <Text
                      style={[styles.simAmountCurrency, { color: "#059669" }]}
                    >
                      ₱
                    </Text>
                    <TextInput
                      style={[
                        styles.simAmountTextInput,
                        { color: isDark ? colors.text : "#0F172A" },
                      ]}
                      value={cashExpenseAmount}
                      onChangeText={setCashExpenseAmount}
                      keyboardType="numeric"
                      placeholder="0.00"
                      placeholderTextColor={
                        isDark ? colors.textMuted : "#94A3B8"
                      }
                    />
                  </View>

                  {/* Philippine Cash Quick Presets */}
                  <View style={styles.simChipRow}>
                    {[
                      {
                        label: "₱20 Jeep",
                        val: 20,
                        desc: "Jeepney Fare",
                        cat: "Commute",
                      },
                      {
                        label: "₱35 Sari-sari",
                        val: 35,
                        desc: "Sari-sari Store Snack",
                        cat: "Snack",
                      },
                      {
                        label: "₱50 Trike",
                        val: 50,
                        desc: "Tricycle / Parking",
                        cat: "Commute",
                      },
                      {
                        label: "₱85 Lunch",
                        val: 85,
                        desc: "Karinderya Meal",
                        cat: "Food",
                      },
                      {
                        label: "₱250 Market",
                        val: 250,
                        desc: "Palengke Supplies",
                        cat: "Groceries",
                      },
                    ].map((p, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.simChipBtn,
                          {
                            backgroundColor: isDark
                              ? colors.surfaceInset
                              : "#ECFDF5",
                            borderColor: isDark ? colors.border : "#A7F3D0",
                          },
                        ]}
                        onPress={() => {
                          setCashExpenseAmount(String(p.val));
                          setCashExpenseTitle(p.desc);
                          setCashExpenseCategory(p.cat);
                        }}
                      >
                        <Text
                          style={[styles.simChipBtnText, { color: "#059669" }]}
                        >
                          {p.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Expense Description */}
                  <Text
                    style={[
                      styles.inputLabel,
                      {
                        color: isDark ? colors.textSecondary : "#475569",
                        marginTop: 12,
                      },
                    ]}
                  >
                    Expense Title / For What
                  </Text>
                  <TextInput
                    style={[
                      styles.modalTextInput,
                      {
                        backgroundColor: isDark
                          ? colors.surfaceInset
                          : "#F8FAFC",
                        borderColor: isDark ? colors.border : "#CBD5E1",
                        color: isDark ? colors.text : "#0F172A",
                      },
                    ]}
                    value={cashExpenseTitle}
                    onChangeText={setCashExpenseTitle}
                    placeholder="e.g. Jeepney fare, Karinderya lunch, snacks"
                    placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
                  />

                  {/* Live Impact Preview */}
                  <View
                    style={[
                      styles.simPreviewCallout,
                      {
                        backgroundColor: isInsufficient
                          ? isDark
                            ? "#450A0A30"
                            : "#FEF2F2"
                          : isDark
                            ? colors.surfaceInset
                            : "#F0FDF4",
                        borderColor: isInsufficient
                          ? "#EF4444"
                          : isDark
                            ? colors.border
                            : "#BBF7D0",
                        marginTop: 10,
                      },
                    ]}
                  >
                    <Ionicons
                      name={isInsufficient ? "alert-circle" : "cash-outline"}
                      size={18}
                      color={isInsufficient ? "#EF4444" : "#10B981"}
                    />
                    <Text
                      style={[
                        styles.simPreviewText,
                        {
                          color: isInsufficient
                            ? "#EF4444"
                            : isDark
                              ? colors.text
                              : "#15803D",
                        },
                      ]}
                    >
                      {isInsufficient
                        ? `Insufficient cash on hand (₱${(cashBal ?? 0).toLocaleString()} available)`
                        : `Cash on hand after expense: ₱${Math.max(0, (cashBal ?? 0) - expenseAmt).toLocaleString()}`}
                    </Text>
                  </View>

                  {/* Confirm Button */}
                  <TouchableOpacity
                    style={[
                      styles.modalPrimaryBtn,
                      { backgroundColor: "#059669", marginTop: 14 },
                      (isInsufficient || expenseAmt <= 0) && {
                        backgroundColor: "#94A3B8",
                      },
                    ]}
                    onPress={handleExecuteCashExpense}
                    disabled={
                      isRecordingCashExpense ||
                      isInsufficient ||
                      expenseAmt <= 0
                    }
                    activeOpacity={0.8}
                  >
                    {isRecordingCashExpense ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.modalPrimaryBtnText}>
                        Log ₱{(expenseAmt ?? 0).toLocaleString()} Cash Spent
                      </Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalCancelBtn}
                    onPress={() => setShowCashExpenseModal(false)}
                  >
                    <Text
                      style={[
                        styles.modalCancelBtnText,
                        { color: isDark ? colors.textMuted : "#64748B" },
                      ]}
                    >
                      Cancel
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* MODAL 2.9: Cash Finance & Expense Automation Suite */}
      <Modal
        visible={showCashAutomationModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCashAutomationModal(false)}
        statusBarTranslucent={true}
      >
        <View style={dynamicModalOverlayStyle}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowCashAutomationModal(false)}
          />
          <View
            style={[
              styles.modalSheet,
              {
                maxHeight: modalAdaptiveMaxHeight,
                backgroundColor: isDark ? colors.cardElevated : "#FFFFFF",
                borderColor: isDark ? colors.border : "transparent",
                borderWidth: isDark ? 1 : 0,
              },
            ]}
          >
            <View
              style={[
                styles.modalHandle,
                isDark && { backgroundColor: colors.textMuted },
              ]}
            />

            {(() => {
              const cashCard =
                wallet?.cards.find((c) => c.id === selectedCashCardId) ||
                wallet?.cards.find((c) => c.type === "cash") ||
                wallet?.cards[0];
              const cashBal = cashCard?.balance || 0;
              const activeRules = cashRules.filter(
                (r) => r.enabled && r.amount > 0,
              );
              const totalDailyAuto = activeRules.reduce(
                (sum, r) => sum + r.amount,
                0,
              );
              const isInsufficient = cashBal < totalDailyAuto;

              return (
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ paddingBottom: 24 }}
                >
                  <View style={styles.simModalHeaderRow}>
                    <View
                      style={[
                        styles.simModalIconWrap,
                        { backgroundColor: "#064E3B" },
                      ]}
                    >
                      <Ionicons name="sparkles" size={24} color="#34D399" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.modalTitle,
                          {
                            color: isDark ? colors.text : "#0F172A",
                            marginBottom: 2,
                          },
                        ]}
                      >
                        Automate Cash Expenses
                      </Text>
                      <Text
                        style={[
                          styles.simModalSub,
                          { color: isDark ? colors.textMuted : "#64748B" },
                        ]}
                      >
                        Auto-finance and schedule physical cash expenditures
                      </Text>
                    </View>
                  </View>

                  {/* Cash Health & Denominations Card */}
                  <LinearGradient
                    colors={["#064E3B", "#065F46"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.cashAutoHealthCard}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Text style={styles.cashAutoHealthLabel}>
                        CURRENT CASH ON HAND
                      </Text>
                      <View style={styles.cashAutoLiveDot} />
                    </View>
                    <Text style={styles.cashAutoHealthAmount}>
                      ₱
                      {(cashBal ?? 0).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </Text>
                    <View style={styles.cashAutoHealthFooter}>
                      <Text style={styles.cashAutoHealthFooterText}>
                        Estimated: ₱1,000s, ₱500s, ₱100s & Coins
                      </Text>
                      <Text style={styles.cashAutoHealthBurn}>
                        ₱{totalDailyAuto}/day active burn
                      </Text>
                    </View>
                  </LinearGradient>

                  {/* Configured Automation Rules */}
                  <Text
                    style={[
                      styles.inputLabel,
                      {
                        color: isDark ? colors.textSecondary : "#475569",
                        marginTop: 14,
                        marginBottom: 6,
                      },
                    ]}
                  >
                    Daily Cash Expense Rules
                  </Text>

                  <View style={{ gap: 8 }}>
                    {cashRules.map((rule) => (
                      <View
                        key={rule.id}
                        style={[
                          styles.cashRuleItem,
                          {
                            backgroundColor: isDark
                              ? colors.surfaceInset
                              : "#F8FAFC",
                            borderColor: rule.enabled
                              ? isDark
                                ? "#047857"
                                : "#A7F3D0"
                              : isDark
                                ? colors.border
                                : "#E2E8F0",
                          },
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <Ionicons
                              name={
                                rule.category === "commute"
                                  ? "bus-outline"
                                  : rule.category === "food"
                                    ? "restaurant-outline"
                                    : "storefront-outline"
                              }
                              size={16}
                              color={rule.enabled ? "#059669" : "#94A3B8"}
                            />
                            <Text
                              style={[
                                styles.cashRuleTitle,
                                {
                                  color: rule.enabled
                                    ? isDark
                                      ? colors.text
                                      : "#0F172A"
                                    : colors.textMuted,
                                },
                              ]}
                            >
                              {rule.title}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.cashRuleSub,
                              { color: isDark ? colors.textMuted : "#64748B" },
                            ]}
                          >
                            ₱{rule.amount} / day • {rule.frequency}
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={[
                            styles.cashRuleToggleBtn,
                            rule.enabled
                              ? { backgroundColor: "#059669" }
                              : {
                                  backgroundColor: isDark
                                    ? colors.border
                                    : "#CBD5E1",
                                },
                          ]}
                          onPress={() => handleToggleCashRule(rule.id)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.cashRuleToggleText}>
                            {rule.enabled ? "ACTIVE" : "PAUSED"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>

                  {/* 1-Tap Execute Today's Auto Cash Burn */}
                  <TouchableOpacity
                    style={[
                      styles.modalPrimaryBtn,
                      { backgroundColor: "#059669", marginTop: 14 },
                      (isInsufficient || totalDailyAuto <= 0) && {
                        backgroundColor: "#94A3B8",
                      },
                    ]}
                    onPress={handleRunCashAutoExpenses}
                    disabled={
                      isExecutingCashAuto ||
                      isInsufficient ||
                      totalDailyAuto <= 0
                    }
                    activeOpacity={0.8}
                  >
                    {isExecutingCashAuto ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <Ionicons name="flash" size={18} color="#FFFFFF" />
                        <Text style={styles.modalPrimaryBtnText}>
                          Run Today's Auto Cash (₱{totalDailyAuto})
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Replenish Cash Action */}
                  <TouchableOpacity
                    style={[
                      styles.cashReplenishBtn,
                      {
                        backgroundColor: isDark
                          ? colors.surfaceInset
                          : "#EFF6FF",
                        borderColor: isDark ? colors.border : "#BFDBFE",
                      },
                    ]}
                    onPress={() => {
                      setShowCashAutomationModal(false);
                      handleOpenTransfer(undefined);
                    }}
                    activeOpacity={0.75}
                  >
                    <Ionicons
                      name="arrow-down-circle"
                      size={18}
                      color="#2563EB"
                    />
                    <Text style={styles.cashReplenishBtnText}>
                      Replenish Cash on Hand from Linked Bank Card
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalCancelBtn}
                    onPress={() => setShowCashAutomationModal(false)}
                  >
                    <Text
                      style={[
                        styles.modalCancelBtnText,
                        { color: isDark ? colors.textMuted : "#64748B" },
                      ]}
                    >
                      Done
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* MODAL 3: Create Savings Pocket */}
      <Modal
        visible={showAddPocketModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddPocketModal(false)}
        statusBarTranslucent={true}
      >
        <View style={dynamicModalOverlayStyle}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowAddPocketModal(false)}
          />
          <View
            style={[
              styles.modalSheet,
              {
                maxHeight: modalAdaptiveMaxHeight,
                backgroundColor: isDark ? colors.cardElevated : "#FFFFFF",
                borderColor: isDark ? colors.border : "transparent",
                borderWidth: isDark ? 1 : 0,
              },
            ]}
          >
            <View
              style={[
                styles.modalHandle,
                isDark && { backgroundColor: colors.textMuted },
              ]}
            />
            <Text
              style={[
                styles.modalTitle,
                { color: isDark ? colors.text : "#0F172A" },
              ]}
            >
              New Savings Pocket
            </Text>
            <Text
              style={[
                styles.modalSubtitle,
                { color: isDark ? colors.textMuted : "#64748B" },
              ]}
            >
              Set aside money for utility cushions, rent deposits or trips
            </Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets={true}
              style={{ maxHeight: effectiveKeyboardHeight > 0 ? 280 : 500 }}
            >
              <Text
                style={[
                  styles.inputLabel,
                  { color: isDark ? colors.textSecondary : "#475569" },
                ]}
              >
                Pocket Name
              </Text>
              <TextInput
                style={[
                  styles.modalTextInput,
                  {
                    backgroundColor: isDark ? colors.surfaceInset : "#F8FAFC",
                    borderColor: isDark ? colors.border : "#CBD5E1",
                    color: isDark ? colors.text : "#0F172A",
                  },
                ]}
                placeholder="e.g. Condo Security Deposit"
                placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
                value={pocketName}
                onChangeText={setPocketName}
              />

              <Text
                style={[
                  styles.inputLabel,
                  { color: isDark ? colors.textSecondary : "#475569" },
                ]}
              >
                Target Goal Amount (₱)
              </Text>
              <TextInput
                style={[
                  styles.modalTextInput,
                  {
                    backgroundColor: isDark ? colors.surfaceInset : "#F8FAFC",
                    borderColor: isDark ? colors.border : "#CBD5E1",
                    color: isDark ? colors.text : "#0F172A",
                  },
                ]}
                placeholder="10000"
                placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
                keyboardType="numeric"
                value={pocketTarget}
                onChangeText={setPocketTarget}
              />

              <Text
                style={[
                  styles.inputLabel,
                  { color: isDark ? colors.textSecondary : "#475569" },
                ]}
              >
                Category
              </Text>
              <View style={styles.sourcesRow}>
                {[
                  {
                    cat: "emergency",
                    label: "Emergency",
                    icon: "shield-checkmark",
                  },
                  { cat: "travel", label: "Travel", icon: "airplane" },
                  { cat: "deposit", label: "Deposit", icon: "home" },
                  { cat: "bills", label: "Bills Buffer", icon: "receipt" },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.cat}
                    style={[
                      styles.sourceCard,
                      pocketCategory === item.cat
                        ? {
                            borderColor: "#2563EB",
                            backgroundColor: "#2563EB15",
                          }
                        : {
                            borderColor: isDark ? colors.border : "#E2E8F0",
                            backgroundColor: isDark
                              ? colors.surfaceInset
                              : "#FFFFFF",
                          },
                    ]}
                    onPress={() => setPocketCategory(item.cat as any)}
                  >
                    <Ionicons
                      name={item.icon as any}
                      size={18}
                      color={
                        pocketCategory === item.cat
                          ? "#2563EB"
                          : isDark
                            ? colors.textMuted
                            : "#64748B"
                      }
                    />
                    <Text
                      style={[
                        styles.sourceText,
                        {
                          color:
                            pocketCategory === item.cat
                              ? "#2563EB"
                              : isDark
                                ? colors.text
                                : "#0F172A",
                        },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={styles.modalPrimaryBtn}
                onPress={handleCreatePocket}
                activeOpacity={0.8}
              >
                <Text style={styles.modalPrimaryBtnText}>Create Pocket</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowAddPocketModal(false)}
              >
                <Text
                  style={[
                    styles.modalCancelBtnText,
                    { color: isDark ? colors.textMuted : "#64748B" },
                  ]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL 4: Stash or Withdraw from Pocket */}
      <Modal
        visible={showPocketActionModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPocketActionModal(false)}
        statusBarTranslucent={true}
      >
        <View style={dynamicModalOverlayStyle}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowPocketActionModal(false)}
          />
          <View
            style={[
              styles.modalSheet,
              {
                maxHeight: modalAdaptiveMaxHeight,
                backgroundColor: isDark ? colors.cardElevated : "#FFFFFF",
                borderColor: isDark ? colors.border : "transparent",
                borderWidth: isDark ? 1 : 0,
              },
            ]}
          >
            <View
              style={[
                styles.modalHandle,
                isDark && { backgroundColor: colors.textMuted },
              ]}
            />
            <Text
              style={[
                styles.modalTitle,
                { color: isDark ? colors.text : "#0F172A" },
              ]}
            >
              {pocketActionType === "deposit"
                ? `Stash into "${selectedPocket?.name}"`
                : `Withdraw from "${selectedPocket?.name}"`}
            </Text>
            <Text
              style={[
                styles.modalSubtitle,
                { color: isDark ? colors.textMuted : "#64748B" },
              ]}
            >
              {pocketActionType === "deposit"
                ? `Move funds from your wallet balance (₱${(balance ?? 0).toLocaleString()} available)`
                : `Move funds back to your wallet balance (₱${(selectedPocket?.currentAmount ?? 0).toLocaleString()} in pocket)`}
            </Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets={true}
              style={{ maxHeight: effectiveKeyboardHeight > 0 ? 280 : 500 }}
            >
              <View style={styles.quickAmountsRow}>
                {["200", "500", "1000", "2000"].map((preset) => (
                  <TouchableOpacity
                    key={preset}
                    style={[
                      styles.quickPill,
                      pocketTransferAmount === preset
                        ? { backgroundColor: "#2563EB" }
                        : {
                            backgroundColor: isDark
                              ? colors.surfaceInset
                              : "#F1F5F9",
                            borderWidth: 1,
                            borderColor: isDark ? colors.border : "#E2E8F0",
                          },
                    ]}
                    onPress={() => setPocketTransferAmount(preset)}
                  >
                    <Text
                      style={[
                        styles.quickPillText,
                        {
                          color:
                            pocketTransferAmount === preset
                              ? "#FFFFFF"
                              : isDark
                                ? colors.text
                                : "#0F172A",
                        },
                      ]}
                    >
                      ₱{preset}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View
                style={[
                  styles.amountInputWrap,
                  {
                    backgroundColor: isDark ? colors.surfaceInset : "#F8FAFC",
                    borderColor: isDark ? colors.border : "#CBD5E1",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.currencyPrefix,
                    { color: isDark ? colors.textMuted : "#64748B" },
                  ]}
                >
                  ₱
                </Text>
                <TextInput
                  style={[
                    styles.amountInput,
                    { color: isDark ? colors.text : "#0F172A" },
                  ]}
                  keyboardType="numeric"
                  value={pocketTransferAmount}
                  onChangeText={setPocketTransferAmount}
                  placeholder="0.00"
                  placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
                />
              </View>

              {/* Select Card to Deduct From (when stashing) or Withdraw To (when withdrawing) */}
              <Text
                style={[
                  styles.inputLabel,
                  {
                    color: isDark ? colors.textSecondary : "#475569",
                    marginTop: 14,
                    marginBottom: 6,
                  },
                ]}
              >
                {pocketActionType === "deposit"
                  ? "Deduct From Configured Card"
                  : "Withdraw To Configured Card"}
              </Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
              >
                {(wallet?.cards || []).map((c) => {
                  const isSelected =
                    (pocketSelectedCardId ||
                      wallet?.cards.find((x) => x.isDefault)?.id ||
                      wallet?.cards[0]?.id) === c.id;
                  const preset =
                    PHILIPPINE_CARD_PRESETS[c.type] ||
                    PHILIPPINE_CARD_PRESETS.custom;
                  const isCashCard = c.type === "cash";

                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[
                        styles.pocketCardOption,
                        isSelected
                          ? {
                              borderColor: isCashCard ? "#059669" : "#2563EB",
                              backgroundColor: isDark
                                ? isCashCard
                                  ? "#064E3B40"
                                  : "#1E3A8A35"
                                : isCashCard
                                  ? "#ECFDF5"
                                  : "#EFF6FF",
                            }
                          : {
                              borderColor: isDark ? colors.border : "#E2E8F0",
                              backgroundColor: isDark
                                ? colors.surfaceInset
                                : "#FFFFFF",
                            },
                      ]}
                      onPress={() => setPocketSelectedCardId(c.id)}
                      activeOpacity={0.75}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                          marginBottom: 3,
                        }}
                      >
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: preset?.gradient[0] || "#2563EB",
                          }}
                        />
                        <Text
                          style={[
                            styles.pocketCardOptionName,
                            {
                              color: isSelected
                                ? isCashCard
                                  ? "#059669"
                                  : "#2563EB"
                                : isDark
                                  ? colors.text
                                  : "#0F172A",
                              fontWeight: isSelected ? "700" : "600",
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {c.name}
                        </Text>
                        {c.isDefault && (
                          <View style={styles.cardDefaultMiniBadge}>
                            <Text style={styles.cardDefaultMiniText}>
                              PRIMARY
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.pocketCardOptionAccount,
                          { color: isDark ? colors.textMuted : "#64748B" },
                        ]}
                      >
                        {c.accountNumber}
                      </Text>
                      <Text
                        style={[
                          styles.pocketCardOptionBal,
                          {
                            color: isSelected
                              ? isCashCard
                                ? "#047857"
                                : "#1D4ED8"
                              : isDark
                                ? colors.text
                                : "#0F172A",
                          },
                        ]}
                      >
                        ₱
                        {(c.balance || 0).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Live Impact Preview */}
              {(() => {
                const activeCard =
                  wallet?.cards.find(
                    (c) =>
                      c.id ===
                      (pocketSelectedCardId ||
                        wallet?.cards.find((x) => x.isDefault)?.id ||
                        wallet?.cards[0]?.id),
                  ) || wallet?.cards[0];
                const num = parseFloat(pocketTransferAmount) || 0;
                const cardBal = activeCard?.balance || 0;
                const isInsufficient =
                  pocketActionType === "deposit" && cardBal < num;

                if (!activeCard) return null;

                return (
                  <View
                    style={[
                      styles.pocketPreviewBox,
                      {
                        backgroundColor: isInsufficient
                          ? isDark
                            ? "#450A0A30"
                            : "#FEF2F2"
                          : isDark
                            ? colors.surfaceInset
                            : "#F0FDF4",
                        borderColor: isInsufficient
                          ? "#EF4444"
                          : isDark
                            ? colors.border
                            : "#BBF7D0",
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        isInsufficient ? "alert-circle" : "information-circle"
                      }
                      size={16}
                      color={isInsufficient ? "#EF4444" : "#10B981"}
                    />
                    <Text
                      style={[
                        styles.pocketPreviewText,
                        {
                          color: isInsufficient
                            ? "#EF4444"
                            : isDark
                              ? colors.text
                              : "#15803D",
                        },
                      ]}
                    >
                      {pocketActionType === "deposit"
                        ? isInsufficient
                          ? `Insufficient balance on ${activeCard.name} (₱${cardBal.toLocaleString()} available)`
                          : `After saving: ${activeCard.name} balance will be ₱${Math.max(0, cardBal - num).toLocaleString()}`
                        : `After withdrawal: ${activeCard.name} balance will be ₱${(cardBal + num).toLocaleString()}`}
                    </Text>
                  </View>
                );
              })()}

              {(() => {
                const activeCard =
                  wallet?.cards.find(
                    (c) =>
                      c.id ===
                      (pocketSelectedCardId ||
                        wallet?.cards.find((x) => x.isDefault)?.id ||
                        wallet?.cards[0]?.id),
                  ) || wallet?.cards[0];
                const num = parseFloat(pocketTransferAmount) || 0;
                const cardBal = activeCard?.balance || 0;
                const isInsufficient =
                  pocketActionType === "deposit"
                    ? cardBal < num
                    : (selectedPocket?.currentAmount || 0) < num;

                return (
                  <TouchableOpacity
                    style={[
                      styles.modalPrimaryBtn,
                      (isInsufficient || num <= 0) && {
                        backgroundColor: "#94A3B8",
                      },
                    ]}
                    disabled={isInsufficient || num <= 0}
                    onPress={handlePocketTransfer}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.modalPrimaryBtnText}>
                      {isInsufficient && num > 0
                        ? `Insufficient Balance on ${pocketActionType === "deposit" ? activeCard?.name || "Card" : selectedPocket?.name || "Pocket"}`
                        : num <= 0
                          ? "Enter Amount"
                          : `Confirm ${pocketActionType === "deposit" ? "Deposit" : "Withdrawal"} of ₱${num.toLocaleString(
                              "en-US",
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              },
                            )}`}
                    </Text>
                  </TouchableOpacity>
                );
              })()}

              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowPocketActionModal(false)}
              >
                <Text
                  style={[
                    styles.modalCancelBtnText,
                    { color: isDark ? colors.textMuted : "#64748B" },
                  ]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL 5: Transaction Receipt Details */}
      <Modal
        visible={Boolean(selectedTx)}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setSelectedTx(null);
          setIsEditingTxNote(false);
        }}
        statusBarTranslucent={true}
      >
        <View style={dynamicModalOverlayStyle}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => {
              setSelectedTx(null);
              setIsEditingTxNote(false);
            }}
          />
          <View
            style={[
              styles.receiptSheet,
              {
                maxHeight: modalAdaptiveMaxHeight,
                backgroundColor: isDark ? colors.cardElevated : "#FFFFFF",
                borderColor: isDark ? colors.border : "transparent",
                borderWidth: isDark ? 1 : 0,
              },
            ]}
          >
            <View
              style={[
                styles.modalHandle,
                isDark && { backgroundColor: colors.textMuted },
              ]}
            />
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 24 }}
            >
              {(() => {
                const isExpense =
                  selectedTx?.type === "expense_simulation" ||
                  selectedTx?.type === "cash_expense";
                if (isExpense && selectedTx) {
                  const iconData = getExpenseSemanticIconMobile(selectedTx);
                  return (
                    <View
                      style={[
                        styles.receiptTopCircle,
                        {
                          backgroundColor: iconData.bg,
                          padding: 14,
                          borderRadius: 36,
                          alignItems: "center",
                          justifyContent: "center",
                        },
                      ]}
                    >
                      <Ionicons
                        name={iconData.icon}
                        size={36}
                        color={iconData.color}
                      />
                    </View>
                  );
                }
                return (
                  <View style={styles.receiptTopCircle}>
                    <Ionicons
                      name="checkmark-circle"
                      size={48}
                      color="#10B981"
                    />
                  </View>
                );
              })()}

              <Text
                style={[
                  styles.receiptTitle,
                  { color: isDark ? colors.text : "#0F172A" },
                ]}
              >
                {selectedTx?.type === "expense_simulation" ||
                selectedTx?.type === "cash_expense"
                  ? "Expense Receipt"
                  : selectedTx?.type === "cash_in"
                    ? "Top-up Receipt"
                    : "Payment Receipt"}
              </Text>
              <Text style={styles.receiptAmount}>
                ₱{(selectedTx?.amount ?? 0).toLocaleString()}
              </Text>

              {/* Prominent Expense Note / Source Box */}
              {(() => {
                const matchedPreset = QUICK_EXPENSE_PRESETS.find(
                  (p: QuickExpensePreset) =>
                    p.title.toLowerCase() ===
                      selectedTx?.title?.toLowerCase() ||
                    p.id.toLowerCase() === selectedTx?.title?.toLowerCase(),
                );
                const rawNote = selectedTx?.note?.trim() || "";
                const rawSource = (selectedTx as any)?.source?.trim() || "";
                const rawDesc = selectedTx?.description?.trim() || "";
                const isGenericDesc =
                  rawDesc.startsWith("Daily simulated expense") ||
                  rawDesc.startsWith("Added ₱") ||
                  rawDesc.startsWith("Transferred ₱");

                const customNote =
                  rawNote ||
                  (!isGenericDesc ? rawDesc : "") ||
                  (selectedTx?.type === "cash_in" ? rawSource : "");
                const displayExpenseNote =
                  customNote ||
                  matchedPreset?.defaultNote ||
                  (selectedTx?.type === "cash_in"
                    ? "Digital wallet top-up"
                    : "Daily transaction record");

                return (
                  <View
                    style={[
                      styles.receiptNoteCard,
                      {
                        backgroundColor: isDark
                          ? colors.surfaceInset
                          : "#F8FAFC",
                        borderColor: isDark ? colors.border : "#E2E8F0",
                      },
                    ]}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: isEditingTxNote ? 8 : 4,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Ionicons
                          name={
                            selectedTx?.type === "cash_in"
                              ? "wallet"
                              : "document-text"
                          }
                          size={14}
                          color="#2563EB"
                        />
                        <Text
                          style={[
                            styles.receiptNoteLabel,
                            { color: isDark ? colors.textMuted : "#64748B" },
                          ]}
                        >
                          {selectedTx?.type === "cash_in"
                            ? "MONEY SOURCE / ORIGIN"
                            : "EXPENSE NOTE"}
                        </Text>
                      </View>
                      {!isEditingTxNote && (
                        <TouchableOpacity
                          onPress={handleStartEditTxNote}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderRadius: 6,
                            backgroundColor: isDark ? "#1E293B" : "#EFF6FF",
                          }}
                          activeOpacity={0.7}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <Ionicons name="pencil" size={11} color="#2563EB" />
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: "700",
                              color: "#2563EB",
                            }}
                          >
                            Edit Note
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {isEditingTxNote ? (
                      <View style={{ marginTop: 4 }}>
                        <TextInput
                          style={[
                            styles.modalTextInput,
                            {
                              backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
                              borderColor: "#2563EB",
                              color: isDark ? colors.text : "#0F172A",
                              fontSize: 14,
                              paddingVertical: 8,
                              paddingHorizontal: 10,
                              minHeight: 42,
                              marginBottom: 8,
                            },
                          ]}
                          value={editedTxNoteText}
                          onChangeText={setEditedTxNoteText}
                          placeholder={
                            selectedTx?.type === "cash_in"
                              ? "Enter source of funds (e.g. Salary)..."
                              : "Enter custom expense note..."
                          }
                          placeholderTextColor={
                            isDark ? colors.textMuted : "#94A3B8"
                          }
                          autoFocus
                        />
                        <View
                          style={{
                            flexDirection: "row",
                            gap: 8,
                            justifyContent: "flex-end",
                          }}
                        >
                          <TouchableOpacity
                            onPress={() => setIsEditingTxNote(false)}
                            style={{
                              paddingHorizontal: 12,
                              paddingVertical: 6,
                              borderRadius: 8,
                              backgroundColor: isDark ? "#334155" : "#E2E8F0",
                            }}
                            disabled={isSavingTxNote}
                          >
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: "600",
                                color: isDark ? "#CBD5E1" : "#475569",
                              }}
                            >
                              Cancel
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={handleSaveTxNote}
                            style={{
                              paddingHorizontal: 14,
                              paddingVertical: 6,
                              borderRadius: 8,
                              backgroundColor: "#2563EB",
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 4,
                            }}
                            disabled={isSavingTxNote}
                          >
                            {isSavingTxNote ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <>
                                <Ionicons
                                  name="checkmark"
                                  size={13}
                                  color="#FFFFFF"
                                />
                                <Text
                                  style={{
                                    fontSize: 12,
                                    fontWeight: "700",
                                    color: "#FFFFFF",
                                  }}
                                >
                                  Save Note
                                </Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <Text
                        style={[
                          styles.receiptNoteValue,
                          { color: isDark ? colors.text : "#0F172A" },
                        ]}
                      >
                        {displayExpenseNote}
                      </Text>
                    )}
                  </View>
                );
              })()}

              <View
                style={[
                  styles.receiptDivider,
                  { backgroundColor: isDark ? colors.border : "#E2E8F0" },
                ]}
              />

              <View style={styles.receiptRow}>
                <Text
                  style={[
                    styles.receiptLabel,
                    { color: isDark ? colors.textMuted : "#64748B" },
                  ]}
                >
                  Transaction
                </Text>
                <Text
                  style={[
                    styles.receiptValue,
                    { color: isDark ? colors.text : "#0F172A" },
                  ]}
                >
                  {selectedTx?.title}
                </Text>
              </View>

              {/* Money Source Row */}
              {Boolean(
                (selectedTx as any)?.source ||
                (selectedTx?.type === "cash_in" &&
                  (selectedTx?.note || selectedTx?.description)),
              ) && (
                <View style={styles.receiptRow}>
                  <Text
                    style={[
                      styles.receiptLabel,
                      { color: isDark ? colors.textMuted : "#64748B" },
                    ]}
                  >
                    Money Source
                  </Text>
                  <Text
                    style={[
                      styles.receiptValue,
                      { color: "#10B981", fontWeight: "700" },
                    ]}
                  >
                    {(selectedTx as any)?.source ||
                      (selectedTx?.note &&
                      !selectedTx.note.startsWith("Added ₱")
                        ? selectedTx.note
                        : "") ||
                      (selectedTx?.description &&
                      !selectedTx.description.startsWith("Added ₱")
                        ? selectedTx.description
                        : "Cash Deposit")}
                  </Text>
                </View>
              )}

              {Boolean(
                selectedTx?.category ||
                selectedTx?.type === "expense_simulation" ||
                selectedTx?.type === "cash_expense",
              ) && (
                <View style={styles.receiptRow}>
                  <Text
                    style={[
                      styles.receiptLabel,
                      { color: isDark ? colors.textMuted : "#64748B" },
                    ]}
                  >
                    Category
                  </Text>
                  <Text
                    style={[
                      styles.receiptValue,
                      { color: isDark ? colors.text : "#0F172A" },
                    ]}
                  >
                    {selectedTx?.category ||
                      (selectedTx?.type === "expense_simulation"
                        ? "Daily Expense"
                        : "Cash on Hand")}
                  </Text>
                </View>
              )}

              <View style={styles.receiptRow}>
                <Text
                  style={[
                    styles.receiptLabel,
                    { color: isDark ? colors.textMuted : "#64748B" },
                  ]}
                >
                  {selectedTx?.type === "cash_in"
                    ? "Source / Note"
                    : "Expense Note"}
                </Text>
                <Text
                  style={[
                    styles.receiptValue,
                    {
                      color: isDark ? colors.text : "#0F172A",
                      maxWidth: "60%",
                    },
                  ]}
                  numberOfLines={3}
                >
                  {(() => {
                    const matchedPreset = QUICK_EXPENSE_PRESETS.find(
                      (p: QuickExpensePreset) =>
                        p.title.toLowerCase() ===
                          selectedTx?.title?.toLowerCase() ||
                        p.id.toLowerCase() === selectedTx?.title?.toLowerCase(),
                    );
                    const rawNote = selectedTx?.note?.trim() || "";
                    const rawSource = (selectedTx as any)?.source?.trim() || "";
                    const rawDesc = selectedTx?.description?.trim() || "";
                    const isGenericDesc =
                      rawDesc.startsWith("Daily simulated expense") ||
                      rawDesc.startsWith("Added ₱") ||
                      rawDesc.startsWith("Transferred ₱");
                    const customNote =
                      rawNote || (!isGenericDesc ? rawDesc : "") || rawSource;
                    return (
                      customNote ||
                      matchedPreset?.defaultNote ||
                      selectedTx?.title ||
                      "Completed record"
                    );
                  })()}
                </Text>
              </View>

              <View style={styles.receiptRow}>
                <Text
                  style={[
                    styles.receiptLabel,
                    { color: isDark ? colors.textMuted : "#64748B" },
                  ]}
                >
                  Method
                </Text>
                <Text
                  style={[
                    styles.receiptValue,
                    { color: isDark ? colors.text : "#0F172A" },
                  ]}
                >
                  {selectedTx?.paymentMethodUsed}
                </Text>
              </View>

              <View style={styles.receiptRow}>
                <Text
                  style={[
                    styles.receiptLabel,
                    { color: isDark ? colors.textMuted : "#64748B" },
                  ]}
                >
                  Status
                </Text>
                <Text style={[styles.receiptValue, { color: "#10B981" }]}>
                  Verified & Completed
                </Text>
              </View>

              <View style={styles.receiptRow}>
                <Text
                  style={[
                    styles.receiptLabel,
                    { color: isDark ? colors.textMuted : "#64748B" },
                  ]}
                >
                  Reference ID
                </Text>
                <Text
                  style={[
                    styles.receiptValue,
                    { color: isDark ? colors.textMuted : "#64748B" },
                  ]}
                >
                  {selectedTx?.id}
                </Text>
              </View>

              <View style={styles.receiptRow}>
                <Text
                  style={[
                    styles.receiptLabel,
                    { color: isDark ? colors.textMuted : "#64748B" },
                  ]}
                >
                  Timestamp
                </Text>
                <Text
                  style={[
                    styles.receiptValue,
                    { color: isDark ? colors.textMuted : "#64748B" },
                  ]}
                >
                  {selectedTx?.timestamp
                    ? new Date(selectedTx.timestamp).toLocaleString()
                    : ""}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.modalPrimaryBtn}
                onPress={() => {
                  setSelectedTx(null);
                  setIsEditingTxNote(false);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.modalPrimaryBtnText}>Close Receipt</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalCancelBtn,
                  {
                    marginTop: 10,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    borderColor: isDark ? "#7F1D1D" : "#FEE2E2",
                  },
                ]}
                onPress={handleDeleteSelectedTx}
                disabled={isDeletingTx}
                activeOpacity={0.7}
              >
                {isDeletingTx ? (
                  <ActivityIndicator size="small" color="#EF4444" />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={15} color="#EF4444" />
                    <Text
                      style={[styles.modalCancelBtnText, { color: "#EF4444" }]}
                    >
                      Delete Transaction
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL 5: Delete Individual Card Security Confirmation Bottom Sheet */}
      <Modal
        visible={showDeleteCardModal && Boolean(selectedCardToDelete)}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!isDeletingCard) {
            setShowDeleteCardModal(false);
            setSelectedCardToDelete(null);
            setDeleteCardConfirmText("");
          }
        }}
        statusBarTranslucent={true}
      >
        <View style={dynamicModalOverlayStyle}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => {
              if (!isDeletingCard) {
                setShowDeleteCardModal(false);
                setSelectedCardToDelete(null);
                setDeleteCardConfirmText("");
              }
            }}
          />
          <View
            style={[
              styles.modalSheet,
              {
                maxHeight: modalAdaptiveMaxHeight,
                backgroundColor: isDark ? colors.cardElevated : "#FFFFFF",
                borderColor: isDark ? "#7F1D1D" : "#FEE2E2",
                borderWidth: 1,
              },
            ]}
          >
            <View
              style={[
                styles.modalHandle,
                isDark && { backgroundColor: colors.textMuted },
              ]}
            />
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 24 }}
            >
              <View style={{ alignItems: "center", marginVertical: 8 }}>
                <View
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    backgroundColor: isDark ? "#450A0A" : "#FEE2E2",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 10,
                  }}
                >
                  <Ionicons name="trash-outline" size={26} color="#EF4444" />
                </View>
                <Text
                  style={[
                    styles.modalTitle,
                    {
                      color: isDark ? colors.text : "#0F172A",
                      textAlign: "center",
                    },
                  ]}
                >
                  Remove {selectedCardToDelete?.name || "Payment Card"}
                </Text>
                <Text
                  style={[
                    styles.modalSubtitle,
                    {
                      color: isDark ? colors.textMuted : "#64748B",
                      textAlign: "center",
                      marginHorizontal: 10,
                    },
                  ]}
                >
                  Unlinking this card will deduct its balance of ₱
                  {(selectedCardToDelete?.balance || 0).toLocaleString(
                    "en-US",
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    },
                  )}{" "}
                  from your Available Digital Balance.
                </Text>
              </View>

              <View
                style={[
                  styles.deleteWarningBox,
                  {
                    backgroundColor: isDark ? "#450A0A40" : "#FEF2F2",
                    borderColor: isDark ? "#7F1D1D" : "#FCA5A5",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.deleteWarningPrompt,
                    { color: isDark ? "#FCA5A5" : "#991B1B" },
                  ]}
                >
                  Security Question:{"\n"}
                  Please type{" "}
                  <Text style={{ fontWeight: "800" }}>
                    {selectedCardToDelete?.name}
                  </Text>{" "}
                  below to confirm deletion:
                </Text>
                <TextInput
                  style={[
                    styles.modalTextInput,
                    {
                      backgroundColor: isDark ? colors.surfaceInset : "#FFFFFF",
                      borderColor:
                        selectedCardToDelete &&
                        deleteCardConfirmText.trim().toLowerCase() ===
                          selectedCardToDelete.name.trim().toLowerCase()
                          ? "#10B981"
                          : isDark
                            ? colors.border
                            : "#CBD5E1",
                      color: isDark ? colors.text : "#0F172A",
                      marginTop: 8,
                    },
                  ]}
                  placeholder={`Type "${selectedCardToDelete?.name || "Card Name"}"`}
                  placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
                  value={deleteCardConfirmText}
                  onChangeText={setDeleteCardConfirmText}
                  autoCapitalize="words"
                  editable={!isDeletingCard}
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.modalDangerBtn,
                  !selectedCardToDelete ||
                  deleteCardConfirmText.trim().toLowerCase() !==
                    selectedCardToDelete.name.trim().toLowerCase() ||
                  isDeletingCard
                    ? { opacity: 0.4 }
                    : { opacity: 1 },
                ]}
                onPress={handleConfirmDeleteCard}
                disabled={
                  !selectedCardToDelete ||
                  deleteCardConfirmText.trim().toLowerCase() !==
                    selectedCardToDelete.name.trim().toLowerCase() ||
                  isDeletingCard
                }
                activeOpacity={0.8}
              >
                {isDeletingCard ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalDangerBtnText}>
                    Permanently Delete Card
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setShowDeleteCardModal(false);
                  setSelectedCardToDelete(null);
                  setDeleteCardConfirmText("");
                }}
                disabled={isDeletingCard}
              >
                <Text
                  style={[
                    styles.modalCancelBtnText,
                    { color: isDark ? colors.textMuted : "#64748B" },
                  ]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* QUICK CIRCLE MODAL 1: Send Money to Roommate */}
      <Modal
        visible={showSendMoneyModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSendMoneyModal(false)}
        statusBarTranslucent={true}
      >
        <View style={dynamicModalOverlayStyle}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowSendMoneyModal(false)}
          />
          <View
            style={[
              styles.modalSheet,
              {
                maxHeight: modalAdaptiveMaxHeight,
                backgroundColor: isDark ? colors.cardElevated : "#FFFFFF",
                borderColor: isDark ? colors.border : "transparent",
                borderWidth: isDark ? 1 : 0,
              },
            ]}
          >
            <View
              style={[
                styles.modalHandle,
                isDark && { backgroundColor: colors.textMuted },
              ]}
            />
            <Text
              style={[
                styles.modalTitle,
                { color: isDark ? colors.text : "#0F172A" },
              ]}
            >
              Send Money
            </Text>
            <Text
              style={[
                styles.modalSubtitle,
                { color: isDark ? colors.textMuted : "#64748B" },
              ]}
            >
              Instant transfer to roommate via linked Philippine card
            </Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets={true}
              style={{ maxHeight: effectiveKeyboardHeight > 0 ? 280 : 500 }}
            >
              <Text
                style={[
                  styles.inputLabel,
                  { color: isDark ? colors.textSecondary : "#475569" },
                ]}
              >
                Recipient Roommate
              </Text>
              <TextInput
                style={[
                  styles.modalTextInput,
                  {
                    backgroundColor: isDark ? colors.surfaceInset : "#F8FAFC",
                    borderColor: isDark ? colors.border : "#CBD5E1",
                    color: isDark ? colors.text : "#0F172A",
                  },
                ]}
                placeholder="e.g. Alex Chen or 0917-123-4567"
                placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
                value={sendRecipient}
                onChangeText={setSendRecipient}
              />

              <Text
                style={[
                  styles.inputLabel,
                  { color: isDark ? colors.textSecondary : "#475569" },
                ]}
              >
                Funding Payment Card
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, marginVertical: 4 }}
              >
                {(wallet?.cards || []).map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      styles.providerChip,
                      sendSelectedCardId === c.id
                        ? { backgroundColor: "#2563EB" }
                        : {
                            backgroundColor: isDark
                              ? colors.surfaceInset
                              : "#F1F5F9",
                            borderWidth: 1,
                            borderColor: isDark ? colors.border : "#E2E8F0",
                          },
                    ]}
                    onPress={() => setSendSelectedCardId(c.id)}
                  >
                    <Text
                      style={[
                        styles.providerChipText,
                        {
                          color:
                            sendSelectedCardId === c.id
                              ? "#FFFFFF"
                              : isDark
                                ? colors.text
                                : "#0F172A",
                        },
                      ]}
                    >
                      {c.name} (₱{(c.balance || 0).toLocaleString()})
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text
                style={[
                  styles.inputLabel,
                  { color: isDark ? colors.textSecondary : "#475569" },
                ]}
              >
                Amount (₱)
              </Text>
              <View
                style={[
                  styles.amountInputWrap,
                  {
                    backgroundColor: isDark ? colors.surfaceInset : "#F8FAFC",
                    borderColor: isDark ? colors.border : "#CBD5E1",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.currencyPrefix,
                    { color: isDark ? colors.textMuted : "#64748B" },
                  ]}
                >
                  ₱
                </Text>
                <TextInput
                  style={[
                    styles.amountInput,
                    { color: isDark ? colors.text : "#0F172A" },
                  ]}
                  keyboardType="numeric"
                  value={sendAmount}
                  onChangeText={setSendAmount}
                  placeholder="0.00"
                  placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
                />
              </View>

              {(() => {
                const fundingCard =
                  wallet?.cards.find((c) => c.id === sendSelectedCardId) ||
                  wallet?.cards[0];
                const fundingBal = fundingCard?.balance || 0;
                const sendVal = parseFloat(sendAmount) || 0;
                const isSendInsufficient = fundingBal < sendVal;

                return (
                  <View style={{ width: "100%", marginTop: 8 }}>
                    {fundingCard && isSendInsufficient && sendVal > 0 && (
                      <View
                        style={[
                          styles.simPreviewCallout,
                          {
                            backgroundColor: isDark ? "#450A0A30" : "#FEF2F2",
                            borderColor: "#EF4444",
                            marginBottom: 12,
                          },
                        ]}
                      >
                        <Ionicons
                          name="alert-circle"
                          size={18}
                          color="#EF4444"
                        />
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.simPreviewText,
                              { color: "#EF4444" },
                            ]}
                          >
                            Insufficient balance on {fundingCard.name}.
                            Available: ₱{(fundingBal ?? 0).toLocaleString()}{" "}
                            (Short by ₱
                            {Math.max(
                              0,
                              (sendVal ?? 0) - (fundingBal ?? 0),
                            ).toLocaleString()}
                            ).
                          </Text>
                        </View>
                      </View>
                    )}

                    <TouchableOpacity
                      style={[
                        styles.modalPrimaryBtn,
                        (isSendInsufficient ||
                          sendVal <= 0 ||
                          !sendRecipient.trim()) && {
                          backgroundColor: "#94A3B8",
                        },
                      ]}
                      disabled={
                        isSendInsufficient ||
                        sendVal <= 0 ||
                        !sendRecipient.trim()
                      }
                      onPress={handleSendMoney}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={
                          isSendInsufficient && sendVal > 0
                            ? "alert-circle"
                            : "paper-plane"
                        }
                        size={18}
                        color="#FFFFFF"
                      />
                      <Text style={styles.modalPrimaryBtnText}>
                        {isSendInsufficient && sendVal > 0
                          ? `Insufficient Balance on ${fundingCard?.name || "Card"}`
                          : sendVal <= 0
                            ? "Enter Amount"
                            : `Send ₱${sendVal.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })} Now`}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })()}

              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowSendMoneyModal(false)}
              >
                <Text
                  style={[
                    styles.modalCancelBtnText,
                    { color: isDark ? colors.textMuted : "#64748B" },
                  ]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* QUICK CIRCLE MODAL 2: Request Expense Split */}
      <Modal
        visible={showRequestSplitModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRequestSplitModal(false)}
        statusBarTranslucent={true}
      >
        <View style={dynamicModalOverlayStyle}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowRequestSplitModal(false)}
          />
          <View
            style={[
              styles.modalSheet,
              {
                maxHeight: modalAdaptiveMaxHeight,
                backgroundColor: isDark ? colors.cardElevated : "#FFFFFF",
                borderColor: isDark ? colors.border : "transparent",
                borderWidth: isDark ? 1 : 0,
              },
            ]}
          >
            <View
              style={[
                styles.modalHandle,
                isDark && { backgroundColor: colors.textMuted },
              ]}
            />
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 4 }}
            >
              <Text
                style={[
                  styles.modalTitle,
                  { color: isDark ? colors.text : "#0F172A" },
                ]}
              >
                Request Expense Split
              </Text>
              <Text
                style={[
                  styles.modalSubtitle,
                  { color: isDark ? colors.textMuted : "#64748B" },
                ]}
              >
                Divide a household bill evenly among roommates
              </Text>

              <Text
                style={[
                  styles.inputLabel,
                  { color: isDark ? colors.textSecondary : "#475569" },
                ]}
              >
                Expense Description
              </Text>
              <TextInput
                style={[
                  styles.modalTextInput,
                  {
                    backgroundColor: isDark ? colors.surfaceInset : "#F8FAFC",
                    borderColor: isDark ? colors.border : "#CBD5E1",
                    color: isDark ? colors.text : "#0F172A",
                  },
                ]}
                placeholder="e.g. Meralco Electricity, Water, or Fiber WiFi"
                placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
                value={splitTitle}
                onChangeText={setSplitTitle}
              />

              <Text
                style={[
                  styles.inputLabel,
                  { color: isDark ? colors.textSecondary : "#475569" },
                ]}
              >
                Total Bill Amount (₱)
              </Text>
              <TextInput
                style={[
                  styles.modalTextInput,
                  {
                    backgroundColor: isDark ? colors.surfaceInset : "#F8FAFC",
                    borderColor: isDark ? colors.border : "#CBD5E1",
                    color: isDark ? colors.text : "#0F172A",
                    fontWeight: "800",
                  },
                ]}
                keyboardType="numeric"
                placeholder="2400"
                placeholderTextColor={isDark ? colors.textMuted : "#94A3B8"}
                value={splitAmount}
                onChangeText={setSplitAmount}
              />

              <Text
                style={[
                  styles.inputLabel,
                  { color: isDark ? colors.textSecondary : "#475569" },
                ]}
              >
                Split Among ({splitNumPeople} roommates)
              </Text>
              <View style={{ flexDirection: "row", gap: 8, marginVertical: 4 }}>
                {[2, 3, 4, 5, 6].map((num) => (
                  <TouchableOpacity
                    key={num}
                    style={[
                      styles.quickPill,
                      splitNumPeople === num
                        ? { backgroundColor: "#059669" }
                        : {
                            backgroundColor: isDark
                              ? colors.surfaceInset
                              : "#F1F5F9",
                            borderWidth: 1,
                            borderColor: isDark ? colors.border : "#E2E8F0",
                          },
                    ]}
                    onPress={() => setSplitNumPeople(num)}
                  >
                    <Text
                      style={[
                        styles.quickPillText,
                        {
                          color:
                            splitNumPeople === num
                              ? "#FFFFFF"
                              : isDark
                                ? colors.text
                                : "#0F172A",
                        },
                      ]}
                    >
                      {num} Pax
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View
                style={{
                  backgroundColor: isDark ? "#064E3B40" : "#ECFDF5",
                  borderColor: isDark ? "#065F46" : "#A7F3D0",
                  borderWidth: 1,
                  borderRadius: 14,
                  padding: 12,
                  marginVertical: 10,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    color: isDark ? "#A7F3D0" : "#065F46",
                    fontWeight: "600",
                  }}
                >
                  Calculated Share Per Roommate:
                </Text>
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: "800",
                    color: isDark ? "#34D399" : "#047857",
                    marginTop: 2,
                  }}
                >
                  ₱
                  {(
                    (parseFloat(splitAmount) || 0) / (splitNumPeople || 1)
                  ).toFixed(2)}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.modalPrimaryBtn, { backgroundColor: "#059669" }]}
                onPress={handleCreateSplitRequest}
                activeOpacity={0.8}
              >
                <Ionicons name="send" size={18} color="#FFFFFF" />
                <Text style={styles.modalPrimaryBtnText}>
                  Send Split Request
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowRequestSplitModal(false)}
              >
                <Text
                  style={[
                    styles.modalCancelBtnText,
                    { color: isDark ? colors.textMuted : "#64748B" },
                  ]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* QUICK CIRCLE MODAL 3: Splitzy Cross-User QR Transfer & Receive Engine */}
      <Modal
        visible={showScanQrModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          stopLiveCamera();
          setShowScanQrModal(false);
        }}
        statusBarTranslucent={true}
      >
        <View style={dynamicModalOverlayStyle}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => {
              stopLiveCamera();
              setShowScanQrModal(false);
            }}
          />
          <View
            style={[
              styles.modalSheet,
              {
                maxHeight: modalAdaptiveMaxHeight,
                backgroundColor: isDark ? colors.cardElevated : "#FFFFFF",
                borderColor: isDark ? colors.border : "transparent",
                borderWidth: isDark ? 1 : 0,
              },
            ]}
          >
            <View
              style={[
                styles.modalHandle,
                isDark && { backgroundColor: colors.textMuted },
              ]}
            />

            {/* Modal Header */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <View style={{ flex: 1 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Text
                    style={[
                      styles.modalTitle,
                      { color: isDark ? colors.text : "#0F172A" },
                    ]}
                  >
                    Splitzy QR Transfer
                  </Text>
                  <View
                    style={{
                      backgroundColor: "#2563EB",
                      paddingHorizontal: 7,
                      paddingVertical: 2,
                      borderRadius: 6,
                    }}
                  >
                    <Text
                      style={{
                        color: "#FFFFFF",
                        fontSize: 10,
                        fontWeight: "800",
                        letterSpacing: 0.5,
                      }}
                    >
                      P2P
                    </Text>
                  </View>
                </View>
                <Text
                  style={[
                    styles.modalSubtitle,
                    {
                      color: isDark ? colors.textMuted : "#64748B",
                      marginBottom: 0,
                    },
                  ]}
                >
                  Send or receive money instantly with Splitzy users
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => {
                  stopLiveCamera();
                  setShowScanQrModal(false);
                }}
                style={{
                  padding: 6,
                  borderRadius: 18,
                  backgroundColor: isDark ? "#1E293B" : "#F1F5F9",
                }}
              >
                <Ionicons
                  name="close"
                  size={20}
                  color={isDark ? colors.text : "#475569"}
                />
              </TouchableOpacity>
            </View>

            {/* Dual Tabs Selector: Scan QR vs My QR Code */}
            {qrScanStep !== "receipt" && (
              <View style={styles.qrModalTabsRow}>
                <TouchableOpacity
                  style={[
                    styles.qrModalTabBtn,
                    qrModalTab === "scan" && styles.qrModalTabBtnActive,
                  ]}
                  onPress={() => {
                    setQrModalTab("scan");
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="scan"
                    size={16}
                    color={
                      qrModalTab === "scan"
                        ? "#FFFFFF"
                        : isDark
                          ? colors.textMuted
                          : "#64748B"
                    }
                  />
                  <Text
                    style={[
                      styles.qrModalTabText,
                      qrModalTab === "scan" && styles.qrModalTabTextActive,
                    ]}
                  >
                    Scan QR
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.qrModalTabBtn,
                    qrModalTab === "receive" && styles.qrModalTabBtnActive,
                  ]}
                  onPress={() => {
                    setQrModalTab("receive");
                    setQrScanStep("viewfinder");
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="qr-code"
                    size={16}
                    color={
                      qrModalTab === "receive"
                        ? "#FFFFFF"
                        : isDark
                          ? colors.textMuted
                          : "#64748B"
                    }
                  />
                  <Text
                    style={[
                      styles.qrModalTabText,
                      qrModalTab === "receive" && styles.qrModalTabTextActive,
                    ]}
                  >
                    Generate QR
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 16 }}
              keyboardShouldPersistTaps="handled"
            >
              {/* TAB 1: RECEIVE MONEY ("MY QR CODE") */}
              {qrModalTab === "receive" && (
                <View style={{ alignItems: "center", width: "100%" }}>
                  {/* Pure SVG QR Code Matrix */}
                  <View style={styles.qrCodeCard}>
                    <SplitzyQrCode
                      value={myQrPayload}
                      size={210}
                      logoInitials={myDisplayName}
                    />
                  </View>

                  {/* Preset Amount Callout Badge if active */}
                  {presetAmount && Number(presetAmount) > 0 ? (
                    <View
                      style={{
                        backgroundColor: isDark ? "#064E3B40" : "#ECFDF5",
                        borderColor: "#10B981",
                        borderWidth: 1,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 10,
                        marginTop: 4,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Ionicons name="pricetag" size={14} color="#10B981" />
                      <Text
                        style={{
                          color: "#10B981",
                          fontSize: 12,
                          fontWeight: "800",
                        }}
                      >
                        Requesting ₱{parseFloat(presetAmount).toFixed(2)}
                        {presetNote ? ` · ${presetNote}` : ""}
                      </Text>
                    </View>
                  ) : null}

                  {/* User Identity Pill */}
                  <View
                    style={[
                      styles.qrIdentityRow,
                      {
                        backgroundColor: isDark ? "#0F172A" : "#F8FAFC",
                        borderColor: isDark ? colors.border : "#E2E8F0",
                      },
                    ]}
                  >
                    <View style={styles.qrIdentityAvatar}>
                      <Text style={styles.qrIdentityAvatarText}>
                        {myDisplayName.slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Text
                          style={[
                            styles.qrIdentityName,
                            { color: isDark ? colors.text : "#0F172A" },
                          ]}
                          numberOfLines={1}
                        >
                          {myDisplayName}
                        </Text>
                        <Ionicons
                          name="checkmark-circle"
                          size={15}
                          color="#10B981"
                        />
                      </View>
                      <Text
                        style={[
                          styles.qrIdentitySub,
                          { color: isDark ? colors.textMuted : "#64748B" },
                        ]}
                        numberOfLines={1}
                      >
                        {myEmail ||
                          `@${myDisplayName.toLowerCase().replace(/\s+/g, "_")}`}
                      </Text>
                    </View>
                    <View
                      style={{
                        backgroundColor: isDark ? "#1E293B" : "#E2E8F0",
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 6,
                      }}
                    >
                      <Text
                        style={{
                          color: isDark ? "#93C5FD" : "#2563EB",
                          fontSize: 10,
                          fontWeight: "700",
                        }}
                      >
                        Verified
                      </Text>
                    </View>
                  </View>

                  {/* Preset Amount & Note Controls */}
                  <TouchableOpacity
                    style={[
                      styles.qrPresetToggleBtn,
                      {
                        backgroundColor: showPresetEditor
                          ? isDark
                            ? "#1E293B"
                            : "#E2E8F0"
                          : "transparent",
                        borderColor: isDark ? colors.border : "#CBD5E1",
                      },
                    ]}
                    onPress={() => setShowPresetEditor(!showPresetEditor)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={showPresetEditor ? "chevron-up" : "options-outline"}
                      size={15}
                      color={isDark ? colors.text : "#334155"}
                    />
                    <Text
                      style={[
                        styles.qrPresetToggleText,
                        { color: isDark ? colors.text : "#334155" },
                      ]}
                    >
                      {showPresetEditor
                        ? "Hide Preset Options"
                        : presetAmount
                          ? "Edit Preset Amount & Note"
                          : "Set Preset Amount & Note (Optional)"}
                    </Text>
                  </TouchableOpacity>

                  {showPresetEditor && (
                    <View
                      style={[
                        styles.qrPresetBox,
                        {
                          backgroundColor: isDark ? "#0F172A" : "#F8FAFC",
                          borderColor: isDark ? colors.border : "#E2E8F0",
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "700",
                          color: isDark ? colors.text : "#0F172A",
                        }}
                      >
                        Preset Requested Amount (₱)
                      </Text>
                      <View
                        style={[
                          styles.qrPresetInputRow,
                          {
                            borderColor: isDark ? colors.border : "#CBD5E1",
                            backgroundColor: isDark ? colors.card : "#FFFFFF",
                          },
                        ]}
                      >
                        <Text
                          style={{
                            fontSize: 15,
                            fontWeight: "800",
                            color: "#2563EB",
                            marginRight: 6,
                          }}
                        >
                          ₱
                        </Text>
                        <TextInput
                          style={[
                            styles.qrPresetInput,
                            { color: isDark ? colors.text : "#0F172A" },
                          ]}
                          placeholder="e.g. 350.00"
                          placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                          keyboardType="numeric"
                          value={presetAmount}
                          onChangeText={setPresetAmount}
                        />
                        {presetAmount.length > 0 && (
                          <TouchableOpacity onPress={() => setPresetAmount("")}>
                            <Ionicons
                              name="close-circle"
                              size={16}
                              color="#94A3B8"
                            />
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Quick preset amount chips */}
                      <View style={styles.qrQuickPillsRow}>
                        {["150", "300", "500", "1200"].map((amt) => (
                          <TouchableOpacity
                            key={amt}
                            style={[
                              styles.qrQuickPill,
                              {
                                backgroundColor:
                                  presetAmount === amt
                                    ? "#2563EB"
                                    : isDark
                                      ? "#1E293B"
                                      : "#E2E8F0",
                                borderColor:
                                  presetAmount === amt
                                    ? "#2563EB"
                                    : isDark
                                      ? colors.border
                                      : "transparent",
                              },
                            ]}
                            onPress={() => setPresetAmount(amt)}
                          >
                            <Text
                              style={[
                                styles.qrQuickPillText,
                                {
                                  color:
                                    presetAmount === amt
                                      ? "#FFFFFF"
                                      : isDark
                                        ? colors.text
                                        : "#334155",
                                },
                              ]}
                            >
                              ₱{amt}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "700",
                          color: isDark ? colors.text : "#0F172A",
                          marginTop: 4,
                        }}
                      >
                        Preset Note / Memo
                      </Text>
                      <View
                        style={[
                          styles.qrPresetInputRow,
                          {
                            borderColor: isDark ? colors.border : "#CBD5E1",
                            backgroundColor: isDark ? colors.card : "#FFFFFF",
                          },
                        ]}
                      >
                        <TextInput
                          style={[
                            styles.qrPresetInput,
                            { color: isDark ? colors.text : "#0F172A" },
                          ]}
                          placeholder="e.g. Dinner share, WiFi split"
                          placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                          value={presetNote}
                          onChangeText={setPresetNote}
                        />
                      </View>

                      {/* Quick memo suggestions */}
                      <View style={styles.qrQuickPillsRow}>
                        {[
                          "Dinner share",
                          "WiFi split",
                          "Water bill",
                          "Rent share",
                          "Groceries",
                        ].map((memo) => (
                          <TouchableOpacity
                            key={memo}
                            style={[
                              styles.qrQuickPill,
                              {
                                backgroundColor:
                                  presetNote === memo
                                    ? "#2563EB"
                                    : isDark
                                      ? "#1E293B"
                                      : "#E2E8F0",
                                borderColor:
                                  presetNote === memo
                                    ? "#2563EB"
                                    : isDark
                                      ? colors.border
                                      : "transparent",
                              },
                            ]}
                            onPress={() => setPresetNote(memo)}
                          >
                            <Text
                              style={[
                                styles.qrQuickPillText,
                                {
                                  color:
                                    presetNote === memo
                                      ? "#FFFFFF"
                                      : isDark
                                        ? colors.text
                                        : "#334155",
                                },
                              ]}
                            >
                              {memo}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      {presetAmount || presetNote ? (
                        <TouchableOpacity
                          style={{
                            alignSelf: "flex-start",
                            paddingVertical: 4,
                            marginTop: 2,
                          }}
                          onPress={() => {
                            setPresetAmount("");
                            setPresetNote("");
                          }}
                        >
                          <Text
                            style={{
                              color: "#EF4444",
                              fontSize: 11,
                              fontWeight: "700",
                            }}
                          >
                            Reset to Universal QR
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  )}

                  {/* Action Buttons: Download PNG, Copy Link & Share */}
                  <View style={{ width: "100%", gap: 8, marginTop: 14 }}>
                    <TouchableOpacity
                      style={[
                        styles.qrActionBtn,
                        {
                          backgroundColor: "#2563EB",
                          width: "100%",
                          paddingVertical: 12,
                          borderRadius: 14,
                        },
                      ]}
                      onPress={handleDownloadQrPng}
                      disabled={isDownloadingQrPng}
                      activeOpacity={0.8}
                    >
                      {isDownloadingQrPng ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="download" size={17} color="#FFFFFF" />
                          <Text
                            style={[
                              styles.qrActionBtnText,
                              {
                                color: "#FFFFFF",
                                fontSize: 13,
                                fontWeight: "800",
                              },
                            ]}
                          >
                            Download QR as PNG
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <View style={styles.qrActionRow}>
                      <TouchableOpacity
                        style={[
                          styles.qrActionBtn,
                          {
                            backgroundColor: copiedPayLink
                              ? "#10B981"
                              : isDark
                                ? "#1E293B"
                                : "#F1F5F9",
                          },
                        ]}
                        onPress={handleCopyMyPayLink}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name={copiedPayLink ? "checkmark" : "copy-outline"}
                          size={16}
                          color={
                            copiedPayLink
                              ? "#FFFFFF"
                              : isDark
                                ? colors.text
                                : "#0F172A"
                          }
                        />
                        <Text
                          style={[
                            styles.qrActionBtnText,
                            {
                              color: copiedPayLink
                                ? "#FFFFFF"
                                : isDark
                                  ? colors.text
                                  : "#0F172A",
                            },
                          ]}
                        >
                          {copiedPayLink ? "Copied Link! ✓" : "Copy Pay Link"}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.qrActionBtn,
                          {
                            backgroundColor: isDark ? "#1E293B" : "#F1F5F9",
                            borderWidth: 1,
                            borderColor: isDark ? colors.border : "#CBD5E1",
                          },
                        ]}
                        onPress={() => {
                          handleCopyMyPayLink();
                          Alert.alert(
                            "Splitzy Pay Link",
                            "Your Splitzy QR link is copied to your clipboard. You can send it to your roommates via Messenger, Viber, or SMS!",
                          );
                        }}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name="share-social-outline"
                          size={16}
                          color={isDark ? colors.text : "#0F172A"}
                        />
                        <Text
                          style={[
                            styles.qrActionBtnText,
                            { color: isDark ? colors.text : "#0F172A" },
                          ]}
                        >
                          Share QR
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Informational Tip Box */}
                  <View
                    style={[
                      styles.qrTipBox,
                      {
                        backgroundColor: isDark ? "#1E293B40" : "#F8FAFC",
                        borderColor: isDark ? colors.border : "#E2E8F0",
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <Ionicons
                      name="shield-checkmark"
                      size={18}
                      color="#10B981"
                    />
                    <Text
                      style={[
                        styles.qrTipText,
                        { color: isDark ? colors.textMuted : "#64748B" },
                      ]}
                    >
                      Any Splitzy user scanning this QR will instantly transfer
                      funds directly into your wallet balance in real time.
                    </Text>
                  </View>
                </View>
              )}

              {/* TAB 2: SEND MONEY ("SCAN QR") */}
              {qrModalTab === "scan" && (
                <View style={{ width: "100%" }}>
                  {/* STEP A: VIEWFINDER & RECIPIENT DISCOVERY */}
                  {qrScanStep === "viewfinder" && (
                    <View>
                      {/* Interactive Real Camera Viewfinder */}
                      <View
                        style={[
                          styles.qrViewfinder,
                          {
                            backgroundColor: "#090D16",
                            borderColor: "#2563EB",
                            overflow: "hidden",
                            position: "relative",
                          },
                        ]}
                      >
                        {/* Live HTML5 Video Stream (Web only - avoided raw <video> JSX to prevent React Native view config invariant errors) */}
                        {Platform.OS === "web" &&
                          React.createElement("video", {
                            ref: videoRef,
                            autoPlay: true,
                            playsInline: true,
                            muted: true,
                            style: {
                              position: "absolute",
                              top: 0,
                              left: 0,
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                              borderRadius: 18,
                            },
                          })}

                        {/* Live Native Camera (Android / iOS EAS Native Runtime) */}
                        {Platform.OS !== "web" &&
                          NativeCameraView &&
                          hasCameraPermission &&
                          isCameraActive && (
                            <NativeCameraView
                              style={StyleSheet.absoluteFill}
                              facing={
                                cameraFacingMode === "user" ? "front" : "back"
                              }
                              barcodeScannerSettings={{
                                barcodeTypes: ["qr"],
                              }}
                              onBarcodeScanned={({
                                data,
                              }: {
                                data: string;
                              }) => {
                                if (data && isCameraActive) {
                                  handleOnQrCodeScanned(data);
                                }
                              }}
                            />
                          )}

                        {/* Top Viewfinder Bar: Flip Camera & Status */}
                        <View
                          style={{
                            position: "absolute",
                            top: 10,
                            left: 12,
                            right: 12,
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                            zIndex: 20,
                          }}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 6,
                              backgroundColor: "rgba(15, 23, 42, 0.75)",
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              borderRadius: 8,
                            }}
                          >
                            <View
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: 4,
                                backgroundColor: isCameraActive
                                  ? "#10B981"
                                  : "#F59E0B",
                              }}
                            />
                            <Text
                              style={{
                                color: "#FFFFFF",
                                fontSize: 10,
                                fontWeight: "700",
                              }}
                            >
                              {isCameraActive ? "LIVE SCANNER" : "INITIALIZING"}
                            </Text>
                          </View>

                          <TouchableOpacity
                            style={{
                              backgroundColor: "rgba(15, 23, 42, 0.8)",
                              paddingHorizontal: 10,
                              paddingVertical: 5,
                              borderRadius: 8,
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 5,
                              borderWidth: 1,
                              borderColor: "rgba(255, 255, 255, 0.2)",
                            }}
                            onPress={toggleCameraFacingMode}
                            activeOpacity={0.8}
                          >
                            <Ionicons
                              name="camera-reverse"
                              size={15}
                              color="#FFFFFF"
                            />
                            <Text
                              style={{
                                color: "#FFFFFF",
                                fontSize: 11,
                                fontWeight: "700",
                              }}
                            >
                              Flip
                            </Text>
                          </TouchableOpacity>
                        </View>

                        {/* Target Reticle Corners */}
                        <View
                          style={[
                            styles.qrCornerMarker,
                            {
                              top: 16,
                              left: 16,
                              borderTopWidth: 3,
                              borderLeftWidth: 3,
                            },
                          ]}
                        />
                        <View
                          style={[
                            styles.qrCornerMarker,
                            {
                              top: 16,
                              right: 16,
                              borderTopWidth: 3,
                              borderRightWidth: 3,
                            },
                          ]}
                        />
                        <View
                          style={[
                            styles.qrCornerMarker,
                            {
                              bottom: 16,
                              left: 16,
                              borderBottomWidth: 3,
                              borderLeftWidth: 3,
                            },
                          ]}
                        />
                        <View
                          style={[
                            styles.qrCornerMarker,
                            {
                              bottom: 16,
                              right: 16,
                              borderBottomWidth: 3,
                              borderRightWidth: 3,
                            },
                          ]}
                        />

                        {/* Animated Laser Scan Beam */}
                        <Animated.View
                          style={[
                            styles.qrLaserLine,
                            {
                              transform: [
                                {
                                  translateY: qrScanLaserAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [-70, 70],
                                  }),
                                },
                              ],
                            },
                          ]}
                        />

                        {/* Camera Error or Permission Message Overlay */}
                        {cameraError ? (
                          <View
                            style={{
                              position: "absolute",
                              inset: 0,
                              backgroundColor: "rgba(15, 23, 42, 0.94)",
                              borderRadius: 18,
                              alignItems: "center",
                              justifyContent: "center",
                              padding: 20,
                              zIndex: 25,
                            }}
                          >
                            <Ionicons
                              name="videocam-off"
                              size={36}
                              color="#EF4444"
                            />
                            <Text
                              style={{
                                color: "#FFFFFF",
                                fontSize: 13,
                                fontWeight: "800",
                                textAlign: "center",
                                marginTop: 8,
                                marginBottom: 4,
                              }}
                            >
                              Camera Access Needed
                            </Text>
                            <Text
                              style={{
                                color: "#94A3B8",
                                fontSize: 11,
                                textAlign: "center",
                                marginBottom: 12,
                              }}
                            >
                              {cameraError}
                            </Text>
                            <TouchableOpacity
                              style={{
                                backgroundColor: "#2563EB",
                                paddingHorizontal: 16,
                                paddingVertical: 8,
                                borderRadius: 8,
                              }}
                              onPress={startLiveCamera}
                              activeOpacity={0.8}
                            >
                              <Text
                                style={{
                                  color: "#FFFFFF",
                                  fontSize: 12,
                                  fontWeight: "700",
                                }}
                              >
                                Retry Camera
                              </Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          /* Bottom Guide Pill */
                          <View
                            style={{
                              position: "absolute",
                              bottom: 10,
                              left: 12,
                              right: 12,
                              backgroundColor: "rgba(15, 23, 42, 0.75)",
                              paddingVertical: 6,
                              paddingHorizontal: 10,
                              borderRadius: 10,
                              alignItems: "center",
                              zIndex: 20,
                            }}
                          >
                            <Text
                              style={{
                                color: "#FFFFFF",
                                fontSize: 11,
                                fontWeight: "700",
                                textAlign: "center",
                              }}
                            >
                              Align Splitzy QR or QR Ph inside frame
                            </Text>
                            <Text
                              style={{
                                color: "#94A3B8",
                                fontSize: 9,
                                textAlign: "center",
                                marginTop: 2,
                              }}
                            >
                              Auto-detects recipient & amount instantly
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Photo Library & Manual Code Buttons */}
                      <View
                        style={{
                          flexDirection: "row",
                          gap: 10,
                          marginBottom: 16,
                        }}
                      >
                        <TouchableOpacity
                          style={[
                            styles.modalPrimaryBtn,
                            {
                              flex: 1,
                              backgroundColor: isDark ? "#1E293B" : "#F1F5F9",
                              borderWidth: 1,
                              borderColor: isDark ? colors.border : "#CBD5E1",
                            },
                          ]}
                          onPress={handlePickQrImage}
                          disabled={isDecodingImage}
                          activeOpacity={0.8}
                        >
                          {isDecodingImage ? (
                            <ActivityIndicator
                              size="small"
                              color={isDark ? "#FFFFFF" : "#2563EB"}
                            />
                          ) : (
                            <>
                              <Ionicons
                                name="image-outline"
                                size={18}
                                color={isDark ? colors.text : "#0F172A"}
                              />
                              <Text
                                style={[
                                  styles.modalPrimaryBtnText,
                                  { color: isDark ? colors.text : "#0F172A" },
                                ]}
                              >
                                Upload QR
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.modalPrimaryBtn,
                            {
                              flex: 1,
                              backgroundColor: isDark ? "#1E293B" : "#F1F5F9",
                              borderWidth: 1,
                              borderColor: isDark ? colors.border : "#CBD5E1",
                            },
                          ]}
                          onPress={() => setShowManualInput(!showManualInput)}
                          activeOpacity={0.8}
                        >
                          <Ionicons
                            name="keypad-outline"
                            size={18}
                            color={isDark ? colors.text : "#0F172A"}
                          />
                          <Text
                            style={[
                              styles.modalPrimaryBtnText,
                              { color: isDark ? colors.text : "#0F172A" },
                            ]}
                          >
                            {showManualInput ? "Hide Code" : "Enter Code"}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* Manual Code / Link Input Section */}
                      {showManualInput && (
                        <View
                          style={{
                            backgroundColor: isDark ? "#0F172A" : "#F8FAFC",
                            padding: 12,
                            borderRadius: 14,
                            borderWidth: 1,
                            borderColor: isDark ? colors.border : "#E2E8F0",
                            marginBottom: 16,
                            gap: 10,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: "700",
                              color: isDark ? colors.text : "#0F172A",
                            }}
                          >
                            Paste Splitzy Pay Link or User ID
                          </Text>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              borderWidth: 1,
                              borderColor: isDark ? colors.border : "#CBD5E1",
                              backgroundColor: isDark ? colors.card : "#FFFFFF",
                              borderRadius: 10,
                              paddingHorizontal: 10,
                              height: 42,
                            }}
                          >
                            <TextInput
                              style={{
                                flex: 1,
                                fontSize: 13,
                                color: isDark ? colors.text : "#0F172A",
                              }}
                              placeholder="splitzy://pay?uid=... or roommate ID"
                              placeholderTextColor={
                                isDark ? "#64748B" : "#94A3B8"
                              }
                              value={manualCodeInput}
                              onChangeText={setManualCodeInput}
                              autoCapitalize="none"
                            />
                            {manualCodeInput.length > 0 && (
                              <TouchableOpacity
                                onPress={() => setManualCodeInput("")}
                              >
                                <Ionicons
                                  name="close-circle"
                                  size={16}
                                  color="#94A3B8"
                                />
                              </TouchableOpacity>
                            )}
                          </View>
                          <TouchableOpacity
                            style={{
                              backgroundColor: "#2563EB",
                              paddingVertical: 10,
                              borderRadius: 10,
                              alignItems: "center",
                            }}
                            onPress={() => {
                              if (!manualCodeInput.trim()) {
                                Alert.alert(
                                  "Input Required",
                                  "Please enter or paste a Splitzy code.",
                                );
                                return;
                              }
                              const parsed = parseQrPayload(manualCodeInput);
                              handleSelectRoommateToTransfer(
                                {
                                  uid: parsed.uid,
                                  name: parsed.name,
                                  email: parsed.email,
                                },
                                parsed.amount,
                                parsed.note,
                              );
                            }}
                          >
                            <Text
                              style={{
                                color: "#FFFFFF",
                                fontSize: 12,
                                fontWeight: "800",
                              }}
                            >
                              Decode & Transfer
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {/* Quick-Select Household Roommates Section */}
                      <View style={{ marginBottom: 16 }}>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 8,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: "800",
                              color: isDark ? colors.text : "#0F172A",
                            }}
                          >
                            Quick-Select Roommate to Pay
                          </Text>
                          <Text
                            style={{
                              fontSize: 11,
                              color: isDark ? colors.textMuted : "#64748B",
                            }}
                          >
                            Instant 1-Tap
                          </Text>
                        </View>

                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={styles.qrQuickRoommatesRow}
                        >
                          {availableRoommates.map((roommate, idx) => {
                            const colorsPalette = [
                              "#2563EB",
                              "#10B981",
                              "#F59E0B",
                              "#8B5CF6",
                              "#EC4899",
                            ];
                            const avatarBg =
                              colorsPalette[idx % colorsPalette.length];

                            return (
                              <TouchableOpacity
                                key={roommate.uid || idx}
                                style={[
                                  styles.qrRoommateChip,
                                  {
                                    backgroundColor: isDark
                                      ? "#0F172A"
                                      : "#F8FAFC",
                                    borderColor: isDark
                                      ? colors.border
                                      : "#E2E8F0",
                                  },
                                ]}
                                onPress={() =>
                                  handleSelectRoommateToTransfer(roommate)
                                }
                                activeOpacity={0.7}
                              >
                                <View
                                  style={[
                                    styles.qrRoommateAvatar,
                                    { backgroundColor: avatarBg },
                                  ]}
                                >
                                  <Text style={styles.qrRoommateAvatarText}>
                                    {roommate.name.slice(0, 2).toUpperCase()}
                                  </Text>
                                </View>
                                <Text
                                  style={[
                                    styles.qrRoommateName,
                                    { color: isDark ? colors.text : "#0F172A" },
                                  ]}
                                  numberOfLines={1}
                                >
                                  {roommate.name.split(" ")[0]}
                                </Text>
                                <Text
                                  style={[
                                    styles.qrRoommateRole,
                                    {
                                      color: isDark
                                        ? colors.textMuted
                                        : "#64748B",
                                    },
                                  ]}
                                >
                                  {roommate.role || "Roommate"}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </View>

                      {/* Demo QR Scanner Shortcut for Instant Testing */}
                      <TouchableOpacity
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                          paddingVertical: 12,
                          borderRadius: 14,
                          backgroundColor: isDark ? "#1E293B" : "#EFF6FF",
                          borderWidth: 1,
                          borderColor: isDark ? "#2563EB40" : "#BFDBFE",
                        }}
                        onPress={() => {
                          const demoRoommate = availableRoommates[0] || {
                            uid: "user_alex_rivera",
                            name: "Alex Rivera",
                            email: "alex.rivera@splitzy.ph",
                          };
                          handleSelectRoommateToTransfer(
                            demoRoommate,
                            "450.00",
                            "Dinner & grocery share",
                          );
                        }}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="flash" size={16} color="#2563EB" />
                        <Text
                          style={{
                            color: "#2563EB",
                            fontSize: 12,
                            fontWeight: "800",
                          }}
                        >
                          Simulate Scan: Alex's ₱450.00 Dinner Share QR
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* STEP B: TRANSFER CONFIRMATION & FUNDING SOURCE SELECTOR */}
                  {qrScanStep === "confirm" && scannedRecipient && (
                    <View>
                      {/* Back to viewfinder button */}
                      <TouchableOpacity
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                          marginBottom: 12,
                          alignSelf: "flex-start",
                        }}
                        onPress={() => setQrScanStep("viewfinder")}
                      >
                        <Ionicons
                          name="arrow-back"
                          size={16}
                          color={isDark ? colors.textMuted : "#64748B"}
                        />
                        <Text
                          style={{
                            color: isDark ? colors.textMuted : "#64748B",
                            fontSize: 12,
                            fontWeight: "700",
                          }}
                        >
                          Back to Scanner
                        </Text>
                      </TouchableOpacity>

                      {/* Recipient Profile Verified Card */}
                      <View
                        style={{
                          backgroundColor: isDark ? "#0F172A" : "#F8FAFC",
                          padding: 14,
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: isDark ? colors.border : "#E2E8F0",
                          marginBottom: 14,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
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
                              fontSize: 16,
                              fontWeight: "900",
                            }}
                          >
                            {scannedRecipient.name.slice(0, 2).toUpperCase()}
                          </Text>
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
                                fontSize: 15,
                                fontWeight: "800",
                                color: isDark ? colors.text : "#0F172A",
                              }}
                              numberOfLines={1}
                            >
                              {scannedRecipient.name}
                            </Text>
                            <Ionicons
                              name="checkmark-circle"
                              size={16}
                              color="#10B981"
                            />
                          </View>
                          <Text
                            style={{
                              fontSize: 11,
                              color: isDark ? colors.textMuted : "#64748B",
                              marginTop: 2,
                            }}
                            numberOfLines={1}
                          >
                            {scannedRecipient.email ||
                              `@${scannedRecipient.name.toLowerCase().replace(/\s+/g, "_")}`}
                          </Text>
                        </View>
                        <View
                          style={{
                            backgroundColor: isDark ? "#064E3B40" : "#ECFDF5",
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 6,
                            borderColor: "#10B981",
                            borderWidth: 1,
                          }}
                        >
                          <Text
                            style={{
                              color: "#10B981",
                              fontSize: 10,
                              fontWeight: "800",
                            }}
                          >
                            Roommate
                          </Text>
                        </View>
                      </View>

                      {/* Transfer Amount Input */}
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "800",
                          color: isDark ? colors.text : "#0F172A",
                          marginBottom: 6,
                        }}
                      >
                        Transfer Amount (₱)
                      </Text>
                      <View
                        style={[
                          styles.amountInputWrap,
                          {
                            borderColor: isDark ? colors.border : "#CBD5E1",
                            backgroundColor: isDark ? colors.card : "#FFFFFF",
                            marginBottom: 8,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.simAmountCurrency,
                            { color: "#2563EB", fontWeight: "900" },
                          ]}
                        >
                          ₱
                        </Text>
                        <TextInput
                          style={[
                            styles.amountInput,
                            {
                              color: isDark ? colors.text : "#0F172A",
                              fontSize: 22,
                              fontWeight: "800",
                            },
                          ]}
                          placeholder="0.00"
                          placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                          keyboardType="numeric"
                          value={qrTransferAmount}
                          onChangeText={setQrTransferAmount}
                        />
                      </View>

                      {/* Quick amount chips */}
                      <View
                        style={[styles.qrQuickPillsRow, { marginBottom: 14 }]}
                      >
                        {["50", "100", "350", "500", "1000"].map((amt) => (
                          <TouchableOpacity
                            key={amt}
                            style={[
                              styles.qrQuickPill,
                              {
                                backgroundColor: isDark ? "#1E293B" : "#F1F5F9",
                                borderColor: isDark ? colors.border : "#E2E8F0",
                              },
                            ]}
                            onPress={() => {
                              const curr = parseFloat(qrTransferAmount) || 0;
                              setQrTransferAmount(
                                (curr + parseFloat(amt)).toFixed(2),
                              );
                            }}
                          >
                            <Text
                              style={[
                                styles.qrQuickPillText,
                                { color: isDark ? colors.text : "#334155" },
                              ]}
                            >
                              +₱{amt}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      {/* Transfer Note / Memo Input */}
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "800",
                          color: isDark ? colors.text : "#0F172A",
                          marginBottom: 6,
                        }}
                      >
                        Transfer Note / Memo
                      </Text>
                      <View
                        style={[
                          styles.qrPresetInputRow,
                          {
                            borderColor: isDark ? colors.border : "#CBD5E1",
                            backgroundColor: isDark ? colors.card : "#FFFFFF",
                            marginBottom: 16,
                          },
                        ]}
                      >
                        <TextInput
                          style={[
                            styles.qrPresetInput,
                            { color: isDark ? colors.text : "#0F172A" },
                          ]}
                          placeholder="What is this transfer for?"
                          placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                          value={qrTransferNote}
                          onChangeText={setQrTransferNote}
                        />
                      </View>

                      {/* FUNDING SOURCE SELECTOR (Available Wallet Balance vs Linked Cards) */}
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "800",
                          color: isDark ? colors.text : "#0F172A",
                          marginBottom: 8,
                        }}
                      >
                        Choose Funding Source
                      </Text>

                      {/* Option 1: Available Wallet Balance */}
                      <TouchableOpacity
                        style={[
                          styles.qrFundingOption,
                          {
                            backgroundColor:
                              qrFundingSource === "wallet"
                                ? isDark
                                  ? "#1E293B"
                                  : "#EFF6FF"
                                : isDark
                                  ? "#0F172A"
                                  : "#F8FAFC",
                            borderColor:
                              qrFundingSource === "wallet"
                                ? "#2563EB"
                                : isDark
                                  ? colors.border
                                  : "#E2E8F0",
                          },
                        ]}
                        onPress={() => setQrFundingSource("wallet")}
                        activeOpacity={0.8}
                      >
                        <View
                          style={[
                            styles.qrFundingRadio,
                            {
                              borderColor:
                                qrFundingSource === "wallet"
                                  ? "#2563EB"
                                  : isDark
                                    ? "#64748B"
                                    : "#CBD5E1",
                            },
                          ]}
                        >
                          {qrFundingSource === "wallet" && (
                            <View style={styles.qrFundingRadioInner} />
                          )}
                        </View>
                        <View
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            backgroundColor: "#059669",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Ionicons name="wallet" size={18} color="#FFFFFF" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: "800",
                              color: isDark ? colors.text : "#0F172A",
                            }}
                          >
                            Splitzy Available Balance
                          </Text>
                          <Text
                            style={{
                              fontSize: 11,
                              color: isDark ? colors.textMuted : "#64748B",
                              marginTop: 2,
                            }}
                          >
                            ₱
                            {(wallet?.balance || 0).toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                            })}{" "}
                            available
                          </Text>
                        </View>
                        <View
                          style={{
                            backgroundColor: isDark ? "#064E3B40" : "#ECFDF5",
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderRadius: 6,
                          }}
                        >
                          <Text
                            style={{
                              color: "#10B981",
                              fontSize: 10,
                              fontWeight: "800",
                            }}
                          >
                            Cash Balance
                          </Text>
                        </View>
                      </TouchableOpacity>

                      {/* Option 2..N: Linked Payment Cards */}
                      {wallet?.cards.map((card) => {
                        const isSelected = qrFundingSource === card.id;
                        return (
                          <TouchableOpacity
                            key={card.id}
                            style={[
                              styles.qrFundingOption,
                              {
                                backgroundColor: isSelected
                                  ? isDark
                                    ? "#1E293B"
                                    : "#EFF6FF"
                                  : isDark
                                    ? "#0F172A"
                                    : "#F8FAFC",
                                borderColor: isSelected
                                  ? "#2563EB"
                                  : isDark
                                    ? colors.border
                                    : "#E2E8F0",
                              },
                            ]}
                            onPress={() => setQrFundingSource(card.id)}
                            activeOpacity={0.8}
                          >
                            <View
                              style={[
                                styles.qrFundingRadio,
                                {
                                  borderColor: isSelected
                                    ? "#2563EB"
                                    : isDark
                                      ? "#64748B"
                                      : "#CBD5E1",
                                },
                              ]}
                            >
                              {isSelected && (
                                <View style={styles.qrFundingRadioInner} />
                              )}
                            </View>
                            <LinearGradient
                              colors={
                                card.colorGradient || ["#1E40AF", "#3B82F6"]
                              }
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 10,
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Ionicons name="card" size={18} color="#FFFFFF" />
                            </LinearGradient>
                            <View style={{ flex: 1 }}>
                              <Text
                                style={{
                                  fontSize: 13,
                                  fontWeight: "800",
                                  color: isDark ? colors.text : "#0F172A",
                                }}
                                numberOfLines={1}
                              >
                                {card.name}
                              </Text>
                              <Text
                                style={{
                                  fontSize: 11,
                                  color: isDark ? colors.textMuted : "#64748B",
                                  marginTop: 2,
                                }}
                              >
                                ₱
                                {(card.balance || 0).toLocaleString("en-US", {
                                  minimumFractionDigits: 2,
                                })}{" "}
                                · {card.accountNumber}
                              </Text>
                            </View>
                            {card.isDefault && (
                              <View
                                style={{
                                  backgroundColor: isDark
                                    ? "#1E293B"
                                    : "#E2E8F0",
                                  paddingHorizontal: 6,
                                  paddingVertical: 2,
                                  borderRadius: 4,
                                }}
                              >
                                <Text
                                  style={{
                                    color: isDark ? "#93C5FD" : "#2563EB",
                                    fontSize: 9,
                                    fontWeight: "800",
                                  }}
                                >
                                  Primary
                                </Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}

                      {/* Dynamic Overdraft Callout Banner */}
                      {(() => {
                        const parsedAmt = parseFloat(qrTransferAmount) || 0;
                        let selectedSourceBal = wallet?.balance || 0;
                        let selectedSourceName = "Splitzy Available Balance";

                        if (qrFundingSource !== "wallet") {
                          const chosenCard = wallet?.cards.find(
                            (c) => c.id === qrFundingSource,
                          );
                          selectedSourceBal = chosenCard?.balance || 0;
                          selectedSourceName = chosenCard?.name || "Card";
                        }

                        const isOverdraft = parsedAmt > selectedSourceBal;

                        return (
                          <View style={{ marginTop: 6, marginBottom: 12 }}>
                            {isOverdraft && (
                              <View
                                style={[
                                  styles.simPreviewCallout,
                                  {
                                    backgroundColor: isDark
                                      ? "#450A0A40"
                                      : "#FEF2F2",
                                    borderColor: "#EF4444",
                                    borderWidth: 1,
                                    marginBottom: 10,
                                  },
                                ]}
                              >
                                <Ionicons
                                  name="alert-circle"
                                  size={18}
                                  color="#EF4444"
                                />
                                <View style={{ flex: 1 }}>
                                  <Text
                                    style={[
                                      styles.simPreviewText,
                                      { color: "#EF4444", fontWeight: "700" },
                                    ]}
                                  >
                                    Insufficient funds on {selectedSourceName}{" "}
                                    (₱
                                    {selectedSourceBal.toLocaleString("en-US", {
                                      minimumFractionDigits: 2,
                                    })}{" "}
                                    available). Top up or choose another source
                                    to transfer ₱{parsedAmt.toFixed(2)}.
                                  </Text>
                                </View>
                              </View>
                            )}

                            <TouchableOpacity
                              style={[
                                styles.modalPrimaryBtn,
                                isOverdraft && { backgroundColor: "#94A3B8" },
                              ]}
                              disabled={isOverdraft || isProcessingQrTransfer}
                              onPress={handleExecuteQrTransfer}
                              activeOpacity={0.8}
                            >
                              {isProcessingQrTransfer ? (
                                <ActivityIndicator
                                  size="small"
                                  color="#FFFFFF"
                                />
                              ) : (
                                <>
                                  <Ionicons
                                    name={
                                      isOverdraft
                                        ? "alert-circle"
                                        : "paper-plane"
                                    }
                                    size={18}
                                    color="#FFFFFF"
                                  />
                                  <Text style={styles.modalPrimaryBtnText}>
                                    {isOverdraft
                                      ? "Insufficient Balance"
                                      : `Transfer ₱${parsedAmt > 0 ? parsedAmt.toFixed(2) : "0.00"} to ${scannedRecipient.name.split(" ")[0]}`}
                                  </Text>
                                </>
                              )}
                            </TouchableOpacity>
                          </View>
                        );
                      })()}
                    </View>
                  )}

                  {/* STEP C: TRANSFER RECEIPT */}
                  {qrScanStep === "receipt" && qrReceipt && (
                    <View style={{ alignItems: "center", width: "100%" }}>
                      {/* Success Checkmark Circle */}
                      <View
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: 32,
                          backgroundColor: "#10B981",
                          alignItems: "center",
                          justifyContent: "center",
                          marginVertical: 12,
                          shadowColor: "#10B981",
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.35,
                          shadowRadius: 10,
                          elevation: 6,
                        }}
                      >
                        <Ionicons name="checkmark" size={36} color="#FFFFFF" />
                      </View>

                      <Text
                        style={{
                          fontSize: 18,
                          fontWeight: "900",
                          color: isDark ? colors.text : "#0F172A",
                          textAlign: "center",
                        }}
                      >
                        Transfer Successful! 🎉
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          color: isDark ? colors.textMuted : "#64748B",
                          marginTop: 4,
                          textAlign: "center",
                        }}
                      >
                        Credited instantly to {qrReceipt.recipientName}'s wallet
                      </Text>

                      <Text
                        style={{
                          fontSize: 32,
                          fontWeight: "900",
                          color: "#10B981",
                          marginVertical: 12,
                          letterSpacing: -0.5,
                        }}
                      >
                        ₱
                        {qrReceipt.amount.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}
                      </Text>

                      {/* Digital Receipt Breakdown Card */}
                      <View
                        style={[
                          styles.qrReceiptCard,
                          {
                            backgroundColor: isDark ? "#0F172A" : "#F8FAFC",
                            borderColor: isDark ? colors.border : "#E2E8F0",
                            width: "100%",
                          },
                        ]}
                      >
                        <View style={styles.qrReceiptRow}>
                          <Text
                            style={[
                              styles.qrReceiptLabel,
                              { color: isDark ? colors.textMuted : "#64748B" },
                            ]}
                          >
                            Reference ID
                          </Text>
                          <TouchableOpacity
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 4,
                            }}
                            onPress={async () => {
                              await Clipboard.setStringAsync(
                                qrReceipt.refNumber,
                              );
                              Alert.alert(
                                "Copied",
                                "Reference ID copied to clipboard!",
                              );
                            }}
                          >
                            <Text
                              style={[
                                styles.qrReceiptValue,
                                {
                                  color: "#2563EB",
                                  fontFamily:
                                    Platform.OS === "ios"
                                      ? "Menlo"
                                      : "monospace",
                                },
                              ]}
                            >
                              {qrReceipt.refNumber}
                            </Text>
                            <Ionicons
                              name="copy-outline"
                              size={13}
                              color="#2563EB"
                            />
                          </TouchableOpacity>
                        </View>

                        <View style={styles.qrReceiptRow}>
                          <Text
                            style={[
                              styles.qrReceiptLabel,
                              { color: isDark ? colors.textMuted : "#64748B" },
                            ]}
                          >
                            Paid To
                          </Text>
                          <Text
                            style={[
                              styles.qrReceiptValue,
                              { color: isDark ? colors.text : "#0F172A" },
                            ]}
                          >
                            {qrReceipt.recipientName}
                          </Text>
                        </View>

                        <View style={styles.qrReceiptRow}>
                          <Text
                            style={[
                              styles.qrReceiptLabel,
                              { color: isDark ? colors.textMuted : "#64748B" },
                            ]}
                          >
                            Funding Source
                          </Text>
                          <Text
                            style={[
                              styles.qrReceiptValue,
                              { color: isDark ? colors.text : "#0F172A" },
                            ]}
                          >
                            {qrReceipt.sourceName}
                          </Text>
                        </View>

                        <View style={styles.qrReceiptRow}>
                          <Text
                            style={[
                              styles.qrReceiptLabel,
                              { color: isDark ? colors.textMuted : "#64748B" },
                            ]}
                          >
                            Time
                          </Text>
                          <Text
                            style={[
                              styles.qrReceiptValue,
                              { color: isDark ? colors.text : "#0F172A" },
                            ]}
                          >
                            {qrReceipt.timestamp}
                          </Text>
                        </View>

                        {qrReceipt.note ? (
                          <View style={styles.qrReceiptRow}>
                            <Text
                              style={[
                                styles.qrReceiptLabel,
                                {
                                  color: isDark ? colors.textMuted : "#64748B",
                                },
                              ]}
                            >
                              Note / Memo
                            </Text>
                            <Text
                              style={[
                                styles.qrReceiptValue,
                                { color: isDark ? colors.text : "#0F172A" },
                              ]}
                            >
                              {qrReceipt.note}
                            </Text>
                          </View>
                        ) : null}

                        <View style={styles.qrReceiptRow}>
                          <Text
                            style={[
                              styles.qrReceiptLabel,
                              { color: isDark ? colors.textMuted : "#64748B" },
                            ]}
                          >
                            Ledger Status
                          </Text>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <View
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: 3,
                                backgroundColor: "#10B981",
                              }}
                            />
                            <Text
                              style={{
                                color: "#10B981",
                                fontSize: 11,
                                fontWeight: "800",
                              }}
                            >
                              Synchronized
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Receipt Action Buttons */}
                      <View style={{ width: "100%", gap: 8, marginTop: 4 }}>
                        <TouchableOpacity
                          style={[
                            styles.modalPrimaryBtn,
                            { backgroundColor: "#2563EB" },
                          ]}
                          onPress={() => setShowScanQrModal(false)}
                          activeOpacity={0.8}
                        >
                          <Ionicons
                            name="checkmark"
                            size={18}
                            color="#FFFFFF"
                          />
                          <Text style={styles.modalPrimaryBtnText}>Done</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.modalCancelBtn,
                            {
                              backgroundColor: isDark ? "#1E293B" : "#F1F5F9",
                              borderWidth: 1,
                              borderColor: isDark ? colors.border : "#CBD5E1",
                            },
                          ]}
                          onPress={() => {
                            setQrScanStep("viewfinder");
                            setScannedRecipient(null);
                            setQrTransferAmount("");
                            setQrTransferNote("");
                            setQrReceipt(null);
                          }}
                          activeOpacity={0.8}
                        >
                          <Text
                            style={[
                              styles.modalCancelBtnText,
                              {
                                color: isDark ? colors.text : "#0F172A",
                                fontWeight: "700",
                              },
                            ]}
                          >
                            Make Another Transfer
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* QUICK CIRCLE MODAL 4: Spending Analytics */}
      <Modal
        visible={showAnalyticsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAnalyticsModal(false)}
        statusBarTranslucent={true}
      >
        <View style={dynamicModalOverlayStyle}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowAnalyticsModal(false)}
          />
          <View
            style={[
              styles.modalSheet,
              {
                maxHeight: modalAdaptiveMaxHeight,
                backgroundColor: isDark ? colors.cardElevated : "#FFFFFF",
                borderColor: isDark ? colors.border : "transparent",
                borderWidth: isDark ? 1 : 0,
              },
            ]}
          >
            <View
              style={[
                styles.modalHandle,
                isDark && { backgroundColor: colors.textMuted },
              ]}
            />
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 24 }}
            >
              <Text
                style={[
                  styles.modalTitle,
                  { color: isDark ? colors.text : "#0F172A" },
                ]}
              >
                Monthly Wallet Analytics
              </Text>
              <Text
                style={[
                  styles.modalSubtitle,
                  { color: isDark ? colors.textMuted : "#64748B" },
                ]}
              >
                Category expense distribution across cards
              </Text>

              <View style={{ marginVertical: 12, gap: 10 }}>
                {[
                  {
                    label: "Rent & Room Deposit",
                    pct: "55%",
                    amount: "₱8,250",
                    color: "#2563EB",
                  },
                  {
                    label: "Electricity & Meralco",
                    pct: "25%",
                    amount: "₱3,750",
                    color: "#D97706",
                  },
                  {
                    label: "Water & Shared Fiber",
                    pct: "12%",
                    amount: "₱1,800",
                    color: "#059669",
                  },
                  {
                    label: "Groceries & Supplies",
                    pct: "8%",
                    amount: "₱1,200",
                    color: "#7C3AED",
                  },
                ].map((item) => (
                  <View key={item.label}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        marginBottom: 4,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "600",
                          color: isDark ? colors.text : "#1E293B",
                        }}
                      >
                        {item.label}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "700",
                          color: isDark ? colors.textMuted : "#64748B",
                        }}
                      >
                        {item.amount} ({item.pct})
                      </Text>
                    </View>
                    <View
                      style={{
                        height: 8,
                        backgroundColor: isDark
                          ? colors.surfaceInset
                          : "#E2E8F0",
                        borderRadius: 4,
                        overflow: "hidden",
                      }}
                    >
                      <View
                        style={{
                          width: item.pct as any,
                          height: 8,
                          backgroundColor: item.color,
                          borderRadius: 4,
                        }}
                      />
                    </View>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={styles.modalPrimaryBtn}
                onPress={() => setShowAnalyticsModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalPrimaryBtnText}>Done</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* QUICK CIRCLE MODAL 5: Card Limits & Security Controls */}
      <Modal
        visible={showLimitsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLimitsModal(false)}
        statusBarTranslucent={true}
      >
        <View style={dynamicModalOverlayStyle}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowLimitsModal(false)}
          />
          <View
            style={[
              styles.modalSheet,
              {
                maxHeight: modalAdaptiveMaxHeight,
                backgroundColor: isDark ? colors.cardElevated : "#FFFFFF",
                borderColor: isDark ? colors.border : "transparent",
                borderWidth: isDark ? 1 : 0,
              },
            ]}
          >
            <View
              style={[
                styles.modalHandle,
                isDark && { backgroundColor: colors.textMuted },
              ]}
            />
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 24 }}
            >
              <Text
                style={[
                  styles.modalTitle,
                  { color: isDark ? colors.text : "#0F172A" },
                ]}
              >
                Card Limits & Security
              </Text>
              <Text
                style={[
                  styles.modalSubtitle,
                  { color: isDark ? colors.textMuted : "#64748B" },
                ]}
              >
                Daily spend caps and anti-fraud protections
              </Text>

              <Text
                style={[
                  styles.inputLabel,
                  { color: isDark ? colors.textSecondary : "#475569" },
                ]}
              >
                Daily Online Spend Limit (₱)
              </Text>
              <TextInput
                style={[
                  styles.modalTextInput,
                  {
                    backgroundColor: isDark ? colors.surfaceInset : "#F8FAFC",
                    borderColor: isDark ? colors.border : "#CBD5E1",
                    color: isDark ? colors.text : "#0F172A",
                    fontWeight: "800",
                  },
                ]}
                keyboardType="numeric"
                value={dailyOnlineLimit}
                onChangeText={setDailyOnlineLimit}
                placeholder="15000"
              />

              <View style={{ marginVertical: 12, gap: 10 }}>
                <TouchableOpacity
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: 12,
                    backgroundColor: isDark ? colors.surfaceInset : "#F8FAFC",
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: isDark ? colors.border : "#E2E8F0",
                  }}
                  onPress={() => setIsCardLocked(!isCardLocked)}
                >
                  <View>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: isDark ? colors.text : "#0F172A",
                      }}
                    >
                      Lock Cards Temporarily
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        color: isDark ? colors.textMuted : "#64748B",
                      }}
                    >
                      Instantly freeze linked debit cards
                    </Text>
                  </View>
                  <Ionicons
                    name={isCardLocked ? "lock-closed" : "lock-open-outline"}
                    size={22}
                    color={isCardLocked ? "#EF4444" : "#10B981"}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: 12,
                    backgroundColor: isDark ? colors.surfaceInset : "#F8FAFC",
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: isDark ? colors.border : "#E2E8F0",
                  }}
                  onPress={() => setAllowContactless(!allowContactless)}
                >
                  <View>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: isDark ? colors.text : "#0F172A",
                      }}
                    >
                      QR Ph & Contactless NFC
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        color: isDark ? colors.textMuted : "#64748B",
                      }}
                    >
                      Allow 1-tap fast settlements
                    </Text>
                  </View>
                  <Ionicons
                    name={
                      allowContactless
                        ? "checkmark-circle"
                        : "close-circle-outline"
                    }
                    size={22}
                    color={allowContactless ? "#10B981" : "#94A3B8"}
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.modalPrimaryBtn}
                onPress={() => {
                  setShowLimitsModal(false);
                  Alert.alert(
                    "Security Settings Saved",
                    `Daily limit set to ₱${parseFloat(dailyOnlineLimit || "0").toLocaleString()}. Security status active.`,
                  );
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.modalPrimaryBtnText}>Save Preferences</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowLimitsModal(false)}
              >
                <Text
                  style={[
                    styles.modalCancelBtnText,
                    { color: isDark ? colors.textMuted : "#64748B" },
                  ]}
                >
                  Close
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL 6: Splitzy Wallet Interactive Walkthrough */}
      <Modal
        visible={showWalkthroughModal}
        transparent
        animationType="slide"
        onRequestClose={() => handleFinishWalkthrough()}
        statusBarTranslucent={true}
      >
        <View style={styles.walkthroughOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => handleFinishWalkthrough()}
          />
          <View
            style={[
              styles.walkthroughCard,
              {
                backgroundColor: isDark ? colors.cardElevated : "#FFFFFF",
                borderColor: isDark ? colors.border : "transparent",
                borderWidth: isDark ? 1 : 0,
              },
            ]}
          >
            <View
              style={[
                styles.modalHandle,
                isDark && { backgroundColor: colors.textMuted },
                { marginTop: 12, marginBottom: 2 },
              ]}
            />
            {/* Top Bar: Step Indicator & Skip Button */}
            <View style={styles.walkthroughTopBar}>
              <View style={styles.walkthroughStepDots}>
                {[0, 1, 2, 3, 4, 5].map((idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.walkthroughDot,
                      walkthroughStep === idx
                        ? { backgroundColor: "#2563EB", width: 22 }
                        : {
                            backgroundColor: isDark ? colors.border : "#CBD5E1",
                            width: 6,
                          },
                    ]}
                  />
                ))}
              </View>

              <TouchableOpacity
                onPress={() => handleFinishWalkthrough()}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={styles.walkthroughSkipBtn}
              >
                <Text
                  style={[
                    styles.walkthroughSkipText,
                    { color: isDark ? colors.textMuted : "#64748B" },
                  ]}
                >
                  Skip
                </Text>
                <Ionicons
                  name="close-circle-outline"
                  size={18}
                  color={isDark ? colors.textMuted : "#64748B"}
                />
              </TouchableOpacity>
            </View>

            {/* Slide Body */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.walkthroughScrollContent}
            >
              {walkthroughStep === 0 && (
                <View style={styles.slideContainer}>
                  <View
                    style={[
                      styles.slideIconWrap,
                      { backgroundColor: "#2563EB18" },
                    ]}
                  >
                    <Ionicons name="wallet" size={44} color="#2563EB" />
                  </View>
                  <View style={styles.slideBadgeWrap}>
                    <Text style={styles.slideBadgeText}>
                      WELCOME TO SPLITZY WALLET
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.slideTitle,
                      { color: isDark ? colors.text : "#0F172A" },
                    ]}
                  >
                    Your Household Financial Hub
                  </Text>
                  <Text
                    style={[
                      styles.slideSubtitle,
                      { color: isDark ? colors.textMuted : "#64748B" },
                    ]}
                  >
                    Splitzy Wallet is your personal digital wallet built
                    specifically for effortless room expense splits and shared
                    goals.
                  </Text>

                  <View style={styles.slideFeatureList}>
                    <View
                      style={[
                        styles.slideFeatureItem,
                        {
                          backgroundColor: isDark
                            ? colors.surfaceInset
                            : "#F8FAFC",
                          borderColor: isDark ? colors.border : "#E2E8F0",
                        },
                      ]}
                    >
                      <Ionicons
                        name="shield-checkmark"
                        size={20}
                        color="#10B981"
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.slideFeatureHeading,
                            { color: isDark ? colors.text : "#0F172A" },
                          ]}
                        >
                          Clean Slate: Starts at ₱0.00
                        </Text>
                        <Text
                          style={[
                            styles.slideFeatureDesc,
                            { color: isDark ? colors.textMuted : "#64748B" },
                          ]}
                        >
                          No preloaded dummy money or mock cards. You start
                          completely fresh with full ownership.
                        </Text>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.slideFeatureItem,
                        {
                          backgroundColor: isDark
                            ? colors.surfaceInset
                            : "#F8FAFC",
                          borderColor: isDark ? colors.border : "#E2E8F0",
                        },
                      ]}
                    >
                      <Ionicons
                        name="swap-horizontal"
                        size={20}
                        color="#2563EB"
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.slideFeatureHeading,
                            { color: isDark ? colors.text : "#0F172A" },
                          ]}
                        >
                          1-Tap Bill Settlement
                        </Text>
                        <Text
                          style={[
                            styles.slideFeatureDesc,
                            { color: isDark ? colors.textMuted : "#64748B" },
                          ]}
                        >
                          Settle your fair share of rent, electricity, and water
                          directly from your wallet balance.
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {walkthroughStep === 1 && (
                <View style={styles.slideContainer}>
                  <View
                    style={[
                      styles.slideIconWrap,
                      { backgroundColor: "#10B98118" },
                    ]}
                  >
                    <Ionicons
                      name="arrow-down-circle"
                      size={44}
                      color="#10B981"
                    />
                  </View>
                  <View style={styles.slideBadgeWrap}>
                    <Text style={styles.slideBadgeText}>
                      DIGITAL BALANCE & CASH IN
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.slideTitle,
                      { color: isDark ? colors.text : "#0F172A" },
                    ]}
                  >
                    Top Up Whenever You Need
                  </Text>
                  <Text
                    style={[
                      styles.slideSubtitle,
                      { color: isDark ? colors.textMuted : "#64748B" },
                    ]}
                  >
                    Fund your wallet easily using popular Philippine payment
                    channels.
                  </Text>

                  <View style={styles.slideFeatureList}>
                    <View
                      style={[
                        styles.slideFeatureItem,
                        {
                          backgroundColor: isDark
                            ? colors.surfaceInset
                            : "#F8FAFC",
                          borderColor: isDark ? colors.border : "#E2E8F0",
                        },
                      ]}
                    >
                      <Ionicons
                        name="phone-portrait-outline"
                        size={20}
                        color="#0284C7"
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.slideFeatureHeading,
                            { color: isDark ? colors.text : "#0F172A" },
                          ]}
                        >
                          GCash & Maya Supported
                        </Text>
                        <Text
                          style={[
                            styles.slideFeatureDesc,
                            { color: isDark ? colors.textMuted : "#64748B" },
                          ]}
                        >
                          Transfer funds directly or simulate digital wallet
                          top-ups in seconds.
                        </Text>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.slideFeatureItem,
                        {
                          backgroundColor: isDark
                            ? colors.surfaceInset
                            : "#F8FAFC",
                          borderColor: isDark ? colors.border : "#E2E8F0",
                        },
                      ]}
                    >
                      <Ionicons
                        name="business-outline"
                        size={20}
                        color="#B91C1C"
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.slideFeatureHeading,
                            { color: isDark ? colors.text : "#0F172A" },
                          ]}
                        >
                          Philippine Banks
                        </Text>
                        <Text
                          style={[
                            styles.slideFeatureDesc,
                            { color: isDark ? colors.textMuted : "#64748B" },
                          ]}
                        >
                          Top up from BPI, BDO, UnionBank, Metrobank or
                          customized accounts.
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {walkthroughStep === 2 && (
                <View style={styles.slideContainer}>
                  <View
                    style={[
                      styles.slideIconWrap,
                      { backgroundColor: "#6366F118" },
                    ]}
                  >
                    <Ionicons name="receipt" size={44} color="#6366F1" />
                  </View>
                  <View style={styles.slideBadgeWrap}>
                    <Text style={styles.slideBadgeText}>
                      SEAMLESS SETTLEMENTS
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.slideTitle,
                      { color: isDark ? colors.text : "#0F172A" },
                    ]}
                  >
                    Settle Bills Without Friction
                  </Text>
                  <Text
                    style={[
                      styles.slideSubtitle,
                      { color: isDark ? colors.textMuted : "#64748B" },
                    ]}
                  >
                    Forget awkward reminders, paper receipts, or searching for
                    exact change.
                  </Text>

                  <View style={styles.slideFeatureList}>
                    <View
                      style={[
                        styles.slideFeatureItem,
                        {
                          backgroundColor: isDark
                            ? colors.surfaceInset
                            : "#F8FAFC",
                          borderColor: isDark ? colors.border : "#E2E8F0",
                        },
                      ]}
                    >
                      <Ionicons
                        name="checkmark-done-circle"
                        size={20}
                        color="#10B981"
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.slideFeatureHeading,
                            { color: isDark ? colors.text : "#0F172A" },
                          ]}
                        >
                          Automatic Roommate Sync
                        </Text>
                        <Text
                          style={[
                            styles.slideFeatureDesc,
                            { color: isDark ? colors.textMuted : "#64748B" },
                          ]}
                        >
                          When you pay from Splitzy Wallet, your share is marked
                          as 'Paid' instantly for your host and roommates.
                        </Text>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.slideFeatureItem,
                        {
                          backgroundColor: isDark
                            ? colors.surfaceInset
                            : "#F8FAFC",
                          borderColor: isDark ? colors.border : "#E2E8F0",
                        },
                      ]}
                    >
                      <Ionicons
                        name="document-text-outline"
                        size={20}
                        color="#6366F1"
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.slideFeatureHeading,
                            { color: isDark ? colors.text : "#0F172A" },
                          ]}
                        >
                          Digital Ledger & Proof
                        </Text>
                        <Text
                          style={[
                            styles.slideFeatureDesc,
                            { color: isDark ? colors.textMuted : "#64748B" },
                          ]}
                        >
                          Every payment generates a complete timestamped digital
                          receipt stored in your Activity Ledger.
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {walkthroughStep === 3 && (
                <View style={styles.slideContainer}>
                  <View
                    style={[
                      styles.slideIconWrap,
                      { backgroundColor: "#F59E0B18" },
                    ]}
                  >
                    <Ionicons
                      name="shield-checkmark"
                      size={44}
                      color="#F59E0B"
                    />
                  </View>
                  <View style={styles.slideBadgeWrap}>
                    <Text style={styles.slideBadgeText}>
                      GOAL-BASED SAVINGS
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.slideTitle,
                      { color: isDark ? colors.text : "#0F172A" },
                    ]}
                  >
                    Smart Savings Pockets
                  </Text>
                  <Text
                    style={[
                      styles.slideSubtitle,
                      { color: isDark ? colors.textMuted : "#64748B" },
                    ]}
                  >
                    Set aside money into targeted sub-wallets to keep your
                    emergency cushion and rent deposits protected.
                  </Text>

                  <View style={styles.slideFeatureList}>
                    <View
                      style={[
                        styles.slideFeatureItem,
                        {
                          backgroundColor: isDark
                            ? colors.surfaceInset
                            : "#F8FAFC",
                          borderColor: isDark ? colors.border : "#E2E8F0",
                        },
                      ]}
                    >
                      <Ionicons name="flag-outline" size={20} color="#F59E0B" />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.slideFeatureHeading,
                            { color: isDark ? colors.text : "#0F172A" },
                          ]}
                        >
                          Goal Milestones & Tracking
                        </Text>
                        <Text
                          style={[
                            styles.slideFeatureDesc,
                            { color: isDark ? colors.textMuted : "#64748B" },
                          ]}
                        >
                          Define target amounts for security deposits,
                          appliances, or trips with live progress bars.
                        </Text>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.slideFeatureItem,
                        {
                          backgroundColor: isDark
                            ? colors.surfaceInset
                            : "#F8FAFC",
                          borderColor: isDark ? colors.border : "#E2E8F0",
                        },
                      ]}
                    >
                      <Ionicons
                        name="repeat-outline"
                        size={20}
                        color="#10B981"
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.slideFeatureHeading,
                            { color: isDark ? colors.text : "#0F172A" },
                          ]}
                        >
                          Stash & Withdraw Anytime
                        </Text>
                        <Text
                          style={[
                            styles.slideFeatureDesc,
                            { color: isDark ? colors.textMuted : "#64748B" },
                          ]}
                        >
                          Transfer funds into a pocket or withdraw back to your
                          main wallet balance anytime without fees.
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {walkthroughStep === 4 && (
                <View style={styles.slideContainer}>
                  <View
                    style={[
                      styles.slideIconWrap,
                      { backgroundColor: "#EC489918" },
                    ]}
                  >
                    <Ionicons name="card" size={44} color="#EC4899" />
                  </View>
                  <View style={styles.slideBadgeWrap}>
                    <Text style={styles.slideBadgeText}>
                      PAYMENT CARDS DECK
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.slideTitle,
                      { color: isDark ? colors.text : "#0F172A" },
                    ]}
                  >
                    Link Backup Payment Cards
                  </Text>
                  <Text
                    style={[
                      styles.slideSubtitle,
                      { color: isDark ? colors.textMuted : "#64748B" },
                    ]}
                  >
                    Add your cards and e-wallet accounts to streamline future
                    top-ups and recurring bills.
                  </Text>

                  <View style={styles.slideFeatureList}>
                    <View
                      style={[
                        styles.slideFeatureItem,
                        {
                          backgroundColor: isDark
                            ? colors.surfaceInset
                            : "#F8FAFC",
                          borderColor: isDark ? colors.border : "#E2E8F0",
                        },
                      ]}
                    >
                      <Ionicons name="star" size={20} color="#F59E0B" />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.slideFeatureHeading,
                            { color: isDark ? colors.text : "#0F172A" },
                          ]}
                        >
                          Default Primary Card
                        </Text>
                        <Text
                          style={[
                            styles.slideFeatureDesc,
                            { color: isDark ? colors.textMuted : "#64748B" },
                          ]}
                        >
                          Designate a default payment method for swift 1-tap
                          checkout.
                        </Text>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.slideFeatureItem,
                        {
                          backgroundColor: isDark
                            ? colors.surfaceInset
                            : "#F8FAFC",
                          borderColor: isDark ? colors.border : "#E2E8F0",
                        },
                      ]}
                    >
                      <Ionicons name="lock-closed" size={20} color="#2563EB" />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.slideFeatureHeading,
                            { color: isDark ? colors.text : "#0F172A" },
                          ]}
                        >
                          Masked & Secure
                        </Text>
                        <Text
                          style={[
                            styles.slideFeatureDesc,
                            { color: isDark ? colors.textMuted : "#64748B" },
                          ]}
                        >
                          Account numbers are masked with dot placeholders for
                          complete privacy.
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {walkthroughStep === 5 && (
                <View style={styles.slideContainer}>
                  <View
                    style={[
                      styles.slideIconWrap,
                      { backgroundColor: "#2563EB18" },
                    ]}
                  >
                    <Ionicons name="rocket" size={44} color="#2563EB" />
                  </View>
                  <View style={styles.slideBadgeWrap}>
                    <Text style={styles.slideBadgeText}>
                      READY TO GET STARTED
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.slideTitle,
                      { color: isDark ? colors.text : "#0F172A" },
                    ]}
                  >
                    Your Splitzy Wallet is Ready!
                  </Text>
                  <Text
                    style={[
                      styles.slideSubtitle,
                      { color: isDark ? colors.textMuted : "#64748B" },
                    ]}
                  >
                    Your wallet is active and starts at ₱0.00. Choose what you'd
                    like to do first:
                  </Text>

                  <View style={{ width: "100%", gap: 10, marginTop: 16 }}>
                    <TouchableOpacity
                      style={styles.walkthroughActionPrimary}
                      onPress={() => handleFinishWalkthrough("cash_in")}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="arrow-down-circle"
                        size={18}
                        color="#FFFFFF"
                      />
                      <Text style={styles.walkthroughActionPrimaryText}>
                        Cash In First Balance
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.walkthroughActionSecondary,
                        {
                          borderColor: isDark ? colors.border : "#CBD5E1",
                          backgroundColor: isDark
                            ? colors.surfaceInset
                            : "#F8FAFC",
                        },
                      ]}
                      onPress={() => handleFinishWalkthrough("add_card")}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="card-outline" size={18} color="#2563EB" />
                      <Text
                        style={[
                          styles.walkthroughActionSecondaryText,
                          { color: isDark ? colors.text : "#0F172A" },
                        ]}
                      >
                        Add a Payment Card
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.walkthroughActionSecondary,
                        {
                          borderColor: isDark ? colors.border : "#CBD5E1",
                          backgroundColor: isDark
                            ? colors.surfaceInset
                            : "#F8FAFC",
                        },
                      ]}
                      onPress={() => handleFinishWalkthrough("add_pocket")}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="shield-outline"
                        size={18}
                        color="#059669"
                      />
                      <Text
                        style={[
                          styles.walkthroughActionSecondaryText,
                          { color: isDark ? colors.text : "#0F172A" },
                        ]}
                      >
                        Create a Savings Pocket
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{ paddingVertical: 10, alignItems: "center" }}
                      onPress={() => handleFinishWalkthrough()}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "600",
                          color: isDark ? colors.textMuted : "#64748B",
                        }}
                      >
                        Go straight to Empty Dashboard →
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Bottom Nav Controls */}
            {walkthroughStep < 5 && (
              <View
                style={[
                  styles.walkthroughBottomNav,
                  { borderTopColor: isDark ? colors.border : "#F1F5F9" },
                ]}
              >
                {walkthroughStep > 0 ? (
                  <TouchableOpacity
                    style={[
                      styles.walkthroughNavBackBtn,
                      {
                        borderColor: isDark ? colors.border : "#E2E8F0",
                        backgroundColor: isDark
                          ? colors.surfaceInset
                          : "#F8FAFC",
                      },
                    ]}
                    onPress={() =>
                      setWalkthroughStep((s) => Math.max(0, s - 1))
                    }
                  >
                    <Ionicons
                      name="arrow-back"
                      size={16}
                      color={isDark ? colors.textSecondary : "#64748B"}
                    />
                    <Text
                      style={[
                        styles.walkthroughNavBackText,
                        { color: isDark ? colors.textSecondary : "#64748B" },
                      ]}
                    >
                      Back
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View style={{ width: 80 }} />
                )}

                <Text
                  style={[
                    styles.walkthroughStepCounter,
                    { color: isDark ? colors.textMuted : "#94A3B8" },
                  ]}
                >
                  {walkthroughStep + 1} of 6
                </Text>

                <TouchableOpacity
                  style={styles.walkthroughNavNextBtn}
                  onPress={() => setWalkthroughStep((s) => Math.min(5, s + 1))}
                  activeOpacity={0.8}
                >
                  <Text style={styles.walkthroughNavNextText}>Next</Text>
                  <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 14,
    fontWeight: "500",
    marginTop: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: "500",
  },
  headerActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  headerActionBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2563EB",
  },
  headerDeleteBtn: {
    alignItems: "center",
    justifyContent: "center",
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    marginLeft: 6,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 96,
  },
  heroCard: {
    borderRadius: 24,
    padding: 22,
    marginBottom: 8,
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  heroIndicatorDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  heroLabel: {
    color: "#E2E8F0",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  heroBalance: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -1,
    marginVertical: 14,
    fontVariant: ["tabular-nums"],
  },
  heroActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  heroBtnPrimary: {
    flex: 1.2,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  heroBtnPrimaryText: {
    color: "#2563EB",
    fontSize: 13,
    fontWeight: "700",
  },
  heroBtnSecondary: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  heroBtnSecondaryText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  quickCircleMenuContainer: {
    marginVertical: 14,
    marginHorizontal: -20,
  },
  quickCircleScrollView: {
    overflow: "visible",
  },
  quickCircleScrollContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  quickCircleItem: {
    alignItems: "center",
    justifyContent: "center",
    width: 72,
  },
  quickCircleBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: 6,
  },
  quickCircleLabel: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  sectionHeaderRow: {
    flexDirection: "column",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  titleAddRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: "500",
  },
  addSectionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  addSectionBtnText: {
    color: "#2563EB",
    fontSize: 13,
    fontWeight: "700",
  },
  cardsCarousel: {
    gap: 14,
    paddingBottom: 20,
    paddingRight: 10,
  },
  cardItem: {
    width: 250,
    height: 172,
    borderRadius: 20,
    padding: 16,
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  cardItemTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardBrandBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  cardBrandName: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  cardDefaultBadge: {
    backgroundColor: "#10B981",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cardDefaultText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
  },
  cardTrashBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0, 0, 0, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardBalanceRow: {
    marginVertical: 2,
  },
  cardBalanceLabel: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  cardBalanceAmount: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
    fontVariant: ["tabular-nums"],
  },
  cardItemMiddle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 2,
  },
  cardNumberText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 2,
    fontVariant: ["tabular-nums"],
  },
  cardItemBottom: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  cardHolderLabel: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  cardHolderName: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  cardNetworkBadge: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  cardExpiryText: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 9,
    fontWeight: "700",
    marginTop: 2,
  },
  cardDetailBanner: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  cardDetailBannerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardDetailActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  cardDetailActionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cardDetailActionTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  cardDetailActionSub: {
    fontSize: 11,
    fontWeight: "500",
  },
  cardDetailGridRow: {
    flexDirection: "row",
    gap: 8,
  },
  cardDetailGridBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  cardDetailGridBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  addCardPlaceholder: {
    width: 140,
    height: 172,
    borderRadius: 20,
    borderWidth: 2,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
  },
  addCardIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#2563EB15",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  addCardPlaceholderText: {
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  addCardPlaceholderSub: {
    fontSize: 10,
    textAlign: "center",
    marginTop: 4,
  },
  pocketsScrollView: {
    marginHorizontal: -20,
    overflow: "visible",
  },
  pocketsCarousel: {
    flexDirection: "row",
    gap: 14,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  pocketCard: {
    width: 260,
    minHeight: 184,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    justifyContent: "space-between",
  },
  addPocketPlaceholder: {
    width: 150,
    minHeight: 184,
    borderRadius: 18,
    borderWidth: 2,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
  },
  addPocketIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#2563EB15",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  pocketTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  pocketIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  pocketProgressBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pocketProgressBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  pocketName: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 6,
  },
  pocketAmountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    marginBottom: 8,
  },
  pocketCurrent: {
    fontSize: 15,
    fontWeight: "800",
  },
  pocketTarget: {
    fontSize: 11,
    fontWeight: "600",
  },
  progressBarTrack: {
    height: 5,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 12,
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  pocketButtonsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pocketBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 7,
    borderRadius: 8,
  },
  pocketBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563EB",
  },
  filterTabsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  filterTabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: "600",
  },
  emptyTxBox: {
    borderRadius: 18,
    padding: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  emptyTxTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 10,
  },
  emptyTxSubtitle: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
  },
  txListContainer: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },
  txIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  txInfoCol: {
    flex: 1,
  },
  txTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  txMeta: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: "500",
  },
  txAmountCol: {
    alignItems: "flex-end",
  },
  txAmount: {
    fontSize: 14,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  txStatusCompleted: {
    fontSize: 10,
    color: "#10B981",
    fontWeight: "700",
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 28,
    maxHeight: "92%",
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#94A3B8",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: "800",
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 3,
    marginBottom: 16,
  },
  quickAmountsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  quickPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  quickPillText: {
    fontSize: 13,
    fontWeight: "700",
  },
  amountInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  currencyPrefix: {
    fontSize: 22,
    fontWeight: "700",
    marginRight: 6,
  },
  amountCurrency: {
    fontSize: 22,
    fontWeight: "700",
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: "800",
    paddingVertical: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
  },
  sourcesRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 18,
  },
  sourceCard: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  sourceText: {
    fontSize: 11,
    fontWeight: "700",
  },
  providerChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  providerChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  modalTextInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 14,
  },
  modalPrimaryBtn: {
    width: "100%",
    flexDirection: "row",
    backgroundColor: "#2563EB",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  modalPrimaryBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  modalCancelBtn: {
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  modalCancelBtnText: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "600",
  },
  cardPickBox: {
    width: 145,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 10,
    justifyContent: "space-between",
  },
  cardPickName: {
    fontSize: 12,
    fontWeight: "700",
  },
  cardPickAccount: {
    fontSize: 11,
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },
  cardPickBalance: {
    fontSize: 13,
    fontWeight: "800",
    color: "#2563EB",
    marginTop: 6,
    fontVariant: ["tabular-nums"],
  },
  cardDefaultMiniBadge: {
    backgroundColor: "#10B981",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  cardDefaultMiniText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "800",
  },
  deleteWarningBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  deleteWarningPrompt: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  modalDangerBtn: {
    backgroundColor: "#DC2626",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    marginBottom: 8,
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  modalDangerBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  receiptSheet: {
    width: "100%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    padding: 24,
    paddingBottom: 36,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  receiptTopCircle: {
    marginBottom: 8,
  },
  receiptTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  receiptAmount: {
    fontSize: 30,
    fontWeight: "900",
    color: "#10B981",
    marginVertical: 8,
  },
  receiptDivider: {
    width: "100%",
    height: 1,
    marginVertical: 16,
  },
  receiptRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  receiptLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
  receiptValue: {
    fontSize: 12,
    fontWeight: "700",
  },
  receiptNoteCard: {
    width: "100%",
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  receiptNoteLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  receiptNoteValue: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    marginTop: 2,
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTourBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  headerTourBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  quickStartCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    marginBottom: 24,
  },
  quickStartHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  quickStartBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#2563EB15",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  quickStartBadgeText: {
    color: "#2563EB",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  quickStartTourLink: {
    color: "#2563EB",
    fontSize: 12,
    fontWeight: "700",
  },
  quickStartTitle: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  quickStartSubtitle: {
    fontSize: 12,
    marginTop: 3,
    marginBottom: 14,
    lineHeight: 18,
  },
  quickStepsList: {
    gap: 10,
  },
  quickStepItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
  },
  quickStepNumberWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  quickStepNumber: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  quickStepTextCol: {
    flex: 1,
  },
  quickStepTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  quickStepDesc: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  emptyCardsCard: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginBottom: 24,
  },
  emptyCardIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#2563EB15",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  emptyCardsTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  emptyCardsSubtitle: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 17,
    maxWidth: 280,
    marginBottom: 16,
  },
  emptyCardActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#2563EB",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
  },
  emptyCardActionBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  emptyPocketsContainer: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginBottom: 24,
  },
  emptyPocketIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#10B98115",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  emptyPocketsTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  emptyPocketsSubtitle: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 17,
    maxWidth: 280,
    marginBottom: 16,
  },
  emptyPocketActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#10B981",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
  },
  emptyPocketActionBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  walkthroughOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "flex-end",
  },
  walkthroughCard: {
    width: "100%",
    maxHeight: "86%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  walkthroughTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 10,
  },
  walkthroughStepDots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  walkthroughDot: {
    height: 6,
    borderRadius: 3,
  },
  walkthroughSkipBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  walkthroughSkipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  walkthroughScrollContent: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 20,
  },
  slideContainer: {
    alignItems: "center",
  },
  slideIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  slideBadgeWrap: {
    backgroundColor: "#2563EB15",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  slideBadgeText: {
    color: "#2563EB",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  slideTitle: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.4,
    textAlign: "center",
    marginBottom: 8,
  },
  slideSubtitle: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  slideFeatureList: {
    width: "100%",
    gap: 10,
  },
  slideFeatureItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  slideFeatureHeading: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  slideFeatureDesc: {
    fontSize: 11,
    lineHeight: 16,
  },
  walkthroughActionPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#2563EB",
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  walkthroughActionPrimaryText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  walkthroughActionSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    paddingVertical: 13,
    borderRadius: 16,
  },
  walkthroughActionSecondaryText: {
    fontSize: 13,
    fontWeight: "700",
  },
  walkthroughBottomNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    marginBottom: 30,
  },
  walkthroughNavBackBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  walkthroughNavBackText: {
    fontSize: 13,
    fontWeight: "600",
  },
  walkthroughStepCounter: {
    fontSize: 12,
    fontWeight: "600",
  },
  walkthroughNavNextBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#2563EB",
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 12,
  },
  walkthroughNavNextText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  // Quick Expense Circles & Daily Simulator Styles
  quickExpenseSectionCard: {
    marginVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  quickExpenseHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 10,
  },
  quickExpenseTitleBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  quickExpenseTitle: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  quickExpenseSubtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  quickExpenseLiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  quickExpenseLiveBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  quickExpensePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  activeCardSelectorPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: 160,
  },
  activeCardSelectorText: {
    fontSize: 11,
    fontWeight: "600",
    flexShrink: 1,
  },
  quickExpenseScrollView: {
    marginHorizontal: -4,
  },
  quickExpenseScrollContent: {
    paddingHorizontal: 4,
    gap: 12,
    alignItems: "center",
    paddingBottom: 2,
  },
  quickExpenseCircleItem: {
    alignItems: "center",
    width: 68,
  },
  quickExpenseCircleGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 4,
    marginBottom: 6,
  },
  quickExpenseCircleName: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 3,
  },
  quickExpenseAmountPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  quickExpenseAmountPillText: {
    fontSize: 10,
    fontWeight: "700",
  },

  // Quick Expense Simulation Modal Styles
  simModalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  simModalIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  simModalSub: {
    fontSize: 12,
    marginTop: 2,
  },
  simAmountInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginTop: 4,
  },
  simAmountCurrency: {
    fontSize: 24,
    fontWeight: "700",
    marginRight: 6,
  },
  simAmountTextInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: "700",
    paddingVertical: 10,
  },
  simChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  simChipBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  simChipBtnText: {
    fontSize: 11,
    fontWeight: "600",
  },
  simCardOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 8,
  },
  simCardColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  simCardOptionName: {
    fontSize: 12,
    fontWeight: "700",
  },
  simCardOptionBal: {
    fontSize: 11,
  },
  simPreviewCallout: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
  },
  simPreviewText: {
    fontSize: 12,
    fontWeight: "600",
  },

  // Card-to-Card Transfer Styles
  transferHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  transferHeaderIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  transferPairContainer: {
    gap: 8,
    marginTop: 6,
    position: "relative",
  },
  transferCardBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
  },
  transferCardBoxLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  transferCardPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  transferCardPillActive: {
    borderWidth: 1.5,
  },
  transferCardPillName: {
    fontSize: 12,
    fontWeight: "700",
  },
  transferCardPillBal: {
    fontSize: 10,
    marginTop: 1,
  },
  transferSwapBtn: {
    alignSelf: "center",
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: -6,
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  transferSummaryBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
  },

  // Bespoke Cash Card Styles
  cardRightMeta: {
    alignItems: "flex-end",
  },
  cashCardItem: {
    overflow: "hidden",
    position: "relative",
  },
  cashWatermarkWrap: {
    position: "absolute",
    right: -18,
    bottom: -22,
    zIndex: 0,
    pointerEvents: "none",
  },
  cashBrandBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(5, 150, 105, 0.35)",
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(52, 211, 153, 0.4)",
  },
  cashBrandText: {
    color: "#E6FFFA",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  cashTenderBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  cashTenderText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  cashBalanceLabel: {
    color: "#A7F3D0",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  cashBalanceAmount: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    marginTop: 2,
    letterSpacing: 0.5,
  },
  cashAutoLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#34D399",
  },
  cashAutoLiveText: {
    color: "#6EE7B7",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  cashSerialText: {
    color: "#D1FAE5",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  cashSubBadgeText: {
    color: "#A7F3D0",
    fontSize: 9,
    fontWeight: "600",
  },

  // Pocket Card Options Deck
  pocketCardOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    minWidth: 130,
  },
  pocketCardOptionName: {
    fontSize: 12,
    fontWeight: "700",
  },
  pocketCardOptionAccount: {
    fontSize: 10,
    marginBottom: 2,
  },
  pocketCardOptionBal: {
    fontSize: 12,
    fontWeight: "800",
  },
  pocketPreviewBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
  },
  pocketPreviewText: {
    fontSize: 11,
    fontWeight: "600",
    flex: 1,
  },

  // Cash Modals
  cashSourcePill: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 6,
  },
  cashSourcePillTitle: {
    fontSize: 12,
    fontWeight: "700",
  },
  cashSourcePillBal: {
    fontSize: 11,
    fontWeight: "700",
  },
  cashAutoHealthCard: {
    padding: 14,
    borderRadius: 16,
    marginTop: 4,
  },
  cashAutoHealthLabel: {
    color: "#A7F3D0",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  cashAutoHealthAmount: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    marginVertical: 4,
  },
  cashAutoHealthFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.15)",
    paddingTop: 6,
    marginTop: 4,
  },
  cashAutoHealthFooterText: {
    color: "#D1FAE5",
    fontSize: 10,
  },
  cashAutoHealthBurn: {
    color: "#FDE047",
    fontSize: 10,
    fontWeight: "700",
  },
  cashRuleItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  cashRuleTitle: {
    fontSize: 12,
    fontWeight: "700",
  },
  cashRuleSub: {
    fontSize: 10,
    marginTop: 2,
  },
  cashRuleToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  cashRuleToggleText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  cashReplenishBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  cashReplenishBtnText: {
    color: "#2563EB",
    fontSize: 12,
    fontWeight: "700",
  },

  // Splitzy Cross-User QR Engine Styles
  qrModalTabsRow: {
    flexDirection: "row",
    backgroundColor: "rgba(148, 163, 184, 0.12)",
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  qrModalTabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  qrModalTabBtnActive: {
    backgroundColor: "#2563EB",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  qrModalTabText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
  },
  qrModalTabTextActive: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  qrCodeCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  qrIdentityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    width: "100%",
  },
  qrIdentityAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  qrIdentityAvatarText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  qrIdentityName: {
    fontSize: 14,
    fontWeight: "800",
  },
  qrIdentitySub: {
    fontSize: 11,
    marginTop: 2,
  },
  qrPresetToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
    width: "100%",
  },
  qrPresetToggleText: {
    fontSize: 12,
    fontWeight: "700",
  },
  qrPresetBox: {
    marginTop: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    width: "100%",
    gap: 10,
  },
  qrPresetInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  qrPresetInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    paddingVertical: 0,
  },
  qrQuickPillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  qrQuickPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  qrQuickPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  qrActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    width: "100%",
  },
  qrActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  qrActionBtnText: {
    fontSize: 12,
    fontWeight: "800",
  },
  qrTipBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginTop: 12,
    width: "100%",
  },
  qrTipText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
  },
  qrViewfinder: {
    height: 220,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
    borderWidth: 2,
    marginVertical: 12,
  },
  qrCornerMarker: {
    position: "absolute",
    width: 24,
    height: 24,
    borderColor: "#3B82F6",
  },
  qrLaserLine: {
    position: "absolute",
    left: 20,
    right: 20,
    height: 3,
    backgroundColor: "#38BDF8",
    borderRadius: 2,
    shadowColor: "#38BDF8",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 6,
  },
  qrQuickRoommatesRow: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 6,
  },
  qrRoommateChip: {
    alignItems: "center",
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    minWidth: 84,
  },
  qrRoommateAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  qrRoommateAvatarText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  qrRoommateName: {
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  qrRoommateRole: {
    fontSize: 9,
    marginTop: 2,
  },
  qrFundingOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 8,
    gap: 12,
  },
  qrFundingRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  qrFundingRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#2563EB",
  },
  qrReceiptCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginVertical: 14,
    gap: 10,
  },
  qrReceiptRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  qrReceiptLabel: {
    fontSize: 12,
  },
  qrReceiptValue: {
    fontSize: 12,
    fontWeight: "700",
  },
});
