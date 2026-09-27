import React, { useState } from "react";
import { useHousehold } from "../../contexts/HouseholdContext";
import { billingService } from "../../services/billingService";
import { calculateRedistributionPlan, formatPesos } from "@propertyflow/shared";
import {
  ArrowLeftRight,
  AlertTriangle,
  CheckCircle2,
  Users,
  Receipt,
  Sparkles,
} from "lucide-react";
import { UniversalLoader } from "../../components/common/UniversalLoader";

export const HostRedistribution: React.FC = () => {
  const { household, activeCycle, members, loading } = useHousehold();

  if (loading && household.householdId) {
    return <UniversalLoader variant="skeleton" type="bills" />;
  }

  const bills = activeCycle
    ? billingService.getMemberBills(
        household.householdId,
        activeCycle.billingCycleId,
      )
    : [];

  // Payors with outstanding unpaid balances
  const unpaidBills = bills.filter(
    (b) => b.outstandingCentavos > 0 && b.userRole === "PAYOR",
  );

  const [selectedSourceUserId, setSelectedSourceUserId] = useState<string>(
    unpaidBills[0]?.userId || "u_p1",
  );

  const selectedBill =
    bills.find((b) => b.userId === selectedSourceUserId) || unpaidBills[0];

  // Recipient payors (excluding the source member)
  const candidateRecipients = members.filter(
    (m) =>
      m.role === "PAYOR" &&
      m.userId !== selectedSourceUserId &&
      m.status === "ACTIVE",
  );

  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>(
    candidateRecipients.map((r) => r.userId),
  );

  const [reason, setReason] = useState(
    "Roommate short payment re-allocation for billing cycle settlement.",
  );

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Calculate live preview plan
  const previewPlan =
    selectedBill && selectedRecipientIds.length > 0
      ? calculateRedistributionPlan(
          selectedBill,
          candidateRecipients
            .filter((c) => selectedRecipientIds.includes(c.userId))
            .map((c) => ({ userId: c.userId, userName: c.displayName })),
          reason,
        )
      : null;

  const toggleRecipient = (userId: string) => {
    if (selectedRecipientIds.includes(userId)) {
      if (selectedRecipientIds.length === 1) {
        alert("At least one recipient must be selected.");
        return;
      }
      setSelectedRecipientIds(
        selectedRecipientIds.filter((id) => id !== userId),
      );
    } else {
      setSelectedRecipientIds([...selectedRecipientIds, userId]);
    }
  };

  const handleExecuteRedistribution = async () => {
    if (!activeCycle || !selectedBill || !previewPlan) return;
    setIsProcessing(true);

    try {
      await billingService.redistributeOutstandingBalance(
        household.householdId,
        activeCycle.billingCycleId,
        selectedBill.userId,
        selectedRecipientIds,
        reason,
      );
      setShowConfirmModal(false);
      alert(
        "Balance redistribution successfully executed! All balances, adjustments, audit logs, and notifications have been recorded.",
      );
    } catch (e: any) {
      alert(`Redistribution failed: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 uppercase tracking-wider">
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>Financial Re-Balancing</span>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 mt-1">
            Centavo-Safe Balance Redistribution
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Evenly split unpaid remaining roommate balances among other active
            payors down to the centavo
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 bg-blue-50 text-blue-700 font-bold text-xs rounded-xl border border-blue-200">
            Active Cycle: {activeCycle?.name || "Current"}
          </span>
        </div>
      </div>

      {unpaidBills.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 border border-slate-200 text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            All Payors Settled
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            There are currently no outstanding unpaid balances in this billing
            cycle to redistribute.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Form & Configuration */}
          <div className="lg:col-span-2 space-y-6">
            {/* Step 1: Select Unpaid Roommate */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900">
                1. Select Roommate with Outstanding Balance
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {unpaidBills.map((b) => (
                  <button
                    key={b.userId}
                    onClick={() => {
                      setSelectedSourceUserId(b.userId);
                      // refresh candidate recipients
                      const recs = members.filter(
                        (m) =>
                          m.role === "PAYOR" &&
                          m.userId !== b.userId &&
                          m.status === "ACTIVE",
                      );
                      setSelectedRecipientIds(recs.map((r) => r.userId));
                    }}
                    className={`p-4 rounded-2xl border text-left transition ${
                      selectedSourceUserId === b.userId
                        ? "border-blue-600 bg-blue-50/50 shadow-xs ring-1 ring-blue-500"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">
                        {b.userName}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                        {b.status}
                      </span>
                    </div>

                    <div className="mt-3 flex items-baseline justify-between">
                      <span className="text-xs text-slate-500">
                        Unpaid Balance:
                      </span>
                      <span className="text-base font-black text-rose-600">
                        {formatPesos(b.outstandingCentavos)}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                      <span>Billed: {formatPesos(b.totalDueCentavos)}</span>
                      <span className="text-emerald-600 font-semibold">
                        Paid: {formatPesos(b.paidCentavos)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Select Recipient Payors */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">
                  2. Select Recipient Payors to Absorb Balance
                </h3>
                <span className="text-xs font-semibold text-blue-600">
                  {selectedRecipientIds.length} Selected
                </span>
              </div>

              <div className="space-y-2">
                {candidateRecipients.map((cand) => {
                  const isChecked = selectedRecipientIds.includes(cand.userId);
                  return (
                    <div
                      key={cand.userId}
                      onClick={() => toggleRecipient(cand.userId)}
                      className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition ${
                        isChecked
                          ? "border-blue-500 bg-blue-50/40"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 pointer-events-none"
                        />
                        <div>
                          <div className="text-xs font-bold text-slate-900">
                            {cand.displayName}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {cand.email}
                          </div>
                        </div>
                      </div>

                      <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                        {cand.role}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Adjustment Record (Audit Trail)
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-blue-600"
                />
              </div>
            </div>
          </div>

          {/* Right 1 Col: Centavo-Safe Preview & Action */}
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-wider">
                <Sparkles className="w-4 h-4" />
                <span>Deterministic Centavo Split</span>
              </div>

              <h4 className="text-base font-extrabold text-slate-900">
                Allocation Breakdown
              </h4>

              {selectedBill && previewPlan ? (
                <div className="space-y-4">
                  <div className="bg-slate-50 rounded-2xl p-4 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Source Payor:</span>
                      <strong className="text-slate-900">
                        {selectedBill.userName}
                      </strong>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Original Bill:</span>
                      <span>{formatPesos(selectedBill.totalDueCentavos)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Paid Amount:</span>
                      <span className="text-emerald-600 font-semibold">
                        {formatPesos(selectedBill.paidCentavos)}
                      </span>
                    </div>
                    <div className="flex justify-between font-bold text-rose-600 pt-1 border-t border-slate-200">
                      <span>Unpaid Balance:</span>
                      <span>
                        {formatPesos(selectedBill.outstandingCentavos)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-[11px] font-bold text-slate-400 uppercase">
                      Calculated Addition Per Recipient:
                    </div>
                    {previewPlan.allocations.map((alloc) => (
                      <div
                        key={alloc.userId}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-blue-50/50 border border-blue-100 text-xs"
                      >
                        <span className="font-semibold text-slate-800">
                          {alloc.userName}
                        </span>
                        <span className="font-black text-blue-700">
                          +{formatPesos(alloc.amountCentavos)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 bg-emerald-50 rounded-xl text-xs text-emerald-800 font-semibold flex items-center justify-between">
                    <span>Sum of Allocations:</span>
                    <span>
                      {formatPesos(previewPlan.totalRedistributedCentavos)}
                    </span>
                  </div>

                  <button
                    onClick={() => setShowConfirmModal(true)}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition text-xs"
                  >
                    Redistribute Outstanding Balance
                  </button>
                </div>
              ) : (
                <p className="text-xs text-slate-400">
                  Select payors to calculate plan.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirmModal && previewPlan && selectedBill && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2 text-amber-600 font-bold text-sm">
              <AlertTriangle className="w-5 h-5" />
              <span>Confirm Redistribution</span>
            </div>

            <h3 className="text-lg font-black text-slate-900 mt-1">
              Apply {formatPesos(previewPlan.totalRedistributedCentavos)}{" "}
              Redistribution?
            </h3>

            <p className="text-xs text-slate-600 mt-1">
              This action atomically writes an immutable Adjustment record,
              increments the recipient roommate bills by the exact centavo
              amounts, updates {selectedBill.userName}'s balance, and notifies
              all affected roommates.
            </p>

            <div className="mt-4 bg-slate-50 rounded-2xl p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">From:</span>
                <span className="font-bold text-slate-900">
                  {selectedBill.userName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Recipients:</span>
                <span className="font-semibold text-slate-800">
                  {previewPlan.allocations
                    .map(
                      (a) => `${a.userName} (${formatPesos(a.amountCentavos)})`,
                    )
                    .join(", ")}
                </span>
              </div>
              <div className="flex justify-between font-bold pt-1 border-t border-slate-200">
                <span>Total Absorbed:</span>
                <span className="text-blue-600">
                  {formatPesos(previewPlan.totalRedistributedCentavos)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteRedistribution}
                disabled={isProcessing}
                className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs"
              >
                {isProcessing ? "Processing..." : "Confirm & Apply"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
