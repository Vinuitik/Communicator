import React, { useState } from 'react';
import AddFriendForm, { AddFriendFormValues } from '../../organisms/AddFriendForm';
import KnowledgeEditor from '../../organisms/KnowledgeEditor';
import { addFriend } from '../../../services/api/friendService';
import { FriendKnowledge, NewFriendPayload } from '../../../types/api';
import { ROUTES } from '../../../utils/constants';

// Ported from nginx/static/addFriendForm/addForm.html + addForm.js.
const AddFriendPage: React.FC = () => {
  const [knowledge, setKnowledge] = useState<FriendKnowledge[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddKnowledge = (item: FriendKnowledge) => setKnowledge((prev) => [...prev, item]);
  const handleRemoveKnowledge = (index: number) => setKnowledge((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async (values: AddFriendFormValues) => {
    setError(null);
    setSubmitting(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const payload: NewFriendPayload = {
        name: values.name,
        // The server recomputes this from analytics[0].date + experience,
        // but @Valid still requires it to be present on the request body.
        plannedSpeakingTime: today,
        experience: values.experience,
        dateOfBirth: values.dob || null,
        analytics: [{
          date: values.lastSpoken,
          experience: values.experience,
          hours: parseFloat(values.hours),
        }],
        knowledge,
      };
      await addFriend(payload);
      // Friends list isn't ported yet — real one still lives in the legacy MPA.
      window.location.href = ROUTES.HOME;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add friend.');
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto flex flex-col gap-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3">{error}</div>
      )}
      <AddFriendForm onSubmit={handleSubmit} submitting={submitting} cancelHref={ROUTES.HOME} />
      <KnowledgeEditor items={knowledge} onAdd={handleAddKnowledge} onRemove={handleRemoveKnowledge} />
    </div>
  );
};

export default AddFriendPage;
