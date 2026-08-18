import React from 'react';
import { render, screen, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import InsightsPage from './InsightsPage';
import { ToastProvider } from '../../molecules/Toast';
import { Friend } from '../../../types/api';
import {
  getShortFriendList,
  getFriendsCount,
  getFriendsThisWeek,
  getFriendsPage,
  getFriendAnalytics,
  getFriendAnalyticsSeries,
} from '../../../services/api/friendService';

jest.mock('../../../services/api/friendService');

const mockGetShortFriendList = getShortFriendList as jest.Mock;
const mockGetFriendsCount = getFriendsCount as jest.Mock;
const mockGetFriendsThisWeek = getFriendsThisWeek as jest.Mock;
const mockGetFriendsPage = getFriendsPage as jest.Mock;
const mockGetFriendAnalytics = getFriendAnalytics as jest.Mock;
const mockGetFriendAnalyticsSeries = getFriendAnalyticsSeries as jest.Mock;

const baseFriend = (overrides: Partial<Friend>): Friend => ({
  id: 1,
  name: 'Unnamed',
  plannedSpeakingTime: new Date().toISOString(),
  experience: 'Coffee',
  ...overrides,
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <InsightsPage />
      </ToastProvider>
    </MemoryRouter>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockGetShortFriendList.mockResolvedValue([]);
  mockGetFriendsThisWeek.mockResolvedValue([]);
  mockGetFriendAnalytics.mockResolvedValue([]);
  mockGetFriendAnalyticsSeries.mockResolvedValue({ labels: [], duration: [], frequency: [], intensity: [], proximity: [] });
});

describe('InsightsPage — Leeching section', () => {
  it('lists a friend with leech: true', async () => {
    mockGetFriendsCount.mockResolvedValue(2);
    mockGetFriendsPage.mockResolvedValue([
      baseFriend({ id: 1, name: 'Leechy Lee', leech: true }),
      baseFriend({ id: 2, name: 'Steady Sam', leech: false }),
    ]);

    renderPage();

    const section = await screen.findByTestId('leeching-section');
    await waitFor(() => {
      expect(within(section).getByText('Leechy Lee')).toBeInTheDocument();
    });
  });

  it('does not list a friend with leech: false or undefined', async () => {
    mockGetFriendsCount.mockResolvedValue(2);
    mockGetFriendsPage.mockResolvedValue([
      baseFriend({ id: 1, name: 'Steady Sam', leech: false }),
      baseFriend({ id: 2, name: 'No Flag Nick' }),
    ]);

    renderPage();

    const section = await screen.findByTestId('leeching-section');
    await waitFor(() => {
      expect(mockGetFriendsPage).toHaveBeenCalled();
    });
    expect(within(section).queryByText('Steady Sam')).not.toBeInTheDocument();
    expect(within(section).queryByText('No Flag Nick')).not.toBeInTheDocument();
    expect(within(section).getByText(/no leeching friends/i)).toBeInTheDocument();
  });

  it('renders a sensible empty state with zero leeching friends, without crashing', async () => {
    mockGetFriendsCount.mockResolvedValue(0);
    mockGetFriendsPage.mockResolvedValue([]);

    renderPage();

    const section = await screen.findByTestId('leeching-section');
    expect(within(section).getByRole('heading', { name: /leeching/i })).toBeInTheDocument();
    expect(within(section).getByText(/no leeching friends/i)).toBeInTheDocument();
    expect(mockGetFriendsPage).not.toHaveBeenCalled();
  });
});
