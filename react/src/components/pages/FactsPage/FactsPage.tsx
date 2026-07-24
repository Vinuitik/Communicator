import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import KnowledgeCrudPanel from '../../organisms/KnowledgeCrudPanel';
import { getFriendKnowledge, addFriendKnowledgeItem, deleteFriendKnowledgeItem } from '../../../services/api/friendService';
import { KnowledgeCrudItem } from '../../../types/api';
import { ROUTES } from '../../../utils/constants';
import { buttonClasses } from '../../atoms/Button';

// Ported from friend/.../templates/facts.html + facts.js + shared/knowledgeManager.js
// (WebController.knowledge, GET /api/friend/knowledge/{id}) — the full
// knowledge-management page for one friend. Unlike talkedForm (where this
// same KnowledgeManager class is dead code because its entity-id URL
// detection fails), this page's URL genuinely contains a "knowledge"
// segment, so the legacy committed-table/add/delete flow is real here.
//
// Reuses KnowledgeCrudPanel — same component GroupDetailsPage uses for
// group notes/settings, since FriendKnowledge.java serializes to the exact
// same {id, fact, importance} shape. Two deliberate simplifications vs. the
// legacy page, consistent with the GroupDetailsPage precedent: no
// stage-then-batch-submit (the legacy "Add to table, then Submit Info"
// two-step) — each Add is a real immediate API call, which is simpler and
// no less correct; and no pagination — this app's per-friend fact counts
// are small enough that fetching all of them (size=1000) is fine. No
// row-level Edit either: legacy's updateKnowledgeBtn used contenteditable
// cells, which has no clean React equivalent, and no other ported page has
// inline-edit yet.
const FactsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const friendId = Number(id);

  const [items, setItems] = useState<KnowledgeCrudItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await getFriendKnowledge(friendId));
    } catch {
      setError('Could not load knowledge for this friend.');
    } finally {
      setLoading(false);
    }
  }, [friendId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-xl mx-auto flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium text-gray-800">Knowledge Tracker</h1>
        <Link to={ROUTES.HOME} className={buttonClasses}>← Back</Link>
      </div>
      <KnowledgeCrudPanel
        title="Committed Knowledge"
        factLabel="Fact"
        importanceLabel="Importance"
        addButtonLabel="Add Knowledge"
        items={items}
        loading={loading}
        error={error}
        onAdd={async (fact, importance) => { await addFriendKnowledgeItem(friendId, fact, importance); await load(); }}
        onDelete={async (knowledgeId) => { await deleteFriendKnowledgeItem(knowledgeId); await load(); }}
      />
    </div>
  );
};

export default FactsPage;
