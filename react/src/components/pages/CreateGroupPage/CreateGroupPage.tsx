import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CreateGroupForm, { CreateGroupFormValues } from '../../organisms/CreateGroupForm';
import FlashMessage from '../../molecules/FlashMessage';
import { createGroup } from '../../../services/api/groupService';
import { ROUTES } from '../../../utils/constants';

// Ported from nginx/static/createGroup/createGroup.html + createGroup.js.
const CreateGroupPage: React.FC = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [flash, setFlash] = useState<{ variant: 'success' | 'error'; message: string } | null>(null);

  const handleSubmit = async (values: CreateGroupFormValues) => {
    setSubmitting(true);
    setFlash(null);
    try {
      const result = await createGroup({ name: values.name });
      setFlash({ variant: 'success', message: result.message });
      setTimeout(() => {
        navigate(ROUTES.GROUPS);
      }, 1500);
    } catch (err) {
      setFlash({
        variant: 'error',
        message: err instanceof Error ? err.message : 'Failed to create group. Please try again.',
      });
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      <h1 className="text-3xl font-medium text-gray-800 text-center">Create New Group</h1>
      {flash && (
        <FlashMessage message={flash.message} variant={flash.variant} onDismiss={() => setFlash(null)} />
      )}
      <CreateGroupForm onSubmit={handleSubmit} submitting={submitting} cancelTo={ROUTES.GROUPS} />
      <div className="bg-white rounded-xl shadow-sm p-8">
        <h2 className="text-2xl font-medium text-gray-800 mb-4">About Relationship Groups</h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="bg-gray-50 rounded-lg p-5 border-l-4 border-brand">
            <h3 className="text-brand font-medium mb-2">Organize Contacts</h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Create groups to categorize people in your life - family, friends, colleagues, classmates, etc.
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-5 border-l-4 border-brand">
            <h3 className="text-brand font-medium mb-2">Track Relationships</h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Monitor and improve your relationships with different groups of people over time.
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-5 border-l-4 border-brand">
            <h3 className="text-brand font-medium mb-2">Relationship Insights</h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Gain insights into your social connections and identify areas for relationship building.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateGroupPage;
