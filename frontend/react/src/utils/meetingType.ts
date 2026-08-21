import { MeetingType } from '../types/api';

// Client-side mirror of meeting/.../service/MeetingTypeDeriver.java — kept in
// lockstep with that pure function so MeetingEditModal's type badge can
// update live as attendees/selfAttending change, before the PATCH round-trip
// confirms the same result server-side.
//
// self + 1 other   -> FRIEND
// self + 2+ others -> GROUP
// no-self + 2      -> CONNECTION
// no-self + 3+     -> GROUP (I just wasn't there)
// attendeeCount <= 1 with no self is not a valid meeting (nothing to derive a
// type from) — callers should block save rather than trust this branch's
// fallback; see isValidAttendance below, mirroring MeetingEditService's
// own checks.
export const deriveMeetingType = (selfAttending: boolean, attendeeCount: number): MeetingType => {
  if (selfAttending) {
    return attendeeCount <= 1 ? 'FRIEND' : 'GROUP';
  }
  return attendeeCount === 2 ? 'CONNECTION' : 'GROUP';
};

// Mirrors MeetingEditService.updateMeeting's two guard checks: at least one
// other attendee always required, and at least two if you're not attending
// yourself. Gates MeetingEditModal's Save button before hitting the PATCH
// (which 400s on the same rule).
export const isValidAttendance = (selfAttending: boolean, attendeeCount: number): boolean =>
  attendeeCount >= 1 && (selfAttending || attendeeCount >= 2);
