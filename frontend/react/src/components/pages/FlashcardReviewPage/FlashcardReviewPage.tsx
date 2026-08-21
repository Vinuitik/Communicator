import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Avatar from '../../atoms/Avatar';
import RatingPicker, { RatingOption } from '../../molecules/RatingPicker';
import { useToast } from '../../molecules/Toast';
import { getFlashcardFolders, getFlashcardQueue, getFlashcardFolder, gradeFlashcard } from '../../../services/api/flashcardService';
import { FlashcardCard, FlashcardFolder } from '../../../types/api';
import { ROUTES } from '../../../utils/constants';

// FsrsService.GRADE_HARD/GOOD/EASY — there's deliberately no "Again"/lapse
// grade exposed here (see FsrsService's own javadoc): that path is only
// reached via forget() from the nightly spread/bankruptcy jobs, never a
// user-pressed button.
const GRADE_OPTIONS: RatingOption[] = [
  { value: '2', label: 'Hard', color: '#F4676E' },
  { value: '3', label: 'Good', color: '#F5B544' },
  { value: '4', label: 'Easy', color: '#46D39A' },
];

// Default view = today's capped/spread queue across every starred friend
// (FlashcardSpreadService already wrote overflow forward, so this is just
// "what's due today" with no extra client-side capping). Browsing into a
// specific friend's folder shows their whole deck, uncapped — like Anki's
// Browse mode outside the daily review queue (design doc, explicit call-out).
const FlashcardReviewPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [folders, setFolders] = useState<FlashcardFolder[] | null>(null);
  const [foldersError, setFoldersError] = useState<string | null>(null);

  const [activeFolder, setActiveFolder] = useState<FlashcardFolder | null>(null); // null = "Today" queue
  const [deck, setDeck] = useState<FlashcardCard[] | null>(null);
  const [deckError, setDeckError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const loadFolders = useCallback(async () => {
    try {
      setFolders(await getFlashcardFolders());
      setFoldersError(null);
    } catch (err) {
      setFoldersError(err instanceof Error ? err.message : 'Could not load your starred friends.');
    }
  }, []);

  useEffect(() => { loadFolders(); }, [loadFolders]);

  const loadDeck = useCallback(async (folder: FlashcardFolder | null) => {
    setDeck(null);
    setDeckError(null);
    setCursor(0);
    setRevealed(false);
    try {
      setDeck(folder ? await getFlashcardFolder(folder.friendId) : await getFlashcardQueue());
    } catch (err) {
      setDeckError(err instanceof Error ? err.message : 'Could not load these flashcards.');
    }
  }, []);

  useEffect(() => { loadDeck(activeFolder); }, [activeFolder, loadDeck]);

  const totalDueToday = useMemo(() => (folders ?? []).reduce((sum, f) => sum + f.dueCount, 0), [folders]);

  const currentCard = deck && deck.length > 0 ? deck[Math.min(cursor, deck.length - 1)] : null;

  const handleGrade = async (gradeValue: string) => {
    if (!currentCard) return;
    try {
      await gradeFlashcard(currentCard.reviewId, Number(gradeValue));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save that grade.', 'error');
      return;
    }
    setRevealed(false);
    if (deck && cursor + 1 < deck.length) {
      setCursor((c) => c + 1);
    } else {
      // Deck exhausted -- refresh folder counts (and the queue/deck, in case
      // grading moved this card's due date, e.g. Easy) so the UI reflects it.
      loadFolders();
      loadDeck(activeFolder);
    }
  };

  if (folders !== null && folders.length === 0) {
    return (
      <div className="animate-ftfade max-w-[680px] mx-auto px-[30px] py-16 text-center">
        <div className="text-4xl opacity-50 mb-3">✦</div>
        <h1 className="font-display font-bold text-[22px] text-text-primary mb-2">No friends starred yet</h1>
        <p className="text-text-muted text-[13.5px] mb-5">
          Star a friend from their profile to start reviewing what you know about them as flashcards.
        </p>
        <button
          type="button"
          onClick={() => navigate(ROUTES.FRIENDS)}
          className="border-none bg-accent-gradient text-white font-bold text-[13px] px-4 py-2.5 rounded-input shadow-button-sm hover:brightness-110 transition-all"
        >
          Go to Friends
        </button>
      </div>
    );
  }

  return (
    <div className="animate-ftfade max-w-[1040px] mx-auto px-[30px] py-6">
      <div className="mb-[18px]">
        <h1 className="m-0 font-display font-bold text-[26px] tracking-tight text-text-primary">Review</h1>
        <p className="mt-[5px] mb-0 text-text-muted text-[13px]">Flashcards over what you've logged about the people you talk to constantly.</p>
      </div>

      {foldersError && <p className="text-sm text-bad mb-3">{foldersError}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-5 items-start">
        <div className="bg-surface border border-hairline rounded-card p-3.5">
          <button
            type="button"
            onClick={() => setActiveFolder(null)}
            className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-input text-left text-[13px] font-semibold transition-colors ${
              activeFolder === null ? 'bg-accent/16 text-text-emphasis' : 'text-text-muted hover:text-text-emphasis hover:bg-input'
            }`}
          >
            <span>✦ Today</span>
            {totalDueToday > 0 && <span className="text-[10.5px] font-bold text-accent-light bg-accent/[.14] px-2 py-0.5 rounded-pill">{totalDueToday}</span>}
          </button>
          <div className="mt-2 pt-2 border-t border-hairline flex flex-col gap-0.5">
            {(folders ?? []).map((folder) => (
              <button
                key={folder.friendId}
                type="button"
                onClick={() => setActiveFolder(folder)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-input text-left text-[12.5px] font-semibold transition-colors ${
                  activeFolder?.friendId === folder.friendId ? 'bg-accent/16 text-text-emphasis' : 'text-text-muted hover:text-text-emphasis hover:bg-input'
                }`}
              >
                <Avatar id={folder.friendId} name={folder.friendName} size={22} />
                <span className="flex-1 truncate">{folder.friendName}</span>
                <span className="text-[10.5px] text-text-faint">{folder.totalCount}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-surface border border-hairline rounded-card p-6 min-h-[320px] flex flex-col">
          {deckError && <p className="text-sm text-bad">{deckError}</p>}
          {!deckError && deck === null && <div className="text-center py-16 text-text-muted">Loading…</div>}
          {!deckError && deck !== null && deck.length === 0 && (
            <div className="m-auto text-center py-10">
              <div className="text-3xl opacity-50 mb-2.5">✨</div>
              <div className="text-sm text-text-muted font-semibold">
                {activeFolder ? `No cards in ${activeFolder.friendName}'s folder yet.` : 'Nothing due today.'}
              </div>
            </div>
          )}
          {currentCard && (
            <div className="flex flex-col flex-1">
              <div className="flex items-center justify-between mb-4 text-[11.5px] text-text-faint">
                <span>{currentCard.friendName}{currentCard.sourceType === 'GROUP' ? ' · shared' : ''}</span>
                <span>{cursor + 1} / {deck!.length}</span>
              </div>
              <div className="flex-1 flex items-center justify-center text-center px-4">
                <p className="text-[17px] text-text-primary leading-relaxed">{currentCard.fact}</p>
              </div>
              {!revealed ? (
                <button
                  type="button"
                  onClick={() => setRevealed(true)}
                  style={{ padding: '10px 18px' }}
                  className="mt-5 self-center border-none bg-accent-gradient text-white font-bold text-[13px] rounded-[10px] shadow-button hover:brightness-110 transition-all"
                >
                  Reveal
                </button>
              ) : (
                <div className="mt-5">
                  <p className="text-center text-[11.5px] text-text-faint mb-2">How well did you remember this?</p>
                  <RatingPicker options={GRADE_OPTIONS} value="" onChange={handleGrade} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FlashcardReviewPage;
