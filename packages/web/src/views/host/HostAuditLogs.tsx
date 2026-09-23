import React from 'react';
import { getAppState } from '../../services/store';
import { History, Shield, Clock } from 'lucide-react';

export const HostAuditLogs: React.FC = () => {
  const state = getAppState();
  const logs = state.auditLogs;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 uppercase tracking-wider">
          <History className="w-3.5 h-3.5" />
          <span>Security & Compliance</span>
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900 mt-1">Immutable Activity Logs</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Tamper-evident trail of all financial actions, finalizations, payment approvals, and redistributions
        </p>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase text-[10px]">
                <th className="py-3">Timestamp</th>
                <th className="py-3">Actor</th>
                <th className="py-3">Role</th>
                <th className="py-3">Action</th>
                <th className="py-3">Entity</th>
                <th className="py-3">Details / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => (
                <tr key={log.logId} className="hover:bg-slate-50/60 transition">
                  <td className="py-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="py-3 font-bold text-slate-900">{log.actorName}</td>
                  <td className="py-3">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-semibold text-[10px]">
                      {log.role}
                    </span>
                  </td>
                  <td className="py-3 font-semibold text-blue-600">{log.action}</td>
                  <td className="py-3 font-mono text-[11px] text-slate-600">{log.entity}</td>
                  <td className="py-3 text-slate-600 max-w-xs truncate">
                    {log.reason ? `Reason: ${log.reason}` : JSON.stringify(log.newValue || {})}
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

