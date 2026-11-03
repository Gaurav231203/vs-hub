import React, { useEffect, useState } from 'react';
import { useToastStore, ToastItem } from '../../stores/toastStore.js';
import { CheckCircle2, AlertCircle, Info, RotateCcw, X } from 'lucide-react';

function ToastCard({ toast }: { toast: ToastItem }) {
  const removeToast = useToastStore((state) => state.removeToast);
  const [isUndoing, setIsUndoing] = useState(false);
  const duration = toast.durationMs || (toast.type === 'undo' ? 8000 : 4000);

  const handleUndo = async () => {
    if (toast.onUndo) {
      setIsUndoing(true);
      try {
        await toast.onUndo();
      } finally {
        removeToast(toast.id);
      }
    }
  };

  const getBorderColor = () => {
    if (toast.type === 'error') return 'border-red-500/30';
    if (toast.type === 'undo') return 'border-amber-500/30';
    if (toast.type === 'success') return 'border-emerald-500/30';
    return 'border-[var(--line-2)]';
  };

  const getProgressColor = () => {
    if (toast.type === 'error') return 'bg-red-500';
    if (toast.type === 'undo') return 'bg-amber-500';
    if (toast.type === 'success') return 'bg-emerald-500';
    return 'bg-blue-500';
  };

  return (
    <div
      className={`relative overflow-hidden backdrop-blur-xl border shadow-2xl rounded-2xl p-4 min-w-[320px] max-w-md flex items-center space-x-3 text-sm transition-all animate-in fade-in slide-in-from-bottom-3 duration-200 ${getBorderColor()}`}
      style={{
        backgroundColor: 'var(--float, #ffffff)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.15) inset, 0 20px 48px -12px rgba(0,0,0,0.4)',
      }}
    >
      {/* Icon with glow background */}
      <div className="shrink-0">
        {toast.type === 'undo' ? (
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-500">
            <RotateCcw className="w-4 h-4" />
          </div>
        ) : toast.type === 'success' ? (
          <div className="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-500">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        ) : toast.type === 'error' ? (
          <div className="w-8 h-8 rounded-xl bg-red-500/15 flex items-center justify-center text-red-500">
            <AlertCircle className="w-4 h-4" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-xl bg-blue-500/15 flex items-center justify-center text-blue-500">
            <Info className="w-4 h-4" />
          </div>
        )}
      </div>

      {/* Message */}
      <div className="flex-1 text-[var(--text)] font-semibold text-xs sm:text-sm tracking-tight leading-snug">
        {toast.message}
      </div>

      {/* Undo Action Button */}
      {toast.type === 'undo' && toast.onUndo && (
        <button
          onClick={handleUndo}
          disabled={isUndoing}
          className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-900 text-xs font-bold active:scale-95 transition-all flex items-center space-x-1.5 shrink-0 shadow-sm cursor-pointer"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isUndoing ? 'animate-spin' : ''}`} />
          <span>{isUndoing ? 'Undoing...' : 'Undo'}</span>
        </button>
      )}

      {/* Close button */}
      <button
        onClick={() => removeToast(toast.id)}
        className="text-[var(--muted)] hover:text-[var(--text)] p-1 rounded-lg transition-colors cursor-pointer shrink-0"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Animated countdown progress bar */}
      <div
        className={`absolute bottom-0 left-0 h-0.5 ${getProgressColor()} opacity-60`}
        style={{
          animation: `shrinkProgress ${duration}ms linear forwards`,
        }}
      />
    </div>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col space-y-3 pointer-events-auto">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
