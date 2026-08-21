import { FlashcardCard, FlashcardFolder, FlashcardReviewSettings } from '../../types/api';
import { API_BASE } from './config';

// FlashcardReviewController (friend module, mapped at /flashcards, so
// /api/friend/flashcards/** via PathPrefixConfig).
const FLASHCARDS_API = `${API_BASE.FRIEND}/flashcards`;

export const setFriendFlashcardsEnabled = async (friendId: number, enabled: boolean): Promise<void> => {
    const response = await fetch(`${FLASHCARDS_API}/friends/${friendId}/star`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
};

export const getFlashcardFolders = async (): Promise<FlashcardFolder[]> => {
    const response = await fetch(`${FLASHCARDS_API}/folders`);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
};

// Today's capped/spread queue across every starred friend combined.
export const getFlashcardQueue = async (): Promise<FlashcardCard[]> => {
    const response = await fetch(`${FLASHCARDS_API}/queue`);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
};

// One friend's whole deck (browsing directly bypasses the daily cap).
export const getFlashcardFolder = async (friendId: number): Promise<FlashcardCard[]> => {
    const response = await fetch(`${FLASHCARDS_API}/folders/${friendId}`);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
};

export const gradeFlashcard = async (reviewId: number, grade: number): Promise<FlashcardCard> => {
    const response = await fetch(`${FLASHCARDS_API}/${reviewId}/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grade }),
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
};

export const getFlashcardReviewSettings = async (): Promise<FlashcardReviewSettings> => {
    const response = await fetch(`${FLASHCARDS_API}/settings`);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
};

export const saveFlashcardReviewSettings = async (settings: FlashcardReviewSettings): Promise<FlashcardReviewSettings> => {
    const response = await fetch(`${FLASHCARDS_API}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
};
