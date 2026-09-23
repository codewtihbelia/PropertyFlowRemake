import React, { useState } from 'react';
import { adminService } from '../../services/adminService';
import { SupportTicket } from '@propertyflow/shared';
import { HelpCircle, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

export const SuperAdminSupport: React.FC = () => {
  const tickets = adminService.getSupportTickets();
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(tickets[0] || null);
  const [replyText, setReplyText] = useState('');

  const handleUpdateStatus = (status: SupportTicket['status']) => {
    if (!selectedTicket) return;
    adminService.updateTicketStatus(selectedTicket.ticketId, status);
    setSelectedTicket({ ...selectedTicket, status });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-semibold text-rose-600 uppercase tracking-wider">
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Customer & User Support</span>
        </div>
        <h2 className="text-2xl font-black text-slate-900 mt-1">Platform Support Desk</h2>
        <p className="text-xs text-slate-500 mt-0.5">Manage user inquiries, technical reports, and billing appeals</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Ticket List */}
        <div className="space-y-2">
          {tickets.map((t) => (
            <button
              key={t.ticketId}
              onClick={() => setSelectedTicket(t)}
              className={`w-full p-4 rounded-2xl border text-left transition ${
                selectedTicket?.ticketId === t.ticketId
                  ? 'border-blue-600 bg-blue-50/50 shadow-xs ring-1 ring-blue-500'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-900 truncate">{t.subject}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    t.status === 'RESOLVED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {t.status}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {t.userName} · {t.householdName}
              </div>
            </button>
          ))}
        </div>

        {/* Ticket Detail */}
        <div className="md:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          {selectedTicket ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                    {selectedTicket.category} · Priority: {selectedTicket.priority}
                  </span>
                  <h3 className="text-base font-black text-slate-900 mt-0.5">
                    {selectedTicket.subject}
                  </h3>
                  <div className="text-xs text-slate-500 mt-0.5">
                    From: {selectedTicket.userName} ({selectedTicket.householdName})
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleUpdateStatus('IN_PROGRESS')}
                    className="px-3 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 font-bold text-xs rounded-xl transition"
                  >
                    In Progress
                  </button>
                  <button
                    onClick={() => handleUpdateStatus('RESOLVED')}
                    className="px-3 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs rounded-xl transition"
                  >
                    Resolve
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-700 leading-relaxed">
                {selectedTicket.description}
              </div>

              <div className="space-y-2 pt-2">
                <label className="block text-xs font-semibold text-slate-700">Staff Response</label>
                <textarea
                  rows={3}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type an official response to the user..."
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-blue-600"
                />
                <button
                  onClick={() => {
                    alert('Response sent to user.');
                    setReplyText('');
                    handleUpdateStatus('RESOLVED');
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
                >
                  Send Response & Mark Resolved
                </button>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 text-xs">Select a ticket to review.</div>
          )}
        </div>
      </div>
    </div>
  );
};

