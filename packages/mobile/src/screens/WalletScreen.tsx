import React, { useState, useEffect } from "react";
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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
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
} from "../services/walletService";
import { auth } from "../firebase/config";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

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
    icon: "cart",
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
  const { isDark, colors } = useTheme();
  const { onScroll, showNav } = useNavVisibility();

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

  const [selectedTx, setSelectedTx] = useState<WalletTransaction | null>(null);
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
      const updated = await walletService.cashIn(currentUid, num, targetCardId);
      setWallet(updated);
      setShowCashInModal(false);
      setCashInAmount("1000");
      const matched = updated.cards.find((c) => c.id === targetCardId);
      const cardTitle = matched ? matched.name : cashInMethod;
      Alert.alert(
        "Top-up Successful",
        `₱${num.toLocaleString()} has been added to ${cardTitle}. Total Available Digital Balance updated!`,
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

    try {
      setIsSimulatingExpense(true);
      const res = await walletService.simulateCardExpense(
        currentUid,
        simCardId,
        amt,
        selectedExpensePreset.title,
        selectedExpensePreset.icon,
        simNote,
      );
      if (res.success) {
        setWallet(res.updatedState);
        setShowExpenseSimModal(false);
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
        tx.type === "card_transfer"
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
        { backgroundColor: isDark ? colors.background : "#F8FAFC" },
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
        contentContainerStyle={styles.scrollContent}
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
              : `₱${balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
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
          <View style={styles.quickCircleGrid}>
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
              onPress={() => {
                setIsQrScanned(false);
                setShowScanQrModal(true);
              }}
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
          </View>
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
                  Quick Expense Circles
                </Text>
                <View
                  style={[
                    styles.quickExpenseLiveBadge,
                    { backgroundColor: isDark ? "#064E3B" : "#ECFDF5" },
                  ]}
                >
                  <View style={styles.quickExpensePulseDot} />
                  <Text
                    style={[
                      styles.quickExpenseLiveBadgeText,
                      { color: isDark ? "#34D399" : "#059669" },
                    ]}
                  >
                    AUTO-DEDUCT
                  </Text>
                </View>
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
                      payments.
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
          <View style={styles.pocketsGrid}>
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
                      ₱{pocket.currentAmount.toLocaleString()}
                    </Text>
                    <Text
                      style={[
                        styles.pocketTarget,
                        { color: isDark ? colors.textMuted : "#64748B" },
                      ]}
                    >
                      / ₱{pocket.targetAmount.toLocaleString()}
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
                        setShowPocketActionModal(true);
                      }}
                    >
                      <Ionicons name="arrow-up" size={14} color="#2563EB" />
                      <Text style={styles.pocketBtnText}>+ Stash</Text>
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
          </View>
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
                  <View
                    style={[
                      styles.txIconWrap,
                      {
                        backgroundColor:
                          tx.type === "expense_simulation"
                            ? "#F59E0B18"
                            : tx.type === "card_transfer"
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
                              : tx.type === "expense_simulation"
                                ? "cart-outline"
                                : tx.type === "card_transfer"
                                  ? "swap-horizontal"
                                  : "shield-checkmark"
                      }
                      size={20}
                      color={
                        tx.type === "expense_simulation"
                          ? "#F59E0B"
                          : tx.type === "card_transfer"
                            ? "#6366F1"
                            : isPositive
                              ? "#10B981"
                              : "#2563EB"
                      }
                    />
                  </View>

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
                      {tx.amount.toLocaleString()}
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
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowCashInModal(false)}
          />
          <View
            style={[
              styles.modalSheet,
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
          </View>
        </View>
      </Modal>

      {/* MODAL 2: Add Mock Card / E-Wallet */}
      <Modal
        visible={showAddCardModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddCardModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowAddCardModal(false)}
          />
          <View
            style={[
              styles.modalSheet,
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
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowCardDetailModal(false)}
          />
          <View
            style={[
              styles.modalSheet,
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
              ]}
            />

            {selectedCardDetail &&
              (() => {
                const preset =
                  PHILIPPINE_CARD_PRESETS[selectedCardDetail.type] ||
                  PHILIPPINE_CARD_PRESETS.custom;
                const isGCash = selectedCardDetail.type === "gcash";

                return (
                  <View>
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
                        selectedCardDetail.colorGradient || preset.gradient
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.cardDetailBanner}
                    >
                      <View style={styles.cardDetailBannerTop}>
                        <View style={styles.cardBrandBadge}>
                          <Text style={styles.cardBrandName}>
                            {preset?.name || selectedCardDetail.name}
                          </Text>
                        </View>
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
                            {preset?.network || (isGCash ? "QR Ph" : "Visa")}
                          </Text>
                        </View>
                      </View>

                      <View style={{ marginVertical: 8 }}>
                        <Text style={styles.cardBalanceLabel}>
                          CARD BALANCE
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
                          <Text style={styles.cardHolderLabel}>CARDHOLDER</Text>
                          <Text style={styles.cardHolderName} numberOfLines={1}>
                            {selectedCardDetail.cardholderName}
                          </Text>
                        </View>
                        <Text style={styles.cardNumberText}>
                          {selectedCardDetail.accountNumber}
                        </Text>
                      </View>
                    </LinearGradient>

                    {/* Actions Section */}
                    <View style={{ marginVertical: 14, gap: 10 }}>
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
                            Send Funds
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
                            Account No.
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
                  </View>
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
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowExpenseSimModal(false)}
          />
          <View
            style={[
              styles.modalSheet,
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
                  <View>
                    <View style={styles.simModalHeaderRow}>
                      <LinearGradient
                        colors={selectedExpensePreset.gradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.simModalIconWrap}
                      >
                        <Ionicons
                          name={selectedExpensePreset.icon}
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
                          {selectedExpensePreset.title}
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
                    <Text
                      style={[
                        styles.inputLabel,
                        {
                          color: isDark ? colors.textSecondary : "#475569",
                          marginTop: 10,
                        },
                      ]}
                    >
                      Expense Note (Optional)
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
                      value={simNote}
                      onChangeText={setSimNote}
                      placeholder="e.g. Afternoon latte & snack"
                      placeholderTextColor={
                        isDark ? colors.textMuted : "#94A3B8"
                      }
                    />

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
                          Simulate & Deduct ₱
                          {expenseAmt.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
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
                  </View>
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
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowTransferModal(false)}
          />
          <View
            style={[
              styles.modalSheet,
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
                <View>
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
                        Confirm Transfer ₱
                        {transferAmt.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
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
                </View>
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
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowAddPocketModal(false)}
          />
          <View
            style={[
              styles.modalSheet,
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
          </View>
        </View>
      </Modal>

      {/* MODAL 4: Stash or Withdraw from Pocket */}
      <Modal
        visible={showPocketActionModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPocketActionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowPocketActionModal(false)}
          />
          <View
            style={[
              styles.modalSheet,
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
                ? `Move funds from your wallet balance (₱${balance.toLocaleString()} available)`
                : `Move funds back to your wallet balance (₱${selectedPocket?.currentAmount.toLocaleString()} in pocket)`}
            </Text>

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

            <TouchableOpacity
              style={styles.modalPrimaryBtn}
              onPress={handlePocketTransfer}
              activeOpacity={0.8}
            >
              <Text style={styles.modalPrimaryBtnText}>
                Confirm{" "}
                {pocketActionType === "deposit" ? "Deposit" : "Withdrawal"} of ₱
                {parseFloat(pocketTransferAmount || "0").toLocaleString()}
              </Text>
            </TouchableOpacity>

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
          </View>
        </View>
      </Modal>

      {/* MODAL 5: Transaction Receipt Details */}
      <Modal
        visible={Boolean(selectedTx)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedTx(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setSelectedTx(null)}
          />
          <View
            style={[
              styles.receiptSheet,
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
              ]}
            />
            <View style={styles.receiptTopCircle}>
              <Ionicons name="checkmark-circle" size={48} color="#10B981" />
            </View>

            <Text
              style={[
                styles.receiptTitle,
                { color: isDark ? colors.text : "#0F172A" },
              ]}
            >
              Payment Receipt
            </Text>
            <Text style={styles.receiptAmount}>
              ₱{selectedTx?.amount.toLocaleString()}
            </Text>

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
              onPress={() => setSelectedTx(null)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalPrimaryBtnText}>Close Receipt</Text>
            </TouchableOpacity>
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
      >
        <View style={styles.modalOverlay}>
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
                {(selectedCardToDelete?.balance || 0).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
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
          </View>
        </View>
      </Modal>

      {/* QUICK CIRCLE MODAL 1: Send Money to Roommate */}
      <Modal
        visible={showSendMoneyModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSendMoneyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowSendMoneyModal(false)}
          />
          <View
            style={[
              styles.modalSheet,
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

            <TouchableOpacity
              style={styles.modalPrimaryBtn}
              onPress={handleSendMoney}
              activeOpacity={0.8}
            >
              <Ionicons name="paper-plane" size={18} color="#FFFFFF" />
              <Text style={styles.modalPrimaryBtnText}>
                Send ₱{parseFloat(sendAmount || "0").toLocaleString()} Now
              </Text>
            </TouchableOpacity>

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
          </View>
        </View>
      </Modal>

      {/* QUICK CIRCLE MODAL 2: Request Expense Split */}
      <Modal
        visible={showRequestSplitModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRequestSplitModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowRequestSplitModal(false)}
          />
          <View
            style={[
              styles.modalSheet,
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
              ]}
            />
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
              <Text style={styles.modalPrimaryBtnText}>Send Split Request</Text>
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
          </View>
        </View>
      </Modal>

      {/* QUICK CIRCLE MODAL 3: Scan QR Ph Code */}
      <Modal
        visible={showScanQrModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowScanQrModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowScanQrModal(false)}
          />
          <View
            style={[
              styles.modalSheet,
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
              ]}
            />
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View>
                <Text
                  style={[
                    styles.modalTitle,
                    { color: isDark ? colors.text : "#0F172A" },
                  ]}
                >
                  Scan QR Ph Code
                </Text>
                <Text
                  style={[
                    styles.modalSubtitle,
                    { color: isDark ? colors.textMuted : "#64748B" },
                  ]}
                >
                  Philippine National QR Standard for Instant Settlement
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: "#2563EB",
                  paddingHorizontal: 8,
                  paddingVertical: 4,
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
                  QR Ph
                </Text>
              </View>
            </View>

            {/* Interactive Viewfinder Box */}
            <View
              style={{
                height: 200,
                backgroundColor: isDark ? "#0F172A" : "#020617",
                borderRadius: 18,
                marginVertical: 14,
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                overflow: "hidden",
                borderWidth: 2,
                borderColor: isQrScanned ? "#10B981" : "#3B82F6",
              }}
            >
              <Ionicons
                name={isQrScanned ? "checkmark-circle" : "scan-outline"}
                size={70}
                color={isQrScanned ? "#10B981" : "#60A5FA"}
              />
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 12,
                  fontWeight: "600",
                  marginTop: 8,
                }}
              >
                {isQrScanned
                  ? "QR Ph Code Detected: Roommate WiFi Split"
                  : "Point camera at any QR Ph merchant or roommate code"}
              </Text>
              {isQrScanned && (
                <Text
                  style={{
                    color: "#34D399",
                    fontSize: 16,
                    fontWeight: "800",
                    marginTop: 4,
                  }}
                >
                  Amount: ₱650.00
                </Text>
              )}
            </View>

            <TouchableOpacity
              style={styles.modalPrimaryBtn}
              onPress={() => {
                if (!isQrScanned) {
                  setIsQrScanned(true);
                } else {
                  setShowScanQrModal(false);
                  Alert.alert(
                    "QR Ph Payment Completed",
                    "₱650.00 transferred successfully to Roommate WiFi Split via your default card!",
                  );
                }
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isQrScanned ? "checkmark" : "camera"}
                size={18}
                color="#FFFFFF"
              />
              <Text style={styles.modalPrimaryBtnText}>
                {isQrScanned ? "Confirm & Pay ₱650.00" : "Simulate QR Ph Scan"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setShowScanQrModal(false)}
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
          </View>
        </View>
      </Modal>

      {/* QUICK CIRCLE MODAL 4: Spending Analytics */}
      <Modal
        visible={showAnalyticsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAnalyticsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowAnalyticsModal(false)}
          />
          <View
            style={[
              styles.modalSheet,
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
              ]}
            />
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
                      backgroundColor: isDark ? colors.surfaceInset : "#E2E8F0",
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
          </View>
        </View>
      </Modal>

      {/* QUICK CIRCLE MODAL 5: Card Limits & Security Controls */}
      <Modal
        visible={showLimitsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLimitsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowLimitsModal(false)}
          />
          <View
            style={[
              styles.modalSheet,
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
              ]}
            />
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
          </View>
        </View>
      </Modal>

      {/* MODAL 6: Splitzy Wallet Interactive Walkthrough */}
      <Modal
        visible={showWalkthroughModal}
        transparent
        animationType="slide"
        onRequestClose={() => handleFinishWalkthrough()}
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
                        + Cash In First Balance
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
                        + Add a Payment Card
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
                        + Create a Savings Pocket
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
    paddingBottom: 40,
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
    paddingHorizontal: 4,
  },
  quickCircleGrid: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  quickCircleItem: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  quickCircleBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
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
  pocketsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  pocketCard: {
    width: (SCREEN_WIDTH - 52) / 2,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
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
    paddingBottom: 36,
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
    backgroundColor: "#2563EB",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
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
});
