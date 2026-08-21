import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import GroupBatchLogModal from './GroupBatchLogModal';
import { AttendeeDTO, CompleteGroupMeetingRequest, MeetingDTO } from '../../../types/api';
import { getMeetingAttendees, completeGroupMeeting } from '../../../services/api/groupMeetingService';

jest.mock('../../../services/api/groupMeetingService', () => ({
  getMeetingAttendees: jest.fn(),
  completeGroupMeeting: jest.fn(),
}));

const mockedGetAttendees = getMeetingAttendees as jest.MockedFunction<typeof getMeetingAttendees>;
const mockedComplete = completeGroupMeeting as jest.MockedFunction<typeof completeGroupMeeting>;

const attendees: AttendeeDTO[] = [
  { id: 1, friendId: 10, friendName: 'Ada Lovelace', present: true },
  { id: 2, friendId: 20, friendName: 'Grace Hopper', present: true },
];

const doneMeeting: MeetingDTO = {
  id: 5,
  type: 'GROUP',
  groupId: 1,
  groupName: 'Book Club',
  date: '2026-08-20',
  time: null,
  location: null,
  selfAttending: true,
  attendees: [],
  source: 'MANUAL',
  status: 'DONE',
};

const renderModal = (onComplete = jest.fn(), onClose = jest.fn()) =>
  render(<GroupBatchLogModal meetingId={5} groupName="Book Club" onClose={onClose} onComplete={onComplete} />);

describe('GroupBatchLogModal', () => {
  beforeEach(() => {
    mockedGetAttendees.mockReset();
    mockedComplete.mockReset();
    mockedGetAttendees.mockResolvedValue(attendees);
    mockedComplete.mockResolvedValue(doneMeeting);
  });

  it('loads attendees pre-filled as present', async () => {
    renderModal();
    await screen.findByText('Ada Lovelace');
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(checkboxes.every((c) => c.checked)).toBe(true);
  });

  it('toggling a member absent excludes them from being graded in the complete payload', async () => {
    const onComplete = jest.fn();
    renderModal(onComplete);
    await screen.findByText('Ada Lovelace');

    // Toggle Grace Hopper absent.
    const graceRow = screen.getByText('Grace Hopper').closest('label') as HTMLElement;
    fireEvent.click(within(graceRow).getByRole('checkbox'));

    fireEvent.click(screen.getByText('Continue (1)'));

    // Only the still-present attendee (Ada) should reach the grading step.
    await screen.findByText('How did it go with each person?');
    expect(screen.queryByText('Grace Hopper')).not.toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Complete meeting'));

    await waitFor(() => expect(mockedComplete).toHaveBeenCalledTimes(1));
    const [meetingId, payload] = mockedComplete.mock.calls[0] as [number, CompleteGroupMeetingRequest];
    expect(meetingId).toBe(5);

    const adaEntry = payload.attendees.find((a) => a.friendId === 10);
    const graceEntry = payload.attendees.find((a) => a.friendId === 20);

    expect(adaEntry).toMatchObject({ present: true, durationHours: 1, experience: '***', inPerson: true });
    expect(graceEntry?.present).toBe(false);
    expect(graceEntry?.durationHours ?? null).toBeNull();
    expect(graceEntry?.experience ?? null).toBeNull();

    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(doneMeeting));
  });

  it('disables Continue when everyone is toggled absent', async () => {
    renderModal();
    await screen.findByText('Ada Lovelace');

    screen.getAllByRole('checkbox').forEach((checkbox) => fireEvent.click(checkbox));

    expect(screen.getByText('Continue')).toBeDisabled();
  });
});
