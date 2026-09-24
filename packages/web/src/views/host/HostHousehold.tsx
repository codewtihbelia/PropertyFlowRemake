import React, { useState } from "react";
import { useHousehold } from "../../contexts/HouseholdContext";
import { UserRole, formatPesos } from "@propertyflow/shared";
import {
  Users,
  UserPlus,
  Shield,
  CheckCircle,
  XCircle,
  Mail,
  Home,
  Plus,
  Clock,
  Check,
  X,
  Receipt,
  Eye,
  Wifi,
  Zap,
  Droplets,
  Layers,
  ArrowLeftRight,
} from "lucide-react";
import { CreateRoomModal } from "../../components/CreateRoomModal";
import { UniversalLoader } from "../../components/common/UniversalLoader";
import { billingService } from "../../services/billingService";

export const HostHousehold: React.FC = () => {
  const {
    household,
    members,
    activeCycle,
    billingCycles,
    inviteMember,
    changeMemberRole,
    deactivateMember,
    approveJoinRequest,
    rejectJoinRequest,
    loading,
  } = useHousehold();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("PAYOR");
  const [selectedMemberForBill, setSelectedMemberForBill] = useState<
    any | null
  >(null);

  // Reject modal state
  const [rejectingMemberId, setRejectingMemberId] = useState<string | null>(
    null,
  );
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const pendingRequests = members.filter((m) => m.status === "PENDING");
  const activeMembers = members.filter(
    (m) => m.status === "ACTIVE" || !m.status,
  );

  const currentBills = activeCycle
    ? billingService.getMemberBills(
        household.householdId,
        activeCycle.billingCycleId,
      )
    : [];

  const getMemberBill = (member: any) => {
    const rawId = (member.userId || member.memberId || "").replace("mem_", "");
    return currentBills.find(
      (b) =>
        b.userId === member.userId ||
        b.userId === member.memberId ||
        b.userId === rawId ||
        b.userId === `mem_${rawId}` ||
        b.userName?.toLowerCase() === member.displayName?.toLowerCase(),
    );
  };

  if (loading) {
    return <UniversalLoader text="Loading household..." />;
  }

  const hasGroup = Boolean(
    household.householdId &&
    household.householdName &&
    household.householdName !== "No household connected",
  );

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !inviteName) return;
    inviteMember(inviteEmail, inviteRole, inviteName);
    setInviteEmail("");
    setInviteName("");
    setShowInviteModal(false);
  };

  const handleApprove = async (memberId: string) => {
    setActionLoading(true);
    const ok = await approveJoinRequest(memberId);
    setActionLoading(false);
    if (ok) {
      alert(
        "Member request approved! The resident is now part of the household.",
      );
    } else {
      alert("Failed to approve request. Please try again.");
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingMemberId) return;
    setActionLoading(true);
    const ok = await rejectJoinRequest(
      rejectingMemberId,
      rejectionReason.trim() || "Request declined by host",
    );
    setActionLoading(false);
    if (ok) {
      setRejectingMemberId(null);
      setRejectionReason("");
      alert("Join request declined.");
    } else {
      alert("Failed to reject request. Please try again.");
    }
  };

  if (!hasGroup) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-3xl p-10 border border-slate-200 text-center max-w-xl mx-auto shadow-xs my-8">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-blue-100">
            <Home className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">
            Create Your Group
          </h3>
          <p className="text-xs text-slate-500 mb-6 max-w-md mx-auto leading-relaxed">
            You don't have a household or apartment group created yet. Set up
            your group name and address to begin inviting roommates.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Create Group
          </button>
        </div>
        <CreateRoomModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 uppercase tracking-wider">
            <Home className="w-3.5 h-3.5" />
            <span>{household.apartmentName}</span>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 mt-1">
            {household.householdName}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">{household.address}</p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Create Group
          </button>
          <button
            onClick={() => setShowInviteModal(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" /> Invite Roommate
          </button>
        </div>
      </div>

      {/* Pending Join Requests (Requires Host Approval) */}
      {pendingRequests.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Pending Join Requests ({pendingRequests.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Review and approve roommates who entered your household invite
                  code
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-200 text-amber-900 px-2.5 py-1 rounded-full">
              Action Required
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs bg-white rounded-2xl border border-amber-100 overflow-hidden">
              <thead>
                <tr className="border-b border-amber-100 bg-amber-50/40 text-slate-500 font-semibold uppercase text-[10px]">
                  <th className="py-3 px-4">Applicant</th>
                  <th className="py-3 px-4">Email Address</th>
                  <th className="py-3 px-4">Request Date</th>
                  <th className="py-3 px-4 text-right">Approval Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100/60">
                {pendingRequests.map((req) => (
                  <tr
                    key={req.memberId}
                    className="hover:bg-amber-50/30 transition"
                  >
                    <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2.5">
                      {req.profilePicture || (req as any)?.photoURL ? (
                        <img
                          src={req.profilePicture || (req as any)?.photoURL}
                          alt={req.displayName}
                          className="w-8 h-8 rounded-full object-cover border border-amber-200"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-xs">
                          {req.displayName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span>{req.displayName}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {req.email || "No email provided"}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {req.requestedDate
                        ? new Date(req.requestedDate).toLocaleDateString()
                        : "Recent"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          disabled={actionLoading}
                          onClick={() => handleApprove(req.memberId)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button
                          disabled={actionLoading}
                          onClick={() => {
                            setRejectingMemberId(req.memberId);
                            setRejectionReason("");
                          }}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Members List */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Household Members
            </h3>
            <p className="text-xs text-slate-500">
              {activeMembers.length} active residents (
              {activeMembers.filter((m) => m.role === "PAYOR").length} Payors,{" "}
              {activeMembers.filter((m) => m.role === "NON_PAYOR").length}{" "}
              Non-Payors)
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase text-[10px]">
                <th className="py-3">Member Name</th>
                <th className="py-3">Email Address</th>
                <th className="py-3">Role</th>
                <th className="py-3">Status</th>
                <th className="py-3">Current Share</th>
                <th className="py-3">Joined Date</th>
                <th className="py-3 text-right">Role Management</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeMembers.map((member) => {
                const mBill = getMemberBill(member);
                return (
                  <tr
                    key={member.memberId}
                    className="hover:bg-slate-50/60 transition"
                  >
                    <td className="py-3.5 font-bold text-slate-900 flex items-center gap-2.5">
                      {member.profilePicture || (member as any)?.photoURL ? (
                        <img
                          src={
                            member.profilePicture || (member as any)?.photoURL
                          }
                          alt={member.displayName}
                          className="w-8 h-8 rounded-full object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                          {member.displayName.charAt(0)}
                        </div>
                      )}
                      <span>{member.displayName}</span>
                    </td>
                    <td className="py-3.5 text-slate-600">{member.email}</td>
                    <td className="py-3.5">
                      <span
                        className={`px-2.5 py-1 rounded-full font-bold text-[10px] ${
                          member.role === "HOST"
                            ? "bg-blue-100 text-blue-800"
                            : member.role === "PAYOR"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-purple-100 text-purple-800"
                        }`}
                      >
                        {member.role}
                      </span>
                    </td>
                    <td className="py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-md font-semibold text-[10px] ${
                          member.status === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {member.status}
                      </span>
                    </td>
                    <td className="py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900">
                          {mBill ? formatPesos(mBill.totalDueCentavos) : "—"}
                        </span>
                        {mBill && (
                          <button
                            onClick={() =>
                              setSelectedMemberForBill({ member, bill: mBill })
                            }
                            className="px-2 py-1 text-[11px] font-bold text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg transition cursor-pointer flex items-center gap-1 shadow-2xs"
                            title="View Share Breakdown"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Breakdown</span>
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 text-slate-500">
                      {member.joinedDate}
                    </td>
                    <td className="py-3.5 text-right">
                      {member.role !== "HOST" && (
                        <div className="flex items-center justify-end gap-1.5">
                          <select
                            value={member.role}
                            onChange={(e) =>
                              changeMemberRole(
                                member.memberId,
                                e.target.value as UserRole,
                              )
                            }
                            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-700 focus:outline-blue-500"
                          >
                            <option value="PAYOR">Payor</option>
                            <option value="NON_PAYOR">Non-Payor</option>
                          </select>
                          {member.status === "ACTIVE" ? (
                            <button
                              onClick={() => deactivateMember(member.memberId)}
                              className="text-rose-600 hover:text-rose-800 text-[11px] font-semibold px-2 py-1 hover:bg-rose-50 rounded-lg transition"
                            >
                              Deactivate
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-medium">
                              Inactive
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Roommate Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-900">
              Invite Roommate to Household
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              An invitation token and notification will be sent to the roommate.
            </p>

            <form onSubmit={handleInviteSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maria Santos"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. maria@splitzy.local"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assigned Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as UserRole)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-blue-600"
                >
                  <option value="PAYOR">
                    Payor (Pays split charges: rent, electricity, net, water)
                  </option>
                  <option value="NON_PAYOR">
                    Non-Payor (Exempt from standard monthly rent split)
                  </option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs"
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Reject Reason Modal */}
      {rejectingMemberId && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Decline Join Request
              </h3>
              <button
                onClick={() => setRejectingMemberId(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Please provide a reason for declining this request. The applicant
              will be informed so they can correct any details or contact you.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason for Rejection
              </label>
              <textarea
                rows={3}
                required
                placeholder="e.g. Unit is already at full capacity / Incorrect apartment group selected."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setRejectingMemberId(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading || !rejectionReason.trim()}
                onClick={handleConfirmReject}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs disabled:opacity-50"
              >
                {actionLoading ? "Declining..." : "Decline Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Member Bill Breakdown Modal */}
      {selectedMemberForBill && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full border border-slate-200 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                {selectedMemberForBill.member.profilePicture ||
                (selectedMemberForBill.member as any)?.photoURL ? (
                  <img
                    src={
                      selectedMemberForBill.member.profilePicture ||
                      (selectedMemberForBill.member as any)?.photoURL
                    }
                    alt={selectedMemberForBill.member.displayName}
                    className="w-10 h-10 rounded-full object-cover border border-slate-200"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm">
                    {selectedMemberForBill.member.displayName.charAt(0)}
                  </div>
                )}
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>{selectedMemberForBill.member.displayName}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        selectedMemberForBill.member.role === "HOST"
                          ? "bg-blue-100 text-blue-800"
                          : selectedMemberForBill.member.role === "PAYOR"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-purple-100 text-purple-800"
                      }`}
                    >
                      {selectedMemberForBill.member.role}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Share breakdown for{" "}
                    {activeCycle?.name || "Current Billing Cycle"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedMemberForBill(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Share Summary Box */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Total Allocated Share
                </span>
                <div className="text-2xl font-black text-slate-900 mt-0.5">
                  {formatPesos(selectedMemberForBill.bill.totalDueCentavos)}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Paid:{" "}
                  <span className="font-bold text-emerald-600">
                    {formatPesos(selectedMemberForBill.bill.paidCentavos)}
                  </span>{" "}
                  · Remaining:{" "}
                  <span className="font-bold text-rose-600">
                    {formatPesos(
                      selectedMemberForBill.bill.outstandingCentavos,
                    )}
                  </span>
                </div>
              </div>
              <span
                className={`px-3 py-1 rounded-full font-bold text-xs ${
                  selectedMemberForBill.bill.status === "PAID"
                    ? "bg-emerald-100 text-emerald-800"
                    : selectedMemberForBill.bill.status === "PARTIALLY_PAID"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-rose-100 text-rose-800"
                }`}
              >
                {selectedMemberForBill.bill.status.replace("_", " ")}
              </span>
            </div>

            {/* Itemized charges */}
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-100 text-xs">
                <div className="flex items-center gap-2.5">
                  <Home className="w-4 h-4 text-blue-600" />
                  <span className="font-bold text-slate-800">Rent Share</span>
                </div>
                <span className="font-black text-slate-900">
                  {formatPesos(selectedMemberForBill.bill.rentCentavos)}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-100 text-xs">
                <div className="flex items-center gap-2.5">
                  <Wifi className="w-4 h-4 text-indigo-600" />
                  <span className="font-bold text-slate-800">
                    Fiber Internet
                  </span>
                </div>
                <span className="font-black text-slate-900">
                  {formatPesos(selectedMemberForBill.bill.internetCentavos)}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-100 text-xs">
                <div className="flex items-center gap-2.5">
                  <Zap className="w-4 h-4 text-amber-600" />
                  <span className="font-bold text-slate-800">
                    Electricity Sub-Meter
                  </span>
                </div>
                <span className="font-black text-slate-900">
                  {formatPesos(selectedMemberForBill.bill.electricityCentavos)}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-100 text-xs">
                <div className="flex items-center gap-2.5">
                  <Droplets className="w-4 h-4 text-cyan-600" />
                  <div>
                    <div className="font-bold text-slate-800">
                      Water Attendance
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {selectedMemberForBill.bill.waterDaysPresent} days present
                    </div>
                  </div>
                </div>
                <span className="font-black text-slate-900">
                  {formatPesos(selectedMemberForBill.bill.waterCentavos)}
                </span>
              </div>

              {selectedMemberForBill.bill.customChargesCentavos > 0 && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-100 text-xs">
                  <div className="flex items-center gap-2.5">
                    <Layers className="w-4 h-4 text-purple-600" />
                    <span className="font-bold text-slate-800">
                      Custom Charges
                    </span>
                  </div>
                  <span className="font-black text-slate-900">
                    {formatPesos(
                      selectedMemberForBill.bill.customChargesCentavos,
                    )}
                  </span>
                </div>
              )}

              {selectedMemberForBill.bill.adjustmentsCentavos !== 0 && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-rose-50 border border-rose-100 text-xs">
                  <div className="flex items-center gap-2.5">
                    <ArrowLeftRight className="w-4 h-4 text-rose-600" />
                    <span className="font-bold text-rose-900">
                      Redistribution Adjustment
                    </span>
                  </div>
                  <span className="font-black text-rose-700">
                    {selectedMemberForBill.bill.adjustmentsCentavos > 0
                      ? "+"
                      : ""}
                    {formatPesos(
                      selectedMemberForBill.bill.adjustmentsCentavos,
                    )}
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedMemberForBill(null)}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Close Breakdown
            </button>
          </div>
        </div>
      )}

      <CreateRoomModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  );
};
