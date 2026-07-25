import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CreateConnectionForm, { CreateConnectionFormValues } from '../../organisms/CreateConnectionForm';
import { useToast } from '../../molecules/Toast';
import { createConnection } from '../../../services/api/connectionService';
import { ROUTES, connectionDetailsPath } from '../../../utils/constants';

const CreateConnectionPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (values: CreateConnectionFormValues) => {
    setSubmitting(true);
    setError(null);
    try {
      const connection = await createConnection(values);
      showToast('Connection created');
      navigate(connectionDetailsPath(connection.id.friend1Id, connection.id.friend2Id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create connection. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="animate-ftfade max-w-[460px] mx-auto px-[30px] py-6">
      {error && (
        <div className="bg-bad/[.12] border border-bad/40 text-bad rounded-input p-3 mb-4 text-sm">{error}</div>
      )}
      <CreateConnectionForm onSubmit={handleSubmit} submitting={submitting} cancelTo={ROUTES.CONNECTIONS} />
    </div>
  );
};

export default CreateConnectionPage;
