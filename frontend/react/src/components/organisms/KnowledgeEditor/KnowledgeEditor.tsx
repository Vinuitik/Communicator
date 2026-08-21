import React, { useState } from 'react';
import Textarea from '../../atoms/Textarea';
import Input from '../../atoms/Input';
import { FriendKnowledge } from '../../../types/api';

interface KnowledgeEditorProps {
  items: FriendKnowledge[];
  onAdd: (item: FriendKnowledge) => void;
  onRemove: (index: number) => void;
}

// Local-only fact/importance list, no API calls of its own — the legacy
// KnowledgeManager (nginx/static/shared/knowledgeManager.js) behaves the
// same way on the add-friend form: rows are collected client-side and only
// sent to the backend embedded in the friend-creation payload, since there's
// no friend id yet to attach knowledge to. Once facts.html (editing an
// *existing* friend's knowledge) is ported, that page needs its own
// API-backed variant — this component isn't it.
const KnowledgeEditor: React.FC<KnowledgeEditorProps> = ({ items, onAdd, onRemove }) => {
  const [fact, setFact] = useState('');
  const [importance, setImportance] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedFact = fact.trim();
    if (!trimmedFact || !importance) return;
    onAdd({ fact: trimmedFact, importance: parseInt(importance, 10) });
    setFact('');
    setImportance('');
  };

  return (
    <div className="bg-surface border border-hairline rounded-card p-5 mt-4">
      <h2 className="text-[15px] font-bold text-text-primary mb-4">Add knowledge (optional)</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 mb-4">
        <Textarea
          label="Fact"
          rows={2}
          placeholder="Enter your new knowledge here..."
          value={fact}
          onChange={(e) => setFact(e.target.value)}
        />
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <Input
              label="Importance"
              type="number"
              placeholder="Rate the importance"
              value={importance}
              onChange={(e) => setImportance(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 rounded-input border-none bg-accent-gradient text-white font-bold text-sm shadow-button-sm hover:brightness-110 transition-all"
          >
            + Add
          </button>
        </div>
      </form>

      {items.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-3 px-3.5 py-2.5 bg-surface-2 rounded-lg">
              <span className="flex-1 text-[13px] text-text-secondary">{item.fact}</span>
              <span className="text-[10.5px] font-bold text-text-faint bg-white/[.06] px-2 py-0.5 rounded-pill">
                Importance {item.importance}
              </span>
              <button
                type="button"
                onClick={() => onRemove(idx)}
                className="text-text-faint hover:text-bad text-xs transition-colors"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default KnowledgeEditor;
