import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Avatar from '../../atoms/Avatar';
import Tabs from '../../molecules/Tabs';
import SegmentedControl from '../../molecules/SegmentedControl';
import MediaGallery from '../../organisms/MediaGallery';
import SocialsPanel from '../../organisms/SocialsPanel';
import TrendsPanel from '../../organisms/TrendsPanel';
import KnowledgeSummaryTable from '../../organisms/KnowledgeSummaryTable';
import KnowledgeCrudPanel from '../../organisms/KnowledgeCrudPanel';
import AiChatWidget from '../../organisms/AiChatWidget';
import QuickLogModal from '../../organisms/QuickLogModal';
import TalkedForm, { TalkedFormValues } from '../../organisms/TalkedForm';
import { useToast } from '../../molecules/Toast';
import {
  getFriendProfileData, getFriend, getFriendAnalytics, getFriendGroupIds,
  getFriendKnowledge, addFriendKnowledgeItem, deleteFriendKnowledgeItem, talkedToFriend,
} from '../../../services/api/friendService';
import { getGroups } from '../../../services/api/groupService';
import { FriendProfileData, Friend, AnalyticsRecord, Group, KnowledgeCrudItem, NewFriendPayload } from '../../../types/api';
import { API_BASE } from '../../../services/api/config';
import { ROUTES } from '../../../utils/constants';
import {
  getDaysDiff, getGradientColor, formatDaysDiff, calculateIntensityScore, getIntensityGradientColor,
} from '../../../utils/friendMetrics';

type Tab = 'overview' | 'media' | 'socials' | 'trends';

const timeAgo = (dateStr: string): string => {
  const days = Math.round((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// Empty-state card shared by the three PLANNED sections in the Overview tab
// (People & relationships, Upcoming, Topics to discuss) — no backend exists
// for any of these yet (confirmed: no Meeting/Topic entity anywhere, and
// Connections is a stub controller with zero methods). Ported as designed
// placeholders per the redesign handoff, not invented into fake features.
const PlannedCard: React.FC<{ title: string; hint: string; icon: string; children?: React.ReactNode }> = ({ title, hint, icon, children }) => (
  <div className="bg-surface border border-hairline rounded-card p-5">
    <div className="flex items-center justify-between mb-1.5 gap-2.5">
      <h2 className="text-[15px] font-bold text-text-primary m-0">{title}</h2>
      <span className="text-[10px] font-bold text-soon bg-soon/[.14] px-2 py-0.5 rounded-pill">PLANNED</span>
    </div>
    <p className="text-[11.5px] text-text-faint mb-3.5">{hint}</p>
    {children ?? (
      <div className="text-center py-6 px-3 border border-dashed border-white/10 rounded-card">
        <div className="text-[22px] opacity-50 mb-1.5">{icon}</div>
        <div className="text-xs text-text-faint">Backend for this ships in a later pass.</div>
      </div>
    )}
  </div>
);

// The redesign's Profile hub — consolidates what used to be 5 separate pages
// (Talked, Knowledge, Social, FileUpload, per-friend Analytics) into one
// friend-scoped view with tabs. See design_handoff_friends_tracker/README.md
// for the full spec this ports.
const ProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const friendId = Number(id);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [profile, setProfile] = useState<FriendProfileData | null>(null);
  const [friend, setFriend] = useState<Friend | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [photoOverride, setPhotoOverride] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');

  const [interactions, setInteractions] = useState<AnalyticsRecord[]>([]);
  const [groupNames, setGroupNames] = useState<string[]>([]);

  const [kb, setKb] = useState<'structured' | 'raw'>('structured');
  const [rawItems, setRawItems] = useState<KnowledgeCrudItem[]>([]);
  const [rawLoading, setRawLoading] = useState(true);
  const [rawError, setRawError] = useState<string | null>(null);

  const [logOpen, setLogOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const loadFriend = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [profileData, friendData] = await Promise.all([getFriendProfileData(friendId), getFriend(friendId)]);
      setProfile(profileData);
      setFriend(friendData);
    } catch {
      setLoadError('Could not load this friend. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [friendId]);

  useEffect(() => { loadFriend(); }, [loadFriend]);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    getFriendAnalytics(friendId, twoYearsAgo.toISOString().slice(0, 10), today)
      .then((records) => setInteractions([...records].sort((a, b) => b.date.localeCompare(a.date))))
      .catch(() => setInteractions([]));
  }, [friendId]);

  useEffect(() => {
    Promise.all([getFriendGroupIds(friendId), getGroups()])
      .then(([ids, res]) => {
        const idSet = new Set(ids);
        setGroupNames((res.groups || []).filter((g: Group) => idSet.has(g.id)).map((g) => g.name));
      })
      .catch(() => setGroupNames([]));
  }, [friendId]);

  const loadRaw = useCallback(async () => {
    setRawLoading(true);
    setRawError(null);
    try {
      setRawItems(await getFriendKnowledge(friendId));
    } catch {
      setRawError('Could not load raw notes.');
    } finally {
      setRawLoading(false);
    }
  }, [friendId]);

  useEffect(() => { loadRaw(); }, [loadRaw]);

  const handleEditSubmit = async (values: TalkedFormValues) => {
    setEditSubmitting(true);
    setEditError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const payload: NewFriendPayload = {
        name: values.name,
        plannedSpeakingTime: friend?.plannedSpeakingTime ?? today,
        experience: values.experience,
        dateOfBirth: values.dob || null,
        analytics: [],
        knowledge: [],
      };
      await talkedToFriend(friendId, payload);
      setEditOpen(false);
      showToast('Friend details updated');
      await loadFriend();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update friend.');
    } finally {
      setEditSubmitting(false);
    }
  };

  if (loading) {
    return <div className="text-center p-16 text-text-muted">Loading…</div>;
  }
  if (loadError || !profile || !friend) {
    return <div className="text-center p-16 text-bad">{loadError}</div>;
  }

  const photoName = photoOverride ?? profile.mainPhotoName;
  const photoSrc = photoName ? `${API_BASE.FILES}/file/${friendId}/${photoName}` : null;

  const daysDiff = getDaysDiff(friend.plannedSpeakingTime);
  const intensityScore = calculateIntensityScore(friend);
  const hasIntensity = !isNaN(intensityScore) && intensityScore > 0;
  const lastMet = interactions[0] ? timeAgo(interactions[0].date) : '—';

  return (
    <div className="animate-ftfade">
      <div className="bg-hero-grad border-b border-hairline px-[30px] pt-6">
        <div className="max-w-[1040px] mx-auto pb-0">
          <button type="button" onClick={() => navigate(ROUTES.FRIENDS)} className="border-none bg-transparent text-text-muted text-[12.5px] mb-4 hover:text-text-emphasis transition-colors">
            ← All friends
          </button>
          <div className="flex items-center gap-5">
            {photoSrc ? (
              <img src={photoSrc} alt={friend.name} className="rounded-avatar-lg object-cover flex-none" style={{ width: 84, height: 84 }} />
            ) : (
              <Avatar id={friendId} name={friend.name} size={84} rounded="avatar-lg" />
            )}
            <div className="flex-1">
              <h1 className="m-0 font-display font-bold text-[28px] tracking-tight text-text-primary">{friend.name}</h1>
              <div className="text-text-muted text-[13.5px] mt-1">
                {friend.relationshipType || 'Friend'}{profile.dateMet ? ` · Known since ${profile.dateMet}` : ''}
              </div>
              <div className="flex gap-5 mt-3 text-[12.5px] flex-wrap">
                <div><span className="text-text-faint">Last met</span> <b className="text-text-emphasis">{lastMet}</b></div>
                <div><span className="text-text-faint">Next</span> <b style={{ color: getGradientColor(daysDiff) }}>{formatDaysDiff(daysDiff)}</b></div>
                <div><span className="text-text-faint">Intensity</span> <b style={{ color: hasIntensity ? getIntensityGradientColor(intensityScore) : '#5A5468' }}>{hasIntensity ? intensityScore.toFixed(1) : '—'}</b></div>
                <div><span className="text-text-faint">Birthday</span> <b className={friend.dateOfBirth ? 'text-text-emphasis' : 'text-text-faint'}>{friend.dateOfBirth || 'Not set'}</b></div>
              </div>
            </div>
            <div className="flex flex-col gap-2 self-start">
              <button
                type="button"
                onClick={() => setLogOpen(true)}
                style={{ padding: '10px 18px' }}
                className="border-none bg-accent-gradient text-white font-bold text-[13px] rounded-[10px] shadow-button hover:brightness-110 transition-all"
              >
                ✓ Log chat
              </button>
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                style={{ padding: '9px 18px' }}
                className="border border-white/10 bg-input text-text-emphasis font-semibold text-[12.5px] rounded-input hover:bg-input-2 transition-colors"
              >
                Edit details
              </button>
            </div>
          </div>
          <Tabs
            className="mt-5"
            items={[
              { key: 'overview', label: 'Overview' },
              { key: 'media', label: 'Media' },
              { key: 'socials', label: 'Socials' },
              { key: 'trends', label: 'Trends' },
            ]}
            active={tab}
            onChange={(t) => setTab(t as Tab)}
          />
        </div>
      </div>

      <div className="max-w-[1040px] mx-auto px-[30px] pt-6 pb-[60px]">
        {tab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-5 items-start">
            <div className="flex flex-col gap-5">
              <div className="bg-surface border border-hairline rounded-card p-5">
                <div className="flex justify-between items-center mb-1 gap-2.5 flex-wrap">
                  <h2 className="text-[15px] font-bold text-text-primary m-0 flex items-center gap-2"><span className="text-accent-light">✦</span> Knowledge</h2>
                  <div className="flex gap-2 items-center">
                    <SegmentedControl
                      options={[{ value: 'structured', label: 'Structured' }, { value: 'raw', label: `Raw (${rawItems.length})` }]}
                      value={kb}
                      onChange={(v) => setKb(v as 'structured' | 'raw')}
                    />
                  </div>
                </div>
                {kb === 'structured' ? (
                  <div className="mt-3.5">
                    <KnowledgeSummaryTable friendId={friendId} />
                  </div>
                ) : (
                  <div className="mt-3.5">
                    <p className="mb-3.5 text-[11.5px] text-text-faint">Raw captured notes — the source the AI structures.</p>
                    <KnowledgeCrudPanel
                      compact
                      title="Raw notes"
                      factLabel="Note"
                      importanceLabel="Importance"
                      addButtonLabel="+ Add"
                      items={rawItems}
                      loading={rawLoading}
                      error={rawError}
                      onAdd={async (fact, importance) => { await addFriendKnowledgeItem(friendId, fact, importance); await loadRaw(); showToast('New fact captured to Raw · AI will re-summarise'); }}
                      onDelete={async (itemId) => { await deleteFriendKnowledgeItem(itemId); await loadRaw(); }}
                    />
                  </div>
                )}
              </div>

              <PlannedCard title="People & relationships" hint="How this friend connects to others you track — backend in progress." icon="🔗" />

              <div className="bg-surface border border-hairline rounded-card p-5">
                <h2 className="text-[15px] font-bold text-text-primary mb-3">Recent interactions</h2>
                {interactions.length === 0 ? (
                  <div className="text-center py-6 px-3 border border-dashed border-white/10 rounded-card">
                    <div className="text-[22px] opacity-50 mb-1.5">💬</div>
                    <div className="text-xs text-text-muted font-semibold">No interactions logged</div>
                    <div className="text-[11px] text-text-faint mt-1">Hit <b className="text-accent-light">Log chat</b> after you next catch up.</div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3.5">
                    {interactions.slice(0, 5).map((entry) => (
                      <div key={entry.id} className="border-l-2 border-accent/40 pl-3">
                        <div className="text-[11.5px] text-accent-light font-semibold">{new Date(entry.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                        <p className="mt-0.5 text-[12.5px] text-text-secondary leading-relaxed">
                          {entry.hours} hr{entry.hours === 1 ? '' : 's'} · rated {entry.experience === '***' ? 'Great' : entry.experience === '**' ? 'Okay' : 'Bad'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-5">
              <div className="bg-surface border border-hairline rounded-card p-5">
                <h2 className="text-[15px] font-bold text-text-primary mb-3">Groups</h2>
                {groupNames.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {groupNames.map((name) => (
                      <span key={name} className="px-3 py-1.5 bg-accent/[.14] text-accent-light rounded-pill text-xs font-semibold">{name}</span>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-text-faint">Not in any group yet.</div>
                )}
              </div>

              <PlannedCard title="Upcoming" hint="Per-friend scheduled events — backend in progress." icon="🗓️">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-input bg-input flex flex-col items-center justify-center flex-none">
                    <span className="text-[9px] text-accent-light font-bold">SOON</span>
                    <span className="text-base font-bold leading-none">?</span>
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-text-primary">First proper catch-up</div>
                    <div className="text-[11px] text-text-muted">Suggested · tap to schedule</div>
                  </div>
                </div>
              </PlannedCard>

              <PlannedCard title="Topics to discuss" hint="Per-friend checklist, persisted — backend in progress." icon="📝" />
            </div>
          </div>
        )}

        {tab === 'media' && (
          <MediaGallery
            friendId={friendId}
            onPrimaryPhotoChanged={(name) => setPhotoOverride(name)}
            onNotify={(message) => showToast(message)}
          />
        )}

        {tab === 'socials' && <SocialsPanel friendId={friendId} friendName={friend.name} />}

        {tab === 'trends' && (
          <TrendsPanel friendId={friendId} friendName={friend.name} onOpenInsights={() => navigate(ROUTES.ANALYTICS)} />
        )}
      </div>

      <AiChatWidget friendId={friendId} friendName={friend.name} />

      <QuickLogModal friend={logOpen ? friend : null} onClose={() => setLogOpen(false)} onSaved={() => loadFriend()} />

      {editOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-ftfade" onClick={() => setEditOpen(false)}>
          <div className="w-[440px] max-w-[92vw] bg-modal border border-white/10 rounded-card p-6 shadow-modal animate-ftmodal" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-bold text-lg text-text-primary mb-4">Edit details</h3>
            {editError && <p className="mb-3 text-sm text-bad">{editError}</p>}
            <TalkedForm
              initialValues={{ name: friend.name, experience: friend.experience, hours: '0', dob: friend.dateOfBirth ?? '' }}
              onSubmit={handleEditSubmit}
              submitting={editSubmitting}
              onCancel={() => setEditOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
