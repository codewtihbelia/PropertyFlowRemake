import {
  UserProfile,
  Household,
  HouseholdMember,
  BillingCycle,
  Charge,
  ElectricityConfig,
  WaterConfig,
  WaterAttendanceRecord,
  MemberBill,
  Payment,
  Adjustment,
  NotificationItem,
  Conversation,
  Message,
  Announcement,
  SupportTicket,
  AppVersion,
  AuditLog,
} from '@propertyflow/shared';

type Listener = () => void;
const listeners = new Set<Listener>();

function notifyListeners() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.error('[Store] Listener error:', e);
    }
  });
}

export function subscribeToStore(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export interface AppState {
  users: Record<string, UserProfile>;
  households: Record<string, Household>;
  members: Record<string, HouseholdMember[]>;
  billingCycles: Record<string, BillingCycle[]>;
  charges: Record<string, Charge[]>;
  electricityConfigs: Record<string, Record<string, ElectricityConfig>>;
  waterConfigs: Record<string, WaterConfig>;
  waterAttendance: Record<string, WaterAttendanceRecord[]>;
  memberBills: Record<string, MemberBill[]>;
  payments: Record<string, Payment[]>;
  adjustments: Record<string, Adjustment[]>;
  notifications: NotificationItem[];
  conversations: Conversation[];
  messages: Record<string, Message[]>;
  announcements: Record<string, Announcement[]>;
  supportTickets: SupportTicket[];
  appVersions: AppVersion[];
  auditLogs: AuditLog[];
  currentUserId: string;
  currentHouseholdId: string;
}

export function emptyAppState(): AppState {
  return {
    users: {},
    households: {},
    members: {},
    billingCycles: {},
    charges: {},
    electricityConfigs: {},
    waterConfigs: {},
    waterAttendance: {},
    memberBills: {},
    payments: {},
    adjustments: {},
    notifications: [],
    conversations: [],
    messages: {},
    announcements: {},
    supportTickets: [],
    appVersions: [],
    auditLogs: [],
    currentUserId: '',
    currentHouseholdId: '',
  };
}

let memoryState: AppState = emptyAppState();

try {
  localStorage.removeItem('propertyflow_state_v1');
} catch {
  // Ignore browsers that block localStorage.
}

export function getAppState(): AppState {
  return memoryState;
}

export function saveAppState(state: AppState) {
  memoryState = state;
  notifyListeners();
}

export function resetCloudCache(): AppState {
  memoryState = emptyAppState();
  notifyListeners();
  return memoryState;
}
