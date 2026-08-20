import React, { useMemo, useState } from 'react';
import { Friend, MeetingDTO, MeetingSource } from '../../../types/api';

interface CalendarBoardProps {
  meetings: MeetingDTO[];
  loading: boolean;
  error: string | null;
  /** Which week the passed-in meetings were fetched for — drives the column date labels. */
  weekOffset: number;
  /** Friend-subject cards still open the existing profile/QuickLogModal flow. */
  onOpenFriend: (friend: Friend) => void;
  onLogChat: (friend: Friend) => void;
  onAddFriend: () => void;
  /**
   * Hook points for Group/Connection cards. The batch-log modal (presence ->
   * per-attendee grade) and the lightweight Connection outcome form
   * (date + Went well/Neutral/Tense + note) are being built by another agent
   * in parallel (SCHEDULING_MEETINGS_PLAN.md Feature B) — these are stubs so
   * that work can slot in later without coordinating live. Defaults to a
   * console.log TODO when not supplied.
   */
  onGroupMeetingClick?: (meeting: MeetingDTO) => void;
  onConnectionMeetingClick?: (meeting: MeetingDTO) => void;
  /**
   * Pencil affordance on any PROPOSED card — opens MeetingEditModal. Separate
   * from onCardClick/onAction above (those are "log what happened" flows for
   * a meeting that already occurred; this is "change the not-yet-happened
   * scheduling details").
   */
  onEditMeeting?: (meeting: MeetingDTO) => void;
  /**
   * Native HTML5 drag-and-drop reschedule: dragging a PROPOSED card to a
   * different day column calls this with the meeting and the new ISO date.
   * Day-columns only (no hour grid), so this never touches time-of-day.
   */
  onDropOnDate?: (meeting: MeetingDTO, newDate: string) => void;
}

interface DayColumn {
  dayName: string;
  dateLabel: string;
  isoDate: string;
  meetings: MeetingDTO[];
  isToday: boolean;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const formatDate = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// yyyy-MM-dd in LOCAL time (not toISOString, which is UTC and can roll the
// date over near midnight) — matches the plain LocalDate string the backend
// sends/expects for MeetingDTO.date.
const toIsoDate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Sorts meetings into Mon-Sun columns for the *targeted* week (today shifted
// by weekOffset*7 days), mirroring the old friend-based day-index math
// (loop index 0-6 is Mon-Sun, JS Date#getDay() is Sun-Sat). Unlike the old
// endpoint, GET /meetings/thisWeek only ever returns rows dated inside that
// Mon-Sun window (MeetingQueryService.thisWeek) — there is no "overdue
// before Monday" bucket anymore, so there's no "Previous" column to build;
// paging back with weekOffset<0 is how you see last week's (now-DONE) rows.
const useWeekColumns = (meetings: MeetingDTO[], weekOffset: number) => useMemo(() => {
  const today = new Date();
  const currentDay = today.getDay();
  const mondayOffset = currentDay === 0 ? -6 : -(currentDay - 1);
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);

  const meetingsByDay = new Map<number, MeetingDTO[]>();
  for (let i = 0; i < 7; i += 1) meetingsByDay.set(i, []);

  meetings.forEach((meeting) => {
    const meetingDate = new Date(meeting.date);
    meetingsByDay.get(meetingDate.getDay())?.push(meeting);
  });

  const columns: DayColumn[] = [];
  for (let i = 0; i < 7; i += 1) {
    const columnDate = new Date(monday);
    columnDate.setDate(monday.getDate() + i);
    const dayIndex = i === 6 ? 0 : i + 1;
    columns.push({
      dayName: DAY_NAMES[dayIndex],
      dateLabel: formatDate(columnDate),
      isoDate: toIsoDate(columnDate),
      meetings: meetingsByDay.get(dayIndex) ?? [],
      isToday: columnDate.toDateString() === today.toDateString(),
    });
  }

  return columns;
}, [meetings, weekOffset]);

type Category = 'friend' | 'group' | 'connection' | 'birthday';

// The derived `type` field (MeetingTypeDeriver, server-side) decides the
// subject category — NOT which FK is non-null. An ad-hoc GROUP meeting that
// didn't auto-match any existing SocialGroup has groupId/groupName null
// despite type === 'GROUP', so branching on groupId here would silently
// misfile it as a Friend card. BIRTHDAY source (always a Friend-subject row)
// keeps its own highlighted category regardless of type.
const categoryFor = (meeting: MeetingDTO): Category => {
  if (meeting.source === 'BIRTHDAY') return 'birthday';
  if (meeting.type === 'GROUP') return 'group';
  if (meeting.type === 'CONNECTION') return 'connection';
  return 'friend';
};

// bg-category-* classes must appear literally somewhere for Tailwind to
// generate them — this map is that literal usage. Reuses the same 4 dot
// colors the board already had (personal/family/work/birthday), remapped
// from "friend.experience text category" to "meeting subject type" since
// Meeting rows don't carry an experience string.
const CATEGORY_DOT: Record<Category, string> = {
  friend: 'bg-category-personal',
  group: 'bg-category-family',
  connection: 'bg-category-work',
  birthday: 'bg-category-birthday',
};

export const CATEGORY_LEGEND: { label: string; dot: string }[] = [
  { label: 'Friend', dot: 'bg-category-personal' },
  { label: 'Group', dot: 'bg-category-family' },
  { label: 'Connection', dot: 'bg-category-work' },
  { label: 'Birthday', dot: 'bg-category-birthday' },
];

const SOURCE_LABEL: Record<MeetingSource, string> = {
  FSRS_PROPOSED: 'Scheduled',
  BIRTHDAY: 'Birthday',
  MANUAL: 'Manual',
};

// Builds just enough of a Friend to hand to the existing onOpenFriend/
// onLogChat callbacks (profile nav + QuickLogModal), which only ever read
// id/name/dateOfBirth/role off it — MeetingDTO only carries id+name for its
// friend subject, so the rest stays undefined/blank rather than triggering
// an extra fetch just to open a modal.
const friendFromMeeting = (meeting: MeetingDTO): Friend => ({
  id: meeting.friendId as number,
  name: meeting.friendName ?? 'Friend',
  plannedSpeakingTime: meeting.date,
  experience: '',
});

// The week-column "day-column catch-up board" from the redesign handoff —
// now one card per Meeting row instead of one dot per friend on
// plannedSpeakingTime, so a friend can show up twice (e.g. FSRS date +
// birthday) instead of birthday silently being dropped when it didn't
// coincide with the FSRS date (see SCHEDULING_MEETINGS_PLAN.md Feature B).
const CalendarBoard: React.FC<CalendarBoardProps> = ({
  meetings, loading, error, weekOffset, onOpenFriend, onLogChat, onAddFriend,
  onGroupMeetingClick, onConnectionMeetingClick, onEditMeeting, onDropOnDate,
}) => {
  const columns = useWeekColumns(meetings, weekOffset);
  // Tracked in component state rather than read back off dataTransfer on
  // drop — jsdom (and some real browsers under certain drag sources) don't
  // reliably round-trip custom dataTransfer payloads, and we already have
  // the full MeetingDTO in hand at drag start.
  const [draggedMeeting, setDraggedMeeting] = useState<MeetingDTO | null>(null);
  const [dragOverIso, setDragOverIso] = useState<string | null>(null);

  const handleGroupClick = (meeting: MeetingDTO) => {
    if (onGroupMeetingClick) onGroupMeetingClick(meeting);
    else console.log('TODO: open group batch-log modal for meeting', meeting.id);
  };

  const handleConnectionClick = (meeting: MeetingDTO) => {
    if (onConnectionMeetingClick) onConnectionMeetingClick(meeting);
    else console.log('TODO: open connection outcome form for meeting', meeting.id);
  };

  const handleDragStart = (e: React.DragEvent, meeting: MeetingDTO) => {
    setDraggedMeeting(meeting);
    e.dataTransfer?.setData('text/plain', String(meeting.id));
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedMeeting(null);
    setDragOverIso(null);
  };

  const handleColumnDragOver = (e: React.DragEvent, isoDate: string) => {
    if (!draggedMeeting) return;
    e.preventDefault();
    setDragOverIso(isoDate);
  };

  const handleColumnDrop = (e: React.DragEvent, isoDate: string) => {
    e.preventDefault();
    setDragOverIso(null);
    if (!draggedMeeting) return;
    if (isoDate !== draggedMeeting.date) {
      onDropOnDate?.(draggedMeeting, isoDate);
    }
    setDraggedMeeting(null);
  };

  const meetingCard = (meeting: MeetingDTO) => {
    const category = categoryFor(meeting);
    const isDone = meeting.status === 'DONE';
    const isBirthday = meeting.source === 'BIRTHDAY';
    const isEditable = meeting.status === 'PROPOSED';
    const subtitle = meeting.note?.trim() || SOURCE_LABEL[meeting.source];

    let title: string;
    let onCardClick: () => void;
    let actionLabel: string;
    let onAction: () => void;

    if (category === 'group') {
      title = meeting.groupName ?? 'Group';
      onCardClick = () => handleGroupClick(meeting);
      actionLabel = 'Log meeting';
      onAction = () => handleGroupClick(meeting);
    } else if (category === 'connection') {
      title = `Connection #${meeting.connectionFriend1Id ?? '?'}–#${meeting.connectionFriend2Id ?? '?'}`;
      onCardClick = () => handleConnectionClick(meeting);
      actionLabel = 'Log outcome';
      onAction = () => handleConnectionClick(meeting);
    } else {
      const friend = friendFromMeeting(meeting);
      title = isBirthday ? `🎂 ${friend.name}` : friend.name;
      onCardClick = () => onOpenFriend(friend);
      actionLabel = '✓ Log chat';
      onAction = () => onLogChat(friend);
    }

    return (
      <div
        key={meeting.id}
        draggable={isEditable}
        onDragStart={isEditable ? (e) => handleDragStart(e, meeting) : undefined}
        onDragEnd={isEditable ? handleDragEnd : undefined}
        data-meeting-id={meeting.id}
        className={`bg-surface-2 border rounded-[10px] px-2.5 py-2.5 ${
          isBirthday ? 'border-category-birthday/50' : 'border-white/[.06]'
        } ${isDone ? 'opacity-60' : ''} ${isEditable ? 'cursor-grab active:cursor-grabbing' : ''}`}
      >
        <div className="flex items-start gap-1">
          <div className="cursor-pointer flex-1 min-w-0" onClick={onCardClick}>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-sm flex-none ${CATEGORY_DOT[category]}`} />
              <span className="font-bold text-xs leading-tight text-text-primary truncate">{title}</span>
            </div>
            <div className="text-[10.5px] text-text-muted mt-1">{subtitle}</div>
          </div>
          {isEditable && onEditMeeting && (
            <button
              type="button"
              aria-label={`Edit ${title}`}
              onClick={(e) => { e.stopPropagation(); onEditMeeting(meeting); }}
              className="flex-none w-5 h-5 rounded border-none bg-transparent text-text-faint hover:text-text-emphasis hover:bg-input transition-colors text-[11px] leading-none"
            >
              ✎
            </button>
          )}
        </div>
        {isDone ? (
          <div className="mt-2.5 w-full text-center text-good text-[11px] font-bold py-1.5">✓ Done</div>
        ) : (
          <button
            type="button"
            onClick={onAction}
            className="mt-2.5 w-full border-none bg-accent/16 text-accent-light text-[11px] font-bold py-1.5 rounded-md hover:bg-accent/28 transition-colors"
          >
            {actionLabel}
          </button>
        )}
      </div>
    );
  };

  const addButton = (
    <button
      type="button"
      onClick={onAddFriend}
      className="border border-dashed border-white/[.14] bg-transparent text-text-faint text-[11px] py-2 rounded-[7px] hover:text-text-muted transition-colors"
    >
      + Add
    </button>
  );

  if (loading) {
    return <div className="text-center p-8 text-text-muted">Loading…</div>;
  }
  if (error) {
    return <div className="text-center p-8 text-bad">{error}</div>;
  }

  return (
    <div className="flex gap-2.5 overflow-x-auto pb-2">
      {columns.map((col) => (
        <div
          key={col.dayName}
          data-day-column={col.isoDate}
          onDragOver={(e) => handleColumnDragOver(e, col.isoDate)}
          onDrop={(e) => handleColumnDrop(e, col.isoDate)}
          className={`flex-none w-[170px] border rounded-card p-[13px] transition-colors ${
            col.isToday ? 'bg-accent/[.08] border-accent/40' : 'bg-surface border-white/[.06]'
          } ${dragOverIso === col.isoDate ? 'border-accent/70 bg-accent/[.12]' : ''}`}
        >
          <div className="pb-2.5 mb-2.5 border-b border-hairline">
            <div className={`font-bold text-[12.5px] ${col.isToday ? 'text-accent-light' : 'text-text-emphasis'}`}>
              {col.dayName}
            </div>
            <div className="text-[10.5px] text-text-faint mt-0.5">
              {col.dateLabel}{col.isToday ? ' · today' : ''}
            </div>
          </div>
          <div className="flex flex-col gap-2 min-h-[220px]">
            {col.meetings.map(meetingCard)}
            {addButton}
          </div>
        </div>
      ))}
    </div>
  );
};

export default CalendarBoard;
