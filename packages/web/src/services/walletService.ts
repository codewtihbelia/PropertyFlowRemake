import { doc, getDoc, setDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../firebase/config";

export type CardProviderType =
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
  network: "Visa" | "Mastercard" | "BancNet" | "QR Ph" | "InstaPay";
  gradient: [string, string];
  accentColor: string;
  isEWallet: boolean;
}

export const PHILIPPINE_CARD_PRESETS: Record<
  CardProviderType,
  CardProviderConfig
> = {
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
  accountNumber: string;
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
  | "card_transfer";

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

const WALLET_STORAGE_KEY_PREFIX = "@splitzy_wallet_web_";
const WALLET_WALKTHROUGH_KEY_PREFIX = "@splitzy_wallet_walkthrough_web_v1_";

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

class WebWalletService {
  private userDocRef(userId: string) {
    return doc(db, "users", userId);
  }

  isWalkthroughCompleted(userId: string): boolean {
    const effectiveUid =
      !userId || userId === "guest" ? auth.currentUser?.uid || "guest" : userId;
    try {
      return (
        localStorage.getItem(WALLET_WALKTHROUGH_KEY_PREFIX + effectiveUid) ===
        "true"
      );
    } catch {
      return false;
    }
  }

  setWalkthroughCompleted(userId: string, completed: boolean = true): void {
    const effectiveUid =
      !userId || userId === "guest" ? auth.currentUser?.uid || "guest" : userId;
    try {
      localStorage.setItem(
        WALLET_WALKTHROUGH_KEY_PREFIX + effectiveUid,
        completed ? "true" : "false",
      );
    } catch {}
  }

  private getLocalWallet(userId: string): WalletState {
    try {
      const cached = localStorage.getItem(WALLET_STORAGE_KEY_PREFIX + userId);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (!isLegacyDemoWallet(parsed)) {
          return parsed;
        }
      }
    } catch {}
    const initial = buildDefaultWallet(userId);
    try {
      localStorage.setItem(
        WALLET_STORAGE_KEY_PREFIX + userId,
        JSON.stringify(initial),
      );
    } catch {}
    return initial;
  }

  async getWallet(userId: string): Promise<WalletState> {
    const effectiveUid =
      !userId || userId === "guest" ? auth.currentUser?.uid || "guest" : userId;

    let cached: WalletState | null = null;
    try {
      const cachedStr = localStorage.getItem(
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
      return cached || this.getLocalWallet(effectiveUid);
    }

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
      console.warn("[WebWalletService] subDoc fetch notice:", e);
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
        console.warn("[WebWalletService] userDoc fetch notice:", e);
      }
    }

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

      try {
        localStorage.setItem(
          WALLET_STORAGE_KEY_PREFIX + effectiveUid,
          JSON.stringify(synchronized),
        );
      } catch {}
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

    // 1. Clear local storage
    try {
      localStorage.removeItem(WALLET_STORAGE_KEY_PREFIX + effectiveUid);
      localStorage.setItem(
        WALLET_STORAGE_KEY_PREFIX + effectiveUid,
        JSON.stringify(emptyState),
      );
    } catch {}

    // 2. Delete cloud document
    if (targetUid && targetUid !== "guest") {
      try {
        await deleteDoc(doc(db, "users", targetUid, "wallet", "current"));
      } catch (e) {
        console.warn("[WebWalletService] deleteDoc /wallet/current error:", e);
      }

      // 3. Clear userDoc walletState
      try {
        await setDoc(
          this.userDocRef(targetUid),
          { walletState: null },
          { merge: true },
        );
      } catch (e) {
        console.warn("[WebWalletService] setDoc walletState:null error:", e);
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

    callback(this.getLocalWallet(effectiveUid));

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
        (snap) => {
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

              try {
                localStorage.setItem(
                  WALLET_STORAGE_KEY_PREFIX + effectiveUid,
                  JSON.stringify(synchronized),
                );
              } catch {}
              callback(synchronized);
            }
          } else {
            // When document is deleted in Firestore cloud, seamlessly sync empty wallet state
            const empty = buildDefaultWallet(targetUid);
            try {
              localStorage.setItem(
                WALLET_STORAGE_KEY_PREFIX + effectiveUid,
                JSON.stringify(empty),
              );
            } catch {}
            callback(empty);
          }
        },
        (error) => {
          console.warn("[WebWalletService] onSnapshot subDoc error:", error);
        },
      );
    } catch {}

    try {
      unsubUser = onSnapshot(
        this.userDocRef(targetUid),
        (snap) => {
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

              try {
                localStorage.setItem(
                  WALLET_STORAGE_KEY_PREFIX + effectiveUid,
                  JSON.stringify(synchronized),
                );
              } catch {}
              callback(synchronized);
            } else if (
              data &&
              (data.walletState === null || data.walletState === undefined)
            ) {
              const empty = buildDefaultWallet(targetUid);
              try {
                localStorage.setItem(
                  WALLET_STORAGE_KEY_PREFIX + effectiveUid,
                  JSON.stringify(empty),
                );
              } catch {}
              callback(empty);
            }
          } else {
            // User doc deleted in cloud
            const empty = buildDefaultWallet(targetUid);
            try {
              localStorage.setItem(
                WALLET_STORAGE_KEY_PREFIX + effectiveUid,
                JSON.stringify(empty),
              );
            } catch {}
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

  async deductForBill(
    userId: string,
    amount: number,
    billTitle: string,
    billId?: string,
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
      type: "bill_payment",
      amount,
      title: `Paid: ${billTitle}`,
      description: `Utility bill payment marked as completed`,
      paymentMethodUsed: methodName,
      referenceId: billId,
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
      message: `Successfully paid ₱${amount.toLocaleString()} for ${billTitle}!`,
    };
  }

  async deductForDebtSettlement(
    userId: string,
    amount: number,
    recipientName: string,
    debtId?: string,
    methodName: string = "Splitzy Wallet",
  ): Promise<{ success: boolean; updatedState: WalletState; message: string }> {
    const current = await this.getWallet(userId);

    const targetCard = current.cards.find(
      (c) =>
        c.id === methodName ||
        c.name.toLowerCase() === methodName.toLowerCase(),
    );

    if (methodName === "Splitzy Wallet" && current.balance < amount) {
      return {
        success: false,
        updatedState: current,
        message: `Insufficient wallet balance (₱${current.balance.toLocaleString()} available). Please top up or choose a linked card.`,
      };
    }

    if (targetCard && (targetCard.balance || 0) < amount) {
      return {
        success: false,
        updatedState: current,
        message: `Insufficient funds on ${targetCard.name} (₱${(targetCard.balance || 0).toLocaleString()} available).`,
      };
    }

    const displayMethod = targetCard ? targetCard.name : methodName;

    const newTx: WalletTransaction = {
      id: "tx_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      type: "debt_settlement",
      amount,
      title: `Transfer to ${recipientName}`,
      description: `Sent ₱${amount.toLocaleString()} to ${recipientName}`,
      paymentMethodUsed: displayMethod,
      referenceId: debtId || "",
      timestamp: new Date().toISOString(),
      status: "completed",
    };

    let updatedCards = current.cards;
    let newBalance = current.balance;

    if (targetCard) {
      updatedCards = current.cards.map((c) =>
        c.id === targetCard.id
          ? { ...c, balance: Math.max(0, (c.balance || 0) - amount) }
          : c,
      );
      newBalance = updatedCards.reduce((acc, c) => acc + (c.balance || 0), 0);
    } else if (methodName === "Splitzy Wallet") {
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
  ): Promise<{ success: boolean; updatedState: WalletState; message: string }> {
    const current = await this.getWallet(userId);
    if (current.balance < amount) {
      return {
        success: false,
        updatedState: current,
        message: `Insufficient wallet balance to stash ₱${amount.toLocaleString()}. Please cash in first.`,
      };
    }

    const targetPocket = current.pockets.find((p) => p.id === pocketId);
    if (!targetPocket) {
      return {
        success: false,
        updatedState: current,
        message: "Savings pocket not found.",
      };
    }

    const updatedPockets = current.pockets.map((p) =>
      p.id === pocketId ? { ...p, currentAmount: p.currentAmount + amount } : p,
    );

    const updatedCards = this.deductFromCards(current.cards, amount);
    const newBalance =
      updatedCards.length > 0
        ? updatedCards.reduce((acc, c) => acc + (c.balance || 0), 0)
        : current.balance - amount;

    const newTx: WalletTransaction = {
      id: "tx_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      type: "savings_deposit",
      amount,
      title: `Saved to ${targetPocket.name}`,
      description: `Transferred ₱${amount.toLocaleString()} into savings pocket`,
      paymentMethodUsed: "Splitzy Wallet",
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
      message: `Stashed ₱${amount.toLocaleString()} into "${targetPocket.name}"!`,
    };
  }

  async withdrawFromPocket(
    userId: string,
    pocketId: string,
    amount: number,
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
    if (updatedCards.length > 0) {
      const defaultIdx = Math.max(
        0,
        updatedCards.findIndex((c) => c.isDefault),
      );
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
      description: `Transferred ₱${amount.toLocaleString()} back to main balance`,
      paymentMethodUsed: "Savings Pocket",
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
      message: `Transferred ₱${amount.toLocaleString()} from "${targetPocket.name}" back to your wallet!`,
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

  private async persist(userId: string, state: WalletState) {
    const effectiveUid =
      !userId || userId === "guest" ? auth.currentUser?.uid || "guest" : userId;

    try {
      localStorage.setItem(
        WALLET_STORAGE_KEY_PREFIX + effectiveUid,
        JSON.stringify(state),
      );
    } catch {}

    const targetUid =
      auth.currentUser?.uid || (effectiveUid !== "guest" ? effectiveUid : null);

    if (!targetUid || targetUid === "guest") return;

    const sanitized = sanitizeForFirestore(state);

    try {
      await setDoc(
        doc(db, "users", targetUid, "wallet", "current"),
        sanitized,
        { merge: true },
      );
    } catch (err) {
      console.warn("[WebWalletService] setDoc /wallet/current error:", err);
    }

    try {
      await setDoc(
        this.userDocRef(targetUid),
        { walletState: sanitized },
        { merge: true },
      );
    } catch (err) {
      console.warn("[WebWalletService] setDoc userDoc error:", err);
    }
  }
}

export const webWalletService = new WebWalletService();
