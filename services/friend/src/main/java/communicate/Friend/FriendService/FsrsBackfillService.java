package communicate.Friend.FriendService;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import communicate.Friend.FriendEntities.Analytics;
import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendRepositories.AnalyticsRepository;
import communicate.Friend.FriendRepositories.FriendRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Seeds FSRS state (fsrsStability/fsrsDifficulty/lastInteractionDate) for
 * friends who have interaction history but predate the FSRS/bandit port —
 * design doc Next Steps #6.5, analogous to OO's FsrsStateWriter.seedFromLegacy.
 * Without this, ReviewService's first post-cutover interaction for an
 * established friend would cold-start them via fsrs.initialState(), silently
 * discarding years of relationship history the way a brand-new friend is
 * treated. Friends with fewer than 2 logged interactions have no interval to
 * derive a stability estimate from and are left to cold-start normally on
 * their first real graded interaction — there is no history to discard.
 *
 * Idempotent and cheap to re-run (skips any friend whose fsrsStability is
 * already set), so it's driven by a startup runner (FsrsBackfillRunner)
 * rather than a one-shot migration flag — consistent with this codebase's
 * ddl-auto: update convention of reconciling schema/state on every boot
 * rather than tracking migrations explicitly.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class FsrsBackfillService {

    private final FriendRepository friendRepository;
    private final AnalyticsRepository analyticsRepository;

    @Transactional
    public int backfillAll() {
        int seeded = 0;
        for (Friend friend : friendRepository.findByDeletedAtIsNull()) {
            if (friend.getFsrsStability() != null) continue; // already seeded or already active
            List<Analytics> history = analyticsRepository.findByFriendIdOrderByDateAsc(friend.getId());
            if (history.size() < 2) continue; // no interval to derive stability from

            friend.setFsrsStability(Math.max(1.0, averageGapDays(history)));
            friend.setFsrsDifficulty(difficultyFromExcitement(friend.getAverageExcitement()));
            friend.setLastInteractionDate(history.get(history.size() - 1).getDate());
            friendRepository.save(friend);
            seeded++;
        }
        if (seeded > 0) {
            log.info("[FSRS backfill] seeded {} existing friends' FSRS state from legacy history", seeded);
        }
        return seeded;
    }

    /** Mean gap between consecutive logged interactions — the closest available analog to OO's sr-interval. */
    private static double averageGapDays(List<Analytics> history) {
        long totalDays = 0;
        int gaps = 0;
        for (int i = 1; i < history.size(); i++) {
            LocalDate prev = history.get(i - 1).getDate();
            LocalDate curr = history.get(i).getDate();
            if (prev == null || curr == null) continue;
            long gap = ChronoUnit.DAYS.between(prev, curr);
            if (gap > 0) {
                totalDays += gap;
                gaps++;
            }
        }
        return gaps == 0 ? 1.0 : (double) totalDays / gaps;
    }

    /**
     * Legacy -> FSRS difficulty migration (analogous to OO's
     * FsrsService.easeToDifficulty, but from Communicator's own excitement
     * EMA scale instead of Obsidian-SR's ease). average_excitement runs
     * ~0 (neglected) to 3 (sustained "***"), inverted onto FSRS's 1-10
     * difficulty scale — a history of low excitement maps to a friend that's
     * harder to keep warm.
     */
    private static double difficultyFromExcitement(Double averageExcitement) {
        double excitement = averageExcitement != null ? averageExcitement : 1.5; // neutral default
        double normalized = Math.min(1.0, Math.max(0.0, excitement / 3.0));
        return Math.min(10.0, Math.max(1.0, 10.0 - normalized * 9.0));
    }
}
