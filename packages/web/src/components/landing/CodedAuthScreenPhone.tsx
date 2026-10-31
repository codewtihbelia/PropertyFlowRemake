import React, { useState } from "react";

interface CodedAuthScreenPhoneProps {
  onSignIn?: () => void;
  onSignUp?: () => void;
}

/**
 * CodedAuthScreenPhone
 * 100% Coded Vector UI matching Splitzy Auth Screen:
 * - Dynamic status bar with notch, time 9:41, wifi/battery indicators
 * - Blue Splitzy icon with z-symbol badge
 * - "Splitzy" brand title with black + blue split typography
 * - Subtitle: "Manage, split bills, and track group expenses effortlessly."
 * - Segmented tabs: "Sign In" vs "Sign Up"
 * - Clean input boxes with icons (@ alex.rivera@example.com, lock + eye toggle)
 * - Blue primary button with arrow: "Sign In →"
 * - Bottom royal-blue curved wave container:
 *   - "OR CONTINUE WITH" divider
 *   - White "Continue with Google" pill button
 *   - Black "Continue with Apple" pill button
 *   - Terms & Privacy notice
 *   - "Don't have an account? Sign up" prompt
 */
export const CodedAuthScreenPhone: React.FC<CodedAuthScreenPhoneProps> = ({
  onSignIn,
  onSignUp,
}) => {
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("alex.rivera@example.com");
  const [password, setPassword] = useState("••••••••••••");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      if (tab === "signin") {
        onSignIn?.();
      } else {
        onSignUp?.();
      }
    }, 400);
  };

  return (
    <div className="relative mx-auto w-[310px] sm:w-[325px] h-[660px] bg-slate-900 rounded-[44px] p-3 shadow-2xl ring-1 ring-slate-800/80 select-none">
      {/* Phone Screen Canvas */}
      <div className="w-full h-full bg-blue-600 rounded-[36px] overflow-hidden flex flex-col relative shadow-inner">
        {/* Upper White Section */}
        <div className="p-4 pt-3 w-full bg-white flex flex-col items-center">
          {/* Status Bar */}
          <div className="flex items-center justify-between w-full pt-1 pb-1 px-1">
            <span className="text-[11px] font-bold text-slate-800">9:41</span>

            {/* Island Notch */}
            <div className="w-20 h-3.5 bg-slate-900 rounded-full mx-auto" />

            {/* Status Icons */}
            <div className="flex items-center gap-1.5 text-slate-800">
              <span className="font-bold text-[9px]">5G</span>
              <svg
                className="w-3 h-3 text-slate-800"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
                />
              </svg>
              <svg
                className="w-3.5 h-3 text-slate-800"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M17 6H3a2 2 0 00-2 2v8a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2zm3 5h1a1 1 0 011 1v2a1 1 0 01-1 1h-1v-4z" />
              </svg>
            </div>
          </div>

          {/* Logo Badge */}
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center shadow-[0_8px_20px_rgba(37,99,235,0.35)] mt-3 mb-2">
            <svg
              className="w-8 h-8 text-white"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M19 7h-8.2l3.6-3.6L13 2 7 8l6 6 1.4-1.4L10.8 9H19V7zm-14 10h8.2l-3.6 3.6L11 22l6-6-6-6-1.4 1.4 3.6 3.6H5v2z" />
            </svg>
          </div>

          {/* Brand Header */}
          <div className="flex items-baseline text-2xl font-black tracking-tight">
            <span className="text-slate-900">Split</span>
            <span className="text-blue-600">zy</span>
          </div>
          <p className="text-[11px] text-slate-500 text-center leading-tight mt-1 max-w-[220px]">
            Manage, split bills, and track group expenses effortlessly.
          </p>

          {/* Segmented Control */}
          <div className="w-full grid grid-cols-2 bg-slate-100/90 p-1 rounded-xl mt-3 mb-3 border border-slate-200/60">
            <button
              type="button"
              onClick={() => setTab("signin")}
              className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                tab === "signin"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setTab("signup")}
              className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                tab === "signup"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="w-full space-y-2.5">
            {/* Email Field */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Email Address
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-slate-400 text-xs">
                  @
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs text-slate-900 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-xs"
                  placeholder="alex.rivera@example.com"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-slate-700">
                  Password
                </label>
                {tab === "signin" && (
                  <button
                    type="button"
                    onClick={() =>
                      alert("Password reset link will be sent to your email.")
                    }
                    className="text-[10px] font-bold text-blue-600 hover:underline"
                  >
                    Forgot?
                  </button>
                )}
              </div>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-slate-400">
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-8 pr-8 py-2 text-xs text-slate-900 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-xs"
                  placeholder="••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? (
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Submit Action Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold shadow-[0_4px_14px_rgba(37,99,235,0.35)] flex items-center justify-center gap-1.5 transition-all"
            >
              <span>{tab === "signin" ? "Sign In" : "Sign Up"}</span>
              <span className="text-sm font-bold">→</span>
            </button>
          </form>
        </div>

        {/* ================= Bottom Blue Wave Section ================= */}
        <div className="relative overflow-hidden w-full flex-1 bg-blue-600 flex flex-col justify-between">
          {/* Organic Fluid S-Curve SVG Wave */}
          <div className="w-full h-11 relative overflow-hidden bg-white -mb-px">
            <svg
              viewBox="0 0 320 44"
              className="w-full h-full block"
              preserveAspectRatio="none"
            >
              <path
                d="M 0,26 C 40,8 100,5 160,20 C 220,35 270,30 320,12 L 320,44 L 0,44 Z"
                fill="#2563EB"
              />
            </svg>
          </div>

          <div className="relative bg-blue-600 text-white pt-1 pb-6 px-5 flex-1 flex flex-col justify-between">
            {/* OR CONTINUE WITH Divider */}
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 h-px bg-white/20" />
              <span className="text-[9px] tracking-wider font-extrabold text-white/80">
                OR CONTINUE WITH
              </span>
              <div className="flex-1 h-px bg-white/20" />
            </div>

            {/* Continue with Google */}
            <button
              type="button"
              onClick={() =>
                alert("Google Sign-in connected with Firebase Authentication.")
              }
              className="w-full bg-white hover:bg-slate-50 text-slate-900 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm mb-2 transition-transform active:scale-[0.98]"
            >
              {/* Google G multi-color icon */}
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27a7.2 7.2 0 0 1 0-4.54V6.58H1.25a11.96 11.96 0 0 0 0 10.84l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.93 6.72-4.93z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            {/* Continue with Apple */}
            <button
              type="button"
              onClick={() =>
                alert("Apple Sign-In is configured for iOS devices.")
              }
              className="w-full bg-slate-950 hover:bg-slate-900 text-white py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm mb-3 transition-transform active:scale-[0.98]"
            >
              <span className="text-sm"></span>
              <span>Continue with Apple</span>
            </button>

            {/* Terms & Privacy */}
            <p className="text-[9.5px] text-white/75 text-center leading-tight mb-2.5">
              By continuing, you agree to Splitzy's{" "}
              <a
                href="/terms"
                onClick={(e) => {
                  e.preventDefault();
                  window.history.pushState({ flow: "terms" }, "", "/terms");
                  window.dispatchEvent(new PopStateEvent("popstate"));
                }}
                className="underline font-bold text-white hover:text-white/90"
              >
                Terms of Service
              </a>{" "}
              and{" "}
              <a
                href="/privacy"
                onClick={(e) => {
                  e.preventDefault();
                  window.history.pushState({ flow: "privacy" }, "", "/privacy");
                  window.dispatchEvent(new PopStateEvent("popstate"));
                }}
                className="underline font-bold text-white hover:text-white/90"
              >
                Privacy Policy
              </a>
              .
            </p>

            {/* Don't have an account? Sign up */}
            <div className="text-center text-[11px] text-white/90 font-medium">
              {tab === "signin"
                ? "Don't have an account? "
                : "Already have an account? "}
              <button
                type="button"
                onClick={() => setTab(tab === "signin" ? "signup" : "signin")}
                className="font-black text-white underline hover:opacity-90 cursor-pointer ml-1"
              >
                {tab === "signin" ? "Sign up" : "Sign in"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
