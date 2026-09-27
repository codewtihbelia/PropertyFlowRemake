import React from "react";
import { adminService } from "../../services/adminService";
import { Users, Shield, CheckCircle, XCircle } from "lucide-react";
import { UniversalLoader } from "../../components/common/UniversalLoader";

export const SuperAdminUsers: React.FC<{ loading?: boolean }> = ({
  loading = false,
}) => {
  const users = adminService.getAllUsers();

  if (loading) {
    return <UniversalLoader variant="skeleton" type="table" count={6} />;
  }

  const handleToggleStatus = (userId: string, currentStatus: string) => {
    const next = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    adminService.setUserStatus(userId, next);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-semibold text-rose-600 uppercase tracking-wider">
          <Users className="w-3.5 h-3.5" />
          <span>User Directory</span>
        </div>
        <h2 className="text-2xl font-black text-slate-900 mt-1">
          Platform User Accounts
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Manage accounts, permissions, and suspension states
        </p>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase text-[10px]">
                <th className="py-3">User Name</th>
                <th className="py-3">Email Address</th>
                <th className="py-3">Global Role</th>
                <th className="py-3">Status</th>
                <th className="py-3">Created Date</th>
                <th className="py-3 text-right">Account Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.uid} className="hover:bg-slate-50/60 transition">
                  <td className="py-3.5 font-bold text-slate-900">
                    {u.displayName}
                  </td>
                  <td className="py-3.5 text-slate-600">{u.email}</td>
                  <td className="py-3.5">
                    <span
                      className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                        u.role === "SUPER_ADMIN"
                          ? "bg-rose-100 text-rose-800"
                          : u.role === "HOST"
                            ? "bg-blue-100 text-blue-800"
                            : u.role === "PAYOR"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-purple-100 text-purple-800"
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3.5">
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        u.accountStatus === "ACTIVE"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {u.accountStatus}
                    </span>
                  </td>
                  <td className="py-3.5 text-slate-500">
                    {new Date(u.createdDate).toLocaleDateString()}
                  </td>
                  <td className="py-3.5 text-right">
                    {u.role !== "SUPER_ADMIN" && (
                      <button
                        onClick={() =>
                          handleToggleStatus(u.uid, u.accountStatus)
                        }
                        className={`px-3 py-1 rounded-lg text-[11px] font-bold transition ${
                          u.accountStatus === "ACTIVE"
                            ? "bg-rose-50 text-rose-700 hover:bg-rose-100"
                            : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        }`}
                      >
                        {u.accountStatus === "ACTIVE"
                          ? "Deactivate"
                          : "Activate"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
