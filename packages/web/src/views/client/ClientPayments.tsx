import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useHousehold } from '../../contexts/HouseholdContext';
import { billingService } from '../../services/billingService';
import { paymentService } from '../../services/paymentService';
import { PaymentMethod, formatPesos, pesosToCentavos } from '@propertyflow/shared';
import {
  CreditCard,
  Upload,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  Eye,
  AlertCircle,
} from 'lucide-react';

export const ClientPayments: React.FC = () => {
  const { currentUser } = useAuth();
  const { household, activeCycle } = useHousehold();

  const bills = activeCycle
    ? billingService.getMemberBills(household.householdId, activeCycle.billingCycleId)
    : [];
  const myBill = bills.find((b) => b.userId === currentUser.uid);

  const payments = paymentService.getUserPayments(household.householdId, currentUser.uid);

  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [payAmount, setPayAmount] = useState<string>(
    myBill && myBill.outstandingCentavos > 0
      ? (myBill.outstandingCentavos / 100).toFixed(2)
      : '2000.00'
  );
  const [payMethod, setPayMethod] = useState<PaymentMethod>('GCASH');
  const [refNumber, setRefNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [proofUrl, setProofUrl] = useState(
    'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&auto=format&fit=crop&q=80'
  );
  const [selectedProofPayment, setSelectedProofPayment] = useState<any>(null);

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCycle || !payAmount || !refNumber) return;

    await paymentService.submitPayment(
      household.householdId,
      activeCycle.billingCycleId,
      pesosToCentavos(parseFloat(payAmount)),
      payMethod,
      refNumber,
      proofUrl,
      notes
    );

    setShowSubmitModal(false);
    setRefNumber('');
    setNotes('');
    alert('Payment submitted successfully! The Host has been notified to verify your payment.');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 uppercase tracking-wider">
            <CreditCard className="w-3.5 h-3.5" />
            <span>Payments & Receipts</span>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 mt-1">Submit & View Payments</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Submit full or partial payments with GCash/Maya/Bank reference and receipt proof
          </p>
        </div>

        <button
          onClick={() => setShowSubmitModal(true)}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
        >
          <CreditCard className="w-4 h-4" /> Submit Payment
        </button>
      </div>

      {/* Outstanding Dues Notice */}
      {myBill && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs text-slate-500 font-semibold">Active Cycle Balance</div>
            <div className="text-2xl font-black text-slate-900 mt-1">
              Remaining Due: <span className="text-rose-600">{formatPesos(myBill.outstandingCentavos)}</span>
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Original Share: {formatPesos(myBill.totalDueCentavos)} · Verified Paid:{' '}
              <strong className="text-emerald-600">{formatPesos(myBill.paidCentavos)}</strong>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full font-bold text-xs ${
                myBill.status === 'PAID'
                  ? 'bg-emerald-100 text-emerald-800'
                  : myBill.status === 'PARTIALLY_PAID'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              {myBill.status.replace('_', ' ')}
            </span>
          </div>
        </div>
      )}

      {/* Payment History List */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
        <h3 className="text-base font-bold text-slate-900">Payment Submission History</h3>

        {payments.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-xs">No payment records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase text-[10px]">
                  <th className="py-3">Amount</th>
                  <th className="py-3">Method</th>
                  <th className="py-3">Reference No.</th>
                  <th className="py-3">Date</th>
                  <th className="py-3">Proof</th>
                  <th className="py-3">Status</th>
                  <th className="py-3">Notes / Feedback</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <tr key={p.paymentId} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 font-black text-slate-900 text-sm">{formatPesos(p.amountCentavos)}</td>
                    <td className="py-3.5">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-semibold rounded-md text-[10px]">
                        {p.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3.5 font-mono text-slate-600">{p.referenceNumber}</td>
                    <td className="py-3.5 text-slate-500">{p.paymentDate}</td>
                    <td className="py-3.5">
                      {p.proofOfPaymentUrl ? (
                        <button
                          onClick={() => setSelectedProofPayment(p)}
                          className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-semibold text-[11px] flex items-center gap-1 transition"
                        >
                          <Eye className="w-3.5 h-3.5" /> View
                        </button>
                      ) : (
                        <span className="text-slate-400 italic">None</span>
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
                    <td className="py-3.5 text-slate-600 text-[11px] max-w-xs truncate">
                      {p.rejectionReason ? (
                        <span className="text-rose-600 font-medium">Declined: {p.rejectionReason}</span>
                      ) : (
                        p.notes || '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Submit Payment Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-black text-slate-900">Submit Payment</h3>
            <p className="text-xs text-slate-500 mt-1">
              Enter payment details and upload proof screenshot for Host verification.
            </p>

            <form onSubmit={handleSubmitPayment} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Amount (₱ Pesos)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-blue-600 font-bold"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Supports full or partial payment (e.g. ₱2,000 on a ₱2,219.50 bill).
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Channel</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-blue-600"
                >
                  <option value="GCASH">GCash</option>
                  <option value="MAYA">Maya</option>
                  <option value="BANK_TRANSFER">Bank Transfer (BDO / BPI / UnionBank)</option>
                  <option value="CASH">Cash directly to Host</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Transaction Reference Number
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. GCASH-98234710"
                  value={refNumber}
                  onChange={(e) => setRefNumber(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-blue-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Receipt Image Proof URL
                </label>
                <input
                  type="text"
                  value={proofUrl}
                  onChange={(e) => setProofUrl(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-blue-600 text-[11px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Partial payment for August rent, remaining will settle next week"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-blue-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs"
                >
                  Submit Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Proof View Modal */}
      {selectedProofPayment && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Receipt Proof</h3>
              <button onClick={() => setSelectedProofPayment(null)} className="text-slate-400">✕</button>
            </div>
            <div className="mt-4 rounded-2xl overflow-hidden bg-slate-50 border border-slate-200">
              <img src={selectedProofPayment.proofOfPaymentUrl} alt="Proof" className="w-full h-auto max-h-80 object-contain" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
