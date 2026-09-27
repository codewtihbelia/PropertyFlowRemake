import React from "react";

export type SkeletonType =
  | "dashboard"
  | "bills"
  | "attendance"
  | "payments"
  | "members"
  | "cards"
  | "table"
  | "profile"
  | "communication"
  | "settings"
  | "form"
  | "support"
  | "simple";

export interface UniversalLoaderProps {
  /** Text shown below spinner or in overlay */
  text?: string;
  /** Subtitle context (e.g. 'Syncing with Firestore Cloud') */
  subtitle?: string;
  /** Style mode: 'skeleton' (default when type provided), 'spinner', or 'overlay' */
  variant?: "skeleton" | "spinner" | "overlay";
  /** Pre-built screen skeleton shape */
  type?: SkeletonType;
  /** Render compact inline spinner with text */
  inline?: boolean;
  /** Transparent background wrapper */
  transparent?: boolean;
  /** Number of rows or cards for generic skeletons */
  count?: number;
}

export const UniversalLoader: React.FC<UniversalLoaderProps> = ({
  text,
  subtitle,
  variant,
  type,
  inline = false,
  transparent = true,
  count = 4,
}) => {
  // If variant is explicitly skeleton OR a skeleton type is provided without variant='spinner'
  const isSkeleton =
    variant === "skeleton" ||
    (type && variant !== "spinner" && variant !== "overlay");

  if (isSkeleton) {
    return <UniversalSkeleton type={type || "dashboard"} count={count} />;
  }

  // Full-screen / Modal Blocking Overlay
  if (variant === "overlay") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 backdrop-blur-xs p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl p-6 md:p-8 max-w-sm w-full border border-slate-100 shadow-2xl flex flex-col items-center text-center">
          <div className="relative flex items-center justify-center mb-4">
            <div className="w-14 h-14 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin" />
            <div className="absolute w-3 h-3 rounded-full bg-blue-600" />
          </div>
          <h4 className="text-base font-bold text-slate-900 tracking-tight">
            {text || "Processing Request..."}
          </h4>
          {subtitle && (
            <p className="text-xs text-slate-500 mt-1 max-w-[240px]">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Inline loader for buttons, small headers, or dropdowns
  if (inline) {
    return (
      <div className="flex items-center justify-center gap-2.5 py-4">
        <div className="w-5 h-5 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
        {text && (
          <span className="text-xs font-semibold text-blue-700">{text}</span>
        )}
      </div>
    );
  }

  // Standard Spinner Card
  return (
    <div
      className={`min-h-[280px] w-full flex flex-col items-center justify-center p-8 rounded-3xl transition-opacity duration-200 ${
        transparent
          ? "bg-white/60 backdrop-blur-xs"
          : "bg-white border border-slate-200 shadow-xs"
      }`}
    >
      <div className="relative flex items-center justify-center">
        <div className="w-11 h-11 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin" />
        <div className="absolute w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
      </div>
      <p className="mt-3.5 text-xs font-bold text-blue-700 tracking-wide">
        {text || "Loading data..."}
      </p>
      {subtitle && (
        <p className="mt-1 text-[11px] text-slate-400 font-medium">
          {subtitle}
        </p>
      )}
    </div>
  );
};

/**
 * High-performance Shimmer Skeleton component system
 * Prevents Cumulative Layout Shift (CLS) and preserves structural UI hierarchy
 */
export const UniversalSkeleton: React.FC<{
  type: SkeletonType;
  count?: number;
}> = ({ type, count = 4 }) => {
  switch (type) {
    case "bills":
      return (
        <div
          className="space-y-6 animate-pulse"
          aria-busy="true"
          aria-label="Loading bills"
        >
          {/* Top Banner Skeleton */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-2">
              <div className="h-4 w-32 bg-slate-200 rounded-md" />
              <div className="h-8 w-56 bg-slate-200 rounded-lg" />
              <div className="h-3 w-44 bg-slate-100 rounded-md" />
            </div>
            <div className="h-10 w-36 bg-slate-200 rounded-xl" />
          </div>

          {/* Breakdown Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="h-4 w-24 bg-slate-200 rounded-md" />
                  <div className="w-8 h-8 rounded-xl bg-slate-200" />
                </div>
                <div className="h-7 w-28 bg-slate-200 rounded-lg" />
                <div className="h-3 w-40 bg-slate-100 rounded-md" />
              </div>
            ))}
          </div>

          {/* Bill Table / Payor Breakdown */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="h-5 w-40 bg-slate-200 rounded-md" />
              <div className="h-4 w-20 bg-slate-100 rounded-md" />
            </div>
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-200" />
                    <div className="space-y-1.5">
                      <div className="h-4 w-32 bg-slate-200 rounded-md" />
                      <div className="h-3 w-20 bg-slate-100 rounded-md" />
                    </div>
                  </div>
                  <div className="h-5 w-24 bg-slate-200 rounded-md" />
                </div>
              ))}
            </div>
          </div>
        </div>
      );

    case "attendance":
      return (
        <div
          className="space-y-6 animate-pulse"
          aria-busy="true"
          aria-label="Loading attendance"
        >
          {/* Top Banner Skeleton */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-2">
              <div className="h-4 w-36 bg-slate-200 rounded-md" />
              <div className="h-8 w-60 bg-slate-200 rounded-lg" />
              <div className="h-3 w-48 bg-slate-100 rounded-md" />
            </div>
            <div className="flex gap-2">
              <div className="h-9 w-28 bg-slate-200 rounded-xl" />
              <div className="h-9 w-28 bg-slate-200 rounded-xl" />
            </div>
          </div>

          {/* Calendar Month Header & Grid */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
            <div className="flex items-center justify-between">
              <div className="h-5 w-32 bg-slate-200 rounded-md" />
              <div className="h-8 w-24 bg-slate-100 rounded-lg" />
            </div>
            {/* Days row */}
            <div className="grid grid-cols-7 gap-2">
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <div key={i} className="h-4 bg-slate-100 rounded-sm" />
              ))}
            </div>
            {/* Date cells grid */}
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 28 }).map((_, i) => (
                <div
                  key={i}
                  className="h-12 bg-slate-100 rounded-xl border border-slate-200/50"
                />
              ))}
            </div>
          </div>
        </div>
      );

    case "payments":
      return (
        <div
          className="space-y-6 animate-pulse"
          aria-busy="true"
          aria-label="Loading payments"
        >
          {/* Top Banner Skeleton */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-2">
              <div className="h-4 w-36 bg-slate-200 rounded-md" />
              <div className="h-8 w-56 bg-slate-200 rounded-lg" />
              <div className="h-3 w-48 bg-slate-100 rounded-md" />
            </div>
            <div className="h-10 w-32 bg-slate-200 rounded-xl" />
          </div>

          {/* Filter Pills Skeleton */}
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-8 w-24 bg-slate-200 rounded-xl" />
            ))}
          </div>

          {/* Transaction List Skeleton */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-slate-50/50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200" />
                  <div className="space-y-1.5">
                    <div className="h-4 w-36 bg-slate-200 rounded-md" />
                    <div className="h-3 w-28 bg-slate-100 rounded-md" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-5 w-20 bg-slate-200 rounded-md" />
                  <div className="h-8 w-20 bg-slate-200 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case "members":
    case "cards":
      return (
        <div
          className="space-y-6 animate-pulse"
          aria-busy="true"
          aria-label="Loading list"
        >
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex justify-between items-center">
            <div className="space-y-2">
              <div className="h-4 w-28 bg-slate-200 rounded-md" />
              <div className="h-7 w-48 bg-slate-200 rounded-lg" />
            </div>
            <div className="h-10 w-32 bg-slate-200 rounded-xl" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: count }).map((_, i) => (
              <div
                key={i}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-slate-200" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-4 w-28 bg-slate-200 rounded-md" />
                    <div className="h-3 w-36 bg-slate-100 rounded-md" />
                  </div>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                  <div className="h-5 w-16 bg-slate-200 rounded-md" />
                  <div className="h-4 w-20 bg-slate-100 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case "table":
      return (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4 animate-pulse">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="h-5 w-44 bg-slate-200 rounded-md" />
            <div className="h-8 w-28 bg-slate-200 rounded-xl" />
          </div>
          <div className="space-y-2.5">
            {Array.from({ length: count }).map((_, i) => (
              <div
                key={i}
                className="h-12 bg-slate-50 rounded-xl border border-slate-100 flex items-center px-4 justify-between"
              >
                <div className="h-4 w-36 bg-slate-200 rounded-md" />
                <div className="h-4 w-24 bg-slate-200 rounded-md" />
                <div className="h-4 w-16 bg-slate-100 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      );

    case "profile":
      return (
        <div
          className="max-w-3xl mx-auto space-y-6 animate-pulse"
          aria-busy="true"
          aria-label="Loading profile"
        >
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-slate-200" />
            <div className="space-y-2.5 flex-1 text-center sm:text-left">
              <div className="h-7 w-48 bg-slate-200 rounded-lg mx-auto sm:mx-0" />
              <div className="h-4 w-36 bg-slate-100 rounded-md mx-auto sm:mx-0" />
              <div className="h-4 w-28 bg-slate-200 rounded-md mx-auto sm:mx-0" />
            </div>
          </div>
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xs space-y-5">
            <div className="h-5 w-40 bg-slate-200 rounded-md" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="h-4 w-24 bg-slate-100 rounded-md" />
                <div className="h-10 bg-slate-100 rounded-xl" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-24 bg-slate-100 rounded-md" />
                <div className="h-10 bg-slate-100 rounded-xl" />
              </div>
            </div>
            <div className="h-10 w-32 bg-slate-200 rounded-xl ml-auto" />
          </div>
        </div>
      );

    case "communication":
      return (
        <div
          className="space-y-6 animate-pulse"
          aria-busy="true"
          aria-label="Loading messages"
        >
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex justify-between items-center">
            <div className="space-y-2">
              <div className="h-4 w-36 bg-slate-200 rounded-md" />
              <div className="h-7 w-56 bg-slate-200 rounded-lg" />
            </div>
            <div className="h-9 w-32 bg-slate-200 rounded-xl" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3">
              <div className="h-5 w-28 bg-slate-200 rounded-md pb-2 border-b border-slate-100" />
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100"
                >
                  <div className="w-10 h-10 rounded-full bg-slate-200 shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-4 w-24 bg-slate-200 rounded-md" />
                    <div className="h-3 w-36 bg-slate-100 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
            <div className="md:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between h-[420px]">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-200" />
                  <div className="space-y-1">
                    <div className="h-4 w-32 bg-slate-200 rounded-md" />
                    <div className="h-3 w-20 bg-slate-100 rounded-md" />
                  </div>
                </div>
              </div>
              <div className="space-y-4 my-auto">
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-slate-200" />
                  <div className="h-12 w-64 bg-slate-100 rounded-2xl" />
                </div>
                <div className="flex items-start justify-end">
                  <div className="h-10 w-48 bg-slate-200 rounded-2xl" />
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-slate-200" />
                  <div className="h-14 w-72 bg-slate-100 rounded-2xl" />
                </div>
              </div>
              <div className="flex gap-2 pt-4 border-t border-slate-100">
                <div className="h-11 flex-1 bg-slate-100 rounded-xl" />
                <div className="h-11 w-20 bg-slate-200 rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      );

    case "settings":
      return (
        <div
          className="max-w-4xl mx-auto space-y-6 animate-pulse"
          aria-busy="true"
          aria-label="Loading settings"
        >
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex justify-between items-center">
            <div className="space-y-2">
              <div className="h-4 w-32 bg-slate-200 rounded-md" />
              <div className="h-7 w-48 bg-slate-200 rounded-lg" />
            </div>
            <div className="h-10 w-28 bg-slate-200 rounded-xl" />
          </div>
          <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-xs space-y-6">
            <div className="flex items-center gap-5 pb-6 border-b border-slate-100">
              <div className="w-20 h-20 rounded-full bg-slate-200 shrink-0" />
              <div className="space-y-2">
                <div className="h-5 w-36 bg-slate-200 rounded-md" />
                <div className="h-4 w-48 bg-slate-100 rounded-md" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 w-28 bg-slate-200 rounded-md" />
                  <div className="h-11 bg-slate-100 rounded-xl" />
                </div>
              ))}
            </div>
            <div className="pt-4 flex justify-end">
              <div className="h-11 w-32 bg-slate-200 rounded-xl" />
            </div>
          </div>
        </div>
      );

    case "form":
      return (
        <div
          className="max-w-3xl mx-auto space-y-6 animate-pulse"
          aria-busy="true"
          aria-label="Loading form"
        >
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex justify-between items-center">
            <div className="space-y-2">
              <div className="h-4 w-28 bg-slate-200 rounded-md" />
              <div className="h-7 w-56 bg-slate-200 rounded-lg" />
              <div className="h-3 w-40 bg-slate-100 rounded-md" />
            </div>
            <div className="h-9 w-28 bg-slate-200 rounded-xl" />
          </div>
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xs space-y-5">
            <div className="h-20 bg-slate-50 border border-slate-100 rounded-2xl" />
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 w-32 bg-slate-200 rounded-md" />
                  <div className="h-11 bg-slate-100 rounded-xl border border-slate-200/60" />
                </div>
              ))}
            </div>
            <div className="h-12 w-full bg-slate-200 rounded-xl mt-4" />
          </div>
        </div>
      );

    case "support":
      return (
        <div
          className="space-y-6 animate-pulse"
          aria-busy="true"
          aria-label="Loading support"
        >
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
            <div className="h-4 w-32 bg-slate-200 rounded-md mb-2" />
            <div className="h-7 w-52 bg-slate-200 rounded-lg" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2"
                >
                  <div className="flex justify-between items-center">
                    <div className="h-4 w-32 bg-slate-200 rounded-md" />
                    <div className="h-4 w-14 bg-slate-200 rounded-md" />
                  </div>
                  <div className="h-3 w-24 bg-slate-100 rounded-md" />
                </div>
              ))}
            </div>
            <div className="md:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
              <div className="h-6 w-52 bg-slate-200 rounded-md pb-2 border-b border-slate-100" />
              <div className="h-24 bg-slate-50 rounded-2xl border border-slate-100" />
              <div className="h-28 bg-slate-100 rounded-2xl" />
              <div className="flex gap-2 justify-end">
                <div className="h-10 w-28 bg-slate-200 rounded-xl" />
                <div className="h-10 w-28 bg-slate-200 rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      );

    case "simple":
      return (
        <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3 animate-pulse">
          <div className="h-6 w-48 bg-slate-200 rounded-md" />
          <div className="h-4 w-full bg-slate-100 rounded-md" />
          <div className="h-4 w-3/4 bg-slate-100 rounded-md" />
        </div>
      );

    case "dashboard":
    default:
      return (
        <div
          className="space-y-6 animate-pulse"
          aria-busy="true"
          aria-label="Loading dashboard"
        >
          {/* Top Banner Skeleton */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-2">
              <div className="h-4 w-32 bg-slate-200 rounded-md" />
              <div className="h-8 w-64 bg-slate-200 rounded-lg" />
              <div className="h-3 w-40 bg-slate-100 rounded-md" />
            </div>
            <div className="flex gap-2">
              <div className="h-10 w-28 bg-slate-200 rounded-xl" />
              <div className="h-10 w-28 bg-slate-200 rounded-xl" />
            </div>
          </div>

          {/* Metric Cards Skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="h-3.5 w-24 bg-slate-200 rounded-md" />
                  <div className="w-7 h-7 rounded-lg bg-slate-200" />
                </div>
                <div className="h-7 w-28 bg-slate-200 rounded-lg" />
                <div className="h-3 w-32 bg-slate-100 rounded-md" />
              </div>
            ))}
          </div>

          {/* Main 2-column content grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="h-5 w-40 bg-slate-200 rounded-md" />
                <div className="h-4 w-20 bg-slate-100 rounded-md" />
              </div>
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-16 bg-slate-50 rounded-xl border border-slate-100"
                  />
                ))}
              </div>
            </div>
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="h-5 w-32 bg-slate-200 rounded-md pb-3 border-b border-slate-100" />
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-12 bg-slate-50 rounded-xl border border-slate-100"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      );
  }
};
