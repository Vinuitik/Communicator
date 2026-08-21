import {
    AttendeeDTO, CompleteGroupMeetingRequest, ConnectionCandidateDTO, ManualMeetingRequest, MeetingDTO,
} from '../../types/api';
import { API_BASE } from './config';

const API_URL = API_BASE.MEETINGS;

// Group batch-log flow — MeetingController (meeting module). Consumed by
// GroupBatchLogModal (presence -> per-attendee grade -> complete) and
// GroupConnectionsNudge (post-complete Group->Connections prompt). See
// GroupDetailsPage for how these four calls chain together.

// Creates a MANUAL meeting. Exactly one of friendId/groupId must be set.
// For a group, the backend auto-creates a MeetingAttendee row (present=true)
// for every current member. Callers should check getGroupMeetings first —
// this does not dedupe against an existing PROPOSED meeting itself.
export const createManualGroupMeeting = async (payload: ManualMeetingRequest): Promise<MeetingDTO> => {
    const response = await fetch(`${API_URL}/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
    }
    return response.json();
};

export const getGroupMeetings = async (groupId: number): Promise<MeetingDTO[]> => {
    const response = await fetch(`${API_URL}/group/${groupId}`);
    if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
    }
    return response.json();
};

export const getMeetingAttendees = async (meetingId: number): Promise<AttendeeDTO[]> => {
    const response = await fetch(`${API_URL}/${meetingId}/attendees`);
    if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
    }
    return response.json();
};

// Grades each present attendee through the FSRS pipeline and marks the
// meeting DONE. Absent attendees still need an entry (present:false) — see
// CompleteGroupMeetingRequest.AttendeeLog's doc comment.
export const completeGroupMeeting = async (meetingId: number, payload: CompleteGroupMeetingRequest): Promise<MeetingDTO> => {
    const response = await fetch(`${API_URL}/${meetingId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
    }
    return response.json();
};

// Call only after a successful completeGroupMeeting — present-attendee pairs
// from that meeting that already have a tracked Connection.
export const getConnectionCandidates = async (meetingId: number): Promise<ConnectionCandidateDTO[]> => {
    const response = await fetch(`${API_URL}/${meetingId}/connection-candidates`);
    if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
    }
    return response.json();
};
