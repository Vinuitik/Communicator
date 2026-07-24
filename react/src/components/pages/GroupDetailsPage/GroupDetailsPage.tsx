import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import KnowledgeCrudPanel from '../../organisms/KnowledgeCrudPanel';
import {
  getGroup, getGroupKnowledge, addGroupKnowledge, deleteGroupKnowledge,
  getGroupPermissions, addGroupPermission, deleteGroupPermission, deleteGroup,
} from '../../../services/api/groupService';
import { Group, GroupCrudItem } from '../../../types/api';
import { ROUTES } from '../../../utils/constants';
import { buttonClasses } from '../../atoms/Button';

// Ported from group/.../templates/groups/groupDetails.html — but this is a
// real port turning into real feature work, not a straight port: the legacy
// template was actually dead code (no controller route ever rendered it, and
// it referenced a `group.knowledge` property that doesn't exist on the
// SocialGroup entity — see PROTO.md for the full investigation). The backend
// CRUD this page needs (GroupApiController.getGroupDetails/deleteGroup,
// GroupApiController's knowledge endpoints, GroupPermissionController) all
// already existed and work — they just never had a UI. No backend changes
// were needed for this page.
//
// "Contacts" stays a static "Coming Soon" placeholder, copied from the
// legacy template as-is — there's no contacts feature anywhere in the app to
// port. "Notes" and "Settings" are GroupKnowledge/GroupPermission — same
// shape, same controller pattern, both driven by KnowledgeCrudPanel. Neither
// section has row-level Edit: the legacy page's editKnowledge() was already a
// no-op stub, and no other ported page in this SPA has inline-edit yet
// either — Add + Delete matches both precedents. "Delete Group" reuses
// groupService.deleteGroup (GroupsTable already exercises the same call);
// the legacy button called an undefined deleteGroup() global and did nothing.
const GroupDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const groupId = Number(id);
  const navigate = useNavigate();

  const [group, setGroup] = useState<Group | null>(null);
  const [groupLoading, setGroupLoading] = useState(true);
  const [groupError, setGroupError] = useState<string | null>(null);
  const [deletingGroup, setDeletingGroup] = useState(false);

  const [knowledge, setKnowledge] = useState<GroupCrudItem[]>([]);
  const [knowledgeLoading, setKnowledgeLoading] = useState(true);
  const [knowledgeError, setKnowledgeError] = useState<string | null>(null);

  const [permissions, setPermissions] = useState<GroupCrudItem[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [permissionsError, setPermissionsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setGroupLoading(true);
      setGroupError(null);
      try {
        const data = await getGroup(groupId);
        if (!cancelled) setGroup(data);
      } catch {
        if (!cancelled) setGroupError('Could not load this group. Please try again later.');
      } finally {
        if (!cancelled) setGroupLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [groupId]);

  const loadKnowledge = useCallback(async () => {
    setKnowledgeLoading(true);
    setKnowledgeError(null);
    try {
      setKnowledge(await getGroupKnowledge(groupId));
    } catch {
      setKnowledgeError('Could not load notes.');
    } finally {
      setKnowledgeLoading(false);
    }
  }, [groupId]);

  const loadPermissions = useCallback(async () => {
    setPermissionsLoading(true);
    setPermissionsError(null);
    try {
      setPermissions(await getGroupPermissions(groupId));
    } catch {
      setPermissionsError('Could not load settings.');
    } finally {
      setPermissionsLoading(false);
    }
  }, [groupId]);

  useEffect(() => { loadKnowledge(); }, [loadKnowledge]);
  useEffect(() => { loadPermissions(); }, [loadPermissions]);

  const handleDeleteGroup = async () => {
    if (!group) return;
    if (!window.confirm(`Are you sure you want to delete "${group.name}"? This cannot be undone.`)) return;
    setDeletingGroup(true);
    try {
      await deleteGroup(groupId);
      navigate(ROUTES.GROUPS);
    } catch {
      window.alert('Failed to delete group. Please try again.');
      setDeletingGroup(false);
    }
  };

  if (groupLoading) {
    return <div className="max-w-2xl mx-auto text-center p-8">Loading...</div>;
  }
  if (groupError || !group) {
    return <div className="max-w-2xl mx-auto text-center p-8 text-red-600">{groupError}</div>;
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-medium text-gray-800">{group.name}</h1>
          <div className="text-sm text-gray-500 mt-1">Group ID: {group.id}</div>
        </div>
        <div className="flex gap-2.5">
          <Link to={ROUTES.GROUPS} className={buttonClasses}>← Back to Groups</Link>
          <button
            type="button"
            className="inline-block px-5 py-2.5 text-base text-white bg-red-600 rounded text-center cursor-pointer transition-colors duration-300 hover:bg-red-700 disabled:opacity-50"
            onClick={handleDeleteGroup}
            disabled={deletingGroup}
          >
            {deletingGroup ? 'Deleting...' : 'Delete Group'}
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-medium text-gray-700">Contacts in this Group</h2>
          <span className="text-sm text-gray-500">0</span>
        </div>
        <div className="text-center p-4 text-gray-500">
          <p>Contact management coming soon!</p>
          <p className="text-sm">This will show all people assigned to this relationship group.</p>
        </div>
      </div>

      <KnowledgeCrudPanel
        title="Group Notes"
        factLabel="Note"
        importanceLabel="Importance"
        addButtonLabel="Add Note"
        items={knowledge}
        loading={knowledgeLoading}
        error={knowledgeError}
        onAdd={async (fact, importance) => { await addGroupKnowledge(groupId, fact, importance); await loadKnowledge(); }}
        onDelete={async (knowledgeId) => { await deleteGroupKnowledge(knowledgeId); await loadKnowledge(); }}
      />

      <KnowledgeCrudPanel
        title="Group Settings"
        factLabel="Setting"
        importanceLabel="Priority"
        addButtonLabel="Add Setting"
        items={permissions}
        loading={permissionsLoading}
        error={permissionsError}
        onAdd={async (fact, importance) => { await addGroupPermission(groupId, fact, importance); await loadPermissions(); }}
        onDelete={async (permissionId) => { await deleteGroupPermission(permissionId); await loadPermissions(); }}
      />
    </div>
  );
};

export default GroupDetailsPage;
