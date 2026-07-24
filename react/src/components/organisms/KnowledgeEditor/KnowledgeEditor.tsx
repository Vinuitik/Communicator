import React, { useState } from 'react';
import Textarea from '../../atoms/Textarea';
import Input from '../../atoms/Input';
import Button from '../../atoms/Button';
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
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5 mt-6">
      <h2 className="text-xl font-medium text-gray-700 mb-4">Add New Knowledge</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 mb-5">
        <Textarea
          label="Fact"
          rows={3}
          placeholder="Enter your new knowledge here..."
          value={fact}
          onChange={(e) => setFact(e.target.value)}
        />
        <Input
          label="Importance"
          type="number"
          placeholder="Rate the importance"
          value={importance}
          onChange={(e) => setImportance(e.target.value)}
        />
        <Button type="submit" className="self-start">Add Knowledge</Button>
      </form>

      <table className="w-full border-collapse rounded-lg overflow-hidden shadow-sm">
        <thead>
          <tr>
            <th className="text-left p-2.5 bg-gray-100 font-medium border-b border-gray-200">Fact</th>
            <th className="text-left p-2.5 bg-gray-100 font-medium border-b border-gray-200">Importance</th>
            <th className="text-left p-2.5 bg-gray-100 font-medium border-b border-gray-200">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx}>
              <td className="p-2.5 border-b border-gray-200">{item.fact}</td>
              <td className="p-2.5 border-b border-gray-200">{item.importance}</td>
              <td className="p-2.5 border-b border-gray-200">
                <Button type="button" onClick={() => onRemove(idx)}>Remove</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default KnowledgeEditor;
