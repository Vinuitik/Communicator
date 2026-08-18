package communicate.Friend.FriendService;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import communicate.Friend.FriendEntities.FriendKnowledgeReview;
import communicate.Friend.FriendRepositories.FriendKnowledgeReviewRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Two-pass nightly lapse job for flashcard reviews — ported mechanism (not
 * the exact numbers) from ObsidianOptimizer's chrono/BankruptcyService.java.
 * Runs in the same nightly slot as this repo's existing FsrsNeglectService
 * (both wired from ChronoJobService.applyDailyDecay).
 *
 * Pass 1 — Chronic neglect (always runs, per-row, no threshold): rows
 * overdue more than chronicNeglectDays are individually lapsed via
 * FsrsService.forget().
 *
 * Pass 2 — Mass bankruptcy (threshold gate): if the TOTAL overdue row count
 * (chronic + standard) meets or exceeds bankruptcyLimit, every remaining
 * overdue row (not already lapsed in pass 1) gets the same treatment in one
 * sweep.
 *
 * Neither pass applies any reward/penalty beyond the lapse itself — a
 * neglect/bankruptcy lapse is exogenous (the user didn't review), not
 * evidence a difficulty/interval was wrong. Matches FsrsNeglectService's own
 * "no bandit reward" rule (this feature has no bandit at all, so there's
 * nothing to skip beyond the FSRS state update itself being the only side
 * effect).
 *
 * A row with no prior FSRS state (never reviewed, still sitting on its
 * enrollment due date) that ends up overdue anyway is bootstrapped from
 * FsrsService.initialState(GRADE_HARD) before forget() is applied — treating
 * "never even attempted, and now overdue" as at least as bad as a first
 * Hard grade, rather than skipping it (which would let long-neglected new
 * cards drift with a stale due date forever, the exact bug this job exists
 * to prevent).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class FlashcardBankruptcyService {

    private final FriendKnowledgeReviewRepository reviewRepository;
    private final FsrsService fsrs;
    private final Random random = new Random();

    public record BankruptcyResult(int overdueCount, int chronicNeglected, boolean declared, int rescheduled) {}

    @Transactional
    public BankruptcyResult run(int bankruptcyLimit, int chronicNeglectDays) {
        LocalDate today = LocalDate.now();
        List<FriendKnowledgeReview> chronic = new ArrayList<>();
        List<FriendKnowledgeReview> standard = new ArrayList<>();

        for (FriendKnowledgeReview row : reviewRepository.findByFriend_FlashcardsEnabledTrue()) {
            if (!row.getDueDate().isBefore(today)) continue; // not overdue
            long daysOverdue = ChronoUnit.DAYS.between(row.getDueDate(), today);
            if (daysOverdue > chronicNeglectDays) {
                chronic.add(row);
            } else {
                standard.add(row);
            }
        }

        int totalOverdue = chronic.size() + standard.size();
        Map<LocalDate, Integer> dayLoad = new HashMap<>();

        int chronicNeglected = 0;
        for (FriendKnowledgeReview row : chronic) {
            lapseAndReschedule(row, today, dayLoad);
            chronicNeglected++;
        }
        if (chronicNeglected > 0) {
            log.info("[flashcard bankruptcy] Lapsed {} chronically neglected row(s) (>{} days overdue).", chronicNeglected, chronicNeglectDays);
        }

        if (totalOverdue < bankruptcyLimit) {
            log.info("[flashcard bankruptcy] No bankruptcy — {} overdue below threshold of {}.", totalOverdue, bankruptcyLimit);
            return new BankruptcyResult(totalOverdue, chronicNeglected, false, 0);
        }

        log.info("[flashcard bankruptcy] BANKRUPTCY DECLARED — lapsing {} remaining standard row(s).", standard.size());
        int rescheduled = 0;
        for (FriendKnowledgeReview row : standard) {
            lapseAndReschedule(row, today, dayLoad);
            rescheduled++;
        }
        return new BankruptcyResult(totalOverdue, chronicNeglected, true, rescheduled);
    }

    private void lapseAndReschedule(FriendKnowledgeReview row, LocalDate today, Map<LocalDate, Integer> dayLoad) {
        FsrsService.FsrsState prior = (row.getFsrsStability() != null && row.getFsrsDifficulty() != null)
            ? new FsrsService.FsrsState(row.getFsrsStability(), row.getFsrsDifficulty())
            : fsrs.initialState(FsrsService.GRADE_HARD);

        LocalDate anchor = row.getLastReviewedDate() != null ? row.getLastReviewedDate() : row.getDueDate();
        double elapsedDays = Math.max(0, ChronoUnit.DAYS.between(anchor, today));

        FsrsService.FsrsState lapsed = fsrs.forget(prior, elapsedDays);
        int newIntervalDays = fsrs.intervalDays(lapsed.stability(), FlashcardEnrollmentService.DESIRED_RETENTION);
        LocalDate newDue = leastLoadedDate(today, newIntervalDays, dayLoad);

        row.setFsrsStability(lapsed.stability());
        row.setFsrsDifficulty(lapsed.difficulty());
        // Reset the elapsed-time anchor to today, same as FsrsNeglectService
        // does for Friend.lastInteractionDate — otherwise the NEXT real grade
        // on this row would compute elapsedDays from the pre-lapse anchor and
        // double-count the neglected period.
        row.setLastReviewedDate(today);
        row.setDueDate(newDue);
        reviewRepository.save(row);
    }

    /** Pick the least-loaded day within [today+1, today+interval]; ties broken randomly — same policy as FsrsNeglectService. */
    private LocalDate leastLoadedDate(LocalDate today, int interval, Map<LocalDate, Integer> dayLoad) {
        int minLoad = Integer.MAX_VALUE;
        List<LocalDate> candidates = new ArrayList<>();
        for (int d = 1; d <= Math.max(1, interval); d++) {
            LocalDate candidate = today.plusDays(d);
            int load = dayLoad.getOrDefault(candidate, 0);
            if (load < minLoad) {
                minLoad = load;
                candidates.clear();
                candidates.add(candidate);
            } else if (load == minLoad) {
                candidates.add(candidate);
            }
        }
        LocalDate chosen = candidates.get(random.nextInt(candidates.size()));
        dayLoad.merge(chosen, 1, Integer::sum);
        return chosen;
    }
}
