import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import GroupConnectionsNudge from './GroupConnectionsNudge';
import { logConnectionMeeting } from '../../../services/api/connectionMeetingService';
import { ConnectionCandidateDTO, MeetingDTO } from '../../../types/api';

jest.mock('../../../services/api/connectionMeetingService', () => ({
  logConnectionMeeting: jest.fn(),
}));

const mockedLogConnectionMeeting = logConnectionMeeting as jest.MockedFunction<typeof logConnectionMeeting>;

const stubMeeting: MeetingDTO = {
  id: 1,
  type: 'CONNECTION',
  connectionFriend1Id: 1,
  connectionFriend2Id: 2,
  date: '2026-08-20',
  time: null,
  location: null,
  selfAttending: false,
  attendees: [],
  source: 'MANUAL',
  status: 'DONE',
  outcome: 'WENT_WELL',
};

const pair: ConnectionCandidateDTO = { friend1Id: 1, friend1Name: 'Ada', friend2Id: 2, friend2Name: 'Grace' };

describe('GroupConnectionsNudge', () => {
  beforeEach(() => {
    mockedLogConnectionMeeting.mockReset();
    mockedLogConnectionMeeting.mockResolvedValue(stubMeeting);
  });

  it('calls logConnectionMeeting with the pair, an outcome, and today’s date when no note is entered', async () => {
    render(
      <GroupConnectionsNudge groupName="Book Club" candidates={[pair]} onClose={jest.fn()} />,
    );

    fireEvent.click(screen.getByText('Went well'));

    await waitFor(() => expect(mockedLogConnectionMeeting).toHaveBeenCalledTimes(1));
    const payload = mockedLogConnectionMeeting.mock.calls[0][0];
    expect(payload.friend1Id).toBe(1);
    expect(payload.friend2Id).toBe(2);
    expect(payload.outcome).toBe('WENT_WELL');
    expect(payload.note).toBeUndefined();
    expect(payload.date).toBe(new Date().toISOString().slice(0, 10));
  });

  it('includes a trimmed note field in the same call — the gap the stub version had', async () => {
    render(
      <GroupConnectionsNudge groupName="Book Club" candidates={[pair]} onClose={jest.fn()} />,
    );

    fireEvent.change(screen.getByPlaceholderText('Note (optional)'), { target: { value: '  got along great  ' } });
    fireEvent.click(screen.getByText('Neutral'));

    await waitFor(() => expect(mockedLogConnectionMeeting).toHaveBeenCalledTimes(1));
    const payload = mockedLogConnectionMeeting.mock.calls[0][0];
    expect(payload.outcome).toBe('NEUTRAL');
    expect(payload.note).toBe('got along great');
  });

  it('marks a pair logged (removes it from the remaining list) after a successful save', async () => {
    render(
      <GroupConnectionsNudge groupName="Book Club" candidates={[pair]} onClose={jest.fn()} />,
    );

    expect(screen.getByText('Ada')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Went well'));

    await waitFor(() => expect(screen.queryByText('Ada')).not.toBeInTheDocument());
    expect(screen.getByText('All caught up.')).toBeInTheDocument();
  });

  it('calls onLogged after a successful save', async () => {
    const onLogged = jest.fn();
    render(
      <GroupConnectionsNudge groupName="Book Club" candidates={[pair]} onLogged={onLogged} onClose={jest.fn()} />,
    );

    fireEvent.click(screen.getByText('Tense'));

    await waitFor(() => expect(onLogged).toHaveBeenCalledWith(1, 2, 'TENSE'));
  });

  it('shows an error and keeps the pair when the request fails, without calling onLogged', async () => {
    mockedLogConnectionMeeting.mockRejectedValueOnce(new Error('Connection not found'));
    const onLogged = jest.fn();
    render(
      <GroupConnectionsNudge groupName="Book Club" candidates={[pair]} onLogged={onLogged} onClose={jest.fn()} />,
    );

    fireEvent.click(screen.getByText('Went well'));

    await waitFor(() => expect(screen.getByText('Connection not found')).toBeInTheDocument());
    expect(screen.getByText('Ada')).toBeInTheDocument();
    expect(onLogged).not.toHaveBeenCalled();
  });
});
