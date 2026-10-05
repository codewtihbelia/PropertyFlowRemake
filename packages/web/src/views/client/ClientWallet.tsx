import React, { useState, useEffect } from "react";
import {
  Wallet,
  ArrowDownCircle,
  Receipt,
  Plus,
  CreditCard,
  Eye,
  EyeOff,
  Shield,
  Plane,
  Home,
  CheckCircle2,
  X,
  ArrowUpRight,
  TrendingDown,
  Building,
  Sparkles,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  Lock,
  Smartphone,
  Trash2,
  AlertTriangle,
  Send,
  Users,
  QrCode,
  PieChart,
  ShieldCheck,
  Cpu,
  Radio,
  Copy,
  Check,
  ArrowLeftRight,
  Coffee,
  Utensils,
  Bus,
  ShoppingCart,
  Cookie,
  Zap,
  Pill,
  PlusCircle,
  Banknote,
  Car,
  Film,
  Dumbbell,
  Scissors,
  BookOpen,
  Heart,
  Tag,
  Bookmark,
  Compass,
  Gift,
  ShoppingBag,
  FileText,
} from "lucide-react";
import {
  webWalletService,
  WalletState,
  PaymentCard,
  SavingsPocket,
  WalletTransaction,
  CardProviderType,
  PHILIPPINE_CARD_PRESETS,
  CashAutomationRule,
  DEFAULT_CASH_RULES,
} from "../../services/walletService";
import { useAuth } from "../../contexts/AuthContext";

export interface QuickExpensePreset {
  id: string;
  title: string;
  icon:
    | "coffee"
    | "utensils"
    | "bus"
    | "shopping-cart"
    | "cookie"
    | "zap"
    | "pill"
    | "custom"
    | "grocery";
  amount: number;
  gradient: [string, string];
  defaultNote: string;
  color: string;
}

export const QUICK_EXPENSE_PRESETS: QuickExpensePreset[] = [
  {
    id: "coffee",
    title: "Coffee Break",
    icon: "coffee",
    amount: 150,
    gradient: ["#78350F", "#D97706"],
    defaultNote: "Morning espresso & pastry",
    color: "#F59E0B",
  },
  {
    id: "lunch",
    title: "Lunch Meal",
    icon: "utensils",
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
    icon: "grocery",
    amount: 480,
    gradient: ["#047857", "#10B981"],
    defaultNote: "Fresh market & pantry supplies",
    color: "#34D399",
  },
  {
    id: "merienda",
    title: "Merienda Snack",
    icon: "cookie",
    amount: 95,
    gradient: ["#B45309", "#F59E0B"],
    defaultNote: "Afternoon milk tea & snack",
    color: "#FBBF24",
  },
  {
    id: "utility",
    title: "Mobile Load / Bills",
    icon: "zap",
    amount: 300,
    gradient: ["#6D28D9", "#8B5CF6"],
    defaultNote: "Data reload / household utility",
    color: "#A78BFA",
  },
  {
    id: "pharmacy",
    title: "Pharmacy / Meds",
    icon: "pill",
    amount: 180,
    gradient: ["#BE123C", "#F43F5E"],
    defaultNote: "Vitamins & pharmacy essentials",
    color: "#FB7185",
  },
  {
    id: "custom",
    title: "Custom Expense",
    icon: "custom",
    amount: 100,
    gradient: ["#1E293B", "#334155"],
    defaultNote: "Custom daily simulation",
    color: "#94A3B8",
  },
];

export interface SemanticExpenseInputWeb {
  title?: string;
  note?: string;
  description?: string;
  category?: string;
  icon?: string;
  type?: string;
  amount?: number;
  [key: string]: any;
}

export type AppWalletTransactionWeb = WalletTransaction & {
  note?: string;
  icon?: string;
  category?: string;
};

export type SemanticTxInputWeb = (
  | SemanticExpenseInputWeb
  | Partial<WalletTransaction>
  | Partial<AppWalletTransactionWeb>
  | Record<string, any>
) & {
  note?: string;
  category?: string;
  icon?: string;
  title?: string;
  description?: string;
};

export function getExpenseSemanticIconWeb(tx?: SemanticTxInputWeb | null): {
  iconNode: (className?: string) => React.ReactNode;
  iconKey: string;
  color: string;
  bg: string;
} {
  const safeTx = (tx || {}) as SemanticTxInputWeb;
  const rawTitle = safeTx.title || "";
  const rawNote = safeTx.note || "";
  const rawDescription = safeTx.description || "";
  const rawCategory = safeTx.category || "";
  const rawText =
    `${rawTitle} ${rawNote} ${rawDescription} ${rawCategory}`.toLowerCase();

  // 1. Drinks & Coffee
  if (
    /(coffee|cafe|espresso|latte|cappuccino|americano|mocha|tea|boba|milktea|milk tea|starbucks|dunkin|drink|beverage|juice|smoothie|frap|chatime|coco|macao|gong cha|tiger sugar|matcha)/.test(
      rawText,
    )
  ) {
    return {
      iconNode: (c = "w-5 h-5") => <Coffee className={c} />,
      iconKey: "coffee",
      color: "text-amber-600",
      bg: "bg-amber-50 dark:bg-amber-950/40",
    };
  }
  // 2. Meals, Fast Food & Dining
  if (
    /(lunch|dinner|breakfast|meal|food|restaurant|karinderya|carinderia|jollibee|mcdo|mcdonald|burger|ramen|kfc|inasal|chowking|pares|silog|tapsilog|sinigang|adobo|eat|dining|resto|buffet|kbbq|samgyup|bbq|shawarma|chooks|mang inasal)/.test(
      rawText,
    )
  ) {
    return {
      iconNode: (c = "w-5 h-5") => <Utensils className={c} />,
      iconKey: "utensils",
      color: "text-orange-600",
      bg: "bg-orange-50 dark:bg-orange-950/40",
    };
  }
  // 3. Pizza
  if (/(pizza|yellow cab|shakey|domino|pizza hut)/.test(rawText)) {
    return {
      iconNode: (c = "w-5 h-5") => <Utensils className={c} />,
      iconKey: "pizza",
      color: "text-orange-600",
      bg: "bg-orange-50 dark:bg-orange-950/40",
    };
  }
  // 4. Merienda & Bakery Snacks
  if (
    /(merienda|snack|bakery|bread|pan de sal|pandesal|pastry|donut|cake|dessert|cookie|chips|ice cream|candy|waffle|goldilocks|red ribbon)/.test(
      rawText,
    )
  ) {
    return {
      iconNode: (c = "w-5 h-5") => <Cookie className={c} />,
      iconKey: "cookie",
      color: "text-amber-500",
      bg: "bg-amber-50 dark:bg-amber-950/40",
    };
  }
  // 5. Ridesharing, Fuel & Personal Vehicle
  if (
    /(grab|taxi|cab|angkas|joyride|maxim|car|gas|fuel|petrol|toll|parking|diesel|drive|petron|shell|caltex)/.test(
      rawText,
    )
  ) {
    return {
      iconNode: (c = "w-5 h-5") => <Car className={c} />,
      iconKey: "car",
      color: "text-sky-600",
      bg: "bg-sky-50 dark:bg-sky-950/40",
    };
  }
  // 6. Commute & Transit
  if (
    /(commute|fare|jeep|jeepney|trike|tricycle|bus|mrt|lrt|train|transit|subway|ride|travel)/.test(
      rawText,
    )
  ) {
    return {
      iconNode: (c = "w-5 h-5") => <Bus className={c} />,
      iconKey: "bus",
      color: "text-sky-500",
      bg: "bg-sky-50 dark:bg-sky-950/40",
    };
  }
  // 7. Flights & Vacation
  if (
    /(flight|airplane|travel|vacation|airline|airport|cebu pacific|philippine airlines|airasia|hotel|airbnb|resort)/.test(
      rawText,
    )
  ) {
    return {
      iconNode: (c = "w-5 h-5") => <Plane className={c} />,
      iconKey: "plane",
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950/40",
    };
  }
  // 8. Supermarket, Fresh Market & Pantry
  if (
    /(grocery|groceries|market|palengke|supermarket|puregold|robinsons|sm market|sari-sari|convenience|7-eleven|ministop|alfamart|store|pantry|supplies|soap|shampoo|landers|snr|s&r)/.test(
      rawText,
    )
  ) {
    return {
      iconNode: (c = "w-5 h-5") => <ShoppingBag className={c} />,
      iconKey: "grocery",
      color: "text-emerald-600",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
    };
  }
  // 9. Pharmacy & Meds
  if (
    /(pharmacy|meds|medicine|drug|mercury|watsons|generics|doctor|clinic|hospital|dental|dentist|health|vitamin|pill|bandage|biogesic|neozep|paracetamol|theraflu)/.test(
      rawText,
    )
  ) {
    return {
      iconNode: (c = "w-5 h-5") => <Pill className={c} />,
      iconKey: "pill",
      color: "text-rose-600",
      bg: "bg-rose-50 dark:bg-rose-950/40",
    };
  }
  // 10. Utilities & Load
  if (
    /(utility|utilities|bill|load|data|electric|meralco|power|prepaid|postpaid)/.test(
      rawText,
    )
  ) {
    return {
      iconNode: (c = "w-5 h-5") => <Zap className={c} />,
      iconKey: "zap",
      color: "text-purple-600",
      bg: "bg-purple-50 dark:bg-purple-950/40",
    };
  }
  // 11. Internet & Telecom
  if (
    /(internet|wifi|fiber|pldt|globe|smart|converge|dito|telco)/.test(rawText)
  ) {
    return {
      iconNode: (c = "w-5 h-5") => <Radio className={c} />,
      iconKey: "wifi",
      color: "text-indigo-600",
      bg: "bg-indigo-50 dark:bg-indigo-950/40",
    };
  }
  // 12. Cinema & Entertainment
  if (/(movie|cinema|netflix|theater|film|disney|hbo|youtube)/.test(rawText)) {
    return {
      iconNode: (c = "w-5 h-5") => <Film className={c} />,
      iconKey: "film",
      color: "text-rose-500",
      bg: "bg-rose-50 dark:bg-rose-950/40",
    };
  }
  // 13. Gaming
  if (
    /(game|gaming|steam|playstation|xbox|nintendo|esports|valorant|genshin|mlbb|mobile legends)/.test(
      rawText,
    )
  ) {
    return {
      iconNode: (c = "w-5 h-5") => <Cpu className={c} />,
      iconKey: "game",
      color: "text-indigo-500",
      bg: "bg-indigo-50 dark:bg-indigo-950/40",
    };
  }
  // 14. Gym & Fitness
  if (
    /(gym|workout|fitness|crossfit|boxing|yoga|anytime fitness|gold gym|pilates|sports|badminton|basketball)/.test(
      rawText,
    )
  ) {
    return {
      iconNode: (c = "w-5 h-5") => <Dumbbell className={c} />,
      iconKey: "fitness",
      color: "text-red-500",
      bg: "bg-red-50 dark:bg-red-950/40",
    };
  }
  // 15. Grooming & Care
  if (
    /(haircut|salon|barber|barbershop|beauty|spa|wax|massage|nails)/.test(
      rawText,
    )
  ) {
    return {
      iconNode: (c = "w-5 h-5") => <Scissors className={c} />,
      iconKey: "salon",
      color: "text-pink-500",
      bg: "bg-pink-50 dark:bg-pink-950/40",
    };
  }
  // 16. School & Books
  if (
    /(school|book|tuition|course|study|exam|stationery|pen|paper|class|supplies|national bookstore)/.test(
      rawText,
    )
  ) {
    return {
      iconNode: (c = "w-5 h-5") => <BookOpen className={c} />,
      iconKey: "book",
      color: "text-blue-500",
      bg: "bg-blue-50 dark:bg-blue-950/40",
    };
  }
  // 17. Shopping & Apparel
  if (
    /(shopping|clothes|shirt|pants|shoes|sneakers|shopee|lazada|shein|tiktok|apparel|fashion|zara|uniqlo|h&m)/.test(
      rawText,
    )
  ) {
    return {
      iconNode: (c = "w-5 h-5") => <Tag className={c} />,
      iconKey: "shopping",
      color: "text-pink-600",
      bg: "bg-pink-50 dark:bg-pink-950/40",
    };
  }
  // 18. Celebrations & Gifts
  if (
    /(gift|regalo|present|party|birthday|anniversary|celebration|christmas|balloon)/.test(
      rawText,
    )
  ) {
    return {
      iconNode: (c = "w-5 h-5") => <Gift className={c} />,
      iconKey: "gift",
      color: "text-pink-500",
      bg: "bg-pink-50 dark:bg-pink-950/40",
    };
  }
  // 19. Tech & Electronics
  if (
    /(tech|gadget|phone|iphone|android|laptop|macbook|ipad|tablet|charger|cable|earbuds|airpods|headphone|mouse|keyboard|monitor|electronics)/.test(
      rawText,
    )
  ) {
    return {
      iconNode: (c = "w-5 h-5") => <Cpu className={c} />,
      iconKey: "tech",
      color: "text-indigo-600",
      bg: "bg-indigo-50 dark:bg-indigo-950/40",
    };
  }
  // 20. Pets
  if (/(pet|vet|dog|cat|animal|puppy|kitten)/.test(rawText)) {
    return {
      iconNode: (c = "w-5 h-5") => <Heart className={c} />,
      iconKey: "pet",
      color: "text-amber-600",
      bg: "bg-amber-50 dark:bg-amber-950/40",
    };
  }
  // 21. Home & Accommodation
  if (/(rent|room|apartment|condo|house|home|stay|dorm)/.test(rawText)) {
    return {
      iconNode: (c = "w-5 h-5") => <Home className={c} />,
      iconKey: "home",
      color: "text-teal-600",
      bg: "bg-teal-50 dark:bg-teal-950/40",
    };
  }
  // 22. Cash & Allowances
  if (/(cash|allowance|petty|tender|atm|change|withdrawal)/.test(rawText)) {
    return {
      iconNode: (c = "w-5 h-5") => <Banknote className={c} />,
      iconKey: "cash",
      color: "text-emerald-600",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
    };
  }

  // Preset fallbacks
  if (tx?.icon === "coffee")
    return {
      iconNode: (c = "w-5 h-5") => <Coffee className={c} />,
      iconKey: "coffee",
      color: "text-amber-600",
      bg: "bg-amber-50 dark:bg-amber-950/40",
    };
  if (tx?.icon === "utensils")
    return {
      iconNode: (c = "w-5 h-5") => <Utensils className={c} />,
      iconKey: "utensils",
      color: "text-orange-600",
      bg: "bg-orange-50 dark:bg-orange-950/40",
    };
  if (tx?.icon === "bus")
    return {
      iconNode: (c = "w-5 h-5") => <Bus className={c} />,
      iconKey: "bus",
      color: "text-sky-500",
      bg: "bg-sky-50 dark:bg-sky-950/40",
    };
  if (tx?.icon === "grocery" || tx?.icon === "shopping-cart")
    return {
      iconNode: (c = "w-5 h-5") => <ShoppingBag className={c} />,
      iconKey: "grocery",
      color: "text-emerald-600",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
    };
  if (tx?.icon === "cookie")
    return {
      iconNode: (c = "w-5 h-5") => <Cookie className={c} />,
      iconKey: "cookie",
      color: "text-amber-500",
      bg: "bg-amber-50 dark:bg-amber-950/40",
    };
  if (tx?.icon === "zap")
    return {
      iconNode: (c = "w-5 h-5") => <Zap className={c} />,
      iconKey: "zap",
      color: "text-purple-600",
      bg: "bg-purple-50 dark:bg-purple-950/40",
    };
  if (tx?.icon === "pill")
    return {
      iconNode: (c = "w-5 h-5") => <Pill className={c} />,
      iconKey: "pill",
      color: "text-rose-600",
      bg: "bg-rose-50 dark:bg-rose-950/40",
    };

  // Diversified rotating lifestyle fallbacks (NEVER cart/bag)
  const fallbacks = [
    {
      iconNode: (c = "w-5 h-5") => <Sparkles className={c} />,
      iconKey: "sparkles",
      color: "text-pink-600",
      bg: "bg-pink-50 dark:bg-pink-950/40",
    },
    {
      iconNode: (c = "w-5 h-5") => <Tag className={c} />,
      iconKey: "tag",
      color: "text-purple-600",
      bg: "bg-purple-50 dark:bg-purple-950/40",
    },
    {
      iconNode: (c = "w-5 h-5") => <Compass className={c} />,
      iconKey: "compass",
      color: "text-teal-600",
      bg: "bg-teal-50 dark:bg-teal-950/40",
    },
    {
      iconNode: (c = "w-5 h-5") => <Bookmark className={c} />,
      iconKey: "bookmark",
      color: "text-cyan-600",
      bg: "bg-cyan-50 dark:bg-cyan-950/40",
    },
    {
      iconNode: (c = "w-5 h-5") => <Wallet className={c} />,
      iconKey: "wallet",
      color: "text-emerald-600",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
    },
    {
      iconNode: (c = "w-5 h-5") => <Heart className={c} />,
      iconKey: "heart",
      color: "text-rose-600",
      bg: "bg-rose-50 dark:bg-rose-950/40",
    },
    {
      iconNode: (c = "w-5 h-5") => <Gift className={c} />,
      iconKey: "gift",
      color: "text-amber-600",
      bg: "bg-amber-50 dark:bg-amber-950/40",
    },
  ];
  const charCodeSum = (tx?.title || "expense")
    .split("")
    .reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return fallbacks[charCodeSum % fallbacks.length];
}

interface ClientWalletProps {
  onNavigateToBills?: () => void;
  onNavigateToPayments?: () => void;
}

export const ClientWallet: React.FC<ClientWalletProps> = ({
  onNavigateToBills,
  onNavigateToPayments,
}) => {
  const { currentUser } = useAuth();
  const userId = currentUser?.uid || "guest";

  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [hideBalance, setHideBalance] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Walkthrough State
  const [showWalkthroughModal, setShowWalkthroughModal] =
    useState<boolean>(false);
  const [walkthroughStep, setWalkthroughStep] = useState<number>(0);

  useEffect(() => {
    if (!webWalletService.isWalkthroughCompleted(userId)) {
      setShowWalkthroughModal(true);
    }
  }, [userId]);

  const handleFinishWalkthrough = (
    action?: "cash_in" | "add_card" | "add_pocket",
  ) => {
    webWalletService.setWalkthroughCompleted(userId, true);
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

  // Modals
  const [showCashInModal, setShowCashInModal] = useState<boolean>(false);
  const [cashInAmount, setCashInAmount] = useState<string>("1000");
  const [cashInMethod, setCashInMethod] = useState<string>("GCash");
  const [selectedCashInCardId, setSelectedCashInCardId] = useState<string>("");

  const [showNoCardModal, setShowNoCardModal] = useState<boolean>(false);

  const [showAddCardModal, setShowAddCardModal] = useState<boolean>(false);
  const [newCardType, setNewCardType] = useState<CardProviderType>("gcash");
  const [newCardName, setNewCardName] = useState<string>("");
  const [newCardNumber, setNewCardNumber] = useState<string>("");
  const [newCardHolder, setNewCardHolder] = useState<string>("");
  const [newCardBalance, setNewCardBalance] = useState<string>("5000");

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
  const [isQrScanned, setIsQrScanned] = useState<boolean>(false);

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

  const [selectedTx, setSelectedTx] = useState<AppWalletTransactionWeb | null>(
    null,
  );
  const [txFilter, setTxFilter] = useState<
    "all" | "cash_in" | "payment" | "savings"
  >("all");

  useEffect(() => {
    setLoading(true);
    const unsub = webWalletService.listenToWallet(userId, (state) => {
      setWallet(state);
      setLoading(false);
    });
    return unsub;
  }, [userId]);

  const handleOpenCashIn = () => {
    if (!wallet?.cards || wallet.cards.length === 0) {
      setShowNoCardModal(true);
      return;
    }
    const defaultCard =
      wallet.cards.find((c) => c.isDefault) || wallet.cards[0];
    setSelectedCashInCardId(defaultCard.id);
    setCashInMethod(defaultCard.name);
    setShowCashInModal(true);
  };

  const handleCashIn = async () => {
    const num = parseFloat(cashInAmount);
    if (isNaN(num) || num <= 0) {
      alert("Please enter a valid cash-in amount.");
      return;
    }

    const targetCardId =
      selectedCashInCardId || wallet?.cards?.[0]?.id || cashInMethod;
    const updated = await webWalletService.cashIn(userId, num, targetCardId);
    setWallet(updated);
    setShowCashInModal(false);
    setCashInAmount("1000");
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
      alert(
        `Please type "${selectedCardToDelete.name}" exactly to confirm deleting this card.`,
      );
      return;
    }

    setIsDeletingCard(true);
    try {
      const updated = await webWalletService.deletePaymentCard(
        userId,
        selectedCardToDelete.id,
      );
      setWallet(updated);
      setShowDeleteCardModal(false);
      setSelectedCardToDelete(null);
      setDeleteCardConfirmText("");
      alert(
        `"${selectedCardToDelete.name}" has been permanently removed from your wallet.`,
      );
    } catch (e: any) {
      alert(e?.message || "Could not delete payment card.");
    } finally {
      setIsDeletingCard(false);
    }
  };

  const handleSendMoney = async () => {
    const num = parseFloat(sendAmount);
    if (isNaN(num) || num <= 0) {
      alert("Please enter a valid transfer amount.");
      return;
    }
    const card =
      wallet?.cards.find((c) => c.id === sendSelectedCardId) ||
      wallet?.cards[0];
    if (!card) {
      alert("Please select a funding card.");
      return;
    }
    if ((card.balance || 0) < num) {
      alert(
        `${card.name} only has ₱${(card.balance || 0).toLocaleString()} available.`,
      );
      return;
    }

    const res = await webWalletService.deductForDebtSettlement(
      userId,
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
      alert(
        `Sent ₱${num.toLocaleString()} to ${sendRecipient.trim() || "Roommate Alex"} via ${card.name}!`,
      );
    } else {
      alert(res.message);
    }
  };

  const handleCreateSplitRequest = () => {
    const num = parseFloat(splitAmount);
    if (isNaN(num) || num <= 0) {
      alert("Please enter a valid split amount.");
      return;
    }
    const perPerson = (num / splitNumPeople).toFixed(2);
    setShowRequestSplitModal(false);
    alert(
      `Split request created for "${splitTitle || "Household Split"}" (₱${num.toLocaleString()}). Each of the ${splitNumPeople} roommates requested for ₱${perPerson}.`,
    );
  };

  const handleAddCard = async () => {
    if (!newCardNumber.trim()) {
      alert("Please enter account or card number.");
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

    const updated = await webWalletService.addPaymentCard(userId, {
      type: newCardType,
      name: newCardName.trim() || preset.name,
      accountNumber: masked,
      cardholderName:
        newCardHolder.trim() || currentUser?.displayName || "Cardholder",
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
  };

  const handleSetDefaultCard = async (cardId: string) => {
    const updated = await webWalletService.setDefaultCard(userId, cardId);
    setWallet(updated);
  };

  const handleCreatePocket = async () => {
    const targetNum = parseFloat(pocketTarget);
    if (!pocketName.trim() || isNaN(targetNum) || targetNum <= 0) {
      alert("Please enter pocket name and target amount.");
      return;
    }

    const updated = await webWalletService.createSavingsPocket(userId, {
      name: pocketName.trim(),
      targetAmount: targetNum,
      currentAmount: 0,
      color: "#2563EB",
      icon: "Shield",
      category: pocketCategory,
    });

    setWallet(updated);
    setShowAddPocketModal(false);
    setPocketName("");
    setPocketTarget("");
  };

  const handlePocketTransfer = async () => {
    if (!selectedPocket) return;
    const num = parseFloat(pocketTransferAmount);
    if (isNaN(num) || num <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    if (pocketActionType === "deposit") {
      const res = await (webWalletService as any).depositToPocket(
        userId,
        selectedPocket.id,
        num,
        pocketSelectedCardId || undefined,
      );
      if (res.success) {
        setWallet(res.updatedState);
        setShowPocketActionModal(false);
      } else {
        alert(res.message);
      }
    } else {
      const res = await (webWalletService as any).withdrawFromPocket(
        userId,
        selectedPocket.id,
        num,
        pocketSelectedCardId || undefined,
      );
      if (res.success) {
        setWallet(res.updatedState);
        setShowPocketActionModal(false);
      } else {
        alert(res.message);
      }
    }
  };

  const handleOpenCashExpense = (cashCardId?: string) => {
    const cashCard =
      wallet?.cards.find((c) =>
        cashCardId ? c.id === cashCardId : (c.type as any) === "cash",
      ) || wallet?.cards[0];

    if (!cashCard) {
      alert("Please link a card or add Cash on Hand first.");
      setShowAddCardModal(true);
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
        cashCardId ? c.id === cashCardId : (c.type as any) === "cash",
      ) || wallet?.cards[0];

    if (!cashCard) {
      alert(
        "To automate cash expenses and finance cash on hand, please add a Cash Card first.",
      );
      setShowAddCardModal(true);
      return;
    }

    setSelectedCashCardId(cashCard.id);
    setShowCashAutomationModal(true);
  };

  const handleExecuteCashExpense = async () => {
    if (!selectedCashCardId) return;
    const amt = parseFloat(cashExpenseAmount);
    if (isNaN(amt) || amt <= 0) {
      alert("Please enter a valid expense amount.");
      return;
    }

    setIsRecordingCashExpense(true);
    try {
      const res = await (webWalletService as any).recordCashExpense(
        userId,
        selectedCashCardId,
        amt,
        cashExpenseTitle.trim() || "Cash Expense",
        cashExpenseCategory,
      );
      if (res.success) {
        setWallet(res.updatedState);
        setShowCashExpenseModal(false);
        alert(res.message);
      } else {
        alert(res.message);
      }
    } catch (e: any) {
      alert(e?.message || "Could not record cash expense.");
    } finally {
      setIsRecordingCashExpense(false);
    }
  };

  const handleRunCashAutoExpenses = async () => {
    const cashCard =
      wallet?.cards.find((c) => c.id === selectedCashCardId) ||
      wallet?.cards.find((c) => (c.type as any) === "cash") ||
      wallet?.cards[0];

    if (!cashCard) {
      alert("No Cash on Hand card found.");
      return;
    }

    setIsExecutingCashAuto(true);
    try {
      const res = await (webWalletService as any).runAutomatedCashExpenses(
        userId,
        cashCard.id,
        cashRules,
      );
      if (res.success) {
        setWallet(res.updatedState);
        alert(res.message);
      } else {
        alert(res.message);
      }
    } catch (e: any) {
      alert(e?.message || "Could not run automated cash expenses.");
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
      alert(
        "You need at least 2 linked cards or accounts to transfer money between them. Please link another card first.",
      );
      setShowAddCardModal(true);
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
      alert("Please enter a valid transfer amount greater than ₱0.");
      return;
    }

    if (!transferSourceCardId || !transferDestCardId) {
      alert("Please select both source and destination cards.");
      return;
    }

    if (transferSourceCardId === transferDestCardId) {
      alert("Source and destination cards must be different accounts.");
      return;
    }

    const sourceCard = wallet?.cards.find((c) => c.id === transferSourceCardId);
    if (!sourceCard || (sourceCard.balance || 0) < amt) {
      alert(
        `Selected source card only has ₱${(sourceCard?.balance || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} available.`,
      );
      return;
    }

    try {
      setIsTransferring(true);
      const res = await webWalletService.transferBetweenCards(
        userId,
        transferSourceCardId,
        transferDestCardId,
        amt,
        transferNote,
      );
      if (res.success) {
        setWallet(res.updatedState);
        setShowTransferModal(false);
        alert(res.message);
      } else {
        alert(res.message);
      }
    } catch (e: any) {
      alert(e?.message || "Could not complete transfer.");
    } finally {
      setIsTransferring(false);
    }
  };

  const handleQuickCirclePress = (preset: QuickExpensePreset) => {
    if (!wallet?.cards || wallet.cards.length === 0) {
      alert(
        "Please link a payment card first before simulating everyday expenses.",
      );
      setShowAddCardModal(true);
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
      alert("Please enter a valid expense amount greater than ₱0.");
      return;
    }

    const card = wallet?.cards.find((c) => c.id === simCardId);
    if (!card) {
      alert("Please select a payment card to deduct the expense from.");
      return;
    }

    if ((card.balance || 0) < amt) {
      alert(
        `Selected card ${card.name} only has ₱${(card.balance || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} available. Please top up or choose another card.`,
      );
      return;
    }

    const finalTitle =
      selectedExpensePreset.id === "custom" && customExpenseTitle.trim()
        ? customExpenseTitle.trim()
        : selectedExpensePreset.title;
    const finalIcon =
      selectedExpensePreset.id === "custom"
        ? getExpenseSemanticIconWeb({
            title: finalTitle,
            note: simNote,
            type: "expense_simulation",
          }).iconKey
        : selectedExpensePreset.icon;

    try {
      setIsSimulatingExpense(true);
      const res = await webWalletService.simulateCardExpense(
        userId,
        simCardId,
        amt,
        finalTitle,
        finalIcon,
        simNote,
      );
      if (res.success) {
        setWallet(res.updatedState);
        setShowExpenseSimModal(false);
        alert(res.message);
      } else {
        alert(res.message);
      }
    } catch (e: any) {
      alert(e?.message || "Could not simulate expense.");
    } finally {
      setIsSimulatingExpense(false);
    }
  };

  const balance =
    (wallet?.cards || []).length > 0
      ? (wallet?.cards || []).reduce((sum, c) => sum + (c.balance || 0), 0)
      : (wallet?.balance ?? 0);

  const filteredTxs = (wallet?.transactions || []).filter((tx) => {
    if (txFilter === "all") return true;
    if (txFilter === "cash_in") return tx.type === "cash_in";
    if (txFilter === "payment")
      return (
        tx.type === "bill_payment" ||
        tx.type === "debt_settlement" ||
        tx.type === "expense_simulation" ||
        tx.type === "card_transfer"
      );
    if (txFilter === "savings")
      return tx.type === "savings_deposit" || tx.type === "savings_withdrawal";
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Splitzy Wallet
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Personal digital balance, individual cards, and goal savings
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setWalkthroughStep(0);
              setShowWalkthroughModal(true);
            }}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-xl text-sm font-semibold transition-colors border border-blue-200 dark:border-blue-900/40"
          >
            <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Tour</span>
          </button>

          <button
            onClick={handleOpenCashIn}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
          >
            <ArrowDownCircle className="w-4 h-4" />
            <span>+ Cash In</span>
          </button>
        </div>
      </div>

      {/* 1. Hero Balance Card (Available Digital Balance = Sum of all cards) */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white p-6 sm:p-8 shadow-xl border border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-blue-200">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>AVAILABLE DIGITAL BALANCE</span>
          </div>

          <button
            onClick={() => setHideBalance(!hideBalance)}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            title={hideBalance ? "Show balance" : "Hide balance"}
          >
            {hideBalance ? (
              <EyeOff className="w-5 h-5" />
            ) : (
              <Eye className="w-5 h-5" />
            )}
          </button>
        </div>

        <div className="my-5">
          <span className="text-4xl sm:text-5xl font-extrabold tracking-tight tabular-nums">
            {hideBalance
              ? "₱ ••••••"
              : `₱${balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </span>
          <p className="text-xs text-blue-200/80 mt-1.5">
            Sum of funds across {(wallet?.cards || []).length} linked payment
            card{(wallet?.cards || []).length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={handleOpenCashIn}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-blue-900 hover:bg-blue-50 rounded-xl text-sm font-bold transition-all shadow-md active:scale-95"
          >
            <ArrowDownCircle className="w-4 h-4 text-blue-600" />
            <span>+ Cash In</span>
          </button>

          <button
            onClick={() => onNavigateToPayments?.()}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-sm font-semibold transition-colors text-white"
          >
            <Receipt className="w-4 h-4" />
            <span>Pay Bills</span>
          </button>

          <button
            onClick={() => onNavigateToBills?.()}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-sm font-semibold transition-colors text-white"
          >
            <CreditCard className="w-4 h-4" />
            <span>Settle Dues</span>
          </button>
        </div>
      </div>

      {/* 2. Quick Circle Menu Icon Hub */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-4 py-1">
        <button
          onClick={() => {
            if (!wallet?.cards || wallet.cards.length === 0) {
              setShowNoCardModal(true);
              return;
            }
            setSendSelectedCardId(
              wallet.cards.find((c) => c.isDefault)?.id || wallet.cards[0].id,
            );
            setShowSendMoneyModal(true);
          }}
          className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all group"
        >
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-105 shadow-xs transition-transform">
            <Send className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <span className="text-[11px] sm:text-xs font-bold text-slate-800 dark:text-slate-200">
            Send
          </span>
        </button>

        <button
          onClick={() => setShowRequestSplitModal(true)}
          className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all group"
        >
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-105 shadow-xs transition-transform">
            <Users className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <span className="text-[11px] sm:text-xs font-bold text-slate-800 dark:text-slate-200">
            Split
          </span>
        </button>

        <button
          onClick={() => handleOpenTransfer()}
          className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all group"
        >
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-105 shadow-xs transition-transform">
            <ArrowLeftRight className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <span className="text-[11px] sm:text-xs font-bold text-slate-800 dark:text-slate-200">
            Transfer
          </span>
        </button>

        <button
          onClick={() => {
            setIsQrScanned(false);
            setShowScanQrModal(true);
          }}
          className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all group"
        >
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:scale-105 shadow-xs transition-transform">
            <QrCode className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <span className="text-[11px] sm:text-xs font-bold text-slate-800 dark:text-slate-200">
            Scan QR
          </span>
        </button>

        <button
          onClick={() => setShowAnalyticsModal(true)}
          className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all group"
        >
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-105 shadow-xs transition-transform">
            <PieChart className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <span className="text-[11px] sm:text-xs font-bold text-slate-800 dark:text-slate-200">
            Analytics
          </span>
        </button>

        <button
          onClick={() => setShowLimitsModal(true)}
          className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all group"
        >
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 group-hover:scale-105 shadow-xs transition-transform">
            <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <span className="text-[11px] sm:text-xs font-bold text-slate-800 dark:text-slate-200">
            Limits
          </span>
        </button>
      </div>

      {/* 2.5 Quick Circles: Daily Expense Simulator */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Quick Expense Circles
              </h2>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                AUTO-DEDUCT
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Simulate everyday routine expenses & auto-deduct directly from
              linked cards
            </p>
          </div>

          {/* Active Card Pill Selector */}
          {wallet?.cards && wallet.cards.length > 0 && (
            <button
              onClick={() => {
                if (wallet.cards.length <= 1) return;
                const curId =
                  activeSimCardId ||
                  wallet.cards.find((c) => c.isDefault)?.id ||
                  wallet.cards[0].id;
                const curIdx = wallet.cards.findIndex((c) => c.id === curId);
                const nextIdx = (curIdx + 1) % wallet.cards.length;
                setActiveSimCardId(wallet.cards[nextIdx].id);
              }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors w-fit"
            >
              <CreditCard className="w-3.5 h-3.5 text-blue-600" />
              <span>
                {(() => {
                  const c =
                    wallet.cards.find((cd) => cd.id === activeSimCardId) ||
                    wallet.cards.find((cd) => cd.isDefault) ||
                    wallet.cards[0];
                  return `${c.name.split(" ")[0]} · ₱${(c.balance || 0).toLocaleString()}`;
                })()}
              </span>
              {wallet.cards.length > 1 && (
                <ArrowLeftRight className="w-3 h-3 text-slate-400" />
              )}
            </button>
          )}
        </div>

        {/* Horizontal Scrollable Quick Circles */}
        <div className="flex items-center gap-3 overflow-x-auto pb-2 pt-1">
          {QUICK_EXPENSE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handleQuickCirclePress(preset)}
              className="flex flex-col items-center gap-1.5 shrink-0 p-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all group"
            >
              <div
                style={{
                  background: `linear-gradient(135deg, ${preset.gradient[0]}, ${preset.gradient[1]})`,
                }}
                className="w-14 h-14 rounded-full flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform"
              >
                {preset.icon === "coffee" && <Coffee className="w-6 h-6" />}
                {preset.icon === "utensils" && <Utensils className="w-6 h-6" />}
                {preset.icon === "bus" && <Bus className="w-6 h-6" />}
                {(preset.icon === "grocery" ||
                  preset.icon === "shopping-cart") && (
                  <ShoppingBag className="w-6 h-6" />
                )}
                {preset.icon === "cookie" && <Cookie className="w-6 h-6" />}
                {preset.icon === "zap" && <Zap className="w-6 h-6" />}
                {preset.icon === "pill" && <Pill className="w-6 h-6" />}
                {preset.icon === "custom" && <PlusCircle className="w-6 h-6" />}
              </div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {preset.title.split(" ")[0]}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40">
                ₱{preset.amount}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Quick Setup Checklist for Fresh Empty Wallets */}
      {balance === 0 &&
        (wallet?.cards || []).length === 0 &&
        (wallet?.pockets || []).length === 0 && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-lg text-xs font-bold w-fit">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>NEW WALLET SETUP</span>
              </div>
              <button
                onClick={() => {
                  setWalkthroughStep(0);
                  setShowWalkthroughModal(true);
                }}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <span>View 1-Min Walkthrough</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Welcome! Your Splitzy Wallet starts clean at ₱0.00
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-5">
              Take full control of your household splits in 3 easy milestones:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                onClick={() => setShowAddCardModal(true)}
                className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 border border-slate-200 dark:border-slate-800 text-left transition-colors group"
              >
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                    Link Payment Method
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Configure your card or GCash with initial balance.
                  </p>
                </div>
              </button>

              <button
                onClick={handleOpenCashIn}
                className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 border border-slate-200 dark:border-slate-800 text-left transition-colors group"
              >
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                    Top Up Card Funds
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Fund your wallet via GCash, Maya, or bank transfer.
                  </p>
                </div>
              </button>

              <button
                onClick={() => setShowAddPocketModal(true)}
                className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 border border-slate-200 dark:border-slate-800 text-left transition-colors group"
              >
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                    Create Savings Pocket
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Stash funds for rent deposits or room goals.
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}

      {/* 2. Linked Cards & E-Wallets Deck (Displaying individual card balances) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Linked Payment Methods & Cards
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              GCash, Maya and Philippine bank card accounts with individual card
              balances
            </p>
          </div>

          <button
            onClick={() => setShowAddCardModal(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Card</span>
          </button>
        </div>

        {(wallet?.cards || []).length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 p-8 text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-3">
              <CreditCard className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              No payment methods linked yet
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1 mb-4">
              Link your GCash, Maya, or Philippine bank card to display card
              balances and enable cash-in.
            </p>
            <button
              onClick={() => setShowAddCardModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add Payment Method</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(wallet?.cards || []).map((card) => {
              const preset =
                PHILIPPINE_CARD_PRESETS[card.type] ||
                PHILIPPINE_CARD_PRESETS.custom;
              const isGCash = card.type === "gcash";
              const isMaya = card.type === "maya";
              const isCash = (card.type as any) === "cash";

              if (isCash) {
                return (
                  <div
                    key={card.id}
                    style={{
                      background:
                        "linear-gradient(135deg, #022C22 0%, #064E3B 50%, #047857 100%)",
                    }}
                    className="relative rounded-2xl p-5 text-white shadow-md flex flex-col justify-between h-56 border border-emerald-500/20 transition-transform hover:scale-[1.01] overflow-hidden"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-1 rounded-md flex items-center gap-1.5">
                        <Banknote className="w-3.5 h-3.5 text-emerald-400" />
                        CASH ON HAND
                      </span>

                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider bg-white/15 text-emerald-100 border border-white/20 px-2 py-0.5 rounded">
                          LEGAL TENDER
                        </span>
                        {card.isDefault && (
                          <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-white px-2 py-0.5 rounded">
                            Primary
                          </span>
                        )}
                        <button
                          onClick={() => handlePromptDeleteCard(card)}
                          className="p-1 rounded-md bg-black/20 hover:bg-red-600 text-white/80 hover:text-white transition-colors"
                          title={`Remove ${card.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Cash Balance Display */}
                    <div className="my-1.5 bg-black/30 backdrop-blur-xs px-3 py-2 rounded-xl border border-emerald-500/20">
                      <div className="flex items-center justify-between">
                        <span className="block text-[9px] uppercase tracking-wider text-emerald-200 font-bold">
                          AVAILABLE CASH TENDER
                        </span>
                        <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          <span>AUTO-SYNC</span>
                        </div>
                      </div>
                      <span className="text-xl font-extrabold tracking-tight tabular-nums text-white block mt-0.5">
                        {hideBalance
                          ? "₱ ••••••"
                          : `₱${(card.balance || 0).toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}`}
                      </span>
                    </div>

                    {/* Banknote Serial row */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-5 rounded bg-emerald-800/80 border border-emerald-600/40 flex items-center justify-center">
                          <Banknote className="w-3.5 h-3.5 text-emerald-300" />
                        </div>
                        <span className="text-[10px] font-bold text-emerald-200/90 uppercase tracking-wider">
                          Peso Notes • Central Bank
                        </span>
                      </div>
                      <p className="font-mono text-base font-bold tracking-widest tabular-nums text-emerald-100">
                        {card.accountNumber || "SN • 2026-PH-CASH"}
                      </p>
                    </div>

                    {/* Bottom row: Custodian & Transfer */}
                    <div className="flex items-end justify-between text-xs text-white/80 pt-1">
                      <div>
                        <span className="block text-[8px] uppercase tracking-wider text-emerald-200/60">
                          Custodian
                        </span>
                        <span className="font-semibold text-white truncate max-w-[120px] block text-xs">
                          {card.cardholderName || "Cash Custodian"}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenTransfer(card.id)}
                          className="text-[10px] bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded font-semibold text-white transition-colors flex items-center gap-1"
                          title="Transfer / Replenish Cash"
                        >
                          <ArrowLeftRight className="w-2.5 h-2.5" />
                          <span>Transfer</span>
                        </button>
                        {!card.isDefault && (
                          <button
                            onClick={() => handleSetDefaultCard(card.id)}
                            className="text-[10px] bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded font-semibold text-white transition-colors"
                          >
                            Make Primary
                          </button>
                        )}
                        <div className="text-right">
                          <span className="block text-[10px] font-extrabold tracking-wider text-emerald-200">
                            Cash • BSP
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={card.id}
                  style={{
                    background: `linear-gradient(135deg, ${(card.colorGradient || preset.gradient)[0]}, ${(card.colorGradient || preset.gradient)[1]})`,
                  }}
                  className="relative rounded-2xl p-5 text-white shadow-md flex flex-col justify-between h-56 border border-white/10 transition-transform hover:scale-[1.01]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider bg-white/20 backdrop-blur-xs px-2.5 py-1 rounded-md">
                      {preset?.name || card.name}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {card.isDefault && (
                        <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-white px-2 py-0.5 rounded">
                          Primary
                        </span>
                      )}
                      <button
                        onClick={() => handlePromptDeleteCard(card)}
                        className="p-1 rounded-md bg-black/20 hover:bg-red-600 text-white/80 hover:text-white transition-colors"
                        title={`Remove ${card.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Individual Card Amount Display */}
                  <div className="my-1.5 bg-black/25 backdrop-blur-xs px-3 py-2 rounded-xl border border-white/10">
                    <span className="block text-[9px] uppercase tracking-wider text-white/75 font-bold">
                      Card Balance
                    </span>
                    <span className="text-xl font-extrabold tracking-tight tabular-nums text-white block">
                      {hideBalance
                        ? "₱ ••••••"
                        : `₱${(card.balance || 0).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-5 rounded bg-amber-300 border border-amber-400 flex items-center justify-center">
                        <Cpu className="w-4 h-4 text-amber-900/80" />
                      </div>
                      <Radio className="w-4 h-4 text-white/70" />
                    </div>
                    <p className="font-mono text-base font-bold tracking-widest tabular-nums">
                      {card.accountNumber}
                    </p>
                  </div>

                  <div className="flex items-end justify-between text-xs text-white/80 pt-1">
                    <div>
                      <span className="block text-[8px] uppercase tracking-wider text-white/60">
                        Cardholder
                      </span>
                      <span className="font-semibold text-white truncate max-w-[120px] block text-xs">
                        {card.cardholderName}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenTransfer(card.id)}
                        className="text-[10px] bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded font-semibold text-white transition-colors flex items-center gap-1"
                        title="Transfer funds from this card"
                      >
                        <ArrowLeftRight className="w-2.5 h-2.5" />
                        <span>Transfer</span>
                      </button>
                      {!card.isDefault && (
                        <button
                          onClick={() => handleSetDefaultCard(card.id)}
                          className="text-[10px] bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded font-semibold text-white transition-colors"
                        >
                          Make Primary
                        </button>
                      )}
                      <div className="text-right">
                        <span className="block text-[10px] font-extrabold tracking-wider text-white">
                          {preset?.network ||
                            (isGCash
                              ? "QR Ph"
                              : isMaya
                                ? "Visa"
                                : "Mastercard")}
                        </span>
                        {card.expiry && (
                          <span className="font-semibold text-white/80 tabular-nums text-[10px] block">
                            EXP {card.expiry}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Add card shortcut slot */}
            <button
              onClick={() => setShowAddCardModal(true)}
              className="rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 p-6 flex flex-col items-center justify-center gap-2 h-56 transition-colors group bg-slate-50/50 dark:bg-slate-900/30"
            >
              <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                <Plus className="w-6 h-6" />
              </div>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Add Payment Method
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                GCash, Maya, BPI, BDO
              </span>
            </button>
          </div>
        )}
      </section>

      {/* 3. Savings Pockets / Vaults */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Savings Pockets
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Goal-oriented pockets for security deposits, trips and buffer
              funds
            </p>
          </div>

          <button
            onClick={() => setShowAddPocketModal(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            <Plus className="w-4 h-4" />
            <span>New Goal</span>
          </button>
        </div>

        {(wallet?.pockets || []).length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 p-8 text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              No savings pockets yet
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1 mb-4">
              Set aside money for rent security deposits, household buffers, or
              roommate goals with progress tracking.
            </p>
            <button
              onClick={() => setShowAddPocketModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Pocket</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(wallet?.pockets || []).map((pocket) => {
              const percent = Math.min(
                100,
                Math.round((pocket.currentAmount / pocket.targetAmount) * 100),
              );

              return (
                <div
                  key={pocket.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
                        {pocket.category === "travel" ? (
                          <Plane className="w-4 h-4" />
                        ) : pocket.category === "deposit" ? (
                          <Home className="w-4 h-4" />
                        ) : (
                          <Shield className="w-4 h-4" />
                        )}
                      </div>

                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                        {percent}%
                      </span>
                    </div>

                    <h3 className="font-bold text-slate-900 dark:text-white text-base">
                      {pocket.name}
                    </h3>

                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-lg font-extrabold text-slate-900 dark:text-white tabular-nums">
                        ₱{pocket.currentAmount.toLocaleString()}
                      </span>
                      <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
                        / ₱{pocket.targetAmount.toLocaleString()}
                      </span>
                    </div>

                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mt-3 overflow-hidden">
                      <div
                        className="bg-blue-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-5 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => {
                        setSelectedPocket(pocket);
                        setPocketActionType("deposit");
                        const defaultCard =
                          wallet?.cards.find((c) => c.isDefault) ||
                          wallet?.cards[0];
                        setPocketSelectedCardId(defaultCard?.id || "");
                        setShowPocketActionModal(true);
                      }}
                      className="flex-1 py-1.5 px-3 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-bold transition-colors"
                    >
                      + Stash
                    </button>

                    <button
                      onClick={() => {
                        setSelectedPocket(pocket);
                        setPocketActionType("withdraw");
                        const defaultCard =
                          wallet?.cards.find((c) => c.isDefault) ||
                          wallet?.cards[0];
                        setPocketSelectedCardId(defaultCard?.id || "");
                        setShowPocketActionModal(true);
                      }}
                      className="flex-1 py-1.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition-colors"
                    >
                      Withdraw
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 4. Activity & Transaction Ledger */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Activity & Ledger
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Verified records of your cash-ins, bill payments and savings
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            {[
              { id: "all", label: "All" },
              { id: "cash_in", label: "Top-ups" },
              { id: "payment", label: "Bills & Dues" },
              { id: "savings", label: "Savings" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTxFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  txFilter === tab.id
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs divide-y divide-slate-100 dark:divide-slate-800">
          {filteredTxs.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">
              No transactions found in this category.
            </div>
          ) : (
            filteredTxs.map((tx) => {
              const isPositive =
                tx.type === "cash_in" || tx.type === "savings_withdrawal";

              return (
                <div
                  key={tx.id}
                  onClick={() => setSelectedTx(tx)}
                  className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    {(() => {
                      if (tx.type === "expense_simulation") {
                        const iconData = getExpenseSemanticIconWeb(tx);
                        return (
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconData.bg} ${iconData.color}`}
                          >
                            {iconData.iconNode("w-5 h-5")}
                          </div>
                        );
                      }

                      return (
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            tx.type === "card_transfer"
                              ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600"
                              : isPositive
                                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600"
                                : "bg-blue-50 dark:bg-blue-950/40 text-blue-600"
                          }`}
                        >
                          {tx.type === "card_transfer" ? (
                            <ArrowLeftRight className="w-5 h-5" />
                          ) : isPositive ? (
                            <ArrowUpRight className="w-5 h-5" />
                          ) : (
                            <TrendingDown className="w-5 h-5" />
                          )}
                        </div>
                      );
                    })()}

                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {tx.title}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {tx.paymentMethodUsed} ·{" "}
                        {new Date(tx.timestamp).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={`text-sm font-extrabold tabular-nums block ${
                        isPositive
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-slate-900 dark:text-white"
                      }`}
                    >
                      {isPositive ? "+" : "-"}₱{tx.amount.toLocaleString()}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      Completed
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* NOTIFICATION MODAL: No Card Configured Alert */}
      {showNoCardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Configure Card Before Cashing In
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                You haven't linked any payment methods yet. Please link your
                GCash, Maya, or Philippine bank card first before adding funds
                to your wallet.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowNoCardModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowNoCardModal(false);
                  setShowAddCardModal(true);
                }}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md transition-colors"
              >
                Link Card Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: Cash In with Card Selector */}
      {showCashInModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Top-up Splitzy Wallet
                </h3>
                <p className="text-xs text-slate-500">
                  Select a card to top up and specify amount
                </p>
              </div>
              <button
                onClick={() => setShowCashInModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target Card Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                Destination Card / Account
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {(wallet?.cards || []).map((card) => {
                  const isSelected = selectedCashInCardId === card.id;
                  return (
                    <div
                      key={card.id}
                      onClick={() => {
                        setSelectedCashInCardId(card.id);
                        setCashInMethod(card.name);
                      }}
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                        isSelected
                          ? "border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100"
                          : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <CreditCard className="w-4 h-4 text-blue-600 shrink-0" />
                        <div>
                          <p className="text-xs font-bold leading-tight">
                            {card.name}
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            {card.accountNumber}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-extrabold text-slate-900 dark:text-white tabular-nums block">
                          ₱{(card.balance || 0).toLocaleString()}
                        </span>
                        <span className="text-[9px] text-slate-400 uppercase tracking-wider">
                          Current Bal
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {["500", "1000", "2000", "5000"].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setCashInAmount(preset)}
                  className={`py-2 rounded-xl text-xs font-bold transition-colors ${
                    cashInAmount === preset
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  ₱{preset}
                </button>
              ))}
            </div>

            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-400">
                ₱
              </span>
              <input
                type="number"
                value={cashInAmount}
                onChange={(e) => setCashInAmount(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-extrabold text-xl outline-hidden focus:border-blue-500"
                placeholder="0.00"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowCashInModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleCashIn}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md transition-colors"
              >
                Confirm Cash-in
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Add Mock Card with Initial Balance */}
      {showAddCardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Add Payment Method
                </h3>
                <p className="text-xs text-slate-500">
                  Link an e-wallet or Philippine bank card with initial balance
                </p>
              </div>
              <button
                onClick={() => setShowAddCardModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-1.5 overflow-x-auto py-1">
              {Object.values(PHILIPPINE_CARD_PRESETS).map((prov) => (
                <button
                  key={prov.type}
                  onClick={() => {
                    setNewCardType(prov.type);
                    if (
                      !newCardName ||
                      Object.values(PHILIPPINE_CARD_PRESETS).some(
                        (p) => p.name === newCardName,
                      )
                    ) {
                      setNewCardName(prov.name);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-colors flex items-center gap-1.5 ${
                    newCardType === prov.type
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: prov.gradient[0] }}
                  />
                  <span>{prov.shortCode}</span>
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Card / Account Nickname
                </label>
                <input
                  type="text"
                  placeholder="e.g. Personal GCash"
                  value={newCardName}
                  onChange={(e) => setNewCardName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  {newCardType === "gcash"
                    ? "GCash Mobile Number"
                    : "Last 4 Digits / Number"}
                </label>
                <input
                  type="text"
                  placeholder={
                    newCardType === "gcash" ? "0917 ••• 8821" : "8821"
                  }
                  value={newCardNumber}
                  onChange={(e) => setNewCardNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Initial Card Balance (₱)
                </label>
                <input
                  type="number"
                  placeholder="5000"
                  value={newCardBalance}
                  onChange={(e) => setNewCardBalance(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-hidden focus:border-blue-500 font-bold"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Card balance will be credited to your Available Digital
                  Balance.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Account Holder Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Alex Chen"
                  value={newCardHolder}
                  onChange={(e) => setNewCardHolder(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-hidden focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowAddCardModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCard}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md transition-colors"
              >
                Save Card
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Delete Individual Card Confirmation Modal */}
      {showDeleteCardModal && selectedCardToDelete && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-6 shadow-2xl border border-red-200 dark:border-red-950 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/80 text-red-600 flex items-center justify-center">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-red-600 dark:text-red-400">
                    Remove {selectedCardToDelete.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Deducts ₱
                    {(selectedCardToDelete.balance || 0).toLocaleString()} from
                    digital balance
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!isDeletingCard) {
                    setShowDeleteCardModal(false);
                    setSelectedCardToDelete(null);
                    setDeleteCardConfirmText("");
                  }
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 space-y-2">
              <p className="text-xs text-red-800 dark:text-red-300 font-medium leading-relaxed">
                Unlinking this card will deduct its balance of ₱
                {(selectedCardToDelete.balance || 0).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                from your Available Digital Balance.
              </p>
              <div className="pt-1">
                <label className="block text-xs font-bold text-red-900 dark:text-red-200 mb-1">
                  Security Question: Please type{" "}
                  <span className="underline font-black">
                    {selectedCardToDelete.name}
                  </span>{" "}
                  to confirm:
                </label>
                <input
                  type="text"
                  placeholder={`Type "${selectedCardToDelete.name}"`}
                  value={deleteCardConfirmText}
                  onChange={(e) => setDeleteCardConfirmText(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-red-300 dark:border-red-800 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-white outline-hidden focus:border-red-600"
                  autoFocus
                  disabled={isDeletingCard}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  setShowDeleteCardModal(false);
                  setSelectedCardToDelete(null);
                  setDeleteCardConfirmText("");
                }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                disabled={isDeletingCard}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteCard}
                disabled={
                  deleteCardConfirmText.trim().toLowerCase() !==
                    selectedCardToDelete.name.trim().toLowerCase() ||
                  isDeletingCard
                }
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:hover:bg-red-600 text-white text-sm font-bold shadow-md transition-colors"
              >
                {isDeletingCard ? "Removing..." : "Delete Card Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK CIRCLE MODAL 1: Send Money to Roommate */}
      {showSendMoneyModal &&
        (() => {
          const fundingCard =
            wallet?.cards.find(
              (c) => c.id === (sendSelectedCardId || wallet?.cards[0]?.id),
            ) || wallet?.cards?.[0];
          const fundingBal = fundingCard?.balance || 0;
          const sendVal = parseFloat(sendAmount) || 0;
          const isSendInsufficient = fundingBal < sendVal;

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
              <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      Send Money to Roommate
                    </h3>
                    <p className="text-xs text-slate-500">
                      Instant transfer from your linked card
                    </p>
                  </div>
                  <button
                    onClick={() => setShowSendMoneyModal(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Recipient Name / Phone
                    </label>
                    <input
                      type="text"
                      value={sendRecipient}
                      onChange={(e) => setSendRecipient(e.target.value)}
                      placeholder="e.g. Alex Chen or 0917 ••• 1234"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-hidden focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Amount (₱)
                    </label>
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      {["200", "500", "1000", "2500"].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setSendAmount(preset)}
                          className={`py-1.5 rounded-lg text-xs font-bold transition-colors ${
                            sendAmount === preset
                              ? "bg-blue-600 text-white"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          ₱{preset}
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      value={sendAmount}
                      onChange={(e) => setSendAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-base font-bold outline-hidden focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Source Card / Account
                    </label>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {(wallet?.cards || []).map((c) => {
                        const isSelected =
                          (sendSelectedCardId || wallet?.cards[0]?.id) === c.id;
                        return (
                          <div
                            key={c.id}
                            onClick={() => setSendSelectedCardId(c.id)}
                            className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer text-xs ${
                              isSelected
                                ? "border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 font-bold"
                                : "border-slate-200 dark:border-slate-800"
                            }`}
                          >
                            <span>
                              {c.name} ({c.accountNumber})
                            </span>
                            <span className="tabular-nums">
                              ₱{(c.balance || 0).toLocaleString()}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Note / Purpose (Optional)
                    </label>
                    <input
                      type="text"
                      value={sendNote}
                      onChange={(e) => setSendNote(e.target.value)}
                      placeholder="e.g. Share for pizza, internet fee"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-hidden focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Insufficient Balance Callout */}
                {fundingCard && isSendInsufficient && sendVal > 0 && (
                  <div className="p-3 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
                    <span className="font-medium">
                      Insufficient balance on {fundingCard.name}. Available: ₱
                      {fundingBal.toLocaleString()} (Short by ₱
                      {(sendVal - fundingBal).toLocaleString()}).
                    </span>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setShowSendMoneyModal(false)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendMoney}
                    disabled={
                      isSendInsufficient ||
                      sendVal <= 0 ||
                      !sendRecipient.trim()
                    }
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 text-white text-sm font-bold shadow-md transition-colors"
                  >
                    {isSendInsufficient && sendVal > 0
                      ? `Insufficient Balance on ${fundingCard?.name || "Card"}`
                      : sendVal <= 0
                        ? "Enter Amount"
                        : `Send ₱${sendVal.toLocaleString()} Now`}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* QUICK CIRCLE MODAL 2: Request Split */}
      {showRequestSplitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Request Household Split
                </h3>
                <p className="text-xs text-slate-500">
                  Fair split calculations distributed across roommates
                </p>
              </div>
              <button
                onClick={() => setShowRequestSplitModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Expense / Bill Name
                </label>
                <input
                  type="text"
                  value={splitTitle}
                  onChange={(e) => setSplitTitle(e.target.value)}
                  placeholder="e.g. Electricity Bill, Drinking Water Refill"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Total Bill Amount (₱)
                </label>
                <input
                  type="number"
                  value={splitAmount}
                  onChange={(e) => setSplitAmount(e.target.value)}
                  placeholder="2400"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-base font-bold outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Number of Roommates Sharing ({splitNumPeople})
                </label>
                <div className="flex gap-2">
                  {[2, 3, 4, 5, 6].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setSplitNumPeople(num)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${
                        splitNumPeople === num
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live share preview box */}
              <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 block">
                    Calculated Fair Share
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Exact centavo split per person
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black text-blue-600 dark:text-blue-400 tabular-nums">
                    ₱
                    {(
                      (parseFloat(splitAmount) || 0) / (splitNumPeople || 1)
                    ).toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-400 block">each</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowRequestSplitModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSplitRequest}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md transition-colors"
              >
                Distribute Split
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK CIRCLE MODAL 3: Scan QR Ph */}
      {showScanQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Scan QR Ph Code
                </h3>
                <p className="text-xs text-slate-500">
                  National Philippine standard payment
                </p>
              </div>
              <button
                onClick={() => setShowScanQrModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 text-white flex flex-col items-center justify-center space-y-3 relative overflow-hidden">
              <div className="w-48 h-48 border-2 border-dashed border-blue-400/80 rounded-2xl flex flex-col items-center justify-center relative p-3 bg-black/40">
                <div className="w-full h-full bg-white p-2 rounded-xl flex items-center justify-center">
                  {/* Mock QR Ph SVG Pattern */}
                  <div className="grid grid-cols-6 gap-1 w-full h-full p-2 bg-slate-950 rounded-lg">
                    {[...Array(36)].map((_, i) => (
                      <div
                        key={i}
                        className={`rounded-xs ${
                          i % 2 === 0 ||
                          i % 7 === 0 ||
                          i === 0 ||
                          i === 5 ||
                          i === 30 ||
                          i === 35
                            ? "bg-blue-500"
                            : "bg-white"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-0.5 bg-red-500 animate-pulse" />
              </div>

              <div className="flex items-center gap-1.5 bg-blue-600/30 px-3 py-1 rounded-full border border-blue-500/30">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                <span className="text-[10px] font-bold text-blue-200 uppercase tracking-wider">
                  QR Ph InstaPay Verified
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                Splitzy Roommate QR Reader
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Point at any roommate's GCash, Maya, or bank QR Ph code to
                auto-pay.
              </p>
            </div>

            <button
              onClick={() => {
                setIsQrScanned(true);
                alert(
                  'QR Ph code detected! Merchant: "Household Utilities - Unit 4B". Ready for 1-tap payment.',
                );
                setShowScanQrModal(false);
              }}
              className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm shadow-md transition-colors"
            >
              Simulate Scan Complete
            </button>
          </div>
        </div>
      )}

      {/* QUICK CIRCLE MODAL 4: Spending Analytics */}
      {showAnalyticsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Spending Analytics
                </h3>
                <p className="text-xs text-slate-500">
                  Monthly household expenses breakdown
                </p>
              </div>
              <button
                onClick={() => setShowAnalyticsModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {[
                {
                  cat: "Condo Rent & Dues",
                  amount: "₱7,500",
                  pct: 60,
                  color: "bg-blue-600",
                },
                {
                  cat: "Meralco Electricity",
                  amount: "₱2,100",
                  pct: 20,
                  color: "bg-amber-500",
                },
                {
                  cat: "Manila Water / Refill",
                  amount: "₱650",
                  pct: 10,
                  color: "bg-cyan-500",
                },
                {
                  cat: "Converge Fiber Internet",
                  amount: "₱750",
                  pct: 10,
                  color: "bg-emerald-500",
                },
              ].map((item) => (
                <div key={item.cat} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                    <span>{item.cat}</span>
                    <span className="tabular-nums">
                      {item.amount} ({item.pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className={`${item.color} h-2 rounded-full`}
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300">
                Total Monthly Paid
              </span>
              <span className="font-black text-slate-900 dark:text-white text-base tabular-nums">
                ₱11,000.00
              </span>
            </div>

            <button
              onClick={() => setShowAnalyticsModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* QUICK CIRCLE MODAL 5: Card Limits & Security Controls */}
      {showLimitsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Card Limits & Security
                </h3>
                <p className="text-xs text-slate-500">
                  Daily spend caps and anti-fraud protections
                </p>
              </div>
              <button
                onClick={() => setShowLimitsModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Daily Online Spend Limit (₱)
                </label>
                <input
                  type="number"
                  value={dailyOnlineLimit}
                  onChange={(e) => setDailyOnlineLimit(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-base font-bold outline-hidden focus:border-blue-500"
                />
              </div>

              <div
                onClick={() => setIsCardLocked(!isCardLocked)}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
              >
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Lock Cards Temporarily
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Instantly freeze all linked debit cards
                  </p>
                </div>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${isCardLocked ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600"}`}
                >
                  <Lock className="w-4 h-4" />
                </div>
              </div>

              <div
                onClick={() => setAllowContactless(!allowContactless)}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
              >
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    QR Ph & Contactless NFC
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Allow 1-tap fast settlements
                  </p>
                </div>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${allowContactless ? "bg-emerald-100 text-emerald-600" : "bg-slate-200 text-slate-400"}`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowLimitsModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowLimitsModal(false);
                  alert(
                    `Security preferences saved! Daily limit set to ₱${parseFloat(dailyOnlineLimit || "0").toLocaleString()}.`,
                  );
                }}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md transition-colors"
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Pocket Action (Stash / Withdraw) */}
      {showPocketActionModal && selectedPocket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {pocketActionType === "deposit"
                    ? `Stash into "${selectedPocket.name}"`
                    : `Withdraw from "${selectedPocket.name}"`}
                </h3>
                <p className="text-xs text-slate-500">
                  {pocketActionType === "deposit"
                    ? `Available in wallet: ₱${balance.toLocaleString()}`
                    : `Current in pocket: ₱${selectedPocket.currentAmount.toLocaleString()}`}
                </p>
              </div>
              <button
                onClick={() => setShowPocketActionModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {["200", "500", "1000", "2000"].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setPocketTransferAmount(preset)}
                  className={`py-2 rounded-xl text-xs font-bold transition-colors ${
                    pocketTransferAmount === preset
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  ₱{preset}
                </button>
              ))}
            </div>

            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-400">
                ₱
              </span>
              <input
                type="number"
                value={pocketTransferAmount}
                onChange={(e) => setPocketTransferAmount(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-extrabold text-xl outline-hidden focus:border-blue-500"
                placeholder="0.00"
              />
            </div>

            {/* Select Configured Card to Deduct From or Withdraw To */}
            <div className="space-y-1.5 pt-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                {pocketActionType === "deposit"
                  ? "Deduct From Configured Card"
                  : "Withdraw To Configured Card"}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {(wallet?.cards || []).map((c) => {
                  const isSelected =
                    (pocketSelectedCardId ||
                      wallet?.cards.find((x) => x.isDefault)?.id ||
                      wallet?.cards[0]?.id) === c.id;
                  const isCashCard = (c.type as any) === "cash";
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setPocketSelectedCardId(c.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        isSelected
                          ? isCashCard
                            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 ring-2 ring-emerald-500/20"
                            : "border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-950 dark:text-blue-100 ring-2 ring-blue-600/20"
                          : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800/60"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold truncate max-w-[120px]">
                          {c.name}
                        </span>
                        {c.isDefault && (
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                            Primary
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-1 text-[11px]">
                        <span className="text-slate-400 font-mono text-[10px]">
                          {c.accountNumber}
                        </span>
                        <span
                          className={`font-bold tabular-nums ${
                            isSelected
                              ? isCashCard
                                ? "text-emerald-700 dark:text-emerald-300"
                                : "text-blue-700 dark:text-blue-300"
                              : "text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          ₱
                          {(c.balance || 0).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Impact Preview */}
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
                <div
                  className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                    isInsufficient
                      ? "border-red-300 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
                      : "border-emerald-200 bg-emerald-50/70 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300"
                  }`}
                >
                  {isInsufficient ? (
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  )}
                  <span className="font-medium">
                    {pocketActionType === "deposit"
                      ? isInsufficient
                        ? `Insufficient balance on ${activeCard.name} (₱${cardBal.toLocaleString()} available)`
                        : `After saving: ${activeCard.name} balance will be ₱${Math.max(0, cardBal - num).toLocaleString()}`
                      : `After withdrawal: ${activeCard.name} balance will be ₱${(cardBal + num).toLocaleString()}`}
                  </span>
                </div>
              );
            })()}

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowPocketActionModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handlePocketTransfer}
                disabled={(() => {
                  const activeCard =
                    wallet?.cards.find(
                      (c) =>
                        c.id ===
                        (pocketSelectedCardId ||
                          wallet?.cards.find((x) => x.isDefault)?.id ||
                          wallet?.cards[0]?.id),
                    ) || wallet?.cards[0];
                  const num = parseFloat(pocketTransferAmount) || 0;
                  const isInsufficient =
                    pocketActionType === "deposit"
                      ? (activeCard?.balance || 0) < num
                      : (selectedPocket?.currentAmount || 0) < num;
                  return isInsufficient || num <= 0;
                })()}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 text-white text-sm font-bold shadow-md transition-colors"
              >
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
                  const isInsufficient =
                    pocketActionType === "deposit"
                      ? (activeCard?.balance || 0) < num
                      : (selectedPocket?.currentAmount || 0) < num;
                  if (isInsufficient && num > 0) return "Insufficient Balance";
                  if (num <= 0) return "Enter Amount";
                  return pocketActionType === "deposit"
                    ? "Confirm Stash"
                    : "Confirm Withdraw";
                })()}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Transaction Detail */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Transaction Detail
              </h3>
              <button
                onClick={() => setSelectedTx(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-center py-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                Amount
              </span>
              <p className="text-3xl font-black text-slate-900 dark:text-white mt-1">
                ₱{selectedTx.amount.toLocaleString()}
              </p>
              <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                {selectedTx.status}
              </span>
            </div>

            {/* Prominent Expense Note Box */}
            {(() => {
              const matchedPreset = QUICK_EXPENSE_PRESETS.find(
                (p) =>
                  p.title.toLowerCase() === selectedTx.title?.toLowerCase() ||
                  p.id.toLowerCase() === selectedTx.title?.toLowerCase(),
              );
              const fallbackNote =
                matchedPreset?.defaultNote ||
                selectedTx.description?.trim() ||
                (selectedTx.type === "expense_simulation"
                  ? `Daily simulated expense for ${selectedTx.title}`
                  : selectedTx.title || "Daily transaction record");
              const hasCustomNote = Boolean(
                ((selectedTx as any)?.note || "")?.trim(),
              );
              const displayExpenseNote = hasCustomNote
                ? ((selectedTx as any)?.note || "")?.trim()
                : fallbackNote;

              return (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-left">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-bold text-[10px] uppercase tracking-wider">
                      <FileText className="w-3.5 h-3.5" />
                      <span>Expense Note</span>
                    </div>
                    {!hasCustomNote && (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100/70 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300">
                        Preset Fallback
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-800 dark:text-slate-200 font-medium break-words leading-relaxed">
                    {displayExpenseNote}
                  </p>
                </div>
              );
            })()}

            <div className="space-y-2 text-xs divide-y divide-slate-100 dark:divide-slate-800">
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Transaction ID</span>
                <span className="font-mono text-slate-900 dark:text-white font-medium">
                  {selectedTx.id}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Channel / Card</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {selectedTx.paymentMethodUsed}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Expense Note</span>
                <span className="text-slate-900 dark:text-white font-medium text-right max-w-[200px] break-words">
                  {(() => {
                    const matchedPreset = QUICK_EXPENSE_PRESETS.find(
                      (p) =>
                        p.title.toLowerCase() ===
                          selectedTx.title?.toLowerCase() ||
                        p.id.toLowerCase() === selectedTx.title?.toLowerCase(),
                    );
                    return (
                      ((selectedTx as any)?.note || "")?.trim() ||
                      matchedPreset?.defaultNote ||
                      selectedTx.description?.trim() ||
                      (selectedTx.type === "expense_simulation"
                        ? `Daily simulated expense for ${selectedTx.title}`
                        : selectedTx.title || "Daily transaction record")
                    );
                  })()}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Description</span>
                <span className="text-slate-900 dark:text-white font-medium text-right max-w-[200px]">
                  {selectedTx.description}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Timestamp</span>
                <span className="text-slate-900 dark:text-white font-medium">
                  {new Date(selectedTx.timestamp).toLocaleString()}
                </span>
              </div>
            </div>

            <button
              onClick={() => setSelectedTx(null)}
              className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* MODAL 5: 6-Step Walkthrough Modal */}
      {showWalkthroughModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 relative">
            <button
              onClick={() => handleFinishWalkthrough()}
              className="absolute top-5 right-5 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Stepper Dots */}
            <div className="flex items-center justify-center gap-1.5 mb-6">
              {[0, 1, 2, 3, 4, 5].map((stepIdx) => (
                <div
                  key={stepIdx}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    walkthroughStep === stepIdx
                      ? "w-7 bg-blue-600"
                      : "w-2 bg-slate-200 dark:bg-slate-700"
                  }`}
                />
              ))}
            </div>

            <div className="min-h-[280px] flex flex-col justify-center">
              {walkthroughStep === 0 && (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto shadow-xs">
                    <Wallet className="w-8 h-8" />
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded-full">
                      Welcome to Splitzy Wallet
                    </span>
                    <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mt-2">
                      Meet Your Shared Expense Hub
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
                      Splitzy Wallet is your digital companion for painless
                      house expense management.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 text-left pt-2">
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
                      <Sparkles className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          Clean Slate: Starts at ₱0.00
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          No preloaded dummy money or mock cards. You start
                          completely fresh with full ownership.
                        </p>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
                      <Receipt className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          1-Tap Bill Settlement
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Settle your fair share of rent, electricity, and water
                          directly from your wallet balance.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {walkthroughStep === 1 && (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-xs">
                    <ArrowDownCircle className="w-8 h-8" />
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full">
                      Digital Balance & Top-ups
                    </span>
                    <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mt-2">
                      Top Up Whenever You Need
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
                      Fund your wallet easily using popular Philippine payment
                      channels.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 text-left pt-2">
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
                      <Smartphone className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          GCash & Maya Supported
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Transfer funds directly or simulate digital wallet
                          top-ups in seconds.
                        </p>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
                      <Building className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          Philippine Banks
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Top up from BPI, BDO, UnionBank, Metrobank or
                          customized accounts.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {walkthroughStep === 2 && (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-xs">
                    <Receipt className="w-8 h-8" />
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-full">
                      Seamless Settlements
                    </span>
                    <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mt-2">
                      Settle Bills Without Friction
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
                      Forget awkward reminders, paper receipts, or searching for
                      exact change.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 text-left pt-2">
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          Automatic Roommate Sync
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          When you pay from Splitzy Wallet, your share is marked
                          as 'Paid' instantly for your host and roommates.
                        </p>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
                      <ArrowUpRight className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          Digital Ledger & Proof
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Every payment generates a complete timestamped digital
                          receipt stored in your Activity Ledger.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {walkthroughStep === 3 && (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-xs">
                    <Shield className="w-8 h-8" />
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1 rounded-full">
                      Goal-Based Savings
                    </span>
                    <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mt-2">
                      Smart Savings Pockets
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
                      Set aside money into targeted sub-wallets to keep your
                      emergency cushion and rent deposits protected.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 text-left pt-2">
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
                      <Home className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          Goal Milestones & Tracking
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Define target amounts for security deposits,
                          appliances, or trips with live progress bars.
                        </p>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
                      <TrendingDown className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5 rotate-180" />
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          Stash & Withdraw Anytime
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Transfer funds into a pocket or withdraw back to your
                          main wallet balance anytime without fees.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {walkthroughStep === 4 && (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-pink-50 dark:bg-pink-950/60 text-pink-600 dark:text-pink-400 flex items-center justify-center mx-auto shadow-xs">
                    <CreditCard className="w-8 h-8" />
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/60 px-2.5 py-1 rounded-full">
                      Payment Cards Deck
                    </span>
                    <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mt-2">
                      Link Backup Payment Cards
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
                      Add your cards and e-wallet accounts to streamline future
                      top-ups and track balances.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 text-left pt-2">
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
                      <Plus className="w-5 h-5 text-pink-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          Default Primary Card
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Designate a default payment method for swift 1-tap
                          checkout.
                        </p>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
                      <Lock className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          Masked & Secure
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Account numbers are masked with dot placeholders for
                          complete privacy.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {walkthroughStep === 5 && (
                <div className="text-center space-y-5">
                  <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto shadow-xs">
                    <Sparkles className="w-8 h-8" />
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded-full">
                      Ready to Get Started
                    </span>
                    <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mt-2">
                      Your Splitzy Wallet is Ready!
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
                      Your wallet is active and starts at ₱0.00. Choose what
                      you'd like to do first:
                    </p>
                  </div>

                  <div className="space-y-2.5 pt-2">
                    <button
                      onClick={() => handleFinishWalkthrough("add_card")}
                      className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>+ Link a Payment Card</span>
                    </button>

                    <button
                      onClick={() => handleFinishWalkthrough("cash_in")}
                      className="w-full py-3 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold text-sm transition-all flex items-center justify-center gap-2"
                    >
                      <ArrowDownCircle className="w-4 h-4 text-blue-600" />
                      <span>+ Cash In to Wallet</span>
                    </button>

                    <button
                      onClick={() => handleFinishWalkthrough("add_pocket")}
                      className="w-full py-3 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold text-sm transition-all flex items-center justify-center gap-2"
                    >
                      <Shield className="w-4 h-4 text-emerald-600" />
                      <span>+ Create a Savings Pocket</span>
                    </button>

                    <button
                      onClick={() => handleFinishWalkthrough()}
                      className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                    >
                      Go straight to Dashboard →
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Nav Controls */}
            {walkthroughStep < 5 && (
              <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
                {walkthroughStep > 0 ? (
                  <button
                    onClick={() =>
                      setWalkthroughStep((s) => Math.max(0, s - 1))
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>
                ) : (
                  <div className="w-16" />
                )}

                <span className="text-xs font-semibold text-slate-400">
                  {walkthroughStep + 1} of 6
                </span>

                <button
                  onClick={() => setWalkthroughStep((s) => Math.min(5, s + 1))}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-xs"
                >
                  <span>Next</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* QUICK EXPENSE SIMULATION MODAL */}
      {showExpenseSimModal && selectedExpensePreset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  style={{
                    background: `linear-gradient(135deg, ${selectedExpensePreset.gradient[0]}, ${selectedExpensePreset.gradient[1]})`,
                  }}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-xs"
                >
                  {selectedExpensePreset.id === "custom" &&
                  customExpenseTitle.trim() ? (
                    getExpenseSemanticIconWeb({
                      title: customExpenseTitle,
                      note: simNote,
                      type: "expense_simulation",
                    }).iconNode("w-5 h-5")
                  ) : (
                    <>
                      {selectedExpensePreset.icon === "coffee" && (
                        <Coffee className="w-5 h-5" />
                      )}
                      {selectedExpensePreset.icon === "utensils" && (
                        <Utensils className="w-5 h-5" />
                      )}
                      {selectedExpensePreset.icon === "bus" && (
                        <Bus className="w-5 h-5" />
                      )}
                      {(selectedExpensePreset.icon === "grocery" ||
                        selectedExpensePreset.icon === "shopping-cart") && (
                        <ShoppingBag className="w-5 h-5" />
                      )}
                      {selectedExpensePreset.icon === "cookie" && (
                        <Cookie className="w-5 h-5" />
                      )}
                      {selectedExpensePreset.icon === "zap" && (
                        <Zap className="w-5 h-5" />
                      )}
                      {selectedExpensePreset.icon === "pill" && (
                        <Pill className="w-5 h-5" />
                      )}
                      {selectedExpensePreset.icon === "custom" && (
                        <PlusCircle className="w-5 h-5" />
                      )}
                    </>
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {selectedExpensePreset.id === "custom" &&
                    customExpenseTitle.trim()
                      ? customExpenseTitle.trim()
                      : `Simulate ${selectedExpensePreset.title}`}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Instantly deduct expense from selected payment card
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowExpenseSimModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Custom Expense Name Input when Custom Preset Selected */}
            {selectedExpensePreset.id === "custom" && (
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Custom Expense Name / Purpose
                </label>
                <input
                  type="text"
                  value={customExpenseTitle}
                  onChange={(e) => setCustomExpenseTitle(e.target.value)}
                  placeholder="e.g. Milk Tea, Dinner with friends, GrabCar, Gym"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-hidden focus:border-blue-500 font-medium"
                />
              </div>
            )}

            {/* Expense Amount */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                Expense Amount (₱)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-400">
                  ₱
                </span>
                <input
                  type="number"
                  value={simAmount}
                  onChange={(e) => setSimAmount(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-extrabold text-xl outline-hidden focus:border-blue-500"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Card Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                Deduct from Payment Card
              </label>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {(wallet?.cards || []).map((card) => {
                  const isSelected = simCardId === card.id;
                  return (
                    <div
                      key={card.id}
                      onClick={() => setSimCardId(card.id)}
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                        isSelected
                          ? "border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100"
                          : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <CreditCard className="w-4 h-4 text-blue-600 shrink-0" />
                        <div>
                          <p className="text-xs font-bold leading-tight">
                            {card.name}
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            {card.accountNumber}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-extrabold text-slate-900 dark:text-white tabular-nums block">
                          ₱{(card.balance || 0).toLocaleString()}
                        </span>
                        <span className="text-[9px] text-slate-400 uppercase tracking-wider">
                          Balance
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Live Preview / Insufficient Callout */}
            {(() => {
              const currentCard = wallet?.cards.find((c) => c.id === simCardId);
              const cardBal = currentCard?.balance || 0;
              const expenseAmt = parseFloat(simAmount) || 0;
              const isInsufficient = cardBal < expenseAmt;
              const balanceAfter = Math.max(0, cardBal - expenseAmt);

              return (
                <div>
                  {currentCard && (
                    <div
                      className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2 ${
                        isInsufficient
                          ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300"
                          : "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                      }`}
                    >
                      {isInsufficient ? (
                        <>
                          <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                          <span>
                            Insufficient balance on {currentCard.name} (₱
                            {cardBal.toLocaleString()})
                          </span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                          <span>
                            Balance after deduction: ₱
                            {balanceAfter.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </>
                      )}
                    </div>
                  )}

                  <div className="mt-3">
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Expense Note (Optional)
                    </label>
                    <input
                      type="text"
                      value={simNote}
                      onChange={(e) => setSimNote(e.target.value)}
                      placeholder="e.g. Afternoon latte & snack"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-hidden focus:border-blue-500"
                    />
                  </div>

                  <div className="flex gap-2 pt-3">
                    <button
                      onClick={() => setShowExpenseSimModal(false)}
                      className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleExecuteSimulatedExpense}
                      disabled={
                        isSimulatingExpense || isInsufficient || expenseAmt <= 0
                      }
                      className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 text-white text-sm font-bold shadow-md transition-colors"
                    >
                      {isSimulatingExpense
                        ? "Processing..."
                        : isInsufficient && expenseAmt > 0
                          ? `Insufficient Balance on ${currentCard?.name || "Card"}`
                          : expenseAmt <= 0
                            ? "Enter Expense Amount"
                            : `Simulate & Deduct ₱${expenseAmt.toLocaleString()}`}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* CARD-TO-CARD TRANSFER MODAL */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <ArrowLeftRight className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Transfer Between Cards
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Rebalance funds between linked cards & e-wallets
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTransferModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Source & Destination Selectors with Swap */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  FROM (SOURCE CARD)
                </label>
                <select
                  value={transferSourceCardId}
                  onChange={(e) => setTransferSourceCardId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white outline-hidden focus:border-blue-500"
                >
                  {(wallet?.cards || []).map((card) => (
                    <option key={card.id} value={card.id}>
                      {card.name} (Bal: ₱{(card.balance || 0).toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-center -my-1">
                <button
                  type="button"
                  onClick={() => {
                    const temp = transferSourceCardId;
                    setTransferSourceCardId(transferDestCardId);
                    setTransferDestCardId(temp);
                  }}
                  className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-blue-600 dark:text-blue-400 transition-colors shadow-xs"
                  title="Swap source and destination"
                >
                  <ArrowLeftRight className="w-4 h-4 rotate-90" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  TO (DESTINATION CARD)
                </label>
                <select
                  value={transferDestCardId}
                  onChange={(e) => setTransferDestCardId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white outline-hidden focus:border-blue-500"
                >
                  {(wallet?.cards || []).map((card) => (
                    <option key={card.id} value={card.id}>
                      {card.name} (Bal: ₱{(card.balance || 0).toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Transfer Amount */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                Transfer Amount (₱)
              </label>
              <div className="grid grid-cols-5 gap-2 mb-2">
                {[
                  { label: "₱200", val: "200" },
                  { label: "₱500", val: "500" },
                  { label: "₱1,000", val: "1000" },
                  { label: "₱2,500", val: "2500" },
                  {
                    label: "Max",
                    val: String(
                      wallet?.cards.find((c) => c.id === transferSourceCardId)
                        ?.balance || 0,
                    ),
                  },
                ].map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setTransferAmount(chip.val)}
                    className="py-1.5 rounded-lg text-xs font-bold bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/40 transition-colors"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-400">
                  ₱
                </span>
                <input
                  type="number"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-extrabold text-xl outline-hidden focus:border-indigo-500"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Transfer Note */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                Transfer Note / Reason (Optional)
              </label>
              <input
                type="text"
                value={transferNote}
                onChange={(e) => setTransferNote(e.target.value)}
                placeholder="e.g. Rebalance for upcoming groceries"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-hidden focus:border-indigo-500"
              />
            </div>

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
                <div className="space-y-3 pt-1">
                  {sourceCard && (
                    <div
                      className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2 ${
                        isInsufficient || isSameCard
                          ? "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300"
                          : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300"
                      }`}
                    >
                      {isInsufficient || isSameCard ? (
                        <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      )}
                      <span>
                        {isSameCard
                          ? "Source and destination cards must be different accounts."
                          : isInsufficient
                            ? `Insufficient balance on ${sourceCard.name}. Available: ₱${sourceBal.toLocaleString()} (Short by ₱${(transferAmt - sourceBal).toLocaleString()}).`
                            : `${sourceCard.name}: ₱${Math.max(0, sourceBal - transferAmt).toLocaleString()} ➔ ${destCard?.name || "Destination"}: ₱${(destBal + transferAmt).toLocaleString()}`}
                      </span>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setShowTransferModal(false)}
                      className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleExecuteTransfer}
                      disabled={
                        isTransferring ||
                        isInsufficient ||
                        isSameCard ||
                        transferAmt <= 0
                      }
                      className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white text-sm font-bold shadow-md transition-colors"
                    >
                      {isTransferring
                        ? "Transferring..."
                        : isSameCard
                          ? "Select Different Cards"
                          : isInsufficient && transferAmt > 0
                            ? `Insufficient Balance on ${sourceCard?.name || "Card"}`
                            : transferAmt <= 0
                              ? "Enter Transfer Amount"
                              : `Confirm Transfer ₱${transferAmt.toLocaleString()}`}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
