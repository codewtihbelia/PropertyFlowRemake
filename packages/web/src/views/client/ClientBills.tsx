import React, { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useHousehold } from "../../contexts/HouseholdContext";
import { billingService } from "../../services/billingService";
import { formatPesos } from "@propertyflow/shared";
import {
  Receipt,
  Home,
  Wifi,
  Zap,
  Droplets,
  Layers,
  ArrowLeftRight,
  CheckCircle2,
  AlertCircle,
  Users,
  User,
} from "lucide-react";

export const ClientBills: React.FC<{ onPayClick: () => void }> = ({
  onPayClick,
}) => {
  const { currentUser } = useAuth();
  const { household, billingCycles, activeCycle, members } = useHousehold();

  const [selectedCycleId, setSelectedCycleId] = useState<string>(
    activeCycle?.billingCycleId || billingCycles[0]?.billingCycleId || "",
  );
  const [selectedMemberId, setSelectedMemberId] = useState<string>(
    currentUser.uid,
  );

  const currentCycle =
    billingCycles.find((c) => c.billingCycleId === selectedCycleId) ||
    billingCycles[0];

  const bills = currentCycle
    ? billingService.getMemberBills(
        household.householdId,
        currentCycle.billingCycleId,
      )
    : [];

  const activeMembersList = members.filter(
    (m) => m.status === "ACTIVE" || !m.status,
  );

  const targetMember =
    activeMembersList.find(
      (m) =>
        m.userId === selectedMemberId ||
        m.memberId === selectedMemberId ||
        m.userId === `mem_${selectedMemberId}` ||
        selectedMemberId === `mem_${m.userId}`,
    ) ||
    activeMembersList.find(
      (m) => m.userId === currentUser.uid || m.memberId === currentUser.uid,
    ) ||
    activeMembersList[0];

  const targetUserId =
    targetMember?.userId || targetMember?.memberId || selectedMemberId;
  const rawTargetId = targetUserId ? targetUserId.replace("mem_", "") : "";

  const displayBill =
    bills.find(
      (b) =>
        b.userId === targetUserId ||
        b.userId === rawTargetId ||
        b.userId === `mem_${rawTargetId}` ||
        (targetMember &&
          b.userName?.toLowerCase() ===
            targetMember.displayName?.toLowerCase()),
    ) ||
    (selectedMemberId === currentUser.uid
      ? bills.find((b) => b.userId === currentUser.uid)
      : undefined) ||
    bills[0];

  const isViewingSelf =
    targetMember?.userId === currentUser.uid ||
    targetMember?.memberId === currentUser.uid ||
    selectedMemberId === currentUser.uid;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 uppercase tracking-wider">
            <Receipt className="w-3.5 h-3.5" />
            <span>
              {isViewingSelf
                ? "My Individual Statement"
                : `${targetMember?.displayName || "Member"}'s Statement`}
            </span>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 mt-1">
            Roommate Bill Breakdown
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Transparent breakdown of individual shares for rent, utilities,
            water attendance, and adjustments
          </p>
        </div>

        <select
          value={selectedCycleId}
          onChange={(e) => setSelectedCycleId(e.target.value)}
          className="px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-blue-600"
        >
          {billingCycles.map((c) => (
            <option key={c.billingCycleId} value={c.billingCycleId}>
              {c.name} ({c.status})
            </option>
          ))}
        </select>
      </div>

      {/* Roommate Switcher Strip */}
      {activeMembersList.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 px-1">
          <span className="text-xs font-bold text-slate-400 mr-1 flex items-center gap-1 shrink-0">
            <Users className="w-3.5 h-3.5" /> Roommate:
          </span>
          {activeMembersList.map((m) => {
            const isMe =
              m.userId === currentUser.uid || m.memberId === currentUser.uid;
            const isSelected =
              m.userId === selectedMemberId ||
              m.memberId === selectedMemberId ||
              (isMe && selectedMemberId === currentUser.uid);
            return (
              <button
                key={m.memberId || m.userId}
                onClick={() => setSelectedMemberId(m.userId || m.memberId)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                <span>{m.displayName}</span>
                {isMe && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      isSelected
                        ? "bg-blue-700 text-blue-100"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    You
                  </span>
                )}
                {m.role === "NON_PAYOR" && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-purple-100 text-purple-700">
                    Non-Payor
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {!displayBill ? (
        <div className="bg-white rounded-3xl p-10 border border-slate-200 text-center text-slate-400 text-xs">
          No finalized bill record found for{" "}
          {targetMember?.displayName || "this member"} in this cycle.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Main Summary Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Total Allocated Share
                </span>
                {!isViewingSelf && (
                  <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                    {targetMember?.displayName}
                  </span>
                )}
              </div>
              <div className="text-4xl font-black text-slate-900 mt-1">
                {formatPesos(displayBill.totalDueCentavos)}
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs">
                <span className="text-slate-500">Paid:</span>
                <span className="font-bold text-emerald-600">
                  {formatPesos(displayBill.paidCentavos)}
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-slate-500">Remaining Due:</span>
                <span className="font-black text-rose-600">
                  {formatPesos(displayBill.outstandingCentavos)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span
                className={`px-3 py-1 rounded-full font-bold text-xs ${
                  displayBill.status === "PAID"
                    ? "bg-emerald-100 text-emerald-800"
                    : displayBill.status === "PARTIALLY_PAID"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-rose-100 text-rose-800"
                }`}
              >
                {displayBill.status.replace("_", " ")}
              </span>

              {isViewingSelf && displayBill.outstandingCentavos > 0 && (
                <button
                  onClick={onPayClick}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
                >
                  Pay Now
                </button>
              )}
            </div>
          </div>

          {/* Breakdown Items List */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Itemized Charges Breakdown
            </h3>

            <div className="space-y-3">
              {/* Rent */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                    <Home className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      Apartment Rent
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Equal split among active payors
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black text-slate-900">
                    {formatPesos(displayBill.rentCentavos)}
                  </div>
                </div>
              </div>

              {/* Internet */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                    <Wifi className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      Fiber Internet 300Mbps
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Shared household internet
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black text-slate-900">
                    {formatPesos(displayBill.internetCentavos)}
                  </div>
                </div>
              </div>

              {/* Electricity */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      Electricity Sub-Meter
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Shared electricity consumption
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black text-slate-900">
                    {formatPesos(displayBill.electricityCentavos)}
                  </div>
                </div>
              </div>

              {/* Water */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-cyan-100 text-cyan-700 flex items-center justify-center font-bold">
                    <Droplets className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      Water Attendance Share
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {displayBill.waterDaysPresent} days present @ ₱5.00/day
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black text-slate-900">
                    {formatPesos(displayBill.waterCentavos)}
                  </div>
                </div>
              </div>

              {/* Custom Charges */}
              {displayBill.customChargesCentavos > 0 && (
                <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        Custom Household Expenses
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Cleaning / Maintenance / Supplies
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-slate-900">
                      {formatPesos(displayBill.customChargesCentavos)}
                    </div>
                  </div>
                </div>
              )}

              {/* Adjustments */}
              {displayBill.adjustmentsCentavos !== 0 && (
                <div className="flex items-center justify-between p-4 rounded-2xl bg-rose-50 border border-rose-100">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                      <ArrowLeftRight className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-rose-900">
                        Balance Adjustments / Redistribution
                      </div>
                      <div className="text-[11px] text-rose-700">
                        Host approved balance re-allocation
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-rose-700">
                      {displayBill.adjustmentsCentavos > 0 ? "+" : ""}
                      {formatPesos(displayBill.adjustmentsCentavos)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
