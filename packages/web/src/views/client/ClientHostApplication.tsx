import React, { useState, useEffect } from "react";
import { auth } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";
import { firebaseDataService } from "../../services/firebaseDataService";
import { HostApplication, UserProfile } from "@splitzy/shared";
import {
  Building2,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Send,
  Home,
  User,
  Phone,
  DollarSign,
  ArrowRight,
  Sparkles,
  RefreshCw,
} from "lucide-react";

export const ClientHostApplication: React.FC<{
  onNavigate?: (tab: string) => void;
}> = ({ onNavigate }) => {
  const { currentUser: authUser, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [application, setApplication] = useState<HostApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form inputs
  const [applicantName, setApplicantName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [unitOrRoom, setUnitOrRoom] = useState("");
  const [monthlyRentOrShare, setMonthlyRentOrShare] = useState<string>("");
  const [reasonForApplying, setReasonForApplying] = useState("");
  const [experience, setExperience] = useState("");

  const effectiveUid = authUser?.uid || auth.currentUser?.uid;

  useEffect(() => {
    // If auth is still loading and we have no UID, keep waiting briefly
    if (authLoading && !effectiveUid) {
      return;
    }

    if (!effectiveUid) {
      setLoading(false);
      return;
    }

    // Safety timeout: ensure loading state never hangs indefinitely
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 2000);

    // Load user profile
    firebaseDataService.getUserProfile(effectiveUid).then((p) => {
      if (p) {
        setProfile(p);
        setApplicantName(
          p.fullName || p.displayName || authUser?.fullName || "",
        );
        if (p.phoneNumber) setPhoneNumber(p.phoneNumber);
      } else if (authUser) {
        setProfile(authUser);
        setApplicantName(authUser.fullName || authUser.displayName || "");
        if (authUser.phoneNumber) setPhoneNumber(authUser.phoneNumber);
      }
    });

    // Listen to real-time host application status
    const unsubscribe = firebaseDataService.listenToUserHostApplication(
      effectiveUid,
      (app) => {
        clearTimeout(safetyTimer);
        setApplication(app);
        setLoading(false);
      },
    );

    return () => {
      clearTimeout(safetyTimer);
      unsubscribe();
    };
  }, [effectiveUid, authLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveUid) {
      setErrorMsg("You must be signed in to submit a host application.");
      return;
    }
    if (!propertyAddress.trim() || !reasonForApplying.trim()) {
      setErrorMsg(
        "Please provide the property address and reason for applying.",
      );
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await firebaseDataService.submitHostApplication({
        userId: effectiveUid,
        userEmail:
          auth.currentUser?.email || authUser?.email || profile?.email || "",
        applicantEmail:
          auth.currentUser?.email || authUser?.email || profile?.email || "",
        applicantName:
          applicantName.trim() ||
          authUser?.displayName ||
          profile?.displayName ||
          "Resident Applicant",
        phoneNumber: phoneNumber.trim(),
        applicantPhone: phoneNumber.trim(),
        propertyAddress: propertyAddress.trim(),
        unitOrRoom: unitOrRoom.trim(),
        monthlyRentOrShare: monthlyRentOrShare
          ? parseFloat(monthlyRentOrShare)
          : undefined,
        reason: reasonForApplying.trim(),
        reasonForApplying: reasonForApplying.trim(),
        experience: experience.trim(),
        status: "PENDING",
      });

      setSuccessMsg(
        "Your host application has been submitted successfully! Super Admin will review your request.",
      );
    } catch (err: any) {
      setErrorMsg(
        err.message || "Failed to submit host application. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400 text-xs">
        <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mr-2" />
        Loading application status...
      </div>
    );
  }

  const isAlreadyHost =
    profile?.role === "HOST" || profile?.role === "SUPER_ADMIN";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-brand-600 uppercase tracking-wider">
            <Building2 className="w-3.5 h-3.5" />
            <span>Community Leadership</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 mt-1">
            Host Admin Application
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Apply to manage your own household, billing policies, attendance
            logs, and roommate utility splits.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAlreadyHost ? (
            <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-xl flex items-center gap-1.5 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" /> Verified Host
            </span>
          ) : application?.status === "PENDING" ? (
            <span className="px-3 py-1.5 bg-amber-50 text-amber-700 font-bold text-xs rounded-xl flex items-center gap-1.5 border border-amber-200">
              <Clock className="w-3.5 h-3.5" /> Pending Approval
            </span>
          ) : (
            <span className="px-3 py-1.5 bg-blue-50 text-blue-700 font-bold text-xs rounded-xl flex items-center gap-1.5 border border-blue-200">
              <Sparkles className="w-3.5 h-3.5" /> Standard Member
            </span>
          )}
        </div>
      </div>

      {/* State 1: User is already a Host */}
      {isAlreadyHost && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 text-emerald-900 space-y-3">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <h3 className="font-extrabold text-sm">
              You are already an active Host Admin!
            </h3>
          </div>
          <p className="text-xs text-emerald-800 leading-relaxed">
            Your account has full privileges to configure household utilities,
            verify member receipts, and track attendance. You can access the
            Host management tools from the main sidebar.
          </p>
          {onNavigate && (
            <button
              onClick={() => onNavigate("host_dashboard")}
              className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>Go to Host Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* State 2: Application is currently Pending */}
      {!isAlreadyHost && application?.status === "PENDING" && (
        <div className="bg-white rounded-3xl p-6 border border-amber-200/80 shadow-xs space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0 mt-0.5">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Application Under Super Admin Review
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Submitted on{" "}
                {new Date(
                  application.createdAt ||
                    application.submittedAt ||
                    Date.now(),
                ).toLocaleDateString()}{" "}
                at{" "}
                {new Date(
                  application.createdAt ||
                    application.submittedAt ||
                    Date.now(),
                ).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 text-xs space-y-2 text-slate-600">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <span className="font-bold text-slate-800">
                  Property Address:{" "}
                </span>
                <span>{application.propertyAddress}</span>
              </div>
              {application.unitOrRoom && (
                <div>
                  <span className="font-bold text-slate-800">
                    Unit / Room:{" "}
                  </span>
                  <span>{application.unitOrRoom}</span>
                </div>
              )}
              {(application.phoneNumber || application.applicantPhone) && (
                <div>
                  <span className="font-bold text-slate-800">Contact: </span>
                  <span>
                    {application.phoneNumber || application.applicantPhone}
                  </span>
                </div>
              )}
              {application.monthlyRentOrShare && (
                <div>
                  <span className="font-bold text-slate-800">
                    Est. Monthly Share:{" "}
                  </span>
                  <span>${application.monthlyRentOrShare}</span>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-200/60">
              <span className="font-bold text-slate-800">
                Reason for Applying:{" "}
              </span>
              <p className="mt-1 italic text-slate-700">
                {application.reasonForApplying ||
                  application.reason ||
                  "No statement provided"}
              </p>
            </div>
          </div>

          <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-xl text-amber-900 text-[11px] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Super Administrators review incoming Host applications to protect
              community billing safety. You will receive immediate dashboard
              access once approved.
            </span>
          </div>
        </div>
      )}

      {/* State 3: Application was Rejected or Needs Update */}
      {!isAlreadyHost && application?.status === "REJECTED" && (
        <div className="bg-rose-50 border border-rose-200 rounded-3xl p-6 text-rose-900 space-y-3">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <h3 className="font-extrabold text-sm">
              Previous Application Needs Additional Information
            </h3>
          </div>
          <p className="text-xs text-rose-800 leading-relaxed">
            {application.adminFeedback ||
              "Your application could not be approved at this time. You may submit an updated application below with additional details."}
          </p>
        </div>
      )}

      {/* State 4: Form to Apply (when no pending application) */}
      {!isAlreadyHost && application?.status !== "PENDING" && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-brand-600" />
              <span>Host Application Questionnaire</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Please complete this brief application to request Host Admin
              access. All fields are confidential and reviewed only by Splitzy
              Super Administrators.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Applicant Full Name</span>
                </label>
                <input
                  type="text"
                  required
                  value={applicantName}
                  onChange={(e) => setApplicantName(e.target.value)}
                  placeholder="e.g. Alex Rivera"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 transition"
                />
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>Contact Phone Number</span>
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="e.g. +1 (555) 234-5678"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 transition"
                />
              </div>
            </div>

            {/* Property Address */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Home className="w-3.5 h-3.5 text-slate-400" />
                <span>Managed Property Address *</span>
              </label>
              <input
                type="text"
                required
                value={propertyAddress}
                onChange={(e) => setPropertyAddress(e.target.value)}
                placeholder="e.g. 742 Evergreen Terrace, Springfield"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 transition"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Unit or Room */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Unit, Apt, or Floor (Optional)
                </label>
                <input
                  type="text"
                  value={unitOrRoom}
                  onChange={(e) => setUnitOrRoom(e.target.value)}
                  placeholder="e.g. Apt 4B"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 transition"
                />
              </div>

              {/* Monthly Rent or Utility Share */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                  <span>Est. Monthly Household Rent/Expenses</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={monthlyRentOrShare}
                  onChange={(e) => setMonthlyRentOrShare(e.target.value)}
                  placeholder="e.g. 2400"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 transition"
                />
              </div>
            </div>

            {/* Why do you want to become a Host? */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Why do you want to become a Host Admin? *
              </label>
              <textarea
                rows={3}
                required
                value={reasonForApplying}
                onChange={(e) => setReasonForApplying(e.target.value)}
                placeholder="Explain why you are applying (e.g. I am the primary leaseholder and manage utility payments for 4 roommates)..."
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 transition"
              />
            </div>

            {/* Experience / Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Previous Household or Property Experience (Optional)
              </label>
              <textarea
                rows={2}
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                placeholder="Any prior experience with utility management, sub-leasing, or accounting..."
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 transition"
              />
            </div>

            {/* Terms notice */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-500 leading-relaxed">
              By submitting this application, you agree to act in good faith
              when managing utility calculations, roommate attendance logs, and
              payment receipts. Applications are evaluated under Super Admin
              discretion.
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-700 via-brand-600 to-indigo-600 hover:from-brand-800 hover:to-indigo-700 text-white font-bold text-xs shadow-md shadow-brand-500/25 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Submitting Application...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Submit Host Application</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
