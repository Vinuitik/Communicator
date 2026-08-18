import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FlashcardReviewPage from './FlashcardReviewPage';
import { ToastProvider } from '../../molecules/Toast';
import { FlashcardCard, FlashcardFolder } from '../../../types/api';
import { getFlashcardFolders, getFlashcardQueue, getFlashcardFolder } from '../../../services/api/flashcardService';

jest.mock('../../../services/api/flashcardService');

const mockGetFlashcardFolders = getFlashcardFolders as jest.Mock;
const mockGetFlashcardQueue = getFlashcardQueue as jest.Mock;
const mockGetFlashcardFolder = getFlashcardFolder as jest.Mock;

const folder = (overrides: Partial<FlashcardFolder>): FlashcardFolder => ({
  friendId: 1,
  friendName: 'Alex',
  dueCount: 1,
  totalCount: 1,
  ...overrides,
});

const card = (overrides: Partial<FlashcardCard>): FlashcardCard => ({
  reviewId: 1,
  friendId: 1,
  friendName: 'Alex',
  sourceType: 'FRIEND',
  sourceKnowledgeId: 10,
  fact: 'Loves hiking',
  importance: 5,
  fsrsStability: null,
  fsrsDifficulty: null,
  lastReviewedDate: null,
  dueDate: new Date().toISOString().slice(0, 10),
  ...overrides,
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <FlashcardReviewPage />
      </ToastProvider>
    </MemoryRouter>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockGetFlashcardFolder.mockResolvedValue([]);
});

describe('FlashcardReviewPage', () => {
  it('renders a starred friend\'s due facts in the Today queue', async () => {
    mockGetFlashcardFolders.mockResolvedValue([folder({})]);
    mockGetFlashcardQueue.mockResolvedValue([card({ fact: 'Loves hiking' })]);

    renderPage();

    expect(await screen.findByText('Loves hiking')).toBeInTheDocument();
    expect(screen.getByText('Alex')).toBeInTheDocument();
  });

  it('renders a sensible empty state with zero starred friends, not a blank page', async () => {
    mockGetFlashcardFolders.mockResolvedValue([]);
    mockGetFlashcardQueue.mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/no friends starred yet/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /go to friends/i })).toBeInTheDocument();
  });

  it('reveal shows the grading options', async () => {
    mockGetFlashcardFolders.mockResolvedValue([folder({})]);
    mockGetFlashcardQueue.mockResolvedValue([card({})]);

    renderPage();

    const revealButton = await screen.findByRole('button', { name: /reveal/i });
    revealButton.click();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Hard' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Good' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Easy' })).toBeInTheDocument();
    });
  });
});
