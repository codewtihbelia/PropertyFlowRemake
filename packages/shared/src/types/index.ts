export type UserRole = "SUPER_ADMIN" | "HOST" | "PAYOR" | "NON_PAYOR";

export type AccountStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";

export type HostApplicationStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface HostApplication {
  id?: string;
  applicationId: string;
  userId: string;
  applicantName: string;
  applicantEmail: string;
  userEmail?: string;
  applicantPhone?: string;
  phoneNumber?: string;
  managementType?: string;
  selectedHouseholdId?: string;
  roommateGroupName?: string;
  propertyName?: string;
  householdName?: string;
  propertyAddress: string;
  unitOrRoom?: string;
  monthlyRentOrShare?: number;
  estimatedMonthlyBills?: number;
  city?: string;
  estimatedRoommates?: number;
  reason: string;
  reasonForApplying?: string;
  experience?: string;
  propertyExperience?: string;
  status: HostApplicationStatus;
  reviewedBy?: string;
  reviewerName?: string;
  reviewNotes?: string;
  adminFeedback?: string;
  submittedAt: string;
  createdAt?: string;
  reviewedAt?: string;
}

export interface UserProfile {
  uid: string;
  fullName: string;
  displayName: string;
  email: string;
  phoneNumber?: string;
  profilePicture?: string;
  role: UserRole;
  accountStatus: AccountStatus;
  householdId?: string;
  householdName?: string;
  apartmentName?: string;
  pendingHouseholdId?: string;
  pendingHouseholdName?: string;
  joinRequestStatus?: "PENDING" | "APPROVED" | "REJECTED";
  joinRejectionReason?: string;
  hostApplicationStatus?: HostApplicationStatus;
  hostApplicationId?: string;
  createdDate: string;
  updatedDate: string;
  lastLogin?: string;
  notificationPreferences?: {
    email: boolean;
    push: boolean;
    inApp: boolean;
  };
}

export interface Household {
  householdId: string;
  householdName: string;
  apartmentName: string;
  address: string;
  description?: string;
  hostId: string;
  inviteCode?: string;
  status: "ACTIVE" | "ARCHIVED";
  createdDate: string;
  updatedDate: string;
}

export interface HouseholdMember {
  memberId: string;
  userId: string;
  householdId: string;
  role: UserRole;
  displayName: string;
  email: string;
  profilePicture?: string;
  status: "ACTIVE" | "INACTIVE" | "REMOVED" | "PENDING" | "REJECTED";
  joinedDate: string;
  requestedDate?: string;
  rejectionReason?: string;
  householdName?: string;
  notes?: string;
}

export type InvitationStatus = "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";

export interface Invitation {
  invitationId: string;
  householdId: string;
  householdName?: string;
  invitedEmail: string;
  assignedRole: UserRole;
  invitedBy: string;
  createdDate: string;
  expirationDate: string;
  status: InvitationStatus;
}

export type BillingCycleStatus =
  | "DRAFT"
  | "ACTIVE"
  | "CALCULATION"
  | "FINALIZED"
  | "PAYMENT_COLLECTION"
  | "CLOSED";

export interface BillingCycle {
  billingCycleId: string;
  householdId: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  status: BillingCycleStatus;
  notes?: string;
  createdBy?: string;
  createdDate: string;
  finalizedDate?: string;
  closedDate?: string;
  dueDate?: string;
  cutoffDate?: string;
  totalBilledCentavos?: number;
  totalCollectedCentavos?: number;
}

export type ChargeType =
  | "RENT"
  | "INTERNET"
  | "ELECTRICITY"
  | "WATER"
  | "CUSTOM";

export type DistributionMethod =
  | "EQUAL_SPLIT"
  | "PAYORS_ONLY"
  | "ALL_MEMBERS"
  | "SELECTED_MEMBERS"
  | "FIXED_AMOUNTS"
  | "PERCENTAGE_ALLOCATION";

export interface Charge {
  chargeId: string;
  householdId: string;
  billingCycleId: string;
  chargeType: ChargeType;
  name: string;
  description?: string;
  amountCentavos: number;
  distributionMethod: DistributionMethod;
  participantUserIds: string[];
  fixedAmounts?: Record<string, number>; // userId -> centavos
  percentages?: Record<string, number>; // userId -> percentage e.g. 25.0
  createdDate: string;
  createdBy: string;
}

export interface ElectricityConfig {
  previousReading: number;
  currentReading: number;
  electricityRateCentavosPerKwh: number; // default 1600 (₱16.00)
  consumptionKwh: number;
  totalCostCentavos: number;
  meterResetAdjustment?: boolean;
  manualAdjustmentReason?: string;
}

export type WaterAttendanceStatus = "PRESENT" | "ABSENT" | "UNMARKED";

export interface WaterAttendanceRecord {
  recordId: string;
  householdId: string;
  billingCycleId: string;
  userId: string;
  date: string; // YYYY-MM-DD
  status: WaterAttendanceStatus;
  locked: boolean;
  modifiedBy?: string;
  modifiedTimestamp?: string;
}

export interface WaterConfig {
  rateCentavosPerPersonPerDay: number; // default 500 (₱5.00)
  mode: "BILLING_CYCLE" | "MONTHLY_CUSTOM";
  pricingModel?: "PER_PERSON_DAY" | "FIXED_MONTHLY";
  fixedMonthlyAmountCentavos?: number;
  customStartDate?: string;
  customEndDate?: string;
}

export interface MemberBillItem {
  chargeId: string;
  chargeType: ChargeType;
  name: string;
  amountCentavos: number;
  details?: string;
}

export type MemberBillStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID";

export interface MemberBill {
  billId: string;
  householdId: string;
  billingCycleId: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  rentCentavos: number;
  internetCentavos: number;
  electricityCentavos: number;
  waterCentavos: number;
  customChargesCentavos: number;
  adjustmentsCentavos: number;
  totalDueCentavos: number;
  paidCentavos: number;
  outstandingCentavos: number;
  status: MemberBillStatus;
  items: MemberBillItem[];
  waterDaysPresent: number;
  finalizedAt: string;
}

export type PaymentStatus = "PENDING" | "VERIFIED" | "REJECTED" | "CANCELLED";

export type PaymentMethod =
  | "CASH"
  | "BANK_TRANSFER"
  | "GCASH"
  | "MAYA"
  | "OTHER";

export interface Payment {
  paymentId: string;
  userId: string;
  userName: string;
  householdId: string;
  billingCycleId: string;
  amountCentavos: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  referenceNumber: string;
  proofOfPaymentUrl?: string;
  notes?: string;
  status: PaymentStatus;
  rejectionReason?: string;
  createdDate: string;
  verifiedDate?: string;
  verifiedBy?: string;
}

export type AdjustmentType =
  | "BALANCE_REDISTRIBUTION"
  | "MANUAL_CORRECTION"
  | "CREDIT";

export interface AdjustmentAllocation {
  userId: string;
  userName: string;
  amountCentavos: number;
}

export interface Adjustment {
  adjustmentId: string;
  householdId: string;
  billingCycleId: string;
  type: AdjustmentType;
  amountCentavos: number;
  sourceUserId: string;
  sourceUserName: string;
  reason: string;
  allocations: AdjustmentAllocation[];
  createdBy: string;
  createdDate: string;
}

export interface NotificationItem {
  notificationId: string;
  recipientId: string; // userId or 'ALL'
  householdId?: string;
  type:
    | "PAYMENT_SUBMITTED"
    | "PAYMENT_VERIFIED"
    | "PAYMENT_REJECTED"
    | "BILL_FINALIZED"
    | "BILL_UPDATED"
    | "ADJUSTMENT_CREATED"
    | "BALANCE_REDISTRIBUTED"
    | "ATTENDANCE_UPDATED"
    | "ANNOUNCEMENT"
    | "NEW_MESSAGE"
    | "INVITATION_RECEIVED"
    | "SUPPORT_UPDATE";
  title: string;
  message: string;
  relatedEntityId?: string;
  entityType?: string;
  readStatus: boolean;
  createdTimestamp: string;
}

export interface Conversation {
  conversationId: string;
  householdId: string;
  type: "DIRECT" | "HOUSEHOLD_GROUP";
  participantIds: string[];
  participantNames?: Record<string, string>;
  lastMessage?: string;
  lastMessageTimestamp?: string;
  updatedAt: string;
}

export interface Message {
  messageId: string;
  conversationId: string;
  householdId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  timestamp: string;
  readBy: string[];
}

export interface Announcement {
  announcementId: string;
  householdId: string;
  title: string;
  message: string;
  audience: "EVERYONE" | "PAYORS" | "NON_PAYORS" | "SELECTED_MEMBERS";
  selectedMemberIds?: string[];
  createdBy: string;
  creatorName: string;
  createdDate: string;
  expirationDate?: string;
  status: "ACTIVE" | "ARCHIVED";
}

export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TicketStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "WAITING_FOR_USER"
  | "RESOLVED"
  | "CLOSED";

export interface SupportTicket {
  ticketId: string;
  userId: string;
  userName: string;
  householdId?: string;
  householdName?: string;
  category:
    | "BILLING"
    | "ACCOUNT"
    | "PAYMENT"
    | "BUG"
    | "FEATURE_REQUEST"
    | "OTHER";
  subject: string;
  description: string;
  attachments?: string[];
  priority: TicketPriority;
  status: TicketStatus;
  createdDate: string;
  updatedDate: string;
}

export interface AppVersion {
  versionId: string;
  platform: "ANDROID" | "IOS" | "WEB";
  versionNumber: string;
  minimumSupportedVersion: string;
  latestVersion: string;
  releaseNotes: string;
  mandatoryUpdate: boolean;
  releaseStatus: "ACTIVE" | "BETA" | "DEPRECATED";
  releaseDate: string;
}

export interface AuditLog {
  logId: string;
  householdId?: string;
  actorId: string;
  actorName: string;
  role: UserRole;
  action: string;
  entity: string;
  entityId: string;
  timestamp: string;
  previousValue?: any;
  newValue?: any;
  reason?: string;
}
