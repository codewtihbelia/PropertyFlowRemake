import React from 'react';
import { adminService } from '../../services/adminService';
import { getAppState } from '../../services/store';
import { Layers, Home, Users } from 'lucide-react';

export const SuperAdminHouseholds: React.FC = () => {
  const households = adminService.getAllHouseholds();
  const state = getAppState();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-semibold text-rose-600 uppercase tracking-wider">
          <Layers className="w-3.5 h-3.5" />
          <span>Platform Inventory</span>
        </div>
        <h2 className="text-2xl font-black text-slate-900 mt-1">Households Directory</h2>
        <p className="text-xs text-slate-500 mt-0.5">Manage all registered households and host assignments</p>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase text-[10px]">
                <th className="py-3">Household Name</th>
                <th className="py-3">Apartment / Unit</th>
                <th className="py-3">Host Contact</th>
                <th className="py-3">Residents Count</th>
                <th className="py-3">Active Billing Cycle</th>
                <th className="py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {households.map((h) => {
                const members = state.members[h.householdId] || [];
                const host = state.users[h.hostId];
                const cycle = state.billingCycles[h.householdId]?.[0];

                return (
                  <tr key={h.householdId} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 font-bold text-slate-900">{h.householdName}</td>
                    <td className="py-3.5 text-slate-600">{h.apartmentName}</td>
                    <td className="py-3.5 text-slate-700">
                      {host?.displayName} ({host?.email})
                    </td>
                    <td className="py-3.5 font-semibold text-blue-600">{members.length} members</td>
                    <td className="py-3.5 text-slate-600">{cycle?.name || 'None'}</td>
                    <td className="py-3.5">
                      <span className="px-2.5 py-0.5 rounded-full font-bold text-[10px] bg-emerald-100 text-emerald-800">
                        {h.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

