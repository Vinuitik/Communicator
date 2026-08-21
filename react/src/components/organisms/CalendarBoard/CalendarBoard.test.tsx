import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import CalendarBoard from './CalendarBoard';
import { MeetingDTO } from '../../../types/api';

const pad = (n: number) => String(n).padStart(2, '0');
const isoToday = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
})();

const baseMeeting: MeetingDTO = {
  id: 42,
  type: 'FRIEND',
  friendId: 7,
  friendName: 'Ada Lovelace',
  groupId: null,
  groupName: null,
  connectionFriend1Id: null,
  connectionFriend2Id: null,
  date: isoToday,
  time: null,
  location: null,
  selfAttending: true,
  attendees: [{ id: 1, friendId: 7, friendName: 'Ada Lovelace', present: true }],
  source: 'FSRS_PROPOSED',
  status: 'PROPOSED',
  note: null,
};

const renderBoard = (meetings: MeetingDTO[], extraProps: Partial<React.ComponentProps<typeof CalendarBoard>> = {}) =>
  render(
    <CalendarBoard
      meetings={meetings}
      loading={false}
      error={null}
      weekOffset={0}
      onOpenFriend={jest.fn()}
      onLogChat={jest.fn()}
      onAddFriend={jest.fn()}
      {...extraProps}
    />,
  );

// Finds the "today" column (the only one carrying " · today" in its date
// label) and a different column to use as a drop target — avoids hardcoding
// weekday math that CalendarBoard already owns.
const findTodayAndOtherColumn = (): { today: HTMLElement; other: HTMLElement } => {
  const todayLabel = screen.getByText(/· today/);
  const today = todayLabel.closest('[data-day-column]') as HTMLElement;
  const columns = Array.from(document.querySelectorAll('[data-day-column]')) as HTMLElement[];
  const other = columns.find((c) => c !== today) as HTMLElement;
  return { today, other };
};

describe('CalendarBoard drag-and-drop reschedule', () => {
  it('dragging a PROPOSED card onto a different day column reports the new date, unchanged otherwise', () => {
    const onDropOnDate = jest.fn();
    renderBoard([baseMeeting], { onDropOnDate });

    const card = screen.getByText('Ada Lovelace').closest('[data-meeting-id="42"]') as HTMLElement;
    expect(card).toHaveAttribute('draggable', 'true');

    const { other } = findTodayAndOtherColumn();
    const otherIso = other.getAttribute('data-day-column') as string;

    fireEvent.dragStart(card);
    fireEvent.dragOver(other);
    fireEvent.drop(other);

    expect(onDropOnDate).toHaveBeenCalledTimes(1);
    const [droppedMeeting, newDate] = onDropOnDate.mock.calls[0];
    expect(newDate).toBe(otherIso);
    // Everything else about the meeting is passed through unchanged — the
    // caller (HomePage) is responsible for resending it verbatim except date.
    expect(droppedMeeting).toEqual(baseMeeting);
  });

  it('dropping back on the same day column does not fire a reschedule', () => {
    const onDropOnDate = jest.fn();
    renderBoard([baseMeeting], { onDropOnDate });

    const card = screen.getByText('Ada Lovelace').closest('[data-meeting-id="42"]') as HTMLElement;
    const { today } = findTodayAndOtherColumn();

    fireEvent.dragStart(card);
    fireEvent.dragOver(today);
    fireEvent.drop(today);

    expect(onDropOnDate).not.toHaveBeenCalled();
  });

  it('a DONE meeting is not draggable and never triggers a reschedule', () => {
    const onDropOnDate = jest.fn();
    const doneMeeting: MeetingDTO = { ...baseMeeting, id: 43, status: 'DONE' };
    renderBoard([doneMeeting], { onDropOnDate });

    const card = screen.getByText('Ada Lovelace').closest('[data-meeting-id="43"]') as HTMLElement;
    expect(card).not.toHaveAttribute('draggable', 'true');

    const { other } = findTodayAndOtherColumn();
    fireEvent.dragStart(card);
    fireEvent.dragOver(other);
    fireEvent.drop(other);

    expect(onDropOnDate).not.toHaveBeenCalled();
  });

  it('shows an edit pencil for PROPOSED meetings that calls onEditMeeting, separate from the primary action', () => {
    const onEditMeeting = jest.fn();
    const onLogChat = jest.fn();
    renderBoard([baseMeeting], { onEditMeeting, onLogChat });

    fireEvent.click(screen.getByRole('button', { name: 'Edit Ada Lovelace' }));

    expect(onEditMeeting).toHaveBeenCalledWith(baseMeeting);
    expect(onLogChat).not.toHaveBeenCalled();
  });

  it('does not show an edit pencil for a DONE meeting', () => {
    const doneMeeting: MeetingDTO = { ...baseMeeting, id: 44, status: 'DONE' };
    renderBoard([doneMeeting], { onEditMeeting: jest.fn() });

    expect(screen.queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument();
  });
});

describe('CalendarBoard DONE-status click gating (card body)', () => {
  const connectionMeeting = (overrides: Partial<MeetingDTO> = {}): MeetingDTO => ({
    ...baseMeeting,
    id: 60,
    type: 'CONNECTION',
    friendId: null,
    friendName: null,
    connectionFriend1Id: 3,
    connectionFriend2Id: 7,
    attendees: [
      { id: 1, friendId: 3, friendName: 'Ada', present: true },
      { id: 2, friendId: 7, friendName: 'Grace', present: true },
    ],
    selfAttending: false,
    ...overrides,
  });

  it('a PROPOSED connection card body click opens the outcome-logging flow', () => {
    const onConnectionMeetingClick = jest.fn();
    const onViewConnection = jest.fn();
    renderBoard([connectionMeeting({ status: 'PROPOSED' })], { onConnectionMeetingClick, onViewConnection });

    fireEvent.click(screen.getByText('Connection #3–#7'));

    expect(onConnectionMeetingClick).toHaveBeenCalledTimes(1);
    expect(onViewConnection).not.toHaveBeenCalled();
  });

  it('a DONE connection card body click shows history instead of reopening the log form', () => {
    const onConnectionMeetingClick = jest.fn();
    const onViewConnection = jest.fn();
    const meeting = connectionMeeting({ status: 'DONE' });
    renderBoard([meeting], { onConnectionMeetingClick, onViewConnection });

    fireEvent.click(screen.getByText('Connection #3–#7'));

    expect(onViewConnection).toHaveBeenCalledWith(meeting);
    expect(onConnectionMeetingClick).not.toHaveBeenCalled();
  });

  it('a DONE group card body click is a no-op, not a reopened batch-log modal', () => {
    const onGroupMeetingClick = jest.fn();
    const doneGroup: MeetingDTO = {
      ...baseMeeting,
      id: 61,
      type: 'GROUP',
      friendId: null,
      friendName: null,
      groupId: 5,
      groupName: 'Book Club',
      status: 'DONE',
      attendees: [
        { id: 1, friendId: 7, friendName: 'Ada Lovelace', present: true },
        { id: 2, friendId: 8, friendName: 'Grace Hopper', present: true },
      ],
    };
    renderBoard([doneGroup], { onGroupMeetingClick });

    fireEvent.click(screen.getByText('Book Club'));

    expect(onGroupMeetingClick).not.toHaveBeenCalled();
  });

  it('a PROPOSED group card body click still opens the batch-log modal', () => {
    const onGroupMeetingClick = jest.fn();
    const proposedGroup: MeetingDTO = {
      ...baseMeeting,
      id: 62,
      type: 'GROUP',
      friendId: null,
      friendName: null,
      groupId: 5,
      groupName: 'Book Club',
      status: 'PROPOSED',
      attendees: [
        { id: 1, friendId: 7, friendName: 'Ada Lovelace', present: true },
        { id: 2, friendId: 8, friendName: 'Grace Hopper', present: true },
      ],
    };
    renderBoard([proposedGroup], { onGroupMeetingClick });

    fireEvent.click(screen.getByText('Book Club'));

    expect(onGroupMeetingClick).toHaveBeenCalledTimes(1);
  });
});

describe('CalendarBoard categoryFor', () => {
  it('renders an ad-hoc GROUP meeting (groupId null, type GROUP) with the group category, not friend', () => {
    const adHocGroup: MeetingDTO = {
      ...baseMeeting,
      id: 50,
      type: 'GROUP',
      friendId: null,
      friendName: null,
      groupId: null,
      groupName: null,
      attendees: [
        { id: 1, friendId: 7, friendName: 'Ada Lovelace', present: true },
        { id: 2, friendId: 8, friendName: 'Grace Hopper', present: true },
      ],
    };
    renderBoard([adHocGroup]);

    // Falls back to the "Group" title, not a Friend-card render, and offers
    // the Group action label rather than the Friend "Log chat" one.
    expect(screen.getByText('Group')).toBeInTheDocument();
    expect(screen.getByText('Log meeting')).toBeInTheDocument();
  });
});
