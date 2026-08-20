import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ConnectionOutcomeForm from './ConnectionOutcomeForm';
import { logConnectionMeeting } from '../../../services/api/connectionMeetingService';
import { MeetingDTO } from '../../../types/api';

jest.mock('../../../services/api/connectionMeetingService', () => ({
  logConnectionMeeting: jest.fn(),
}));

const mockedLogConnectionMeeting = logConnectionMeeting as jest.MockedFunction<typeof logConnectionMeeting>;

const stubMeeting: MeetingDTO = {
  id: 1,
  connectionFriend1Id: 1,
  connectionFriend2Id: 2,
  date: '2026-08-20',
  source: 'MANUAL',
  status: 'DONE',
  outcome: 'WENT_WELL',
};

describe('ConnectionOutcomeForm', () => {
  beforeEach(() => {
    mockedLogConnectionMeeting.mockReset();
    mockedLogConnectionMeeting.mockResolvedValue(stubMeeting);
  });

  it('defaults to today and "Went well", and submits with the right pair ids', async () => {
    const onSaved = jest.fn();
    render(<ConnectionOutcomeForm friend1Id={1} friend2Id={2} onSaved={onSaved} />);

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(mockedLogConnectionMeeting).toHaveBeenCalledTimes(1));
    const payload = mockedLogConnectionMeeting.mock.calls[0][0];
    expect(payload.friend1Id).toBe(1);
    expect(payload.friend2Id).toBe(2);
    expect(payload.outcome).toBe('WENT_WELL');
    expect(payload.note).toBeUndefined();
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('switches outcome via the segmented control and includes a trimmed note', async () => {
    render(<ConnectionOutcomeForm friend1Id={5} friend2Id={9} onSaved={jest.fn()} />);

    fireEvent.click(screen.getByText('Tense'));
    fireEvent.change(screen.getByPlaceholderText('Add a fact or note…'), { target: { value: '  had a disagreement  ' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(mockedLogConnectionMeeting).toHaveBeenCalledTimes(1));
    const payload = mockedLogConnectionMeeting.mock.calls[0][0];
    expect(payload.outcome).toBe('TENSE');
    expect(payload.note).toBe('had a disagreement');
  });

  it('surfaces an error and does not call onSaved when the request fails', async () => {
    mockedLogConnectionMeeting.mockRejectedValueOnce(new Error('Error: Not Found'));
    const onSaved = jest.fn();
    render(<ConnectionOutcomeForm friend1Id={1} friend2Id={2} onSaved={onSaved} />);

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(screen.getByText('Error: Not Found')).toBeInTheDocument());
    expect(onSaved).not.toHaveBeenCalled();
  });
});
