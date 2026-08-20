import { MeetingDTO } from '../../types/api';
import { API_BASE } from './config';

const API_URL = API_BASE.MEETINGS;

// Backs HomePage's week board (MeetingController.thisWeek). weekOffset=0 is
// the current Mon-Sun week; negative offsets page backward and — since only
// CANCELLED status is excluded server-side — past DONE meetings come back
// too, read as history rather than just upcoming. Replaces
// friendService.getFriendsThisWeek for the week-board use case (that one
// only ever read Friend.plannedSpeakingTime and can't represent
// Group/Connection meetings or birthdays as their own rows).
export const getThisWeek = async (weekOffset: number): Promise<MeetingDTO[]> => {
    const response = await fetch(`${API_URL}/thisWeek?weekOffset=${weekOffset}`);
    if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
    }
    return response.json();
};
