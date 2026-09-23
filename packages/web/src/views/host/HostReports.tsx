import React, { useState } from 'react';
import { useHousehold } from '../../contexts/HouseholdContext';
import { billingService } from '../../services/billingService';
import { paymentService } from '../../services/paymentService';
import { attendanceService } from '../../services/attendanceService';
import { getAppState } from '../../services/store';
import { formatPesos, centavosToPesos } from '@propertyflow/shared';
import { BarChart3, Download, FileSpreadsheet, Receipt, CreditCard, Droplets, ArrowLeftRight } from 'lucide-react';

export const HostReports: React.FC = () => {
  const { household, activeCycle, members } = useHousehold();
  const state = getAppState();

  const [reportType, setReportType] = useState<'BILLING' | 'PAYMENTS' | 'WATER' | 'ADJUSTMENTS'>('BILLING');

  const bills = activeCycle ? billingService.getMemberBills(household.householdId, activeCycle.billingCycleId) : [];
  const payments = paymentService.getPayments(household.householdId, activeCycle?.billingCycleId);
  const adjustments = state.adjustments[household.householdId] || [];
  const waterRecords = activeCycle
    ? attendanceService.getAttendanceForCycle(household.householdId, activeCycle.billingCycleId)
    : [];

  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';

    if (reportType === 'BILLING') {
      csvContent += 'Member,Role,Rent,Internet,Electricity,Water,Custom,Adjustments,Total Due,Paid,Outstanding,Status\n';
      bills.forEach((b) => {
        csvContent += `"${b.userName}","${b.userRole}",${centavosToPesos(b.rentCentavos)},${centavosToPesos(
          b.internetCentavos
        )},${centavosToPesos(b.electricityCentavos)},${centavosToPesos(b.waterCentavos)},${centavosToPesos(
          b.customChargesCentavos
        )},${centavosToPesos(b.adjustmentsCentavos)},${centavosToPesos(b.totalDueCentavos)},${centavosToPesos(
          b.paidCentavos
        )},${centavosToPesos(b.outstandingCentavos)},"${b.status}"\n`;
      });
    } else if (reportType === 'PAYMENTS') {
      csvContent += 'Payment ID,Member,Amount,Method,Reference,Date,Status\n';
      payments.forEach((p) => {
        csvContent += `"${p.paymentId}","${p.userName}",${centavosToPesos(p.amountCentavos)},"${p.paymentMethod}","${
          p.referenceNumber
        }","${p.paymentDate}","${p.status}"\n`;
      });
    } else if (reportType === 'WATER') {
      csvContent += 'Member,Days Present,Daily Rate,Total Water Share\n';
      members.forEach((m) => {
        const pres = waterRecords.filter((a) => a.userId === m.userId && a.status === 'PRESENT').length;
        csvContent += `"${m.displayName}",${pres},5.00,${pres * 5.0}\n`;
      });
    } else {
      csvContent += 'Adjustment ID,Source Member,Reason,Amount,Created Date\n';
      adjustments.forEach((a) => {
        csvContent += `"${a.adjustmentId}","${a.sourceUserName}","${a.reason}",${centavosToPesos(
          a.amountCentavos
        )},"${a.createdDate}"\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PropertyFlow_${reportType}_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 uppercase tracking-wider">
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Financial Statements & Export</span>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 mt-1">Household Financial Reports</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit-ready export for landlord, roommates, or personal records
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
        >
          <Download className="w-4 h-4" /> Export CSV Statement
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setReportType('BILLING')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 ${
            reportType === 'BILLING' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" /> Billing Report
        </button>
        <button
          onClick={() => setReportType('PAYMENTS')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 ${
            reportType === 'PAYMENTS' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" /> Payment Report
        </button>
        <button
          onClick={() => setReportType('WATER')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 ${
            reportType === 'WATER' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Droplets className="w-3.5 h-3.5" /> Water Attendance
        </button>
        <button
          onClick={() => setReportType('ADJUSTMENTS')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 ${
            reportType === 'ADJUSTMENTS' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ArrowLeftRight className="w-3.5 h-3.5" /> Adjustments
        </button>
      </div>

      {/* Report Table */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
        {reportType === 'BILLING' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase text-[10px]">
                  <th className="py-2.5">Roommate</th>
                  <th className="py-2.5">Role</th>
                  <th className="py-2.5">Rent</th>
                  <th className="py-2.5">Internet</th>
                  <th className="py-2.5">Electricity</th>
                  <th className="py-2.5">Water</th>
                  <th className="py-2.5">Custom</th>
                  <th className="py-2.5">Adjustments</th>
                  <th className="py-2.5">Total Due</th>
                  <th className="py-2.5">Paid</th>
                  <th className="py-2.5">Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bills.map((b) => (
                  <tr key={b.billId} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 font-bold text-slate-900">{b.userName}</td>
                    <td className="py-3 text-[10px] text-slate-500">{b.userRole}</td>
                    <td className="py-3">{formatPesos(b.rentCentavos)}</td>
                    <td className="py-3">{formatPesos(b.internetCentavos)}</td>
                    <td className="py-3">{formatPesos(b.electricityCentavos)}</td>
                    <td className="py-3">{formatPesos(b.waterCentavos)}</td>
                    <td className="py-3">{formatPesos(b.customChargesCentavos)}</td>
                    <td className="py-3">{formatPesos(b.adjustmentsCentavos)}</td>
                    <td className="py-3 font-bold text-slate-900">{formatPesos(b.totalDueCentavos)}</td>
                    <td className="py-3 font-semibold text-emerald-600">{formatPesos(b.paidCentavos)}</td>
                    <td className="py-3 font-extrabold text-rose-600">{formatPesos(b.outstandingCentavos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {reportType === 'PAYMENTS' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase text-[10px]">
                  <th className="py-2.5">Roommate</th>
                  <th className="py-2.5">Amount</th>
                  <th className="py-2.5">Method</th>
                  <th className="py-2.5">Reference No.</th>
                  <th className="py-2.5">Date</th>
                  <th className="py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <tr key={p.paymentId} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 font-bold text-slate-900">{p.userName}</td>
                    <td className="py-3 font-black text-blue-600">{formatPesos(p.amountCentavos)}</td>
                    <td className="py-3">{p.paymentMethod}</td>
                    <td className="py-3 font-mono text-slate-600">{p.referenceNumber}</td>
                    <td className="py-3 text-slate-500">{p.paymentDate}</td>
                    <td className="py-3 font-semibold">{p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {reportType === 'WATER' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase text-[10px]">
                  <th className="py-2.5">Roommate</th>
                  <th className="py-2.5">Days Present</th>
                  <th className="py-2.5">Configured Daily Rate</th>
                  <th className="py-2.5">Calculated Water Bill</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.map((m) => {
                  const pres = waterRecords.filter((a) => a.userId === m.userId && a.status === 'PRESENT').length;
                  return (
                    <tr key={m.userId} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 font-bold text-slate-900">{m.displayName}</td>
                      <td className="py-3 font-semibold text-blue-600">{pres} days</td>
                      <td className="py-3">₱5.00/day</td>
                      <td className="py-3 font-black text-slate-900">{formatPesos(pres * 500)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {reportType === 'ADJUSTMENTS' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase text-[10px]">
                  <th className="py-2.5">Adjustment ID</th>
                  <th className="py-2.5">Source Roommate</th>
                  <th className="py-2.5">Amount Redistributed</th>
                  <th className="py-2.5">Reason</th>
                  <th className="py-2.5">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {adjustments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
                      No adjustments recorded yet.
                    </td>
                  </tr>
                ) : (
                  adjustments.map((a) => (
                    <tr key={a.adjustmentId} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 font-mono text-[11px] text-slate-600">{a.adjustmentId}</td>
                      <td className="py-3 font-bold text-slate-900">{a.sourceUserName}</td>
                      <td className="py-3 font-black text-rose-600">{formatPesos(a.amountCentavos)}</td>
                      <td className="py-3 text-slate-600">{a.reason}</td>
                      <td className="py-3 text-slate-500">{new Date(a.createdDate).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

