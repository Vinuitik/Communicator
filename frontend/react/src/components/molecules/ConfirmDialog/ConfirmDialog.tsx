import React from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// Replaces window.confirm() call sites (backlog: "ONE confirm dialog").
// Controlled by the caller's own boolean state — no global singleton, since
// every existing confirm() usage is already local to one delete flow.
const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger, onConfirm, onCancel,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-ftfade"
      onClick={onCancel}
    >
      <div
        className="w-[380px] max-w-[92vw] bg-modal border border-white/10 rounded-card p-6 shadow-modal animate-ftmodal"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display font-bold text-lg text-text-primary m-0">{title}</h3>
        {message && <p className="mt-2 text-sm text-text-secondary">{message}</p>}
        <div className="flex gap-2.5 mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-input border border-white/10 text-text-emphasis font-semibold text-sm hover:bg-white/5 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-input font-bold text-sm transition-colors ${
              danger
                ? 'bg-bad/15 border border-bad/40 text-bad hover:bg-bad/25'
                : 'bg-accent-gradient text-white shadow-button-sm hover:brightness-110'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
