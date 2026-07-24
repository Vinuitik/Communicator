import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import MediaGallery from '../../organisms/MediaGallery';
import KnowledgeSummaryTable from '../../organisms/KnowledgeSummaryTable';
import AiChatWidget from '../../organisms/AiChatWidget';
import { getFriendProfileData, getFriendSocials } from '../../../services/api/friendService';
import { FriendProfileData, Social } from '../../../types/api';
import { API_BASE } from '../../../services/api/config';
import { PLATFORM_ICONS, formatSocialUrlForDisplay } from '../../../utils/socialFormat';
import { fileUploadPath, friendSocialPath } from '../../../utils/constants';

const FALLBACK_AVATAR =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNTAiIGhlaWdodD0iMTUwIiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9IiNiZGMzYzciPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjEwIiBmaWxsPSIjZTllY2VmIiBzdHJva2U9IiNkZWUyZTYiIHN0cm9rZS13aWR0aD0iMiIvPjxwYXRoIGQ9Ik0xMiAxMmMyLjIxIDAgNC0xLjc5IDQtNHMtMS43OS00LTQtNC00IDEuNzktNCA0IDEuNzkgNCA0IDR6bTAgMmMtMi42NyAwLTggMS4zNC04IDR2MmgxNnYtMmMwLTIuNjYtNS4zMy00LTgtNHoiIGZpbGw9IiNhZGI1YmQiLz48L3N2Zz4=";

interface Toast { id: number; message: string; type: 'success' | 'error'; }

// Ported from friend/.../templates/profile.html + nginx/static/profile/{profileApp.js,
// modules/*} — a genuinely live Thymeleaf page (WebController.profile, GET
// /profile/{id} → /api/friend/profile/{id} once PathPrefixConfig prefixes it),
// unlike groupDetails.html. profile.js (the flat, un-modularized file sitting next
// to profileApp.js in nginx/static/profile/) is dead code: profile.html's own
// <script> list never includes it — only the 14 modules under modules/ plus
// profileApp.js are loaded. Confirmed by diffing profile.js's global functions
// (openMediaModalFromElement, setPrimaryPhoto, ...) against the modules: every
// one has an exact namespaced twin (MediaModal.openFromElement, PrimaryPhoto.setCurrent,
// ...) with identical bodies — profile.js was the pre-refactor version, left on disk.
//
// Module → React mapping:
//   utils.js, notificationManager.js       → inlined (Toast state below, formatFileSize
//                                             lives where it's used)
//   mediaElementFactory/galleryManager/     → organisms/MediaGallery
//   mediaModal/primaryPhoto/mediaDeletion/
//   pagination.js
//   mediaUpload.js                         → "Add Media" button → fileUploadPath (real
//                                             page now, was a bare redirect before)
//   socialLinks.js                         → inlined Social Media section below,
//                                             reusing friendService's getFriendSocials
//                                             (SocialPage's own data source)
//   knowledgeTable.js                      → organisms/KnowledgeSummaryTable
//   markdownParser.js, aiChatUI.js,        → organisms/AiChatWidget
//   aiChat.js
//
// New backend endpoint: FriendController.getProfileData (GET
// /api/friend/profile/{id}/data) — see friendService.ts. Everything else
// (media pagination, primary photo, delete, AI summarize, AI chat websocket)
// already existed with zero changes needed.
//
// The right column (Relationship Knowledge, Groups, Upcoming Meetings, Recent
// Interactions, Topics to Discuss) is 100% hardcoded fake demo content in the
// legacy template — not Thymeleaf-templated, not wired to any backend, no
// controller ever populated it. Ported verbatim as static placeholders
// (same "Contacts: Coming Soon" precedent as GroupDetailsPage) rather than
// silently dropped or invented into real features — flag for the redesign
// pass, not a decision to make mid-migration.
const ProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const friendId = Number(id);
  const navigate = useNavigate();

  const [profile, setProfile] = useState<FriendProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [photoOverride, setPhotoOverride] = useState<string | null>(null);

  const [socials, setSocials] = useState<Social[]>([]);
  const [socialsLoading, setSocialsLoading] = useState(true);
  const [socialsError, setSocialsError] = useState<string | null>(null);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);

  const notify = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const toastId = toastIdRef.current++;
    setToasts((prev) => [...prev, { id: toastId, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toastId));
    }, type === 'error' ? 5000 : 3000);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await getFriendProfileData(friendId);
        if (!cancelled) setProfile(data);
      } catch {
        if (!cancelled) setLoadError('Could not load this friend. Please try again later.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [friendId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSocialsLoading(true);
      setSocialsError(null);
      try {
        const data = await getFriendSocials(friendId);
        if (!cancelled) setSocials(data);
      } catch {
        if (!cancelled) setSocialsError('Unable to load social media links');
      } finally {
        if (!cancelled) setSocialsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [friendId]);

  if (loading) {
    return <div className="max-w-5xl mx-auto text-center p-8">Loading...</div>;
  }
  if (loadError || !profile) {
    return <div className="max-w-5xl mx-auto text-center p-8 text-red-600">{loadError}</div>;
  }

  const photoName = photoOverride ?? profile.mainPhotoName;
  const photoSrc = photoName ? `${API_BASE.FILES}/file/${friendId}/${photoName}` : FALLBACK_AVATAR;

  return (
    <div className="max-w-5xl mx-auto pb-16">
      <div className="fixed top-5 right-5 z-[10000] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-3 rounded-lg shadow-lg border max-w-sm text-sm ${t.type === 'success' ? 'bg-sky-50 border-emerald-500 text-gray-800' : 'bg-red-50 border-red-500 text-gray-800'}`}
          >
            {t.type === 'success' ? '✅' : '❌'} {t.message}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-6 bg-white rounded-xl shadow-sm p-6 mb-6">
        <img
          src={photoSrc}
          alt={profile.name}
          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = FALLBACK_AVATAR; }}
          className="w-32 h-32 rounded-full object-cover flex-shrink-0"
        />
        <div>
          <h1 className="text-2xl font-medium text-gray-800">{profile.name}</h1>
          <div className="text-gray-500">
            {profile.relationshipType || 'Friend'}{profile.dateMet ? ` • Known since ${profile.dateMet}` : ''}
          </div>
          <div className="flex gap-4 mt-2 text-sm text-gray-500 flex-wrap">
            <div>📅 Last met: 2 weeks ago</div>
            <div>🗓️ Next: March 25, 2025</div>
            <div>🏆 Close friend</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col">
          <MediaGallery
            friendId={friendId}
            onAddMedia={() => navigate(fileUploadPath(friendId))}
            onPrimaryPhotoChanged={(name) => setPhotoOverride(name)}
            onNotify={notify}
          />

          <div className="profile-section bg-white rounded-xl shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium">Social Media</h2>
              <button
                type="button"
                onClick={() => navigate(friendSocialPath(friendId))}
                className="px-4 py-2 text-sm bg-brand text-white rounded hover:bg-brand-dark"
              >
                Add Social
              </button>
            </div>
            {socialsLoading ? (
              <div className="text-center text-gray-500 p-4">Loading social media links...</div>
            ) : socialsError ? (
              <div className="text-center text-red-600 p-4">{socialsError}</div>
            ) : socials.length === 0 ? (
              <div className="text-center text-gray-500 p-4">
                <p>No social media links added yet.</p>
                <p className="text-sm">Click &quot;Add Social&quot; to add social media links for this friend.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {socials.map((social) => (
                  <a
                    key={social.id}
                    href={formatSocialUrlForDisplay(social.url, social.platform)}
                    target="_blank"
                    rel="noreferrer"
                    title={`Open ${social.platform}`}
                    className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm text-gray-700"
                  >
                    <span className="text-lg">{PLATFORM_ICONS[social.platform] || '🔗'}</span>
                    {social.platform}: {social.displayName || social.platform}
                  </a>
                ))}
              </div>
            )}
          </div>

          <KnowledgeSummaryTable friendId={friendId} />

          <div className="profile-section bg-white rounded-xl shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium">Relationship Knowledge</h2>
              <button type="button" className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">Add Relationship</button>
            </div>
            <div className="flex flex-col gap-3">
              {[
                { name: 'Sarah Johnson', detail: 'Dating for 2 years, met at work', quality: 'Great', color: 'bg-emerald-100 text-emerald-800' },
                { name: 'Mike Peterson', detail: 'Best friend since college, roommate for 1 year', quality: 'Good', color: 'bg-sky-100 text-sky-800' },
                { name: 'Lisa Wang', detail: 'Coworker, occasional climbing partner', quality: 'Neutral', color: 'bg-gray-100 text-gray-700' },
                { name: 'Alex Thompson', detail: 'Former roommate, had a disagreement over rent', quality: 'Complicated', color: 'bg-red-100 text-red-800' },
              ].map((rel) => (
                <div key={rel.name} className="flex items-center gap-3 border border-gray-200 rounded-lg p-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="font-medium text-gray-800">{rel.name}</div>
                    <div className="text-sm text-gray-500">{rel.detail}</div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${rel.color}`}>{rel.quality}</span>
                </div>
              ))}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                <div className="font-medium text-gray-800 mb-1">Important Note:</div>
                <p className="text-gray-600">Don&apos;t mention the surprise birthday party being planned by Sarah for April. James doesn&apos;t know about it yet!</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col">
          <div className="profile-section bg-white rounded-xl shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium">Groups</h2>
              <button type="button" className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">Add Group</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {['College Friends', 'Rock Climbing Club', 'Weekend Hikers', 'Tech Meetup', 'Book Club', 'Photography Enthusiasts'].map((g) => (
                <span key={g} className="px-3 py-1 bg-brand/10 text-brand rounded-full text-sm">{g}</span>
              ))}
            </div>
          </div>

          <div className="profile-section bg-white rounded-xl shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium">Upcoming Meetings</h2>
              <button type="button" className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">Add Meeting</button>
            </div>
            <div className="flex flex-col gap-3">
              {[
                { month: 'Mar', day: '25', title: 'Coffee Catchup', info: '3:30 PM • Downtown Café' },
                { month: 'Apr', day: '15', title: 'Birthday Dinner', info: '7:00 PM • Italian Restaurant' },
                { month: 'May', day: '3', title: 'Hiking Trip', info: '9:00 AM • Eagle Mountain' },
              ].map((m) => (
                <div key={m.title} className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-brand text-white flex flex-col items-center justify-center flex-shrink-0 text-xs">
                    <span>{m.month}</span>
                    <span className="text-base font-bold leading-none">{m.day}</span>
                  </div>
                  <div>
                    <div className="font-medium text-gray-800 text-sm">{m.title}</div>
                    <div className="text-xs text-gray-500">{m.info}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="profile-section bg-white rounded-xl shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium">Recent Interactions</h2>
              <button type="button" className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">Add Note</button>
            </div>
            <div className="flex flex-col gap-3 text-sm">
              {[
                { date: 'March 5, 2025', text: 'Met for dinner at Sakura Japanese restaurant. Talked about his recent promotion and upcoming travel plans to Portugal. He mentioned wanting to get into cycling.' },
                { date: 'February 18, 2025', text: 'Quick coffee meetup. He was stressed about a work deadline. Mentioned his parents are visiting next month and he’s looking for recommendations for activities.' },
                { date: 'January 27, 2025', text: 'Weekend hiking trip with the group. James brought his new camera and took amazing landscape photos. He shared some photography tips and mentioned wanting to do a photography course.' },
              ].map((n) => (
                <div key={n.date}>
                  <div className="font-medium text-gray-800">{n.date}</div>
                  <p className="text-gray-600">{n.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="profile-section bg-white rounded-xl shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium">Topics to Discuss</h2>
              <button type="button" className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">Add Topic</button>
            </div>
            <ul className="flex flex-col gap-2">
              {[
                'Ask about Portugal trip planning',
                'Share cycling route recommendations',
                'Follow up on photography course interest',
                'Invite to Alex’s housewarming party',
              ].map((topic) => (
                <li key={topic} className="flex items-center gap-2 py-1 border-b border-gray-100 last:border-0 text-sm">
                  <input type="checkbox" />
                  <label>{topic}</label>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <AiChatWidget friendId={friendId} friendName={profile.name} />
    </div>
  );
};

export default ProfilePage;
