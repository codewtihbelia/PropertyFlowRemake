import React from "react";

interface UniversalLoaderProps {
  text?: string;
  transparent?: boolean;
  inline?: boolean;
}

export const UniversalLoader: React.FC<UniversalLoaderProps> = ({
  text = "Loading...",
  transparent = true,
  inline = false,
}) => {
  if (inline) {
    return (
      <div className="flex items-center justify-center gap-3 py-6">
        <div className="w-6 h-6 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
        {text && (
          <span className="text-xs font-semibold text-blue-700">{text}</span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`min-h-[280px] w-full flex flex-col items-center justify-center p-8 rounded-3xl transition-opacity duration-200 ${
        transparent
          ? "bg-white/60 backdrop-blur-xs"
          : "bg-white border border-slate-200 shadow-xs"
      }`}
    >
      <div className="w-11 h-11 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin" />
      {text && (
        <p className="mt-3.5 text-xs font-semibold text-blue-600 tracking-wide">
          {text}
        </p>
      )}
    </div>
  );
};
