import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import MeetingEditModal from './MeetingEditModal';
import { getShortFriendList } from '../../../services/api/friendService';
import { updateMeeting, cancelMeeting, previewGroupMatch } from '../../../services/api/meetingService';
import { MeetingDTO, ShortFriend, UpdateMeetingRequest } from '../../../types/api';

jest.mock('../../../services/api/friendService', () => ({
  getShortFriendList: jest.fn(),
}));
jest.mock('../../../services/api/meetingService', () => ({
  updateMeeting: jest.fn(),
  cancelMeeting: jest.fn(),
  previewGroupMatch: jest.fn(),
}));

const mockedGetShortFriendList = getShortFriendList as jest.MockedFunction<typeof getShortFriendList>;
const mockedUpdateMeeting = updateMeeting as jest.MockedFunction<typeof updateMeeting>;
const mockedCancelMeeting = cancelMeeting as jest.MockedFunction<typeof cancelMeeting>;
const mockedPreviewGroupMatch = previewGroupMatch as jest.MockedFunction<typeof previewGroupMatch>;

const friends: ShortFriend[] = [
  { id: 7, name: 'Ada Lovelace' },
  { id: 8, name: 'Grace Hopper' },
  { id: 9, name: 'Katherine Johnson' },
];

const friendMeeting: MeetingDTO = {
  id: 10,
  type: 'FRIEND',
  friendId: 7,
  friendName: 'Ada Lovelace',
  groupId: null,
  groupName: null,
  connectionFriend1Id: null,
  connectionFriend2Id: null,
  date: '2026-08-25',
  time: null,
  location: null,
  selfAttending: true,
  attendees: [{ id: 1, friendId: 7, friendName: 'Ada Lovelace', present: true }],
  source: 'FSRS_PROPOSED',
  status: 'PROPOSED',
  note: null,
};

const renderModal = (
  meeting: MeetingDTO | null = friendMeeting,
  onSaved = jest.fn(),
  onCancelled = jest.fn(),
  onClose = jest.fn(),
) => render(<MeetingEditModal meeting={meeting} onClose={onClose} onSaved={onSaved} onCancelled={onCancelled} />);

const toggleFriend = (name: string) => {
  const row = screen.getByText(name).closest('label') as HTMLElement;
  fireEvent.click(within(row).getByRole('checkbox'));
};

describe('MeetingEditModal', () => {
  beforeEach(() => {
    mockedGetShortFriendList.mockReset();
    mockedUpdateMeeting.mockReset();
    mockedCancelMeeting.mockReset();
    mockedPreviewGroupMatch.mockReset();
    mockedGetShortFriendList.mockResolvedValue(friends);
    mockedPreviewGroupMatch.mockResolvedValue([]);
    mockedUpdateMeeting.mockResolvedValue({ ...friendMeeting, type: 'GROUP' });
    mockedCancelMeeting.mockResolvedValue({ ...friendMeeting, status: 'CANCELLED' });
  });

  it('loads the current attendee pre-checked and shows the Friend badge', async () => {
    renderModal();
    await screen.findByText('Ada Lovelace');

    const row = screen.getByText('Ada Lovelace').closest('label') as HTMLElement;
    expect(within(row).getByRole('checkbox')).toBeChecked();
    expect(screen.getByTestId('derived-type-badge')).toHaveTextContent('Friend');
  });

  it('adding a second attendee flips the derived-type badge to Group live, client-side', async () => {
    renderModal();
    await screen.findByText('Grace Hopper');

    expect(screen.getByTestId('derived-type-badge')).toHaveTextContent('Friend');
    toggleFriend('Grace Hopper');

    expect(screen.getByTestId('derived-type-badge')).toHaveTextContent('Group');
  });

  it('removing the only other attendee drops below valid attendance and disables Save', async () => {
    renderModal();
    await screen.findByText('Ada Lovelace');

    toggleFriend('Ada Lovelace'); // now zero non-self attendees

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByText('Add at least one other attendee.')).toBeInTheDocument();
  });

  it('save sends a full-replace PATCH body reflecting the current form state', async () => {
    const onSaved = jest.fn();
    renderModal(friendMeeting, onSaved);
    await screen.findByText('Grace Hopper');

    toggleFriend('Grace Hopper');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mockedUpdateMeeting).toHaveBeenCalledTimes(1));
    const [meetingId, payload] = mockedUpdateMeeting.mock.calls[0] as [number, UpdateMeetingRequest];
    expect(meetingId).toBe(10);
    expect(payload).toEqual({
      date: '2026-08-25',
      time: null,
      location: null,
      attendeeFriendIds: [7, 8],
      selfAttending: true,
      groupId: null,
      newGroupName: null,
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it('unchecking "I\'m attending" with only one other attendee derives Connection and requires a second attendee to save', async () => {
    renderModal();
    await screen.findByText('Grace Hopper');

    const selfRow = screen.getByText("I'm attending").closest('label') as HTMLElement;
    fireEvent.click(within(selfRow).getByRole('checkbox'));

    // self off, 1 attendee (Ada) -> invalid, needs 2 without self.
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    toggleFriend('Grace Hopper');
    expect(screen.getByTestId('derived-type-badge')).toHaveTextContent('Connection');
    expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled();
  });

  it('cancelling the meeting calls the cancel endpoint after confirmation', async () => {
    const onCancelled = jest.fn();
    renderModal(friendMeeting, jest.fn(), onCancelled);
    await screen.findByText('Ada Lovelace');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel meeting' }));
    // Confirm dialog appears with its own "Cancel meeting" confirm button.
    const confirmButtons = screen.getAllByRole('button', { name: 'Cancel meeting' });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => expect(mockedCancelMeeting).toHaveBeenCalledWith(10));
    await waitFor(() => expect(onCancelled).toHaveBeenCalled());
  });

  it('fetches a group-match preview once the attendee set derives to Group', async () => {
    mockedPreviewGroupMatch.mockResolvedValue([{ groupId: 1, groupName: 'Book Club', score: 0.8, groupSize: 3 }]);
    renderModal();
    await screen.findByText('Grace Hopper');

    toggleFriend('Grace Hopper');

    await waitFor(() => expect(mockedPreviewGroupMatch).toHaveBeenCalledWith([7, 8]), { timeout: 2000 });
    await screen.findByText('Book Club');
  });
});
