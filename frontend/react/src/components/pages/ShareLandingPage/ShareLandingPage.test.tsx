import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ShareLandingPage from './ShareLandingPage';
import { ToastProvider } from '../../molecules/Toast';
import { takePendingShare } from '../../../pwa/shareHandoff';
import * as blobOutbox from '../../../pwa/blobOutbox';
import { getShortFriendList } from '../../../services/api/friendService';
import { ShortFriend } from '../../../types/api';

jest.mock('../../../pwa/shareHandoff', () => ({
  takePendingShare: jest.fn(),
}));
jest.mock('../../../pwa/blobOutbox', () => ({
  enqueue: jest.fn(),
  flush: jest.fn(),
}));
jest.mock('../../../services/api/friendService', () => ({
  getShortFriendList: jest.fn(),
}));

const mockedTakePendingShare = takePendingShare as jest.MockedFunction<typeof takePendingShare>;
const mockedEnqueue = blobOutbox.enqueue as jest.MockedFunction<typeof blobOutbox.enqueue>;
const mockedFlush = blobOutbox.flush as jest.MockedFunction<typeof blobOutbox.flush>;
const mockedGetShortFriendList = getShortFriendList as jest.MockedFunction<typeof getShortFriendList>;

const friends: ShortFriend[] = [{ id: 1, name: 'Ada Lovelace' }, { id: 2, name: 'Grace Hopper' }];

const makeFile = (name = 'photo.jpg', type = 'image/jpeg') => ({
  name,
  type,
  blob: new Blob(['x'], { type }),
});

// jsdom has no createObjectURL/revokeObjectURL implementation.
beforeAll(() => {
  (global.URL as unknown as { createObjectURL: () => string }).createObjectURL = jest.fn(() => 'blob:mock');
  (global.URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = jest.fn();
});

const renderPage = (search: string) =>
  render(
    <MemoryRouter initialEntries={[`/share${search}`]}>
      <ToastProvider>
        <Routes>
          <Route path="/share" element={<ShareLandingPage />} />
          <Route path="/" element={<div>home</div>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );

describe('ShareLandingPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetShortFriendList.mockResolvedValue(friends);
  });

  it('shows an expired state when there is no shareId in the URL', async () => {
    renderPage('');
    expect(await screen.findByText(/expired or was already used/i)).toBeInTheDocument();
    expect(mockedTakePendingShare).not.toHaveBeenCalled();
  });

  it('shows an expired state when takePendingShare resolves null (stale/reused link)', async () => {
    mockedTakePendingShare.mockResolvedValue(null);
    renderPage('?shared=1&shareId=abc');
    expect(await screen.findByText(/expired or was already used/i)).toBeInTheDocument();
  });

  it('renders the shared file preview and a friend picker once the hand-off resolves', async () => {
    mockedTakePendingShare.mockResolvedValue({
      id: 'abc', files: [makeFile()], title: '', text: '', ts: Date.now(),
    });
    renderPage('?shared=1&shareId=abc');

    expect(await screen.findByText('Share to a friend')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Share' })).toBeDisabled();
  });

  it('enqueues each file to blobOutbox for the selected friend and navigates home on share', async () => {
    mockedTakePendingShare.mockResolvedValue({
      id: 'abc', files: [makeFile('a.jpg'), makeFile('b.jpg')], title: '', text: '', ts: Date.now(),
    });
    mockedEnqueue.mockResolvedValue(undefined);
    mockedFlush.mockResolvedValue({ succeeded: [], failed: [], lost: [] });
    renderPage('?shared=1&shareId=abc');

    fireEvent.click(await screen.findByText('Ada Lovelace'));
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));

    await waitFor(() => expect(mockedEnqueue).toHaveBeenCalledTimes(2));
    expect(mockedEnqueue).toHaveBeenCalledWith(expect.any(Blob), { friendId: 1, requestId: expect.any(String) });
    expect(await screen.findByText('home')).toBeInTheDocument();
  });

  it('shows an error toast and stays on the page if enqueue fails', async () => {
    mockedTakePendingShare.mockResolvedValue({
      id: 'abc', files: [makeFile()], title: '', text: '', ts: Date.now(),
    });
    mockedEnqueue.mockRejectedValue(new Error('IndexedDB unavailable'));
    renderPage('?shared=1&shareId=abc');

    fireEvent.click(await screen.findByText('Ada Lovelace'));
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));

    expect(await screen.findByText('IndexedDB unavailable')).toBeInTheDocument();
    expect(screen.getByText('Share to a friend')).toBeInTheDocument();
  });
});
