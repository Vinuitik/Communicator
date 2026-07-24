import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import TalkedForm, { TalkedFormValues } from '../../organisms/TalkedForm';
import KnowledgeEditor from '../../organisms/KnowledgeEditor';
import { getFriend, talkedToFriend } from '../../../services/api/friendService';
import { FriendKnowledge, NewFriendPayload } from '../../../types/api';
import { ROUTES } from '../../../utils/constants';

// Ported from friend/src/main/resources/templates/talkedForm.html +
// nginx/static/updateForm/talkedForm.js. Unlike the legacy Thymeleaf page
// (which had the friend bound into the template server-side), this fetches
// it via GET /api/friend/{id} (added for this port — see FriendController).
//
// The knowledge section reuses KnowledgeEditor as-is (local-only, no API
// calls). That matches this page's actual legacy behavior, not just for
// convenience: the shared KnowledgeManager class instantiated here derives
// its entity id by looking for a "knowledge" path segment in the URL, which
// /talked/{id} never has — so on this specific page its "load existing
// knowledge" / pagination / committed-table code paths are dead, and the
// only thing that actually runs is the plain collectKnowledgeData() export,
// which reads the same local staging table AddFriendPage already reimplements.
const TalkedPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const friendId = Number(id);
  const navigate = useNavigate();

  const [initialValues, setInitialValues] = useState<TalkedFormValues | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [knowledge, setKnowledge] = useState<FriendKnowledge[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const friend = await getFriend(friendId);
        if (cancelled) return;
        setInitialValues({
          name: friend.name,
          experience: friend.experience,
          hours: '',
          dob: friend.dateOfBirth ?? '',
        });
      } catch {
        if (!cancelled) setLoadError('Could not load this friend. Please try again later.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [friendId]);

  const handleAddKnowledge = (item: FriendKnowledge) => setKnowledge((prev) => [...prev, item]);
  const handleRemoveKnowledge = (index: number) => setKnowledge((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async (values: TalkedFormValues) => {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const payload: NewFriendPayload = {
        name: values.name,
        // The server recomputes this from experience + today's date, but
        // @Valid still requires it to be present on the request body.
        plannedSpeakingTime: today,
        experience: values.experience,
        dateOfBirth: values.dob || null,
        analytics: [{
          date: today,
          experience: values.experience,
          hours: parseFloat(values.hours),
        }],
        knowledge,
      };
      await talkedToFriend(friendId, payload);
      navigate(ROUTES.HOME);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to update friend.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="max-w-xl mx-auto text-center p-8">Loading...</div>;
  }
  if (loadError || !initialValues) {
    return <div className="max-w-xl mx-auto text-center p-8 text-red-600">{loadError}</div>;
  }

  return (
    <div className="max-w-xl mx-auto flex flex-col gap-6">
      {submitError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3">{submitError}</div>
      )}
      <TalkedForm initialValues={initialValues} onSubmit={handleSubmit} submitting={submitting} cancelTo={ROUTES.HOME} />
      <KnowledgeEditor items={knowledge} onAdd={handleAddKnowledge} onRemove={handleRemoveKnowledge} />
    </div>
  );
};

export default TalkedPage;
