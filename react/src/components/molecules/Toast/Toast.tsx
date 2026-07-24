import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

interface ToastContextValue {
  showToast: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// One shared toast surface for the whole app (backlog: "replace ad-hoc
// FlashMessage/alert() usage with ONE toast system"). Bottom-center,
// green-bordered, auto-dismisses — matches the redesign handoff exactly.
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
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const showToast = useCallback((msg: string) => {
    setMessage(msg);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setMessage(null), TOAST_DURATION_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {message && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2 px-5 py-3.5 rounded-input bg-input-2 border border-good/40 text-text-emphasis text-sm font-semibold shadow-modal animate-fttoast"
        >
          <span className="text-good">✓</span>
          {message}
        </div>
      )}
    </ToastContext.Provider>
  );
};
