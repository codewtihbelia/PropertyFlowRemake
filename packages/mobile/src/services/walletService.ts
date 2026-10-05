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
  status: "completed" | "pending";
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

    // 2. Fetch from cloud: check subcollection first, then user doc
    let remoteState: WalletState | null = null;
    try {
      const subSnap = await getDoc(
        doc(db, "users", targetUid, "wallet", "current"),
      );
      if (subSnap.exists()) {
        const data = subSnap.data() as WalletState;
        if (data && !isLegacyDemoWallet(data)) {
          remoteState = data;
        }
      }
    } catch (e) {
      console.warn("[WalletService] subDoc fetch notice:", e);
    }

    if (!remoteState) {
      try {
        const snap = await getDoc(this.userDocRef(targetUid));
        if (snap.exists()) {
          const userData = snap.data();
          if (
            userData?.walletState &&
            !isLegacyDemoWallet(userData.walletState)
          ) {
            remoteState = userData.walletState as WalletState;
          }
        }
      } catch (e) {
        console.warn("[WalletService] userDoc fetch notice:", e);
      }
    }

    // 3. Smart reconcile: use cloud state as source of truth
    if (remoteState) {
      const cards = (remoteState.cards || []).map((c: any) => ({
        ...c,
        balance: typeof c.balance === "number" ? c.balance : 0,
      }));
      const derivedBalance =
        cards.length > 0
          ? cards.reduce((acc, c) => acc + (c.balance || 0), 0)
          : typeof remoteState.balance === "number"
            ? remoteState.balance
            : 0;

      const synchronized: WalletState = {
        ...remoteState,
        cards,
        balance: derivedBalance,
      };

      await AsyncStorage.setItem(
        WALLET_STORAGE_KEY_PREFIX + effectiveUid,
        JSON.stringify(synchronized),
      ).catch(() => {});
      return synchronized;
    }

    if (cached) {
      const cards = (cached.cards || []).map((c: any) => ({
        ...c,
        balance: typeof c.balance === "number" ? c.balance : 0,
      }));
      const derivedBalance =
        cards.length > 0
          ? cards.reduce((acc, c) => acc + (c.balance || 0), 0)
          : typeof cached.balance === "number"
            ? cached.balance
            : 0;

      const synchronized: WalletState = {
        ...cached,
        cards,
        balance: derivedBalance,
      };
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

    // Deliver cached state immediately
    this.getLocalWallet(effectiveUid).then(callback);

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
              const cards = (data.cards || []).map((c: any) => ({
                ...c,
                balance: typeof c.balance === "number" ? c.balance : 0,
              }));
              const derivedBalance =
                cards.length > 0
                  ? cards.reduce((acc, c) => acc + (c.balance || 0), 0)
                  : typeof data.balance === "number"
                    ? data.balance
                    : 0;

              const synchronized: WalletState = {
                ...data,
                cards,
                balance: derivedBalance,
                pockets: data.pockets || [],
                transactions: data.transactions || [],
                updatedAt: data.updatedAt || new Date().toISOString(),
              };

              AsyncStorage.setItem(
                WALLET_STORAGE_KEY_PREFIX + effectiveUid,
                JSON.stringify(synchronized),
              ).catch(() => {});
              callback(synchronized);
            }
          } else {
            // When document is deleted in Firestore cloud, immediately sync empty wallet
            const empty = buildDefaultWallet(targetUid);
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

              const cards = (remote.cards || []).map((c: any) => ({
                ...c,
                balance: typeof c.balance === "number" ? c.balance : 0,
              }));
              const derivedBalance =
                cards.length > 0
                  ? cards.reduce((acc, c) => acc + (c.balance || 0), 0)
                  : typeof remote.balance === "number"
                    ? remote.balance
                    : 0;

              const synchronized: WalletState = {
                ...remote,
                cards,
                balance: derivedBalance,
              };

              AsyncStorage.setItem(
                WALLET_STORAGE_KEY_PREFIX + effectiveUid,
                JSON.stringify(synchronized),
              ).catch(() => {});
              callback(synchronized);
            } else if (
              data &&
              (data.walletState === null || data.walletState === undefined)
            ) {
              // Cloud explicitly set walletState to null or removed the field
              const empty = buildDefaultWallet(targetUid);
              AsyncStorage.setItem(
                WALLET_STORAGE_KEY_PREFIX + effectiveUid,
                JSON.stringify(empty),
              ).catch(() => {});
              callback(empty);
            }
          } else {
            // User document deleted in cloud console
            const empty = buildDefaultWallet(targetUid);
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
        return { ...c, balance: (c.balance || 0) + amount };
      }
      return c;
    });

    const displayMethod = targetCard ? targetCard.name : cardIdOrMethod;
    const newTotalBalance =
      updatedCards.length > 0
        ? updatedCards.reduce((acc, c) => acc + (c.balance || 0), 0)
        : current.balance + amount;

    const newTx: WalletTransaction = {
      id: "tx_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      type: "cash_in",
      amount,
      title: `Top-up via ${displayMethod}`,
      description: `Added ₱${amount.toLocaleString()} to ${displayMethod}`,
      paymentMethodUsed: displayMethod,
      referenceId: targetCard?.id || "",
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
    return updated;
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
    };

    const newTotalBalance = updatedCards.reduce(
      (acc, c) => acc + (c.balance || 0),
      0,
    );

    const newTx: WalletTransaction = {
      id: "tx_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      type: "expense_simulation",
      amount,
      title: categoryTitle,
      description: note || `Daily simulated expense charged to ${card.name}`,
      paymentMethodUsed: card.name,
      referenceId: card.id,
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
      message: `Charged ₱${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} for ${categoryTitle} from ${card.name}!`,
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
