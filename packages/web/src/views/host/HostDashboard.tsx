import React, { useState } from "react";
import { useHousehold } from "../../contexts/HouseholdContext";
import { paymentService } from "../../services/paymentService";
import { billingService } from "../../services/billingService";
import { getAppState } from "../../services/store";
import { formatPesos } from "@propertyflow/shared";
import { CreateRoomModal } from "../../components/CreateRoomModal";
import { JoinHouseholdModal } from "../../components/common/JoinHouseholdModal";
import { UniversalLoader } from "../../components/common/UniversalLoader";
import {
  CreditCard,
  Receipt,
  Users,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Droplets,
  Zap,
  Plus,
  Home,
  Sparkles,
  KeyRound,
  Copy,
  Check,
} from "lucide-react";

export const HostDashboard: React.FC<{ onNavigate: (tab: string) => void }> = ({
  onNavigate,
}) => {
  const { household, members, activeCycle, loading } = useHousehold();
  const state = getAppState();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const hasGroup = Boolean(
    household.householdId &&
    household.householdName &&
    household.householdName !== "No household connected",
  );

  const displayCode =
    household.inviteCode ||
    (household.householdId
      ? `PF-${household.householdId.slice(-4).toUpperCase()}`
      : "PF-402");

  const handleCopyCode = () => {
    navigator.clipboard.writeText(displayCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const currentBills = activeCycle
    ? billingService.getMemberBills(
        household.householdId,
        activeCycle.billingCycleId,
      )
    : [];
  const payments = paymentService.getPayments(
    household.householdId,
    activeCycle?.billingCycleId,
  );
  const pendingPayments = payments.filter((p) => p.status === "PENDING");

  const totalBilledCentavos = currentBills.reduce(
    (acc, b) => acc + b.totalDueCentavos,
    0,
  );
  const totalCollectedCentavos = currentBills.reduce(
    (acc, b) => acc + b.paidCentavos,
    0,
  );
  const totalOutstandingCentavos = currentBills.reduce(
    (acc, b) => acc + b.outstandingCentavos,
    0,
  );

  const paidMembersCount = currentBills.filter(
    (b) => b.status === "PAID" && b.totalDueCentavos > 0,
  ).length;
  const partialMembersCount = currentBills.filter(
    (b) => b.status === "PARTIALLY_PAID",
  ).length;
  const unpaidMembersCount = currentBills.filter(
    (b) => b.status === "UNPAID" && b.totalDueCentavos > 0,
  ).length;

  const recentAdjustments = state.adjustments[household.householdId] || [];
  const recentLogs = state.auditLogs.slice(0, 5);

  return (
    <div className="relative space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-blue-600 uppercase tracking-wider">
            <span>
              {hasGroup
                ? household.householdName
                : "Host Account • Setup Required"}
            </span>
            <span>•</span>
            <span>
              {hasGroup
                ? activeCycle?.name || "No Active Cycle"
                : "No Group Created"}
            </span>
            {hasGroup && (
              <span className="flex items-center gap-1.5 ml-2 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 font-mono font-bold text-xs normal-case">
                <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                <span>Invite Code: {displayCode}</span>
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
          <h2 className="text-2xl font-extrabold text-slate-900 mt-1">
            Host Overview Dashboard
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {hasGroup
              ? `${members.length} Household Members (${members.filter((m) => m.role === "PAYOR").length} Payors, ${members.filter((m) => m.role === "NON_PAYOR").length} Non-Payors)`
              : "You are approved as a Host! Create a group or join with an invite code."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {hasGroup ? (
            <>
              <button
                onClick={() => onNavigate("host_household")}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Users className="w-4 h-4" /> Manage Group
              </button>
              <button
                onClick={() => onNavigate("host_billing")}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Receipt className="w-4 h-4" /> Manage Billing
              </button>
              <button
                onClick={() => onNavigate("host_payments")}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <CreditCard className="w-4 h-4" /> Verify Payments (
                {pendingPayments.length})
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsJoinModalOpen(true)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <KeyRound className="w-4 h-4 text-blue-600" /> Join Group with
                Code
              </button>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Create Group
              </button>
            </div>
          )}
        </div>
      </div>

      {!hasGroup ? (
        /* Empty State for Host with no group yet */
        <div className="bg-white rounded-3xl p-10 border border-slate-200 text-center max-w-xl mx-auto shadow-xs my-8">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-blue-100">
            <Home className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">
            Create or Join a Household Group
          </h3>
          <p className="text-xs text-slate-500 mb-6 max-w-md mx-auto leading-relaxed">
            As an approved Host, you can create a group for your apartment or
            condo, or connect to an existing group using an invite code.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Create New Group
            </button>
            <button
              onClick={() => setIsJoinModalOpen(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl border border-slate-200 transition cursor-pointer"
            >
              <KeyRound className="w-4 h-4 text-blue-600" /> Enter Invite Code
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Primary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Billed */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">
                  Total Billed
                </span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Receipt className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-slate-900 mt-2">
                {formatPesos(totalBilledCentavos)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                For active billing cycle
              </div>
            </div>

            {/* Collected */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">
                  Collected Amount
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-emerald-600 mt-2">
                {formatPesos(totalCollectedCentavos)}
              </div>
              <div className="text-[11px] text-emerald-700 mt-1">
                {totalBilledCentavos > 0
                  ? `${Math.round((totalCollectedCentavos / totalBilledCentavos) * 100)}% collection rate`
                  : "0%"}
              </div>
            </div>

            {/* Outstanding */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">
                  Outstanding Balance
                </span>
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <AlertCircle className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-rose-600 mt-2">
                {formatPesos(totalOutstandingCentavos)}
              </div>
              <div className="text-[11px] text-rose-600 mt-1">
                Remaining to collect
              </div>
            </div>

            {/* Pending Verification */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">
                  Pending Verification
                </span>
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-amber-600 mt-2">
                {pendingPayments.length} Payments
              </div>
              <button
                onClick={() => onNavigate("host_payments")}
                className="text-[11px] text-blue-600 hover:underline font-semibold mt-1 flex items-center gap-1"
              >
                Review receipts <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Member Collection Status Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Member Bills Summary Table */}
            <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Member Billing Status
                  </h3>
                  <p className="text-xs text-slate-500">
                    Breakdown of payments per roommate
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-semibold text-[11px]">
                    {paidMembersCount} Paid
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-semibold text-[11px]">
                    {partialMembersCount} Partial
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 font-semibold text-[11px]">
                    {unpaidMembersCount} Unpaid
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase text-[10px]">
                      <th className="py-2.5">Member</th>
                      <th className="py-2.5">Role</th>
                      <th className="py-2.5">Billed</th>
                      <th className="py-2.5">Paid</th>
                      <th className="py-2.5">Outstanding</th>
                      <th className="py-2.5">Status</th>
                      <th className="py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentBills.map((bill) => (
                      <tr
                        key={bill.billId}
                        className="hover:bg-slate-50/60 transition"
                      >
                        <td className="py-3 font-semibold text-slate-900">
                          {bill.userName}
                        </td>
                        <td className="py-3">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md font-medium text-[10px]">
                            {bill.userRole}
                          </span>
                        </td>
                        <td className="py-3 font-medium text-slate-700">
                          {formatPesos(bill.totalDueCentavos)}
                        </td>
                        <td className="py-3 font-semibold text-emerald-600">
                          {formatPesos(bill.paidCentavos)}
                        </td>
                        <td className="py-3 font-bold text-rose-600">
                          {formatPesos(bill.outstandingCentavos)}
                        </td>
                        <td className="py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              bill.status === "PAID"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : bill.status === "PARTIALLY_PAID"
                                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                                  : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}
                          >
                            {bill.status}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          {bill.outstandingCentavos > 0 && (
                            <button
                              onClick={() => onNavigate("host_redistribution")}
                              className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-[11px] font-semibold transition"
                              title="Redistribute unpaid balance"
                            >
                              Redistribute
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right 1 Col: Quick Actions & Recent Activity */}
            <div className="space-y-6">
              {/* Quick Actions Card */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs">
                <h4 className="text-sm font-bold text-slate-900 mb-3">
                  Host Operations
                </h4>
                <div className="space-y-2">
                  <button
                    onClick={() => onNavigate("host_attendance")}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 transition text-xs font-semibold"
                  >
                    <div className="flex items-center gap-2.5">
                      <Droplets className="w-4 h-4 text-blue-500" />
                      <span>Check Water Attendance</span>
                    </div>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => onNavigate("host_billing")}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 transition text-xs font-semibold"
                  >
                    <div className="flex items-center gap-2.5">
                      <Zap className="w-4 h-4 text-amber-500" />
                      <span>Update Electricity Meter</span>
                    </div>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => onNavigate("host_redistribution")}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 transition text-xs font-semibold"
                  >
                    <div className="flex items-center gap-2.5">
                      <Users className="w-4 h-4 text-indigo-500" />
                      <span>Redistribute Unpaid Balance</span>
                    </div>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Audit Activity Card */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs">
                <h4 className="text-sm font-bold text-slate-900 mb-3">
                  Recent Activity
                </h4>
                <div className="space-y-3">
                  {recentLogs.map((log) => (
                    <div
                      key={log.logId}
                      className="flex items-start gap-2.5 text-xs"
                    >
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                      <div>
                        <div className="font-semibold text-slate-800">
                          {log.action.replace(/_/g, " ")}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(log.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <CreateRoomModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      <JoinHouseholdModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
      />
    </div>
  );
};
