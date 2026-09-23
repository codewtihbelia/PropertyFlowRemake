import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useHousehold } from '../../contexts/HouseholdContext';
import { getAppState, saveAppState } from '../../services/store';
import { SupportTicket, TicketPriority } from '@propertyflow/shared';
import { User, Shield, Bell, HelpCircle, Save, Send } from 'lucide-react';

export const ClientProfile: React.FC = () => {
  const { currentUser, updateProfile } = useAuth();
  const { household } = useHousehold();
  const state = getAppState();

  const [displayName, setDisplayName] = useState(currentUser.displayName);
  const [phone, setPhone] = useState(currentUser.phoneNumber || '0917-123-4567');
  const [photoUrl, setPhotoUrl] = useState(currentUser.profilePicture || '');

  // Support ticket form
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketCategory, setTicketCategory] = useState<SupportTicket['category']>('BILLING');
  const [ticketPriority, setTicketPriority] = useState<TicketPriority>('MEDIUM');
  const [ticketDesc, setTicketDesc] = useState('');

  const myTickets = state.supportTickets.filter((t) => t.userId === currentUser.uid);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({
      displayName,
      phoneNumber: phone,
      profilePicture: photoUrl,
    });
    alert('Profile updated successfully.');
  };

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSubject || !ticketDesc) return;

    const newTicket: SupportTicket = {
      ticketId: `tkt_${Date.now()}`,
      userId: currentUser.uid,
      userName: currentUser.displayName,
      householdId: household.householdId,
      householdName: household.householdName,
      category: ticketCategory,
      subject: ticketSubject,
      description: ticketDesc,
      priority: ticketPriority,
      status: 'OPEN',
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
    };

    state.supportTickets.unshift(newTicket);
    saveAppState(state);

    setShowTicketModal(false);
    setTicketSubject('');
    setTicketDesc('');
    alert('Support ticket submitted! Platform admins will review your request.');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 uppercase tracking-wider">
          <User className="w-3.5 h-3.5" />
          <span>Account & Profile</span>
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900 mt-1">My Account Settings</h2>
        <p className="text-xs text-slate-500 mt-0.5">Manage personal information and support requests</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile Info Form */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Personal Details</h3>

          <form onSubmit={handleSaveProfile} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-blue-600 font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                disabled
                value={currentUser.email}
                className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 text-slate-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Phone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Role in Household</label>
              <input
                type="text"
                disabled
                value={`${currentUser.role} (${household.apartmentName})`}
                className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 text-slate-500 font-bold cursor-not-allowed"
              />
            </div>

            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" /> Update Profile
            </button>
          </form>
        </div>

        {/* Support Tickets Section */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Support Desk</h3>
              <p className="text-xs text-slate-500">Submit requests to platform support</p>
            </div>
            <button
              onClick={() => setShowTicketModal(true)}
              className="px-3 py-1.5 bg-blue-50 text-blue-700 font-bold rounded-xl text-xs hover:bg-blue-100 transition"
            >
              New Ticket
            </button>
          </div>

          <div className="space-y-2">
            {myTickets.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs">No active support tickets.</div>
            ) : (
              myTickets.map((t) => (
                <div key={t.ticketId} className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">{t.subject}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                      {t.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 line-clamp-2">{t.description}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Support Ticket Modal */}
      {showTicketModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Submit Support Ticket</h3>
            <form onSubmit={handleCreateTicket} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Subject</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Question regarding GCash payment reference"
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={ticketCategory}
                  onChange={(e) => setTicketCategory(e.target.value as any)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-blue-600"
                >
                  <option value="BILLING">Billing & Calculation</option>
                  <option value="PAYMENT">Payment & Verification</option>
                  <option value="ACCOUNT">Account Access</option>
                  <option value="BUG">Technical Bug</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  required
                  rows={3}
                  value={ticketDesc}
                  onChange={(e) => setTicketDesc(e.target.value)}
                  placeholder="Explain your inquiry in detail..."
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-blue-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTicketModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs"
                >
                  Send Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

