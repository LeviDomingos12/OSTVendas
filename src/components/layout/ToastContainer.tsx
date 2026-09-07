import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle, XCircle, AlertCircle, Activity, X } from "lucide-react";
import { Toast } from "../../types";

interface ToastContainerProps {
  toasts: Toast[];
  onRemoveToast: (id: string) => void;
  theme: "day" | "night" | string;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onRemoveToast,
  theme
}) => {
  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none no-print">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`p-4 rounded-xl border shadow-lg pointer-events-auto flex gap-3 relative overflow-hidden backdrop-blur-md ${
              theme === "night"
                ? "bg-zinc-950/95 border-zinc-850/80 text-slate-100 shadow-zinc-950/45"
                : "bg-white/95 border-slate-200 text-slate-800 shadow-slate-200/40"
            }`}
          >
            {/* Vertical side glow indicator bar according to toast type */}
            <div
              className={`absolute top-0 left-0 bottom-0 w-1.5 ${
                t.type === "success"
                  ? "bg-emerald-500"
                  : t.type === "error"
                  ? "bg-rose-500"
                  : t.type === "warning"
                  ? "bg-amber-500"
                  : "bg-blue-500"
              }`}
            />

            {/* Icon selection dynamically */}
            <div className="mt-0.5 shrink-0">
              {t.type === "success" && (
                <CheckCircle className="w-5 h-5 text-emerald-500" />
              )}
              {t.type === "error" && (
                <XCircle className="w-5 h-5 text-rose-500" />
              )}
              {t.type === "warning" && (
                <AlertCircle className="w-5 h-5 text-amber-500" />
              )}
              {t.type === "info" && (
                <Activity className="w-5 h-5 text-blue-500" />
              )}
            </div>

            {/* Contents block */}
            <div className="flex-1 pr-6">
              <h4 className="font-extrabold text-xs tracking-tight uppercase">
                {t.title}
              </h4>
              <p
                className={`text-[11px] mt-1 pr-1 font-semibold leading-relaxed ${
                  theme === "night" ? "text-slate-350" : "text-slate-550"
                }`}
              >
                {t.message}
              </p>
            </div>

            {/* Manual Close Button */}
            <button
              type="button"
              onClick={() => onRemoveToast(t.id)}
              className={`absolute top-3 right-3 p-1 rounded-lg transition-colors cursor-pointer ${
                theme === "night"
                  ? "hover:bg-zinc-900 text-slate-400 hover:text-white"
                  : "hover:bg-slate-100 text-slate-400 hover:text-slate-900"
              }`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
