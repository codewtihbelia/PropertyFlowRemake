import React, { useState, useEffect } from "react";
import { auth } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";
import { firebaseDataService } from "../../services/firebaseDataService";
import {
  HostApplication,
  UserProfile,
  Household,
  HOST_MANAGEMENT_TYPES,
} from "@propertyflow/shared";
import { UniversalLoader } from "../../components/common/UniversalLoader";
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
  Users,
  Briefcase,
  HelpCircle,
  Info,
} from "lucide-react";

const DEFAULT_MANAGEMENT_TYPES = [
  "Primary Leaseholder / Master Tenant",
  "Property Owner / Landlord",
  "Property Manager / Co-living Operator",
  "Roommate Coordinator / Flat Lead",
  "Sublessor / Flat Representative",
  "Other / Independent Household Host",
];

export const ClientHostApplication: React.FC<{
  onNavigate?: (tab: string) => void;
}> = ({ onNavigate }) => {
  const { currentUser: authUser, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [application, setApplication] = useState<HostApplication | null>(null);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Exactly requested form fields:
  // 1. full name
  // 2. contact number
  // 3. property address
  // 4. host management type with dropdowns
  // 5. select roommate group (optional)
  // 6. unit, apt or floor (optional)
  // 7. est monthly bills
  // 8. why do you want to become a host
  // 9. property experience
  const [applicantName, setApplicantName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [managementType, setManagementType] = useState<string>(
    DEFAULT_MANAGEMENT_TYPES[0],
  );
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string>("");
  const [roommateGroupName, setRoommateGroupName] = useState<string>("");
  const [unitOrRoom, setUnitOrRoom] = useState("");
  const [monthlyRentOrShare, setMonthlyRentOrShare] = useState<string>("");
  const [reasonForApplying, setReasonForApplying] = useState("");
  const [experience, setExperience] = useState("");

  const effectiveUid = authUser?.uid || auth.currentUser?.uid;
  const managementTypesList = HOST_MANAGEMENT_TYPES || DEFAULT_MANAGEMENT_TYPES;

  useEffect(() => {
    if (authLoading && !effectiveUid) {
      return;
    }

    if (!effectiveUid) {
      setLoading(false);
      return;
    }

    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 2500);

    // Load user profile
    firebaseDataService.getUserProfile(effectiveUid).then((p) => {
      if (p) {
        setProfile(p);
        setApplicantName(
          p.fullName || p.displayName || authUser?.fullName || "",
        );
        if (p.phoneNumber) setPhoneNumber(p.phoneNumber);
        if (p.householdId) {
          setSelectedHouseholdId(p.householdId);
          setRoommateGroupName(
            p.householdName || p.apartmentName || "Current Household",
          );
        }
      } else if (authUser) {
        setProfile(authUser);
        setApplicantName(authUser.fullName || authUser.displayName || "");
        if (authUser.phoneNumber) setPhoneNumber(authUser.phoneNumber);
        if (authUser.householdId) {
          setSelectedHouseholdId(authUser.householdId);
          setRoommateGroupName(
            authUser.householdName ||
              authUser.apartmentName ||
              "Current Household",
          );
        }
      }
    });

    // Listen to real-time host application status
    const unsubscribeApp = firebaseDataService.listenToUserHostApplication(
      effectiveUid,
      (app) => {
        clearTimeout(safetyTimer);
        setApplication(app);
        if (app) {
          if (app.managementType) setManagementType(app.managementType);
          if (app.selectedHouseholdId)
            setSelectedHouseholdId(app.selectedHouseholdId);
          if (app.roommateGroupName)
            setRoommateGroupName(app.roommateGroupName);
        }
        setLoading(false);
      },
    );

    // Listen to available households / roommate groups
    const unsubscribeHh = firebaseDataService.listenToHouseholds((list) => {
      setHouseholds(list || []);
    });

    return () => {
      clearTimeout(safetyTimer);
      unsubscribeApp();
      unsubscribeHh();
    };
  }, [effectiveUid, authLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveUid) {
      setErrorMsg("You must be signed in to submit a host application.");
      return;
    }
    if (!applicantName.trim()) {
      setErrorMsg("Please enter your full name.");
      return;
    }
    if (!phoneNumber.trim()) {
      setErrorMsg("Please enter your contact phone number.");
      return;
    }
    if (!propertyAddress.trim()) {
      setErrorMsg("Please provide the property address.");
      return;
    }
    if (!managementType.trim()) {
      setErrorMsg("Please select a host management type.");
      return;
    }
    if (!reasonForApplying.trim()) {
      setErrorMsg("Please explain why you want to become a host.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const parsedBills = monthlyRentOrShare.trim()
        ? parseFloat(monthlyRentOrShare.replace(/[^0-9.]/g, ""))
        : undefined;

      await firebaseDataService.submitHostApplication({
        userId: effectiveUid,
        userEmail:
          auth.currentUser?.email || authUser?.email || profile?.email || "",
        applicantEmail:
          auth.currentUser?.email || authUser?.email || profile?.email || "",
        applicantName: applicantName.trim(),
        phoneNumber: phoneNumber.trim(),
        applicantPhone: phoneNumber.trim(),
        propertyAddress: propertyAddress.trim(),
        managementType: managementType.trim(),
        selectedHouseholdId: selectedHouseholdId.trim(),
        roommateGroupName: roommateGroupName.trim(),
        unitOrRoom: unitOrRoom.trim(),
        monthlyRentOrShare: isNaN(parsedBills as number)
          ? undefined
          : parsedBills,
        estimatedMonthlyBills: isNaN(parsedBills as number)
          ? undefined
          : parsedBills,
        reason: reasonForApplying.trim(),
        reasonForApplying: reasonForApplying.trim(),
        experience: experience.trim(),
        propertyExperience: experience.trim(),
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
    return <UniversalLoader variant="skeleton" type="form" />;
  }

  const isAlreadyHost =
    profile?.role === "HOST" ||
    profile?.role === "SUPER_ADMIN" ||
    profile?.hostApplicationStatus === "APPROVED" ||
    authUser?.role === "HOST" ||
    authUser?.hostApplicationStatus === "APPROVED";

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
            Apply to create roommate groups, manage billing policies, attendance
            logs, and automated utility breakdowns.
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
            Your account has full privileges to create roommate groups,
            configure utilities, verify member receipts, and track attendance.
            You can manage your household from the main navigation.
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

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 text-xs space-y-2.5 text-slate-600">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <span className="font-bold text-slate-800">Full Name: </span>
                <span>{application.applicantName}</span>
              </div>
              <div>
                <span className="font-bold text-slate-800">
                  Contact Number:{" "}
                </span>
                <span>
                  {application.phoneNumber ||
                    application.applicantPhone ||
                    "Not provided"}
                </span>
              </div>
              <div>
                <span className="font-bold text-slate-800">
                  Property Address:{" "}
                </span>
                <span>{application.propertyAddress}</span>
              </div>
              {application.managementType && (
                <div>
                  <span className="font-bold text-slate-800">
                    Host Management Type:{" "}
                  </span>
                  <span className="text-brand-600 font-semibold">
                    {application.managementType}
                  </span>
                </div>
              )}
              <div>
                <span className="font-bold text-slate-800">
                  Roommate Group:{" "}
                </span>
                <span>
                  {application.roommateGroupName ||
                    (application.selectedHouseholdId
                      ? `Group #${application.selectedHouseholdId}`
                      : "None (Will create after approval)")}
                </span>
              </div>
              {application.unitOrRoom && (
                <div>
                  <span className="font-bold text-slate-800">
                    Unit, Apt or Floor:{" "}
                  </span>
                  <span>{application.unitOrRoom}</span>
                </div>
              )}
              {(application.estimatedMonthlyBills ||
                application.monthlyRentOrShare) && (
                <div>
                  <span className="font-bold text-slate-800">
                    Est. Monthly Bills:{" "}
                  </span>
                  <span className="text-emerald-700 font-semibold">
                    ₱
                    {application.estimatedMonthlyBills ||
                      application.monthlyRentOrShare}
                  </span>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-200/60">
              <span className="font-bold text-slate-800">
                Why do you want to become a host:{" "}
              </span>
              <p className="mt-1 italic text-slate-700">
                {application.reasonForApplying ||
                  application.reason ||
                  "No statement provided"}
              </p>
            </div>

            {(application.propertyExperience || application.experience) && (
              <div className="pt-2 border-t border-slate-200/60">
                <span className="font-bold text-slate-800">
                  Property Experience:{" "}
                </span>
                <p className="mt-1 text-slate-700">
                  {application.propertyExperience || application.experience}
                </p>
              </div>
            )}
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
              Complete this application to request Host Admin access. Non-hosts
              cannot create roommate groups until approved.
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
              {/* 1. Full Name */}
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Full Name *</span>
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

              {/* 2. Contact Number */}
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>Contact Number *</span>
                </label>
                <input
                  type="tel"
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="e.g. +63 917 123 4567"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 transition"
                />
              </div>
            </div>

            {/* 3. Property Address */}
            <div>
              <label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Home className="w-3.5 h-3.5 text-slate-400" />
                <span>Property Address *</span>
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
              {/* 4. Host Management Type with dropdowns */}
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                  <span>Host Management Type *</span>
                </label>
                <select
                  required
                  value={managementType}
                  onChange={(e) => setManagementType(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 transition cursor-pointer"
                >
                  {managementTypesList.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Designate your role in property operations.
                </p>
              </div>

              {/* 5. Select Roommate Group (Optional) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>Select Roommate Group</span>
                  </label>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide bg-slate-100 px-2 py-0.5 rounded-md">
                    Optional
                  </span>
                </div>
                <select
                  value={selectedHouseholdId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedHouseholdId(id);
                    const found = households.find(
                      (h) => (h.householdId || (h as any).id) === id,
                    );
                    if (found) {
                      setRoommateGroupName(
                        found.householdName ||
                          found.apartmentName ||
                          "Household Group",
                      );
                      if (!propertyAddress.trim() && found.address) {
                        setPropertyAddress(found.address);
                      }
                    } else {
                      setRoommateGroupName("");
                    }
                  }}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 transition cursor-pointer"
                >
                  <option value="">
                    None / Not in a group yet (Create after approval)
                  </option>
                  {households.map((h) => {
                    const hId = h.householdId || (h as any).id;
                    const hName =
                      h.householdName || h.apartmentName || "Household";
                    return (
                      <option key={hId} value={hId}>
                        {hName} {h.address ? `(${h.address})` : ""}
                      </option>
                    );
                  })}
                </select>
                <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <Info className="w-3.5 h-3.5 text-brand-500 shrink-0 mt-0.5" />
                  <span>
                    Users cannot create groups if they are not a host. You may
                    link an existing group or create one after approval.
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 6. Unit, Apt or Floor (Optional) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Unit, Apt or Floor
                  </label>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide bg-slate-100 px-2 py-0.5 rounded-md">
                    Optional
                  </span>
                </div>
                <input
                  type="text"
                  value={unitOrRoom}
                  onChange={(e) => setUnitOrRoom(e.target.value)}
                  placeholder="e.g. Unit 402, 4th Floor"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 transition"
                />
              </div>

              {/* 7. Est. Monthly Bills */}
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                  <span>Est. Monthly Bills</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    ₱
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={monthlyRentOrShare}
                    onChange={(e) => setMonthlyRentOrShare(e.target.value)}
                    placeholder="e.g. 15000"
                    className="w-full pl-8 pr-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 transition"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Estimated combined utility and rent expenses.
                </p>
              </div>
            </div>

            {/* 8. Why do you want to become a host */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Why do you want to become a host *
              </label>
              <textarea
                rows={3}
                required
                value={reasonForApplying}
                onChange={(e) => setReasonForApplying(e.target.value)}
                placeholder="Explain why you want to become a host (e.g. I am organizing bill splits, water attendance, and payments for 5 roommates)..."
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 transition"
              />
            </div>

            {/* 9. Property Experience */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Property Experience
              </label>
              <textarea
                rows={2}
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                placeholder="Describe your prior experience with tenancy management, expense tracking, or property maintenance..."
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
