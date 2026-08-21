import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProfilePage from './ProfilePage';
import { ToastProvider } from '../../molecules/Toast';
import { Friend, FriendProfileData, GroupListResponse, MeetingDTO } from '../../../types/api';
import {
  getFriendProfileData, getFriend, getFriendAnalytics, getFriendGroupIds, getFriendKnowledge,
} from '../../../services/api/friendService';
import { getGroups } from '../../../services/api/groupService';
import { getFriendMeetings, createManualMeeting } from '../../../services/api/meetingService';

// Full-page test — mock every backend-touching service ProfilePage calls on
// mount, plus the two widgets that open live connections outside the
// 'overview' tab flow (AiChatWidget's WebSocket has no jsdom polyfill here).
jest.mock('../../../services/api/friendService');
jest.mock('../../../services/api/groupService');
jest.mock('../../../services/api/flashcardService');
jest.mock('../../../services/api/meetingService');
jest.mock('../../../pwa/offlineApi', () => ({
  talkedToFriendOffline: jest.fn(),
  addFriendKnowledgeItemOffline: jest.fn(),
}));
jest.mock('../../organisms/AiChatWidget', () => () => null);
jest.mock('../../organisms/KnowledgeSummaryTable', () => () => null);

const mockGetFriendProfileData = getFriendProfileData as jest.Mock;
const mockGetFriend = getFriend as jest.Mock;
const mockGetFriendAnalytics = getFriendAnalytics as jest.Mock;
const mockGetFriendGroupIds = getFriendGroupIds as jest.Mock;
const mockGetFriendKnowledge = getFriendKnowledge as jest.Mock;
const mockGetGroups = getGroups as jest.Mock;
const mockGetFriendMeetings = getFriendMeetings as jest.Mock;
const mockCreateManualMeeting = createManualMeeting as jest.Mock;

const friend: Friend = {
  id: 7,
  name: 'Priya Shah',
  plannedSpeakingTime: '2026-08-25',
  experience: '***',
};

const profile: FriendProfileData = {
  id: 7,
  name: 'Priya Shah',
  relationshipType: 'Friend',
  dateMet: null,
  mainPhotoName: null,
};

const groupList: GroupListResponse = { success: true, groups: [], knowledgeCounts: {}, permissionCounts: {} };

const meeting = (overrides: Partial<MeetingDTO>): MeetingDTO => ({
  id: 1,
  type: 'FRIEND',
  friendId: 7,
  friendName: 'Priya Shah',
  groupId: null,
  groupName: null,
  connectionFriend1Id: null,
  connectionFriend2Id: null,
  date: '2026-09-01',
  time: null,
  location: null,
  selfAttending: true,
  attendees: [],
  source: 'FSRS_PROPOSED',
  status: 'PROPOSED',
  note: null,
  ...overrides,
});

const renderProfile = () =>
  render(
    <MemoryRouter initialEntries={['/friends/7']}>
      <ToastProvider>
        <Routes>
          <Route path="/friends/:id" element={<ProfilePage />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockGetFriendProfileData.mockResolvedValue(profile);
  mockGetFriend.mockResolvedValue(friend);
  mockGetFriendAnalytics.mockResolvedValue([]);
  mockGetFriendGroupIds.mockResolvedValue([]);
  mockGetFriendKnowledge.mockResolvedValue([]);
  mockGetGroups.mockResolvedValue(groupList);
  mockGetFriendMeetings.mockResolvedValue([]);
});

describe('ProfilePage upcoming meetings', () => {
  it('renders upcoming meetings and past ones as history', async () => {
    mockGetFriendMeetings.mockResolvedValue([
      meeting({ id: 1, source: 'FSRS_PROPOSED', status: 'PROPOSED', date: '2026-09-10' }),
      meeting({ id: 2, source: 'BIRTHDAY', status: 'PROPOSED', date: '2026-12-01' }),
      meeting({ id: 3, source: 'MANUAL', status: 'DONE', date: '2026-07-01', note: 'Coffee catch-up' }),
    ]);

    renderProfile();

    const nextContact = await screen.findByText('Next scheduled contact');
    expect(nextContact).toBeInTheDocument();

    // Scope to the "Upcoming meetings" card — "Birthday" also appears as the
    // hero stat label, so an unscoped query would match both.
    const meetingsCard = screen.getByText('Upcoming meetings').closest('div')!.parentElement as HTMLElement;
    expect(within(meetingsCard).getByText('Birthday')).toBeInTheDocument();
    expect(within(meetingsCard).getByText('History')).toBeInTheDocument();
    expect(within(meetingsCard).getByText('Coffee catch-up')).toBeInTheDocument();
    expect(within(meetingsCard).getByText('Done')).toBeInTheDocument();
  });

  it('shows an empty state when nothing is scheduled', async () => {
    renderProfile();

    expect(await screen.findByText('Nothing scheduled yet')).toBeInTheDocument();
  });

  it('opens the schedule modal and submits a manual meeting for this friend', async () => {
    mockCreateManualMeeting.mockResolvedValue(meeting({ id: 9 }));

    renderProfile();

    const scheduleButton = await screen.findByText('+ Schedule a meeting');
    fireEvent.click(scheduleButton);

    const heading = await screen.findByText('Schedule a meeting with Priya Shah');
    expect(heading).toBeInTheDocument();

    fireEvent.click(screen.getByText('Schedule'));

    await waitFor(() => expect(mockCreateManualMeeting).toHaveBeenCalledTimes(1));
    const [calledFriendId] = mockCreateManualMeeting.mock.calls[0];
    expect(calledFriendId).toBe(7);

    // Refetches the list after a successful schedule.
    await waitFor(() => expect(mockGetFriendMeetings).toHaveBeenCalledTimes(2));
  });
});
