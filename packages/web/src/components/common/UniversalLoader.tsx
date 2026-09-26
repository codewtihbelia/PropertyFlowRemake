import React from "react";

export interface UniversalLoaderProps {
  text?: string;
  subtitle?: string;
  transparent?: boolean;
  inline?: boolean;
  icon?: "google" | "splitzy" | "spinner" | "auto";
  showDots?: boolean;
  isExiting?: boolean;
}

export const GoogleLogoSvg: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
    />
  </svg>
);

export const SplitzyLogoSvg: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <div
    style={{ width: size, height: size }}
    className="rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-xs shadow-xs"
  >
    S
  </div>
);

export const UniversalLoader: React.FC<UniversalLoaderProps> = ({
  text = "Completing Google sign in...",
  subtitle,
  transparent = true,
  inline = false,
  icon = "auto",
  showDots = true,
  isExiting = false,
}) => {
  if (inline) {
    return (
      <div className="flex items-center justify-center gap-3 py-4">
        <div className="w-5 h-5 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
        {text && (
          <span className="text-xs font-semibold text-blue-700">{text}</span>
        )}
      </div>
    );
  }

  const isGoogle =
    icon === "google" ||
    (icon === "auto" && text.toLowerCase().includes("google"));

  const resolvedSubtitle =
    subtitle !== undefined
      ? subtitle
      : isGoogle
        ? "Verifying your account details"
        : "Please wait a moment...";

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-all duration-200 ${
        isExiting ? "opacity-0 pointer-events-none" : "opacity-100"
      } ${
        transparent
          ? "bg-slate-900/20 backdrop-blur-md"
          : "bg-slate-50/95 backdrop-blur-sm"
      }`}
    >
      {/* White Loader Card */}
      <div
        className={`bg-white rounded-[28px] py-8 px-7 max-w-[290px] w-full flex flex-col items-center justify-center shadow-2xl border border-slate-100/90 text-center transform transition-all duration-200 ${
          isExiting ? "scale-95 opacity-0" : "scale-100 opacity-100"
        }`}
      >
        {/* Spinner Ring with Centered Icon */}
        <div className="relative w-[68px] h-[68px] flex items-center justify-center">
          {/* Subtle Outer Track */}
          <div className="absolute inset-0 rounded-full border-[3.5px] border-slate-100" />
          {/* Spinning Blue Arc */}
          <div className="absolute inset-0 rounded-full border-[3.5px] border-transparent border-t-blue-600 border-r-blue-500 animate-spin" />
          {/* Centered Brand Icon */}
          <div className="relative z-10 flex items-center justify-center">
            {isGoogle ? (
              <GoogleLogoSvg size={24} />
            ) : (
              <SplitzyLogoSvg size={24} />
            )}
          </div>
        </div>

        {/* Title */}
        {text && (
          <h3 className="mt-4.5 text-[15px] font-bold text-slate-900 tracking-tight leading-snug">
            {text}
          </h3>
        )}

        {/* Subtitle */}
        {resolvedSubtitle && (
          <p className="mt-1.5 text-xs text-slate-500 font-normal leading-relaxed px-2">
            {resolvedSubtitle}
          </p>
        )}

        {/* Three Animated Bouncing Dots */}
        {showDots && (
          <div className="flex items-center justify-center gap-1.5 mt-4">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce [animation-delay:-0.32s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce [animation-delay:-0.16s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce" />
          </div>
        )}
      </div>
    </div>
  );
};
