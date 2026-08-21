import { ConnectionMeetingRequest, MeetingDTO } from '../../types/api';
import { API_BASE } from './config';

const API_URL = API_BASE.MEETINGS;

// Logs a CONNECTION meeting — date + outcome + optional note. Saved server-side
// as already-DONE (no PROPOSED/scheduling state for Connections, see
// ConnectionMeetingService.java); the note (if any) auto-appends to
// ConnectionsKnowledge. No FSRS side effect.
export const logConnectionMeeting = async (payload: ConnectionMeetingRequest): Promise<MeetingDTO> => {
    const response = await fetch(`${API_URL}/connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
    }
    return response.json();
};
