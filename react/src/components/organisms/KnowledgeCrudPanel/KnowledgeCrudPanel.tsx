import React, { useState } from 'react';
import Textarea from '../../atoms/Textarea';
import Input from '../../atoms/Input';
import Button from '../../atoms/Button';
import { GroupCrudItem } from '../../../types/api';

interface KnowledgeCrudPanelProps {
  title: string;
  factLabel: string;
  importanceLabel: string;
  addButtonLabel: string;
  items: GroupCrudItem[];
  loading: boolean;
  error: string | null;
  onAdd: (fact: string, importance: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

// API-backed sibling of KnowledgeEditor (which is local-only, for the
// no-entity-yet add-friend case). GroupKnowledge.java ("Notes") and
// GroupPermission.java ("Settings") share this exact shape and controller
// pattern (add/get/delete), so this one panel drives both sections of
// GroupDetailsPage — parameterized rather than duplicated, same way the
// legacy KnowledgeManager class configured itself per entity type.
const KnowledgeCrudPanel: React.FC<KnowledgeCrudPanelProps> = ({
  title, factLabel, importanceLabel, addButtonLabel, items, loading, error, onAdd, onDelete,
}) => {
  const [fact, setFact] = useState('');
  const [importance, setImportance] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

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
    if (!window.confirm(`Are you sure you want to delete this ${factLabel.toLowerCase()}?`)) return;
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-medium text-gray-700">{title}</h2>
        <span className="text-sm text-gray-500">{items.length}</span>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 mb-5">
        <Textarea
          label={factLabel} rows={2} value={fact}
          onChange={(e) => setFact(e.target.value)}
        />
        <Input
          label={importanceLabel} type="number" value={importance}
          onChange={(e) => setImportance(e.target.value)}
        />
        <Button type="submit" className="self-start" disabled={submitting}>
          {submitting ? 'Adding...' : addButtonLabel}
        </Button>
      </form>

      {error && <div className="text-red-600 text-sm mb-3">{error}</div>}

      {loading ? (
        <div className="text-center p-4 text-gray-500">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-center p-4 text-gray-500">None yet.</div>
      ) : (
        <table className="w-full border-collapse rounded-lg overflow-hidden shadow-sm">
          <thead>
            <tr>
              <th className="text-left p-2.5 bg-gray-100 font-medium border-b border-gray-200">{factLabel}</th>
              <th className="text-left p-2.5 bg-gray-100 font-medium border-b border-gray-200">{importanceLabel}</th>
              <th className="text-left p-2.5 bg-gray-100 font-medium border-b border-gray-200">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td className="p-2.5 border-b border-gray-200">{item.fact}</td>
                <td className="p-2.5 border-b border-gray-200">{item.importance}</td>
                <td className="p-2.5 border-b border-gray-200">
                  <Button type="button" onClick={() => handleDelete(item.id)} disabled={deletingId === item.id}>
                    {deletingId === item.id ? 'Deleting...' : 'Delete'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default KnowledgeCrudPanel;
