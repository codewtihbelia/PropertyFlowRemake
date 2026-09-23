import React from "react";
import { adminService } from "../../services/adminService";
import {
  Shield,
  Layers,
  Users,
  HelpCircle,
  Smartphone,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";

export const SuperAdminDashboard: React.FC<{
  onNavigate: (tab: string) => void;
}> = ({ onNavigate }) => {
  const metrics = adminService.getPlatformMetrics();
  const versions = adminService.getAppVersions();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-rose-600 uppercase tracking-wider">
            <Shield className="w-3.5 h-3.5" />
            <span>Platform Governance</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 mt-1">
            Super Admin Platform Dashboard
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Global oversight of households, users, app releases, and support
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate("admin_host_applications")}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Host Applications</span>
          </button>
        </div>
      </div>

      {/* Host Applications Review Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-3xl shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-white">
              Host Administrator Approval Queue
            </h3>
            <p className="text-xs text-slate-300 mt-0.5 max-w-xl">
              Users who register on Splitzy sign up as standard resident
              members. When members apply to manage a community as Host, review
              and approve their property credentials here.
            </p>
          </div>
        </div>

        <button
          onClick={() => onNavigate("admin_host_applications")}
          className="px-4 py-2.5 rounded-xl bg-white text-slate-900 font-bold text-xs hover:bg-slate-100 transition shrink-0 flex items-center gap-2 cursor-pointer"
        >
          <span>Open Review Queue</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Total Households
            </span>
            <Layers className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-3xl font-black text-slate-900 mt-2">
            {metrics.totalHouseholds}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Managed communities
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Platform Users
            </span>
            <Users className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-3xl font-black text-slate-900 mt-2">
            {metrics.totalUsers}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {metrics.totalHosts} Hosts · {metrics.totalPayors} Payors ·{" "}
            {metrics.totalNonPayors} Non-Payors
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Active Accounts
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-black text-emerald-600 mt-2">
            {metrics.activeUsers}
          </div>
          <div className="text-[11px] text-emerald-700 mt-1">
            {metrics.inactiveUsers} Inactive
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Support Tickets
            </span>
            <HelpCircle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-3xl font-black text-amber-600 mt-2">
            {metrics.openTickets}
          </div>
          <button
            onClick={() => onNavigate("admin_support")}
            className="text-[11px] text-blue-600 hover:underline font-bold mt-1 block"
          >
            Review tickets queue
          </button>
        </div>
      </div>

      {/* App Versions Overview */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">
            App Version Management Matrix
          </h3>
          <button
            onClick={() => onNavigate("admin_versions")}
            className="text-xs text-blue-600 hover:underline font-bold"
          >
            Manage Versions
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {versions.map((ver) => (
            <div
              key={ver.versionId}
              className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-xs text-slate-900">
                  {ver.platform}
                </span>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md">
                  {ver.releaseStatus}
                </span>
              </div>
              <div className="text-xs text-slate-600">
                Latest: <strong>v{ver.latestVersion}</strong> · Min Supported:{" "}
                <strong>v{ver.minimumSupportedVersion}</strong>
              </div>
              <div className="text-[11px] text-slate-500">
                Mandatory Update:{" "}
                {ver.mandatoryUpdate ? "Enabled (Forced)" : "Disabled"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
