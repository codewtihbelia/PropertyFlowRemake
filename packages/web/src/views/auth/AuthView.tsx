import React, { useState, useEffect, useRef } from "react";
import {
  Building2,
  Mail,
  KeyRound,
  User,
  Sparkles,
  LogIn,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Calculator,
  Receipt,
  Users,
  Lock,
  Clock,
  RefreshCw,
  Send,
  Check,
  Copy,
  Shield,
} from "lucide-react";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
} from "firebase/auth";
import { auth } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";
import { firebaseDataService } from "../../services/firebaseDataService";

interface AuthViewProps {
  onSuccess: () => void;
  onBackToLanding?: () => void;
  initialMode?: "signin" | "register" | "forgot";
}

type AuthMode = "signin" | "register" | "forgot";

export const AuthView: React.FC<AuthViewProps> = ({
  onSuccess,
  onBackToLanding,
  initialMode = "signin",
}) => {
  const { reloadUser } = useAuth();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [resetSuccessEmail, setResetSuccessEmail] = useState("");

  // Built-in Firebase Email Verification states
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [checkingVerification, setCheckingVerification] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [verificationNotice, setVerificationNotice] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const hasRedirectedRef = useRef(false);

  // Cooldown countdown effect
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(
        () => setResendCooldown((prev) => prev - 1),
        1000,
      );
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Built-in Firebase Email Verification Auto-detection (polling & window focus)
  useEffect(() => {
    if (!verificationSent) return;

    let isMounted = true;

    const checkVerificationStatus = async () => {
      if (hasRedirectedRef.current) return;
      try {
        const user = auth.currentUser;
        if (!user) return;
        await user.reload();
        if (user.emailVerified && !hasRedirectedRef.current) {
          hasRedirectedRef.current = true;
          if (isMounted) {
            setIsEmailVerified(true);
            setVerificationNotice({
              type: "success",
              text: "Email is verified! Redirecting to dashboard...",
            });
          }
          // Refresh user in AuthContext so whole app knows user is verified
          reloadUser().catch(() => {});
          setTimeout(() => {
            onSuccess();
          }, 800);
        }
      } catch (err) {
        // Background check failed silently
      }
    };

    // 1. Check periodically every 2.5 seconds
    const interval = setInterval(checkVerificationStatus, 2500);

    // 2. Check immediately when the user switches back from their email app/tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkVerificationStatus();
      }
    };
    const handleFocus = () => {
      checkVerificationStatus();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [verificationSent, onSuccess, reloadUser]);

  const getFriendlyAuthError = (err: any): string => {
    const code = err?.code || "";
    const msg = String(err?.message || "");
    const lowerMsg = msg.toLowerCase();

    if (code === "auth/user-not-found") {
      return "No account found with this email. Please check your spelling or register a new account.";
    }
    if (code === "auth/wrong-password") {
      return "Incorrect password. Please try again or use the 'Forgot password?' link below.";
    }
    if (code === "auth/invalid-credential") {
      return "Invalid email or password. If you already have an account, please Sign In or reset your password.";
    }
    if (code === "auth/email-already-in-use") {
      return "An account with this email already exists. Please switch to Sign In or reset your password.";
    }
    if (code === "auth/weak-password") {
      return "Password must be at least 6 characters long.";
    }
    if (code === "auth/invalid-email") {
      return "Please enter a valid email address.";
    }
    if (code === "auth/popup-closed-by-user") {
      return "Google sign-in popup was closed before finishing. Please try again.";
    }
    if (code === "auth/popup-blocked") {
      return "Google sign-in popup was blocked by your browser. Please allow popups for this site.";
    }
    if (code === "auth/unauthorized-domain") {
      return "This domain is not in your Firebase Authorized Domains list. Please add this preview domain to Firebase Console > Authentication > Settings > Authorized Domains.";
    }
    if (code === "auth/too-many-requests") {
      return "Access temporarily restricted due to many failed attempts. You can reset your password to proceed.";
    }
    if (
      code === "auth/internal-error" ||
      code === "internal" ||
      lowerMsg === "internal" ||
      lowerMsg.includes("internal-error") ||
      lowerMsg.includes("internal error")
    ) {
      return "Unable to complete registration. If an account already exists with this email address, please switch to Sign In or reset your password. Also ensure your password is at least 6 characters.";
    }
    if (
      msg.includes("client is offline") ||
      code === "unavailable" ||
      code === "failed-precondition"
    ) {
      return "Connecting to cloud database... Please check your internet connection or reload the page.";
    }
    return msg && msg !== "internal"
      ? msg
      : "Authentication service was unable to complete the request. Please try again or use Sign In if your account was already created.";
  };

  const saveAuthenticatedProfile = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const existing = await firebaseDataService.getUserProfile(user.uid);
      const displayName =
        user.displayName ||
        name.trim() ||
        existing?.displayName ||
        user.email ||
        "Resident";
      const now = new Date().toISOString();
      const preservedRole =
        existing?.role === "SUPER_ADMIN"
          ? "SUPER_ADMIN"
          : existing?.role === "HOST" ||
              existing?.hostApplicationStatus === "APPROVED"
            ? "HOST"
            : existing?.role || "PAYOR";

      await firebaseDataService.saveUserProfile({
        uid: user.uid,
        fullName: existing?.fullName || displayName,
        displayName,
        email: user.email || email.trim(),
        role: preservedRole,
        accountStatus: existing?.accountStatus || "ACTIVE",
        householdId: existing?.householdId,
        hostApplicationStatus: existing?.hostApplicationStatus,
        hostApplicationId: existing?.hostApplicationId,
        createdDate: existing?.createdDate || now,
        updatedDate: now,
        lastLogin: now,
      });
    } catch (err) {
      console.warn("[Auth] saveAuthenticatedProfile non-fatal warning:", err);
    }
  };

  const handleSignInOrRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      if (mode === "register") {
        if (!name.trim()) {
          setErrorMsg("Please enter your full name.");
          setLoading(false);
          return;
        }

        if (password.length < 6) {
          setErrorMsg("Password must be at least 6 characters long.");
          setLoading(false);
          return;
        }

        const credential = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password,
        );

        if (name.trim()) {
          try {
            await updateProfile(credential.user, { displayName: name.trim() });
          } catch (pErr) {
            console.warn("[Auth] updateProfile displayName error:", pErr);
          }
        }

        // Dispatch Native Email Verification link via Firebase Auth
        try {
          await sendEmailVerification(credential.user);
        } catch (vErr) {
          console.warn("[Auth] sendEmailVerification notice:", vErr);
        }

        // Save profile as normal user (PAYOR) in background
        saveAuthenticatedProfile().catch((err) =>
          console.warn("[Auth] saveAuthenticatedProfile error:", err),
        );

        // Transition to built-in Email Verification screen
        setVerificationEmail(email.trim());
        setVerificationSent(true);
        setResendCooldown(45);
        setVerificationNotice({
          type: "info",
          text: `A verification link has been sent to ${email.trim()}. Please open your email and click the verification link.`,
        });
        setLoading(false);
        return;
      } else {
        const credential = await signInWithEmailAndPassword(
          auth,
          email.trim(),
          password,
        );
        saveAuthenticatedProfile().catch((err) =>
          console.warn("[Auth] saveAuthenticatedProfile error:", err),
        );

        // If user email is not yet verified, transition to verification screen
        if (!credential.user.emailVerified) {
          try {
            await sendEmailVerification(credential.user);
          } catch (vErr) {
            console.warn(
              "[Auth] sendEmailVerification on signin notice:",
              vErr,
            );
          }
          setVerificationEmail(email.trim());
          setVerificationSent(true);
          setResendCooldown(45);
          setVerificationNotice({
            type: "info",
            text: `Please verify your email address to access your dashboard. A link was sent to ${email.trim()}.`,
          });
          setLoading(false);
          return;
        }

        onSuccess();
      }
    } catch (err: any) {
      setErrorMsg(getFriendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setErrorMsg(null);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, provider);

      // Save profile as normal user asynchronously
      saveAuthenticatedProfile().catch((err) => {
        console.warn("[Auth] Profile save warning after Google sign in:", err);
      });

      onSuccess();
    } catch (err: any) {
      console.error("[Auth] Google sign in error:", err);
      setErrorMsg(getFriendlyAuthError(err));
    } finally {
      setGoogleLoading(false);
    }
  };

  const checkEmailVerification = async () => {
    if (hasRedirectedRef.current) return;
    setCheckingVerification(true);
    setVerificationNotice(null);
    try {
      if (auth.currentUser) {
        await auth.currentUser.reload();
        if (auth.currentUser.emailVerified && !hasRedirectedRef.current) {
          hasRedirectedRef.current = true;
          setIsEmailVerified(true);
          setVerificationNotice({
            type: "success",
            text: "Email is verified! Redirecting to dashboard...",
          });
          reloadUser().catch(() => {});
          setTimeout(() => {
            onSuccess();
          }, 600);
          return;
        }
      }
      setVerificationNotice({
        type: "info",
        text: "Email is not yet verified. Please open your inbox, click the verification link in the email, and then return here.",
      });
    } catch (err: any) {
      setVerificationNotice({
        type: "error",
        text: "Could not refresh verification status. Please check your internet connection and try again.",
      });
    } finally {
      setCheckingVerification(false);
    }
  };

  const resendVerificationEmail = async () => {
    if (resendCooldown > 0) return;
    try {
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
      }
      setResendCooldown(45);
      setVerificationNotice({
        type: "success",
        text: "A fresh verification email has been dispatched to your inbox!",
      });
    } catch (err: any) {
      setVerificationNotice({
        type: "error",
        text: getFriendlyAuthError(err),
      });
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg("Please enter your registered email address.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setResetSent(true);
      setResetSuccessEmail(email.trim());
    } catch (err: any) {
      setErrorMsg(getFriendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-white flex flex-col lg:flex-row overflow-x-hidden font-sans selection:bg-brand-500 selection:text-white">
      {/* Left Column: Full-Height Edge-to-Edge Brand Showcase (Desktop) */}
      <div className="hidden lg:flex lg:w-5/12 xl:w-[44%] bg-gradient-to-br from-slate-950 via-slate-900 to-brand-950 text-white p-10 xl:p-16 flex-col justify-between relative overflow-hidden border-r border-slate-800/80 shrink-0">
        {/* Subtle Ambient Glows */}
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-brand-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Top: Brand Header */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-brand-600 via-brand-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-brand-500/30">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight text-white">
                  Property<span className="text-brand-400">Flow</span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-400/30">
                  Splitzy
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Co-Living Bill & Attendance Platform
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl font-black text-white leading-tight">
              Fair, transparent utility splitting for modern co-living.
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Connect your household to automated daily absence redistribution,
              verified receipt vaults, and 100% auditable centavo precision.
            </p>
          </div>
        </div>

        {/* Middle: Feature Proof Points */}
        <div className="relative z-10 my-8 space-y-4">
          <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
            <div className="w-8 h-8 rounded-lg bg-brand-500/20 text-brand-300 flex items-center justify-center shrink-0 mt-0.5">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">
                Zero-Drift Centavo Math
              </div>
              <div className="text-[11px] text-slate-300">
                Sum of roommate shares always strictly equals the exact utility
                provider invoice.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">
                Verified Proof-of-Payment Vault
              </div>
              <div className="text-[11px] text-slate-300">
                Upload GCash, Maya, and bank slips with instant status tracking
                and receipts history.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center shrink-0 mt-0.5">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">
                Multi-Role Access Control
              </div>
              <div className="text-[11px] text-slate-300">
                Separate permissions for Household Hosts, Payor Residents, and
                Non-Payor guests.
              </div>
            </div>
          </div>
        </div>

        {/* Bottom: Cloud Security Assurance */}
        <div className="relative z-10 pt-4 border-t border-white/10 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="text-xs text-slate-400">
            <span className="text-white font-semibold">
              Firebase Cloud Protected
            </span>
            <p className="text-[11px] text-slate-400">
              Encrypted credentials & secure Firestore database rules.
            </p>
          </div>
        </div>
      </div>

      {/* Right Column: Full-Height Edge-to-Edge Clean Form Canvas */}
      <div className="flex-1 flex flex-col justify-between p-6 sm:p-10 md:p-12 xl:p-16 bg-white min-h-screen overflow-y-auto">
        {/* Top Bar: Return to Website & Mobile Brand & Cloud Status */}
        <div className="flex items-center justify-between pb-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            {/* Mobile Brand (visible on < lg) */}
            <div className="flex lg:hidden items-center gap-2 mr-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-700 to-indigo-600 flex items-center justify-center text-white font-bold shadow-xs">
                <Building2 className="w-4 h-4" />
              </div>
              <span className="font-extrabold text-slate-900 text-sm tracking-tight">
                Property<span className="text-brand-600">Flow</span>
              </span>
            </div>

            {onBackToLanding && (
              <button
                type="button"
                onClick={onBackToLanding}
                className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-600 hover:text-brand-600 transition cursor-pointer group px-3 py-1.5 rounded-lg hover:bg-slate-50 border border-slate-200"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform text-brand-600" />
                <span>Back to Website</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Secure Cloud Auth</span>
          </div>
        </div>

        {/* Main Auth Form Container (Constrained max width, centered with ample whitespace) */}
        <div className="my-auto py-8 max-w-md w-full mx-auto">
          {/* Conditional Views: Verification Sent OR Standard Auth Header */}
          {verificationSent ? (
            <div className="space-y-6 animate-fadeIn">
              <div className="text-center">
                <div className="relative inline-block mx-auto mb-3">
                  <div className="w-16 h-16 rounded-2xl bg-brand-50 text-brand-600 border border-brand-200 flex items-center justify-center shadow-xs">
                    {isEmailVerified ? (
                      <CheckCircle2 className="w-8 h-8 text-emerald-600 animate-bounce" />
                    ) : (
                      <Mail className="w-8 h-8" />
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center border-2 border-white shadow-xs">
                    <Shield className="w-3 h-3" />
                  </div>
                </div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  {isEmailVerified
                    ? "Email Verified!"
                    : "Verify Your Email Address"}
                </h1>
                <p className="text-xs text-slate-500 mt-1.5 max-w-sm mx-auto">
                  {isEmailVerified
                    ? "Email is verified! Redirecting to dashboard..."
                    : `We sent a verification email to ${verificationEmail}. Please click the link to verify your account.`}
                </p>
              </div>

              {/* Recipient Email Badge & Edit Link */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[11px] font-semibold text-slate-500 shrink-0">
                    Sent to:
                  </span>
                  <span className="font-mono font-bold text-slate-900 text-xs truncate">
                    {verificationEmail}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setVerificationSent(false);
                    setMode("register");
                    setErrorMsg(null);
                  }}
                  className="text-[11px] font-semibold text-brand-600 hover:text-brand-800 underline shrink-0 cursor-pointer"
                >
                  Change email
                </button>
              </div>

              {/* Verification Status Notification or Success Callout */}
              {isEmailVerified ? (
                <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-emerald-900 text-xs font-medium flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-fadeIn">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 animate-pulse" />
                    <div>
                      <div className="font-bold text-sm text-emerald-950">
                        Email is verified! Redirecting to dashboard...
                      </div>
                      <div className="text-[11px] text-emerald-800 mt-0.5">
                        Your account is ready and verified.
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      reloadUser().catch(() => {});
                      onSuccess();
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-xs shrink-0 self-end sm:self-center"
                  >
                    Open Dashboard →
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Instructions Card */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-2">
                    <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-brand-600" />
                      Next steps:
                    </div>
                    <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600 pl-1 leading-relaxed">
                      <li>
                        Open your email inbox (and check Spam / Promotions if
                        needed).
                      </li>
                      <li>Click the verification link from Splitzy.</li>
                      <li>
                        Return to this window — your verification is detected
                        automatically.
                      </li>
                    </ol>
                  </div>

                  {/* Live Polling Status Indicator */}
                  <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200/80 text-xs flex items-center justify-between gap-3 text-blue-900">
                    <div className="flex items-center gap-2.5">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600"></span>
                      </span>
                      <span className="text-[11px] font-semibold">
                        Listening for verification link...
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={checkEmailVerification}
                      disabled={checkingVerification || isEmailVerified}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] transition shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      {checkingVerification ? (
                        <span className="flex items-center gap-1">
                          <RefreshCw className="w-3 h-3 animate-spin" />{" "}
                          Checking
                        </span>
                      ) : (
                        "I've clicked the link"
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Additional Notification Banner */}
              {verificationNotice && !isEmailVerified && (
                <div
                  className={`p-3.5 rounded-xl text-xs font-medium flex items-start gap-2.5 animate-fadeIn ${
                    verificationNotice.type === "success"
                      ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                      : verificationNotice.type === "info"
                        ? "bg-blue-50 border border-blue-200 text-blue-800"
                        : "bg-rose-50 border border-rose-200 text-rose-700"
                  }`}
                >
                  {verificationNotice.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : verificationNotice.type === "info" ? (
                    <Mail className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  )}
                  <span className="leading-relaxed">
                    {verificationNotice.text}
                  </span>
                </div>
              )}

              {/* Action Buttons */}
              {!isEmailVerified && (
                <div className="space-y-2.5 pt-1">
                  <button
                    type="button"
                    onClick={resendVerificationEmail}
                    disabled={resendCooldown > 0 || isEmailVerified}
                    className="w-full py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs border border-slate-200 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 text-slate-500 ${resendCooldown > 0 ? "animate-spin" : ""}`}
                    />
                    <span>
                      {resendCooldown > 0
                        ? `Resend verification email in ${resendCooldown}s`
                        : "Resend Verification Email"}
                    </span>
                  </button>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setVerificationSent(false);
                        setMode("signin");
                        setErrorMsg(null);
                        setVerificationNotice(null);
                      }}
                      className="text-xs text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                    >
                      ← Return to Sign In
                    </button>

                    <button
                      type="button"
                      onClick={onSuccess}
                      className="text-xs text-brand-600 hover:text-brand-800 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <span>Continue to Dashboard</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : mode === "forgot" ? (
            <div className="mb-6">
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setErrorMsg(null);
                  setResetSent(false);
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-800 transition mb-3 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
              </button>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Reset Password</span>
                <KeyRound className="w-5 h-5 text-brand-600" />
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Enter your registered email address and we will send you an
                official Firebase password reset link.
              </p>
            </div>
          ) : (
            <div className="mb-6">
              {/* Tab Switcher */}
              <div className="flex bg-slate-100 p-1 rounded-xl mb-6 border border-slate-200/60">
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setErrorMsg(null);
                  }}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    mode === "signin"
                      ? "bg-white text-brand-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" /> Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setErrorMsg(null);
                  }}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    mode === "register"
                      ? "bg-white text-brand-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-brand-600" /> Create
                  Account
                </button>
              </div>

              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                {mode === "signin" ? "Welcome back" : "Create your account"}
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                {mode === "signin"
                  ? "Sign in with your verified credentials to access your household."
                  : "Register to join an existing household or set up as a household host."}
              </p>
            </div>
          )}

          {/* Error Message Callout */}
          {!verificationSent && errorMsg && (
            <div className="mb-5 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex flex-col gap-2.5 animate-fadeIn">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
              {(errorMsg.includes("already exists") ||
                errorMsg.includes("Sign In") ||
                errorMsg.includes("sign in") ||
                errorMsg.includes("credentials")) && (
                <div className="flex items-center gap-4 pl-6 pt-1.5 border-t border-rose-200/60">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signin");
                      setErrorMsg(null);
                    }}
                    className="text-xs font-bold text-brand-700 hover:text-brand-900 underline cursor-pointer"
                  >
                    Switch to Sign In →
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("forgot");
                      setErrorMsg(null);
                    }}
                    className="text-xs font-semibold text-slate-700 hover:text-slate-900 underline cursor-pointer"
                  >
                    Reset Password
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 1. FORGOT PASSWORD VIEW */}
          {!verificationSent && mode === "forgot" && (
            <div>
              {resetSent ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-sm text-emerald-900">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      Password Reset Link Sent!
                    </div>
                    <p className="text-xs text-emerald-700 leading-relaxed">
                      We sent a secure password reset email to{" "}
                      <strong className="font-semibold text-emerald-900">
                        {resetSuccessEmail}
                      </strong>
                      . Please check your inbox (and spam/promotions folder) and
                      click the link to choose a new password.
                    </p>
                  </div>

                  <div className="space-y-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMode("signin");
                        setErrorMsg(null);
                      }}
                      className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-md shadow-brand-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>Return to Sign In</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={loading}
                      className="w-full py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-200 transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
                      />
                      <span>Resend Email</span>
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Registered Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full pl-10 pr-3.5 py-3 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 transition"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-md shadow-brand-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Sending Reset Link...</span>
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4" />
                        <span>Send Password Reset Email</span>
                      </>
                    )}
                  </button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMode("signin");
                        setErrorMsg(null);
                      }}
                      className="text-xs text-slate-600 hover:text-brand-600 font-medium transition cursor-pointer"
                    >
                      Remember your password?{" "}
                      <span className="font-bold text-brand-600">Sign in</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* 2. SIGN IN & REGISTER FORMS */}
          {!verificationSent && mode !== "forgot" && (
            <form onSubmit={handleSignInOrRegister} className="space-y-4">
              {/* Full Name for Register */}
              {mode === "register" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Juan Dela Cruz"
                      className="w-full pl-10 pr-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 transition"
                    />
                  </div>
                </div>
              )}

              {/* Email Address */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="roommate@example.com"
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 transition"
                  />
                </div>
              </div>

              {/* Password Field with Show/Hide Toggle */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Password
                  </label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode("forgot");
                        setErrorMsg(null);
                      }}
                      className="text-xs font-bold text-brand-600 hover:text-brand-800 transition cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={
                      mode === "register"
                        ? "Minimum 6 characters"
                        : "Enter your password"
                    }
                    className="w-full pl-10 pr-10 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Primary Submit Button */}
              <button
                type="submit"
                disabled={loading || googleLoading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-700 via-brand-600 to-indigo-600 hover:from-brand-800 hover:to-indigo-700 text-white font-bold text-xs shadow-md shadow-brand-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>
                      {mode === "register"
                        ? "Creating Account..."
                        : "Signing In..."}
                    </span>
                  </>
                ) : mode === "register" ? (
                  <>
                    <span>Complete Registration</span>
                    <Sparkles className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    <span>Sign In to Dashboard</span>
                    <LogIn className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 pt-1">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  or continue with
                </span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              {/* Google Sign-in Button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading || googleLoading}
                className="w-full py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs border border-slate-200 shadow-xs transition flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60"
              >
                {googleLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-brand-600" />
                    <span>Connecting to Google...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Continue with Google</span>
                  </>
                )}
              </button>

              {/* Footer Switch Prompt */}
              <div className="text-center pt-2">
                {mode === "signin" ? (
                  <p className="text-xs text-slate-500">
                    Don't have an account yet?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setMode("register");
                        setErrorMsg(null);
                      }}
                      className="font-bold text-brand-600 hover:text-brand-800 transition cursor-pointer"
                    >
                      Create an account
                    </button>
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">
                    Already registered?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setMode("signin");
                        setErrorMsg(null);
                      }}
                      className="font-bold text-brand-600 hover:text-brand-800 transition cursor-pointer"
                    >
                      Sign in to household
                    </button>
                  </p>
                )}
              </div>
            </form>
          )}
        </div>

        {/* Bottom Trust Badge */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>TLS 256-bit encrypted authentication</span>
          </div>
          <div>PropertyFlow Splitzy v1.0</div>
        </div>
      </div>
    </div>
  );
};
