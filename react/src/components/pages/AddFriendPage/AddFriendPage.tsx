import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AddFriendForm, { AddFriendFormValues } from '../../organisms/AddFriendForm';
import KnowledgeEditor from '../../organisms/KnowledgeEditor';
import { addFriend } from '../../../services/api/friendService';
import { FriendKnowledge, NewFriendPayload } from '../../../types/api';
import { ROUTES } from '../../../utils/constants';

// Ported from nginx/static/addFriendForm/addForm.html + addForm.js.
const AddFriendPage: React.FC = () => {
  const navigate = useNavigate();
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
      navigate(ROUTES.HOME);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add friend.');
      setSubmitting(false);
    }
  };

  return (
    <div className="animate-ftfade max-w-[560px] mx-auto px-[30px] py-6">
      {error && (
        <div className="bg-bad/[.12] border border-bad/40 text-bad rounded-input p-3 mb-4 text-sm">{error}</div>
      )}
      <AddFriendForm onSubmit={handleSubmit} submitting={submitting} cancelTo={ROUTES.HOME} />
      <KnowledgeEditor items={knowledge} onAdd={handleAddKnowledge} onRemove={handleRemoveKnowledge} />
    </div>
  );
};

export default AddFriendPage;
