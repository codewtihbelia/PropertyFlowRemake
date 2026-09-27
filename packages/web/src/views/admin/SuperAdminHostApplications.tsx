import React, { useState, useEffect } from "react";
import { firebaseDataService } from "../../services/firebaseDataService";
import { HostApplication } from "@splitzy/shared";
import { UniversalLoader } from "../../components/common/UniversalLoader";
import {
  Building2,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  User,
  Home,
  Phone,
  DollarSign,
  FileText,
  AlertCircle,
  Check,
  X,
  MessageSquare,
} from "lucide-react";

export const SuperAdminHostApplications: React.FC = () => {
  const [applications, setApplications] = useState<HostApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<
    "ALL" | "PENDING" | "APPROVED" | "REJECTED"
  >("PENDING");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedApp, setSelectedApp] = useState<HostApplication | null>(null);
  const [reviewAction, setReviewAction] = useState<"APPROVE" | "REJECT" | null>(
    null,
  );
  const [feedback, setFeedback] = useState("");
  const [processing, setProcessing] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    const unsubscribe = firebaseDataService.listenToHostApplications((apps) => {
      setApplications(apps);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleReview = async () => {
    const targetAppId = selectedApp?.applicationId || selectedApp?.id;
    if (!selectedApp || !targetAppId || !reviewAction) return;

    setProcessing(true);
    try {
      const status = reviewAction === "APPROVE" ? "APPROVED" : "REJECTED";
      await firebaseDataService.reviewHostApplication(
        targetAppId,
        status,
        feedback.trim(),
      );

      setNotification({
        type: "success",
        text: `Application for ${selectedApp.applicantName} has been ${status.toLowerCase()}!`,
      });
      setSelectedApp(null);
      setReviewAction(null);
      setFeedback("");
    } catch (err: any) {
      setNotification({
        type: "error",
        text: err.message || "Failed to review host application.",
      });
    } finally {
      setProcessing(false);
    }
  };

  const filtered = applications.filter((app) => {
    const matchesFilter = filter === "ALL" || app.status === filter;
    const nameStr = (app.applicantName || "").toLowerCase();
    const emailStr = (app.userEmail || app.applicantEmail || "").toLowerCase();
    const addressStr = (app.propertyAddress || "").toLowerCase();
    const reasonStr = (app.reasonForApplying || app.reason || "").toLowerCase();
    const phoneStr = (
      app.phoneNumber ||
      app.applicantPhone ||
      ""
    ).toLowerCase();
    const q = searchQuery.trim().toLowerCase();

    const matchesSearch =
      !q ||
      nameStr.includes(q) ||
      emailStr.includes(q) ||
      addressStr.includes(q) ||
      reasonStr.includes(q) ||
      phoneStr.includes(q);
    return matchesFilter && matchesSearch;
  });

  const pendingCount = applications.filter(
    (a) => a.status === "PENDING",
  ).length;
  const approvedCount = applications.filter(
    (a) => a.status === "APPROVED",
  ).length;
  const rejectedCount = applications.filter(
    (a) => a.status === "REJECTED",
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-rose-600 uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Super Admin Governance</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 mt-1">
            Host Applications Queue
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Review and approve user requests to become household Host
            Administrators.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {pendingCount > 0 ? (
            <span className="px-3 py-1.5 bg-amber-50 text-amber-700 font-bold text-xs rounded-xl flex items-center gap-1.5 border border-amber-200">
              <Clock className="w-3.5 h-3.5" /> {pendingCount} Pending Review
            </span>
          ) : (
            <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-xl flex items-center gap-1.5 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" /> Queue Clear
            </span>
          )}
        </div>
      </div>

      {notification && (
        <div
          className={`p-4 rounded-2xl text-xs flex items-center justify-between ${
            notification.type === "success"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
              : "bg-rose-50 border border-rose-200 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>{notification.text}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-xs font-bold hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Filter Pills */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setFilter("PENDING")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              filter === "PENDING"
                ? "bg-amber-500 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Pending ({pendingCount})</span>
          </button>

          <button
            onClick={() => setFilter("APPROVED")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              filter === "APPROVED"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Approved ({approvedCount})</span>
          </button>

          <button
            onClick={() => setFilter("REJECTED")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              filter === "REJECTED"
                ? "bg-rose-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Rejected ({rejectedCount})</span>
          </button>

          <button
            onClick={() => setFilter("ALL")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              filter === "ALL"
                ? "bg-slate-800 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <span>All ({applications.length})</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, email, or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-rose-500 transition"
          />
        </div>
      </div>

      {/* Applications List */}
      {loading ? (
        <UniversalLoader variant="skeleton" type="cards" count={3} />
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs space-y-2">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700">
            No Applications Found
          </h3>
          <p className="text-xs text-slate-400">
            {filter === "PENDING"
              ? "There are no pending host applications at this moment."
              : "No applications match your current filters."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filtered.map((app) => (
            <div
              key={app.id}
              className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4 hover:border-slate-300 transition"
            >
              {/* Header row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-slate-700">
                    {app.applicantName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900">
                      {app.applicantName}
                    </h4>
                    <p className="text-xs text-slate-500">
                      {app.userEmail || app.applicantEmail || "No email"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
                      app.status === "APPROVED"
                        ? "bg-emerald-100 text-emerald-800"
                        : app.status === "REJECTED"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-amber-100 text-amber-800 animate-pulse"
                    }`}
                  >
                    {app.status === "APPROVED" ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : app.status === "REJECTED" ? (
                      <XCircle className="w-3.5 h-3.5" />
                    ) : (
                      <Clock className="w-3.5 h-3.5" />
                    )}
                    <span>{app.status}</span>
                  </span>

                  <span className="text-[11px] text-slate-400">
                    Submitted:{" "}
                    {new Date(
                      app.createdAt || app.submittedAt || Date.now(),
                    ).toLocaleDateString()}
                  </span>

                  {app.managementType && (
                    <span className="px-2.5 py-1 bg-brand-50 text-brand-700 font-bold text-[10px] rounded-lg border border-brand-200">
                      {app.managementType}
                    </span>
                  )}
                </div>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-slate-400 font-semibold text-[11px]">
                    <Home className="w-3.5 h-3.5" />
                    <span>Property Address</span>
                  </div>
                  <p className="font-bold text-slate-800">
                    {app.propertyAddress}
                  </p>
                  {app.unitOrRoom && (
                    <p className="text-slate-500 text-[11px]">
                      Unit/Floor: {app.unitOrRoom}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-slate-400 font-semibold text-[11px]">
                    <Phone className="w-3.5 h-3.5" />
                    <span>Contact Number</span>
                  </div>
                  <p className="font-bold text-slate-800">
                    {app.phoneNumber || app.applicantPhone || "Not provided"}
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-slate-400 font-semibold text-[11px]">
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>Est. Monthly Bills</span>
                  </div>
                  <p className="font-bold text-emerald-700">
                    {app.estimatedMonthlyBills || app.monthlyRentOrShare
                      ? `₱${app.estimatedMonthlyBills || app.monthlyRentOrShare}`
                      : "Not specified"}
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-slate-400 font-semibold text-[11px]">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Roommate Group</span>
                  </div>
                  <p className="font-semibold text-slate-800">
                    {app.roommateGroupName ||
                      (app.selectedHouseholdId
                        ? `ID: ${app.selectedHouseholdId}`
                        : "None (Optional)")}
                  </p>
                </div>
              </div>

              {/* Reason for applying */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-xs space-y-1">
                <span className="font-bold text-slate-700">
                  Why do you want to become a host:
                </span>
                <p className="text-slate-600 leading-relaxed italic">
                  {app.reasonForApplying ||
                    app.reason ||
                    "No statement provided"}
                </p>
                {(app.propertyExperience || app.experience) && (
                  <p className="text-slate-500 text-[11px] mt-1.5 pt-1.5 border-t border-slate-200/60">
                    <strong className="text-slate-700 font-semibold">
                      Property Experience:{" "}
                    </strong>{" "}
                    {app.propertyExperience || app.experience}
                  </p>
                )}
              </div>

              {/* Admin feedback if already reviewed */}
              {app.adminFeedback && (
                <div className="p-3 rounded-xl bg-slate-100 text-slate-600 text-xs flex items-start gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-700">
                      Admin Review Feedback:{" "}
                    </span>
                    <span>{app.adminFeedback}</span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {app.status === "PENDING" && (
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setSelectedApp(app);
                      setReviewAction("REJECT");
                      setFeedback("");
                    }}
                    className="px-4 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Reject Application</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedApp(app);
                      setReviewAction("APPROVE");
                      setFeedback("Application approved by Super Admin.");
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Approve as Host</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Review Modal / Confirmation */}
      {selectedApp && reviewAction && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                {reviewAction === "APPROVE" ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-600" />
                )}
                <span>
                  {reviewAction === "APPROVE"
                    ? "Approve Host Application"
                    : "Reject Host Application"}
                </span>
              </h3>
              <button
                onClick={() => {
                  setSelectedApp(null);
                  setReviewAction(null);
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {reviewAction === "APPROVE"
                ? `Approving this application will promote ${selectedApp.applicantName} to the HOST role, granting them full permissions to manage households and billings.`
                : `Are you sure you want to reject the application for ${selectedApp.applicantName}?`}
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Feedback Notes (Sent to applicant):
              </label>
              <textarea
                rows={3}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Optional feedback or instructions for the applicant..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-slate-800 transition"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedApp(null);
                  setReviewAction(null);
                }}
                disabled={processing}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReview}
                disabled={processing}
                className={`px-4 py-2 rounded-xl text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer ${
                  reviewAction === "APPROVE"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {processing ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : reviewAction === "APPROVE" ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Confirm Approval</span>
                  </>
                ) : (
                  <>
                    <X className="w-3.5 h-3.5" />
                    <span>Confirm Rejection</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
