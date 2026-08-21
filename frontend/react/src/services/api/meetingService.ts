import {
  MeetingDTO, ManualMeetingRequest, UpdateMeetingRequest, GroupMatchDTO,
} from '../../types/api';
import { API_BASE } from './config';

// MeetingController (meeting module) is mapped at /meetings, prefixed to
// /api/meetings by PathPrefixConfig (see PathPrefixConfig.java); nginx
// forwards the /api/meetings/ prefix through unchanged (see nginx/nginx.conf).
const MEETINGS_API = API_BASE.MEETINGS;

// Backs HomePage's week board (MeetingController.thisWeek). weekOffset=0 is
// the current Mon-Sun week; negative offsets page backward and — since only
// CANCELLED status is excluded server-side — past DONE meetings come back
// too, read as history rather than just upcoming. Replaces
// friendService.getFriendsThisWeek for the week-board use case (that one
// only ever read Friend.plannedSpeakingTime and can't represent
// Group/Connection meetings or birthdays as their own rows).
export const getThisWeek = async (weekOffset: number): Promise<MeetingDTO[]> => {
  const response = await fetch(`${MEETINGS_API}/thisWeek?weekOffset=${weekOffset}`);
  if (!response.ok) {
    throw new Error(`Error: ${response.statusText}`);
  }
  return response.json();
};

// Create a user-scheduled MANUAL meeting for a Friend (leave groupId unset —
// that's the Group-page entry point, owned elsewhere). Returns the created
// MeetingDTO so the caller can prepend it without a full refetch if desired.
export const createManualMeeting = async (
  friendId: number,
  date: string,
  note?: string,
): Promise<MeetingDTO> => {
  const payload: ManualMeetingRequest = { friendId, groupId: null, date, note: note || null };
  const response = await fetch(`${MEETINGS_API}/manual`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
};

// Full Meeting history + upcoming for a friend, ordered by date descending
// (MeetingController.forFriend). ProfilePage splits this into an upcoming
// list and a DONE history by status client-side.
export const getFriendMeetings = async (friendId: number): Promise<MeetingDTO[]> => {
  const response = await fetch(`${MEETINGS_API}/friend/${friendId}`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
};

// The one unified edit/reschedule surface (MeetingController.updateMeeting) —
// a FULL replace, not a sparse patch, so callers must send the meeting's
// entire current state with only the field(s) they're changing different
// (see UpdateMeetingRequest's doc comment). Backs both MeetingEditModal's
// Save and CalendarBoard's drag-and-drop reschedule.
export const updateMeeting = async (meetingId: number, payload: UpdateMeetingRequest): Promise<MeetingDTO> => {
  const response = await fetch(`${MEETINGS_API}/${meetingId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
};

// Soft-delete: sets status to CANCELLED (MeetingController.cancelMeeting).
// No hard delete exists.
export const cancelMeeting = async (meetingId: number): Promise<MeetingDTO> => {
  const response = await fetch(`${MEETINGS_API}/${meetingId}/cancel`, { method: 'PATCH' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
};

// Live "which existing SocialGroup would this attendee set resolve to"
// preview (MeetingController.previewGroupMatch) — body is a bare array of
// friend ids, not wrapped in an object. Only meaningful when the edited
// attendee set would derive to GROUP; empty array back means no good match
// (falls back to ad-hoc/unlinked). Called debounced as MeetingEditModal's
// attendee list changes.
export const previewGroupMatch = async (attendeeFriendIds: number[]): Promise<GroupMatchDTO[]> => {
  const response = await fetch(`${MEETINGS_API}/group-match-preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(attendeeFriendIds),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
};
