import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import QuickLogModal from './QuickLogModal';
import { ToastProvider } from '../../molecules/Toast';
import { Friend, NewFriendPayload } from '../../../types/api';
import { talkedToFriendOffline } from '../../../pwa/offlineApi';

jest.mock('../../../pwa/offlineApi', () => ({
  talkedToFriendOffline: jest.fn(),
}));

const mockedTalkedToFriendOffline = talkedToFriendOffline as jest.MockedFunction<typeof talkedToFriendOffline>;

const baseFriend: Friend = {
  id: 1,
  name: 'Ada Lovelace',
  plannedSpeakingTime: '2026-08-01',
  experience: '***',
};

const renderModal = (friend: Friend | null, onSaved = jest.fn(), onClose = jest.fn()) =>
  render(
    <ToastProvider>
      <QuickLogModal friend={friend} onClose={onClose} onSaved={onSaved} />
    </ToastProvider>,
  );

describe('QuickLogModal role field', () => {
  beforeEach(() => {
    mockedTalkedToFriendOffline.mockReset();
    mockedTalkedToFriendOffline.mockResolvedValue({ queued: false, viaDrive: false });
  });

  it('pre-selects the friend\'s existing role when opened', () => {
    renderModal({ ...baseFriend, role: 'Partner' });

    const roleSelect = screen.getByRole('combobox') as HTMLSelectElement;
    expect(roleSelect.value).toBe('Partner');
  });

  it('defaults to Casual when the friend has no role set', () => {
    renderModal({ ...baseFriend, role: undefined });

    const roleSelect = screen.getByRole('combobox') as HTMLSelectElement;
    expect(roleSelect.value).toBe('Casual');
  });

  it('submits the currently-selected role in the save payload', async () => {
    renderModal({ ...baseFriend, role: 'Casual' });

    const roleSelect = screen.getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(roleSelect, { target: { value: 'Family' } });

    fireEvent.click(screen.getByText('Save & reschedule'));

    await waitFor(() => expect(mockedTalkedToFriendOffline).toHaveBeenCalledTimes(1));
    const [, payload] = mockedTalkedToFriendOffline.mock.calls[0] as [number, NewFriendPayload];
    expect(payload.role).toBe('Family');
  });

  it('leaves the role untouched (submits existing value, not a reset default) when the field is not edited', async () => {
    renderModal({ ...baseFriend, role: 'Partner' });

    fireEvent.click(screen.getByText('Save & reschedule'));

    await waitFor(() => expect(mockedTalkedToFriendOffline).toHaveBeenCalledTimes(1));
    const [, payload] = mockedTalkedToFriendOffline.mock.calls[0] as [number, NewFriendPayload];
    expect(payload.role).toBe('Partner');
  });
});
