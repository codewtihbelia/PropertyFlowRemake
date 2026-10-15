import { doc, getDoc, setDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { db, auth } from "../firebase/config";

export type CardProviderType =
  | "cash"
  | "gcash"
  | "maya"
  | "bpi"
  | "bdo"
  | "unionbank"
  | "metrobank"
  | "landbank"
  | "gotyme"
  | "seabank"
  | "securitybank"
  | "rcbc"
  | "pnb"
  | "cimb"
  | "custom";

export interface CardProviderConfig {
  type: CardProviderType;
  name: string;
  shortCode: string;
  network: "Visa" | "Mastercard" | "BancNet" | "QR Ph" | "InstaPay" | "Cash";
  gradient: [string, string];
  accentColor: string;
  isEWallet: boolean;
}

export const PHILIPPINE_CARD_PRESETS: Record<
  CardProviderType,
  CardProviderConfig
> = {
  cash: {
    type: "cash",
    name: "Cash on Hand",
    shortCode: "CASH",
    network: "Cash",
    gradient: ["#064E3B", "#059669"],
    accentColor: "#34D399",
    isEWallet: false,
  },
  gcash: {
    type: "gcash",
    name: "GCash Wallet",
    shortCode: "GCash",
    network: "QR Ph",
    gradient: ["#005CE6", "#00A3FF"],
    accentColor: "#00E5FF",
    isEWallet: true,
  },
  maya: {
    type: "maya",
    name: "Maya Account",
    shortCode: "Maya",
    network: "Visa",
    gradient: ["#0B132B", "#059669"],
    accentColor: "#34D399",
    isEWallet: true,
  },
  bpi: {
    type: "bpi",
    name: "BPI Debit Card",
    shortCode: "BPI",
    network: "Mastercard",
    gradient: ["#881337", "#DC2626"],
    accentColor: "#FCA5A5",
    isEWallet: false,
  },
  bdo: {
    type: "bdo",
    name: "BDO Network Card",
    shortCode: "BDO",
    network: "Mastercard",
    gradient: ["#002B7F", "#1D4ED8"],
    accentColor: "#93C5FD",
    isEWallet: false,
  },
  unionbank: {
    type: "unionbank",
    name: "UnionBank Play",
    shortCode: "UBP",
    network: "Visa",
    gradient: ["#C2410C", "#F59E0B"],
    accentColor: "#FDE68A",
    isEWallet: false,
  },
  metrobank: {
    type: "metrobank",
    name: "Metrobank Prime",
    shortCode: "MBTC",
    network: "Mastercard",
    gradient: ["#1E3A8A", "#3B82F6"],
    accentColor: "#BFDBFE",
    isEWallet: false,
  },
  landbank: {
    type: "landbank",
    name: "Landbank Cash Card",
    shortCode: "LBP",
    network: "BancNet",
    gradient: ["#14532D", "#16A34A"],
    accentColor: "#86EFAC",
    isEWallet: false,
  },
  gotyme: {
    type: "gotyme",
    name: "GoTyme Visa Debit",
    shortCode: "GoTyme",
    network: "Visa",
    gradient: ["#115E59", "#14B8A6"],
    accentColor: "#5EEAD4",
    isEWallet: false,
  },
  seabank: {
    type: "seabank",
    name: "SeaBank Account",
    shortCode: "SeaBank",
    network: "InstaPay",
    gradient: ["#C2410C", "#FB923C"],
    accentColor: "#FED7AA",
    isEWallet: true,
  },
  securitybank: {
    type: "securitybank",
    name: "Security Bank Wave",
    shortCode: "SBC",
    network: "Mastercard",
    gradient: ["#0F766E", "#0284C7"],
    accentColor: "#7DD3FC",
    isEWallet: false,
  },
  rcbc: {
    type: "rcbc",
    name: "RCBC MyDebit",
    shortCode: "RCBC",
    network: "Mastercard",
    gradient: ["#1E40AF", "#60A5FA"],
    accentColor: "#DBEAFE",
    isEWallet: false,
  },
  pnb: {
    type: "pnb",
    name: "PNB Mabuhay Debit",
    shortCode: "PNB",
    network: "Mastercard",
    gradient: ["#0F172A", "#B45309"],
    accentColor: "#FDE68A",
    isEWallet: false,
  },
  cimb: {
    type: "cimb",
    name: "CIMB FastPlus",
    shortCode: "CIMB",
    network: "Visa",
    gradient: ["#831843", "#BE123C"],
    accentColor: "#FDA4AF",
    isEWallet: true,
  },
  custom: {
    type: "custom",
    name: "Custom Card",
    shortCode: "CARD",
    network: "BancNet",
    gradient: ["#334155", "#0F172A"],
    accentColor: "#CBD5E1",
    isEWallet: false,
  },
};

export interface PaymentCard {
  id: string;
  type: CardProviderType;
  name: string;
  accountNumber: string; // e.g. "•••• 8421" or "0917 ••• 8821"
  cardholderName: string;
  colorGradient: [string, string];
  isDefault: boolean;
  expiry?: string;
  createdAt: string;
  balance: number;
  initialBalance?: number;
  shortCode?: string;
}

export interface SavingsPocket {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  color: string;
  icon: string;
  category: "emergency" | "travel" | "bills" | "deposit" | "personal";
  createdAt: string;
  initialAmount?: number;
}

export type WalletTransactionType =
  | "cash_in"
  | "bill_payment"
  | "debt_settlement"
  | "expense_share"
  | "savings_deposit"
  | "savings_withdrawal"
  | "expense_simulation"
  | "card_transfer"
  | "cash_expense";

export interface CashAutomationRule {
  id: string;
  title: string;
  amount: number;
  category: "commute" | "food" | "groceries" | "snack" | "other";
  enabled: boolean;
  frequency: "daily" | "weekdays" | "custom";
}

export const DEFAULT_CASH_RULES: CashAutomationRule[] = [
  {
    id: "rule_commute",
    title: "Daily Commute & Fare (Jeepney/Tricycle)",
    amount: 50,
    category: "commute",
    enabled: true,
    frequency: "weekdays",
  },
  {
    id: "rule_lunch",
    title: "Daily Karinderya / Lunch Cash",
    amount: 120,
    category: "food",
    enabled: true,
    frequency: "daily",
  },
  {
    id: "rule_sarisari",
    title: "Sari-sari Store Snacks & Drinks",
    amount: 45,
    category: "snack",
    enabled: true,
    frequency: "daily",
  },
];

export interface WalletTransaction {
  id: string;
  type: WalletTransactionType;
  amount: number;
  title: string;
  description: string;
  paymentMethodUsed: string;
  referenceId?: string;
  timestamp: string;
  status: "completed" | "pending" | "failed";
  note?: string;
  icon?: string;
  category?: string;
  source?: string;
}

export interface WalletState {
  userId: string;
  balance: number;
  currency: "PHP";
  cards: PaymentCard[];
  pockets: SavingsPocket[];
  transactions: WalletTransaction[];
  updatedAt: string;
}

const WALLET_STORAGE_KEY_PREFIX = "@splitzy_wallet_state_";
const WALLET_WALKTHROUGH_KEY_PREFIX = "@splitzy_wallet_walkthrough_v1_";

export const DEFAULT_PRESET_CARDS: PaymentCard[] = [];
export const DEFAULT_PRESET_POCKETS: SavingsPocket[] = [];
export const DEFAULT_INITIAL_TRANSACTIONS: WalletTransaction[] = [];

function buildDefaultWallet(userId: string): WalletState {
  return {
    userId,
    balance: 0,
    currency: "PHP",
    cards: [],
    pockets: [],
    transactions: [],
    updatedAt: new Date().toISOString(),
  };
}

function isLegacyDemoWallet(state: any): boolean {
  if (!state) return false;
  const hasDemoCard =
    Array.isArray(state.cards) &&
    state.cards.some(
      (c: any) =>
        c.id === "card_gcash_default" ||
        c.id === "card_bpi_default" ||
        c.id === "card_maya_default",
    );
  const hasDemoPocket =
    Array.isArray(state.pockets) &&
    state.pockets.some(
      (p: any) => p.id === "pocket_emergency" || p.id === "pocket_trip",
    );
  const hasDemoTx =
    Array.isArray(state.transactions) &&
    state.transactions.some(
      (t: any) => t.id === "tx_init_cashin" || t.id === "tx_init_pocket",
    );
  return Boolean(
    (state.balance === 5450 && hasDemoCard) ||
    (hasDemoCard && hasDemoPocket) ||
    hasDemoTx,
  );
}

function sanitizeForFirestore<T>(val: T): T {
  if (val === null || val === undefined) {
    return null as unknown as T;
  }
  if (Array.isArray(val)) {
    return val.map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  if (typeof val === "object" && val !== null) {
    const copy: any = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        copy[k] = sanitizeForFirestore(v);
      }
    }
    return copy;
  }
  return val;
}

function isCardMatchTx(
  tx: WalletTransaction,
  card: PaymentCard,
  isDefaultCard: boolean = false,
): boolean {
  if (!tx || !card) return false;

  // 1. Direct referenceId match: if referenceId specifies a card ID, check if it matches this card
  if (
    tx.referenceId &&
    (tx.referenceId === card.id ||
      tx.referenceId.startsWith(card.id) ||
      tx.referenceId.includes(card.id))
  ) {
    return true;
  }

  // If the transaction referenceId points to another card ID or explicit card reference,
  // then this transaction explicitly belongs to another card! It must NEVER match this card or default fallback.
  if (
    tx.referenceId &&
    tx.referenceId !== card.id &&
    !tx.referenceId.startsWith(card.id) &&
    !tx.referenceId.includes(card.id) &&
    (tx.referenceId.startsWith("card_") ||
      tx.type === "expense_simulation" ||
      tx.type === "cash_expense")
  ) {
    return false;
  }

  // Expense simulations are strictly card-specific: NEVER match default card or unintended cards
  if (tx.type === "expense_simulation") {
    if (tx.referenceId === card.id) return true;
    if (tx.paymentMethodUsed) {
      const p = tx.paymentMethodUsed.toLowerCase().trim();
      const c = card.name.toLowerCase().trim();
      return p === c || p.includes(c) || c.includes(p);
    }
    return false;
  }

  // 2. Direct paymentMethodUsed match
  if (tx.paymentMethodUsed) {
    const p = tx.paymentMethodUsed.toLowerCase().trim();
    const c = card.name.toLowerCase().trim();
    if (p === c || p.includes(c) || c.includes(p)) return true;
    const cardShortCode =
      card.shortCode ||
      (card.type && PHILIPPINE_CARD_PRESETS[card.type]
        ? PHILIPPINE_CARD_PRESETS[card.type].shortCode
        : undefined);
    if (cardShortCode && p.includes(cardShortCode.toLowerCase())) return true;
    if (
      card.type &&
      (p.includes(card.type.toLowerCase()) ||
        card.type.toLowerCase().includes(p))
    ) {
      return true;
    }
    // General Splitzy Wallet payments, settlements or top-ups default to the primary card
    if (
      (p === "splitzy wallet" ||
        p === "wallet" ||
        p === "default card" ||
        p === "primary card" ||
        p === "digital cash") &&
      isDefaultCard
    ) {
      return true;
    }
    if (
      (p === "cash on hand" || p === "cash") &&
      (card.type === "cash" ||
        card.id === "card_cash_hand" ||
        card.name.toLowerCase().includes("cash"))
    ) {
      return true;
    }
  }

  // 3. Cash expenses should only match cash cards
  if (
    tx.type === "cash_expense" &&
    (card.type === "cash" ||
      card.id === "card_cash_hand" ||
      card.name.toLowerCase().includes("cash"))
  ) {
    return true;
  }

  // 4. Default fallback: only for generic, untargeted transactions (NEVER expense_simulation which is always card-specific)
  if (
    isDefaultCard &&
    !tx.referenceId?.startsWith("card_") &&
    (!tx.paymentMethodUsed ||
      tx.paymentMethodUsed.toLowerCase() === "splitzy wallet" ||
      tx.paymentMethodUsed.toLowerCase() === "wallet" ||
      tx.paymentMethodUsed.toLowerCase() === "default card" ||
      tx.paymentMethodUsed.toLowerCase() === "primary card") &&
    (tx.type === "cash_in" ||
      tx.type === "debt_settlement" ||
      tx.type === "bill_payment")
  ) {
    return true;
  }
  return false;
}

function calculateCardDeltaForTxs(
  txs: WalletTransaction[],
  card: PaymentCard,
  isDefaultCard: boolean = false,
): number {
  let delta = 0;
  for (const tx of txs) {
    const isCardMatch = isCardMatchTx(tx, card, isDefaultCard);
    if (tx.type === "cash_in") {
      if (isCardMatch) delta += tx.amount;
    } else if (
      tx.type === "expense_simulation" ||
      tx.type === "cash_expense" ||
      tx.type === "bill_payment"
    ) {
      if (isCardMatch) delta -= tx.amount;
    } else if (tx.type === "debt_settlement") {
      if (
        isCardMatch ||
        (tx.paymentMethodUsed === "Splitzy Wallet" && isDefaultCard)
      ) {
        delta -= tx.amount;
      }
    } else if (tx.type === "savings_deposit") {
      if (
        tx.paymentMethodUsed === card.name ||
        (tx.referenceId && tx.referenceId.startsWith(card.id)) ||
        (tx.paymentMethodUsed === "Splitzy Wallet" && isDefaultCard)
      ) {
        delta -= tx.amount;
      }
    } else if (tx.type === "savings_withdrawal") {
      if (
        tx.paymentMethodUsed === card.name ||
        (tx.referenceId && tx.referenceId.endsWith(card.id)) ||
        (tx.paymentMethodUsed === "Splitzy Wallet" && isDefaultCard)
      ) {
        delta += tx.amount;
      }
    } else if (tx.type === "card_transfer") {
      if (tx.referenceId && tx.referenceId.includes("->")) {
        const [fromId, toId] = tx.referenceId.split("->");
        if (fromId === card.id) delta -= tx.amount;
        if (toId === card.id) delta += tx.amount;
      } else if (tx.paymentMethodUsed && tx.paymentMethodUsed.includes("➔")) {
        const parts = tx.paymentMethodUsed.split("➔").map((s) => s.trim());
        if (parts[0] === card.name) delta -= tx.amount;
        if (parts[1] === card.name) delta += tx.amount;
      }
    }
  }
  return delta;
}

export function reconcileWalletState(
  state: WalletState,
  previousState?: WalletState | null,
): WalletState {
  if (!state) return state;

  const rawCards = Array.isArray(state.cards) ? state.cards : [];
  const rawPockets = Array.isArray(state.pockets) ? state.pockets : [];
  const rawTransactions = (
    Array.isArray(state.transactions) ? state.transactions : []
  ).map((tx) => {
    if (!tx) return tx;
    if (tx.source && !tx.note) {
      return { ...tx, note: tx.source };
    }
    // Preserve note from description if note was not explicitly saved
    if (
      !tx.note &&
      tx.description &&
      !tx.description.startsWith("Daily simulated expense") &&
      !tx.description.startsWith("Added ₱") &&
      !tx.description.startsWith("Transferred ₱")
    ) {
      return { ...tx, note: tx.description };
    }
    return tx;
  });

  // Filter completed or valid non-failed transactions
  const effectiveTxs = rawTransactions.filter(
    (tx) =>
      tx &&
      typeof tx.amount === "number" &&
      !isNaN(tx.amount) &&
      tx.status !== "failed",
  );

  // Detect manually deleted transactions in Firebase Cloud
  const previousTxs = Array.isArray(previousState?.transactions)
    ? previousState.transactions.filter(
        (pt) =>
          pt &&
          typeof pt.amount === "number" &&
          !isNaN(pt.amount) &&
          pt.status !== "failed",
      )
    : [];

  const currentTxIdSet = new Set(effectiveTxs.map((t) => t.id));
  const deletedTxs = previousTxs.filter((pt) => !currentTxIdSet.has(pt.id));

  // 1. Reconcile Savings Pockets
  const updatedPockets = rawPockets.map((pocket) => {
    const prevPocket = previousState?.pockets?.find((p) => p.id === pocket.id);
    let pocketDelta = 0;
    for (const tx of effectiveTxs) {
      if (tx.type === "savings_deposit" && tx.referenceId === pocket.id) {
        pocketDelta += tx.amount;
      } else if (
        tx.type === "savings_withdrawal" &&
        tx.referenceId === pocket.id
      ) {
        pocketDelta -= tx.amount;
      }
    }

    let initialPocket: number;
    if (typeof pocket.initialAmount === "number") {
      initialPocket = pocket.initialAmount;
    } else if (typeof prevPocket?.initialAmount === "number") {
      initialPocket = prevPocket.initialAmount;
    } else if (
      deletedTxs.length > 0 &&
      typeof prevPocket?.currentAmount === "number"
    ) {
      let deletedPocketDelta = 0;
      for (const dtx of deletedTxs) {
        if (dtx.type === "savings_deposit" && dtx.referenceId === pocket.id) {
          deletedPocketDelta += dtx.amount;
        } else if (
          dtx.type === "savings_withdrawal" &&
          dtx.referenceId === pocket.id
        ) {
          deletedPocketDelta -= dtx.amount;
        }
      }
      const adjustedPocketAmount = Math.max(
        0,
        prevPocket.currentAmount - deletedPocketDelta,
      );
      initialPocket = Math.max(0, adjustedPocketAmount - pocketDelta);
    } else if (
      previousTxs.length > 0 &&
      typeof prevPocket?.currentAmount === "number"
    ) {
      let prevPocketDelta = 0;
      for (const ptx of previousTxs) {
        if (ptx.type === "savings_deposit" && ptx.referenceId === pocket.id) {
          prevPocketDelta += ptx.amount;
        } else if (
          ptx.type === "savings_withdrawal" &&
          ptx.referenceId === pocket.id
        ) {
          prevPocketDelta -= ptx.amount;
        }
      }
      initialPocket = Math.max(0, prevPocket.currentAmount - prevPocketDelta);
    } else {
      initialPocket = Math.max(0, (pocket.currentAmount || 0) - pocketDelta);
    }

    const computedTarget = Math.max(0, initialPocket + pocketDelta);
    return {
      ...pocket,
      initialAmount: initialPocket,
      currentAmount: computedTarget,
    };
  });

  // 2. Reconcile Payment Cards with deterministic cloud deletion support
  const isSingleCard = rawCards.length === 1;
  const updatedCards = rawCards.map((card) => {
    const isDefault = Boolean(card.isDefault) || isSingleCard;
    const prevCard = previousState?.cards?.find((c) => c.id === card.id);
    const cardDelta = calculateCardDeltaForTxs(effectiveTxs, card, isDefault);

    let initialBase: number;
    if (typeof card.initialBalance === "number") {
      initialBase = card.initialBalance;
    } else if (typeof prevCard?.initialBalance === "number") {
      initialBase = prevCard.initialBalance;
    } else if (deletedTxs.length > 0 && typeof prevCard?.balance === "number") {
      // Revert the net impact of the deleted transactions on this card
      const deletedDelta = calculateCardDeltaForTxs(
        deletedTxs,
        card,
        isDefault,
      );
      const adjustedBal = Math.max(0, prevCard.balance - deletedDelta);
      initialBase = Math.max(0, adjustedBal - cardDelta);
    } else if (
      previousTxs.length > 0 &&
      typeof prevCard?.balance === "number"
    ) {
      const prevDelta = calculateCardDeltaForTxs(previousTxs, card, isDefault);
      initialBase = Math.max(0, prevCard.balance - prevDelta);
    } else {
      initialBase = Math.max(0, (card.balance || 0) - cardDelta);
    }

    const computedBal = Math.max(0, initialBase + cardDelta);
    return {
      ...card,
      initialBalance: initialBase,
      balance: computedBal,
    };
  });

  const totalBalance =
    updatedCards.length > 0
      ? updatedCards.reduce((acc, c) => acc + (c.balance || 0), 0)
      : effectiveTxs.reduce((acc, tx) => {
          if (tx.type === "cash_in") return acc + tx.amount;
          if (
            tx.type === "expense_simulation" ||
            tx.type === "cash_expense" ||
            tx.type === "bill_payment" ||
            tx.type === "debt_settlement"
          )
            return Math.max(0, acc - tx.amount);
          return acc;
        }, 0);

  return {
    ...state,
    cards: updatedCards,
    pockets: updatedPockets,
    transactions: rawTransactions,
    balance: totalBalance,
    updatedAt: state.updatedAt || new Date().toISOString(),
  };
}

class WalletService {
  private userDocRef(userId: string) {
    return doc(db, "users", userId);
  }

  async isWalkthroughCompleted(userId: string): Promise<boolean> {
    const effectiveUid =
      !userId || userId === "guest" ? auth.currentUser?.uid || "guest" : userId;
    try {
      const val = await AsyncStorage.getItem(
        WALLET_WALKTHROUGH_KEY_PREFIX + effectiveUid,
      );
      return val === "true";
    } catch {
      return false;
    }
  }

  async setWalkthroughCompleted(
    userId: string,
    completed: boolean = true,
  ): Promise<void> {
    const effectiveUid =
      !userId || userId === "guest" ? auth.currentUser?.uid || "guest" : userId;
    try {
      await AsyncStorage.setItem(
        WALLET_WALKTHROUGH_KEY_PREFIX + effectiveUid,
        completed ? "true" : "false",
      );
    } catch {}
  }

  private async getLocalWallet(userId: string): Promise<WalletState> {
    try {
      const cached = await AsyncStorage.getItem(
        WALLET_STORAGE_KEY_PREFIX + userId,
      );
      if (cached) {
        const parsed = JSON.parse(cached);
        if (!isLegacyDemoWallet(parsed)) {
          return parsed;
        }
      }
    } catch {}
    const initial = buildDefaultWallet(userId);
    try {
      await AsyncStorage.setItem(
        WALLET_STORAGE_KEY_PREFIX + userId,
        JSON.stringify(initial),
      );
    } catch {}
    return initial;
  }

  async getWallet(userId: string): Promise<WalletState> {
    const effectiveUid =
      !userId || userId === "guest" ? auth.currentUser?.uid || "guest" : userId;

    // 1. Load local cache first
    let cached: WalletState | null = null;
    try {
      const cachedStr = await AsyncStorage.getItem(
        WALLET_STORAGE_KEY_PREFIX + effectiveUid,
      );
      if (cachedStr) {
        const parsed = JSON.parse(cachedStr);
        if (!isLegacyDemoWallet(parsed)) {
          cached = parsed;
        }
      }
    } catch {}

    const targetUid =
      auth.currentUser?.uid || (effectiveUid !== "guest" ? effectiveUid : null);

    if (!targetUid || targetUid === "guest") {
      return cached || (await this.getLocalWallet(effectiveUid));
    }

    // 2. Fetch from cloud: inspect BOTH subcollection (/users/{uid}/wallet/current)
    // and root user doc (users/{uid}.walletState) to capture manual cloud console edits
    let subData: WalletState | null = null;
    let userDataState: WalletState | null = null;

    try {
      const subSnap = await getDoc(
        doc(db, "users", targetUid, "wallet", "current"),
      );
      if (subSnap.exists()) {
        const data = subSnap.data() as WalletState;
        if (data && !isLegacyDemoWallet(data)) {
          subData = data;
        }
      }
    } catch (e) {
      console.warn("[WalletService] subDoc fetch notice:", e);
    }

    try {
      const snap = await getDoc(this.userDocRef(targetUid));
      if (snap.exists()) {
        const userData = snap.data();
        if (
          userData?.walletState &&
          !isLegacyDemoWallet(userData.walletState)
        ) {
          userDataState = userData.walletState as WalletState;
        }
      }
    } catch (e) {
      console.warn("[WalletService] userDoc fetch notice:", e);
    }

    // Determine the authoritative cloud state:
    // If a developer or user manually deleted transactions in one document,
    // that document will have fewer transactions or a newer update.
    let remoteState: WalletState | null = null;
    if (subData && userDataState) {
      const subTxs = Array.isArray(subData.transactions)
        ? subData.transactions.length
        : 0;
      const userTxs = Array.isArray(userDataState.transactions)
        ? userDataState.transactions.length
        : 0;

      if (userTxs < subTxs) {
        remoteState = userDataState;
      } else if (subTxs < userTxs) {
        remoteState = subData;
      } else {
        const subTime = new Date(subData.updatedAt || 0).getTime();
        const userTime = new Date(userDataState.updatedAt || 0).getTime();
        remoteState = userTime >= subTime ? userDataState : subData;
      }
    } else {
      remoteState = subData || userDataState;
    }

    // 3. Smart reconcile: use authoritative cloud state as source of truth
    if (remoteState) {
      const synchronized = reconcileWalletState(remoteState, cached);

      await AsyncStorage.setItem(
        WALLET_STORAGE_KEY_PREFIX + effectiveUid,
        JSON.stringify(synchronized),
      ).catch(() => {});

      // Mirror reconciled state to both cloud destinations
      await this.persist(targetUid, synchronized).catch(() => {});
      return synchronized;
    }

    if (cached) {
      const synchronized = reconcileWalletState(cached);
      await this.persist(targetUid, synchronized);
      return synchronized;
    }

    // 4. Clean empty wallet default
    const initial = buildDefaultWallet(targetUid);
    await this.persist(targetUid, initial);
    return initial;
  }

  async resetWalletToEmpty(userId: string): Promise<WalletState> {
    const emptyState = buildDefaultWallet(userId);
    await this.persist(userId, emptyState);
    return emptyState;
  }

  async deleteWallet(userId: string): Promise<WalletState> {
    const effectiveUid =
      !userId || userId === "guest" ? auth.currentUser?.uid || "guest" : userId;

    const targetUid =
      auth.currentUser?.uid || (effectiveUid !== "guest" ? effectiveUid : null);

    const emptyState = buildDefaultWallet(effectiveUid);

    // 1. Clear local storage cache
    try {
      await AsyncStorage.removeItem(WALLET_STORAGE_KEY_PREFIX + effectiveUid);
      await AsyncStorage.setItem(
        WALLET_STORAGE_KEY_PREFIX + effectiveUid,
        JSON.stringify(emptyState),
      );
    } catch {}

    // 2. Delete cloud document /users/{uid}/wallet/current
    if (targetUid && targetUid !== "guest") {
      try {
        await deleteDoc(doc(db, "users", targetUid, "wallet", "current"));
      } catch (e) {
        console.warn("[WalletService] deleteDoc /wallet/current notice:", e);
      }

      // 3. Clear userDoc.walletState
      try {
        await setDoc(
          this.userDocRef(targetUid),
          { walletState: null },
          { merge: true },
        );
      } catch (e) {
        console.warn("[WalletService] reset userDoc.walletState notice:", e);
      }
    }

    return emptyState;
  }

  listenToWallet(
    userId: string,
    callback: (wallet: WalletState) => void,
  ): () => void {
    const effectiveUid =
      !userId || userId === "guest" ? auth.currentUser?.uid || "guest" : userId;

    let lastKnownState: WalletState | null = null;

    // Deliver cached state immediately
    this.getLocalWallet(effectiveUid).then((cached) => {
      lastKnownState = cached;
      callback(cached);
    });

    const targetUid =
      auth.currentUser?.uid || (effectiveUid !== "guest" ? effectiveUid : null);

    if (!targetUid || targetUid === "guest") {
      return () => {};
    }

    let unsubSub: (() => void) | null = null;
    let unsubUser: (() => void) | null = null;

    try {
      unsubSub = onSnapshot(
        doc(db, "users", targetUid, "wallet", "current"),
        async (snap) => {
          if (snap.exists()) {
            const data = snap.data() as WalletState;
            if (data && !isLegacyDemoWallet(data)) {
              const synchronized = reconcileWalletState(data, lastKnownState);
              lastKnownState = synchronized;

              AsyncStorage.setItem(
                WALLET_STORAGE_KEY_PREFIX + effectiveUid,
                JSON.stringify(synchronized),
              ).catch(() => {});
              callback(synchronized);

              // Detect if Firebase had transactions manually deleted or balance altered
              const cardBalancesDiffer = (data.cards || []).some((c: any) => {
                const match = synchronized.cards.find((sc) => sc.id === c.id);
                return match && match.balance !== c.balance;
              });
              const pocketsDiffer = (data.pockets || []).some((p: any) => {
                const match = synchronized.pockets.find((sp) => sp.id === p.id);
                return match && match.currentAmount !== p.currentAmount;
              });
              if (
                cardBalancesDiffer ||
                pocketsDiffer ||
                synchronized.balance !== data.balance ||
                (data.transactions || []).length !==
                  synchronized.transactions.length
              ) {
                this.persist(targetUid, synchronized).catch(() => {});
              }
            }
          } else {
            // When document is deleted in Firestore cloud, immediately sync empty wallet
            const empty = buildDefaultWallet(targetUid);
            lastKnownState = empty;
            AsyncStorage.setItem(
              WALLET_STORAGE_KEY_PREFIX + effectiveUid,
              JSON.stringify(empty),
            ).catch(() => {});
            callback(empty);
          }
        },
        (error) => {
          console.warn("[WalletService] onSnapshot error:", error);
        },
      );
    } catch {}

    try {
      unsubUser = onSnapshot(
        this.userDocRef(targetUid),
        async (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (data?.walletState) {
              const remote = data.walletState as WalletState;
              if (isLegacyDemoWallet(remote)) {
                this.resetWalletToEmpty(targetUid).then(callback);
                return;
              }

              const synchronized = reconcileWalletState(remote, lastKnownState);
              lastKnownState = synchronized;

              AsyncStorage.setItem(
                WALLET_STORAGE_KEY_PREFIX + effectiveUid,
                JSON.stringify(synchronized),
              ).catch(() => {});
              callback(synchronized);

              const cardBalancesDiffer = (remote.cards || []).some((c: any) => {
                const match = synchronized.cards.find((sc) => sc.id === c.id);
                return match && match.balance !== c.balance;
              });
              const pocketsDiffer = (remote.pockets || []).some((p: any) => {
                const match = synchronized.pockets.find((sp) => sp.id === p.id);
                return match && match.currentAmount !== p.currentAmount;
              });
              if (
                cardBalancesDiffer ||
                pocketsDiffer ||
                synchronized.balance !== remote.balance ||
                (remote.transactions || []).length !==
                  synchronized.transactions.length
              ) {
                this.persist(targetUid, synchronized).catch(() => {});
              }
            } else if (
              data &&
              (data.walletState === null || data.walletState === undefined)
            ) {
              // Cloud explicitly set walletState to null or removed the field
              const empty = buildDefaultWallet(targetUid);
              lastKnownState = empty;
              AsyncStorage.setItem(
                WALLET_STORAGE_KEY_PREFIX + effectiveUid,
                JSON.stringify(empty),
              ).catch(() => {});
              callback(empty);
            }
          } else {
            // User document deleted in cloud console
            const empty = buildDefaultWallet(targetUid);
            lastKnownState = empty;
            AsyncStorage.setItem(
              WALLET_STORAGE_KEY_PREFIX + effectiveUid,
              JSON.stringify(empty),
            ).catch(() => {});
            callback(empty);
          }
        },
        () => {},
      );
    } catch {}

    return () => {
      if (unsubSub) unsubSub();
      if (unsubUser) unsubUser();
    };
  }

  private deductFromCards(cards: PaymentCard[], amount: number): PaymentCard[] {
    let remaining = amount;
    // Prefer deducting from default card first
    const defaultIdx = cards.findIndex((c) => c.isDefault);
    const order =
      defaultIdx >= 0
        ? [
            defaultIdx,
            ...cards.map((_, i) => i).filter((i) => i !== defaultIdx),
          ]
        : cards.map((_, i) => i);

    const updated = [...cards];
    for (const idx of order) {
      if (remaining <= 0) break;
      const c = updated[idx];
      const curBal = c.balance || 0;
      const take = Math.min(curBal, remaining);
      updated[idx] = { ...c, balance: curBal - take };
      remaining -= take;
    }
    return updated;
  }

  async cashIn(
    userId: string,
    amount: number,
    cardIdOrMethod: string = "GCash",
    source?: string,
  ): Promise<WalletState> {
    const current = await this.getWallet(userId);

    // Find target card if any
    let targetCard = current.cards.find(
      (c) =>
        c.id === cardIdOrMethod ||
        c.name.toLowerCase() === cardIdOrMethod.toLowerCase(),
    );
    if (!targetCard && current.cards.length > 0) {
      targetCard = current.cards.find((c) => c.isDefault) || current.cards[0];
    }

    const updatedCards = current.cards.map((c) => {
      if (targetCard && c.id === targetCard.id) {
        return {
          ...c,
          balance: (c.balance || 0) + amount,
          initialBalance:
            typeof c.initialBalance === "number"
              ? c.initialBalance
              : c.balance || 0,
        };
      }
      return c;
    });

    const displayMethod = targetCard ? targetCard.name : cardIdOrMethod;
    const newTotalBalance =
      updatedCards.length > 0
        ? updatedCards.reduce((acc, c) => acc + (c.balance || 0), 0)
        : current.balance + amount;

    const sourceTrimmed = source?.trim() || "";
    const newTx: WalletTransaction = {
      id: "tx_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      type: "cash_in",
      amount,
      title: sourceTrimmed
        ? `Top-up: ${sourceTrimmed}`
        : `Top-up via ${displayMethod}`,
      description: sourceTrimmed
        ? `Added ₱${amount.toLocaleString()} from ${sourceTrimmed} to ${displayMethod}`
        : `Added ₱${amount.toLocaleString()} to ${displayMethod}`,
      paymentMethodUsed: displayMethod,
      referenceId: targetCard?.id || "",
      timestamp: new Date().toISOString(),
      status: "completed",
      source: sourceTrimmed || undefined,
      note: sourceTrimmed || undefined,
    };

    const updated: WalletState = {
      ...current,
      balance: newTotalBalance,
      cards: updatedCards,
      transactions: [newTx, ...current.transactions],
      updatedAt: new Date().toISOString(),
    };

    const reconciled = reconcileWalletState(updated);
    await this.persist(userId, reconciled);
    return reconciled;
  }

  async deductForDebtSettlement(
    userId: string,
    amount: number,
    recipientName: string,
    debtId?: string,
    methodName: string = "Splitzy Wallet",
  ): Promise<{ success: boolean; updatedState: WalletState; message: string }> {
    const current = await this.getWallet(userId);

    if (methodName === "Splitzy Wallet" && current.balance < amount) {
      return {
        success: false,
        updatedState: current,
        message: `Insufficient wallet balance (₱${current.balance.toLocaleString()} available). Please top up or choose a linked card.`,
      };
    }

    const newTx: WalletTransaction = {
      id: "tx_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      type: "debt_settlement",
      amount,
      title: `Settled with ${recipientName}`,
      description: `Roommate expense balance cleared`,
      paymentMethodUsed: methodName,
      referenceId: debtId || "",
      timestamp: new Date().toISOString(),
      status: "completed",
    };

    let updatedCards = current.cards;
    let newBalance = current.balance;

    if (methodName === "Splitzy Wallet") {
      updatedCards = this.deductFromCards(current.cards, amount);
      newBalance =
        updatedCards.length > 0
          ? updatedCards.reduce((acc, c) => acc + (c.balance || 0), 0)
          : Math.max(0, current.balance - amount);
    }

    const updated: WalletState = {
      ...current,
      balance: newBalance,
      cards: updatedCards,
      transactions: [newTx, ...current.transactions],
      updatedAt: new Date().toISOString(),
    };

    await this.persist(userId, updated);
    return {
      success: true,
      updatedState: updated,
      message: `Successfully sent ₱${amount.toLocaleString()} to ${recipientName}!`,
    };
  }

  async addPaymentCard(
    userId: string,
    card: Omit<PaymentCard, "id" | "createdAt">,
  ): Promise<WalletState> {
    const current = await this.getWallet(userId);
    const cardBal =
      card.balance !== undefined && !isNaN(Number(card.balance))
        ? Math.max(0, Number(card.balance))
        : 0;

    const newCard: PaymentCard = {
      ...card,
      balance: cardBal,
      initialBalance: cardBal,
      expiry: card.expiry || "",
      id: "card_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      createdAt: new Date().toISOString(),
    };

    const cards = current.cards.map((c) =>
      newCard.isDefault ? { ...c, isDefault: false } : c,
    );
    const updatedCards = [newCard, ...cards];
    const newTotalBalance = updatedCards.reduce(
      (acc, c) => acc + (c.balance || 0),
      0,
    );

    const updated: WalletState = {
      ...current,
      balance: newTotalBalance,
      cards: updatedCards,
      updatedAt: new Date().toISOString(),
    };

    await this.persist(userId, updated);
    return updated;
  }

  async deletePaymentCard(
    userId: string,
    cardId: string,
  ): Promise<WalletState> {
    const current = await this.getWallet(userId);
    const remaining = current.cards.filter((c) => c.id !== cardId);

    if (remaining.length > 0 && !remaining.some((c) => c.isDefault)) {
      remaining[0].isDefault = true;
    }
    const newTotalBalance = remaining.reduce(
      (acc, c) => acc + (c.balance || 0),
      0,
    );

    const updated: WalletState = {
      ...current,
      balance: newTotalBalance,
      cards: remaining,
      updatedAt: new Date().toISOString(),
    };

    await this.persist(userId, updated);
    return updated;
  }

  async setDefaultCard(userId: string, cardId: string): Promise<WalletState> {
    const current = await this.getWallet(userId);
    const updatedCards = current.cards.map((c) => ({
      ...c,
      isDefault: c.id === cardId,
    }));

    const updated: WalletState = {
      ...current,
      cards: updatedCards,
      updatedAt: new Date().toISOString(),
    };

    await this.persist(userId, updated);
    return updated;
  }

  async createSavingsPocket(
    userId: string,
    pocket: Omit<SavingsPocket, "id" | "createdAt">,
  ): Promise<WalletState> {
    const current = await this.getWallet(userId);
    const newPocket: SavingsPocket = {
      ...pocket,
      id:
        "pocket_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      createdAt: new Date().toISOString(),
    };

    const updated: WalletState = {
      ...current,
      pockets: [...current.pockets, newPocket],
      updatedAt: new Date().toISOString(),
    };

    await this.persist(userId, updated);
    return updated;
  }

  async depositToPocket(
    userId: string,
    pocketId: string,
    amount: number,
    sourceCardId?: string,
  ): Promise<{ success: boolean; updatedState: WalletState; message: string }> {
    const current = await this.getWallet(userId);
    const targetPocket = current.pockets.find((p) => p.id === pocketId);
    if (!targetPocket) {
      return {
        success: false,
        updatedState: current,
        message: "Savings pocket not found.",
      };
    }

    let updatedCards = current.cards;
    let paymentMethodName = "Splitzy Wallet";

    if (sourceCardId) {
      const sourceCard = current.cards.find((c) => c.id === sourceCardId);
      if (!sourceCard) {
        return {
          success: false,
          updatedState: current,
          message: "Selected payment card was not found.",
        };
      }
      const cardBal = sourceCard.balance || 0;
      if (cardBal < amount) {
        return {
          success: false,
          updatedState: current,
          message: `Insufficient balance on ${sourceCard.name} (₱${cardBal.toLocaleString()} available, needed ₱${amount.toLocaleString()}).`,
        };
      }
      updatedCards = current.cards.map((c) =>
        c.id === sourceCardId
          ? { ...c, balance: Math.max(0, (c.balance || 0) - amount) }
          : c,
      );
      paymentMethodName = sourceCard.name;
    } else {
      if (current.balance < amount) {
        return {
          success: false,
          updatedState: current,
          message: `Insufficient wallet balance to stash ₱${amount.toLocaleString()}. Please cash in first.`,
        };
      }
      updatedCards = this.deductFromCards(current.cards, amount);
    }

    const updatedPockets = current.pockets.map((p) =>
      p.id === pocketId ? { ...p, currentAmount: p.currentAmount + amount } : p,
    );

    const newBalance =
      updatedCards.length > 0
        ? updatedCards.reduce((acc, c) => acc + (c.balance || 0), 0)
        : Math.max(0, current.balance - amount);

    const newTx: WalletTransaction = {
      id: "tx_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      type: "savings_deposit",
      amount,
      title: `Saved to ${targetPocket.name}`,
      description: `Deducted from ${paymentMethodName} into "${targetPocket.name}"`,
      paymentMethodUsed: paymentMethodName,
      referenceId: pocketId,
      timestamp: new Date().toISOString(),
      status: "completed",
    };

    const updated: WalletState = {
      ...current,
      balance: newBalance,
      cards: updatedCards,
      pockets: updatedPockets,
      transactions: [newTx, ...current.transactions],
      updatedAt: new Date().toISOString(),
    };

    await this.persist(userId, updated);
    return {
      success: true,
      updatedState: updated,
      message: `Stashed ₱${amount.toLocaleString()} into "${targetPocket.name}" from ${paymentMethodName}!`,
    };
  }

  async withdrawFromPocket(
    userId: string,
    pocketId: string,
    amount: number,
    targetCardId?: string,
  ): Promise<{ success: boolean; updatedState: WalletState; message: string }> {
    const current = await this.getWallet(userId);
    const targetPocket = current.pockets.find((p) => p.id === pocketId);

    if (!targetPocket) {
      return {
        success: false,
        updatedState: current,
        message: "Savings pocket not found.",
      };
    }

    if (targetPocket.currentAmount < amount) {
      return {
        success: false,
        updatedState: current,
        message: `Pocket balance has only ₱${targetPocket.currentAmount.toLocaleString()}.`,
      };
    }

    const updatedPockets = current.pockets.map((p) =>
      p.id === pocketId
        ? { ...p, currentAmount: Math.max(0, p.currentAmount - amount) }
        : p,
    );

    let updatedCards = current.cards;
    let targetCardName = "Splitzy Wallet";

    if (targetCardId && updatedCards.some((c) => c.id === targetCardId)) {
      const chosen = updatedCards.find((c) => c.id === targetCardId)!;
      targetCardName = chosen.name;
      updatedCards = updatedCards.map((c) =>
        c.id === targetCardId
          ? { ...c, balance: (c.balance || 0) + amount }
          : c,
      );
    } else if (updatedCards.length > 0) {
      const defaultIdx = Math.max(
        0,
        updatedCards.findIndex((c) => c.isDefault),
      );
      targetCardName = updatedCards[defaultIdx].name;
      updatedCards = updatedCards.map((c, i) =>
        i === defaultIdx ? { ...c, balance: (c.balance || 0) + amount } : c,
      );
    }

    const newBalance =
      updatedCards.length > 0
        ? updatedCards.reduce((acc, c) => acc + (c.balance || 0), 0)
        : current.balance + amount;

    const newTx: WalletTransaction = {
      id: "tx_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      type: "savings_withdrawal",
      amount,
      title: `Withdrawn from ${targetPocket.name}`,
      description: `Transferred ₱${amount.toLocaleString()} into ${targetCardName}`,
      paymentMethodUsed: targetCardName,
      referenceId: pocketId,
      timestamp: new Date().toISOString(),
      status: "completed",
    };

    const updated: WalletState = {
      ...current,
      balance: newBalance,
      cards: updatedCards,
      pockets: updatedPockets,
      transactions: [newTx, ...current.transactions],
      updatedAt: new Date().toISOString(),
    };

    await this.persist(userId, updated);
    return {
      success: true,
      updatedState: updated,
      message: `Transferred ₱${amount.toLocaleString()} from "${targetPocket.name}" to ${targetCardName}!`,
    };
  }

  async simulateCardExpense(
    userId: string,
    cardId: string,
    amount: number,
    categoryTitle: string,
    categoryIcon: string,
    note?: string,
  ): Promise<{ success: boolean; updatedState: WalletState; message: string }> {
    const current = await this.getWallet(userId);
    const cardIndex = current.cards.findIndex((c) => c.id === cardId);
    if (cardIndex === -1) {
      return {
        success: false,
        updatedState: current,
        message: "Selected payment card was not found in your wallet.",
      };
    }

    const card = current.cards[cardIndex];
    const availableBal = card.balance || 0;
    if (availableBal < amount) {
      return {
        success: false,
        updatedState: current,
        message: `Insufficient balance on ${card.name}. You have ₱${availableBal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} available, but this expense is ₱${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
      };
    }

    const updatedCards = [...current.cards];
    updatedCards[cardIndex] = {
      ...card,
      balance: Math.max(0, availableBal - amount),
      initialBalance:
        typeof card.initialBalance === "number"
          ? card.initialBalance
          : availableBal,
    };

    const newTotalBalance = updatedCards.reduce(
      (acc, c) => acc + (c.balance || 0),
      0,
    );

    const finalNote = typeof note === "string" ? note.trim() : "";
    const newTx: WalletTransaction = {
      id: "tx_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      type: "expense_simulation",
      amount,
      title: categoryTitle,
      description:
        finalNote || `Daily simulated expense charged to ${card.name}`,
      paymentMethodUsed: card.name,
      referenceId: card.id,
      timestamp: new Date().toISOString(),
      status: "completed",
      note: finalNote || undefined,
      icon: categoryIcon || undefined,
      category: categoryTitle,
    };

    const updated: WalletState = {
      ...current,
      balance: newTotalBalance,
      cards: updatedCards,
      transactions: [newTx, ...current.transactions],
      updatedAt: new Date().toISOString(),
    };

    const reconciled = reconcileWalletState(updated, current);
    await this.persist(userId, reconciled);
    return {
      success: true,
      updatedState: reconciled,
      message: `Charged ₱${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} for ${categoryTitle} from ${card.name}!`,
    };
  }

  async deleteTransaction(
    userId: string,
    txId: string,
  ): Promise<{ success: boolean; updatedState: WalletState; message: string }> {
    const current = await this.getWallet(userId);
    const targetTx = current.transactions.find((t) => t.id === txId);
    if (!targetTx) {
      return {
        success: false,
        updatedState: current,
        message: "Transaction not found.",
      };
    }

    const remainingTxs = current.transactions.filter((t) => t.id !== txId);
    const updated: WalletState = {
      ...current,
      transactions: remainingTxs,
      updatedAt: new Date().toISOString(),
    };

    const reconciled = reconcileWalletState(updated, current);
    await this.persist(userId, reconciled);
    return {
      success: true,
      updatedState: reconciled,
      message: `Transaction deleted and balances automatically adjusted.`,
    };
  }

  async updateTransactionNote(
    userId: string,
    txId: string,
    newNote: string,
  ): Promise<{ success: boolean; updatedState: WalletState; message: string }> {
    const current = await this.getWallet(userId);
    const txIndex = current.transactions.findIndex((t) => t.id === txId);
    if (txIndex === -1) {
      return {
        success: false,
        updatedState: current,
        message: "Transaction not found.",
      };
    }

    const cleanNote = newNote.trim();
    const targetTx = current.transactions[txIndex];
    const updatedTx: WalletTransaction = {
      ...targetTx,
      note: cleanNote || undefined,
      description: cleanNote || targetTx.description,
    };

    const updatedTransactions = [...current.transactions];
    updatedTransactions[txIndex] = updatedTx;

    const updated: WalletState = {
      ...current,
      transactions: updatedTransactions,
      updatedAt: new Date().toISOString(),
    };

    const reconciled = reconcileWalletState(updated, current);
    await this.persist(userId, reconciled);
    return {
      success: true,
      updatedState: reconciled,
      message: "Expense note updated successfully!",
    };
  }

  async transferBetweenCards(
    userId: string,
    fromCardId: string,
    toCardId: string,
    amount: number,
    note?: string,
  ): Promise<{ success: boolean; updatedState: WalletState; message: string }> {
    const current = await this.getWallet(userId);

    if (fromCardId === toCardId) {
      return {
        success: false,
        updatedState: current,
        message: "Source card and destination card cannot be the same.",
      };
    }

    const fromIndex = current.cards.findIndex((c) => c.id === fromCardId);
    const toIndex = current.cards.findIndex((c) => c.id === toCardId);

    if (fromIndex === -1 || toIndex === -1) {
      return {
        success: false,
        updatedState: current,
        message:
          "One or both selected cards could not be found in your wallet.",
      };
    }

    const fromCard = current.cards[fromIndex];
    const toCard = current.cards[toIndex];
    const sourceBal = fromCard.balance || 0;

    if (sourceBal < amount) {
      return {
        success: false,
        updatedState: current,
        message: `Insufficient funds on ${fromCard.name}. Available: ₱${sourceBal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, requested: ₱${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
      };
    }

    const updatedCards = [...current.cards];
    updatedCards[fromIndex] = {
      ...fromCard,
      balance: Math.max(0, sourceBal - amount),
    };
    updatedCards[toIndex] = {
      ...toCard,
      balance: (toCard.balance || 0) + amount,
    };

    const newTotalBalance = updatedCards.reduce(
      (acc, c) => acc + (c.balance || 0),
      0,
    );

    const newTx: WalletTransaction = {
      id: "tx_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      type: "card_transfer",
      amount,
      title: `Transfer: ${fromCard.name} ➔ ${toCard.name}`,
      description:
        note && note.trim().length > 0
          ? note.trim()
          : `Internal card rebalance from ${fromCard.name} to ${toCard.name}`,
      paymentMethodUsed: `${fromCard.name} ➔ ${toCard.name}`,
      referenceId: `${fromCard.id}->${toCard.id}`,
      timestamp: new Date().toISOString(),
      status: "completed",
    };

    const updated: WalletState = {
      ...current,
      balance: newTotalBalance,
      cards: updatedCards,
      transactions: [newTx, ...current.transactions],
      updatedAt: new Date().toISOString(),
    };

    await this.persist(userId, updated);
    return {
      success: true,
      updatedState: updated,
      message: `Transferred ₱${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} from ${fromCard.name} to ${toCard.name}!`,
    };
  }

  async recordCashExpense(
    userId: string,
    cashCardId: string,
    amount: number,
    title: string,
    category: string = "Cash Expense",
    note?: string,
  ): Promise<{ success: boolean; updatedState: WalletState; message: string }> {
    const current = await this.getWallet(userId);
    const cardIndex = current.cards.findIndex((c) => c.id === cashCardId);

    if (cardIndex === -1) {
      return {
        success: false,
        updatedState: current,
        message: "Cash on Hand card was not found.",
      };
    }

    const cashCard = current.cards[cardIndex];
    const currentBal = cashCard.balance || 0;

    if (currentBal < amount) {
      return {
        success: false,
        updatedState: current,
        message: `Insufficient cash on hand. Available: ₱${currentBal.toLocaleString()}, requested: ₱${amount.toLocaleString()}.`,
      };
    }

    const updatedCards = [...current.cards];
    updatedCards[cardIndex] = {
      ...cashCard,
      balance: Math.max(0, currentBal - amount),
    };

    const newBalance = updatedCards.reduce(
      (acc, c) => acc + (c.balance || 0),
      0,
    );

    const newTx: WalletTransaction = {
      id: "tx_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      type: "cash_expense",
      amount,
      title,
      description: note || `Cash spent for ${category} • Cash on Hand`,
      paymentMethodUsed: cashCard.name,
      referenceId: cashCard.id,
      timestamp: new Date().toISOString(),
      status: "completed",
      note: note?.trim() || undefined,
      icon: "cash",
      category,
    };

    const updated: WalletState = {
      ...current,
      balance: newBalance,
      cards: updatedCards,
      transactions: [newTx, ...current.transactions],
      updatedAt: new Date().toISOString(),
    };

    await this.persist(userId, updated);
    return {
      success: true,
      updatedState: updated,
      message: `Recorded ₱${amount.toLocaleString()} cash expense for "${title}"!`,
    };
  }

  async runAutomatedCashExpenses(
    userId: string,
    cashCardId: string,
    rules: CashAutomationRule[],
  ): Promise<{
    success: boolean;
    updatedState: WalletState;
    executedCount: number;
    totalAmount: number;
    message: string;
  }> {
    const current = await this.getWallet(userId);
    const cardIndex = current.cards.findIndex((c) => c.id === cashCardId);

    if (cardIndex === -1) {
      return {
        success: false,
        updatedState: current,
        executedCount: 0,
        totalAmount: 0,
        message: "Cash on Hand card was not found.",
      };
    }

    const activeRules = rules.filter((r) => r.enabled && r.amount > 0);
    if (activeRules.length === 0) {
      return {
        success: false,
        updatedState: current,
        executedCount: 0,
        totalAmount: 0,
        message: "No active cash automation rules configured.",
      };
    }

    const totalNeeded = activeRules.reduce((acc, r) => acc + r.amount, 0);
    const cashCard = current.cards[cardIndex];
    const currentBal = cashCard.balance || 0;

    if (currentBal < totalNeeded) {
      return {
        success: false,
        updatedState: current,
        executedCount: 0,
        totalAmount: 0,
        message: `Insufficient cash on hand to run auto-expenses (₱${currentBal.toLocaleString()} available, ₱${totalNeeded.toLocaleString()} needed). Please replenish cash first.`,
      };
    }

    const now = new Date().toISOString();
    const newTxs: WalletTransaction[] = activeRules.map((rule) => ({
      id: "tx_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      type: "cash_expense",
      amount: rule.amount,
      title: `⚡ Auto: ${rule.title}`,
      description: `Automated daily ${rule.category} cash expense deducted from Cash on Hand`,
      paymentMethodUsed: cashCard.name,
      referenceId: rule.id,
      timestamp: now,
      status: "completed",
      note: rule.title,
      category: rule.category,
      icon:
        rule.category === "commute"
          ? "bus"
          : rule.category === "food"
            ? "restaurant"
            : "cash",
    }));

    const updatedCards = [...current.cards];
    updatedCards[cardIndex] = {
      ...cashCard,
      balance: Math.max(0, currentBal - totalNeeded),
    };

    const newBalance = updatedCards.reduce(
      (acc, c) => acc + (c.balance || 0),
      0,
    );

    const updated: WalletState = {
      ...current,
      balance: newBalance,
      cards: updatedCards,
      transactions: [...newTxs, ...current.transactions],
      updatedAt: now,
    };

    await this.persist(userId, updated);
    return {
      success: true,
      updatedState: updated,
      executedCount: activeRules.length,
      totalAmount: totalNeeded,
      message: `Automated ${activeRules.length} daily cash expenses totaling ₱${totalNeeded.toLocaleString()} successfully!`,
    };
  }

  async replenishCashFromCard(
    userId: string,
    cashCardId: string,
    sourceCardId: string,
    amount: number,
  ): Promise<{ success: boolean; updatedState: WalletState; message: string }> {
    return this.transferBetweenCards(
      userId,
      sourceCardId,
      cashCardId,
      amount,
      "ATM Cash Withdrawal / Replenish Cash on Hand",
    );
  }

  private async persist(userId: string, state: WalletState) {
    const effectiveUid =
      !userId || userId === "guest" ? auth.currentUser?.uid || "guest" : userId;

    // 1. Immediate local persistence
    try {
      await AsyncStorage.setItem(
        WALLET_STORAGE_KEY_PREFIX + effectiveUid,
        JSON.stringify(state),
      );
    } catch {}

    const targetUid =
      auth.currentUser?.uid || (effectiveUid !== "guest" ? effectiveUid : null);

    if (!targetUid || targetUid === "guest") return;

    const sanitized = sanitizeForFirestore(state);

    // 2. Persist to dedicated subcollection /users/{uid}/wallet/current
    try {
      await setDoc(
        doc(db, "users", targetUid, "wallet", "current"),
        sanitized,
        { merge: true },
      );
    } catch (err) {
      console.warn("[WalletService] setDoc /wallet/current error:", err);
    }

    // 3. Persist to users/{uid}.walletState
    try {
      await setDoc(
        this.userDocRef(targetUid),
        { walletState: sanitized },
        { merge: true },
      );
    } catch (err) {
      console.warn("[WalletService] setDoc userDoc error:", err);
    }
  }
}

export const walletService = new WalletService();
