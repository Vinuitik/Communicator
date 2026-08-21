import React, { useState } from 'react';
import Textarea from '../../atoms/Textarea';
import Input from '../../atoms/Input';
import ConfirmDialog from '../../molecules/ConfirmDialog';
import { KnowledgeCrudItem } from '../../../types/api';

interface KnowledgeCrudPanelProps {
  title: string;
  factLabel: string;
  importanceLabel: string;
  addButtonLabel: string;
  items: KnowledgeCrudItem[];
  loading: boolean;
  error: string | null;
  onAdd: (fact: string, importance: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  /** Compact row-list styling (no card wrapper/heading) — used inside the
   * Profile hub's Raw knowledge tab, which already has its own card. */
  compact?: boolean;
  /** Renders importance as a semantic colored tag (e.g. High/Medium) instead
   * of a plain numeric badge — used by Group Settings & permissions. */
  importanceFormat?: (value: number) => { label: string; color: string };
}

// API-backed sibling of KnowledgeEditor (which is local-only, for the
// no-entity-yet add-friend case). GroupKnowledge.java ("Notes") and
// GroupPermission.java ("Settings") share this exact shape and controller
// pattern (add/get/delete), so this one panel drives both sections of
// GroupDetailsPage — parameterized rather than duplicated. Also reused by
// the Profile hub's Raw knowledge tab (compact mode).
const KnowledgeCrudPanel: React.FC<KnowledgeCrudPanelProps> = ({
  title, factLabel, importanceLabel, addButtonLabel, items, loading, error, onAdd, onDelete, compact, importanceFormat,
}) => {
  const [fact, setFact] = useState('');
  const [importance, setImportance] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = fact.trim();
    if (!trimmed || !importance) return;
    setSubmitting(true);
    try {
      await onAdd(trimmed, parseInt(importance, 10));
      setFact('');
      setImportance('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    setConfirmId(null);
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  };

  const body = (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 mb-4">
        <Textarea
          label={factLabel} rows={2} value={fact}
          onChange={(e) => setFact(e.target.value)}
        />
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <Input
              label={importanceLabel} type="number" value={importance}
              onChange={(e) => setImportance(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2.5 rounded-input border-none bg-accent-gradient text-white font-bold text-sm shadow-button-sm hover:brightness-110 disabled:opacity-50 transition-all"
          >
            {submitting ? 'Adding…' : addButtonLabel}
          </button>
        </div>
      </form>

      {error && <div className="text-bad text-sm mb-3">{error}</div>}

      {loading ? (
        <div className="text-center p-4 text-text-muted text-sm">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-center p-4 text-text-muted text-sm">None yet.</div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {items.map((item) => {
            const tag = importanceFormat?.(item.importance);
            return (
            <div key={item.id} className="flex items-center gap-3 px-3.5 py-2.5 bg-surface-2 rounded-lg">
              <span className="flex-1 text-[13px] text-text-secondary">{item.fact}</span>
              {tag ? (
                <span className="text-[10.5px] font-bold px-2.5 py-0.5 rounded-pill" style={{ color: tag.color, background: `${tag.color}22` }}>
                  {tag.label}
                </span>
              ) : (
                <span className="text-[10.5px] font-bold text-text-faint bg-white/[.06] px-2 py-0.5 rounded-pill">
                  {importanceLabel} {item.importance}
                </span>
              )}
              <button
                type="button"
                onClick={() => setConfirmId(item.id)}
                disabled={deletingId === item.id}
                className="text-text-faint hover:text-bad text-xs disabled:opacity-50 transition-colors"
              >
                {deletingId === item.id ? '…' : '✕'}
              </button>
            </div>
            );
          })}
        </div>
      )}
      <ConfirmDialog
        open={confirmId !== null}
        title={`Delete this ${factLabel.toLowerCase()}?`}
        confirmLabel="Delete"
        danger
        onConfirm={() => confirmId !== null && handleDelete(confirmId)}
        onCancel={() => setConfirmId(null)}
      />
    </>
  );

  if (compact) return body;

  return (
    <div className="bg-surface border border-hairline rounded-card p-5 mt-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-bold text-text-primary">{title}</h2>
        <span className="text-xs text-text-faint">{items.length}</span>
      </div>
      {body}
    </div>
  );
};

export default KnowledgeCrudPanel;
