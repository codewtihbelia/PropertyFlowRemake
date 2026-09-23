import React, { useState } from 'react';
import { useHousehold } from '../../contexts/HouseholdContext';
import { paymentService } from '../../services/paymentService';
import { Payment, formatPesos } from '@propertyflow/shared';
import {
  CreditCard,
  CheckCircle2,
  XCircle,
  Eye,
  Clock,
  Image,
  Filter,
  AlertCircle,
} from 'lucide-react';

export const HostPayments: React.FC = () => {
  const { household, activeCycle } = useHousehold();
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'VERIFIED' | 'REJECTED'>('ALL');

  const [selectedProofPayment, setSelectedProofPayment] = useState<Payment | null>(null);
  const [rejectModalPayment, setRejectModalPayment] = useState<Payment | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const payments = paymentService.getPayments(household.householdId);

  const filteredPayments = payments.filter((p) => {
    if (filter === 'ALL') return true;
    return p.status === filter;
  });

  const handleApprove = async (payment: Payment) => {
    if (window.confirm(`Approve payment of ${formatPesos(payment.amountCentavos)} from ${payment.userName}?`)) {
      await paymentService.verifyPayment(household.householdId, payment.paymentId, true);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModalPayment || !rejectionReason.trim()) return;

    await paymentService.verifyPayment(
      household.householdId,
      rejectModalPayment.paymentId,
      false,
      rejectionReason
    );
    setRejectModalPayment(null);
    setRejectionReason('');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 uppercase tracking-wider">
            <CreditCard className="w-3.5 h-3.5" />
            <span>Financial Operations</span>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 mt-1">Payment Verifications</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit submitted receipts, approve valid transfers, or decline with feedback
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              filter === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            All ({payments.length})
          </button>
          <button
            onClick={() => setFilter('PENDING')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              filter === 'PENDING' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-700'
            }`}
          >
            Pending ({payments.filter((p) => p.status === 'PENDING').length})
          </button>
          <button
            onClick={() => setFilter('VERIFIED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              filter === 'VERIFIED' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700'
            }`}
          >
            Verified
          </button>
        </div>
      </div>

      {/* Payments Table Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
        {filteredPayments.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">No payment records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase text-[10px]">
                  <th className="py-3">Roommate</th>
                  <th className="py-3">Amount Paid</th>
                  <th className="py-3">Method</th>
                  <th className="py-3">Reference No.</th>
                  <th className="py-3">Date</th>
                  <th className="py-3">Proof of Payment</th>
                  <th className="py-3">Status</th>
                  <th className="py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayments.map((p) => (
                  <tr key={p.paymentId} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 font-bold text-slate-900">{p.userName}</td>
                    <td className="py-3.5 font-extrabold text-blue-600 text-sm">
                      {formatPesos(p.amountCentavos)}
                    </td>
                    <td className="py-3.5">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-semibold rounded-md text-[10px]">
                        {p.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3.5 font-mono text-[11px] text-slate-600">
                      {p.referenceNumber || 'N/A'}
                    </td>
                    <td className="py-3.5 text-slate-500">{p.paymentDate}</td>
                    <td className="py-3.5">
                      {p.proofOfPaymentUrl ? (
                        <button
                          onClick={() => setSelectedProofPayment(p)}
                          className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-semibold text-[11px] flex items-center gap-1 transition"
                        >
                          <Eye className="w-3.5 h-3.5" /> View Receipt
                        </button>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">No proof file</span>
                      )}
                    </td>
                    <td className="py-3.5">
                      <span
                        className={`px-2.5 py-1 rounded-full font-bold text-[10px] ${
                          p.status === 'VERIFIED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : p.status === 'PENDING'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3.5 text-right">
                      {p.status === 'PENDING' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleApprove(p)}
                            className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition"
                            title="Approve & update balances"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setRejectModalPayment(p)}
                            className="p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition"
                            title="Reject with reason"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-medium">Verified</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Proof of Payment Modal */}
      {selectedProofPayment && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Proof of Payment</h3>
                <p className="text-xs text-slate-500">
                  {selectedProofPayment.userName} · {formatPesos(selectedProofPayment.amountCentavos)} (
                  {selectedProofPayment.paymentMethod})
                </p>
              </div>
              <button
                onClick={() => setSelectedProofPayment(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center max-h-96">
              <img
                src={selectedProofPayment.proofOfPaymentUrl}
                alt="Receipt Proof"
                className="w-full h-auto object-contain max-h-96"
              />
            </div>

            <div className="mt-4 text-xs text-slate-600 space-y-1">
              <div>
                Reference Number: <strong>{selectedProofPayment.referenceNumber}</strong>
              </div>
              {selectedProofPayment.notes && (
                <div>
                  Notes: <span className="italic">{selectedProofPayment.notes}</span>
                </div>
              )}
            </div>

            {selectedProofPayment.status === 'PENDING' && (
              <div className="flex items-center justify-end gap-2 mt-5 pt-3 border-t border-slate-100">
                <button
                  onClick={() => {
                    const p = selectedProofPayment;
                    setSelectedProofPayment(null);
                    setRejectModalPayment(p);
                  }}
                  className="px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl"
                >
                  Reject Receipt
                </button>
                <button
                  onClick={() => {
                    handleApprove(selectedProofPayment);
                    setSelectedProofPayment(null);
                  }}
                  className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs"
                >
                  Approve Payment
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectModalPayment && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Decline Payment</h3>
            <p className="text-xs text-slate-500 mt-1">
              Provide a clear reason why {rejectModalPayment.userName}'s payment cannot be verified.
            </p>

            <form onSubmit={handleRejectSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Rejection Reason (Required)
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Reference number does not match bank transaction or amount does not reflect in account."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-rose-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectModalPayment(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
