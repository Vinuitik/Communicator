import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

type ToastVariant = 'success' | 'error';

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// One shared toast surface for the whole app (backlog: "replace ad-hoc
// FlashMessage/alert() usage with ONE toast system"). Bottom-center,
// auto-dismisses — matches the redesign handoff exactly. 'error' variant
// (Stage 7 cleanup) added when the last window.alert() call sites
// (SettingsPage/GroupDetailsPage failure paths) needed a red state, not just
// the green success toast Stage 1 originally built for.
// Wrap the app once (see App.tsx) and call useToast() from any component.
const TOAST_DURATION_MS = 2600;

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<{ message: string; variant: ToastVariant } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const showToast = useCallback((message: string, variant: ToastVariant = 'success') => {
    setToast({ message, variant });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2 px-5 py-3.5 rounded-input bg-input-2 border text-text-emphasis text-sm font-semibold shadow-modal animate-fttoast ${
            toast.variant === 'error' ? 'border-bad/40' : 'border-good/40'
          }`}
        >
          <span className={toast.variant === 'error' ? 'text-bad' : 'text-good'}>{toast.variant === 'error' ? '✕' : '✓'}</span>
          {toast.message}
        </div>
      )}
    </ToastContext.Provider>
  );
};
