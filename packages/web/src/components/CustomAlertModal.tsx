import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Trash2,
  HelpCircle,
  Info,
  X,
} from "lucide-react";
import {
  webAlertService,
  WebAlertConfig,
  WebAlertButton,
  WebAlertType,
} from "../services/webAlertService";

export const CustomAlertModal: React.FC = () => {
  const [config, setConfig] = useState<WebAlertConfig | null>(null);

  useEffect(() => {
    return webAlertService.register((newConfig) => {
      setConfig(newConfig);
    });
  }, []);

  if (!config) return null;

  const handleDismiss = () => {
    const cancelBtn = config.buttons?.find((b) => b.style === "cancel");
    if (cancelBtn?.onClick) {
      cancelBtn.onClick();
    } else if (config.onDismiss) {
      config.onDismiss();
    }
    webAlertService.dismiss();
  };

  const handleButtonClick = (btn: WebAlertButton) => {
    webAlertService.dismiss();
    if (btn.onClick) {
      btn.onClick();
    }
  };

  const renderIcon = (type: WebAlertType = "info") => {
    switch (type) {
      case "success":
        return (
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shadow-xs">
            <CheckCircle2 className="w-7 h-7" />
          </div>
        );
      case "error":
        return (
          <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shadow-xs">
            <AlertCircle className="w-7 h-7" />
          </div>
        );
      case "warning":
        return (
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shadow-xs">
            <AlertTriangle className="w-7 h-7" />
          </div>
        );
      case "destructive":
        return (
          <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shadow-xs">
            <Trash2 className="w-7 h-7" />
          </div>
        );
      case "confirm":
        return (
          <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shadow-xs">
            <HelpCircle className="w-7 h-7" />
          </div>
        );
      case "info":
      default:
        return (
          <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shadow-xs">
            <Info className="w-7 h-7" />
          </div>
        );
    }
  };

  const buttons =
    config.buttons && config.buttons.length > 0
      ? config.buttons
      : [{ text: "OK", style: "default" as const }];

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in"
      onClick={handleDismiss}
    >
      <div
        className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 flex flex-col items-center text-center transform transition-all duration-200 scale-100 animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Dismiss corner icon */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon */}
        <div className="mb-4">{renderIcon(config.type)}</div>

        {/* Title */}
        {config.title && (
          <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">
            {config.title}
          </h3>
        )}

        {/* Message */}
        {config.message && (
          <p className="text-sm text-slate-600 mt-2 leading-relaxed whitespace-pre-line">
            {config.message}
          </p>
        )}

        {/* Action Buttons */}
        <div className="mt-6 w-full flex items-center gap-2.5">
          {buttons.length === 1 ? (
            <button
              type="button"
              onClick={() => handleButtonClick(buttons[0])}
              className={`w-full py-3 px-4 rounded-xl font-bold text-sm text-white transition shadow-sm active:scale-[0.98] ${
                config.type === "error" || config.type === "destructive"
                  ? "bg-rose-600 hover:bg-rose-700"
                  : "bg-brand-600 hover:bg-brand-700"
              }`}
            >
              {buttons[0].text}
            </button>
          ) : (
            buttons.map((btn, idx) => {
              const isCancel = btn.style === "cancel";
              const isDestructive = btn.style === "destructive";

              return (
                <button
                  key={`${btn.text}-${idx}`}
                  type="button"
                  onClick={() => handleButtonClick(btn)}
                  className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm transition active:scale-[0.98] ${
                    isCancel
                      ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                      : isDestructive
                        ? "bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
                        : "bg-brand-600 hover:bg-brand-700 text-white shadow-sm"
                  }`}
                >
                  {btn.text}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
