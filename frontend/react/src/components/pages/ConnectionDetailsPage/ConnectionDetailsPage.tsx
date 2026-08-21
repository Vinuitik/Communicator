import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Avatar from '../../atoms/Avatar';
import KnowledgeCrudPanel from '../../organisms/KnowledgeCrudPanel';
import ConfirmDialog from '../../molecules/ConfirmDialog';
import { useToast } from '../../molecules/Toast';
import {
  getConnection, deleteConnection, getConnectionKnowledge, addConnectionKnowledge, deleteConnectionKnowledge,
  getConnectionPermissions, addConnectionPermission, deleteConnectionPermission,
} from '../../../services/api/connectionService';
import { getFriend } from '../../../services/api/friendService';
import { Connection, Friend, KnowledgeCrudItem } from '../../../types/api';
import { ROUTES, profilePath } from '../../../utils/constants';

const ConnectionDetailsPage: React.FC = () => {
  const { friend1Id, friend2Id } = useParams<{ friend1Id: string; friend2Id: string }>();
  const f1 = Number(friend1Id);
  const f2 = Number(friend2Id);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [connection, setConnection] = useState<Connection | null>(null);
  const [friend1, setFriend1] = useState<Friend | null>(null);
  const [friend2, setFriend2] = useState<Friend | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const [knowledge, setKnowledge] = useState<KnowledgeCrudItem[]>([]);
  const [knowledgeLoading, setKnowledgeLoading] = useState(true);
  const [knowledgeError, setKnowledgeError] = useState<string | null>(null);

  const [permissions, setPermissions] = useState<KnowledgeCrudItem[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [permissionsError, setPermissionsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [conn, fr1, fr2] = await Promise.all([getConnection(f1, f2), getFriend(f1), getFriend(f2)]);
        if (!cancelled) {
          setConnection(conn);
          setFriend1(fr1);
          setFriend2(fr2);
        }
      } catch {
        if (!cancelled) setError('Could not load this connection. Please try again later.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [f1, f2]);

  const loadKnowledge = useCallback(async () => {
    setKnowledgeLoading(true);
    setKnowledgeError(null);
    try {
      setKnowledge(await getConnectionKnowledge(f1, f2));
    } catch {
      setKnowledgeError('Could not load notes.');
    } finally {
      setKnowledgeLoading(false);
    }
  }, [f1, f2]);

  const loadPermissions = useCallback(async () => {
    setPermissionsLoading(true);
    setPermissionsError(null);
    try {
      setPermissions(await getConnectionPermissions(f1, f2));
    } catch {
      setPermissionsError('Could not load settings.');
    } finally {
      setPermissionsLoading(false);
    }
  }, [f1, f2]);

  useEffect(() => { loadKnowledge(); }, [loadKnowledge]);
  useEffect(() => { loadPermissions(); }, [loadPermissions]);

  const handleDelete = async () => {
    setConfirmDeleteOpen(false);
    setDeleting(true);
    try {
      await deleteConnection(f1, f2);
      navigate(ROUTES.CONNECTIONS);
    } catch {
      showToast('Failed to delete connection. Please try again.', 'error');
      setDeleting(false);
    }
  };

  if (loading) {
    return <div className="text-center p-16 text-text-muted">Loading…</div>;
  }
  if (error || !connection || !friend1 || !friend2) {
    return <div className="text-center p-16 text-bad">{error}</div>;
  }

  return (
    <div className="animate-ftfade max-w-[720px] mx-auto px-[30px] py-6 flex flex-col gap-4">
      <button type="button" onClick={() => navigate(ROUTES.CONNECTIONS)} className="self-start border-none bg-transparent text-text-muted text-[12.5px] hover:text-text-emphasis transition-colors">
        ← Connections
      </button>

      <div className="flex items-center gap-4 bg-surface border border-hairline rounded-card p-5">
        <div className="flex items-center -space-x-3 flex-none">
          <Avatar id={friend1.id} name={friend1.name} size={48} />
          <Avatar id={friend2.id} name={friend2.name} size={48} />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="m-0 font-display font-bold text-[20px] text-text-primary truncate">
            <span onClick={() => navigate(profilePath(friend1.id))} className="cursor-pointer hover:text-accent-light">{friend1.name}</span>
            {' ↔ '}
            <span onClick={() => navigate(profilePath(friend2.id))} className="cursor-pointer hover:text-accent-light">{friend2.name}</span>
          </h1>
          {connection.description && <div className="text-text-muted text-[12.5px] mt-[3px]">{connection.description}</div>}
        </div>
        <button
          type="button"
          onClick={() => setConfirmDeleteOpen(true)}
          disabled={deleting}
          className="border border-bad/40 bg-bad/[.12] text-bad font-semibold text-[12.5px] px-[15px] py-2.5 rounded-input hover:bg-bad/[.2] disabled:opacity-50 transition-colors"
        >
          {deleting ? 'Deleting…' : 'Delete connection'}
        </button>
      </div>

      <KnowledgeCrudPanel
        title="Notes"
        factLabel="Note"
        importanceLabel="Importance"
        addButtonLabel="Add Note"
        items={knowledge}
        loading={knowledgeLoading}
        error={knowledgeError}
        onAdd={async (fact, importance) => { await addConnectionKnowledge(f1, f2, fact, importance); await loadKnowledge(); }}
        onDelete={async (knowledgeId) => { await deleteConnectionKnowledge(knowledgeId); await loadKnowledge(); }}
      />

      <KnowledgeCrudPanel
        title="Settings & permissions"
        factLabel="Setting"
        importanceLabel="Priority"
        addButtonLabel="Add Setting"
        items={permissions}
        loading={permissionsLoading}
        error={permissionsError}
        onAdd={async (fact, importance) => { await addConnectionPermission(f1, f2, fact, importance); await loadPermissions(); }}
        onDelete={async (permissionId) => { await deleteConnectionPermission(permissionId); await loadPermissions(); }}
      />

      <ConfirmDialog
        open={confirmDeleteOpen}
        title={`Delete this connection?`}
        message="This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </div>
  );
};

export default ConnectionDetailsPage;
