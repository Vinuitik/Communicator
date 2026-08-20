import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import HomePage from './HomePage';
import { ToastProvider } from '../../molecules/Toast';
import { MeetingDTO } from '../../../types/api';
import { getThisWeek } from '../../../services/api/meetingService';

jest.mock('../../../services/api/meetingService');
jest.mock('../../../pwa/offlineApi', () => ({
  talkedToFriendOffline: jest.fn(),
}));

const mockGetThisWeek = getThisWeek as jest.Mock;

const meeting = (overrides: Partial<MeetingDTO>): MeetingDTO => ({
  id: 1,
  type: 'FRIEND',
  friendId: null,
  friendName: null,
  groupId: null,
  groupName: null,
  connectionFriend1Id: null,
  connectionFriend2Id: null,
  date: new Date().toISOString().slice(0, 10),
  time: null,
  location: null,
  selfAttending: true,
  attendees: [],
  source: 'FSRS_PROPOSED',
  status: 'PROPOSED',
  note: null,
  ...overrides,
});

const renderPage = () => render(
  <MemoryRouter>
    <ToastProvider>
      <HomePage />
    </ToastProvider>
  </MemoryRouter>,
);

describe('HomePage — week board', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetThisWeek.mockResolvedValue([]);
  });

  it('fetches weekOffset=0 on initial load', async () => {
    renderPage();
    await waitFor(() => expect(mockGetThisWeek).toHaveBeenCalledWith(0));
  });

  it('fetches weekOffset=-1 when the back arrow is clicked', async () => {
    renderPage();
    await waitFor(() => expect(mockGetThisWeek).toHaveBeenCalledWith(0));

    fireEvent.click(screen.getByText('‹'));

    await waitFor(() => expect(mockGetThisWeek).toHaveBeenCalledWith(-1));
  });

  it('fetches weekOffset=1 when the forward arrow is clicked', async () => {
    renderPage();
    await waitFor(() => expect(mockGetThisWeek).toHaveBeenCalledWith(0));

    fireEvent.click(screen.getByText('›'));

    await waitFor(() => expect(mockGetThisWeek).toHaveBeenCalledWith(1));
  });

  it('resets to weekOffset=0 when Today is clicked after paging back', async () => {
    renderPage();
    await waitFor(() => expect(mockGetThisWeek).toHaveBeenCalledWith(0));

    fireEvent.click(screen.getByText('‹'));
    await waitFor(() => expect(mockGetThisWeek).toHaveBeenCalledWith(-1));

    fireEvent.click(screen.getByText('Today'));
    await waitFor(() => expect(mockGetThisWeek).toHaveBeenCalledTimes(3));
    expect(mockGetThisWeek).toHaveBeenLastCalledWith(0);
  });

  it('renders a GROUP-sourced meeting row without crashing', async () => {
    const today = new Date().toISOString().slice(0, 10);
    mockGetThisWeek.mockResolvedValue([
      meeting({ id: 10, groupId: 5, groupName: 'Book Club', date: today, source: 'MANUAL' }),
    ]);

    renderPage();

    expect(await screen.findByText('Book Club')).toBeInTheDocument();
  });

  it('renders a CONNECTION-sourced meeting row without crashing', async () => {
    const today = new Date().toISOString().slice(0, 10);
    mockGetThisWeek.mockResolvedValue([
      meeting({
        id: 11, connectionFriend1Id: 3, connectionFriend2Id: 7, date: today, source: 'MANUAL',
      }),
    ]);

    renderPage();

    expect(await screen.findByText('Connection #3–#7')).toBeInTheDocument();
  });
});
