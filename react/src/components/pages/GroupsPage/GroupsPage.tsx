import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import GroupsTable from '../../organisms/GroupsTable';
import FlashMessage from '../../molecules/FlashMessage';
import { buttonClasses } from '../../atoms/Button';
import { Group } from '../../../types/api';
import { getGroups, deleteGroup } from '../../../services/api/groupService';
import { ROUTES } from '../../../utils/constants';

// Ported from group/.../templates/groups/allGroups.html + groupsView.js.
const GroupsPage: React.FC = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [knowledgeCounts, setKnowledgeCounts] = useState<Record<string, number>>({});
  const [permissionCounts, setPermissionCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ variant: 'success' | 'error'; message: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getGroups();
      setGroups(data.groups);
      setKnowledgeCounts(data.knowledgeCounts);
      setPermissionCounts(data.permissionCounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load groups.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (group: Group) => {
    try {
      const result = await deleteGroup(group.id);
      setFlash({ variant: 'success', message: result.message });
      await load();
    } catch (err) {
      setFlash({
        variant: 'error',
        message: err instanceof Error ? err.message : 'Failed to delete group. Please try again.',
      });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-medium text-gray-800 text-center mb-2">Relationship Groups</h1>
      {flash && (
        <FlashMessage message={flash.message} variant={flash.variant} onDismiss={() => setFlash(null)} />
      )}
      <div className="flex justify-center mb-2">
        <Link to={ROUTES.CREATE_GROUP} className={buttonClasses}>Create New Group</Link>
      </div>
      {!loading && !error && groups.length === 0 ? (
        <div className="text-center bg-white rounded-xl shadow-sm p-10">
          <h2 className="text-xl text-gray-600 mb-2">No relationship groups found</h2>
          <p className="text-gray-500 mb-5">Start organizing your contacts by creating your first group!</p>
          <Link to={ROUTES.CREATE_GROUP} className={buttonClasses}>Create Your First Group</Link>
        </div>
      ) : (
        <GroupsTable
          groups={groups}
          knowledgeCounts={knowledgeCounts}
          permissionCounts={permissionCounts}
          loading={loading}
          error={error}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
};

export default GroupsPage;
