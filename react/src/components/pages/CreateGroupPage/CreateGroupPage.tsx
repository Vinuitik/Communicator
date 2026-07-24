import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CreateGroupForm, { CreateGroupFormValues } from '../../organisms/CreateGroupForm';
import { useToast } from '../../molecules/Toast';
import { createGroup } from '../../../services/api/groupService';
import { ROUTES } from '../../../utils/constants';

// Ported from nginx/static/createGroup/createGroup.html + createGroup.js —
// restyled per the redesign handoff (Stage 6): the light "About Relationship
// Groups" filler section isn't in the mock's compact single-card layout, so
// it's dropped; success feedback moves from the old FlashMessage-then-delay
// pattern to the same toast-and-navigate-immediately pattern the rest of the
// redesign already uses (QuickLogModal, KnowledgeCrudPanel, ...).
const CreateGroupPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (values: CreateGroupFormValues) => {
    setSubmitting(true);
    setError(null);
    try {
      await createGroup({ name: values.name });
      showToast(`"${values.name}" created`);
      navigate(ROUTES.GROUPS);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="animate-ftfade max-w-[460px] mx-auto px-[30px] py-6">
      {error && (
        <div className="bg-bad/[.12] border border-bad/40 text-bad rounded-input p-3 mb-4 text-sm">{error}</div>
      )}
      <CreateGroupForm onSubmit={handleSubmit} submitting={submitting} cancelTo={ROUTES.GROUPS} />
    </div>
  );
};

export default CreateGroupPage;
