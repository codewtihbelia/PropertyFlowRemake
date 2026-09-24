import React, { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useHousehold } from "../../contexts/HouseholdContext";
import { billingService } from "../../services/billingService";
import { paymentService } from "../../services/paymentService";
import { formatPesos } from "@propertyflow/shared";
import { UniversalLoader } from "../../components/common/UniversalLoader";
import { JoinHouseholdModal } from "../../components/common/JoinHouseholdModal";
import { CreateRoomModal } from "../../components/CreateRoomModal";
import {
  CreditCard,
  Receipt,
  Droplets,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  Home,
  Zap,
  Wifi,
  Users,
  Building2,
  ShieldCheck,
  KeyRound,
  Copy,
  Check,
  Plus,
} from "lucide-react";

export const ClientDashboard: React.FC<{
  onNavigate: (tab: string) => void;
}> = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const { household, activeCycle, members, loading } = useHousehold();
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  if (loading && currentUser.householdId) {
    return <UniversalLoader text="Loading your dashboard..." />;
  }

  const hasHousehold = Boolean(
    household.householdId &&
    household.householdName &&
    household.householdName !== "No household connected",
  );

  const displayCode =
    household.inviteCode ||
    (household.householdId
      ? `PF-${household.householdId.slice(-4).toUpperCase()}`
      : "PF-402");

  const isUserHost = Boolean(
    currentUser.role === "HOST" ||
    currentUser.hostApplicationStatus === "APPROVED" ||
    (household.hostId && household.hostId === currentUser.uid) ||
    members.some(
      (m) =>
        (m.userId === currentUser.uid ||
          m.memberId === currentUser.uid ||
          m.memberId === `mem_${currentUser.uid}`) &&
        m.role === "HOST",
    ),
  );

  const hostId = household.hostId || (isUserHost ? currentUser.uid : "");
  const hostMember = members.find(
    (m) =>
      m.role === "HOST" ||
      m.userId === hostId ||
      m.memberId === hostId ||
      m.memberId === `mem_${hostId}`,
  );
  const hostDisplayName =
    hostMember?.displayName || (isUserHost ? currentUser.displayName : "Host");
  const hostPhoto = isUserHost
    ? currentUser.profilePicture || (currentUser as any)?.photoURL
    : hostMember?.profilePicture || (hostMember as any)?.photoURL;

  // Strictly approved, ACTIVE members
  const activeMembers = members.filter(
    (m) =>
      m.status === "ACTIVE" ||
      (!m.status && (m.role === "HOST" || m.userId === hostId)),
  );

  // Other active members excluding the host
  const otherActiveMembers = activeMembers.filter(
    (m) =>
      m.role !== "HOST" &&
      m.userId !== hostId &&
      m.memberId !== hostId &&
      m.memberId !== `mem_${hostId}`,
  );

  // Pending join requests (awaiting host approval)
  const pendingRequests = members.filter((m) => m.status === "PENDING");

  const handleCopyCode = () => {
    navigator.clipboard.writeText(displayCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const bills = activeCycle
    ? billingService.getMemberBills(
        household.householdId,
        activeCycle.billingCycleId,
      )
    : [];
  const myBill = bills.find((b) => b.userId === currentUser.uid);

  const payments = paymentService.getUserPayments(
    household.householdId,
    currentUser.uid,
  );
  const recentPayments = payments.slice(0, 3);

  const isPaid = myBill?.status === "PAID";
  const isPartial = myBill?.status === "PARTIALLY_PAID";
  const isUnpaid = myBill?.status === "UNPAID";

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Greeting Banner matching proposedUI */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-medium">
            <span>
              {hasHousehold
                ? household.apartmentName || household.householdName
                : "No household connected"}
            </span>
            <span>•</span>
            <span>
              {hasHousehold
                ? activeCycle?.name || "Active Cycle"
                : "Onboarding"}
            </span>
            {hasHousehold && (
              <span className="flex items-center gap-1.5 ml-1 px-2.5 py-0.5 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 font-mono font-bold text-xs">
                <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                <span>Code: {displayCode}</span>
                <button
                  onClick={handleCopyCode}
                  className="ml-1 text-[10px] bg-blue-600 hover:bg-blue-700 text-white px-2 py-0.5 rounded-md cursor-pointer transition flex items-center gap-1"
                  title="Copy code for roommates to join"
                >
                  {copiedCode ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>{copiedCode ? "Copied" : "Copy"}</span>
                </button>
              </span>
            )}
          </div>
          <h2 className="text-2xl font-black text-slate-900 mt-1">
            Hi {currentUser.displayName}!
          </h2>
          <p className="text-xs text-slate-500">
            Control your household expenses here.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Group</span>
          </button>
          {hasHousehold && isUserHost && (
            <button
              onClick={() => onNavigate("host_household")}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Manage Group</span>
            </button>
          )}
          <button
            onClick={() => setIsJoinModalOpen(true)}
            className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>
              {hasHousehold ? "Switch / Join Group" : "Join with Code"}
            </span>
          </button>
          {currentUser?.profilePicture || (currentUser as any)?.photoURL ? (
            <img
              src={currentUser.profilePicture || (currentUser as any).photoURL}
              alt={currentUser.displayName}
              className="w-11 h-11 rounded-2xl object-cover ring-2 ring-blue-500/20 shadow-xs"
            />
          ) : (
            <div className="w-11 h-11 rounded-2xl bg-blue-100 text-blue-700 font-black flex items-center justify-center text-base shadow-xs ring-2 ring-blue-500/20">
              {currentUser.displayName?.charAt(0) || "U"}
            </div>
          )}
        </div>
      </div>

      {/* New User Welcome & Join Group Banner if not connected to a household */}
      {!hasHousehold && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-8 text-white shadow-lg animate-in fade-in">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/15 rounded-full text-xs font-semibold mb-3 border border-white/20">
              <KeyRound className="w-3.5 h-3.5" />
              <span>Connect to Your Roommates</span>
            </div>
            <h3 className="text-2xl font-black tracking-tight mb-2">
              Ready to sync bills with your roommates?
            </h3>
            <p className="text-sm text-blue-100 mb-6 leading-relaxed">
              Create your own apartment group to invite roommates and split
              bills, or enter an invite code to join an existing household.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-6 py-3 bg-white text-blue-700 hover:bg-blue-50 font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create a Group</span>
              </button>
              <button
                onClick={() => setIsJoinModalOpen(true)}
                className="px-5 py-3 bg-blue-500/30 hover:bg-blue-500/40 text-white font-bold text-xs rounded-xl border border-white/20 transition flex items-center gap-2 cursor-pointer"
              >
                <KeyRound className="w-4 h-4" />
                <span>Enter Invite Code (e.g. PF-402)</span>
              </button>
              <button
                onClick={() => onNavigate("client_host_application")}
                className="px-5 py-3 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl border border-white/20 transition cursor-pointer"
              >
                Apply as Host
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settle Now Alert Banner if outstanding balance exists (matching proposedUI) */}
      {myBill && myBill.outstandingCentavos > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-3xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-blue-900">
                Active Dues Awaiting Payment
              </div>
              <div className="text-xs text-blue-700 mt-0.5">
                Outstanding:{" "}
                <strong className="text-rose-600 font-extrabold">
                  {formatPesos(myBill.outstandingCentavos)}
                </strong>
                {isPartial &&
                  ` (Paid ${formatPesos(myBill.paidCentavos)} of ${formatPesos(myBill.totalDueCentavos)})`}
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigate("client_payments")}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-xs transition shrink-0"
          >
            Settle Now
          </button>
        </div>
      )}

      {/* Primary KPI Balance Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Outstanding Balance */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              My Outstanding Balance
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 mt-2">
            {myBill ? formatPesos(myBill.outstandingCentavos) : "₱0.00"}
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <span
              className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                isPaid
                  ? "bg-emerald-100 text-emerald-800"
                  : isPartial
                    ? "bg-amber-100 text-amber-800"
                    : "bg-rose-100 text-rose-800"
              }`}
            >
              {myBill ? myBill.status.replace("_", " ") : "NO BILL"}
            </span>
            <span className="text-[11px] text-slate-400">
              for {activeCycle?.name}
            </span>
          </div>
        </div>

        {/* Total Billed */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Original Total Share
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 mt-2">
            {myBill ? formatPesos(myBill.totalDueCentavos) : "₱0.00"}
          </div>
          <button
            onClick={() => onNavigate("client_bills")}
            className="text-[11px] text-blue-600 hover:underline font-bold mt-2 flex items-center gap-1"
          >
            View full itemized breakdown <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* Water Attendance Days */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Water Attendance
            </span>
            <div className="w-8 h-8 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
              <Droplets className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-cyan-600 mt-2">
            {myBill ? `${myBill.waterDaysPresent} Days` : "0 Days"}
          </div>
          <button
            onClick={() => onNavigate("client_attendance")}
            className="text-[11px] text-blue-600 hover:underline font-bold mt-2 flex items-center gap-1"
          >
            Manage daily attendance calendar <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Apartment Group Card & Expense History (matching proposedUI) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Apartment Group Card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">
              My Household Group
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-blue-600 font-bold">
                {activeMembers.length}{" "}
                {activeMembers.length === 1 ? "Roommate" : "Roommates"}
              </span>
              {isUserHost && (
                <button
                  onClick={() => onNavigate("host_household")}
                  className="text-xs text-blue-600 hover:text-blue-800 font-bold underline cursor-pointer"
                >
                  Manage Group →
                </button>
              )}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-md">
            <div className="text-xs uppercase tracking-wider text-blue-200 font-bold">
              {household.apartmentName}
            </div>
            <div className="text-xl font-black mt-1">
              {household.householdName}
            </div>
            <p className="text-xs text-blue-100 mt-1 line-clamp-1">
              {household.address}
            </p>

            <div className="mt-4 pt-3 border-t border-blue-500/40 flex items-center justify-between">
              {/* Avatar stack: Only approved active members; if no members yet, only room host */}
              {otherActiveMembers.length === 0 ? (
                <div className="flex items-center gap-2">
                  {hostPhoto ? (
                    <img
                      src={hostPhoto}
                      alt={hostDisplayName}
                      className="inline-block h-7 w-7 rounded-full ring-2 ring-blue-700 object-cover"
                      title={`${hostDisplayName} (Host)`}
                    />
                  ) : (
                    <div
                      className="inline-block h-7 w-7 rounded-full ring-2 ring-blue-700 bg-blue-100 text-blue-900 text-[10px] font-black flex items-center justify-center"
                      title={`${hostDisplayName} (Host)`}
                    >
                      {hostDisplayName?.charAt(0) || "H"}
                    </div>
                  )}
                  <span className="text-[11px] text-blue-100 font-medium">
                    Room Host
                  </span>
                </div>
              ) : (
                <div className="flex -space-x-2 overflow-hidden">
                  {/* Host Avatar first */}
                  {hostPhoto ? (
                    <img
                      src={hostPhoto}
                      alt={hostDisplayName}
                      className="inline-block h-7 w-7 rounded-full ring-2 ring-blue-700 object-cover"
                      title={`${hostDisplayName} (Host)`}
                    />
                  ) : (
                    <div
                      className="inline-block h-7 w-7 rounded-full ring-2 ring-blue-700 bg-blue-100 text-blue-900 text-[10px] font-black flex items-center justify-center"
                      title={`${hostDisplayName} (Host)`}
                    >
                      {hostDisplayName?.charAt(0) || "H"}
                    </div>
                  )}
                  {/* Other active roommates */}
                  {otherActiveMembers.slice(0, 3).map((m) => {
                    const photo = m.profilePicture || (m as any).photoURL;
                    return photo ? (
                      <img
                        key={m.memberId || m.userId}
                        src={photo}
                        alt={m.displayName}
                        className="inline-block h-7 w-7 rounded-full ring-2 ring-blue-700 object-cover"
                        title={m.displayName}
                      />
                    ) : (
                      <div
                        key={m.memberId || m.userId}
                        className="inline-block h-7 w-7 rounded-full ring-2 ring-blue-700 bg-blue-100 text-blue-900 text-[10px] font-black flex items-center justify-center"
                        title={m.displayName}
                      >
                        {m.displayName?.charAt(0) || "R"}
                      </div>
                    );
                  })}
                  {otherActiveMembers.length > 3 && (
                    <div className="inline-block h-7 w-7 rounded-full ring-2 ring-blue-700 bg-blue-950 text-white text-[10px] font-bold flex items-center justify-center">
                      +{otherActiveMembers.length - 3}
                    </div>
                  )}
                </div>
              )}

              <span className="text-[11px] font-bold text-blue-100">
                {isUserHost
                  ? "Host / Payor"
                  : currentUser.role === "NON_PAYOR"
                    ? "Non-Payor Member"
                    : "Payor Member"}
              </span>
            </div>
          </div>

          {/* Pending Requests Alert for Host */}
          {isUserHost && pendingRequests.length > 0 && (
            <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                <span className="font-semibold">
                  {pendingRequests.length} pending join request
                  {pendingRequests.length > 1 ? "s" : ""} awaiting your approval
                </span>
              </div>
              <button
                onClick={() => onNavigate("host_household")}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs transition"
              >
                Review & Approve
              </button>
            </div>
          )}
        </div>

        {/* Recent Payments Submitted */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">
              My Recent Payments
            </h3>
            <button
              onClick={() => onNavigate("client_payments")}
              className="text-xs text-blue-600 hover:underline font-bold"
            >
              View All
            </button>
          </div>

          {recentPayments.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No payments submitted yet.
            </div>
          ) : (
            <div className="space-y-3">
              {recentPayments.map((p) => (
                <div
                  key={p.paymentId}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                      ₱
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        {formatPesos(p.amountCentavos)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {p.paymentMethod} · {p.paymentDate}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                      p.status === "VERIFIED"
                        ? "bg-emerald-100 text-emerald-800"
                        : p.status === "PENDING"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {p.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Host Application CTA Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 text-white shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6 text-blue-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-sm text-white">
                Lead Your Own Community as a Host
              </h3>
              <span className="px-2 py-0.5 bg-blue-500/30 text-blue-200 text-[10px] font-bold rounded-md">
                Admin Role
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-xl">
              Want to manage a household lease, track water attendance, and
              coordinate utility billings? Apply for Host status subject to
              Super Admin approval.
            </p>
          </div>
        </div>

        <button
          onClick={() => onNavigate("client_host_application")}
          className="px-4 py-2.5 rounded-xl bg-white text-slate-900 font-bold text-xs hover:bg-slate-100 transition shrink-0 flex items-center gap-2 cursor-pointer shadow-sm"
        >
          <span>Apply as Host</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <JoinHouseholdModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
      />
      <CreateRoomModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => onNavigate("host_household")}
      />
    </div>
  );
};
