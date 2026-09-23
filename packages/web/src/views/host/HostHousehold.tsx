import React, { useState } from "react";
import { useHousehold } from "../../contexts/HouseholdContext";
import { UserRole } from "@propertyflow/shared";
import {
  Users,
  UserPlus,
  Shield,
  CheckCircle,
  XCircle,
  Mail,
  Home,
  Plus,
} from "lucide-react";
import { CreateRoomModal } from "../../components/CreateRoomModal";
import { UniversalLoader } from "../../components/common/UniversalLoader";

export const HostHousehold: React.FC = () => {
  const {
    household,
    members,
    inviteMember,
    changeMemberRole,
    deactivateMember,
    loading,
  } = useHousehold();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("PAYOR");

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

        <button
          onClick={() => setShowInviteModal(true)}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
        >
          <UserPlus className="w-4 h-4" /> Invite Roommate
        </button>
      </div>

      {/* Members List */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Household Members
            </h3>
            <p className="text-xs text-slate-500">
              {members.length} registered residents (
              {members.filter((m) => m.role === "PAYOR").length} Payors,{" "}
              {members.filter((m) => m.role === "NON_PAYOR").length} Non-Payors)
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
                <th className="py-3">Joined Date</th>
                <th className="py-3 text-right">Role Management</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((member) => (
                <tr
                  key={member.memberId}
                  className="hover:bg-slate-50/60 transition"
                >
                  <td className="py-3.5 font-bold text-slate-900 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                      {member.displayName.charAt(0)}
                    </div>
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
                  <td className="py-3.5 text-slate-500">{member.joinedDate}</td>
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
              ))}
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
    </div>
  );
};
